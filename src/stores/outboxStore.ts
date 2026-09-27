import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { UploadFile } from '../api/types';
import type { ChatMessage } from '../data/messages';

/**
 * Messages you've sent that the server hasn't acknowledged yet.
 *
 * Why a store and not a paused React Query mutation (which is how comments
 * survive going offline): a message needs states a mutation doesn't have — a
 * visible `failed` with Retry and Remove, ordering within a thread, and a
 * back-off between attempts — and it has to render *inside* the thread, beside
 * server messages, from the moment Send is tapped. A store the thread reads is
 * the simplest thing that does all of that.
 *
 * **Persisted**, so a message written in airplane mode is still there — and
 * still sends — after the app is killed. `useOutboxSender`
 * (src/hooks/useMessages.ts) drains it whenever the device is online.
 *
 * Per-account: `reset()` runs on sign-out, or the next person to sign in on
 * this device would send the previous one's queue.
 */

export type OutboxState = 'queued' | 'sending' | 'failed';

export type OutboxItem = {
  /** Client-side id — also the bubble's id until the server's replaces it. */
  clientId: string;
  conversationId: string;
  body: string;
  /** Picked photos, still local files. */
  images: UploadFile[];
  /** When Send was tapped. Orders the outbox and dates the bubble. */
  createdAt: number;
  state: OutboxState;
  /** Attempts so far. Anything above zero means one may already have landed. */
  attempts: number;
  /** When the first attempt went out — the window a landed copy would sit in. */
  firstAttemptAt?: number;
  /** Don't retry before this (epoch ms) — back-off after a network failure. */
  retryAt?: number;
  /** The server's refusal, for a `failed` item. */
  error?: string;
};

type OutboxStoreState = {
  items: OutboxItem[];
  enqueue: (conversationId: string, body: string, images: UploadFile[]) => OutboxItem;
  update: (clientId: string, patch: Partial<OutboxItem>) => void;
  remove: (clientId: string) => void;
  /** Put a failed item back in the queue, ahead of any back-off. */
  retry: (clientId: string) => void;
  /**
   * The next item worth attempting now: the oldest queued item of each thread,
   * so a thread's messages always arrive in the order they were written. A
   * thread whose head is backing off is skipped whole rather than letting a
   * later message overtake it. Failed items don't hold a thread up.
   */
  next: () => OutboxItem | undefined;
  /** Earliest back-off deadline among queued items, if any — for a wake-up timer. */
  nextRetryAt: () => number | undefined;
  reset: () => void;
};

const newClientId = () => `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const useOutboxStore = create<OutboxStoreState>()(
  persist(
    (set, get) => ({
      items: [],

      enqueue: (conversationId, body, images) => {
        const item: OutboxItem = {
          clientId: newClientId(),
          conversationId,
          body,
          images,
          createdAt: Date.now(),
          state: 'queued',
          attempts: 0,
        };
        set((s) => ({ items: [...s.items, item] }));
        return item;
      },

      update: (clientId, patch) =>
        set((s) => ({
          items: s.items.map((item) => (item.clientId === clientId ? { ...item, ...patch } : item)),
        })),

      remove: (clientId) =>
        set((s) => ({ items: s.items.filter((item) => item.clientId !== clientId) })),

      retry: (clientId) =>
        set((s) => ({
          items: s.items.map((item) =>
            item.clientId === clientId
              ? { ...item, state: 'queued', retryAt: undefined, error: undefined }
              : item,
          ),
        })),

      next: () => {
        const now = Date.now();
        const blocked = new Set<string>();
        const ordered = [...get().items].sort((a, b) => a.createdAt - b.createdAt);
        for (const item of ordered) {
          if (item.state === 'failed' || blocked.has(item.conversationId)) continue;
          // One in flight per thread, and a backing-off head holds the rest.
          if (item.state === 'sending' || (item.retryAt && item.retryAt > now)) {
            blocked.add(item.conversationId);
            continue;
          }
          return item;
        }
        return undefined;
      },

      nextRetryAt: () => {
        const deadlines = get()
          .items.filter((item) => item.state === 'queued' && item.retryAt)
          .map((item) => item.retryAt!);
        return deadlines.length ? Math.min(...deadlines) : undefined;
      },

      reset: () => set({ items: [] }),
    }),
    {
      name: 'payhankey.message-outbox',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ items: state.items }),
      // A message caught mid-request when the app died is unconfirmed, not
      // lost — put it back in the queue. `attempts` stays, so the sender
      // checks the thread for a copy that landed before sending it again.
      merge: (persisted, current) => {
        const items = ((persisted as { items?: OutboxItem[] })?.items ?? []).map((item) =>
          item.state === 'sending' ? { ...item, state: 'queued' as const } : item,
        );
        return { ...current, items };
      },
    },
  ),
);

/** An outbox item as a bubble. */
export function outboxToMessage(item: OutboxItem): ChatMessage {
  return {
    id: item.clientId,
    mine: true,
    body: item.body,
    images: item.images.map((image) => image.uri),
    sentAt: item.createdAt,
    status: item.state === 'failed' ? 'failed' : 'sending',
    error: item.error,
    local: true,
  };
}
