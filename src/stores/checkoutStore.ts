import { create } from 'zustand';

/**
 * What is being paid for. The sheet is identical for all three — the provider's
 * hosted page in a WebView — but *confirming* the outcome differs, because each
 * one has a different endpoint that can say whether it landed.
 */
export type CheckoutKind = 'level' | 'paykoin' | 'community';

/** One payment in flight: what the sheet needs to show it and confirm it. */
export type CheckoutSession = {
  kind: CheckoutKind;
  /** The provider's hosted page. */
  url: string;
  /**
   * The backend's own reference, used to confirm the outcome afterwards. Empty
   * when the initialising endpoint doesn't return one — `POST /paykoin/topup`
   * currently sends back a `checkout_url` and nothing else — in which case the
   * sheet skips confirmation and just refetches the affected balances.
   */
  reference: string;
  /** What's being bought — sheet subtitle and result copy. */
  label: string;
  /** For `kind: 'community'`, whose subscription to re-read on the way out. */
  communityId?: string;
};

type CheckoutState = {
  session: CheckoutSession | null;
  open: (session: CheckoutSession) => void;
  close: () => void;
};

/**
 * The payment sheet's state, kept outside the screen that starts it.
 *
 * Checkout is a *global* step, the same way a toast or the error modal is: it
 * has to survive whatever the user was looking at, and it must be impossible to
 * have two of them open. Keeping the in-flight session here means the sheet is
 * mounted once at the root (`PaymentSheet` in `app/_layout.tsx`) rather than by
 * whichever screen happened to sell the upgrade.
 */
export const useCheckoutStore = create<CheckoutState>((set) => ({
  session: null,
  open: (session) => set({ session }),
  close: () => set({ session: null }),
}));
