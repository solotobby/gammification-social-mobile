import { useMutation, useQuery } from '@tanstack/react-query';

import { fetchLevels, startLevelCheckout } from '../api/levels';
import { useAuthStore } from '../stores/authStore';
import { useCheckoutStore } from '../stores/checkoutStore';
import { useFeedbackStore } from '../stores/feedbackStore';

/** `GET /user/levels` — the plan table behind `/upgrade`. */
export function useLevels() {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ['levels'],
    queryFn: fetchLevels,
    enabled: !!token,
  });
}

/**
 * Start a level upgrade.
 *
 * This only *initialises* the payment: it asks the backend for a hosted
 * checkout session and hands the resulting URL to `PaymentSheet`, the in-app
 * WebView mounted at the root. Everything after that — watching for the
 * provider's return redirect, closing the sheet, confirming the charge with the
 * backend and reporting the outcome — belongs to the sheet, so a payment
 * survives the user navigating away from the screen that started it.
 *
 * The hosted page is the provider's: Korapay on a naira account, Flutterwave on
 * a dollar one. The app never sees card details either way; it only watches
 * which URL the page ends on.
 *
 * Nothing is updated optimistically here. The mutation is done the moment the
 * sheet opens — the level is refetched, and reported on, from inside the sheet.
 */
export function useLevelCheckout() {
  const openCheckout = useCheckoutStore((s) => s.open);

  return useMutation({
    mutationFn: ({ levelId, billingMode }: { levelId: string; billingMode?: string }) =>
      startLevelCheckout(levelId, billingMode),
    onSuccess: (checkout) => {
      openCheckout({
        kind: 'level',
        url: checkout.checkout_url,
        reference: checkout.reference,
        label: checkout.level.name,
      });
    },
    onError: (error) => {
      useFeedbackStore.getState().showApiError(error, "Couldn't start that upgrade.");
    },
  });
}
