import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import {
  fetchBoost,
  fetchBoostConfig,
  fetchBoosts,
  pauseBoost,
  resumeBoost,
  startBoost,
  toBoostCampaign,
  toBoostConfig,
} from '../api/boost';
import type { BoostPayload } from '../api/types';
import { useAuthStore } from '../stores/authStore';
import { useFeedbackStore } from '../stores/feedbackStore';

/**
 * `GET /timeline/post/{id}/boost/config` — everything the boost screen renders.
 *
 * Not cached across opens: it carries the caller's live coin balance, and a
 * stale balance is exactly the figure that must not be wrong on a screen whose
 * whole job is spending it.
 */
export function useBoostConfig(postId: string | undefined) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ['boost-config', postId],
    queryFn: async () => toBoostConfig(await fetchBoostConfig(postId!)),
    enabled: !!token && !!postId,
    staleTime: 0,
  });
}

/**
 * Just the coins-per-click rate, for the boost strip under your own posts.
 *
 * The rate is an **account-level** figure — `rate_pk_per_click` sits at the
 * config root, not under `post` — so one read covers every row on a profile
 * rather than a config request per post. Pass any post of yours.
 */
export function useBoostRate(postId: string | undefined, enabled = true) {
  const query = useBoostConfig(enabled ? postId : undefined);
  return query.data?.ratePerClick;
}

/** `GET /boosts` — the caller's campaigns, paged. */
export function useBoosts() {
  const token = useAuthStore((s) => s.token);
  return useInfiniteQuery({
    queryKey: ['boosts'],
    queryFn: async ({ pageParam }) => {
      const page = await fetchBoosts(pageParam);
      return { ...page, data: page.data.map(toBoostCampaign) };
    },
    initialPageParam: 1,
    getNextPageParam: (last) => (last.next_page_url ? last.current_page + 1 : undefined),
    enabled: !!token,
  });
}

/** `GET /boosts/{id}`. */
export function useBoost(boostId: string | undefined) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ['boost', boostId],
    queryFn: async () => toBoostCampaign(await fetchBoost(boostId!)),
    enabled: !!token && !!boostId,
  });
}

/**
 * `POST /timeline/post/{id}/boost`.
 *
 * A campaign is paid for in coins, so success invalidates the PayKoin prefix
 * alongside the boost list — the debit shows up in PayKoin activity as a
 * `post_boost` row and the balance has moved. The feed is invalidated too so
 * the post picks up `is_boosted`.
 */
export function useStartBoost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, payload }: { postId: string; payload: BoostPayload }) =>
      startBoost(postId, payload),
    onSuccess: (_data, { postId }) => {
      void queryClient.invalidateQueries({ queryKey: ['boosts'] });
      void queryClient.invalidateQueries({ queryKey: ['boost-config', postId] });
      void queryClient.invalidateQueries({ queryKey: ['paykoin'] });
      void queryClient.invalidateQueries({ queryKey: ['feed'] });
      void queryClient.invalidateQueries({ queryKey: ['post', postId] });
    },
    onError: (error) =>
      useFeedbackStore.getState().showApiError(error, "Couldn't start that promotion."),
  });
}

/**
 * Pause / resume. One hook because the two are the same call with a different
 * verb, and the screen renders a single toggle.
 */
export function useToggleBoost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ boostId, paused }: { boostId: string; paused: boolean }) =>
      // `paused` is the CURRENT state, so the action is its opposite.
      paused ? resumeBoost(boostId) : pauseBoost(boostId),
    onSuccess: (_data, { boostId, paused }) => {
      void queryClient.invalidateQueries({ queryKey: ['boosts'] });
      void queryClient.invalidateQueries({ queryKey: ['boost', boostId] });
      useFeedbackStore
        .getState()
        .showToast(paused ? 'Promotion resumed.' : 'Promotion paused.', 'success');
    },
    onError: (error) =>
      useFeedbackStore.getState().showApiError(error, "Couldn't update that promotion."),
  });
}
