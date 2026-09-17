import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  fetchBank,
  fetchPayouts,
  fetchReferrals,
  fetchSocials,
  fetchTransactions,
  fetchWallet,
  saveBank,
  updateAvatar,
  updateBanner,
  updateProfile,
  updateSocials,
} from '../api/account';
import type { MeData, Socials, UpdateProfilePayload, UploadFile } from '../api/types';
import { useAuthStore } from '../stores/authStore';
import { useFeedbackStore } from '../stores/feedbackStore';

/** GET /user/bank — the server-driven payout form plus the saved method. */
export function useBank() {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ['bank'],
    queryFn: fetchBank,
    enabled: !!token,
  });
}

/** GET /user/wallet — main / referral / promotion balances and their total. */
export function useWallet() {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ['wallet'],
    queryFn: fetchWallet,
    enabled: !!token,
  });
}

/**
 * POST (create) or PUT (update) /user/bank — values keyed by the field names
 * the form supplied. `exists` picks the verb; the backend refuses a second
 * POST outright, so getting this wrong makes every *change* to a saved payout
 * account fail. See `saveBank`.
 */
export function useSaveBank() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      values,
      exists,
    }: {
      values: Record<string, string>;
      exists: boolean;
    }) => saveBank(values, exists),
    onSuccess: (_data, { exists }) => {
      void queryClient.invalidateQueries({ queryKey: ['bank'] });
      useFeedbackStore
        .getState()
        .showToast(
          exists ? 'Payout information updated.' : 'Payout information saved.',
          'success',
        );
    },
    onError: (error) =>
      useFeedbackStore.getState().showApiError(error, "Couldn't save your payout details."),
  });
}

/** GET /user/referrals. */
export function useReferrals() {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ['referrals'],
    queryFn: fetchReferrals,
    enabled: !!token,
  });
}

/** GET /user/transactions. */
export function useTransactions() {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ['transactions'],
    queryFn: fetchTransactions,
    enabled: !!token,
  });
}

/** PUT /user/profile — date of birth, gender, location, about. */
export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateProfilePayload) => updateProfile(payload),
    onSuccess: () => {
      // /user/me and the public profile both surface these fields.
      void queryClient.invalidateQueries({ queryKey: ['me'] });
      void queryClient.invalidateQueries({ queryKey: ['profile'] });
      useFeedbackStore.getState().showToast('Profile updated.', 'success');
    },
    onError: (error) =>
      useFeedbackStore.getState().showApiError(error, "Couldn't update your profile."),
  });
}

/** GET /user/socials. */
export function useSocials() {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ['socials'],
    queryFn: fetchSocials,
    enabled: !!token,
  });
}

/** PUT /user/socials. */
export function useUpdateSocials() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Socials) => updateSocials(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['socials'] });
      useFeedbackStore.getState().showToast('Socials updated.', 'success');
    },
    onError: (error) =>
      useFeedbackStore.getState().showApiError(error, "Couldn't update your socials."),
  });
}

/**
 * GET /user/payouts — withdrawal history plus paid/queued totals, paged.
 *
 * `status` filters server-side ("Queued", "Paid"); omitted, it returns
 * everything. The totals come back on every page, so the screen reads them from
 * the first one rather than summing rows it may not have all of.
 */
export function usePayouts(status?: string) {
  const token = useAuthStore((s) => s.token);
  return useInfiniteQuery({
    queryKey: ['payouts', status ?? 'all'],
    queryFn: ({ pageParam }) => fetchPayouts(pageParam, status),
    initialPageParam: 1,
    // fetchPayouts flattens the envelope, so paging is driven by row count
    // against the page size rather than a `next_page_url` it no longer returns.
    getNextPageParam: (last, pages) =>
      last.payouts.length === PAYOUTS_PER_PAGE ? pages.length + 1 : undefined,
    enabled: !!token,
  });
}

/** The backend's page size for /user/payouts (`per_page` in the paginator). */
const PAYOUTS_PER_PAGE = 15;

/**
 * POST /user/avatar and /user/banner.
 *
 * Both answer with the whole updated user, so the `['me']` cache is written
 * from the response rather than invalidated — the new picture appears the
 * instant the upload returns, with no second round-trip and no flash of the
 * old one. The public profile is invalidated as well, since it renders the
 * same two images from a different endpoint.
 */
export function useUpdateAvatar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: UploadFile) => updateAvatar(file),
    onSuccess: (data) => {
      writeMeUser(queryClient, data.user);
      void queryClient.invalidateQueries({ queryKey: ['profile'] });
      useFeedbackStore.getState().showToast('Profile photo updated.', 'success');
    },
    onError: (error) =>
      useFeedbackStore.getState().showApiError(error, "Couldn't update your photo."),
  });
}

export function useUpdateBanner() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: UploadFile) => updateBanner(file),
    onSuccess: (data) => {
      writeMeUser(queryClient, data.user);
      void queryClient.invalidateQueries({ queryKey: ['profile'] });
      useFeedbackStore.getState().showToast('Cover photo updated.', 'success');
    },
    onError: (error) =>
      useFeedbackStore.getState().showApiError(error, "Couldn't update your cover."),
  });
}

/**
 * Merge an updated user record into the cached `/user/me`, leaving the rest of
 * that payload (level, baseCurrency, counts) untouched — the upload response
 * carries the user only, so replacing the whole entry would drop the rest.
 */
function writeMeUser(
  queryClient: ReturnType<typeof useQueryClient>,
  user: MeData['user'],
) {
  queryClient.setQueryData<MeData>(['me'], (previous) =>
    previous ? { ...previous, user: { ...previous.user, ...user } } : previous,
  );
}
