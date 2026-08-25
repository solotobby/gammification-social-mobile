import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useFeedbackStore, type ToastKind } from '../../stores/feedbackStore';
import { useTheme } from '../../theme/ThemeProvider';
import { FONT } from '../../theme/fonts';

const SHOW_MS = 3200;

const ICONS: Record<ToastKind, keyof typeof Ionicons.glyphMap> = {
  success: 'checkmark-circle',
  error: 'alert-circle',
  info: 'information-circle',
};

/**
 * Transient toast host — renders the feedback store's current toast as a pill
 * that drops in below the notch, auto-dismisses, and can be tapped away.
 * Mounted once in app/_layout.tsx above the navigator.
 */
export function ToastHost() {
  const { colors, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useFeedbackStore((s) => s.toast);
  const hideToast = useFeedbackStore((s) => s.hideToast);

  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!toast) return;
    progress.setValue(0);
    Animated.spring(progress, {
      toValue: 1,
      useNativeDriver: true,
      speed: 24,
      bounciness: 7,
    }).start();
    const timer = setTimeout(hideToast, SHOW_MS);
    return () => clearTimeout(timer);
  }, [toast, progress, hideToast]);

  if (!toast) return null;

  const tint =
    toast.kind === 'success'
      ? colors.mint
      : toast.kind === 'error'
        ? colors.danger
        : colors.brand;

  return (
    <Animated.View
      pointerEvents="box-none"
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
      <Pressable
        onPress={hideToast}
        accessibilityRole="button"
        accessibilityLabel={`Dismiss notification: ${toast.message}`}
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
        <Ionicons name={ICONS[toast.kind]} size={20} color={tint} />
        <Text numberOfLines={2} style={[styles.message, { color: colors.text }]}>
          {toast.message}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 100,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    maxWidth: '100%',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderWidth: 1,
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  message: {
    fontFamily: FONT,
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '600',
  },
});
