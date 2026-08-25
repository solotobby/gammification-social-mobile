import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TAB_BAR_CLEARANCE } from '../../src/components/navigation/TabBar';
import { GhostButton } from '../../src/components/ui/GhostButton';
import { ScreenBackground } from '../../src/components/ui/ScreenBackground';
import { SectionHeader } from '../../src/components/ui/SectionHeader';
import { transactions } from '../../src/data/community';
import { useCurrency } from '../../src/hooks/useCurrency';
import { useMonthlyAnalytics, useYearlyAnalytics } from '../../src/hooks/useEarnings';
import { useTheme } from '../../src/theme/ThemeProvider';
import type { MonthlyAnalytics } from '../../src/api/types';
import { FONT } from '../../src/theme/fonts';

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

/**
 * The ways an account can make money on Payhankey. Every row points at a screen
 * that exists today — Subscriptions joins the list when it's real, not before.
 *
 * Commented out along with the "Earn from Payhankey" section it feeds; nothing
 * else reads it. Restore both together.
 */
// const WAYS_TO_EARN: {
//   icon: keyof typeof Ionicons.glyphMap;
//   label: string;
//   sub: string;
//   route: string;
// }[] = [
//   { icon: 'document-text-outline', label: 'Content', sub: 'Earn from eligible engagement', route: '/how-it-works' },
//   { icon: 'film-outline', label: 'Rolls', sub: 'Short videos, more reach', route: '/rolls' },
//   { icon: 'people-circle-outline', label: 'Communities', sub: 'Build and monetize a community', route: '/communities' },
//   { icon: 'gift-outline', label: 'Referrals', sub: 'Invite people, earn rewards', route: '/referrals' },
//   { icon: 'arrow-up-circle-outline', label: 'Creator programs', sub: 'Unlock a higher level', route: '/upgrade' },
//   { icon: 'wallet-outline', label: 'Withdraw', sub: 'Move earnings to your bank', route: '/wallet' },
// ];

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
 * Earn tab — what you've made and every way to make more. Driven by the
 * earnings analytics endpoints: yearly (GET /earnings/analytics/yearly) fills
 * the month chips and the month-over-month comparison, monthly
 * (GET /earnings/analytics/monthly) fills the selected month's payout, growth,
 * and monetized breakdown.
 */
export default function EarnScreen() {
  const { colors, brand, radius, spacing } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // The earnings endpoints return the account's own currency, not naira.
  const { format: money } = useCurrency();
  const format = money;

  const recentPayouts = transactions.slice(0, 3);

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

  // Month-over-month movement — real data beats a goal number we'd have to
  // invent. Only shown when there's a previous month to compare against.
  const previous = useMemo(() => {
    const index = monthList.indexOf(selectedMonth);
    if (index <= 0) return undefined;
    const previousMonth = monthList[index - 1];
    const found = yearly.data?.months.find((m) => m.month === previousMonth);
    return found ? { short: parseMonth(previousMonth).short, earning: found.estimated_earning } : undefined;
  }, [monthList, selectedMonth, yearly.data]);

  const delta = previous ? estimated - previous.earning : null;

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
        <Text style={[styles.title, { color: colors.text }]}>Earn</Text>

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

        {/* Your earnings */}
        <LinearGradient
          colors={[brand.violetBright, brand.violet]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.payoutCard, { borderRadius: radius.lg, shadowColor: brand.violet }]}
        >
          <Text style={styles.payoutLabel}>Your earnings</Text>
          <Text style={styles.payoutValue}>{money(estimated)}</Text>
          {delta !== null ? (
            <View style={styles.deltaRow}>
              <Ionicons
                name={delta >= 0 ? 'arrow-up' : 'arrow-down'}
                size={13}
                color="#FFFFFF"
              />
              <Text style={styles.deltaText}>
                {money(Math.abs(delta))} vs {previous?.short}
              </Text>
            </View>
          ) : null}
          <Text style={styles.payoutNote}>
            Not your final payout — payouts are calculated at month end after engagement
            validation.
          </Text>
        </LinearGradient>

        {/* Ways to earn — hidden for now. Re-enable with WAYS_TO_EARN above.
        <View style={{ gap: spacing.md }}>
          <SectionHeader title="Earn from Payhankey" icon="cash" />
          <View
            style={[
              styles.listCard,
              { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg },
            ]}
          >
            {WAYS_TO_EARN.map((way, index) => (
              <Pressable
                key={way.label}
                onPress={() => router.push(way.route as never)}
                accessibilityRole="button"
                accessibilityLabel={way.label}
                style={({ pressed }) => [
                  styles.wayRow,
                  index > 0 && {
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: colors.border,
                  },
                  { opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <View style={[styles.wayIcon, { backgroundColor: colors.surfaceAlt }]}>
                  <Ionicons name={way.icon} size={19} color={colors.brand} />
                </View>
                <View style={styles.wayText}>
                  <Text style={[styles.wayLabel, { color: colors.text }]}>{way.label}</Text>
                  <Text style={[styles.waySub, { color: colors.textMuted }]}>{way.sub}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Pressable>
            ))}
          </View>
        </View>
        */}

        {/* Rate banner — hidden for now.
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
        */}

        {/* Your growth */}
        <View style={{ gap: spacing.md }}>
          <SectionHeader
            title={`Your growth · ${parseMonth(selectedMonth).short} ${CURRENT_YEAR}`}
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
              styles.listCard,
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

        {/* Payout history — moved here from /wallet, which now covers balance
            and plan status only. Still the dummy list: /user/transactions is
            wired on /transactions, but this preview has never been switched
            over to it. */}
        <View style={{ gap: spacing.md }}>
          <SectionHeader
            title="Payout history"
            icon="receipt"
            onSeeAll={() => router.push('/transactions')}
          />
          <View
            style={[
              styles.listCard,
              { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg },
            ]}
          >
            {recentPayouts.map((tx, index) => (
              <View
                key={tx.id}
                style={[
                  styles.txRow,
                  index > 0 && {
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: colors.border,
                  },
                ]}
              >
                <View style={[styles.txIcon, { backgroundColor: `${colors.mint}1A` }]}>
                  <Ionicons
                    name={tx.kind === 'payout' ? 'cash-outline' : 'gift-outline'}
                    size={18}
                    color={colors.mint}
                  />
                </View>
                <View style={styles.txText}>
                  <Text style={[styles.txLabel, { color: colors.text }]} numberOfLines={1}>
                    {tx.description}
                  </Text>
                  <Text style={[styles.txDate, { color: colors.textMuted }]}>{tx.date}</Text>
                </View>
                <Text style={[styles.txAmount, { color: colors.mint }]}>
                  +{format(tx.amount)}
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
  errorText: { fontFamily: FONT, fontSize: 14, fontWeight: '600' },
  title: { fontFamily: FONT, fontSize: 26, fontWeight: '800' },
  monthRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  monthChip: {
    paddingHorizontal: 18,
    height: 38,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  monthText: { fontFamily: FONT, fontSize: 14, fontWeight: '700' },
  payoutCard: {
    padding: 22,
    gap: 6,
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  payoutLabel: { fontFamily: FONT, color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '600' },
  payoutValue: { fontFamily: FONT, color: '#FFFFFF', fontSize: 38, fontWeight: '900' },
  deltaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  deltaText: { fontFamily: FONT, color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  payoutNote: {
    fontFamily: FONT,
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
  rateText: { fontFamily: FONT, flex: 1, fontSize: 13, lineHeight: 19, fontWeight: '500' },
  rateBold: { fontFamily: FONT, fontWeight: '800' },
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
  statValue: { fontFamily: FONT, fontSize: 24, fontWeight: '900' },
  statLabel: { fontFamily: FONT, fontSize: 12, fontWeight: '700' },
  listCard: {
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 18,
  },
  wayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
  },
  wayIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wayText: { flex: 1, gap: 1 },
  wayLabel: { fontFamily: FONT, fontSize: 15, fontWeight: '700' },
  waySub: { fontFamily: FONT, fontSize: 12, fontWeight: '500' },
  monetizedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 15,
  },
  monetizedLabel: { fontFamily: FONT, flex: 1, fontSize: 14, fontWeight: '600' },
  txRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  txIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txText: { flex: 1, gap: 1 },
  txLabel: { fontFamily: FONT, fontSize: 14, fontWeight: '700' },
  txDate: { fontFamily: FONT, fontSize: 12, fontWeight: '500' },
  txAmount: { fontFamily: FONT, fontSize: 15, fontWeight: '800' },
  monetizedValue: { fontFamily: FONT, fontSize: 16, fontWeight: '800' },
});
