import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useCurrency } from '../../hooks/useCurrency';
import { useMonthlyAnalytics } from '../../hooks/useEarnings';
import { useTheme } from '../../theme/ThemeProvider';
import { FONT } from '../../theme/fonts';

const now = new Date();
const CURRENT_YEAR = now.getFullYear();
const CURRENT_MONTH = now.getMonth() + 1;

/**
 * Below this the figure is more discouraging than motivating — lead with reach
 * instead. Expressed in the account's own currency, so it's deliberately a
 * rough threshold rather than a converted amount.
 */
const MEANINGFUL_EARNING = 100;

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return n.toLocaleString();
}

/**
 * The monetization signal on Home — one line that makes earning visible without
 * turning the feed into a financial dashboard. Taps through to the Earn tab.
 *
 * The headline adapts to how much the account has actually made: a naira figure
 * once it's worth showing, reach while it isn't, and a nudge to post when
 * there's no activity at all. Showing "₦0.00 today" every morning to a new
 * creator demotivates far more than it motivates.
 *
 * Renders nothing until the month's analytics land, so Home never flashes a
 * placeholder number.
 */
export function EarningsPulse() {
  const { colors, radius } = useTheme();
  const router = useRouter();
  const { format: money } = useCurrency();
  const monthly = useMonthlyAnalytics(CURRENT_YEAR, CURRENT_MONTH);

  const data = monthly.data;
  if (!data) return null;

  const { monetized, unmonetized } = data;
  const earned = data.estimated_earning ?? 0;
  const views = monetized.views + unmonetized.views;
  const engagement = monetized.total_engagement + unmonetized.total_engagement;
  // Share of engagement that actually pays — the honest "how am I doing" bar.
  const monetizedShare = engagement > 0 ? monetized.total_engagement / engagement : 0;

  let icon: keyof typeof Ionicons.glyphMap = 'sparkles-outline';
  let headline: string;
  let sub: string;

  if (earned >= MEANINGFUL_EARNING) {
    icon = 'trending-up';
    headline = `${money(earned)} earned this month`;
    sub = `${compact(views)} views · ${compact(engagement)} engagements`;
  } else if (views > 0) {
    icon = 'eye-outline';
    headline = `Your posts reached ${compact(views)} ${views === 1 ? 'person' : 'people'}`;
    sub = `${money(earned)} so far this month, keep it going`;
  } else {
    headline = 'Every post can earn';
    sub = 'Post today to start building this month';
  }

  return (
    <Pressable
      onPress={() => router.push('/earn')}
      accessibilityRole="button"
      accessibilityLabel={`${headline}. ${sub}. Open Earn.`}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: `${colors.mint}33`,
          borderRadius: radius.lg,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <View style={[styles.icon, { backgroundColor: `${colors.mint}1A` }]}>
        <Ionicons name={icon} size={19} color={colors.mint} />
      </View>
      <View style={styles.text}>
        <Text style={[styles.headline, { color: colors.text }]} numberOfLines={1}>
          {headline}
        </Text>
        <Text style={[styles.sub, { color: colors.textMuted }]} numberOfLines={1}>
          {sub}
        </Text>
        {engagement > 0 ? (
          <View style={[styles.track, { backgroundColor: colors.surfaceAlt }]}>
            <View
              style={[
                styles.fill,
                {
                  backgroundColor: colors.mint,
                  width: `${Math.max(4, Math.round(monetizedShare * 100))}%`,
                },
              ]}
            />
          </View>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderWidth: 1,
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: 3 },
  headline: { fontFamily: FONT, fontSize: 14, fontWeight: '800' },
  sub: { fontFamily: FONT, fontSize: 12, fontWeight: '600' },
  track: { height: 4, borderRadius: 2, overflow: 'hidden', marginTop: 3 },
  fill: { height: 4, borderRadius: 2 },
});
