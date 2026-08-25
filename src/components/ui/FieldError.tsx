import React from 'react';
import { StyleSheet, Text } from 'react-native';

import { useTheme } from '../../theme/ThemeProvider';
import { FONT } from '../../theme/fonts';

/** Small validation/API error line rendered under a form field or above a CTA. */
export function FieldError({ message }: { message?: string }) {
  const { colors } = useTheme();
  if (!message) return null;
  return <Text style={[styles.text, { color: colors.danger }]}>{message}</Text>;
}

const styles = StyleSheet.create({
  text: {
    fontFamily: FONT,
    fontSize: 13,
    fontWeight: '500',
    marginTop: -6,
    marginLeft: 4,
  },
});
