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
};

/** The newest message of a thread, as the conversation list previews it. */
export type ConversationPreview = {
  body: string;
  hasImage: boolean;
  mine: boolean;
  sentAt: number;
  /** Only for a preview built from the outbox — the row shows a clock or "!". */
  status?: MessageStatus;
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

/** What a conversation row prints under the name. */
export function previewText(preview: ConversationPreview | null): string {
  if (!preview) return 'Say hello 👋';
  if (preview.body) return preview.body;
  return preview.hasImage ? 'Photo' : '';
}
