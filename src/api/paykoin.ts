import { api } from './client';
import { timeAgo } from './timeline';
import type {
  ApiEnvelope,
  ApiGiftArtifact,
  ApiPayKoinBalance,
  ApiPayKoinTopUp,
  ApiPayKoinTopUpStatus,
  ApiPayKoinTransaction,
  Paginated,
} from './types';

/**
 * PayKoin — the in-app coin used to gift creators.
 *
 * Two balances, and the difference matters: `paykoin_spendable` is what you
 * bought and can spend, `paykoin_earned` is what you were *gifted* — and
 * `POST /paykoin/convert` will only cash out the second ("You can only convert
 * PayKoin earned from gifts", verified live). Presenting them as one number
 * would make the convert button look broken.
 *
 * Prices are quoted in coins; `rates` converts them to the wallet currency —
 * `list` when buying (0.1 → $0.10 a coin), `convert` when cashing out (0.075),
 * and the spread between the two is the platform's cut.
 */

/** `GET /paykoin/balance`. */
export async function fetchPayKoinBalance(): Promise<ApiPayKoinBalance> {
  const { data } = await api.get<ApiEnvelope<ApiPayKoinBalance>>('/paykoin/balance');
  return data.data;
}

/**
 * `POST /paykoin/topup` — **POST, despite the collection listing it as a GET
 * against `/paykoin/balance`** (that entry is a copy-paste error; a GET answers
 * 405 "Supported methods: POST").
 *
 * `amount` is in **coins**, not fiat: 100 coins costs 100 × `rates.list`. The
 * server's own rejection below the minimum says "Minimum top-up is 100 USD",
 * which is a backend copy bug — the figure is coins and the currency name is
 * interpolated wrongly. The screen says "coins" and shows the fiat cost beside
 * it rather than repeating the server's wording.
 *
 * **Returns only `checkout_url` — no reference.** So unlike a level upgrade,
 * the app has no handle to confirm the payment with afterwards
 * (`/paykoin/topup/status?reference=` rejects the Korapay reference embedded in
 * the checkout URL with "Invalid PayKoin payment reference"). Until the backend
 * returns its own reference, the sheet closes on the provider's redirect and the
 * balance is simply refetched — see `usePayKoinTopUp`.
 */
export async function startPayKoinTopUp(amount: number): Promise<ApiPayKoinTopUp> {
  const { data } = await api.post<ApiEnvelope<ApiPayKoinTopUp>>('/paykoin/topup', { amount });
  return data.data;
}

/**
 * `GET /paykoin/topup/status?reference=` — the backend's own reference, which
 * `startPayKoinTopUp` does not currently hand back. Kept wired up so the flow
 * completes itself the day it does.
 */
export async function fetchPayKoinTopUpStatus(
  reference: string,
): Promise<ApiPayKoinTopUpStatus> {
  const { data } = await api.get<ApiEnvelope<ApiPayKoinTopUpStatus>>(
    '/paykoin/topup/status',
    { params: { reference } },
  );
  return data.data;
}

/**
 * `POST /paykoin/convert` — cash gifted coins out to the fiat wallet. Rejects
 * 422 "You can only convert PayKoin earned from gifts" when the caller has no
 * `paykoin_earned`, so the screen disables the action at zero rather than
 * offering a button that always fails.
 */
export async function convertPayKoin(amount: number): Promise<unknown> {
  const { data } = await api.post<ApiEnvelope<unknown>>('/paykoin/convert', { amount });
  return data.data;
}

/** `GET /paykoin/transactions` — Laravel paginator of coin movements. */
export async function fetchPayKoinTransactions(
  page: number,
): Promise<Paginated<ApiPayKoinTransaction>> {
  const { data } = await api.get<ApiEnvelope<Paginated<ApiPayKoinTransaction>>>(
    '/paykoin/transactions',
    { params: { page } },
  );
  return data.data;
}

/**
 * `GET /gifts` — the gift catalog, priced in PayKoin.
 *
 * **Undocumented**: it is in neither the Postman collection nor the PayKoin
 * folder, and was found by probing. It answers 200 with a full catalog
 * (`{gifts:[{id, name, emoji, price, tier}]}`), which is what makes the coin
 * balance mean anything on screen.
 *
 * Its companion `POST /gifts/send` ({artifact_id, post_id}) also exists but
 * **404s "Post or creator not found" for every post on staging** — own posts,
 * other users' posts, posts that demonstrably exist — so sending is not wired
 * into the feed. See the gaps list in AGENTS.md.
 */
export async function fetchGiftCatalog(): Promise<ApiGiftArtifact[]> {
  const { data } = await api.get<ApiEnvelope<{ gifts: ApiGiftArtifact[] }>>('/gifts');
  return data.data?.gifts ?? [];
}

// ---------------------------------------------------------------------------
// API → view model
// ---------------------------------------------------------------------------

export type PayKoinTransaction = {
  id: string;
  /** Backend's own label where it sends one, else the type, else "Movement". */
  title: string;
  type: string;
  status: string | null;
  /** Signed coin delta — negative for spends. */
  coins: number | null;
  /** Fiat amount, when the row carries one (top-ups and conversions). */
  amount: number | null;
  currency: string | null;
  timeAgo: string;
  createdAt: string | null;
};

/** Types that move coins *out* of the balance, so the row reads as a debit. */
const DEBIT_TYPES = ['gift_sent', 'gift', 'spend', 'convert', 'conversion', 'withdrawal'];

function num(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

/**
 * One transaction row. The list is empty on staging, so — like the blog and
 * notification mappers — this reads a few aliases per field and signs the coin
 * delta itself when the backend sends an unsigned magnitude.
 */
export function toPayKoinTransaction(
  raw: ApiPayKoinTransaction,
  index: number,
): PayKoinTransaction {
  const type = raw.type ?? 'movement';
  const coins = num(raw.paykoin) ?? num(raw.coins);
  const isDebit = DEBIT_TYPES.includes(type.toLowerCase());
  return {
    id: raw.id ?? raw.reference ?? `paykoin-${index}`,
    title: raw.description ?? raw.narration ?? humanize(type),
    type,
    status: raw.status ?? null,
    coins: coins == null ? null : isDebit ? -Math.abs(coins) : coins,
    amount: num(raw.amount),
    currency: raw.currency ?? null,
    timeAgo: raw.created_at ? timeAgo(raw.created_at) : '',
    createdAt: raw.created_at ?? null,
  };
}

/** `gift_sent` → "Gift sent". */
function humanize(value: string): string {
  const spaced = value.replace(/[_-]+/g, ' ').trim();
  return spaced ? spaced[0].toUpperCase() + spaced.slice(1) : 'Movement';
}
