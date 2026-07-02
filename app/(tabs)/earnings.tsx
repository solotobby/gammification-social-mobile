import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TAB_BAR_CLEARANCE } from '../../src/components/navigation/TabBar';
import { ScreenBackground } from '../../src/components/ui/ScreenBackground';
import { SectionHeader } from '../../src/components/ui/SectionHeader';
import { earnings } from '../../src/data/community';
import { useTheme } from '../../src/theme/ThemeProvider';

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
 * Earnings tab — the web Analytics page condensed for mobile: estimated payout,
 * the engagement→naira rate, this month's totals, and monetized breakdown.
 */
export default function EarningsScreen() {
  const { colors, brand, radius, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const [month, setMonth] = useState(earnings.months.length - 1);

  const monetizedRows = [
    { icon: 'eye-outline' as const, label: 'Monetized views', value: earnings.monetized.views },
    { icon: 'heart-outline' as const, label: 'Monetized likes', value: earnings.monetized.likes },
    { icon: 'chatbubble-outline' as const, label: 'Monetized comments', value: earnings.monetized.comments },
    { icon: 'flash-outline' as const, label: 'Total engagement', value: earnings.monetized.engagement },
  ];

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
          {earnings.months.map((label, index) => {
            const active = index === month;
            return (
              <Pressable
                key={label}
                onPress={() => setMonth(index)}
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
                  {label}
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
          <Text style={styles.payoutValue}>₦{earnings.estimated.toLocaleString()}</Text>
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
            Every <Text style={styles.rateBold}>1,000 engagements</Text> puts{' '}
            <Text style={styles.rateBold}>₦{earnings.ratePerThousand.toLocaleString()}</Text>{' '}
            straight into your wallet. Keep engaging!
          </Text>
        </View>

        {/* Totals */}
        <View style={{ gap: spacing.md }}>
          <SectionHeader title={`Activity · ${earnings.months[month]} 2026`} icon="bar-chart" />
          <View style={styles.statGrid}>
            <StatCard icon="list-outline" label="Posts" value={earnings.totals.posts} accent={colors.brand} />
            <StatCard icon="eye-outline" label="Total views" value={earnings.totals.views} accent={colors.mint} />
            <StatCard icon="heart-outline" label="Likes" value={earnings.totals.likes} accent={colors.pink} />
            <StatCard icon="chatbubble-outline" label="Comments" value={earnings.totals.comments} accent={colors.gold} />
          </View>
        </View>

        {/* Monetized engagement */}
        <View style={{ gap: spacing.md }}>
          <SectionHeader title="Engagement from your posts" icon="flash" />
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
  title: { fontSize: 26, fontWeight: '800' },
  monthRow: { flexDirection: 'row', gap: 10 },
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
