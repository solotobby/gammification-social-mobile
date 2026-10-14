import { create } from 'zustand';

/**
 * Who's online right now — `presence-messaging.online`, live since
 * 2026-10-14. Every signed-in app with an open socket is a member, so this is
 * "has Payhankey open", the same signal a WhatsApp-style green dot means.
 *
 * Deliberately not persisted: a stale "online" from a previous session is
 * worse than none, and the channel replays the full member list on every
 * subscribe anyway.
 */

type PresenceState = {
  online: Record<string, true>;
  /** The member list has arrived at least once on this connection. */
  ready: boolean;
  replace: (ids: string[]) => void;
  add: (id: string) => void;
  remove: (id: string) => void;
  reset: () => void;
};

export const usePresenceStore = create<PresenceState>((set) => ({
  online: {},
  ready: false,
  replace: (ids) => set({ online: Object.fromEntries(ids.map((id) => [id, true as const])), ready: true }),
  add: (id) => set((s) => (s.online[id] ? s : { online: { ...s.online, [id]: true } })),
  remove: (id) =>
    set((s) => {
      if (!s.online[id]) return s;
      const next = { ...s.online };
      delete next[id];
      return { online: next };
    }),
  reset: () => set({ online: {}, ready: false }),
}));

/** Is this user online? False while presence is unknown (no socket). */
export function useIsOnline(userId: string | null | undefined): boolean {
  return usePresenceStore((s) => !!userId && !!s.online[userId]);
}
