import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { LayoutAnimation, Platform, Pressable, StyleSheet, Text, UIManager, View } from 'react-native';

import { useMyReferral } from '../../hooks/useMe';
import { useTheme } from '../../theme/ThemeProvider';
import { CopyField } from '../ui/CopyField';
import { FONT } from '../../theme/fonts';

// LayoutAnimation is opt-in on old-architecture Android.
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/**
 * "Invite friends & earn together" — the referral code and share link.
 *
 * **Collapsed by default.** Expanded it ran to roughly a third of the profile
 * screen and pushed the user's own posts below the fold, which buries the thing
 * the screen is actually about. As a single row it stays one tap away without
 * costing the feed any room.
 */
export function InviteCard({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const { colors, radius } = useTheme();
  const { code, link } = useMyReferral();
  const [open, setOpen] = useState(defaultOpen);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((o) => !o);
  };

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg },
      ]}
    >
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityLabel={open ? 'Hide invite details' : 'Show invite details'}
        accessibilityState={{ expanded: open }}
        style={({ pressed }) => [styles.header, { opacity: pressed ? 0.7 : 1 }]}
      >
        <View style={[styles.icon, { backgroundColor: `${colors.mint}1F` }]}>
          <Ionicons name="gift-outline" size={18} color={colors.mint} />
        </View>
        <View style={styles.text}>
          <Text style={[styles.title, { color: colors.text }]}>Invite friends & earn together</Text>
          {/* The pitch is only worth its two lines once you've asked for it. */}
          {open ? (
            <Text style={[styles.sub, { color: colors.textMuted }]}>
              Friends who join boost your engagement — and your referral pays you.
            </Text>
          ) : null}
        </View>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={colors.textMuted}
        />
      </Pressable>

      {open ? (
        <View style={styles.body}>
          <CopyField
            label="Referral code"
            value={code ?? 'Loading…'}
            icon="gift-outline"
            emphasized
          />
          <CopyField label="Your referral link" value={link ?? 'Loading…'} icon="link-outline" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: 3 },
  title: { fontFamily: FONT, fontSize: 15, fontWeight: '800' },
  sub: { fontFamily: FONT, fontSize: 13, lineHeight: 18, fontWeight: '500' },
  body: { gap: 12, paddingTop: 14 },
});
