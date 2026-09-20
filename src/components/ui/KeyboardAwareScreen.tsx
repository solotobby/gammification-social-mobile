import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useKeyboard, useKeyboardFocusScroll } from '../../hooks/useKeyboard';
import { useTheme } from '../../theme/ThemeProvider';
import { ScreenBackground } from './ScreenBackground';

type Props = {
  children: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
};

/**
 * Screen scaffold: ambient backdrop + safe-area + a keyboard-avoiding scroll
 * container. Inputs stay visible above the keyboard and taps pass through to
 * controls while the keyboard is open.
 *
 * **Every form in the app is this component** — sign-in, sign-up, the password
 * reset pair, `/settings`, `/settings/socials`, `/bank-info`,
 * `/community/create` — so what it does about the keyboard, it does about all
 * of them at once. That cut both ways: it was the single reason a field low on
 * a form stayed hidden under the keyboard on Android, on every one of those
 * screens.
 *
 * **What was wrong.** `behavior` was set on iOS and left `undefined` on
 * Android, and the scroll view was given neither a keyboard inset nor anything
 * to scroll the focused field into view. That relied on `adjustResize`
 * shrinking the window, which an edge-to-edge window (mandatory from SDK 54;
 * this is 56) does not do — so the form simply never moved. Verified on a
 * Pixel 9 emulator: focusing "Location" at the bottom of `/settings` left the
 * field behind the keyboard with the page still at the top.
 *
 * **The fix is two halves, and Android needs both.** UIKit does each of them
 * itself, which is why iOS was never affected:
 *
 * 1. *Room to scroll* — the keyboard's measured `overlap` is added to the
 *    content's bottom padding, so the last field can actually travel above the
 *    keys. Without this there is nowhere to scroll to and step 2 is a no-op.
 * 2. *Actually scrolling* — `useKeyboardFocusScroll` calls React Native's own
 *    `scrollResponderScrollNativeHandleToKeyboard` for the focused input. It
 *    runs a frame after the padding lands, for exactly the reason in (1).
 */
export function KeyboardAwareScreen({ children, contentStyle }: Props) {
  const insets = useSafeAreaInsets();
  const { spacing } = useTheme();

  // Android-only; both are inert on iOS, where KeyboardAvoidingView is doing
  // the work and a second opinion would only fight it.
  const { visible: keyboardUp, overlap: keyboardOverlap } = useKeyboard();
  const scrollRef = useKeyboardFocusScroll<ScrollView>();
  const keyboardRoom = Platform.OS === 'android' && keyboardUp ? keyboardOverlap : 0;

  return (
    <View style={styles.root}>
      <ScreenBackground />
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          // iOS-only prop; it is what insets the scroll view there, and the
          // Android equivalent is `keyboardRoom` below.
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={[
            {
              flexGrow: 1,
              paddingTop: insets.top + spacing.md,
              paddingBottom: insets.bottom + spacing.xxl,
              paddingHorizontal: spacing.xl,
            },
            contentStyle,
            // Last, so a caller's own contentStyle can't drop the headroom the
            // focused field needs to scroll into.
            { paddingBottom: insets.bottom + spacing.xxl + keyboardRoom },
          ]}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
