import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

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
 * **Persisted**, so a reload doesn't strip every badge until each profile is
 * opened again — the profile endpoint takes up to a minute (see
 * SLOW_READ_TIMEOUT), so "open it again" is not a cheap fix. It can't go stale
 * for long: every read of `/user/me` or a profile overwrites the entry with
 * what the server says now. Cleared on sign-out with the other per-account
 * stores.
 *
 * It is deliberately **never filled by fetching profiles in the background**:
 * that would be one minute-long request per author in the feed, and a profile
 * read is what the web reports as "X viewed your profile".
 */
type LevelState = {
  byId: Record<string, UserLevel>;
  setLevel: (userId: string, level: UserLevel | undefined) => void;
  reset: () => void;
};

export const useLevelStore = create<LevelState>()(
  persist(
    (set) => ({
      byId: {},
      setLevel: (userId, level) =>
        set((state) => {
          if (!level || state.byId[userId] === level) return state;
          return { byId: { ...state.byId, [userId]: level } };
        }),
      reset: () => set({ byId: {} }),
    }),
    {
      name: 'payhankey.levels',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ byId: state.byId }),
    },
  ),
);

/**
 * The level to show for a user: what the payload said, else what we've been
 * told. A level that arrives on a payload is also remembered, so it carries to
 * surfaces whose endpoint doesn't send one — `/conversations` participants
 * still don't (verified 2026-09-28), and this is how a Creator you've seen in
 * the feed keeps their badge in Messages.
 */
export function useUserLevel(userId: string | undefined, explicit?: UserLevel) {
  const remembered = useLevelStore((s) => (userId ? s.byId[userId] : undefined));
  // Written when *this payload's* level changes — never in reaction to the
  // store. Payloads can disagree about one user (a persisted feed from before
  // they upgraded beside a fresh post detail, a notification's snapshot beside
  // a live comment), and with `remembered` in the deps two such avatars on
  // screen overwrote each other forever: basic → creator → basic until React
  // threw "Maximum update depth exceeded" and the screen's error boundary
  // showed "Something went wrong". Each avatar renders its own payload's level
  // regardless, so the last write winning costs nothing.
  useEffect(() => {
    if (userId && explicit) useLevelStore.getState().setLevel(userId, explicit);
  }, [userId, explicit]);
  return explicit ?? remembered;
}
