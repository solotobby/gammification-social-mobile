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

export function useCurrency() {
  const { data: me } = useMe();
  const code = me?.baseCurrency ?? 'NGN';
  const symbol = symbolFor(code);

  /** `format(1234.5)` → "$1,234.5" (or "₦1,234.5"). */
  const format = (amount: number, maximumFractionDigits = 2) =>
    `${symbol}${amount.toLocaleString(undefined, { maximumFractionDigits })}`;

  return { code, symbol, format };
}
