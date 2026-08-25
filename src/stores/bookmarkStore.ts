import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { Post } from '../data/community';

/**
 * Posts the user bookmarked, newest first.
 *
 * There's no bookmarks endpoint yet, so the whole post snapshot is stored
 * rather than just its id — the Bookmarks screen has nothing to fetch a saved
 * post back from, and `['post', id]` is deliberately excluded from the
 * persisted query cache (fetching it registers a view server-side). Storing the
 * snapshot means a bookmark survives a restart and renders offline; the
 * trade-off is that its counts are frozen at the moment it was saved.
 *
 * Per-account like the other engagement state — `reset()` runs on sign-out.
 */

type BookmarkState = {
  /** Newest first. */
  posts: Post[];
  isBookmarked: (postId: string) => boolean;
  /** Adds or removes the post; returns the new bookmarked state. */
  toggle: (post: Post) => boolean;
  remove: (postId: string) => void;
  reset: () => void;
};

export const useBookmarkStore = create<BookmarkState>()(
  persist(
    (set, get) => ({
      posts: [],

      isBookmarked: (postId) => get().posts.some((p) => p.id === postId),

      toggle: (post) => {
        const exists = get().posts.some((p) => p.id === post.id);
        set((state) => ({
          posts: exists
            ? state.posts.filter((p) => p.id !== post.id)
            : [post, ...state.posts],
        }));
        return !exists;
      },

      remove: (postId) =>
        set((state) => ({ posts: state.posts.filter((p) => p.id !== postId) })),

      reset: () => set({ posts: [] }),
    }),
    {
      name: 'payhankey.bookmarks',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ posts: state.posts }),
    },
  ),
);
