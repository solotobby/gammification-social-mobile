import { useQuery } from '@tanstack/react-query';

import {
  fetchEarningsOverview,
  fetchMonthlyAnalytics,
  fetchYearlyAnalytics,
} from '../api/earnings';
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

/**
 * GET /earnings/overview — the Home pulse's headline numbers and copy.
 *
 * The response carries `refresh_after` = generated_at + 1h: the server
 * recomputes on that cadence, so polling more often just re-reads the identical
 * payload. Match it rather than burning requests on Home.
 */
export function useEarningsOverview() {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ['earnings-overview'],
    queryFn: fetchEarningsOverview,
    enabled: !!token,
    staleTime: 60 * 60 * 1000,
  });
}
