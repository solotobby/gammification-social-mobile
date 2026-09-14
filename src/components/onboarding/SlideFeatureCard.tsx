import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { SlideCard } from '../../data/onboarding';
import { Avatar } from '../ui/Avatar';
import { useTheme } from '../../theme/ThemeProvider';
import { FONT } from '../../theme/fonts';

type Props = { card: SlideCard };

/**
 * The sample post card under each slide's copy — a miniature of the app's own
 * `PostCard`, echoing the post cards the design composites into its artwork.
 *
 * It is a *static illustration*, not a real post: nothing here is pressable and
 * none of it comes from the API, so it deliberately does not reuse `PostCard`
 * (which expects a live `Post`, an engagement store and working actions).
 */
export function SlideFeatureCard({ card }: Props) {
  const { colors, radius, brand } = useTheme();

  const tones = {
    brand: brand.violet,
    mint: brand.mint,
    gold: brand.gold,
    pink: brand.pink,
  } as const;
  const tone = tones[card.badge.tone];

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: radius.lg,
          shadowColor: colors.shadow,
        },
      ]}
    >
      <View style={styles.head}>
        <Avatar name={card.name} tint={card.tint} size={34} />
        <View style={styles.who}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
              {card.name}
            </Text>
            <Ionicons name="checkmark-circle" size={13} color={colors.brand} />
          </View>
          <Text style={[styles.handle, { color: colors.textMuted }]} numberOfLines={1}>
            {card.handle} · {card.time}
          </Text>
        </View>

        <View style={[styles.badge, { backgroundColor: `${tone}1F` }]}>
          <Ionicons name={card.badge.icon} size={11} color={tone} />
          <Text style={[styles.badgeLabel, { color: tone }]} numberOfLines={1}>
            {card.badge.label}
          </Text>
        </View>
      </View>

      <Text style={[styles.body, { color: colors.textSecondary }]} numberOfLines={2}>
        {card.body}
      </Text>

      <View style={styles.stats}>
        {card.stats.map((stat) => (
          <View key={stat.icon} style={styles.stat}>
            <Ionicons name={stat.icon} size={13} color={colors.textMuted} />
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>
              {stat.label}
            </Text>
          </View>
        ))}
        <View style={styles.spacer} />
        <Ionicons name="bookmark-outline" size={14} color={colors.textMuted} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 10,
    shadowOpacity: 0.14,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  who: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  name: {
    fontFamily: FONT,
    fontSize: 13,
    fontWeight: '700',
    flexShrink: 1,
  },
  handle: {
    fontFamily: FONT,
    fontSize: 11,
    fontWeight: '500',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
  },
  badgeLabel: {
    fontFamily: FONT,
    fontSize: 10.5,
    fontWeight: '700',
  },
  body: {
    fontFamily: FONT,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '400',
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statLabel: {
    fontFamily: FONT,
    fontSize: 11.5,
    fontWeight: '600',
  },
  spacer: {
    flex: 1,
  },
});
