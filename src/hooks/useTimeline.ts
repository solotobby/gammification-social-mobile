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
  fetchFeed,
  fetchPost,
  postComment,
  tintFor,
  toggleLike,
  type NewPostImage,
} from '../api/timeline';
import type { Paginated, TimelinePost, TimelinePostDetailResponse } from '../api/types';
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
 * GET /timeline/post/{id} — the View endpoint. Mounting it on the detail
 * screen is what registers the view server-side, so it always refetches.
 */
export function usePost(id: string, enabled = true) {
  return useQuery({
    queryKey: ['post', id],
    queryFn: () => fetchPost(id),
    enabled,
    staleTime: 0,
    refetchOnMount: 'always',
  });
}

/** POST /timeline/post — multipart content + optional images. */
export function useCreatePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ content, images }: { content: string; images: NewPostImage[] }) =>
      createPost(content, images),
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
 * POST /timeline/like/toggle, optimistically: the heart flips and the count
 * moves immediately, the call runs silently in the background, and a failure
 * reverses the toggle and surfaces a small error toast. The server has no
 * "liked by me" flag, so the flag itself lives in the engagement store.
 */
export function useToggleLike() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (postId: string) => toggleLike(postId),
    onMutate: (postId) => {
      const wasLiked = !!useEngagementStore.getState().liked[postId];
      useEngagementStore.getState().setLiked(postId, !wasLiked);
      patchCachedPost(queryClient, postId, (post) => ({
        ...post,
        likes: Math.max(0, post.likes + (wasLiked ? -1 : 1)),
      }));
      return { wasLiked };
    },
    onError: (_error, postId, context) => {
      if (!context) return;
      useEngagementStore.getState().setLiked(postId, context.wasLiked);
      patchCachedPost(queryClient, postId, (post) => ({
        ...post,
        likes: Math.max(0, post.likes + (context.wasLiked ? 1 : -1)),
      }));
      useFeedbackStore
        .getState()
        .showToast("Couldn't update your like — please try again.", 'error');
    },
  });
}

/**
 * POST /timeline/comment, optimistically: the comment appears (session store)
 * and the count bumps right away; a failure removes it again and reports why.
 */
export function useAddComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, body }: { postId: string; body: string }) =>
      postComment(postId, body),
    onMutate: ({ postId, body }) => {
      const user = useAuthStore.getState().user;
      const comment: Comment = {
        id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
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
      return { commentId: comment.id };
    },
    onError: (error, { postId }, context) => {
      if (!context) return;
      useEngagementStore.getState().removeComment(postId, context.commentId);
      patchCachedPost(queryClient, postId, (post) => ({
        ...post,
        comments: shiftCount(post.comments, -1) as typeof post.comments,
      }));
      useFeedbackStore.getState().showApiError(error, "Couldn't post your comment.");
    },
  });
}
