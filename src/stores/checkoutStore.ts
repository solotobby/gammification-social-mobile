import { create } from 'zustand';

/** One payment in flight: what the sheet needs to show it and confirm it. */
export type CheckoutSession = {
  /** The provider's hosted page. */
  url: string;
  /** The backend's own reference, used to confirm the outcome afterwards. */
  reference: string;
  /** Level being bought — shown in the sheet header and in the result toast. */
  levelName: string;
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
