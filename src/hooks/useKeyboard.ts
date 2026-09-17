import { useEffect, useRef, useState } from 'react';
import { Keyboard, Platform, TextInput, type KeyboardEvent } from 'react-native';

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
export function useKeyboard(): { visible: boolean; height: number } {
  const [state, setState] = useState({ visible: false, height: 0 });

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const show = Keyboard.addListener(showEvent, (event: KeyboardEvent) => {
      setState({ visible: true, height: event.endCoordinates?.height ?? 0 });
    });
    const hide = Keyboard.addListener(hideEvent, () => {
      setState({ visible: false, height: 0 });
    });

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return state;
}

/**
 * Bottom padding for a composer bar: the safe-area inset while the keyboard is
 * down, and nothing extra once it's up — the keyboard occupies that space
 * itself, so keeping the inset just opens a gap under the input.
 */
export function keyboardInset(safeAreaBottom: number, keyboardVisible: boolean): number {
  return keyboardVisible ? 0 : safeAreaBottom;
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

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const subscription = Keyboard.addListener('keyboardDidShow', () => {
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

    return () => subscription.remove();
  }, []);

  return listRef;
}
