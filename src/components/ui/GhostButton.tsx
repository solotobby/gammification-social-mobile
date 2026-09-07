import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '../../theme/ThemeProvider';

type Props = {
  label: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Tint the icon + label with the brand accent. */
  accent?: boolean;
  /** Blocks presses and dims the label — for an action that isn't available. */
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Secondary, low-emphasis button on a filled surface (e.g. "Sign in here"). */
export function GhostButton({ label, onPress, icon, accent, disabled, style }: Props) {
  const { colors, radius, typography } = useTheme();
  const tint = disabled ? colors.textMuted : accent ? colors.brand : colors.text;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: colors.surfaceAlt,
          borderColor: colors.border,
          borderRadius: radius.pill,
          opacity: disabled ? 0.55 : pressed ? 0.7 : 1,
        },
        style,
      ]}
    >
      <View style={styles.content}>
        {icon ? <Ionicons name={icon} size={18} color={tint} /> : null}
        <Text style={[typography.button, { color: tint, fontSize: 15 }]}>{label}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
