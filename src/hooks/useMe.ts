import { useQuery } from '@tanstack/react-query';

import { fetchMe } from '../api/auth';
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
