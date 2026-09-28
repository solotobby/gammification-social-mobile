import { useEffect, useRef, useState } from 'react';
import { Dimensions, Keyboard, Platform, TextInput, type KeyboardEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type KeyboardState = {
  visible: boolean;
  /**
   * The keyboard panel's own height, as the OS reports it. On Android this is
   * **less than** what the keyboard costs you at the bottom of the window (it
   * excludes the navigation bar under the keys) — use `overlap` for layout and
   * keep this for diagnostics.
   */
  height: number;
  /**
   * How much of the app's bottom edge is unusable while the keyboard is up:
   * the keyboard panel plus the navigation bar under it. This is the number to
   * pad a bottom-anchored bar by, or to add as scroll headroom. See
   * `measureOverlap`.
   */
  overlap: number;
};

/**
 * Whether the software keyboard is currently up, and how tall it is.
 *
 * **Why this exists.** A bottom-anchored composer pads itself by
 * `insets.bottom` to clear the home indicator. That's right while the keyboard
 * is down — and wrong the moment it comes up, because the keyboard already
 * covers that strip, so the inset becomes a dead ~34pt band between the input
 * and the keys. `KeyboardAvoidingView` can't fix that: it lifts the bar, it
 * doesn't know the bar's own padding is now redundant.
 *
 * So every composer pads with `keyboardInset(insets.bottom, visible)` instead.
 *
 * iOS gets the `Will` events, which fire alongside the keyboard's own
 * animation so the layout moves in step with it rather than snapping after.
 * Android only reliably emits the `Did` pair.
 */
export function useKeyboard(): KeyboardState {
  // The navigation bar's inset — never the keyboard's: safe-area-context reads
  // navigationBars (API 30+) or the *stable* inset (older), both of which
  // exclude the IME. Part of the Android overlap; see `measureOverlap`.
  const navInset = useSafeAreaInsets().bottom;
  const [event, setEvent] = useState<KeyboardEvent['endCoordinates'] | null>(null);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const show = Keyboard.addListener(showEvent, (e: KeyboardEvent) => {
      setEvent(e.endCoordinates ?? { height: 0, screenX: 0, screenY: 0, width: 0 });
    });
    const hide = Keyboard.addListener(hideEvent, () => setEvent(null));

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  if (!event) return HIDDEN;
  return {
    visible: true,
    height: event.height ?? 0,
    overlap: measureOverlap(event, navInset),
  };
}

const HIDDEN: KeyboardState = { visible: false, height: 0, overlap: 0 };

/**
 * How much of the app's bottom edge the keyboard covers — the number to lift a
 * bottom-anchored composer by, or to add as scroll headroom.
 *
 * **This was wrong on physical phones for a long time, and only right on the
 * emulator it was tuned on.** It used to be `Dimensions.get('window').height -
 * screenY`. Read React Native's Android source (`ReactRootView`,
 * `DisplayMetricsHolder`) and the two sides of that subtraction are in
 * different spaces:
 *
 * - `screenY` is `getWindowVisibleDisplayFrame().bottom` — **screen**
 *   coordinates, the keyboard's top edge.
 * - the window height is `context.resources.displayMetrics`, which on
 *   **Android 14 and older excludes the navigation bar**. Only once Android 15
 *   enforces edge-to-edge do window and screen agree.
 *
 * The app is edge-to-edge everywhere (Expo SDK 54+), so its root spans the whole
 * screen, nav bar included. On an Android ≤14 phone the old formula therefore
 * came out short by the navigation bar — 48dp with 3-button navigation, about
 * a composer's height — and the input sat behind the keys while the list above
 * it still rose a little. The Pixel 9 / Android 16 emulator it was verified on
 * reports window == screen (923.43dp both), which is exactly why it looked fixed.
 *
 * So neither height is used any more:
 *
 * - **Android 11+ (API 30+).** RN reports `height = ime.bottom -
 *   systemBars.bottom`, i.e. the keyboard minus the nav bar under it. Adding the
 *   nav-bar inset back gives `ime.bottom` — Android's own measure of how much
 *   of the window the keyboard covers — with no screen/window size involved,
 *   which also holds in split-screen. Emulator check (3-button nav): 288.38 +
 *   48 = 336.38 = 923.43 − 587.05.
 * - **Android 10 and below.** RN's legacy path derives `height` from the window
 *   metrics (so it has the same nav-bar error), but `screenY` is still the
 *   keyboard's top edge in screen coordinates — so measure from the *screen*.
 * - **iOS.** Window and screen are the same thing; unchanged.
 */
function measureOverlap(end: KeyboardEvent['endCoordinates'], navInset: number): number {
  const height = end?.height ?? 0;
  const screenY = end?.screenY;

  if (Platform.OS === 'android') {
    if (typeof Platform.Version === 'number' && Platform.Version >= 30) {
      return Math.max(0, height + navInset);
    }
    if (typeof screenY === 'number') {
      return Math.max(0, Dimensions.get('screen').height - screenY);
    }
    return Math.max(0, height + navInset);
  }

  if (typeof screenY !== 'number') return height;
  return Math.max(0, Dimensions.get('window').height - screenY);
}

/**
 * Bottom padding for a composer bar: the safe-area inset while the keyboard is
 * down, and nothing extra once it's up — the keyboard occupies that space
 * itself, so keeping the inset just opens a gap under the input.
 *
 * On its own this only holds where something else is already lifting the bar
 * clear of the keys. Prefer `useComposerInset`, which is this plus that lift.
 */
export function keyboardInset(safeAreaBottom: number, keyboardVisible: boolean): number {
  return keyboardVisible ? 0 : safeAreaBottom;
}

/**
 * The whole bottom padding a screen-anchored composer needs, keyboard up or
 * down. Hand it `insets.bottom` and put the result on the composer's wrapper.
 *
 * **Why this exists — the Android bug it fixes.** Every composer in the app
 * sat inside a `KeyboardAvoidingView` with `behavior` set on iOS and left
 * `undefined` on Android, on the understanding that `adjustResize` would shrink
 * the window and the bar would ride up with it. That stopped being true: the
 * app is edge-to-edge (mandatory from SDK 54, and this is 56), and an
 * edge-to-edge window is **not** resized by the keyboard — the keyboard arrives
 * as an inset over a window that still spans the screen. So nothing moved the
 * bar, `keyboardInset` helpfully removed the safe-area padding as well, and the
 * input you had just tapped sat underneath the keys. iOS was fine throughout,
 * because UIKit does the lift itself.
 *
 * Pads by the measured `overlap`, never by `height` — see `measureOverlap` for
 * why those differ by a navigation bar on Android.
 */
export function useComposerInset(safeAreaBottom: number): number {
  const { visible, overlap } = useKeyboard();
  if (!visible) return safeAreaBottom;
  // iOS lifts the bar with KeyboardAvoidingView, which animates in step with
  // the keyboard in a way a padding change cannot; there, only the now-covered
  // safe-area inset needs removing.
  if (Platform.OS === 'ios') return 0;
  return overlap;
}

/**
 * Breathing room left between the focused input and the top of the keyboard.
 * Zero puts them flush, which reads as the input being clipped.
 */
const FOCUS_CLEARANCE = 12;

/**
 * Keeps a focused input inside a scrolling list visible above the Android
 * keyboard. Returns the ref to hand to that list.
 *
 * **Why Android needs this and iOS doesn't.** Every list in the app that
 * carries an inline composer already sets `automaticallyAdjustKeyboardInsets`
 * — and that prop is **iOS-only**. On iOS UIKit does two things when the
 * keyboard appears: it insets the scroll view, *and* it scrolls the first
 * responder into the visible part. On Android RN does the first (the window
 * resizes under `adjustResize`, so the list shrinks) but nothing does the
 * second — `ReactScrollView` doesn't scroll to the focused descendant the way
 * `android.widget.ScrollView` does. So the list got shorter and simply stayed
 * where it was, leaving the comment box you just tapped underneath the keys.
 * That is the whole of the "keyboard doesn't push the input up on Android" bug.
 *
 * `scrollResponderScrollNativeHandleToKeyboard` is RN's own helper for exactly
 * this — it measures the focused input against the keyboard metrics the
 * ScrollView already tracks and scrolls it clear. Nothing calls it
 * automatically; this hook is the caller.
 *
 * It is a no-op on iOS, where doing it as well would fight UIKit's own scroll.
 *
 * ```tsx
 * const listRef = useKeyboardFocusScroll<FlatList>();
 * <FlatList ref={listRef} automaticallyAdjustKeyboardInsets … />
 * ```
 */
export function useKeyboardFocusScroll<T>(): React.RefObject<T | null> {
  const listRef = useRef<T | null>(null);
  const { visible, overlap } = useKeyboard();

  useEffect(() => {
    if (Platform.OS !== 'android' || !visible) return;

    // Driven off the keyboard *state* rather than the raw event, and then one
    // frame later, so this runs after the render that added the keyboard's
    // height to the scroll view's bottom padding. Scrolling first would aim at
    // a content size that has no room to scroll into yet, which on a short
    // form means not moving at all.
    const frame = requestAnimationFrame(() => {
      const focused = TextInput.State.currentlyFocusedInput();
      if (!focused) return;
      // FlatList forwards this to its inner ScrollView; a plain ScrollView has
      // it directly. Optional throughout because a list can unmount between
      // the keyboard opening and this running.
      const responder = (
        listRef.current as {
          getScrollResponder?: () => {
            scrollResponderScrollNativeHandleToKeyboard?: (
              node: unknown,
              additionalOffset?: number,
              preventNegativeScrollOffset?: boolean,
            ) => void;
          } | null;
        } | null
      )?.getScrollResponder?.();

      // `preventNegativeScrollOffset` keeps a list that is already short from
      // being dragged downwards to meet the keyboard, which looks like a bug.
      responder?.scrollResponderScrollNativeHandleToKeyboard?.(
        focused,
        FOCUS_CLEARANCE,
        true,
      );
    });

    return () => cancelAnimationFrame(frame);
    // `overlap` is a dependency so a keyboard that changes size (a suggestion
    // strip appearing, switching to emoji) re-aims at the focused field.
  }, [visible, overlap]);

  return listRef;
}
