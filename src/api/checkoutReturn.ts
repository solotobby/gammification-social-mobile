/**
 * Reading the payment provider's return redirect.
 *
 * Pure URL logic, deliberately free of imports: this is the one piece of the
 * checkout flow whose rules were inferred rather than documented, so it is kept
 * where it can be read — and tested — on its own.
 */

/**
 * Hosts the provider is allowed to hand the user back on.
 *
 * `localhost` is not a mistake to route around — it is what the backend
 * currently builds its return URL from (the same `APP_URL` that makes
 * `share_url` read `http://localhost/c/<slug>`), so it is the redirect the app
 * actually sees today. The real origins are listed alongside it so the moment
 * that config is fixed the flow keeps working without another release.
 */
const RETURN_HOSTS = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  'payhankey.com',
  'www.payhankey.com',
  'app.payhankey.com',
];

/** Words a return URL uses to say the charge cleared. */
const SUCCESS_HINTS = ['success', 'successful', 'completed', 'approved', 'paid'];

/** Words it uses to say it didn't. */
const FAILED_HINTS = ['fail', 'cancel', 'declin', 'abandon', 'error', 'reject'];

/** The host part of a URL, lowercased, without credentials or port. */
function hostOf(url: string): string {
  const match = /^[a-zA-Z][\w+.-]*:\/\/([^/?#]+)/.exec(url.trim());
  if (!match) return '';
  const authority = match[1];
  return (authority.split('@').pop() ?? '').split(':')[0].toLowerCase();
}

/** Everything after the host — path, query and fragment — lowercased. */
function tailOf(url: string): string {
  const match = /^[a-zA-Z][\w+.-]*:\/\/[^/?#]+(.*)$/.exec(url.trim());
  return (match ? match[1] : '').toLowerCase();
}

/**
 * What a navigation inside the payment sheet means.
 *
 * `outcome` is the *provider's* claim, read off the return URL, and is never
 * treated as the last word — the backend is asked to confirm either way. It
 * exists because the ledger can lag (or, right now, never move at all), and
 * "Korapay says this went through" is a materially different thing to tell
 * someone than "we can't see it".
 */
export type CheckoutReturn = {
  /** True once the provider has handed control back to us. */
  isReturn: boolean;
  outcome: 'success' | 'failed' | 'unknown';
};

/**
 * Classify one navigation the payment WebView is about to make.
 *
 * The user stays on the provider's own domains for the whole payment — card
 * form, 3-D Secure, bank redirects — so the only thing that marks the end is a
 * navigation *back* to one of our own hosts. Anything else is left to load.
 *
 * The status wording is read out of the path and query rather than one named
 * parameter: the backend's return URL is undocumented, and the provider appends
 * its own keys (`reference`, `status`, …) on top of whatever the merchant set.
 * Matching on the whole tail means a `?status=success`, a `/payment/success`
 * and a `?state=successful` all read the same, and anything unrecognised falls
 * through to `unknown`, which asks the server instead of guessing.
 */
export function readCheckoutReturn(url: string): CheckoutReturn {
  const host = hostOf(url);
  if (!RETURN_HOSTS.includes(host)) return { isReturn: false, outcome: 'unknown' };

  const tail = tailOf(url);
  // Failure is checked first: "payment-failed" contains neither success word,
  // but a URL carrying both should never be read as a completed charge.
  if (FAILED_HINTS.some((hint) => tail.includes(hint))) {
    return { isReturn: true, outcome: 'failed' };
  }
  if (SUCCESS_HINTS.some((hint) => tail.includes(hint))) {
    return { isReturn: true, outcome: 'success' };
  }
  return { isReturn: true, outcome: 'unknown' };
}

