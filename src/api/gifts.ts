import { api } from './client';
import { timeAgo, tintFor } from './timeline';
import type {
  ApiEnvelope,
  ApiGiftArtifact,
  ApiPostGift,
  ApiPostGiftsData,
  GiftPostType,
  GiftSendPayload,
} from './types';
import type { MemberTint } from '../data/community';

/**
 * Gifting — spending PayKoin on someone else's post.
 *
 * **The `post_type` discriminator is the whole story here.** `POST /gifts/send`
 * answered 404 "Post or creator not found" for every post ever tried, which is
 * why gifting sat unwired; it turned out the call was simply missing
 * `post_type`, and the backend could not tell which table `post_id` pointed
 * into. Verified live 2026-09-16: the identical request with `post_type:
 * "timeline"` reaches the balance check instead. Never send a gift without it.
 */

/** `GET /gifts` — the catalog, priced in coins and grouped into tiers. */
export async function fetchGiftCatalog(): Promise<ApiGiftArtifact[]> {
  const { data } = await api.get<ApiEnvelope<{ gifts: ApiGiftArtifact[] }>>('/gifts');
  return data.data?.gifts ?? [];
}

/**
 * `POST /gifts/send`.
 *
 * Two refusals the UI is expected to pre-empt rather than surface as surprises:
 * 422 "You cannot gift your own post." (so the action is hidden on own posts,
 * exactly like bookmarking) and 422 "Not enough PayKoin to send this gift."
 * (so tiles above the balance are shown disabled with a top-up route out).
 */
export async function sendGift(payload: GiftSendPayload): Promise<unknown> {
  const { data } = await api.post<ApiEnvelope<unknown>>('/gifts/send', payload);
  return data.data;
}

/**
 * `GET /gifts/post/{post_type}/{post_id}` — what a post has received, plus the
 * viewer's own spendable balance, so the sheet opens from a single request.
 */
export async function fetchPostGifts(
  postId: string,
  postType: GiftPostType = 'timeline',
): Promise<ApiPostGiftsData> {
  const { data } = await api.get<ApiEnvelope<ApiPostGiftsData>>(
    `/gifts/post/${postType}/${postId}`,
  );
  return data.data ?? {};
}

// ---------------------------------------------------------------------------
// API → view model
// ---------------------------------------------------------------------------

/** One gift as the feed and the sheet render it. */
export type PostGift = {
  id: string;
  artifactId: string;
  name: string;
  emoji: string;
  price: number | null;
  /** How many of this artifact were sent (rows may be pre-grouped). */
  quantity: number;
  sender?: { id: string; name: string; handle: string; tint: MemberTint };
  timeAgo: string;
};

/**
 * Normalize a gift row. The shape is **inference** beyond `artifact_id` — no
 * post on staging has received one yet, so the sender is read from either
 * `sender` or `user`, and the count from either `quantity` or `count`. Narrow
 * this once real gifts exist.
 */
export function toPostGift(raw: ApiPostGift, index: number): PostGift {
  const sender = raw.sender ?? raw.user ?? null;
  return {
    id: raw.id ?? `${raw.artifact_id ?? 'gift'}-${index}`,
    artifactId: raw.artifact_id ?? raw.id ?? '',
    name: raw.name ?? 'Gift',
    emoji: raw.emoji ?? '🎁',
    price: typeof raw.price === 'number' ? raw.price : null,
    quantity: raw.quantity ?? raw.count ?? 1,
    sender: sender
      ? {
          id: sender.id,
          name: sender.name,
          handle: sender.username,
          tint: tintFor(sender.id),
        }
      : undefined,
    timeAgo: raw.created_at ? timeAgo(raw.created_at) : '',
  };
}

/** Catalog tiers, in the order the sheet groups them. */
export const GIFT_TIERS = ['classic', 'fashion', 'payhankey', 'premium'] as const;

export function tierLabel(tier: string): string {
  if (tier === 'payhankey') return 'Payhankey';
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}
