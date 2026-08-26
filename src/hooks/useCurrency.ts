import { useMe } from './useMe';

/**
 * Money formatting driven by the account's wallet currency.
 *
 * `/user/me` returns `baseCurrency` ("USD", "NGN", …) — undocumented in the
 * Postman collection but live. Before this the app printed ₦ everywhere, which
 * is simply wrong for a USD account: the earnings endpoints return a number in
 * the user's own currency, not naira.
 *
 * Falls back to NGN while `/user/me` is still loading, since that's the
 * majority currency and the value swaps in as soon as the query lands.
 */

const SYMBOLS: Record<string, string> = {
  NGN: '₦',
  USD: '$',
  GBP: '£',
  // The backend's currency list has a typo — "GPB" — so map it too rather than
  // print a raw code at people. Remove once the list is corrected.
  GPB: '£',
  EUR: '€',
  GHS: 'GH₵',
  KES: 'KSh',
};

export function symbolFor(code: string | undefined): string {
  if (!code) return SYMBOLS.NGN;
  return SYMBOLS[code.toUpperCase()] ?? `${code.toUpperCase()} `;
}

/**
 * Normalize whatever the API called a "symbol". `currencySymbol` on posts and
 * `summary.currencySymbol` on analytics are **not** reliably symbols: a USD
 * account gets "$", but an NGN one gets the literal string "NGN". Anything that
 * looks like a currency *code* is mapped to its glyph; a real symbol passes
 * through untouched.
 */
export function resolveSymbol(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  return /^[A-Za-z]{3}$/.test(raw) ? symbolFor(raw) : raw;
}

/**
 * How many decimals to show. Per-post earnings are genuinely tiny — a real
 * `estimatedEarnings` came back as 0.0008 — and two decimals would render that
 * as "$0", which reads as "this earned nothing". Small amounts widen out far
 * enough to show they're non-zero; ordinary amounts stay at two.
 */
function decimalsFor(amount: number): number {
  const value = Math.abs(amount);
  if (value === 0 || value >= 0.01) return 2;
  if (value >= 0.001) return 3;
  return 4;
}

/**
 * Format an amount with an explicit symbol. Exported so callers that were
 * handed a symbol by the API (a post's `currencySymbol`, an analytics
 * `summary.currencySymbol`) can print it in *that* currency rather than the
 * account default — the two agree today, but money should never be relabelled
 * by the client.
 */
export function formatMoney(amount: number, symbol: string): string {
  const digits = decimalsFor(amount);
  return `${symbol}${amount.toLocaleString(undefined, { maximumFractionDigits: digits })}`;
}

export function useCurrency() {
  const { data: me } = useMe();
  const code = me?.baseCurrency ?? 'NGN';
  const symbol = symbolFor(code);

  /**
   * `format(1234.5)` → "$1,234.5"; `format(0.0008)` → "$0.0008".
   * `overrideSymbol` takes whatever the API sent, code or glyph.
   */
  const format = (amount: number, overrideSymbol?: string) =>
    formatMoney(amount, resolveSymbol(overrideSymbol) ?? symbol);

  return { code, symbol, format };
}
