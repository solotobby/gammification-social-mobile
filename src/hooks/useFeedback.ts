import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import {
  FALLBACK_FEEDBACK_TYPES,
  fetchFeedbackTicket,
  fetchFeedbackTickets,
  fetchFeedbackTypes,
  replyToFeedback,
  submitFeedback,
  type FeedbackPayload,
  type FeedbackTicketDetail,
} from '../api/feedback';
import { useAuthStore } from '../stores/authStore';
import { useFeedbackStore } from '../stores/feedbackStore';

/**
 * Support tickets — see src/api/feedback.ts for the endpoints. (Not to be
 * confused with `feedbackStore`, which is the app's toast/error-modal host.)
 */

const TICKETS_KEY = ['feedback-tickets'] as const;
const ticketKey = (id: string) => ['feedback-ticket', id] as const;

/** An open ticket re-reads this often while on screen, so a staff reply turns up. */
const TICKET_POLL_MS = 30_000;

/** `GET /feedback/types`. Falls back to the known five while loading or offline. */
export function useFeedbackTypes() {
  const token = useAuthStore((s) => s.token);
  const query = useQuery({
    queryKey: ['feedback-types'],
    queryFn: fetchFeedbackTypes,
    enabled: !!token,
    staleTime: 60 * 60_000,
  });
  return query.data?.types ?? FALLBACK_FEEDBACK_TYPES;
}

/** `GET /feedback` — your tickets, paged. */
export function useFeedbackTickets() {
  const token = useAuthStore((s) => s.token);
  return useInfiniteQuery({
    queryKey: TICKETS_KEY,
    queryFn: ({ pageParam }) => fetchFeedbackTickets(pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.next_page_url ? last.current_page + 1 : undefined),
    enabled: !!token,
    staleTime: 15_000,
  });
}

/** `GET /feedback/{id}`. Pass `live` while it's on screen to pick up staff replies. */
export function useFeedbackTicket(id: string | undefined, { live = false }: { live?: boolean } = {}) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ticketKey(id ?? ''),
    queryFn: () => fetchFeedbackTicket(id!),
    enabled: !!token && !!id,
    refetchInterval: live ? TICKET_POLL_MS : false,
  });
}

/**
 * `POST /feedback`. The response is the whole new ticket, so it seeds the
 * ticket screen's cache — opening it straight after sending costs no spinner.
 * Validation errors are left to the form, which shows them on their fields.
 */
export function useSubmitFeedback() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: FeedbackPayload) => submitFeedback(payload),
    onSuccess: (ticket) => {
      queryClient.setQueryData(ticketKey(ticket.id), ticket);
      void queryClient.invalidateQueries({ queryKey: TICKETS_KEY });
    },
  });
}

/** `POST /feedback/{id}/messages` — the reply is appended in place, then the list refreshes. */
export function useReplyToFeedback(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => replyToFeedback(id, body),
    onSuccess: ({ message, feedback }) => {
      queryClient.setQueryData<FeedbackTicketDetail>(ticketKey(id), (old) =>
        old
          ? {
              ...old,
              ...feedback,
              messages: old.messages.some((m) => m.id === message.id)
                ? old.messages
                : [...old.messages, message],
            }
          : old,
      );
      void queryClient.invalidateQueries({ queryKey: TICKETS_KEY });
    },
    onError: (error) =>
      useFeedbackStore.getState().showApiError(error, 'Couldn’t send your reply.'),
  });
}
