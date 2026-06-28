import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '../../theme/ThemeProvider';

/**
 * Shared ambient backdrop used across screens: a soft top-down gradient wash plus
 * a couple of faint brand-tinted glows for depth. Mode-aware.
 */
export function ScreenBackground() {
  const { colors, isDark } = useTheme();

  return (
    <View style={[StyleSheet.absoluteFill, styles.clip]} pointerEvents="none">
      <LinearGradient
        colors={[colors.backgroundElevated, colors.background]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.55 }}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[
          styles.glow,
          styles.glowTop,
          { backgroundColor: colors.brand, opacity: isDark ? 0.16 : 0.1 },
        ]}
      />
      <View
        style={[
          styles.glow,
          styles.glowBottom,
          { backgroundColor: colors.pink, opacity: isDark ? 0.1 : 0.07 },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  clip: {
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    width: 360,
    height: 360,
    borderRadius: 180,
  },
  glowTop: {
    top: -140,
    right: -120,
  },
  glowBottom: {
    bottom: -160,
    left: -120,
  },
});
