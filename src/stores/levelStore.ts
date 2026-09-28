import { create } from 'zustand';

import type { UserLevel } from '../api/levels';

/**
 * Every user level the app has actually been told, keyed by user id.
 *
 * **Only two endpoints report a level** (verified live 2026-09-28):
 * `GET /user/me` (`data.level`, the signed-in user) and
 * `GET /user/profile/{username}` (`level`, at the envelope root). Every other
 * user object — feed authors, commenters, likers, search, followers, trending,
 * communities, conversations, rolls — is `{id, name, username, avatar}` and
 * nothing more.
 *
 * So instead of guessing, the levels those two do report are remembered here
 * and read by `Avatar` / `LevelBadge` through a `userId`: your own badge shows
 * everywhere you appear, and anyone whose profile has been opened this session
 * gets theirs on their posts, comments and DMs too. A user object that starts
 * carrying `level` itself needs no store — the explicit prop wins.
 *
 * In memory only: levels change when someone upgrades, and a stale badge on a
 * money-adjacent app is worse than a missing one. Cleared on sign-out.
 */
type LevelState = {
  byId: Record<string, UserLevel>;
  setLevel: (userId: string, level: UserLevel | undefined) => void;
  reset: () => void;
};

export const useLevelStore = create<LevelState>((set) => ({
  byId: {},
  setLevel: (userId, level) =>
    set((state) => {
      if (!level || state.byId[userId] === level) return state;
      return { byId: { ...state.byId, [userId]: level } };
    }),
  reset: () => set({ byId: {} }),
}));

/** The level to show for a user: what the payload said, else what we've been told. */
export function useUserLevel(userId: string | undefined, explicit?: UserLevel) {
  const remembered = useLevelStore((s) => (userId ? s.byId[userId] : undefined));
  return explicit ?? remembered;
}
