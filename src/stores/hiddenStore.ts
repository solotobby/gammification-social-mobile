import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * Posts the user chose to hide from their feed.
 *
 * There is no "hide post" / "not interested" endpoint, so this is entirely
 * client-side: the ids are persisted and the feed filters against them. That
 * means hiding is per-device rather than per-account on the server — the same
 * post can come back on another device until the backend ships the real thing.
 *
 * Per-account like the other engagement state — `reset()` runs on sign-out.
 */

type HiddenState = {
  ids: string[];
  isHidden: (postId: string) => boolean;
  hide: (postId: string) => void;
  unhide: (postId: string) => void;
  reset: () => void;
};

export const useHiddenStore = create<HiddenState>()(
  persist(
    (set, get) => ({
      ids: [],

      isHidden: (postId) => get().ids.includes(postId),

      hide: (postId) =>
        set((state) => (state.ids.includes(postId) ? state : { ids: [...state.ids, postId] })),

      unhide: (postId) => set((state) => ({ ids: state.ids.filter((id) => id !== postId) })),

      reset: () => set({ ids: [] }),
    }),
    {
      name: 'payhankey-hidden-posts',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
