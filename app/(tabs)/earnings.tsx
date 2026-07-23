import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TAB_BAR_CLEARANCE } from '../../src/components/navigation/TabBar';
import { GhostButton } from '../../src/components/ui/GhostButton';
import { ScreenBackground } from '../../src/components/ui/ScreenBackground';
import { SectionHeader } from '../../src/components/ui/SectionHeader';
import { useMonthlyAnalytics, useYearlyAnalytics } from '../../src/hooks/useEarnings';
import { useTheme } from '../../src/theme/ThemeProvider';
import type { MonthlyAnalytics } from '../../src/api/types';

type StatCardProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: number;
  accent: string;
};

function StatCard({ icon, label, value, accent }: StatCardProps) {
  const { colors, radius } = useTheme();
  return (
    <View
      style={[
        styles.statCard,
        { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md },
      ]}
    >
      <View style={[styles.statIcon, { backgroundColor: `${accent}1A` }]}>
        <Ionicons name={icon} size={18} color={accent} />
      </View>
      <Text style={[styles.statValue, { color: colors.text }]}>{value.toLocaleString()}</Text>
      <Text style={[styles.statLabel, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

/** "2026-07" → { num: 7, short: "Jul" } for chips and the activity heading. */
function parseMonth(month: string): { num: number; short: string; year: number } {
  const [year, m] = month.split('-').map((n) => parseInt(n, 10));
  const short = new Date(year, (m || 1) - 1, 1).toLocaleDateString(undefined, { month: 'short' });
  return { num: m, short, year };
}

const now = new Date();
const CURRENT_YEAR = now.getFullYear();
const CURRENT_MONTH = now.getMonth() + 1;

/**
 * Earnings tab — the web Analytics page on mobile, driven by the earnings
 * analytics endpoints: yearly (GET /earnings/analytics/yearly) fills the month
 * chips, and monthly (GET /earnings/analytics/monthly) fills the selected
 * month's payout, activity, and monetized breakdown.
 */
export default function EarningsScreen() {
  const { colors, brand, radius, spacing } = useTheme();
  const insets = useSafeAreaInsets();

  const yearly = useYearlyAnalytics(CURRENT_YEAR);

  // Month chips come from the year's reported months; fall back to the current
  // month so the picker is never empty before any post exists.
  const monthList = useMemo(() => {
    const months = yearly.data?.months ?? [];
    if (months.length) return months.map((m) => m.month).sort();
    return [`${CURRENT_YEAR}-${String(CURRENT_MONTH).padStart(2, '0')}`];
  }, [yearly.data]);

  const [selected, setSelected] = useState<string | null>(null);
  const selectedMonth =
    selected && monthList.includes(selected) ? selected : monthList[monthList.length - 1];
  const selectedNum = parseMonth(selectedMonth).num;

  const monthly = useMonthlyAnalytics(CURRENT_YEAR, selectedNum);

  // Prefer the fresh monthly call; fall back to the month's slice of the yearly
  // payload while it loads (or if it fails), so the cards are never blank.
  const data: MonthlyAnalytics | undefined =
    monthly.data ?? yearly.data?.months.find((m) => m.month === selectedMonth);

  const monetized = data?.monetized ?? { views: 0, likes: 0, comments: 0, total_engagement: 0 };
  const unmonetized = data?.unmonetized ?? { views: 0, likes: 0, comments: 0, total_engagement: 0 };
  const estimated = data?.estimated_earning ?? 0;
  const totalPosts = data?.total_posts ?? 0;

  const monetizedRows = [
    { icon: 'eye-outline' as const, label: 'Monetized views', value: monetized.views },
    { icon: 'heart-outline' as const, label: 'Monetized likes', value: monetized.likes },
    { icon: 'chatbubble-outline' as const, label: 'Monetized comments', value: monetized.comments },
    { icon: 'flash-outline' as const, label: 'Total engagement', value: monetized.total_engagement },
  ];

  if (yearly.isLoading) {
    return (
      <View style={[styles.root, styles.center, { backgroundColor: colors.background }]}>
        <ScreenBackground />
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  if (yearly.isError && !yearly.data) {
    return (
      <View style={[styles.root, styles.center, { backgroundColor: colors.background }]}>
        <ScreenBackground />
        <Text style={[styles.errorText, { color: colors.textMuted }]}>
          We couldn't load your earnings.
        </Text>
        <GhostButton label="Retry" onPress={() => void yearly.refetch()} />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScreenBackground />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + spacing.lg,
          paddingBottom: insets.bottom + TAB_BAR_CLEARANCE,
          paddingHorizontal: spacing.xl,
          gap: spacing.xl,
        }}
      >
        <Text style={[styles.title, { color: colors.text }]}>Earnings</Text>

        {/* Month selector */}
        <View style={styles.monthRow}>
          {monthList.map((month) => {
            const active = month === selectedMonth;
            return (
              <Pressable
                key={month}
                onPress={() => setSelected(month)}
                accessibilityRole="button"
                style={[
                  styles.monthChip,
                  active
                    ? { backgroundColor: colors.brand, borderColor: colors.brand }
                    : { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <Text
                  style={[
                    styles.monthText,
                    { color: active ? colors.onBrand : colors.textSecondary },
                  ]}
                >
                  {parseMonth(month).short}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Estimated payout */}
        <LinearGradient
          colors={[brand.violetBright, brand.violet]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.payoutCard, { borderRadius: radius.lg, shadowColor: brand.violet }]}
        >
          <Text style={styles.payoutLabel}>Estimated earnings</Text>
          <Text style={styles.payoutValue}>
            ₦{estimated.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </Text>
          <Text style={styles.payoutNote}>
            Not your final payout — payouts are calculated at month end after engagement
            validation.
          </Text>
        </LinearGradient>

        {/* Rate banner */}
        <View
          style={[
            styles.rateBanner,
            { backgroundColor: `${colors.mint}14`, borderColor: `${colors.mint}40`, borderRadius: radius.md },
          ]}
        >
          <Ionicons name="rocket-outline" size={20} color={colors.mint} />
          <Text style={[styles.rateText, { color: colors.text }]}>
            Only <Text style={styles.rateBold}>monetized</Text> engagement pays — keep posting
            and engaging to grow the share that counts.
          </Text>
        </View>

        {/* Totals */}
        <View style={{ gap: spacing.md }}>
          <SectionHeader
            title={`Activity · ${parseMonth(selectedMonth).short} ${CURRENT_YEAR}`}
            icon="bar-chart"
          />
          <View style={styles.statGrid}>
            <StatCard icon="list-outline" label="Posts" value={totalPosts} accent={colors.brand} />
            <StatCard
              icon="eye-outline"
              label="Total views"
              value={monetized.views + unmonetized.views}
              accent={colors.mint}
            />
            <StatCard
              icon="heart-outline"
              label="Likes"
              value={monetized.likes + unmonetized.likes}
              accent={colors.pink}
            />
            <StatCard
              icon="chatbubble-outline"
              label="Comments"
              value={monetized.comments + unmonetized.comments}
              accent={colors.gold}
            />
          </View>
        </View>

        {/* Monetized engagement */}
        <View style={{ gap: spacing.md }}>
          <SectionHeader title="Monetized engagement" icon="flash" />
          <View
            style={[
              styles.monetizedCard,
              { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg },
            ]}
          >
            {monetizedRows.map((row, index) => (
              <View
                key={row.label}
                style={[
                  styles.monetizedRow,
                  index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
                ]}
              >
                <Ionicons name={row.icon} size={19} color={colors.brand} />
                <Text style={[styles.monetizedLabel, { color: colors.textSecondary }]}>
                  {row.label}
                </Text>
                <Text style={[styles.monetizedValue, { color: colors.text }]}>
                  {row.value.toLocaleString()}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', gap: 14 },
  errorText: { fontSize: 14, fontWeight: '600' },
  title: { fontSize: 26, fontWeight: '800' },
  monthRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  monthChip: {
    paddingHorizontal: 18,
    height: 38,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  monthText: { fontSize: 14, fontWeight: '700' },
  payoutCard: {
    padding: 22,
    gap: 6,
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  payoutLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '600' },
  payoutValue: { color: '#FFFFFF', fontSize: 38, fontWeight: '900' },
  payoutNote: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
    marginTop: 4,
  },
  rateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderWidth: 1,
  },
  rateText: { flex: 1, fontSize: 13, lineHeight: 19, fontWeight: '500' },
  rateBold: { fontWeight: '800' },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    flexBasis: '47%',
    flexGrow: 1,
    padding: 16,
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  statIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: { fontSize: 24, fontWeight: '900' },
  statLabel: { fontSize: 12, fontWeight: '700' },
  monetizedCard: {
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 18,
  },
  monetizedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 15,
  },
  monetizedLabel: { flex: 1, fontSize: 14, fontWeight: '600' },
  monetizedValue: { fontSize: 16, fontWeight: '800' },
});
