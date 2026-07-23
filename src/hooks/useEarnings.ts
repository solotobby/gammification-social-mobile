import { useQuery } from '@tanstack/react-query';

import { fetchMonthlyAnalytics, fetchYearlyAnalytics } from '../api/earnings';
import { useAuthStore } from '../stores/authStore';

/** GET /earnings/analytics/yearly?year= — drives the month chips + yearly totals. */
export function useYearlyAnalytics(year: number) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ['earnings-yearly', year],
    queryFn: () => fetchYearlyAnalytics(year),
    enabled: !!token,
  });
}

/** GET /earnings/analytics/monthly?year=&month= — the selected month's detail. */
export function useMonthlyAnalytics(year: number, month: number | undefined) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ['earnings-monthly', year, month],
    queryFn: () => fetchMonthlyAnalytics(year, month!),
    enabled: !!token && month != null,
  });
}
