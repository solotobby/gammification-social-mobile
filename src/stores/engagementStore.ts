import { create } from 'zustand';

import type { Comment } from '../data/community';

/**
 * Session-local engagement state for API posts. The timeline API has no
 * "liked by me" flag and never returns comment bodies (only counts), so the
 * optimistic like flags and the comments the user writes this session live
 * here — the feed and detail screens merge them into what the server sends.
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

export const useEngagementStore = create<EngagementState>((set) => ({
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
}));

/** Stable empty list so selectors don't return a fresh array every render. */
export const NO_COMMENTS: Comment[] = [];
