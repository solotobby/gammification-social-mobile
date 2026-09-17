import { create } from 'zustand';

import {
  SELF_ID,
  seedConversations,
  type ChatMessage,
  type Conversation,
} from '../data/messages';
import type { Member } from '../data/community';

/**
 * The mutable copy of the dummy message threads (`src/data/messages.ts`).
 *
 * **Deliberately not persisted.** Every other store in `src/stores/` mirrors
 * something the server owns; this one *is* the server until a messaging API
 * exists, and writing seeded fixtures into AsyncStorage would make a later
 * migration to real threads look like data loss. It resets with the app.
 *
 * Nothing here invents an incoming reply — a fake "they are typing…" would
 * make the UI demo well and the product lie. Threads only move when the user
 * sends something.
 */

type MessagesState = {
  conversations: Conversation[];
  /** Total unread across every thread — the badge on the Messages tab. */
  unreadTotal: () => number;
  find: (id: string) => Conversation | undefined;
  /** Appends a message from the signed-in user and returns it. */
  send: (conversationId: string, body: string, imageUri?: string) => ChatMessage | undefined;
  /** Clears a thread's unread count — called when the thread is opened. */
  markRead: (conversationId: string) => void;
  /** Existing thread with this member, or a new empty one. Returns its id. */
  startWith: (member: Member) => string;
  /** Local mute toggle from the thread menu. */
  toggleMute: (conversationId: string) => void;
  /** Removes a thread from the list. Local-only, like everything else here. */
  remove: (conversationId: string) => void;
  reset: () => void;
};

let messageSeq = 0;
let conversationSeq = 0;

export const useMessagesStore = create<MessagesState>((set, get) => ({
  conversations: seedConversations,

  unreadTotal: () => get().conversations.reduce((sum, c) => sum + c.unread, 0),

  find: (id) => get().conversations.find((c) => c.id === id),

  send: (conversationId, body, imageUri) => {
    const text = body.trim();
    if (!text && !imageUri) return undefined;

    const message: ChatMessage = {
      id: `dm-local-${++messageSeq}`,
      senderId: SELF_ID,
      body: text,
      sentAt: Date.now(),
      status: 'sent',
      ...(imageUri ? { imageUri } : {}),
    };

    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId ? { ...c, messages: [...c.messages, message] } : c,
      ),
    }));

    return message;
  },

  markRead: (conversationId) =>
    set((state) => {
      const target = state.conversations.find((c) => c.id === conversationId);
      if (!target || target.unread === 0) return state;
      return {
        conversations: state.conversations.map((c) =>
          c.id === conversationId ? { ...c, unread: 0 } : c,
        ),
      };
    }),

  startWith: (member) => {
    const existing = get().conversations.find((c) => c.member.id === member.id);
    if (existing) return existing.id;

    const conversation: Conversation = {
      id: `c-local-${++conversationSeq}`,
      member,
      online: false,
      lastActive: 'Active recently',
      unread: 0,
      startedAt: Date.now(),
      messages: [],
    };
    set((state) => ({ conversations: [conversation, ...state.conversations] }));
    return conversation.id;
  },

  toggleMute: (conversationId) =>
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId ? { ...c, muted: !c.muted } : c,
      ),
    })),

  remove: (conversationId) =>
    set((state) => ({
      conversations: state.conversations.filter((c) => c.id !== conversationId),
    })),

  reset: () => set({ conversations: seedConversations }),
}));
