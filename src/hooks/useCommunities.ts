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
  deleteCommunity,
  deleteCommunityImage,
  deleteCommunityPost,
  fetchBannedMembers,
  fetchCommunityAnalytics,
  fetchCommunityEarnings,
  fetchCommunityMembers,
  fetchCommunitySubscriptionStatus,
  moderateMember,
  previewCommunityFee,
  removeMember,
  subscribeToCommunity,
  updateCommunity,
  uploadCommunityImage,
  type Community,
  type CommunityPost,
  type MemberAction,
} from '../api/communities';
import type {
  CommunityListParams,
  CreateCommunityPayload,
  UpdateCommunityPayload,
} from '../api/types';
import { useAuthStore } from '../stores/authStore';
import { useCheckoutStore } from '../stores/checkoutStore';
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
      // A screen reached through a share link is cached under the *slug*, not
      // the id, so writing the id entry alone would leave it stale.
      queryClient.invalidateQueries({ queryKey: ['community'] });
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
      queryClient.invalidateQueries({ queryKey: ['community'] });
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

// ---------------------------------------------------------------------------
// Members and moderation
//
// The members endpoint arrived 2026-09-07 and closes the "no members endpoint"
// gap the first integration had to design around — the roster can be read, so
// the web's Members tab is buildable.
// ---------------------------------------------------------------------------

/**
 * `GET /communities/{id}/members`, paged.
 *
 * Gated on `canViewMembers` for the same reason the posts query is gated on
 * `canViewFeed`: a viewer without access gets an error, not an empty list.
 */
export function useCommunityMembers(id: string | undefined, canViewMembers: boolean) {
  const token = useAuthStore((s) => s.token);
  return useInfiniteQuery({
    queryKey: ['community-members', id],
    queryFn: ({ pageParam }) => fetchCommunityMembers(id!, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.next_page_url ? last.current_page + 1 : undefined),
    enabled: !!token && !!id && canViewMembers,
  });
}

/** `GET /communities/{id}/members/banned` — owner/admin only. */
export function useBannedMembers(id: string | undefined, isAdmin: boolean) {
  const token = useAuthStore((s) => s.token);
  return useInfiniteQuery({
    queryKey: ['community-banned-members', id],
    queryFn: ({ pageParam }) => fetchBannedMembers(id!, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.next_page_url ? last.current_page + 1 : undefined),
    enabled: !!token && !!id && isAdmin,
  });
}

/** Past-tense confirmations, so the toast says what happened. */
const MEMBER_ACTION_TOAST: Record<MemberAction | 'remove', string> = {
  promote: 'Promoted to admin.',
  demote: 'Removed as admin.',
  ban: 'Member banned.',
  unban: 'Member unbanned.',
  remove: 'Member removed.',
};

/**
 * Promote / demote / ban / unban / remove, as one mutation.
 *
 * All five change who is in the roster or what they can do, so each one
 * refreshes the member lists *and* the community itself (its `members_count`
 * moves on a ban or a removal). Verified live: every verb round-trips, and
 * banning moves the row from `/members` to `/members/banned`.
 */
export function useModerateMember(id: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, action }: { userId: string; action: MemberAction | 'remove' }) =>
      action === 'remove' ? removeMember(id!, userId) : moderateMember(id!, userId, action),
    onSuccess: (_data, { action }) => {
      queryClient.invalidateQueries({ queryKey: ['community-members', id] });
      queryClient.invalidateQueries({ queryKey: ['community-banned-members', id] });
      queryClient.invalidateQueries({ queryKey: ['community', id] });
      useFeedbackStore.getState().showToast(MEMBER_ACTION_TOAST[action], 'success');
    },
    onError: (error) => {
      useFeedbackStore.getState().showApiError(error, "That didn't work.");
    },
  });
}

// ---------------------------------------------------------------------------
// Analytics and earnings (owner)
// ---------------------------------------------------------------------------

/** `GET /communities/{id}/analytics` — owner/admin only, so gated on it. */
export function useCommunityAnalytics(id: string | undefined, isAdmin: boolean) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ['community-analytics', id],
    queryFn: () => fetchCommunityAnalytics(id!),
    enabled: !!token && !!id && isAdmin,
  });
}

/** `GET /communities/{id}/earnings` — owner/admin only. */
export function useCommunityEarnings(id: string | undefined, isAdmin: boolean) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ['community-earnings', id],
    queryFn: () => fetchCommunityEarnings(id!, 1),
    enabled: !!token && !!id && isAdmin,
  });
}

// ---------------------------------------------------------------------------
// Paid communities
// ---------------------------------------------------------------------------

/** `GET /communities/{id}/subscription/status` — only meaningful when paid. */
export function useCommunitySubscription(id: string | undefined, isPaid: boolean) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ['community-subscription', id],
    queryFn: () => fetchCommunitySubscriptionStatus(id!),
    enabled: !!token && !!id && isPaid,
  });
}

/**
 * `POST /communities/{id}/subscribe` — pay to join a paid community.
 *
 * Hands the returned hosted checkout to the shared `PaymentSheet`, exactly like
 * a level upgrade; the sheet confirms afterwards by re-reading the community's
 * subscription status. When the backend settles without a payment page (no
 * `checkout_url`), the join is already done and the caches are just refreshed.
 *
 * **A dollar account cannot complete this today**: the call answers 500
 * "Unable to initialize Flutterwave payment", the same missing-provider gap
 * that stops USD level upgrades. Naira accounts get a working Korapay page
 * (verified live 2026-09-07).
 */
export function useSubscribeToCommunity(id: string | undefined, name: string) {
  const queryClient = useQueryClient();
  const openCheckout = useCheckoutStore((s) => s.open);

  return useMutation({
    mutationFn: () => subscribeToCommunity(id!),
    onSuccess: (result) => {
      if (result.checkout_url) {
        openCheckout({
          kind: 'community',
          url: result.checkout_url,
          reference: result.reference ?? '',
          label: name,
          communityId: id,
        });
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['community', id] });
      queryClient.invalidateQueries({ queryKey: ['community-subscription', id] });
      useFeedbackStore.getState().showToast(`You're in — welcome to ${name}.`, 'success');
    },
    onError: (error) => {
      useFeedbackStore.getState().showApiError(error, "Couldn't start that payment.");
    },
  });
}

/**
 * `POST /communities/fee-preview` — the real platform split for a fee the
 * creator is still typing, replacing the create form's hardcoded 10% guess.
 *
 * Debouncing belongs to the caller; this is a plain query keyed on the inputs
 * so an unchanged fee doesn't re-ask.
 */
export function useCommunityFeePreview(payload: {
  monthly_fee: number;
  fee_payer?: string;
  billing_type?: string;
  billing_interval?: string;
}) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ['community-fee-preview', payload],
    queryFn: () => previewCommunityFee(payload),
    enabled: !!token && payload.monthly_fee > 0,
    staleTime: 5 * 60 * 1000,
  });
}

// ---------------------------------------------------------------------------
// Owner settings
// ---------------------------------------------------------------------------

/** `PUT /communities/{id}` — partial update of the community's settings. */
export function useUpdateCommunity(id: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateCommunityPayload) => updateCommunity(id!, payload),
    onSuccess: (community) => {
      queryClient.setQueryData(['community', id], community);
      queryClient.invalidateQueries({ queryKey: ['community'] });
      queryClient.invalidateQueries({ queryKey: ['communities'] });
      useFeedbackStore.getState().showToast('Community updated.', 'success');
    },
    onError: (error) => {
      useFeedbackStore.getState().showApiError(error, "Couldn't save those changes.");
    },
  });
}

/**
 * `DELETE /communities/{id}` — **now live.** It used to answer 405, which is
 * why "a community created by mistake is permanent" was a standing gap.
 * Verified live 2026-09-07: the community 404s afterwards.
 */
export function useDeleteCommunity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCommunity(id),
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: ['community', id] });
      queryClient.removeQueries({ queryKey: ['community-posts', id] });
      queryClient.invalidateQueries({ queryKey: ['communities'] });
      useFeedbackStore.getState().showToast('Community deleted.', 'success');
    },
    onError: (error) => {
      useFeedbackStore.getState().showApiError(error, "Couldn't delete that community.");
    },
  });
}

/** `POST|DELETE /communities/{id}/logo` and `/banner`. */
export function useCommunityImage(id: string | undefined) {
  const queryClient = useQueryClient();
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['community'] });
    queryClient.invalidateQueries({ queryKey: ['communities'] });
  };

  const upload = useMutation({
    mutationFn: ({
      kind,
      file,
    }: {
      kind: 'logo' | 'banner';
      file: { uri: string; name: string; type: string };
    }) => uploadCommunityImage(id!, kind, file),
    onSuccess: refresh,
    onError: (error) => {
      useFeedbackStore.getState().showApiError(error, "Couldn't upload that image.");
    },
  });

  const remove = useMutation({
    mutationFn: (kind: 'logo' | 'banner') => deleteCommunityImage(id!, kind),
    onSuccess: refresh,
    onError: (error) => {
      useFeedbackStore.getState().showApiError(error, "Couldn't remove that image.");
    },
  });

  return { upload, remove };
}

/** `DELETE /communities/{id}/posts/{postId}` — owner/admin or the author. */
export function useDeleteCommunityPost(id: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (postId: string) => deleteCommunityPost(id!, postId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-posts', id] });
      queryClient.invalidateQueries({ queryKey: ['community', id] });
      useFeedbackStore.getState().showToast('Post deleted.', 'success');
    },
    onError: (error) => {
      useFeedbackStore.getState().showApiError(error, "Couldn't delete that post.");
    },
  });
}
