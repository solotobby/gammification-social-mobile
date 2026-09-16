import { useInfiniteQuery } from '@tanstack/react-query';
import { useEffect } from 'react';

import { fetchFollowers, fetchFollowing } from '../api/user';
import { useAuthStore } from '../stores/authStore';
import { useFollowStore } from '../stores/followStore';

export type ConnectionKind = 'followers' | 'following';

/**
 * `GET /user/profile/{username}/followers | /following`, paged 20 at a time.
 *
 * Each row carries `is_following` — the *viewer's* relationship to that member
 * — so follow buttons in these lists render their true initial state instead of
 * always starting on "Follow", which is what every other member list in the app
 * has had to do.
 */
export function useConnections(username: string | undefined, kind: ConnectionKind) {
  const token = useAuthStore((s) => s.token);
  return useInfiniteQuery({
    queryKey: ['connections', kind, username],
    queryFn: ({ pageParam }) =>
      kind === 'followers'
        ? fetchFollowers(username!, pageParam)
        : fetchFollowing(username!, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.next_page_url ? last.current_page + 1 : undefined),
    enabled: !!token && !!username,
  });
}

/**
 * Seed `followStore` from the signed-in user's real following list.
 *
 * Home's **Following** tab filters the feed against `followStore`, which until
 * now could only be filled by follows made *inside the app* — there was no
 * endpoint that answered "who does this user follow", so an account whose
 * follows were all made on the web saw a permanently empty tab. `/following`
 * closes that gap: this reads the list once and mirrors it into the store, so
 * the tab is correct from the first launch.
 *
 * It **adds, never removes.** An unfollow made elsewhere is not reconciled
 * here, because the list is paginated and this only walks the first page — the
 * cheap read that fixes the common case. Dropping ids on the strength of a
 * partial list would silently empty the tab for anyone following more than 20
 * people, which is far worse than one stale entry that the next toggle fixes.
 *
 * Mounted from Home; safe to call repeatedly, since seeding an id the store
 * already has is a no-op.
 */
export function useSeedFollowing(username: string | undefined) {
  const query = useConnections(username, 'following');
  const rows = query.data?.pages.flatMap((page) => page.data);

  useEffect(() => {
    if (!rows?.length) return;
    const setFollowing = useFollowStore.getState().setFollowing;
    for (const row of rows) setFollowing(row.id, true);
  }, [rows]);

  return query;
}
