import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient } from '@tanstack/react-query';
import type { PersistQueryClientOptions } from '@tanstack/react-query-persist-client';

import { ApiError } from './client';

/** Keep restored data usable for a day; older snapshots are dropped on restore. */
const MAX_AGE = 24 * 60 * 60 * 1000;

/**
 * Query keys worth surviving a cold start. Everything here is content the user
 * expects to still see with no connection; anything omitted simply refetches.
 *
 * Deliberately excluded:
 * - `post` — GET /timeline/post/{id} *registers a view* server-side, so it must
 *   always hit the network. The detail screen falls back to the cached feed
 *   entry instead (see `usePost`).
 * - `user-search` / `hashtag-posts` — transient query-scoped results that would
 *   just accumulate keys in storage.
 */
const PERSISTED_KEYS = new Set([
  'feed',
  'me',
  'profile',
  'earnings-yearly',
  'earnings-monthly',
  'trending',
  'trending-hashtags',
  'trending-members',
  'currencies',
  'channels',
]);

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      // Must be >= the persister's maxAge: an in-memory GC also evicts the
      // entry from the next persisted snapshot.
      gcTime: MAX_AGE,
      retry: (failureCount, error) => {
        // A request that never reached the server won't succeed by being sent
        // again 30s later — fail fast and let the screen offer Retry. (While
        // offline these are paused by onlineManager and never get here.)
        if (error instanceof ApiError && error.status === undefined) return false;
        return failureCount < 1;
      },
    },
  },
});

export const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'payhankey.query-cache',
  throttleTime: 1_000,
});

export const persistOptions: Omit<PersistQueryClientOptions, 'queryClient'> = {
  persister,
  maxAge: MAX_AGE,
  // Bump to invalidate every persisted cache after a breaking shape change.
  buster: 'v1',
  dehydrateOptions: {
    shouldDehydrateQuery: (query) =>
      query.state.status === 'success' &&
      PERSISTED_KEYS.has(query.queryKey[0] as string),
    /**
     * Only comments survive an app kill. They're additive and `mergeComments`
     * already de-dupes by author+body, so a replay is at worst invisible.
     *
     * Likes are deliberately NOT persisted: /timeline/like/toggle is a toggle,
     * not a set. After a restart the heart re-seeds from the server's
     * `is_liked_by_viewer`, so a replayed toggle would flip a post the UI
     * already shows as correct — and in an app that pays for engagement, a
     * silently double-toggled like is worse than one lost while offline.
     * Within a session they still pause and resume normally.
     */
    shouldDehydrateMutation: (mutation) =>
      mutation.state.isPaused && mutation.options.mutationKey?.[0] === 'addComment',
  },
};
