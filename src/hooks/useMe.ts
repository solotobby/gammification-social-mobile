import { useQuery } from '@tanstack/react-query';

import { fetchMe } from '../api/auth';
import { tintFor } from '../api/timeline';
import type { MemberTint } from '../data/community';
import { useAuthStore } from '../stores/authStore';

/**
 * The signed-in user's profile (GET /user/me) — name, username, referral code,
 * onboarding state, and level. Login/verify seed this cache, so it usually
 * renders instantly.
 */
export function useMe() {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ['me'],
    queryFn: () => fetchMe(),
    enabled: !!token,
  });
}

/** Public base for a share link; the code is appended as a path segment. */
export const REFERRAL_BASE_URL = 'https://payhankey.com/join';

/**
 * The signed-in user's referral code and share link, from /user/me. Every
 * surface that offers the user their code reads it here — a hardcoded one
 * credits nobody, and referrals pay out, so a wrong code costs real money.
 * Both are undefined until /user/me resolves; callers show a placeholder.
 */
export function useMyReferral(): { code?: string; link?: string } {
  const { data: me } = useMe();
  const code = me?.user.referral_code;
  return { code, link: code ? `${REFERRAL_BASE_URL}/${code}` : undefined };
}

/**
 * The current user's avatar tint, derived from their id via {@link tintFor} —
 * the same function that colors their posts and comments — so the avatar looks
 * identical on the header, story rail, profile, feed cards, and comment threads
 * instead of the header/story defaulting to a fixed violet.
 */
export function useMyTint(): MemberTint {
  const userId = useAuthStore((s) => s.user?.id);
  return tintFor(userId ?? 'me');
}
