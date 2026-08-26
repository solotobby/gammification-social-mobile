import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  fetchBank,
  fetchReferrals,
  fetchSocials,
  fetchTransactions,
  fetchWallet,
  saveBank,
  updateProfile,
  updateSocials,
} from '../api/account';
import type { Socials, UpdateProfilePayload } from '../api/types';
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

/** POST /user/bank — values keyed by the field names the form supplied. */
export function useSaveBank() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: Record<string, string>) => saveBank(values),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['bank'] });
      useFeedbackStore.getState().showToast('Payout information saved.', 'success');
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
