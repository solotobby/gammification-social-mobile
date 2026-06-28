import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme, type ThemePreference } from '../../theme/ThemeProvider';

const OPTIONS: {
  value: ThemePreference;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { value: 'system', label: 'System', icon: 'phone-portrait-outline' },
  { value: 'light', label: 'Light', icon: 'sunny-outline' },
  { value: 'dark', label: 'Dark', icon: 'moon-outline' },
];

/** Segmented control to pick System / Light / Dark. Defaults to System. */
export function ThemeToggle() {
  const { colors, preference, setPreference } = useTheme();

  return (
    <View
      style={[
        styles.track,
        { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
      ]}
    >
      {OPTIONS.map((opt) => {
        const active = preference === opt.value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => setPreference(opt.value)}
            accessibilityRole="button"
            accessibilityLabel={`${opt.label} theme`}
            accessibilityState={{ selected: active }}
            style={[
              styles.segment,
              active && { backgroundColor: colors.brand },
            ]}
          >
            <Ionicons
              name={opt.icon}
              size={16}
              color={active ? colors.onBrand : colors.textSecondary}
            />
            <Text
              style={[
                styles.label,
                { color: active ? colors.onBrand : colors.textSecondary },
              ]}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
  },
});
