import { api } from './client';
import type { ApiEnvelope, MonthlyAnalytics, YearlyAnalytics } from './types';

/** GET /earnings/analytics/monthly?year=&month= — one month's engagement + earning. */
export async function fetchMonthlyAnalytics(
  year: number,
  month: number,
): Promise<MonthlyAnalytics> {
  const { data } = await api.get<ApiEnvelope<MonthlyAnalytics>>(
    '/earnings/analytics/monthly',
    { params: { year, month } },
  );
  return data.data;
}

/** GET /earnings/analytics/yearly?year= — yearly totals plus each month's breakdown. */
export async function fetchYearlyAnalytics(year: number): Promise<YearlyAnalytics> {
  const { data } = await api.get<ApiEnvelope<YearlyAnalytics>>(
    '/earnings/analytics/yearly',
    { params: { year } },
  );
  return data.data;
}
