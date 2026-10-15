/**
 * Direct messages — the app-side model the Messages screens render.
 *
 * The API (`/conversations`, live since 2026-09-27) is mapped onto these types
 * in `src/api/messages.ts`, exactly like `toPost` does for the timeline, so the
 * screens never read an API shape directly. Messages still waiting in the
 * outbox (`src/stores/outboxStore.ts`) are mapped onto `ChatMessage` too, which
 * is what lets a thread render sent and unsent messages as one list.
 */

import type { Member } from './community';

/**
 * Where one of *your* messages is.
 *
 * - `sending` — in the outbox: in flight, or waiting for a connection.
 * - `failed`  — the server refused it; tap to retry or remove.
 * - `sent` / `delivered` / `read` — the server's own word for it.
 *
 * Incoming messages carry no status — theirs is not ours to report.
 */
export type MessageStatus = 'sending' | 'failed' | 'sent' | 'delivered' | 'read';

/**
 * A call, logged into the thread by the backend as a `type: "call"` message
 * whose body is JSON — `{call_type, status, duration, formatted_duration}`
 * (seen live 2026-10-14). Sent from the caller's side, so `mine` on the
 * message means "you called".
 */
export type CallLog = {
  type: 'audio' | 'video';
  /** "1m 0s", "Missed", "No answer", "Declined"… — from your side of it. */
  label: string;
  /** They rang you and you never picked up — drawn in red. */
  missed: boolean;
};

export type ChatMessage = {
  /** Server id — or the outbox's client id while the message is unsent. */
  id: string;
  mine: boolean;
  body: string;
  /** Up to five photos. Local file URIs while the message is in the outbox. */
  images: string[];
  /** Epoch ms. A number so day dividers and ordering are honest. */
  sentAt: number;
  /** Only ever set on your own messages. */
  status?: MessageStatus;
  /** Why a `failed` message was refused, in the server's words. */
  error?: string;
  /** True while the message only exists on this device (the outbox). */
  local?: boolean;
  /** Set when this "message" is a call log rather than something said. */
  call?: CallLog;
};

/** The newest message of a thread, as the conversation list previews it. */
export type ConversationPreview = {
  body: string;
  hasImage: boolean;
  mine: boolean;
  sentAt: number;
  /** Only for a preview built from the outbox — the row shows a clock or "!". */
  status?: MessageStatus;
  /** The newest thing in the thread was a call. */
  call?: CallLog;
};

export type Conversation = {
  id: string;
  /** The other participant. Every conversation is direct — there are no groups. */
  member: Member;
  /** Unread *incoming* messages. */
  unread: number;
  muted: boolean;
  pinned: boolean;
  /** Null for a thread that has been opened but has no messages yet. */
  last: ConversationPreview | null;
};

/** A thread: who it's with, its flags, and the messages loaded so far. */
export type Thread = {
  conversation: Conversation;
  /** Oldest first. Only the pages loaded so far — see `hasOlder`. */
  messages: ChatMessage[];
  /** Whether `before_id` paging can reach further back. */
  hasOlder: boolean;
};

/** The server caps a message body here (422 above it). */
export const MAX_MESSAGE_LENGTH = 5000;

/** The server caps attachments per message here (422 above it). */
export const MAX_MESSAGE_IMAGES = 5;

/** When a thread last moved — its newest message. An empty one sorts by 0. */
function activityAt(conversation: Conversation): number {
  return conversation.last?.sentAt ?? 0;
}

/**
 * Newest thread first, except that pinned threads are hoisted above the rest.
 *
 * Pinning is ordering, so it belongs in the comparator rather than in a second
 * list the screens would have to concatenate: a pinned thread that receives a
 * message still moves to the top *of the pinned group*, and unpinning drops it
 * straight back to wherever its age puts it.
 *
 * A thread you just opened (no messages yet) has no age at all, so it sorts to
 * the bottom of its group — it's hoisted by the list only once something is
 * said in it, which is also when it becomes worth finding again.
 */
export function byRecency(a: Conversation, b: Conversation): number {
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
  return activityAt(b) - activityAt(a);
}

/**
 * Read a call-log message body (`type: "call"`, JSON in `body`). Returns null
 * for anything that isn't one, so ordinary text that happens to start with "{"
 * still renders as text.
 */
export function parseCallLog(body: string | null | undefined, mine: boolean): CallLog | null {
  if (!body || !body.startsWith('{') || !body.includes('"call_type"')) return null;
  let raw: {
    call_type?: string;
    status?: string;
    duration?: number;
    formatted_duration?: string;
    reason?: string;
  };
  try {
    raw = JSON.parse(body);
  } catch {
    // The conversation *list* truncates `last_message` to ~80 characters
    // ("…\"formatted_duration\":\"8..."), which breaks the JSON. Read whatever
    // fields survived the cut.
    const field = (name: string) => body.match(new RegExp(`"${name}"\\s*:\\s*"([^"]*)"`))?.[1];
    const seconds = body.match(/"duration"\s*:\s*(\d+)/)?.[1];
    raw = {
      call_type: field('call_type'),
      status: field('status'),
      duration: seconds ? Number(seconds) : undefined,
      formatted_duration: field('formatted_duration'),
    };
  }
  if (!raw || (raw.call_type !== 'audio' && raw.call_type !== 'video')) return null;
  const type = raw.call_type;
  switch (raw.status) {
    case 'completed':
      // Answered but media never connected — the backend still logs it as
      // completed, timing from the pickup (seen 2026-10-15: "completed, 31s").
      if (raw.reason === 'connection_failed') return { type, missed: false, label: 'Couldn’t connect' };
      return {
        type,
        missed: false,
        label:
          raw.formatted_duration ||
          (typeof raw.duration === 'number' ? formatCallDuration(raw.duration) : ''),
      };
    case 'rejected':
      return { type, missed: false, label: 'Declined' };
    case 'busy':
    case 'cancelled':
    case 'missed':
      return mine
        ? { type, missed: false, label: raw.status === 'busy' ? 'Busy' : 'No answer' }
        : { type, missed: true, label: 'Missed' };
    default:
      return { type, missed: false, label: '' };
  }
}

/**
 * The conversation list's readable call preview — `last_message: "Audio call ·
 * 31s"` with `last_message_type: "call"`, which replaced the truncated JSON on
 * 2026-10-15. Only the completed wording has been seen; the rest is matched by
 * keyword so a missed or declined call still reads right.
 */
export function parseCallPreview(text: string | null | undefined, mine: boolean): CallLog | null {
  if (!text) return null;
  const type = /video/i.test(text) ? 'video' : 'audio';
  const after = text.includes('·') ? text.split('·').slice(1).join('·').trim() : '';
  if (/declin|reject/i.test(text)) return { type, missed: false, label: 'Declined' };
  if (/missed|no answer|cancel|busy/i.test(text)) {
    return mine
      ? { type, missed: false, label: /busy/i.test(text) ? 'Busy' : 'No answer' }
      : { type, missed: true, label: 'Missed' };
  }
  if (/couldn.?t connect|failed/i.test(text)) return { type, missed: false, label: 'Couldn’t connect' };
  return { type, missed: false, label: after };
}

/** "8m 14s", "45s", "1h 2m" — the backend's own `formatted_duration` style. */
function formatCallDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${s}s`;
  return `${s}s`;
}

/** A call log as one line of inbox preview: "Voice call · 1m 0s", "Missed video call". */
export function callLogPreview(log: CallLog): string {
  const kind = log.type === 'video' ? 'video call' : 'voice call';
  if (log.missed) return `Missed ${kind}`;
  const title = log.type === 'video' ? 'Video call' : 'Voice call';
  return log.label ? `${title} · ${log.label}` : title;
}

/** What a conversation row prints under the name. */
export function previewText(preview: ConversationPreview | null): string {
  if (!preview) return 'Say hello 👋';
  // Read at display time too, so a list cached before call logs were
  // understood still shows words rather than JSON.
  const call = preview.call ?? parseCallLog(preview.body, preview.mine);
  if (call) return callLogPreview(call);
  if (preview.body) return preview.body;
  return preview.hasImage ? 'Photo' : '';
}
