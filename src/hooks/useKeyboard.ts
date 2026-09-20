import { useEffect, useRef, useState } from 'react';
import { Dimensions, Keyboard, Platform, TextInput, type KeyboardEvent } from 'react-native';

export type KeyboardState = {
  visible: boolean;
  /**
   * The keyboard panel's own height, as the OS reports it. On Android this is
   * **less than** what the keyboard costs you at the bottom of the window —
   * use `overlap` for layout and keep this for diagnostics.
   */
  height: number;
  /**
   * How much of the window's bottom edge is unusable while the keyboard is up:
   * the keyboard panel plus anything under it. This is the number to pad a
   * bottom-anchored bar by, or to add as scroll headroom. See `measureOverlap`.
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
  const [state, setState] = useState<KeyboardState>({ visible: false, height: 0, overlap: 0 });

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const show = Keyboard.addListener(showEvent, (event: KeyboardEvent) => {
      setState({
        visible: true,
        height: event.endCoordinates?.height ?? 0,
        overlap: measureOverlap(event),
      });
    });
    const hide = Keyboard.addListener(hideEvent, () => {
      setState({ visible: false, height: 0, overlap: 0 });
    });

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return state;
}

/**
 * How much of the window's bottom edge the keyboard costs, measured from where
 * its top edge actually lands rather than from its reported height.
 *
 * **The two differ, and the difference is not decoration.** Measured on a
 * Pixel 9 / Android 16 emulator with the keyboard up:
 *
 * ```
 * window / screen  923.43dp   (identical — the window is NOT resized)
 * keyboard height  312.38dp   screenY 587.05dp
 * keyboard panel spans 587.05 -> 899.43, leaving 24dp to the window bottom
 * ```
 *
 * That 24dp strip under the keyboard is the **gesture navigation bar**, which
 * an edge-to-edge window draws under and which the keyboard does not count as
 * its own height. Pad by `height` and the input is clipped by exactly that
 * strip — verified, it cuts the composer in half. Pad by `window.height -
 * screenY` and it sits flush. So the top edge is the honest measurement.
 *
 * Deriving it from the window also self-corrects on a window that *did* get
 * resized out from under the keyboard: there the window's own bottom has
 * already risen to meet `screenY`, the difference is ~0, and nothing more is
 * padded — which is what makes this safe if Android ever stops being
 * edge-to-edge here.
 */
function measureOverlap(event: KeyboardEvent): number {
  const screenY = event.endCoordinates?.screenY;
  if (typeof screenY !== 'number') return event.endCoordinates?.height ?? 0;
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
