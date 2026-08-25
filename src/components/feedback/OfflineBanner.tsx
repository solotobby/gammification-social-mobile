import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useIsOffline } from '../../hooks/useIsOffline';
import { useTheme } from '../../theme/ThemeProvider';
import { FONT } from '../../theme/fonts';

/** How long "Back online" stays up before the banner retracts. */
const RECONNECTED_MS = 1800;

/**
 * Persistent connectivity banner — the standing explanation for why things
 * aren't loading, so failed requests don't each need their own blocking modal
 * (see `showApiError`). Briefly confirms reconnection, then retracts.
 * Mounted once in app/_layout.tsx.
 */
export function OfflineBanner() {
  const { colors, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const offline = useIsOffline();

  // Distinct from `offline` so the "Back online" state can outlive it.
  const [visible, setVisible] = useState(offline);
  const progress = useRef(new Animated.Value(offline ? 1 : 0)).current;

  useEffect(() => {
    if (offline) {
      setVisible(true);
      return;
    }
    // Was never shown — nothing to confirm.
    if (!visible) return;
    const timer = setTimeout(() => setVisible(false), RECONNECTED_MS);
    return () => clearTimeout(timer);
    // `visible` is intentionally read but not tracked: adding it would restart
    // the timer when the banner hides itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offline]);

  useEffect(() => {
    Animated.spring(progress, {
      toValue: visible ? 1 : 0,
      useNativeDriver: true,
      speed: 20,
      bounciness: 6,
    }).start();
  }, [visible, progress]);

  if (!visible) return null;

  const tint = offline ? colors.danger : colors.mint;

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={[
        styles.wrap,
        {
          top: insets.top + 10,
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [-24, 0],
              }),
            },
          ],
        },
      ]}
    >
      <Animated.View
        style={[
          styles.pill,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderRadius: radius.pill,
            shadowColor: colors.shadow,
          },
        ]}
      >
        <Ionicons
          name={offline ? 'cloud-offline' : 'cloud-done'}
          size={18}
          color={tint}
        />
        <Text numberOfLines={1} style={[styles.message, { color: colors.text }]}>
          {offline ? "You're offline" : 'Back online'}
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 20,
    right: 20,
    alignItems: 'center',
    // Below ToastHost (100) so a toast is never covered by the banner.
    zIndex: 90,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: '100%',
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderWidth: 1,
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  message: {
    fontFamily: FONT,
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '700',
  },
});
