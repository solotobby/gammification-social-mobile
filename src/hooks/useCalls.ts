import { useInfiniteQuery } from '@tanstack/react-query';

import { fetchCallHistory, type ApiCall } from '../api/calls';
import { useAuthStore } from '../stores/authStore';

export const CALLS_KEY = ['calls'] as const;

/**
 * `GET /calls` — your calls, newest first, 20 a page. Persisted (see
 * src/api/queryClient.ts), so the list opens offline. The call engine
 * invalidates it whenever a call ends, so a call you just finished is at the
 * top when you look.
 */
export function useCallHistory() {
  const token = useAuthStore((s) => s.token);
  return useInfiniteQuery({
    queryKey: CALLS_KEY,
    queryFn: ({ pageParam }) => fetchCallHistory(pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.lastPage ? last.page + 1 : undefined),
    enabled: !!token,
    staleTime: 15_000,
  });
}

export type CallOutcome = {
  /** We were rung, rather than doing the ringing. */
  incoming: boolean;
  /** A call that rang us and we never picked up — drawn in red. */
  missed: boolean;
  /** "1:06", "Missed", "No answer", "Declined"… */
  label: string;
};

/**
 * What a call row says, from *your* side of it. The server's `status` is
 * neutral — one `cancelled` row is "Missed" to the person it rang and
 * "Cancelled" to the person who gave up — so this reads it against who you are.
 *
 * Statuses seen live (2026-10-14): `completed` (with `duration` in seconds and
 * `end_reason`), `rejected` (`user_declined`), `cancelled` (`caller_hung_up` /
 * `no_answer`), `busy`. `ringing` and `ongoing` are documented. Since
 * 2026-10-16 the server also ends an unanswered call itself after 60s as
 * `missed` (`timeout`), and logs one that was answered but never connected as
 * `failed` (`connection_failed`) rather than `completed`.
 */
export function callOutcome(call: ApiCall, me: string | undefined): CallOutcome {
  const incoming = call.receiver_id === me;
  switch (call.status) {
    case 'completed':
      if (call.end_reason === 'connection_failed') {
        return { incoming, missed: false, label: 'Couldn’t connect' };
      }
      return { incoming, missed: false, label: duration(call.duration ?? 0) };
    case 'failed':
      return { incoming, missed: false, label: 'Couldn’t connect' };
    case 'rejected':
      return { incoming, missed: false, label: 'Declined' };
    case 'busy':
      return incoming
        ? { incoming, missed: true, label: 'Missed' }
        : { incoming, missed: false, label: 'Busy' };
    case 'cancelled':
    case 'missed':
      if (incoming) return { incoming, missed: true, label: 'Missed' };
      return {
        incoming,
        missed: false,
        label: call.status === 'missed' || call.end_reason === 'no_answer' ? 'No answer' : 'Cancelled',
      };
    case 'ringing':
      return { incoming, missed: false, label: 'Ringing' };
    case 'ongoing':
      return { incoming, missed: false, label: 'In progress' };
    default:
      return { incoming, missed: false, label: '' };
  }
}

/** "0:42", "12:05", "1:02:09". */
function duration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}
