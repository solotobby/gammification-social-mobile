import { useEffect } from 'react';
import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query';

import {
  fetchChannels,
  fetchCurrencies,
  fetchProfile,
  searchUsers,
  toggleFollow,
} from '../api/user';
import { useAuthStore } from '../stores/authStore';
import { useLevelStore } from '../stores/levelStore';
import { toUserLevel } from '../api/levels';

/** GET /user/currency/list — cached long; the option list rarely changes. */
export function useCurrencies() {
  return useQuery({
    queryKey: ['currencies'],
    queryFn: fetchCurrencies,
    staleTime: 60 * 60_000,
  });
}

/** GET /user/channel — the "how did you hear about us?" options. */
export function useChannels() {
  return useQuery({
    queryKey: ['channels'],
    queryFn: fetchChannels,
    staleTime: 60 * 60_000,
  });
}

/**
 * GET /user/profile/{username} — the member header plus their posts as infinite
 * pages. The `profile` object is identical on every page, so screens read it
 * from the first page.
 */
export function useProfile(username: string | undefined) {
  const token = useAuthStore((s) => s.token);
  const query = useInfiniteQuery({
    queryKey: ['profile', username],
    queryFn: ({ pageParam }) => fetchProfile(username!, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.data.next_page_url ? last.data.current_page + 1 : undefined,
    enabled: !!username && !!token,
  });
  // One of only two endpoints that report a level — remember it for this
  // member's posts, comments and DMs elsewhere. See levelStore.
  const first = query.data?.pages[0];
  const userId = first?.profile.id;
  const level = toUserLevel(first?.level);
  useEffect(() => {
    if (userId) useLevelStore.getState().setLevel(userId, level);
  }, [userId, level]);
  return query;
}

/**
 * GET /user/search?q= — paginated people search. Pass an already-debounced
 * query; it only fires once the trimmed term is non-empty.
 */
export function useSearchUsers(query: string) {
  const token = useAuthStore((s) => s.token);
  const q = query.trim();
  return useInfiniteQuery({
    queryKey: ['user-search', q],
    queryFn: ({ pageParam }) => searchUsers(q, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.next_page_url ? last.current_page + 1 : undefined,
    enabled: !!token && q.length > 0,
  });
}

/**
 * GET /user/toggle/follow?id= — follow/unfollow. Screens drive the optimistic
 * UI (the endpoint has no "am I following" flag on read), using the returned
 * `following` state to confirm and `onError` to revert.
 */
export function useToggleFollow() {
  return useMutation({ mutationFn: (userId: string) => toggleFollow(userId) });
}
