import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import {
  fetchHashtagPosts,
  fetchTrending,
  fetchTrendingHashtags,
  fetchTrendingMembers,
} from '../api/explore';
import { useAuthStore } from '../stores/authStore';

/** GET /explore/trending — the Explore tab's top hashtags + members cards. */
export function useTrending() {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ['trending'],
    queryFn: fetchTrending,
    enabled: !!token,
  });
}

/** GET /explore/trending/hashtags — the full "Trending topics" screen. */
export function useTrendingHashtags() {
  const token = useAuthStore((s) => s.token);
  return useInfiniteQuery({
    queryKey: ['trending-hashtags'],
    queryFn: ({ pageParam }) => fetchTrendingHashtags(pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.next_page_url ? last.current_page + 1 : undefined,
    enabled: !!token,
  });
}

/** GET /explore/trending/members — the full "Trending members" screen. */
export function useTrendingMembers() {
  const token = useAuthStore((s) => s.token);
  return useInfiniteQuery({
    queryKey: ['trending-members'],
    queryFn: ({ pageParam }) => fetchTrendingMembers(pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.next_page_url ? last.current_page + 1 : undefined,
    enabled: !!token,
  });
}

/** GET /explore/trending/hashtag/post?hashtag= — posts under one hashtag. */
export function useHashtagPosts(hashtag: string | undefined) {
  const token = useAuthStore((s) => s.token);
  return useInfiniteQuery({
    queryKey: ['hashtag-posts', hashtag],
    queryFn: ({ pageParam }) => fetchHashtagPosts(hashtag!, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.next_page_url ? last.current_page + 1 : undefined,
    enabled: !!token && !!hashtag,
  });
}
