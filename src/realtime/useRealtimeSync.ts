import { useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { useEffect } from 'react';

import type { Paginated, TimelinePost } from '../api/types';
import { handleCallSignal } from '../calls/callEngine';
import { CONVERSATIONS_KEY, MESSAGES_UNREAD_KEY, receiveRealtimeMessage } from '../hooks/useMessages';
import { patchCachedPost } from '../hooks/useTimeline';
import { useAuthStore } from '../stores/authStore';
import { useFeedbackStore } from '../stores/feedbackStore';
import { useNewPostsStore } from '../stores/newPostsStore';
import { usePresenceStore } from '../stores/presenceStore';
import type { PresenceMember } from './PusherSocket';
import { useChannel, useRealtimeConnection, useRealtimeStore } from './socket';

/**
 * Everything the app listens to regardless of screen, mounted once while
 * signed in (`RealtimeSync` in app/_layout.tsx). Screen-scoped channels —
 * an open thread's `private-conversation.{id}` — live with their screens.
 *
 * Payloads as observed live on 2026-10-14 (the guide's tables differ in
 * places; where they do, these are the shapes that actually arrive):
 *
 * - `timeline` → `post.liked {post_id, likes_count, user_id, liked}`,
 *   `comment.created {post_id, comments_count, comment:{id, parent_id,
 *   message, created_at, user}}`, `post.deleted {post_id}`, and since
 *   2026-10-16 `post.created`, which feeds Home's "New posts" pill
 *   (src/stores/newPostsStore.ts). It comes in **two shapes** (both seen
 *   that day): `{post:{id, content, has_images, has_video, media_status,
 *   likes, comments, views, created_at, user:{id, name, username, avatar}}}`
 *   for a post made through this API, and a flat `{postId, userId,
 *   authorName, authorUsername, createdAt}` — no avatar — for a real user's
 *   post, most likely published on the web. Neither carries `media` or
 *   anything viewer-specific.
 * - `presence-messaging.online` → members `{id, name, username, avatar}`.
 * - `private-user.{id}` → `call.signal` (see src/api/calls.ts). The other
 *   events are wired to the guide's shapes, read defensively, since nothing on
 *   the test accounts triggered them during probing.
 */
export function useRealtimeSync() {
  useRealtimeConnection();
  const queryClient = useQueryClient();
  const me = useAuthStore((s) => s.user?.id ?? null);

  // --- Your own channel ------------------------------------------------------
  useChannel(me ? `private-user.${me}` : null, {
    'call.signal': handleCallSignal,

    // Undocumented, verified 2026-10-14: every DM to you is also broadcast
    // here, not only on its conversation channel — which is what lets the
    // inbox update live without holding a channel per thread. The thread's
    // own channel delivers the same message; `receiveRealtimeMessage` dedupes
    // by id. The unread counts come from the server on the next list read.
    'message.sent': (data) => {
      receiveRealtimeMessage(queryClient, data);
      void queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
      void queryClient.invalidateQueries({ queryKey: MESSAGES_UNREAD_KEY });
    },

    'notification.received': (data) => {
      const count = Number(data?.unread_count);
      if (Number.isFinite(count)) {
        queryClient.setQueryData(['notifications', 'unread-count'], count);
      } else {
        void queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
      }
      void queryClient.invalidateQueries({ queryKey: ['notifications', 'list'] });

      const notification = data?.notification ?? data ?? {};
      const type = String(notification.type ?? '');
      if (type.includes('message')) {
        // A DM landed in a thread we aren't holding open: refresh the inbox.
        void queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
        void queryClient.invalidateQueries({ queryKey: MESSAGES_UNREAD_KEY });
        return;
      }
      const text = notification.title || notification.body || notification.message;
      if (typeof text === 'string' && text.trim()) {
        useFeedbackStore.getState().showToast(text.trim(), 'info');
      }
    },

    'wallet.updated': () => {
      void queryClient.invalidateQueries({ queryKey: ['wallet'] });
      void queryClient.invalidateQueries({ queryKey: ['paykoin'] });
      void queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },

    'gift.received': (data) => {
      void queryClient.invalidateQueries({ queryKey: ['paykoin'] });
      void queryClient.invalidateQueries({ queryKey: ['post-gifts'] });
      if (data?.post_id) void queryClient.invalidateQueries({ queryKey: ['post', data.post_id] });
    },

    'community.membership.changed': (data) => {
      void queryClient.invalidateQueries({ queryKey: ['communities'] });
      void queryClient.invalidateQueries({ queryKey: ['community'] });
      if (data?.community_id) {
        void queryClient.invalidateQueries({ queryKey: ['community-members', data.community_id] });
      }
    },
  });

  // --- Who's online ----------------------------------------------------------
  useChannel(me ? 'presence-messaging.online' : null, {
    'pusher:subscription_succeeded': (members: PresenceMember[]) =>
      usePresenceStore.getState().replace(members.map((m) => m.id)),
    'pusher:member_added': (member: PresenceMember) => usePresenceStore.getState().add(member.id),
    'pusher:member_removed': (member: PresenceMember) =>
      usePresenceStore.getState().remove(member.id),
  });

  // Presence is only true while we're connected to see it.
  useEffect(
    () =>
      useRealtimeStore.subscribe((state, previous) => {
        if (state.state !== 'connected' && previous.state === 'connected') {
          usePresenceStore.getState().reset();
        }
      }),
    [],
  );
  useEffect(() => () => usePresenceStore.getState().reset(), [me]);

  // --- Public timeline counts -------------------------------------------------
  useChannel(me ? 'timeline' : null, {
    'post.liked': (data) => {
      if (!data?.post_id || typeof data.likes_count !== 'number') return;
      // Our own like is already on screen (optimistically) and its echo can
      // lag a quick double-tap; only other people's likes move the count.
      if (data.user_id === me) return;
      patchCachedPost(queryClient, data.post_id, (post) => ({ ...post, likes: data.likes_count }));
    },

    'comment.created': (data) => {
      if (!data?.post_id || data?.comment?.user?.id === me) return;
      if (typeof data.comments_count === 'number') {
        patchCachedPost(queryClient, data.post_id, (post) =>
          typeof post.comments === 'number' ? { ...post, comments: data.comments_count } : post,
        );
      }
      // An open post detail shows the whole thread — fetch the new comment in.
      void queryClient.invalidateQueries({ queryKey: ['post', data.post_id], refetchType: 'active' });
    },

    'post.created': (data) => {
      const id: string | undefined = data?.post?.id ?? data?.postId;
      const author = data?.post?.user;
      const authorId: string | undefined = author?.id ?? data?.userId;
      // Your own post is already in the feed — the composer put it there.
      if (!id || !authorId || authorId === me) return;
      const feed = queryClient.getQueryData<InfiniteData<Paginated<TimelinePost>>>(['feed']);
      if (feed?.pages.some((page) => page.data.some((p) => p.id === id))) return;
      useNewPostsStore.getState().add({
        id,
        authorId,
        authorName:
          (author?.name ?? data?.authorName)?.trim() || author?.username || data?.authorUsername || '',
        authorAvatar: author?.avatar ?? null,
      });
    },

    'post.deleted': (data) => {
      if (!data?.post_id) return;
      useNewPostsStore.getState().remove([data.post_id]);
      queryClient.setQueryData<InfiniteData<Paginated<TimelinePost>>>(['feed'], (feed) =>
        feed
          ? {
              ...feed,
              pages: feed.pages.map((page) => ({
                ...page,
                data: page.data.filter((post) => post.id !== data.post_id),
              })),
            }
          : feed,
      );
    },
  });
}
