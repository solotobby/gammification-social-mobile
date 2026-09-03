import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import {
  addCommunityPostComment,
  approveJoinRequest,
  createCommunity,
  createCommunityPost,
  fetchCommunities,
  fetchCommunity,
  fetchCommunityCategories,
  denyJoinRequest,
  fetchCommunityInvites,
  fetchCommunityPostComments,
  fetchCommunityPosts,
  fetchJoinRequests,
  joinCommunity,
  leaveCommunity,
  toCommunity,
  toCommunityComment,
  toCommunityPost,
  toggleCommunityPostLike,
  type Community,
  type CommunityPost,
} from '../api/communities';
import type { CommunityListParams, CreateCommunityPayload } from '../api/types';
import { useAuthStore } from '../stores/authStore';
import { useFeedbackStore } from '../stores/feedbackStore';

/**
 * Communities — queries and mutations over `src/api/communities.ts`.
 *
 * Membership is **server state, not client state**: unlike likes and follows,
 * every community response carries the viewer's own `membership` block, so
 * there's no store to mirror into. Join/leave simply write the community the
 * server hands back into the caches and invalidate the lists.
 */

/** The membership views the list endpoint's `filter` param supports. */
export type CommunityFilter = 'all' | 'joined' | 'mine';

export function useCommunityCategories() {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ['community-categories'],
    queryFn: fetchCommunityCategories,
    enabled: !!token,
    // Categories are a small, near-static lookup — no need to refetch per mount.
    staleTime: 30 * 60 * 1000,
  });
}

/**
 * `GET /communities`, paged. The filter/search/category are part of the key so
 * each view caches separately and switching chips doesn't show stale rows.
 */
export function useCommunityList(params: Omit<CommunityListParams, 'page'>) {
  const token = useAuthStore((s) => s.token);
  return useInfiniteQuery({
    queryKey: ['communities', params.filter ?? 'all', params.category_id ?? '', params.search ?? ''],
    queryFn: ({ pageParam }) => fetchCommunities({ ...params, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.page.next_page_url ? last.page.current_page + 1 : undefined,
    enabled: !!token,
  });
}

export function useCommunity(id: string | undefined) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ['community', id],
    queryFn: () => fetchCommunity(id!),
    enabled: !!token && !!id,
  });
}

/**
 * `GET /communities/{id}/posts`. Gated behind `canViewFeed` because the
 * endpoint 422s for viewers who aren't allowed in — the detail screen shows the
 * backend's `gateMessage` instead of firing a request that will fail.
 */
export function useCommunityPosts(id: string | undefined, canViewFeed: boolean) {
  const token = useAuthStore((s) => s.token);
  return useInfiniteQuery({
    queryKey: ['community-posts', id],
    queryFn: ({ pageParam }) => fetchCommunityPosts(id!, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.next_page_url ? last.current_page + 1 : undefined),
    enabled: !!token && !!id && canViewFeed,
    select: (data) => ({
      ...data,
      posts: data.pages.flatMap((page) => page.data.map(toCommunityPost)),
    }),
  });
}

export function useCommunityPostComments(
  id: string | undefined,
  postId: string | undefined,
  enabled = true,
) {
  const token = useAuthStore((s) => s.token);
  return useInfiniteQuery({
    queryKey: ['community-post-comments', id, postId],
    queryFn: ({ pageParam }) => fetchCommunityPostComments(id!, postId!, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.next_page_url ? last.current_page + 1 : undefined),
    enabled: !!token && !!id && !!postId && enabled,
    select: (data) => ({
      ...data,
      comments: data.pages.flatMap((page) => page.data.map(toCommunityComment)),
    }),
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateCommunity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateCommunityPayload) => createCommunity(payload),
    onSuccess: (community) => {
      queryClient.setQueryData(['community', community.id], community);
      queryClient.invalidateQueries({ queryKey: ['communities'] });
    },
  });
}

/**
 * Join. The server's answer differs by community type (joined / request_sent /
 * request_pending, or a 422 for private and paid), and it returns the updated
 * community either way, so the cache is written from the response rather than
 * guessed at optimistically — a paid community must never flip to "Joined"
 * before a payment that this API can't even take yet.
 */
export function useJoinCommunity() {
  const queryClient = useQueryClient();
  const showToast = useFeedbackStore((s) => s.showToast);
  return useMutation({
    mutationFn: ({ id, inviteToken }: { id: string; inviteToken?: string }) =>
      joinCommunity(id, inviteToken),
    onSuccess: (result) => {
      const community = toCommunity(result.community);
      queryClient.setQueryData(['community', community.id], community);
      queryClient.invalidateQueries({ queryKey: ['communities'] });
      // `action` is one of joined | already_member | request_sent |
      // request_pending — each needs its own wording, and anything unrecognised
      // falls back to the server's own message rather than a guess.
      const message =
        result.action === 'joined'
          ? `You joined ${community.name}.`
          : result.action === 'already_member'
            ? `You're already in ${community.name}.`
            : result.action === 'request_sent'
              ? 'Join request sent to the admins.'
              : result.action === 'request_pending'
                ? 'Your join request is still pending.'
                : `Updated ${community.name}.`;
      showToast(message, result.action === 'joined' ? 'success' : 'info');
    },
    onError: (error) => {
      // Private ("an invite token is required") and paid ("payment is
      // required") both land here. The backend's wording is accurate and
      // per-type, so it's shown as-is rather than replaced.
      useFeedbackStore.getState().showApiError(error, "Couldn't join this community.");
    },
  });
}

export function useLeaveCommunity() {
  const queryClient = useQueryClient();
  const showToast = useFeedbackStore((s) => s.showToast);
  return useMutation({
    mutationFn: (id: string) => leaveCommunity(id),
    onSuccess: (result) => {
      const community = toCommunity(result.community);
      queryClient.setQueryData(['community', community.id], community);
      queryClient.invalidateQueries({ queryKey: ['communities'] });
      // Leaving can close the feed behind you, so drop its pages too.
      queryClient.removeQueries({ queryKey: ['community-posts', community.id] });
      showToast(`You left ${community.name}.`, 'info');
    },
    onError: (error) => {
      useFeedbackStore.getState().showApiError(error, "Couldn't leave this community.");
    },
  });
}

export function useCreateCommunityPost(id: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => createCommunityPost(id!, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-posts', id] });
      queryClient.invalidateQueries({ queryKey: ['community', id] });
    },
    onError: (error) => {
      useFeedbackStore.getState().showApiError(error, "Couldn't publish your post.");
    },
  });
}

/**
 * Like a community post. The endpoint answers the settled `{liked, likes_count}`
 * rather than the timeline's queued 202, so the response is written straight
 * into the cached page — no engagement store, and no optimistic guess to
 * reconcile.
 */
export function useToggleCommunityPostLike(id: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (postId: string) => toggleCommunityPostLike(id!, postId),
    onSuccess: (result, postId) => {
      queryClient.setQueryData(['community-posts', id], (previous: any) => {
        if (!previous?.pages) return previous;
        return {
          ...previous,
          pages: previous.pages.map((page: any) => ({
            ...page,
            data: page.data.map((post: any) =>
              post.id === postId
                ? { ...post, is_liked: result.liked, likes_count: result.likes_count }
                : post,
            ),
          })),
        };
      });
    },
    onError: (error) => {
      useFeedbackStore.getState().showApiError(error, "Couldn't update that like.");
    },
  });
}

export function useAddCommunityPostComment(id: string | undefined, postId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => addCommunityPostComment(id!, postId!, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-post-comments', id, postId] });
      queryClient.invalidateQueries({ queryKey: ['community-posts', id] });
    },
    onError: (error) => {
      useFeedbackStore.getState().showApiError(error, "Couldn't post your comment.");
    },
  });
}

/**
 * `GET /communities/{id}/invites` — owner/admin only, so gated on that rather
 * than letting the 403 through. This is the only source of the token that makes
 * a private community joinable.
 */
export function useCommunityInvites(id: string | undefined, isAdmin: boolean) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ['community-invites', id],
    queryFn: () => fetchCommunityInvites(id!),
    enabled: !!token && !!id && isAdmin,
  });
}

/** `GET /communities/{id}/join-requests` — owner/admin only. */
export function useJoinRequests(id: string | undefined, isAdmin: boolean) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ['community-join-requests', id],
    queryFn: () => fetchJoinRequests(id!),
    enabled: !!token && !!id && isAdmin,
  });
}

/**
 * Approve or deny a pending join request. Both invalidate the request list and
 * the community itself, since approving changes `members_count`.
 */
export function useReviewJoinRequest(id: string | undefined) {
  const queryClient = useQueryClient();
  const showToast = useFeedbackStore((s) => s.showToast);
  return useMutation({
    mutationFn: ({ requestId, approve }: { requestId: string; approve: boolean }) =>
      approve ? approveJoinRequest(id!, requestId) : denyJoinRequest(id!, requestId),
    onSuccess: (_data, { approve }) => {
      queryClient.invalidateQueries({ queryKey: ['community-join-requests', id] });
      queryClient.invalidateQueries({ queryKey: ['community', id] });
      showToast(approve ? 'Request approved.' : 'Request denied.', approve ? 'success' : 'info');
    },
    onError: (error) => {
      useFeedbackStore.getState().showApiError(error, "Couldn't update that request.");
    },
  });
}

export type { Community, CommunityPost };
