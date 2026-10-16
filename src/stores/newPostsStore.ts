import { create } from 'zustand';

/**
 * Posts other people have published since the feed loaded — what Home's
 * "New posts" pill counts. Filled by the realtime `post.created` event on the
 * public `timeline` channel (src/realtime/useRealtimeSync.ts), which the
 * backend started sending on 2026-10-16.
 *
 * Only the author is kept: the event carries no `media` and nothing about the
 * viewer (liked, bookmarked, earnings), so a post is fetched in full when the
 * pill is tapped (`NewPostsPill`). Newest first, capped, and not persisted — a
 * cold start loads a fresh feed anyway. Per-account: reset on sign-out.
 */
export type NewPost = {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar: string | null;
};

type NewPostsState = {
  posts: NewPost[];
  add: (post: NewPost) => void;
  remove: (ids: string[]) => void;
  reset: () => void;
};

/** More than this and the pill just says "20 new posts" — nobody counts. */
const MAX_PENDING = 20;

export const useNewPostsStore = create<NewPostsState>((set) => ({
  posts: [],

  add: (post) =>
    set((state) =>
      state.posts.some((p) => p.id === post.id)
        ? state
        : { posts: [post, ...state.posts].slice(0, MAX_PENDING) },
    ),

  remove: (ids) => set((state) => ({ posts: state.posts.filter((p) => !ids.includes(p.id)) })),

  reset: () => set({ posts: [] }),
}));
