/**
 * Dummy direct-messages data, modelled on the web app's `/user/messages` page
 * (conversation list on the left, thread on the right, composer under it).
 *
 * **There is no messaging API yet** — nothing in the Postman collection, and
 * nothing found by probing. So this file is the whole backend: seeded threads
 * plus the shapes the screens render. `src/stores/messagesStore.ts` holds the
 * mutable copy so sending a message updates the list in place.
 *
 * When the endpoints land, keep these types as the app-side model and map the
 * API onto them in `src/api/messages.ts`, exactly like `toPost` does for the
 * timeline — the screens should not have to change.
 */

import { members, type Member } from './community';
import { sampleImage } from './media';

/**
 * Delivery state of a message *you* sent. Mirrors the web's tick beside the
 * timestamp. Incoming messages carry no status — theirs is not ours to report.
 */
export type MessageStatus = 'sending' | 'sent' | 'read';

export type ChatMessage = {
  id: string;
  /** `SELF_ID` for the signed-in user, otherwise the other member's id. */
  senderId: string;
  body: string;
  /** Epoch ms. Stored as a number so day dividers and ordering are honest. */
  sentAt: number;
  /** Only ever set on your own messages. */
  status?: MessageStatus;
  /** Attached photo, when the message is an image. */
  imageUri?: string;
};

export type Conversation = {
  id: string;
  /** The other participant. Group threads don't exist on the web app either. */
  member: Member;
  /** Drives the green presence dot and the "Active now" line in the thread. */
  online: boolean;
  /** Presence copy when offline, e.g. "Active 2h ago". */
  lastActive?: string;
  /** Unread *incoming* messages. Cleared when the thread is opened. */
  unread: number;
  /** Local mute — the thread menu's toggle. Per-device until an API exists. */
  muted?: boolean;
  /**
   * When the thread itself was started. Only needed for one that has no
   * messages yet — without it an empty thread sorts to the *bottom* of a list
   * ordered by last message, which is the opposite of where a conversation you
   * just opened belongs.
   */
  startedAt?: number;
  messages: ChatMessage[];
};

/** The signed-in user's sender id inside a thread. */
export const SELF_ID = 'me';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Relative to now, so seeded threads never look stale on a later launch. */
const ago = (ms: number) => Date.now() - ms;

let seq = 0;
const msg = (
  senderId: string,
  body: string,
  sentAt: number,
  extra: Partial<ChatMessage> = {},
): ChatMessage => ({ id: `dm${++seq}`, senderId, body, sentAt, ...extra });

const [prosper, deborah, utu, kehinde, champion, timothy] = members;

export const seedConversations: Conversation[] = [
  {
    id: 'c1',
    member: prosper!,
    online: true,
    unread: 2,
    messages: [
      msg(prosper!.id, 'Yo! That post about payouts did numbers 🔥', ago(3 * HOUR)),
      msg(SELF_ID, 'Thanks man. 4k views before lunch, I was shocked', ago(3 * HOUR - 4 * MINUTE), {
        status: 'read',
      }),
      msg(prosper!.id, 'What time did you post it?', ago(26 * MINUTE)),
      msg(prosper!.id, 'Trying to figure out the best slot for mine', ago(24 * MINUTE)),
    ],
  },
  {
    id: 'c2',
    member: deborah!,
    online: true,
    unread: 0,
    messages: [
      msg(deborah!.id, 'Did you see the new Rolls tab?', ago(DAY + 2 * HOUR)),
      msg(SELF_ID, 'Yeah, I have been posting there all week', ago(DAY + HOUR), { status: 'read' }),
      msg(deborah!.id, 'Sending you the thumbnail I made', ago(5 * HOUR)),
      msg(deborah!.id, '', ago(5 * HOUR - MINUTE), { imageUri: sampleImage('dm-thumb', 900, 1200) }),
      msg(SELF_ID, 'This is clean 👏 use the violet one', ago(4 * HOUR), { status: 'read' }),
    ],
  },
  {
    id: 'c3',
    member: utu!,
    online: false,
    lastActive: 'Active 2h ago',
    unread: 1,
    messages: [
      msg(SELF_ID, 'Bro, are you joining the creators community?', ago(2 * DAY), { status: 'read' }),
      msg(utu!.id, 'Send the invite link, I will join tonight', ago(2 * HOUR)),
    ],
  },
  {
    id: 'c4',
    member: kehinde!,
    online: false,
    lastActive: 'Active yesterday',
    unread: 0,
    messages: [
      msg(kehinde!.id, 'Congrats on hitting Creator level 🎉', ago(3 * DAY)),
      msg(SELF_ID, 'Appreciate you 🙏', ago(3 * DAY - 20 * MINUTE), { status: 'read' }),
    ],
  },
  {
    id: 'c5',
    member: champion!,
    online: false,
    lastActive: 'Active 3d ago',
    unread: 0,
    messages: [
      msg(champion!.id, 'Can you review my referral copy before I post?', ago(5 * DAY)),
      msg(SELF_ID, 'Drop it here whenever', ago(5 * DAY - 30 * MINUTE), { status: 'sent' }),
    ],
  },
  {
    id: 'c6',
    member: timothy!,
    online: false,
    lastActive: 'Active last week',
    unread: 0,
    messages: [msg(timothy!.id, 'Thanks for the follow!', ago(8 * DAY))],
  },
];

/** People you can start a new thread with — everyone you aren't already in one with. */
export function membersWithoutConversation(conversations: Conversation[]): Member[] {
  const taken = new Set(conversations.map((c) => c.member.id));
  return members.filter((m) => !taken.has(m.id));
}

/** The message a conversation row previews, or undefined for an empty thread. */
export function lastMessage(conversation: Conversation): ChatMessage | undefined {
  return conversation.messages[conversation.messages.length - 1];
}

/** When a thread last moved — its newest message, or when it was started. */
function activityAt(conversation: Conversation): number {
  return lastMessage(conversation)?.sentAt ?? conversation.startedAt ?? 0;
}

/** Newest thread first, which is how the web orders the list. */
export function byRecency(a: Conversation, b: Conversation): number {
  return activityAt(b) - activityAt(a);
}
