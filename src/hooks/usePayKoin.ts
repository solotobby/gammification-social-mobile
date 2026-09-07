import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  convertPayKoin,
  fetchGiftCatalog,
  fetchPayKoinBalance,
  fetchPayKoinTransactions,
  startPayKoinTopUp,
} from '../api/paykoin';
import { useAuthStore } from '../stores/authStore';
import { useCheckoutStore } from '../stores/checkoutStore';
import { useFeedbackStore } from '../stores/feedbackStore';

/** `GET /paykoin/balance` — spendable, earned, the minimum, and the rates. */
export function usePayKoinBalance() {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ['paykoin', 'balance'],
    queryFn: fetchPayKoinBalance,
    enabled: !!token,
  });
}

/** `GET /paykoin/transactions`, paged. */
export function usePayKoinTransactions() {
  const token = useAuthStore((s) => s.token);
  return useInfiniteQuery({
    queryKey: ['paykoin', 'transactions'],
    queryFn: ({ pageParam }) => fetchPayKoinTransactions(pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.next_page_url ? last.current_page + 1 : undefined),
    enabled: !!token,
  });
}

/**
 * `GET /gifts` — the catalog PayKoin is spent on. Near-static, so it's cached
 * hard; it's read here to show what a balance is actually worth.
 */
export function useGiftCatalog() {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ['gifts'],
    queryFn: fetchGiftCatalog,
    enabled: !!token,
    staleTime: 30 * 60 * 1000,
  });
}

/**
 * `POST /paykoin/topup` — buy coins through the shared hosted checkout.
 *
 * The response carries **no reference**, so the sheet has nothing to confirm
 * the charge with afterwards (see `startPayKoinTopUp`). It therefore closes on
 * the provider's redirect and simply refetches the balance — the coins appear
 * when the webhook lands. That's an honest outcome, not a silent one: the sheet
 * says the payment is still being confirmed rather than claiming success.
 */
export function usePayKoinTopUp() {
  const openCheckout = useCheckoutStore((s) => s.open);

  return useMutation({
    mutationFn: (amount: number) => startPayKoinTopUp(amount),
    onSuccess: (result, amount) => {
      openCheckout({
        kind: 'paykoin',
        url: result.checkout_url,
        reference: result.reference ?? '',
        label: `${amount.toLocaleString()} PayKoin`,
      });
    },
    onError: (error) => {
      useFeedbackStore.getState().showApiError(error, "Couldn't start that top-up.");
    },
  });
}

/**
 * `POST /paykoin/convert` — cash gifted coins out to the fiat wallet.
 *
 * Only `paykoin_earned` can be converted; the server rejects anything else with
 * "You can only convert PayKoin earned from gifts", so the screen disables the
 * action at zero rather than surfacing that as a failure the user caused.
 */
export function useConvertPayKoin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (amount: number) => convertPayKoin(amount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paykoin'] });
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      useFeedbackStore.getState().showToast('Converted to your wallet balance.', 'success');
    },
    onError: (error) => {
      useFeedbackStore.getState().showApiError(error, "Couldn't convert that.");
    },
  });
}
