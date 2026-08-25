import { useMutation, useQueryClient } from '@tanstack/react-query';

import { fetchMe, login, register, resendOtp, updateOnboarding, verifyOtp } from '../api/auth';
import { persister } from '../api/queryClient';
import type { LoginPayload, MeData, VerifyOtpPayload } from '../api/types';
import { useAuthStore } from '../stores/authStore';
import { useBookmarkStore } from '../stores/bookmarkStore';
import { useEngagementStore } from '../stores/engagementStore';
import { useFollowStore } from '../stores/followStore';
import { useHiddenStore } from '../stores/hiddenStore';

/**
 * Persist and activate a session. Flipping the auth store also flips the
 * router's Protected guards (app/_layout.tsx), so callers control WHEN this
 * runs relative to their own navigation — navigate to a route that exists on
 * the other side of the guard first (or rely on the guard's auto-redirect).
 */
export async function activateSession(token: string, me: MeData): Promise<void> {
  await useAuthStore.getState().setSession(token, {
    id: me.user.id,
    name: me.user.name,
    username: me.user.username,
    email: me.user.email,
  });
}

/** POST /register — returns the new user's id (needed to verify/resend). */
export function useRegister() {
  return useMutation({ mutationFn: register });
}

/**
 * POST /verify/otp — verification also signs the user in, so this fetches the
 * profile with the fresh token. It does NOT activate the session; the screen
 * calls `activateSession` after navigating (see the guard note above).
 */
export function useVerifyOtp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: VerifyOtpPayload) => {
      const { token } = await verifyOtp(payload);
      const me = await fetchMe(token);
      return { token, me };
    },
    onSuccess: ({ me }) => {
      queryClient.setQueryData(['me'], me);
    },
  });
}

export function useResendOtp() {
  return useMutation({ mutationFn: resendOtp });
}

/**
 * Login also fetches /user/me so callers can route on `is_onboarded`
 * (finished users land on /home, unfinished ones resume /get-started).
 * Session activation is left to the screen, same as useVerifyOtp.
 */
export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: LoginPayload) => {
      const data = await login(payload);
      const me = await fetchMe(data.access_token);
      return { ...data, me };
    },
    onSuccess: ({ me }) => {
      queryClient.setQueryData(['me'], me);
    },
  });
}

export function useUpdateOnboarding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateOnboarding,
    // /user/me carries is_onboarded, so refresh it after onboarding completes.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['me'] }),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return async () => {
    await useAuthStore.getState().signOut();
    queryClient.clear();
    // Everything below is per-account and would otherwise survive into the next
    // sign-in on the same device: the engagement store's hearts/comments, the
    // follow set behind Home's Following tab, saved posts, and the persisted
    // cache (clear() only empties memory — the snapshot on disk is rewritten on
    // a throttle, so a quick kill could still restore it).
    useEngagementStore.getState().reset();
    useFollowStore.getState().reset();
    useBookmarkStore.getState().reset();
    useHiddenStore.getState().reset();
    await persister.removeClient();
  };
}
