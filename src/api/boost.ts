import { api } from './client';
import { timeAgo } from './timeline';
import type {
  ApiBoostCampaign,
  ApiBoostConfig,
  ApiBoostDetail,
  ApiBoostPackage,
  ApiEnvelope,
  BoostPayload,
  Paginated,
} from './types';

/**
 * Promoting a post ("boost").
 *
 * **Boosts are bought with PayKoin, not money.** The config prices everything
 * twice — in coins (`pk_cost`, what is actually debited) and in the wallet
 * currency (`fiat_cost`, for display only) — and the charge lands in PayKoin
 * activity as a `post_boost` row. So the failure to design around is an empty
 * coin balance, not a missing payment provider: a boost cannot be paid for with
 * a card, only with coins that were topped up beforehand.
 *
 * Pricing is per *guaranteed click*, and `min_clicks` (10 on staging) is the
 * floor — below it the server rejects the setup.
 */

/**
 * `GET /timeline/post/{id}/boost/config` — rates, click bundles, the allowed
 * call-to-action wordings, and the caller's spendable balance, all in one read.
 * Everything the boost screen renders comes from here; nothing is hardcoded,
 * because the rates differ per currency exactly like the level prices do.
 *
 * The Postman entry shows a `{post_id}` request body — an artefact, as with
 * `/user/me`. It is a plain authenticated GET.
 */
export async function fetchBoostConfig(postId: string): Promise<ApiBoostConfig> {
  const { data } = await api.get<ApiEnvelope<ApiBoostConfig>>(
    `/timeline/post/${postId}/boost/config`,
  );
  return data.data;
}

/**
 * `POST /timeline/post/{id}/boost` — buy a campaign.
 *
 * Rejects 422 "Insufficient PayKoin balance. You need N PK but only have M PK."
 * when the coins aren't there; the screen checks the same figures up front so
 * that message is a backstop rather than the primary feedback.
 */
export async function startBoost(
  postId: string,
  payload: BoostPayload,
): Promise<ApiBoostCampaign> {
  const { data } = await api.post<ApiEnvelope<ApiBoostCampaign>>(
    `/timeline/post/${postId}/boost`,
    payload,
  );
  return data.data;
}

/** `GET /boosts` — the caller's campaigns, newest first (Laravel paginator). */
export async function fetchBoosts(page: number): Promise<Paginated<ApiBoostCampaign>> {
  const { data } = await api.get<ApiEnvelope<Paginated<ApiBoostCampaign>>>('/boosts', {
    params: { page },
  });
  return data.data;
}

/**
 * `GET /boosts/{id}` — one campaign plus its click breakdown, wrapped as
 * `{boost, analytics, post}` (see `ApiBoostDetail`). 404s "Boost campaign not
 * found".
 */
export async function fetchBoost(boostId: string): Promise<ApiBoostDetail> {
  const { data } = await api.get<ApiEnvelope<ApiBoostDetail>>(`/boosts/${boostId}`);
  return data.data;
}

/** `POST /boosts/{id}/pause` — stop serving without refunding. */
export async function pauseBoost(boostId: string): Promise<ApiBoostCampaign> {
  const { data } = await api.post<ApiEnvelope<ApiBoostCampaign>>(`/boosts/${boostId}/pause`);
  return data.data;
}

/** `POST /boosts/{id}/resume`. */
export async function resumeBoost(boostId: string): Promise<ApiBoostCampaign> {
  const { data } = await api.post<ApiEnvelope<ApiBoostCampaign>>(`/boosts/${boostId}/resume`);
  return data.data;
}

// ---------------------------------------------------------------------------
// API → view model
// ---------------------------------------------------------------------------

/** The config, with the two spellings of each field collapsed to one. */
export type BoostConfig = {
  enabled: boolean;
  /** Coins per guaranteed click. */
  ratePerClick: number;
  /**
   * The config's own `fiat_per_pk`. **Do not price anything with this.**
   *
   * It is hard-coded to the naira rate (10) whatever the account's currency —
   * verified live 2026-09-16: a USD account gets `currency: "USD"` alongside
   * `fiat_per_pk: 10`, while `/paykoin/balance` reports the real USD rate as
   * `rates.list: 0.1`. So the config overstates a dollar price by 100×, and its
   * `packages[].fiat_cost` is wrong by the same factor (150 coins quoted as
   * $1,500 rather than $15.00). On naira the two agree, which is what gives the
   * bug away.
   *
   * The screen therefore converts with the PayKoin top-up rate — the price the
   * coins were actually bought at — and ignores both of these fields. Kept here
   * so the discrepancy is visible rather than silently dropped; delete once the
   * backend makes the config currency-aware.
   */
  fiatPerCoin: number;
  minClicks: number;
  /** The caller's spendable coins. */
  spendable: number;
  currency: string;
  ctaOptions: string[];
  packages: ApiBoostPackage[];
  postIsBoosted: boolean;
  /** The post being promoted, for the hero and the live ad preview. */
  post: ApiBoostConfig['post'];
};

export function toBoostConfig(raw: ApiBoostConfig): BoostConfig {
  // Both spellings ship for three fields; treat either as authoritative and
  // only fall back to a default when neither came back.
  const ratePerClick = raw.rate_pk_per_click ?? raw.rate_per_click_paykoin ?? 0;
  const spendable = raw.user_spendable_pk ?? raw.user_spendable_paykoin ?? 0;
  return {
    // Off if *either* flag says off — a single false is a deliberate kill switch.
    enabled: (raw.boost_enabled ?? true) && (raw.is_boost_enabled ?? true),
    ratePerClick,
    fiatPerCoin: raw.fiat_per_pk ?? 0,
    minClicks: raw.min_clicks ?? 10,
    spendable,
    currency: raw.currency ?? '',
    ctaOptions: raw.cta_options ?? [],
    packages: raw.packages ?? [],
    postIsBoosted: !!raw.post?.is_boosted,
    post: raw.post,
  };
}

export type BoostCampaign = {
  id: string;
  postId?: string;
  status: string;
  /** Lowercased status, for the one place that branches on it. */
  isPaused: boolean;
  /** Every bought click has been served — nothing left to pause or resume. */
  isComplete: boolean;
  cta: string | null;
  targetUrl: string | null;
  clicksBought: number;
  clicksDelivered: number;
  clicksRemaining: number;
  /** 0–1, clamped — the progress bar's width. */
  progress: number;
  impressions: number | null;
  coinCost: number | null;
  /** Coins per click. The list sends it; the detail doesn't, so it's derived. */
  coinsPerClick: number | null;
  /** Where the ad may be served. */
  onPayhankey: boolean;
  onPartners: boolean;
  reference: string | null;
  createdAt: string | null;
  timeAgo: string;
  /** The promoted post's text, when the campaign embeds it. */
  postBody?: string;
};

function firstNumber(...values: (number | undefined)[]): number {
  for (const value of values) if (typeof value === 'number') return value;
  return 0;
}

export function toBoostCampaign(raw: ApiBoostCampaign): BoostCampaign {
  const clicksBought = firstNumber(raw.total_clicks, raw.clicks_purchased, raw.clicks);
  const clicksDelivered = firstNumber(raw.delivered_clicks, raw.clicks_delivered, raw.clicks_used);
  const clicksRemaining =
    typeof raw.remaining_clicks === 'number'
      ? raw.remaining_clicks
      : Math.max(0, clicksBought - clicksDelivered);
  const coinCost = typeof raw.pk_cost === 'number' ? raw.pk_cost : null;
  const status = (raw.status ?? 'active').toLowerCase();
  return {
    id: raw.id,
    postId: raw.post_id ?? raw.post?.id,
    status,
    isPaused: status === 'paused',
    isComplete: status === 'completed' || (clicksBought > 0 && clicksRemaining === 0),
    cta: raw.cta ?? null,
    targetUrl: raw.target_url ?? null,
    clicksBought,
    clicksDelivered,
    clicksRemaining,
    progress: clicksBought > 0 ? Math.min(1, clicksDelivered / clicksBought) : 0,
    impressions: typeof raw.impressions === 'number' ? raw.impressions : null,
    coinCost,
    coinsPerClick:
      typeof raw.rate_pk === 'number'
        ? raw.rate_pk
        : coinCost != null && clicksBought > 0
          ? coinCost / clicksBought
          : null,
    // Absent means the older campaign shape, which only ever ran in-feed.
    onPayhankey: raw.platform_payhankey ?? true,
    onPartners: raw.platform_partner ?? false,
    reference: raw.ref ?? null,
    createdAt: raw.created_at ?? null,
    timeAgo: raw.created_at ? timeAgo(raw.created_at) : '',
    postBody: raw.post?.content ?? undefined,
  };
}

/** One bar in a click breakdown. */
export type BoostBreakdownRow = { label: string; clicks: number; share: number };

/**
 * A `by_device` / `by_browser` / `by_platform` map into sorted rows. An empty
 * breakdown comes back as `[]` — a PHP empty array — so anything that isn't a
 * plain object is treated as no clicks.
 */
function toBreakdown(
  raw: Record<string, number> | unknown[] | undefined,
  total: number,
): BoostBreakdownRow[] {
  if (!raw || Array.isArray(raw)) return [];
  return Object.entries(raw)
    .filter(([, clicks]) => typeof clicks === 'number')
    .map(([label, clicks]) => ({ label, clicks, share: total > 0 ? clicks / total : 0 }))
    .sort((a, b) => b.clicks - a.clicks);
}

export type BoostDetail = {
  campaign: BoostCampaign;
  /** Clicks the tracker actually recorded — the denominator for every share. */
  clicksRecorded: number;
  byDevice: BoostBreakdownRow[];
  byBrowser: BoostBreakdownRow[];
  byNetwork: BoostBreakdownRow[];
};

export function toBoostDetail(raw: ApiBoostDetail): BoostDetail {
  const campaign = toBoostCampaign({ ...raw.boost, post: raw.boost.post ?? raw.post });
  const analytics = raw.analytics ?? {};
  const clicksRecorded = analytics.total_clicks_recorded ?? campaign.clicksDelivered;
  return {
    campaign,
    clicksRecorded,
    byDevice: toBreakdown(analytics.by_device, clicksRecorded),
    byBrowser: toBreakdown(analytics.by_browser, clicksRecorded),
    byNetwork: toBreakdown(analytics.by_platform, clicksRecorded),
  };
}
