import { api } from './client';
import type {
  ApiEnvelope,
  EarningsOverview,
  MonthlyAnalytics,
  YearlyAnalytics,
} from './types';

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

/**
 * GET /earnings/overview — reach in the last 24h plus this month's earnings,
 * each with the backend's own display copy.
 *
 * The Postman entry shows a `{post_id}` request body; that is an artefact of
 * the collection (same as /user/me). Verified live 2026-08-27: it is a plain
 * authenticated GET with no body and reports the whole account, not one post.
 */
export async function fetchEarningsOverview(): Promise<EarningsOverview> {
  const { data } = await api.get<ApiEnvelope<EarningsOverview>>('/earnings/overview');
  return data.data;
}
