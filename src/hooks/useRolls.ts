import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { fetchRoll, fetchRollComments, fetchRolls } from '../api/rolls';
import { useAuthStore } from '../stores/authStore';

/** GET /rolls — the randomised rolls pager, paged as you swipe. */
export function useRollsFeed() {
  const token = useAuthStore((s) => s.token);
  return useInfiniteQuery({
    queryKey: ['rolls'],
    queryFn: ({ pageParam }) => fetchRolls(pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.next_page_url ? last.current_page + 1 : undefined),
    enabled: !!token,
  });
}

/** GET /rolls/{videoId} — a single roll (deep links, share targets). */
export function useRoll(videoId: string | undefined) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ['roll', videoId],
    queryFn: () => fetchRoll(videoId!),
    enabled: !!token && !!videoId,
  });
}

/** GET /rolls/{videoId}/comments. */
export function useRollComments(videoId: string | undefined, enabled = true) {
  const token = useAuthStore((s) => s.token);
  return useInfiniteQuery({
    queryKey: ['roll-comments', videoId],
    queryFn: ({ pageParam }) => fetchRollComments(videoId!, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.next_page_url ? last.current_page + 1 : undefined),
    enabled: !!token && !!videoId && enabled,
  });
}
