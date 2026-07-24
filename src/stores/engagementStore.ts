import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { Comment } from '../data/community';

/**
 * Engagement state for API posts. The timeline API has no reliable "liked by
 * me" flag on every endpoint and never returns comment bodies (only counts), so
 * the optimistic like flags and the comments the user writes live here — the
 * feed and detail screens merge them into what the server sends.
 *
 * `myComments` is persisted so a comment written offline still shows after an
 * app restart, alongside the paused mutation that will send it. `liked` is
 * NOT: it re-seeds from the server's `is_liked_by_viewer` on each fetch, and a
 * stored value would shadow server truth permanently.
 */

type EngagementState = {
  liked: Record<string, boolean>;
  /** Comments the signed-in user posted this session, keyed by post id. */
  myComments: Record<string, Comment[]>;
  setLiked: (postId: string, liked: boolean) => void;
  /**
   * Seed the heart from the server's `is_liked_by_viewer` flag, but only if the
   * user hasn't already toggled this post this session (so an optimistic toggle
   * is never clobbered when the list refetches).
   */
  seedLiked: (postId: string, liked: boolean) => void;
  addComment: (postId: string, comment: Comment) => void;
  removeComment: (postId: string, commentId: string) => void;
};

export const useEngagementStore = create<EngagementState>()(
  persist(
    (set) => ({
      liked: {},
      myComments: {},

      setLiked: (postId, liked) =>
        set((state) => ({ liked: { ...state.liked, [postId]: liked } })),

      seedLiked: (postId, liked) =>
        set((state) =>
          Object.prototype.hasOwnProperty.call(state.liked, postId)
            ? state
            : { liked: { ...state.liked, [postId]: liked } },
        ),

      addComment: (postId, comment) =>
        set((state) => ({
          myComments: {
            ...state.myComments,
            [postId]: [...(state.myComments[postId] ?? []), comment],
          },
        })),

      removeComment: (postId, commentId) =>
        set((state) => ({
          myComments: {
            ...state.myComments,
            [postId]: (state.myComments[postId] ?? []).filter((c) => c.id !== commentId),
          },
        })),
    }),
    {
      name: 'payhankey.engagement',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ myComments: state.myComments }),
    },
  ),
);

/** Stable empty list so selectors don't return a fresh array every render. */
export const NO_COMMENTS: Comment[] = [];
