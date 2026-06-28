import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../theme/ThemeProvider';

type Props = {
  label: string;
  value: string;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Use a monospace-ish, letter-spaced look (good for codes). */
  emphasized?: boolean;
};

/** Read-only field that copies its value to the clipboard with confirmation. */
export function CopyField({ label, value, icon, emphasized }: Props) {
  const { colors, radius } = useTheme();
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    await Clipboard.setStringAsync(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
      <View
        style={[
          styles.row,
          {
            backgroundColor: colors.surfaceAlt,
            borderColor: copied ? colors.mint : colors.border,
            borderRadius: radius.md,
          },
        ]}
      >
        {icon ? (
          <Ionicons name={icon} size={20} color={colors.brand} style={styles.leading} />
        ) : null}
        <Text
          numberOfLines={1}
          style={[
            styles.value,
            {
              color: colors.text,
              letterSpacing: emphasized ? 2 : 0,
              fontWeight: emphasized ? '800' : '600',
              fontSize: emphasized ? 18 : 15,
            },
          ]}
        >
          {value}
        </Text>
        <Pressable
          onPress={onCopy}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Copy ${label}`}
          style={[
            styles.copyBtn,
            {
              backgroundColor: copied ? colors.mint : colors.brand,
              borderRadius: radius.sm,
            },
          ]}
        >
          <Ionicons
            name={copied ? 'checkmark' : 'copy-outline'}
            size={18}
            color={colors.onBrand}
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  label: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    paddingLeft: 16,
    paddingRight: 8,
    borderWidth: 1.5,
  },
  leading: { marginRight: 10 },
  value: { flex: 1 },
  copyBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
