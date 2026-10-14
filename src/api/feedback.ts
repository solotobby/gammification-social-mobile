import { api } from './client';
import type { ApiEnvelope, Paginated } from './types';

/**
 * Send feedback — support tickets the Payhankey team answers (the "Send
 * Feddback" folder in Postman, live 2026-10-14). It replaced the placeholder
 * that answered "coming soon".
 *
 * Verified live 2026-10-14 (validation probed with requests that fail, so no
 * test tickets were filed):
 *
 * - `POST /feedback {type, subject, message}` → 201, the whole ticket with its
 *   first message. **subject 4–120 chars, message 10–5000**; `type` must be one
 *   of `GET /feedback/types` (`complaint | suggestion | improvement | bug |
 *   other` — "other" is new, the web form has four).
 * - `GET /feedback` — your tickets, Laravel paginator, 15 a page, with
 *   `messages_count` and who spoke last (`last_message_by: user | staff`).
 * - `GET /feedback/{id}` — the ticket with `messages[]` (oldest first; staff
 *   replies carry `is_staff: true`) and an optional `admin_note`.
 * - `POST /feedback/{id}/messages {body}` — reply, **2–5000 chars**. Answers
 *   `{message, feedback}`. An unknown ticket is 404 "Feedback ticket not found".
 * - Statuses: `new` ("New"), `reviewed` ("In review"), `resolved`, `closed`;
 *   `is_open` says whether the conversation still takes replies.
 */

export const FEEDBACK_SUBJECT_MIN = 4;
export const FEEDBACK_SUBJECT_MAX = 120;
export const FEEDBACK_MESSAGE_MIN = 10;
export const FEEDBACK_MESSAGE_MAX = 5000;
export const FEEDBACK_REPLY_MIN = 2;
export const FEEDBACK_REPLY_MAX = 5000;

export type FeedbackType = 'complaint' | 'suggestion' | 'improvement' | 'bug' | 'other' | (string & {});
export type FeedbackStatus = 'new' | 'reviewed' | 'resolved' | 'closed' | (string & {});

export type FeedbackOption = { key: string; label: string };

export type FeedbackSender = {
  id: string;
  name: string | null;
  username: string | null;
  avatar: string | null;
};

export type FeedbackMessage = {
  id: string;
  feedback_id: string;
  body: string;
  is_staff: boolean;
  sender: FeedbackSender | null;
  created_at: string;
};

/** A ticket as the list sends it. */
export type FeedbackTicket = {
  id: string;
  type: FeedbackType;
  type_label: string;
  subject: string;
  message: string;
  status: FeedbackStatus;
  status_label: string;
  is_open: boolean;
  messages_count?: number;
  last_message_at: string | null;
  last_message_by: 'user' | 'staff' | (string & {}) | null;
  created_at: string;
  updated_at: string;
};

/** A ticket with its conversation. */
export type FeedbackTicketDetail = FeedbackTicket & {
  admin_note: string | null;
  messages: FeedbackMessage[];
};

export type FeedbackPayload = {
  type: FeedbackType;
  subject: string;
  message: string;
};

/** Used until `GET /feedback/types` answers (and if it can't). */
export const FALLBACK_FEEDBACK_TYPES: FeedbackOption[] = [
  { key: 'complaint', label: 'Complaint' },
  { key: 'suggestion', label: 'Suggestion' },
  { key: 'improvement', label: 'Improvement' },
  { key: 'bug', label: 'Bug report' },
  { key: 'other', label: 'Other' },
];

/** `GET /feedback/types` — the ticket types (and statuses) the backend accepts. */
export async function fetchFeedbackTypes(): Promise<{
  types: FeedbackOption[];
  statuses: FeedbackOption[];
}> {
  const { data } = await api.get<ApiEnvelope<{ types?: FeedbackOption[]; statuses?: FeedbackOption[] }>>(
    '/feedback/types',
  );
  return {
    types: data.data?.types?.length ? data.data.types : FALLBACK_FEEDBACK_TYPES,
    statuses: data.data?.statuses ?? [],
  };
}

/** `POST /feedback` — open a ticket. Answers with it, first message included. */
export async function submitFeedback(payload: FeedbackPayload): Promise<FeedbackTicketDetail> {
  const { data } = await api.post<ApiEnvelope<FeedbackTicketDetail>>('/feedback', payload);
  return withMessages(data.data);
}

/** `GET /feedback?page=` — your tickets, newest activity first, 15 a page. */
export async function fetchFeedbackTickets(page: number): Promise<Paginated<FeedbackTicket>> {
  const { data } = await api.get<ApiEnvelope<Paginated<FeedbackTicket>>>('/feedback', {
    params: { page },
  });
  return data.data;
}

/** `GET /feedback/{id}` — one ticket and its conversation. */
export async function fetchFeedbackTicket(id: string): Promise<FeedbackTicketDetail> {
  const { data } = await api.get<ApiEnvelope<FeedbackTicketDetail>>(`/feedback/${id}`);
  return withMessages(data.data);
}

/** `POST /feedback/{id}/messages` — reply on a ticket. */
export async function replyToFeedback(
  id: string,
  body: string,
): Promise<{ message: FeedbackMessage; feedback: FeedbackTicket }> {
  const { data } = await api.post<ApiEnvelope<{ message: FeedbackMessage; feedback: FeedbackTicket }>>(
    `/feedback/${id}/messages`,
    { body },
  );
  return data.data;
}

function withMessages(ticket: FeedbackTicketDetail): FeedbackTicketDetail {
  return { ...ticket, messages: Array.isArray(ticket.messages) ? ticket.messages : [] };
}
