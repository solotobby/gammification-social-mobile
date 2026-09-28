import {
  onlineManager,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { ApiError } from '../api/client';
import {
  blockMessagingUser,
  fetchConversations,
  fetchMessagesUnreadCount,
  fetchThread,
  markConversationRead,
  sendMessage,
  setConversationFlag,
  startConversation,
  THREAD_PAGE_SIZE,
  unblockMessagingUser,
  type ConversationFlag,
  type ConversationPage,
} from '../api/messages';
import type { Member } from '../data/community';
import type { ChatMessage, Conversation, Thread } from '../data/messages';
import { useAuthStore } from '../stores/authStore';
import { useBlockedStore } from '../stores/blockedStore';
import { useFeedbackStore } from '../stores/feedbackStore';
import { outboxToMessage, useOutboxStore, type OutboxItem } from '../stores/outboxStore';

/**
 * Direct messages — queries, the outbox sender and every write.
 *
 * **Caching.** The conversation list (`['conversations', …]`) and each thread
 * (`['conversation', id]`) are in the persisted allowlist in
 * `src/api/queryClient.ts`, so Messages opens instantly and fully offline on a
 * cold start. Unsent messages live in the persisted outbox
 * (`src/stores/outboxStore.ts`) and are drawn into their thread beside the
 * server's.
 *
 * **Freshness without a socket.** The API has no push channel for messages, so
 * everything is polled — and only while someone is looking: the open thread
 * every few seconds, the list while the Messages tab is focused, and the tab
 * badge app-wide once a minute-ish. React Query pauses all of it while the app
 * is backgrounded or offline (`focusManager` / `onlineManager`, see
 * src/api/network.ts), so none of this costs anything in a pocket.
 */

export const CONVERSATIONS_KEY = ['conversations', 'list'] as const;
export const MESSAGES_UNREAD_KEY = ['conversations', 'unread-count'] as const;
export const threadKey = (id: string) => ['conversation', id] as const;

/** The open thread re-reads its newest page this often. */
const THREAD_POLL_MS = 2_000;
/** The list re-reads while the Messages tab is on screen. */
const LIST_POLL_MS = 15_000;
/** The tab badge, app-wide. */
const UNREAD_POLL_MS = 30_000;

type ConversationPages = InfiniteData<ConversationPage, number>;

// ---------------------------------------------------------------------------
// Cache helpers
// ---------------------------------------------------------------------------

/** Every conversation currently in the list cache. */
function cachedConversations(queryClient: QueryClient): Conversation[] {
  const data = queryClient.getQueryData<ConversationPages>(CONVERSATIONS_KEY);
  return data?.pages.flatMap((page) => page.conversations) ?? [];
}

/** The cached list row for a thread, if the list has loaded it. */
export function findCachedConversation(
  queryClient: QueryClient,
  id: string,
): Conversation | undefined {
  return (
    cachedConversations(queryClient).find((c) => c.id === id) ??
    queryClient.getQueryData<Thread>(threadKey(id))?.conversation
  );
}

/** The cached thread with a given member, if there is one — works offline. */
export function findConversationWith(
  queryClient: QueryClient,
  memberId: string,
): Conversation | undefined {
  return cachedConversations(queryClient).find((c) => c.member.id === memberId);
}

/**
 * Merge `patch` into a conversation everywhere it's cached: its list row and
 * its thread's header.
 */
function patchConversation(
  queryClient: QueryClient,
  id: string,
  patch: (conversation: Conversation) => Conversation,
) {
  queryClient.setQueryData<ConversationPages>(CONVERSATIONS_KEY, (old) =>
    old
      ? {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            conversations: page.conversations.map((c) => (c.id === id ? patch(c) : c)),
          })),
        }
      : old,
  );
  queryClient.setQueryData<Thread>(threadKey(id), (old) =>
    old ? { ...old, conversation: patch(old.conversation) } : old,
  );
}

/** Add a conversation to the top of the list cache unless it's already there. */
function upsertConversation(queryClient: QueryClient, conversation: Conversation) {
  queryClient.setQueryData<ConversationPages>(CONVERSATIONS_KEY, (old) => {
    if (!old?.pages.length) return old;
    if (old.pages.some((page) => page.conversations.some((c) => c.id === conversation.id))) {
      return old;
    }
    const [first, ...rest] = old.pages;
    return {
      ...old,
      pages: [{ ...first!, conversations: [conversation, ...first!.conversations] }, ...rest],
    };
  });
}

/** Drop a conversation from the list and forget its thread. */
function removeConversation(queryClient: QueryClient, id: string) {
  queryClient.setQueryData<ConversationPages>(CONVERSATIONS_KEY, (old) =>
    old
      ? {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            conversations: page.conversations.filter((c) => c.id !== id),
          })),
        }
      : old,
  );
  queryClient.removeQueries({ queryKey: threadKey(id) });
}

/**
 * Put a freshly sent message into its thread and bump the list row's preview —
 * the step that turns an outbox bubble into a server one without a refetch.
 */
function insertSentMessage(queryClient: QueryClient, conversationId: string, message: ChatMessage) {
  queryClient.setQueryData<Thread>(threadKey(conversationId), (old) => {
    if (!old || old.messages.some((m) => m.id === message.id)) return old;
    return { ...old, messages: [...old.messages, message].sort((a, b) => a.sentAt - b.sentAt) };
  });
  patchConversation(queryClient, conversationId, (c) => ({
    ...c,
    last: {
      body: message.body,
      hasImage: message.images.length > 0,
      mine: true,
      sentAt: message.sentAt,
    },
  }));
}

/**
 * Pin/mute changes still waiting to reach the server — re-applied over every
 * fresh read, so a refetch landing before the write (on reconnect, say) can't
 * flash the old state back.
 */
function pendingFlags(queryClient: QueryClient): Map<string, Partial<Conversation>> {
  const out = new Map<string, Partial<Conversation>>();
  for (const mutation of queryClient.getMutationCache().findAll({
    mutationKey: ['conversation-flag'],
    status: 'pending',
  })) {
    const vars = mutation.state.variables as FlagVars | undefined;
    if (!vars) continue;
    out.set(vars.id, { ...out.get(vars.id), [vars.flag]: vars.value });
  }
  return out;
}

function withPendingFlags(queryClient: QueryClient, conversation: Conversation): Conversation {
  const patch = pendingFlags(queryClient).get(conversation.id);
  return patch ? { ...conversation, ...patch } : conversation;
}

/**
 * Fold a freshly read newest page into what's already cached.
 *
 * Polling only ever reads the newest page (there's no "since" cursor), so
 * without this every poll would throw away history the user scrolled up to
 * load. The fresh page wins for everything it covers — that's how a tick moves
 * from delivered to read — and cached history older than it is kept. If the
 * fresh page doesn't reach back to anything cached (more than a page arrived
 * since the last read), the two can't be stitched, so the cache restarts from
 * the fresh page and lets history reload on scroll.
 */
function mergeNewest(previous: Thread | undefined, fresh: Thread): Thread {
  if (!previous || !fresh.hasOlder) return fresh;
  const oldestFresh = fresh.messages[0];
  const joinAt = oldestFresh ? previous.messages.findIndex((m) => m.id === oldestFresh.id) : -1;
  if (joinAt === -1) return fresh;
  return {
    ...fresh,
    messages: [...previous.messages.slice(0, joinAt), ...fresh.messages],
    hasOlder: previous.hasOlder,
  };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * `GET /conversations`, paged. Pass `live` while the list is on screen to poll
 * it. Each first-page read also refreshes the tab badge from the envelope's
 * `unread_total`, so the two can't disagree.
 */
export function useConversations({ live = false }: { live?: boolean } = {}) {
  const token = useAuthStore((s) => s.token);
  const queryClient = useQueryClient();
  return useInfiniteQuery({
    queryKey: CONVERSATIONS_KEY,
    queryFn: async ({ pageParam }) => {
      const page = await fetchConversations(pageParam);
      if (pageParam === 1) queryClient.setQueryData(MESSAGES_UNREAD_KEY, page.unreadTotal);
      return {
        ...page,
        conversations: page.conversations.map((c) => withPendingFlags(queryClient, c)),
      };
    },
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.lastPage ? last.page + 1 : undefined),
    enabled: !!token,
    refetchInterval: live ? LIST_POLL_MS : false,
    staleTime: 10_000,
  });
}

/** `GET /conversations/unread-count` — the Messages tab badge. */
export function useMessagesUnreadCount() {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: MESSAGES_UNREAD_KEY,
    queryFn: fetchMessagesUnreadCount,
    enabled: !!token,
    refetchInterval: UNREAD_POLL_MS,
    staleTime: UNREAD_POLL_MS / 2,
  });
}

/**
 * `GET /conversations/{id}` — the newest page, merged over any history already
 * loaded (`mergeNewest`). Pass `live` while the thread is on screen.
 */
export function useThread(id: string | undefined, { live = false }: { live?: boolean } = {}) {
  const token = useAuthStore((s) => s.token);
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: threadKey(id ?? ''),
    queryFn: async () => {
      const fresh = await fetchThread(id!);
      // Read the cache *after* the request, so history loaded while it was in
      // flight isn't clobbered.
      const previous = queryClient.getQueryData<Thread>(threadKey(id!));
      const merged = mergeNewest(previous, fresh);
      // The list owns unread and the preview; the thread owns the flags.
      const row = cachedConversations(queryClient).find((c) => c.id === id);
      return {
        ...merged,
        conversation: withPendingFlags(queryClient, {
          ...merged.conversation,
          unread: row?.unread ?? 0,
        }),
      };
    },
    enabled: !!token && !!id,
    refetchInterval: live ? THREAD_POLL_MS : false,
    // A chat is always worth re-reading on open; the cached copy renders
    // meanwhile, so this costs no spinner.
    staleTime: 0,
  });
}

/**
 * Page further back through a thread (`before_id`). Returns a loader that's a
 * no-op while one is already running or once the start is reached.
 */
export function useLoadOlderMessages(id: string | undefined) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const running = useRef(false);

  const loadOlder = useCallback(async () => {
    if (!id || running.current) return;
    const current = queryClient.getQueryData<Thread>(threadKey(id));
    const oldest = current?.messages[0];
    if (!current?.hasOlder || !oldest || !onlineManager.isOnline()) return;
    running.current = true;
    setLoading(true);
    try {
      const page = await fetchThread(id, { beforeId: oldest.id });
      queryClient.setQueryData<Thread>(threadKey(id), (old) => {
        if (!old) return old;
        const known = new Set(old.messages.map((m) => m.id));
        return {
          ...old,
          messages: [...page.messages.filter((m) => !known.has(m.id)), ...old.messages],
          hasOlder: page.messages.length >= THREAD_PAGE_SIZE,
        };
      });
    } catch {
      // Scrolling up again retries; history isn't worth an error modal.
    } finally {
      running.current = false;
      setLoading(false);
    }
  }, [id, queryClient]);

  return { loadOlder, loading };
}

// ---------------------------------------------------------------------------
// The outbox sender
// ---------------------------------------------------------------------------

/** Delays between retries after a failure that never reached the server. */
const BACKOFF_MS = [2_000, 5_000, 15_000, 30_000, 60_000];
/** Past this many unreachable attempts *while online*, stop and let the user decide. */
const MAX_NETWORK_ATTEMPTS = 6;
/** Server errors are retried this many times before the message is marked failed. */
const MAX_SERVER_ATTEMPTS = 2;

/** Server ids that came back from our own sends this session — see `findLandedCopy`. */
const sentIds = new Set<string>();

/**
 * Does the server already hold this message?
 *
 * Asked before *re*-sending anything: an attempt that timed out may well have
 * landed with only its response lost, and the API takes no idempotency key, so
 * sending blind would double-post. A landed copy is one of our own messages
 * with the same text and photo count, dated no earlier than the first attempt
 * (less a little clock skew), that isn't already accounted for by another send.
 */
function findLandedCopy(item: OutboxItem, messages: ChatMessage[]): ChatMessage | undefined {
  const since = (item.firstAttemptAt ?? item.createdAt) - 10_000;
  return messages.find(
    (m) =>
      m.mine &&
      !m.local &&
      !sentIds.has(m.id) &&
      m.sentAt >= since &&
      m.body === item.body &&
      m.images.length === item.images.length,
  );
}

/**
 * A thread as the screen draws it: the server's messages, then this thread's
 * unsent ones in the order they were written.
 *
 * Unsent messages go *after* the server's rather than being sorted in by time:
 * they're the newest thing from where the user sits, and the device clock
 * that dates them needn't agree with the server's. A message that's mid-send
 * but whose server copy a poll has already fetched is left out, or it would
 * show twice until the send's own response lands.
 */
export function withOutbox(server: ChatMessage[], items: OutboxItem[]): ChatMessage[] {
  const pending = items
    .filter((item) => !(item.state === 'sending' && findLandedCopy(item, server)))
    .sort((a, b) => a.createdAt - b.createdAt)
    .map(outboxToMessage);
  return pending.length ? [...server, ...pending] : server;
}

/** The copy a refused message shows under its bubble. */
function refusalText(error: ApiError): string {
  if (error.status === 403) return 'You can’t message this person.';
  if (error.status === 404) return 'This conversation isn’t available any more.';
  return error.firstMessage;
}

async function deliver(queryClient: QueryClient, item: OutboxItem) {
  const outbox = useOutboxStore.getState();
  const attempts = item.attempts + 1;
  outbox.update(item.clientId, {
    state: 'sending',
    attempts,
    firstAttemptAt: item.firstAttemptAt ?? Date.now(),
    retryAt: undefined,
  });

  try {
    let message: ChatMessage | undefined;
    if (item.attempts > 0) {
      message = findLandedCopy(item, (await fetchThread(item.conversationId)).messages);
    }
    message ??= await sendMessage(item.conversationId, item.body, item.images);
    sentIds.add(message.id);
    // Same tick: the outbox bubble goes and the server's arrives, so the
    // thread never shows both or neither.
    useOutboxStore.getState().remove(item.clientId);
    insertSentMessage(queryClient, item.conversationId, message);
  } catch (error) {
    const apiError = error instanceof ApiError ? error : new ApiError(String(error));
    const unreachable = apiError.status === undefined || apiError.status === 408 || apiError.status === 429;
    const serverFault = !!apiError.status && apiError.status >= 500;

    if (unreachable && attempts < MAX_NETWORK_ATTEMPTS) {
      useOutboxStore.getState().update(item.clientId, {
        state: 'queued',
        retryAt: Date.now() + BACKOFF_MS[Math.min(attempts - 1, BACKOFF_MS.length - 1)]!,
      });
    } else if (serverFault && attempts < MAX_SERVER_ATTEMPTS) {
      useOutboxStore.getState().update(item.clientId, {
        state: 'queued',
        retryAt: Date.now() + BACKOFF_MS[0]!,
      });
    } else {
      useOutboxStore.getState().update(item.clientId, {
        state: 'failed',
        error: unreachable ? 'Couldn’t reach Payhankey.' : refusalText(apiError),
      });
    }
  }
}

/**
 * Drains the outbox whenever there's a connection: on launch, on every
 * enqueue, the moment the device comes back online, when the app returns to
 * the foreground, and when a back-off expires. One message at a time, oldest
 * first per thread. Mounted once, app-wide, by `MessagingSync`.
 */
export function useOutboxSender() {
  const queryClient = useQueryClient();
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    if (!token) return;
    let running = false;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const pump = async () => {
      if (running || cancelled) return;
      running = true;
      try {
        while (!cancelled && onlineManager.isOnline()) {
          const next = useOutboxStore.getState().next();
          if (!next) break;
          await deliver(queryClient, next);
        }
      } finally {
        running = false;
      }
      // Something is backing off: wake up when its wait is over.
      if (timer) clearTimeout(timer);
      const retryAt = useOutboxStore.getState().nextRetryAt();
      if (!cancelled && retryAt) {
        timer = setTimeout(() => void pump(), Math.max(250, retryAt - Date.now()));
      }
    };

    const unsubscribeStore = useOutboxStore.subscribe((state, previous) => {
      if (state.items !== previous.items) void pump();
    });
    const unsubscribeOnline = onlineManager.subscribe((online) => {
      if (!online) return;
      // Back online: waiting out a back-off earned while offline helps nobody.
      const { items, update } = useOutboxStore.getState();
      for (const item of items) {
        if (item.state === 'queued' && item.retryAt) update(item.clientId, { retryAt: undefined });
      }
      void pump();
    });
    const appState = AppState.addEventListener('change', (status) => {
      if (status === 'active') void pump();
    });
    void pump();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      unsubscribeStore();
      unsubscribeOnline();
      appState.remove();
    };
  }, [queryClient, token]);
}

/**
 * App-wide messaging upkeep, mounted once while signed in: runs the outbox
 * sender, and refreshes the conversation list whenever the polled badge says
 * something new arrived — so the list is already current when the tab opens.
 */
export function useMessagingSync() {
  const queryClient = useQueryClient();
  const unread = useMessagesUnreadCount().data;
  const previous = useRef<number | undefined>(undefined);

  useOutboxSender();

  useEffect(() => {
    if (unread === undefined) return;
    if (previous.current !== undefined && unread > previous.current) {
      void queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
    }
    previous.current = unread;
  }, [queryClient, unread]);
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/**
 * Queue a message. It shows in the thread immediately — as "sending" online,
 * as waiting for a connection offline — and `useOutboxSender` takes it from
 * there. Nothing is awaited here, so Send never blocks the composer.
 */
export function useSendMessage() {
  return useCallback(
    (conversationId: string, body: string, images: OutboxItem['images'] = []) =>
      useOutboxStore.getState().enqueue(conversationId, body.trim(), images),
    [],
  );
}

/**
 * `POST /conversations/{id}/read`. Optimistic — the row's badge and the tab
 * badge drop at once. Idempotent, so a replay after reconnecting is harmless.
 */
export function useMarkConversationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => markConversationRead(id),
    onMutate: (id) => {
      const unread = findCachedConversation(queryClient, id)?.unread ?? 0;
      if (unread > 0) {
        patchConversation(queryClient, id, (c) => ({ ...c, unread: 0 }));
        queryClient.setQueryData<number>(MESSAGES_UNREAD_KEY, (old) =>
          Math.max(0, (old ?? 0) - unread),
        );
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: MESSAGES_UNREAD_KEY });
    },
  });
}

type FlagVars = { id: string; flag: ConversationFlag; value: boolean };

/**
 * Teach the query client to run a pin/mute from its key alone, so one made
 * offline survives an app restart and replays on reconnect. Safe to replay
 * because `setConversationFlag` sets a state rather than flipping one. Called
 * once from app/_layout.tsx, next to the comment defaults.
 */
export function registerMessagingMutationDefaults(queryClient: QueryClient) {
  queryClient.setMutationDefaults(['conversation-flag'], {
    mutationFn: ({ id, flag, value }: FlagVars) => setConversationFlag(id, flag, value),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
    },
  });
}

/** Pin/unpin or mute/unmute — optimistic, offline-safe (see above). */
export function useSetConversationFlag() {
  const queryClient = useQueryClient();
  const showApiError = useFeedbackStore((s) => s.showApiError);
  return useMutation({
    mutationKey: ['conversation-flag'],
    mutationFn: ({ id, flag, value }: FlagVars) => setConversationFlag(id, flag, value),
    onMutate: ({ id, flag, value }) => {
      patchConversation(queryClient, id, (c) => ({ ...c, [flag]: value }));
    },
    onSuccess: (result, { id, flag }) => {
      patchConversation(queryClient, id, (c) => ({ ...c, [flag]: result }));
    },
    onError: (error, { id, flag, value }) => {
      patchConversation(queryClient, id, (c) => ({ ...c, [flag]: !value }));
      showApiError(error, 'Couldn’t update this conversation.');
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
    },
  });
}

/**
 * Open the thread with someone — from a profile, the new-message picker, or
 * anywhere else that knows a member.
 *
 * A thread already in the cache opens immediately, online or not. Otherwise
 * `POST /conversations/direct` opens-or-creates it (it's idempotent), and the
 * result is written into the list so the thread has a header before its first
 * read lands. `replace` is for the picker, so backing out of the thread returns
 * to where the picker was opened rather than to the picker.
 */
export function useOpenConversation() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const showToast = useFeedbackStore((s) => s.showToast);
  const showApiError = useFeedbackStore((s) => s.showApiError);
  const [openingFor, setOpeningFor] = useState<string | null>(null);

  const go = useCallback(
    (conversationId: string, replace: boolean) => {
      const target = { pathname: '/messages/[id]' as const, params: { id: conversationId } };
      if (replace) router.replace(target);
      else router.push(target);
    },
    [router],
  );

  const open = useCallback(
    async (member: Member, { replace = false }: { replace?: boolean } = {}) => {
      const cached = findConversationWith(queryClient, member.id);
      if (cached) {
        go(cached.id, replace);
        return;
      }
      if (!onlineManager.isOnline()) {
        showToast('You’re offline — connect to start a new conversation.', 'info');
        return;
      }
      setOpeningFor(member.id);
      try {
        const conversation = await startConversation(member.id);
        upsertConversation(queryClient, conversation);
        if (!conversation.last && !queryClient.getQueryData(threadKey(conversation.id))) {
          // A brand-new thread: seed it empty so it opens on "say hello"
          // rather than a spinner.
          queryClient.setQueryData<Thread>(threadKey(conversation.id), {
            conversation,
            messages: [],
            hasOlder: false,
          });
        }
        go(conversation.id, replace);
      } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
          // "Messaging is not available for this user" — a block, either way.
          showToast(error.message, 'error');
        } else {
          showApiError(error, 'Couldn’t open this conversation.');
        }
      } finally {
        setOpeningFor(null);
      }
    },
    [go, queryClient, showApiError, showToast],
  );

  return { open, openingFor };
}

/**
 * `POST /conversations/block/{userId}`. The server hides the thread from then
 * on, so it's dropped from every cache (and its unsent messages with it), and
 * the block is remembered locally so the profile can offer Unblock.
 */
export function useBlockMessaging() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ member }: { member: Member; conversationId?: string }) =>
      blockMessagingUser(member.id),
    // Fail fast offline rather than pausing: blocking is deliberate, and the
    // person doing it should know whether it happened.
    networkMode: 'always',
    onSuccess: (_data, { member, conversationId }) => {
      useBlockedStore.getState().setBlocked(member.id, member.name, true);
      const ids = new Set(
        cachedConversations(queryClient)
          .filter((c) => c.member.id === member.id)
          .map((c) => c.id),
      );
      if (conversationId) ids.add(conversationId);
      const outbox = useOutboxStore.getState();
      for (const id of ids) {
        removeConversation(queryClient, id);
        for (const item of outbox.items) {
          if (item.conversationId === id) outbox.remove(item.clientId);
        }
      }
      void queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

/** `POST /conversations/unblock/{userId}` — the thread comes back on the next read. */
export function useUnblockMessaging() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (member: Member) => unblockMessagingUser(member.id),
    networkMode: 'always',
    onSuccess: (_data, member) => {
      useBlockedStore.getState().setBlocked(member.id, member.name, false);
      void queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}
