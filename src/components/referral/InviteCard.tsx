import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { referral } from '../../data/community';
import { useTheme } from '../../theme/ThemeProvider';
import { CopyField } from '../ui/CopyField';

/**
 * "Invite friends & earn together" card (moved here from Home). Carries both
 * the referral code and the share link, so it replaces the standalone
 * referral-code field rather than duplicating it.
 */
export function InviteCard() {
  const { colors, radius } = useTheme();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg },
      ]}
    >
      <View style={styles.header}>
        <View style={[styles.icon, { backgroundColor: `${colors.mint}1F` }]}>
          <Ionicons name="gift-outline" size={20} color={colors.mint} />
        </View>
        <View style={styles.text}>
          <Text style={[styles.title, { color: colors.text }]}>Invite friends & earn together</Text>
          <Text style={[styles.sub, { color: colors.textMuted }]}>
            Friends who join boost your engagement — and your referral pays you.
          </Text>
        </View>
      </View>
      <CopyField label="Referral code" value={referral.code} icon="gift-outline" emphasized />
      <CopyField label="Your referral link" value={referral.link} icon="link-outline" />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 18,
    gap: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  header: { flexDirection: 'row', gap: 12 },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: 3 },
  title: { fontSize: 16, fontWeight: '800' },
  sub: { fontSize: 13, lineHeight: 18, fontWeight: '500' },
});
