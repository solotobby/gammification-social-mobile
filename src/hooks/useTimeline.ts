import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query';

import {
  createPost,
  deletePost,
  fetchBookmarks,
  fetchFeed,
  fetchPost,
  fetchPostAnalytics,
  postComment,
  tintFor,
  toggleBookmark,
  toggleLike,
  updatePost,
  type NewPostImage,
  type NewPostVideo,
  type PostEdit,
} from '../api/timeline';
import type {
  LikerPreview,
  Paginated,
  TimelinePost,
  TimelinePostDetailResponse,
} from '../api/types';
import type { Comment } from '../data/community';
import { useAuthStore } from '../stores/authStore';
import { useEngagementStore } from '../stores/engagementStore';
import { useFeedbackStore } from '../stores/feedbackStore';

/** GET /timeline/feed — infinite Laravel pagination for the Home timeline. */
export function useFeed() {
  const token = useAuthStore((s) => s.token);
  return useInfiniteQuery({
    queryKey: ['feed'],
    queryFn: ({ pageParam }) => fetchFeed(pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.next_page_url ? last.current_page + 1 : undefined),
    enabled: !!token,
  });
}

/**
 * Rebuild a detail response from the post as the feed already has it, so the
 * detail screen has something to render before (or without) a successful
 * fetch. The comment thread falls back to the feed's short preview.
 */
function feedPostAsDetail(
  queryClient: QueryClient,
  id: string,
): TimelinePostDetailResponse | undefined {
  const feed = queryClient.getQueryData<InfiniteData<Paginated<TimelinePost>>>(['feed']);
  const post = feed?.pages.flatMap((page) => page.data).find((entry) => entry.id === id);
  if (!post) return undefined;

  const preview = Array.isArray(post.comments)
    ? post.comments
    : (post.comments_preview ?? post.latest_comments ?? []);

  return {
    post,
    comments: {
      current_page: 1,
      data: preview,
      last_page: 1,
      next_page_url: null,
      per_page: preview.length,
      total: typeof post.comments === 'number' ? post.comments : preview.length,
    },
  };
}

/**
 * GET /timeline/post/{id} — the View endpoint. Mounting it on the detail
 * screen is what registers the view server-side, so it always refetches and is
 * never persisted. That leaves nothing to show offline, so the feed's copy of
 * the post stands in as placeholder data: body, media and counts render
 * immediately, and the full thread swaps in once the fetch lands.
 */
export function usePost(id: string, enabled = true) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ['post', id],
    queryFn: () => fetchPost(id),
    enabled,
    staleTime: 0,
    refetchOnMount: 'always',
    placeholderData: () => feedPostAsDetail(queryClient, id),
  });
}

/** POST /timeline/post — multipart content + optional images or a video. */
export function useCreatePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      content,
      images,
      video,
    }: {
      content: string;
      images: NewPostImage[];
      video?: NewPostVideo | null;
    }) => createPost(content, images, video),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['feed'] }),
  });
}

/**
 * DELETE /timeline/delete/post/{id}. On success the post is dropped from every
 * cached feed page (so it vanishes without a refetch) and its detail cache is
 * cleared; a failure surfaces an error toast/modal and leaves the feed intact.
 */
export function useDeletePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (postId: string) => deletePost(postId),
    onSuccess: (_data, postId) => {
      queryClient.setQueryData<InfiniteData<Paginated<TimelinePost>>>(['feed'], (data) =>
        data
          ? {
              ...data,
              pages: data.pages.map((page) => ({
                ...page,
                data: page.data.filter((post) => post.id !== postId),
              })),
            }
          : data,
      );
      queryClient.removeQueries({ queryKey: ['post', postId] });
      useFeedbackStore.getState().showToast('Post deleted.', 'success');
    },
    onError: (error) => {
      useFeedbackStore.getState().showApiError(error, "Couldn't delete your post.");
    },
  });
}

/**
 * PUT /timeline/post/{id}. A caption-only edit patches every cached copy in
 * place so the feed updates without a round trip; an edit that touched media
 * invalidates instead, because the server re-encodes and the new URLs (and
 * `media_status`) can only come from a refetch.
 */
export function useUpdatePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, edit }: { postId: string; edit: PostEdit }) =>
      updatePost(postId, edit),
    onSuccess: (_data, { postId, edit }) => {
      const touchedMedia = !!edit.images?.length || !!edit.video || !!edit.removeVideo;
      if (touchedMedia) {
        void queryClient.invalidateQueries({ queryKey: ['feed'] });
        void queryClient.invalidateQueries({ queryKey: ['post', postId] });
      } else if (edit.content != null) {
        patchCachedPost(queryClient, postId, (post) => ({ ...post, content: edit.content! }));
      }
      // The author's own profile lists the post too.
      void queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}

/** GET /timeline/post/{id}/analytics — the author's per-post breakdown. */
export function usePostAnalytics(postId: string | undefined) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ['post-analytics', postId],
    queryFn: () => fetchPostAnalytics(postId!),
    enabled: !!token && !!postId,
  });
}

/** GET /timeline/bookmarks — the saved-posts list, paged. */
export function useBookmarks() {
  const token = useAuthStore((s) => s.token);
  return useInfiniteQuery({
    queryKey: ['bookmarks'],
    queryFn: ({ pageParam }) => fetchBookmarks(pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.next_page_url ? last.current_page + 1 : undefined),
    enabled: !!token,
  });
}

/**
 * POST /timeline/bookmark/toggle, optimistically — the icon fills immediately
 * and rolls back on failure. The saved list is refetched on settle rather than
 * spliced: an unbookmark has to leave `/bookmarks`, and a bookmark has to land
 * in it in the server's order.
 *
 * Like `useToggleLike` this is a *toggle*, so the flag lives in the (unpersisted)
 * engagement store and re-seeds from `is_bookmarked` on the next fetch.
 */
export function useToggleBookmark() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (postId: string) => toggleBookmark(postId),
    onMutate: (postId) => {
      const wasBookmarked = !!useEngagementStore.getState().bookmarked[postId];
      useEngagementStore.getState().setBookmarked(postId, !wasBookmarked);
      patchCachedPost(queryClient, postId, (post) => ({
        ...post,
        is_bookmarked: !wasBookmarked,
      }));
      return { wasBookmarked };
    },
    onSuccess: (data, postId) => {
      // Trust the server's answer over the optimistic guess.
      useEngagementStore.getState().setBookmarked(postId, data.bookmarked);
      patchCachedPost(queryClient, postId, (post) => ({
        ...post,
        is_bookmarked: data.bookmarked,
      }));
    },
    onError: (error, postId, context) => {
      if (context) {
        useEngagementStore.getState().setBookmarked(postId, context.wasBookmarked);
        patchCachedPost(queryClient, postId, (post) => ({
          ...post,
          is_bookmarked: context.wasBookmarked,
        }));
      }
      // The backend refuses your own posts with a 422 whose message says so —
      // worth showing verbatim rather than a generic failure.
      useFeedbackStore.getState().showApiError(error, "Couldn't update your bookmark.");
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['bookmarks'] }),
  });
}

/** Apply `patch` to a post everywhere it's cached (feed pages + detail). */
function patchCachedPost(
  queryClient: QueryClient,
  postId: string,
  patch: <T extends TimelinePost>(post: T) => T,
) {
  queryClient.setQueryData<InfiniteData<Paginated<TimelinePost>>>(['feed'], (data) =>
    data
      ? {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            data: page.data.map((post) => (post.id === postId ? patch(post) : post)),
          })),
        }
      : data,
  );
  // The detail cache nests the post under `post` (its comment thread lives
  // alongside it), so patch reaches in rather than replacing the whole entry.
  queryClient.setQueryData<TimelinePostDetailResponse>(['post', postId], (res) =>
    res ? { ...res, post: patch(res.post) } : res,
  );
}

function shiftCount(count: number | unknown, delta: number): number | unknown {
  return typeof count === 'number' ? Math.max(0, count + delta) : count;
}

/**
 * Keep a post's `likers_preview` in sync with an optimistic like toggle so the
 * "liked by" avatar row reflects the user's own like immediately (the server
 * snapshot only catches up on the next refetch). Prepends the current user when
 * liking, drops them when unliking.
 */
function patchLikers(
  list: LikerPreview[] | undefined,
  user: { id: string; name: string; username: string } | null,
  wasLiked: boolean,
): LikerPreview[] | undefined {
  if (!user) return list;
  const current = list ?? [];
  if (wasLiked) return current.filter((liker) => liker.id !== user.id);
  if (current.some((liker) => liker.id === user.id)) return current;
  return [{ id: user.id, name: user.name, username: user.username, avatar: null }, ...current];
}

/**
 * POST /timeline/like/toggle, optimistically: the heart flips and the count
 * moves immediately, the call runs silently in the background, and a failure
 * reverses the toggle and surfaces a small error toast. The server has no
 * "liked by me" flag, so the flag itself lives in the engagement store.
 *
 * Offline the mutation is paused, so the heart simply stays flipped until the
 * connection returns instead of rolling back. Unlike comments this is not
 * persisted across an app restart — see `shouldDehydrateMutation` in
 * src/api/queryClient.ts for why replaying a *toggle* is unsafe.
 */
export function useToggleLike() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['toggleLike'],
    mutationFn: (postId: string) => toggleLike(postId),
    onMutate: (postId) => {
      const wasLiked = !!useEngagementStore.getState().liked[postId];
      useEngagementStore.getState().setLiked(postId, !wasLiked);
      const user = useAuthStore.getState().user;
      patchCachedPost(queryClient, postId, (post) => ({
        ...post,
        likes: Math.max(0, (post.likes ?? 0) + (wasLiked ? -1 : 1)),
        likers_preview: patchLikers(post.likers_preview, user, wasLiked),
      }));
      return { wasLiked };
    },
    onError: (_error, postId, context) => {
      if (!context) return;
      useEngagementStore.getState().setLiked(postId, context.wasLiked);
      const user = useAuthStore.getState().user;
      patchCachedPost(queryClient, postId, (post) => ({
        ...post,
        likes: Math.max(0, (post.likes ?? 0) + (context.wasLiked ? 1 : -1)),
        likers_preview: patchLikers(post.likers_preview, user, !context.wasLiked),
      }));
      useFeedbackStore
        .getState()
        .showToast("Couldn't update your like — please try again.", 'error');
    },
  });
}

/** Variables for a comment mutation. */
export type AddCommentVars = { postId: string; body: string; clientId: string };

/**
 * Id for an optimistic comment. It travels in the mutation *variables* rather
 * than in onMutate's context so that a comment paused while offline can still
 * be identified after an app restart, when only the key and variables survive.
 */
export function newCommentId(): string {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Undo an optimistic comment and explain why. Shared by the live and restored paths. */
function rollbackComment(
  queryClient: QueryClient,
  { postId, clientId }: AddCommentVars,
  error: unknown,
) {
  useEngagementStore.getState().removeComment(postId, clientId);
  patchCachedPost(queryClient, postId, (post) => ({
    ...post,
    comments: shiftCount(post.comments, -1) as typeof post.comments,
  }));
  useFeedbackStore.getState().showApiError(error, "Couldn't post your comment.");
}

/**
 * Teach the query client how to run a comment mutation from its key alone.
 * Functions can't be persisted — a restored mutation carries only its key and
 * variables — so without this a comment paused across an app restart could
 * never be replayed. Called once from app/_layout.tsx.
 */
export function registerMutationDefaults(queryClient: QueryClient) {
  queryClient.setMutationDefaults(['addComment'], {
    mutationFn: ({ postId, body }: AddCommentVars) => postComment(postId, body),
    onError: (error, variables: AddCommentVars) =>
      rollbackComment(queryClient, variables, error),
  });
}

/**
 * POST /timeline/comment, optimistically: the comment appears (engagement
 * store) and the count bumps right away. Offline the mutation is *paused*
 * rather than failed — the comment stays put and sends itself on reconnect.
 * A real failure removes it again and reports why.
 */
export function useAddComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['addComment'],
    mutationFn: ({ postId, body }: AddCommentVars) => postComment(postId, body),
    onMutate: ({ postId, body, clientId }) => {
      const user = useAuthStore.getState().user;
      const comment: Comment = {
        id: clientId,
        author: {
          id: user?.id ?? 'me',
          name: user?.name ?? 'You',
          handle: user?.username ?? 'you',
          tint: tintFor(user?.id ?? 'me'),
          engagements: 0,
          followers: 0,
          following: 0,
        },
        body,
        timeAgo: 'now',
      };
      useEngagementStore.getState().addComment(postId, comment);
      patchCachedPost(queryClient, postId, (post) => ({
        ...post,
        comments: shiftCount(post.comments, 1) as typeof post.comments,
      }));
    },
    onError: (error, variables) => rollbackComment(queryClient, variables, error),
  });
}
