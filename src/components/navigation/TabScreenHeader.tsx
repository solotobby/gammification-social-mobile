import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  StyleSheet,
  type StyleProp,
  View,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../../theme/ThemeProvider';

/** How far the list has to move before the header's divider appears. */
const SCROLLED_AT = 4;

/**
 * The fixed top row of a tab screen — the drawer avatar and whatever shares
 * its row (Home's greeting + search + bell, the Earn / Communities / Messages
 * titles). It sits *above* the screen's list rather than inside it, so it
 * stays put while the content scrolls underneath.
 *
 * It is a sibling in the column, not an overlay: the list starts below it and
 * clips at its bottom edge, so no background is needed and `ScreenBackground`
 * shows through exactly as before. A hairline fades in once the list has moved
 * (`scrolled`) — without it, content vanishing at an invisible edge reads as a
 * rendering glitch rather than a header.
 *
 * It owns `insets.top`, so the list under it must NOT add the safe area again.
 */
export function TabScreenHeader({
  scrolled,
  gutter,
  style,
  children,
}: {
  scrolled: boolean;
  /** Horizontal inset — each screen keeps its own (Home uses FEED_GUTTER). */
  gutter: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const [divider] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.timing(divider, {
      toValue: scrolled ? 1 : 0,
      duration: 160,
      useNativeDriver: true,
    }).start();
  }, [divider, scrolled]);

  return (
    <View
      style={[
        {
          paddingTop: insets.top + spacing.lg,
          paddingBottom: spacing.md,
          paddingHorizontal: gutter,
        },
        style,
      ]}
    >
      {children}
      <Animated.View
        pointerEvents="none"
        style={[styles.divider, { backgroundColor: colors.border, opacity: divider }]}
      />
    </View>
  );
}

/**
 * Tracks whether a list has scrolled off its top, for `TabScreenHeader`'s
 * divider. Only re-renders when the answer flips, not on every scroll frame.
 */
export function useScrolledPastTop() {
  const [scrolled, setScrolled] = useState(false);
  const last = useRef(false);
  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = e.nativeEvent.contentOffset.y > SCROLLED_AT;
    if (next === last.current) return;
    last.current = next;
    setScrolled(next);
  }, []);
  return { scrolled, onScroll, scrollEventThrottle: 16 } as const;
}

const styles = StyleSheet.create({
  divider: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
  },
});
