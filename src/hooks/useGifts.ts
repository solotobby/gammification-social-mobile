import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchGiftCatalog, fetchPostGifts, sendGift } from '../api/gifts';
import type { GiftPostType, GiftSendPayload } from '../api/types';
import { useAuthStore } from '../stores/authStore';
import { useFeedbackStore } from '../stores/feedbackStore';

/**
 * `GET /gifts` — the catalog. It is the same for everyone and changes about
 * never, so it is cached for the session rather than refetched per sheet.
 */
export function useGiftCatalog() {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ['gifts'],
    queryFn: fetchGiftCatalog,
    enabled: !!token,
    staleTime: 60 * 60 * 1000,
  });
}

/**
 * `GET /gifts/post/{type}/{id}` — what a post has received, plus the viewer's
 * spendable balance. `enabled` is the caller's gate so the request only fires
 * when the sheet actually opens.
 */
export function usePostGifts(
  postId: string | undefined,
  postType: GiftPostType = 'timeline',
  enabled = true,
) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ['post-gifts', postType, postId],
    queryFn: () => fetchPostGifts(postId!, postType),
    enabled: !!token && !!postId && enabled,
  });
}

/**
 * `POST /gifts/send`.
 *
 * Invalidates three things on success, because a gift moves all of them: the
 * post's own gift list, the coin balance it was paid from, and the PayKoin
 * activity feed the debit appears in. The timeline is invalidated too — posts
 * carry `gifts`/`gifts_count` inline, so the card's gift rail is stale
 * otherwise.
 */
export function useSendGift() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: GiftSendPayload) => sendGift(payload),
    onSuccess: (_data, { post_id, post_type }) => {
      void queryClient.invalidateQueries({ queryKey: ['post-gifts', post_type, post_id] });
      // One prefix covers the balance and the activity list, both of which
      // the debit changes.
      void queryClient.invalidateQueries({ queryKey: ['paykoin'] });
      void queryClient.invalidateQueries({ queryKey: ['feed'] });
      void queryClient.invalidateQueries({ queryKey: ['post', post_id] });
    },
    // Deliberately no toast here: the sheet reports the outcome in place, where
    // the user is looking, and a backend refusal ("Not enough PayKoin…") reads
    // better beside the gift than as a banner over the feed.
    onError: (error) =>
      useFeedbackStore.getState().showApiError(error, "Couldn't send that gift."),
  });
}
