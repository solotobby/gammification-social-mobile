import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { FeedbackStatus } from '../../api/feedback';
import { useTheme } from '../../theme/ThemeProvider';
import { FONT } from '../../theme/fonts';

/**
 * A feedback ticket's status, in the backend's own words (`status_label`:
 * "New", "In review", "Resolved", "Closed") and a colour per state. Unknown
 * statuses render neutral rather than guessing a meaning.
 */
export function TicketStatusPill({ status, label }: { status: FeedbackStatus; label: string }) {
  const { colors } = useTheme();
  const tone =
    status === 'new'
      ? colors.brand
      : status === 'reviewed'
        ? colors.gold
        : status === 'resolved'
          ? colors.mint
          : colors.textMuted;
  return (
    <View style={[styles.pill, { backgroundColor: `${tone}1F` }]}>
      <Text style={[styles.text, { color: tone }]}>{label || status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, alignSelf: 'flex-start' },
  text: {
    fontFamily: FONT,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
});
