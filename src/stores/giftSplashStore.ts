import { create } from 'zustand';

/** The gift being celebrated — the catalog artifact that was just sent. */
export type SplashGift = {
  /** Catalog id ("rose", "rocket", …) — what picks the effect. */
  id: string;
  emoji: string;
  name: string;
  price: number;
  tier?: string | null;
};

type Splash = SplashGift & {
  /** Bumps per play, so sending the same gift twice remounts the overlay. */
  key: number;
  recipientName: string;
};

/**
 * The celebration that plays after a gift is sent.
 *
 * A store rather than state in `GiftSheet`, because the sheet is a native
 * `Modal` that closes the moment the send lands — anything rendered inside it
 * would vanish with it. The overlay is mounted once in `app/_layout.tsx`, above
 * every screen, and this hands it the gift from wherever the send happened.
 */
type GiftSplashState = {
  current: Splash | null;
  play: (gift: SplashGift, recipientName: string) => void;
  clear: () => void;
};

export const useGiftSplashStore = create<GiftSplashState>((set) => ({
  current: null,
  play: (gift, recipientName) =>
    set((state) => ({
      current: { ...gift, recipientName, key: (state.current?.key ?? 0) + 1 },
    })),
  clear: () => set({ current: null }),
}));
