import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { STATUS_META, type CommunityStatus } from '../../data/communities';
import { useTheme } from '../../theme/ThemeProvider';

/**
 * Status pill for a community (Public / Private / Paid / Approval). Colour
 * carries the meaning: open surfaces read mint, gated ones gold, paid violet.
 */
export function CommunityBadge({
  status,
  long,
}: {
  status: CommunityStatus;
  /** Use the full label ("Approval required") instead of the short one. */
  long?: boolean;
}) {
  const { colors } = useTheme();
  const meta = STATUS_META[status];

  const accent =
    status === 'public'
      ? colors.mint
      : status === 'paid'
        ? colors.brand
        : status === 'private'
          ? colors.textMuted
          : colors.gold;

  return (
    <View style={[styles.pill, { backgroundColor: `${accent}1A`, borderColor: `${accent}40` }]}>
      <Ionicons
        name={meta.icon as keyof typeof Ionicons.glyphMap}
        size={11}
        color={accent}
      />
      <Text style={[styles.text, { color: accent }]}>{long ? meta.label : meta.short}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  text: { fontSize: 11, fontWeight: '800' },
});
