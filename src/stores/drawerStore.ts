import { create } from 'zustand';

/**
 * Whether the side drawer is open.
 *
 * It's a store rather than context because the two ends are far apart: the
 * trigger is a button inside Home's list header, and the drawer itself is
 * mounted beside `<Tabs>` in the tab layout so it can cover the tab bar. A
 * provider spanning both would have to wrap the whole shell to hand one
 * boolean across it.
 *
 * Deliberately **not** persisted — an app that relaunched with its navigation
 * drawer already open would be reopening a menu nobody asked for.
 */
type DrawerState = {
  open: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
};

export const useDrawerStore = create<DrawerState>((set) => ({
  open: false,
  openDrawer: () => set({ open: true }),
  closeDrawer: () => set({ open: false }),
  toggleDrawer: () => set((state) => ({ open: !state.open })),
}));
