import React from 'react';
import { StyleSheet, Text } from 'react-native';

import { useTheme } from '../../theme/ThemeProvider';
import { FONT } from '../../theme/fonts';

/** Small uppercase label above a form field (same look as CopyField's label). */
export function FieldLabel({ children }: { children: string }) {
  const { colors } = useTheme();
  return <Text style={[styles.label, { color: colors.textMuted }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  label: {
    fontFamily: FONT,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
});
