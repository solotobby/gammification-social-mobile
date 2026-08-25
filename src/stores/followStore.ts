import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * Who the signed-in user follows, as far as this device knows.
 *
 * The API has no "list who I follow" endpoint and no `is_following` flag on
 * feed posts — the only follow signals are `GET /user/toggle/follow` (write) and
 * `ApiProfile.is_following` (one member at a time). Home's Following tab needs a
 * *set*, so every follow toggle the user makes in the app is mirrored here and
 * the tab filters the feed against it.
 *
 * That means Following starts empty for an account whose follows were made on
 * the web, and fills in as they follow people on mobile. It is a stopgap: once
 * the backend exposes a following feed (or a followed-ids list), this store
 * becomes a pure optimistic cache and the tab should read the endpoint instead.
 *
 * Persisted so the tab survives a restart, and per-account — `reset()` runs on
 * sign-out alongside the engagement store, or the next user on the device would
 * inherit the previous one's Following tab.
 */

type FollowState = {
  /** Followed user ids. Object rather than a Set so it survives JSON persistence. */
  following: Record<string, true>;
  isFollowing: (userId: string) => boolean;
  setFollowing: (userId: string, following: boolean) => void;
  reset: () => void;
};

export const useFollowStore = create<FollowState>()(
  persist(
    (set, get) => ({
      following: {},

      isFollowing: (userId) => !!get().following[userId],

      setFollowing: (userId, following) =>
        set((state) => {
          if (following) {
            if (state.following[userId]) return state;
            return { following: { ...state.following, [userId]: true as const } };
          }
          if (!state.following[userId]) return state;
          const next = { ...state.following };
          delete next[userId];
          return { following: next };
        }),

      reset: () => set({ following: {} }),
    }),
    {
      name: 'payhankey.follows',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ following: state.following }),
    },
  ),
);
