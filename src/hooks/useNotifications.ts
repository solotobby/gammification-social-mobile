import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  deleteNotification,
  fetchNotifications,
  fetchUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
} from '../api/notifications';
import { useAuthStore } from '../stores/authStore';

/**
 * How often the bell badge re-reads its count. A minute is frequent enough that
 * a like feels acknowledged and rare enough that a backgrounded app isn't
 * hammering the endpoint; React Query pauses the timer while the app is
 * unfocused or offline (`focusManager`/`onlineManager`, wired in api/network.ts).
 */
const UNREAD_POLL_MS = 60_000;

/** `GET /notifications` — the list, paged. */
export function useNotifications() {
  const token = useAuthStore((s) => s.token);
  return useInfiniteQuery({
    queryKey: ['notifications', 'list'],
    queryFn: ({ pageParam }) => fetchNotifications(pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.page.next_page_url ? last.page.current_page + 1 : undefined,
    enabled: !!token,
  });
}

/**
 * `GET /notifications/unread-count` — drives the badge on Home's bell.
 *
 * Its own query so the badge doesn't pull the whole list, and so opening the
 * list can write the settled count straight into this cache.
 */
export function useUnreadNotificationCount() {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: fetchUnreadCount,
    enabled: !!token,
    refetchInterval: UNREAD_POLL_MS,
    staleTime: UNREAD_POLL_MS / 2,
  });
}

/**
 * `POST /notifications/{id}/read`.
 *
 * Optimistic: the row's dot clears immediately and the badge drops by one, both
 * of which are reverted if the call fails. Marking read is idempotent, so a
 * replay after a reconnect is harmless.
 */
export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['notifications', 'list'] });
      const previous = queryClient.getQueriesData({ queryKey: ['notifications', 'list'] });
      patchNotification(queryClient, id, { read_at: new Date().toISOString(), is_read: true });
      bumpUnread(queryClient, -1);
      return { previous };
    },
    onError: (_error, _id, context) => {
      context?.previous.forEach(([key, data]) => queryClient.setQueryData(key, data));
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
    },
  });
}

/** `POST /notifications/read-all` — clears every dot and zeroes the badge. */
export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: (unreadCount) => {
      queryClient.setQueryData(['notifications', 'unread-count'], unreadCount);
      void queryClient.invalidateQueries({ queryKey: ['notifications', 'list'] });
    },
  });
}

/** `DELETE /notifications/{id}` — drops the row from every cached page. */
export function useDeleteNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteNotification(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Cache helpers
// ---------------------------------------------------------------------------

type NotificationPages = {
  pages: { page: { data: { id?: string }[] }; unreadCount: number }[];
  pageParams: unknown[];
};

/** Merge `patch` into one cached row, wherever it sits across the pages. */
function patchNotification(
  queryClient: ReturnType<typeof useQueryClient>,
  id: string,
  patch: Record<string, unknown>,
) {
  queryClient.setQueriesData<NotificationPages>({ queryKey: ['notifications', 'list'] }, (old) => {
    if (!old?.pages) return old;
    return {
      ...old,
      pages: old.pages.map((page) => ({
        ...page,
        page: {
          ...page.page,
          data: page.page.data.map((row) => (row.id === id ? { ...row, ...patch } : row)),
        },
      })),
    };
  });
}

/** Nudge the cached badge count, floored at zero. */
function bumpUnread(queryClient: ReturnType<typeof useQueryClient>, delta: number) {
  queryClient.setQueryData<number>(['notifications', 'unread-count'], (old) =>
    Math.max(0, (old ?? 0) + delta),
  );
}
