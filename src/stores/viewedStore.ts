import { create } from 'zustand';

type ViewedState = {
  /** Post ids already reported this session. */
  ids: Record<string, true>;
  /** True the first time an id is seen — the caller should send the view then. */
  claim: (id: string) => boolean;
  reset: () => void;
};

/**
 * Which posts this session has already counted as viewed.
 *
 * Deliberately **not persisted**. The server already dedupes views per user
 * (verified live: three reads of the same post moved the counter by one), so
 * this store only exists to stop the client firing the same request repeatedly
 * as a post scrolls in and out of the viewport. Persisting it would add nothing
 * and would silently suppress views across app restarts if the server ever
 * stopped deduping.
 *
 * Reset on sign-out alongside the other per-account stores — a view belongs to
 * the account that made it.
 */
export const useViewedStore = create<ViewedState>((set, get) => ({
  ids: {},
  claim: (id) => {
    if (get().ids[id]) return false;
    set((state) => ({ ids: { ...state.ids, [id]: true } }));
    return true;
  },
  reset: () => set({ ids: {} }),
}));
