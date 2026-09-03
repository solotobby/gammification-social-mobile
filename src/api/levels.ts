import { api } from './client';
import type {
  ApiEnvelope,
  ApiLevel,
  ApiLevelCheckout,
  ApiLevelsData,
  TransactionsResponse,
} from './types';

export type { ApiLevel, ApiLevelCheckout, ApiLevelsData } from './types';
export { readCheckoutReturn, type CheckoutReturn } from './checkoutReturn';

/**
 * Subscription levels — `GET /user/levels` and
 * `POST /user/levels/{id}/checkout` (both live 2026-09-03).
 *
 * The backend owns everything the `/upgrade` screen shows: prices, the currency
 * to print them in, the feature copy, the per-level media limits, and whether a
 * level can be paid for at all. Nothing here is re-derived on the client — the
 * screen previously hardcoded ₦ prices and a 10% subscription discount, both of
 * which are wrong for a USD account (and the discount is currently 0).
 */

/** `GET /user/levels` — every level, plus where the viewer currently sits. */
export async function fetchLevels(): Promise<ApiLevelsData> {
  const { data } = await api.get<ApiEnvelope<ApiLevelsData>>('/user/levels');
  return data.data;
}

/**
 * `POST /user/levels/{levelId}/checkout` — opens a payment session and returns
 * a **hosted** `checkout_url` (Flutterwave) for the app to send the user to.
 *
 * This only *initialises* the session: no money moves until the user completes
 * the hosted page, and nothing about the account changes here. The level is
 * therefore never updated optimistically — `/user/levels` and `/user/me` are
 * refetched when the user comes back, and the tier only changes if the backend
 * says it did.
 *
 * `billing_mode` is validated (`subscription` | `payg` where the account
 * supports both) and **changes the amount**: on an NGN account Creator bills
 * ₦1,512 as a subscription and ₦1,680 as pay-as-you-go. Omitted, the backend
 * uses the account's `billing.default_mode`.
 *
 * `payment.checkout_path` on the level carries the same route as an absolute
 * `/v1/...` path; it's deliberately ignored in favour of building the URL from
 * the axios base, so the client can't end up posting to a different host than
 * every other call.
 */
export async function startLevelCheckout(
  levelId: string,
  billingMode?: string,
): Promise<ApiLevelCheckout> {
  const { data } = await api.post<ApiEnvelope<ApiLevelCheckout>>(
    `/user/levels/${levelId}/checkout`,
    billingMode ? { billing_mode: billingMode } : undefined,
  );
  return data.data;
}

/**
 * Ordering for display: cheapest first, matching the web's plan table and the
 * order the backend already returns them in. Sorted defensively rather than
 * trusting array order, since `rank` is the field that carries the meaning.
 */
export function sortLevels(levels: ApiLevel[]): ApiLevel[] {
  return [...levels].sort((a, b) => a.rank - b.rank);
}

// ---------------------------------------------------------------------------
// Confirming a payment
// ---------------------------------------------------------------------------

/**
 * Where one checkout stands, as far as the backend is concerned.
 *
 * `pending` covers "not settled yet" *and* "we can't see it" — an unknown
 * status word, a reference the ledger hasn't listed yet, a failed read. Only a
 * word the backend clearly means as terminal moves off it, because the cost of
 * guessing wrong on money is telling someone they paid when they didn't.
 */
export type LevelPaymentStatus = 'pending' | 'success' | 'failed';

/** Status words that mean the money arrived. */
const SUCCESS_STATUSES = ['success', 'successful', 'completed', 'complete', 'paid', 'approved'];

/** Status words that mean it definitively won't. */
const FAILED_STATUSES = [
  'failed',
  'failure',
  'cancelled',
  'canceled',
  'declined',
  'abandoned',
  'expired',
  'reversed',
];

/**
 * Read the state of one checkout out of `GET /user/transactions`.
 *
 * **There is no verify endpoint.** `/user/levels/checkout/{ref}`,
 * `…/verify` and `/payment(s)/verify/{ref}` all 404 (probed 2026-09-03), and
 * the provider's hosted page redirects to the *web* app rather than back into
 * anything the phone can see. What does exist is the ledger: the checkout call
 * writes a row there immediately (`type: "subscription_upgrade"`, `status:
 * "initiated"`), keyed by the same `reference` the checkout response returned,
 * and the provider's webhook is what moves that status. So the reference is the
 * handle on a payment, and this is the poll behind it.
 *
 * The `reference` query param is **ignored** by the endpoint — it answers with
 * the whole (paginated) list either way — so the row is matched client-side.
 * Only the first page is read: the row was created seconds ago and the list is
 * newest-first, so it cannot be anywhere else.
 */
export async function fetchCheckoutStatus(reference: string): Promise<LevelPaymentStatus> {
  const { data } = await api.get<TransactionsResponse>('/user/transactions');
  const row = (data.data?.data ?? []).find((tx) => (tx.ref ?? tx.reference) === reference);
  const status = (row?.status ?? '').toLowerCase();

  if (SUCCESS_STATUSES.includes(status)) return 'success';
  if (FAILED_STATUSES.includes(status)) return 'failed';
  return 'pending';
}

/**
 * Ask the backend where a checkout ended up, by both routes it can answer on:
 * the ledger row under the checkout `reference`, and the account's own level.
 *
 * The level is checked because it is the thing the user is buying — if
 * `current_level` is already the level they just paid for, the upgrade landed,
 * whatever the ledger row says.
 */
export async function fetchCheckoutOutcome(
  reference: string,
  levelName?: string,
): Promise<LevelPaymentStatus> {
  const status = await fetchCheckoutStatus(reference).catch(() => 'pending' as const);
  if (status !== 'pending') return status;

  if (levelName) {
    const levels = await fetchLevels().catch(() => null);
    if (levels?.current_level?.toLowerCase() === levelName.toLowerCase()) return 'success';
  }
  return 'pending';
}
