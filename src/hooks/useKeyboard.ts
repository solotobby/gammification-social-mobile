import { useEffect, useState } from 'react';
import { Keyboard, Platform, type KeyboardEvent } from 'react-native';

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
