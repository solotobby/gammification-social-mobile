import { api, UPLOAD_TIMEOUT } from './client';
import { tintFor } from './timeline';
import type {
  ApiChatMessage,
  ApiConversation,
  ApiConversationParticipant,
  ApiEnvelope,
  ApiThread,
  ApiThreadRow,
  ConversationListResponse,
  UploadFile,
} from './types';
import type { Member } from '../data/community';
import type { ChatMessage, Conversation, MessageStatus, Thread } from '../data/messages';

/**
 * Direct messages — `/conversations` (added to the collection 2026-09-27).
 *
 * Everything below was verified against the live API on 2026-09-27, including
 * several things the collection doesn't say:
 *
 * - **The thread pages backwards by cursor.** `?limit=N` returns the newest N
 *   messages (still oldest-first), and `?before_id=<message id>&limit=N` the N
 *   before that one. Neither is documented. `page`, `per_page`, `before`,
 *   `after_id` and `since_id` are all ignored, so there is no "only what's new"
 *   read — polling re-reads the newest page and merges it.
 * - **The list has no server-side search or filter** — `search`, `q`,
 *   `filter`, `unread` are all ignored — so those stay client-side.
 * - `POST /conversations/direct` is **open-or-create**: the same id comes back
 *   for `username` and for `user_id`, however many times it's called. So every
 *   "Message" button can call it without checking for an existing thread first.
 * - **Pin and mute are toggles** that answer with the resulting state; **block
 *   and unblock are sets** (idempotent). That difference is why the pin/mute
 *   hooks carry the state they *want* rather than "flip it" — see
 *   `setConversationFlag`.
 * - **Blocking hides the whole thread** from the blocker's list, and then 403s
 *   the blocker's own sends ("Access denied") and re-opens ("Messaging is not
 *   available for this user"); the *blocked* side's sends get a 400 with that
 *   same wording. Unblocking restores the thread intact, flags and all.
 * - Sends are capped at **5000 characters** and **5 images**
 *   (jpeg/png/jpg/webp/gif), and an empty body with no image is refused.
 */

/** How many messages a thread page holds. Sent explicitly — the default is undocumented. */
export const THREAD_PAGE_SIZE = 30;

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

export type ConversationPage = {
  conversations: Conversation[];
  page: number;
  lastPage: number;
  total: number;
  /** Account-wide unread messages, from the envelope root. */
  unreadTotal: number;
};

/** `GET /conversations?page=` — 20 a page, newest activity first. */
export async function fetchConversations(page: number): Promise<ConversationPage> {
  const { data } = await api.get<ConversationListResponse>('/conversations', {
    params: { page },
  });
  return {
    conversations: (data.data?.conversations ?? []).map(toConversation),
    page: data.data?.current_page ?? page,
    lastPage: data.data?.last_page ?? page,
    total: data.data?.total ?? 0,
    unreadTotal: data.unread_total ?? 0,
  };
}

/** `GET /conversations/unread-count` — `{data:{unread_count}}`, unread *messages*. */
export async function fetchMessagesUnreadCount(): Promise<number> {
  const { data } = await api.get<ApiEnvelope<{ unread_count: number }>>(
    '/conversations/unread-count',
  );
  return data.data?.unread_count ?? 0;
}

/**
 * `POST /conversations/direct` — open the thread with someone, creating it if
 * it doesn't exist. Takes either a `user_id` or a `username`; the app always
 * has the id, and usernames on this backend are free text.
 */
export async function startConversation(userId: string): Promise<Conversation> {
  const { data } = await api.post<ApiEnvelope<ApiConversation>>('/conversations/direct', {
    user_id: userId,
  });
  return toConversation(data.data);
}

/**
 * `GET /conversations/{id}` — one page of the thread, oldest first. With no
 * `beforeId` it's the newest page.
 */
export async function fetchThread(
  id: string,
  { beforeId, limit = THREAD_PAGE_SIZE }: { beforeId?: string; limit?: number } = {},
): Promise<Thread> {
  const { data } = await api.get<ApiEnvelope<ApiThread>>(`/conversations/${id}`, {
    params: { limit, ...(beforeId ? { before_id: beforeId } : {}) },
  });
  return toThread(data.data, limit);
}

/**
 * `POST /conversations/{id}/messages`. Text alone goes as JSON; anything with
 * photos goes multipart as `body` + `images[]`, the same file-part shape
 * `createPost` uses.
 */
export async function sendMessage(
  conversationId: string,
  body: string,
  images: UploadFile[] = [],
): Promise<ChatMessage> {
  const url = `/conversations/${conversationId}/messages`;
  if (images.length === 0) {
    const { data } = await api.post<ApiEnvelope<ApiChatMessage>>(url, { body });
    return toChatMessage(data.data);
  }
  const form = new FormData();
  if (body) form.append('body', body);
  // React Native's FormData takes {uri, name, type} file descriptors.
  for (const image of images) form.append('images[]', image as unknown as Blob);
  const { data } = await api.post<ApiEnvelope<ApiChatMessage>>(url, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: UPLOAD_TIMEOUT,
  });
  return toChatMessage(data.data);
}

/** `POST /conversations/{id}/read` — clears the thread's unread count. Idempotent. */
export async function markConversationRead(id: string): Promise<void> {
  await api.post(`/conversations/${id}/read`);
}

/** `POST /conversations/{id}/mute` — a toggle; answers with the new state. */
export async function toggleConversationMute(id: string): Promise<boolean> {
  const { data } = await api.post<ApiEnvelope<{ muted: boolean }>>(`/conversations/${id}/mute`);
  return !!data.data?.muted;
}

/** `POST /conversations/{id}/pin` — a toggle; answers with the new state. */
export async function toggleConversationPin(id: string): Promise<boolean> {
  const { data } = await api.post<ApiEnvelope<{ pinned: boolean }>>(`/conversations/${id}/pin`);
  return !!data.data?.pinned;
}

export type ConversationFlag = 'pinned' | 'muted';

/**
 * Put a pin/mute flag into a *known* state, over endpoints that only toggle.
 *
 * Toggling twice is harmless and toggling blind is not: a request replayed
 * after the app was offline (or killed mid-flight) would flip the flag *back*
 * if the first attempt had in fact landed. So the caller says which state it
 * wants, and a toggle that lands on the other one is simply toggled again.
 * That makes the call safe to persist and replay, which is what lets a pin
 * made in airplane mode survive a restart.
 */
export async function setConversationFlag(
  id: string,
  flag: ConversationFlag,
  value: boolean,
): Promise<boolean> {
  const toggle = flag === 'pinned' ? toggleConversationPin : toggleConversationMute;
  const result = await toggle(id);
  return result === value ? result : toggle(id);
}

/** `POST /conversations/block/{userId}` — idempotent. Hides the thread on our side. */
export async function blockMessagingUser(userId: string): Promise<void> {
  await api.post(`/conversations/block/${userId}`);
}

/** `POST /conversations/unblock/{userId}` — idempotent. The thread comes back intact. */
export async function unblockMessagingUser(userId: string): Promise<void> {
  await api.post(`/conversations/unblock/${userId}`);
}

// ---------------------------------------------------------------------------
// API → app model
// ---------------------------------------------------------------------------

function toMessagingMember(user: ApiConversationParticipant): Member {
  return {
    id: user.id,
    name: user.name?.trim() || user.username,
    handle: user.username,
    tint: tintFor(user.id),
    avatar: user.avatar ?? null,
    engagements: 0,
    followers: 0,
    following: 0,
  };
}

function toStatus(raw: string | undefined): MessageStatus | undefined {
  return raw === 'read' || raw === 'delivered' || raw === 'sent' ? raw : undefined;
}

function toEpoch(iso: string | null | undefined): number {
  const ms = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(ms) ? ms : Date.now();
}

export function toConversation(raw: ApiConversation): Conversation {
  return {
    id: raw.id,
    member: toMessagingMember(raw.participant),
    unread: raw.unread ?? 0,
    muted: !!raw.muted,
    pinned: !!raw.pinned,
    // `last_at: null` is the empty thread; its `last_message` is a placeholder
    // ("Start a conversation") that must not be shown as if someone said it.
    last: raw.last_at
      ? {
          body: raw.last_message ?? '',
          hasImage: !!raw.has_image,
          mine: !!raw.last_from_me,
          sentAt: toEpoch(raw.last_at),
        }
      : null,
  };
}

export function toChatMessage(raw: ApiChatMessage): ChatMessage {
  return {
    id: raw.id,
    mine: !!raw.mine,
    body: raw.body ?? '',
    images: Array.isArray(raw.images) ? raw.images.filter(Boolean) : [],
    sentAt: toEpoch(raw.created_at),
    status: raw.mine ? (toStatus(raw.status) ?? 'sent') : undefined,
  };
}

function isMessageRow(row: ApiThreadRow): row is ApiChatMessage {
  return row.type !== 'date';
}

/**
 * The thread response into a `Thread`. Its conversation has no preview or
 * unread count of its own — those belong to the list — so they're derived here
 * from the page itself and overwritten by the list's copy wherever both exist.
 */
function toThread(raw: ApiThread, limit: number): Thread {
  const messages = (raw.messages ?? []).filter(isMessageRow).map(toChatMessage);
  const newest = messages[messages.length - 1];
  return {
    conversation: {
      id: raw.conversation_id,
      member: toMessagingMember(raw.participant),
      unread: 0,
      muted: !!raw.muted,
      pinned: !!raw.pinned,
      last: newest
        ? {
            body: newest.body,
            hasImage: newest.images.length > 0,
            mine: newest.mine,
            sentAt: newest.sentAt,
          }
        : null,
    },
    messages,
    // A short page is the start of the thread.
    hasOlder: messages.length >= limit,
  };
}
