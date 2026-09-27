import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * People the signed-in user has blocked from messaging, as far as this device
 * knows.
 *
 * The API can block and unblock but can't *list* — there's no "who have I
 * blocked" endpoint and no `is_blocked` flag on a profile. Blocking also hides
 * the thread entirely, so without this the only record of a block would be a
 * profile whose Message button fails with "Messaging is not available for this
 * user". Remembering it here lets the profile offer **Unblock** instead.
 *
 * A block made on the web isn't in here; that profile still gets the server's
 * own 403 wording, which is accurate. Persisted and per-account — `reset()`
 * runs on sign-out.
 */

type BlockedState = {
  blocked: Record<string, { name: string; at: number }>;
  setBlocked: (userId: string, name: string, blocked: boolean) => void;
  reset: () => void;
};

export const useBlockedStore = create<BlockedState>()(
  persist(
    (set) => ({
      blocked: {},
      setBlocked: (userId, name, blocked) =>
        set((state) => {
          const next = { ...state.blocked };
          if (blocked) next[userId] = { name, at: Date.now() };
          else delete next[userId];
          return { blocked: next };
        }),
      reset: () => set({ blocked: {} }),
    }),
    {
      name: 'payhankey.messaging-blocks',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ blocked: state.blocked }),
    },
  ),
);
