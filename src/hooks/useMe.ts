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
