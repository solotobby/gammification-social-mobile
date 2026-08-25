import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '../src/components/ui/Avatar';
import { BackButton } from '../src/components/ui/BackButton';
import { ScreenBackground } from '../src/components/ui/ScreenBackground';
import { earnings, topEarners } from '../src/data/community';
import { useTheme } from '../src/theme/ThemeProvider';
import { FONT } from '../src/theme/fonts';

const MEDALS = ['trophy', 'medal', 'medal-outline'] as const;
const MEDAL_TINTS = ['gold', 'pink', 'mint'] as const;

/** Top earners — monthly leaderboard of validated payouts (web "Top Earners"). */
export default function TopEarnersScreen() {
  const { colors, radius, spacing } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [month, setMonth] = useState(earnings.months.length - 1);

  const monthLabel = earnings.months[month];
  const entries = topEarners[monthLabel] ?? [];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScreenBackground />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + spacing.lg,
          paddingBottom: insets.bottom + spacing.xl,
          paddingHorizontal: spacing.xl,
          gap: spacing.xl,
        }}
      >
        <View style={styles.headerRow}>
          <BackButton onPress={() => router.back()} />
          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Top earners</Text>
            <Text style={[styles.headerSub, { color: colors.textMuted }]}>
              Monthly leaderboard
            </Text>
          </View>
          <View style={{ width: 44 }} />
        </View>

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

        <View style={{ gap: spacing.md }}>
          {entries.map((entry, index) => (
            <View
              key={entry.member.id}
              style={[
                styles.row,
                { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md },
              ]}
            >
              <View style={styles.rankSlot}>
                {index < 3 ? (
                  <Ionicons
                    name={MEDALS[index]}
                    size={20}
                    color={colors[MEDAL_TINTS[index]]}
                  />
                ) : (
                  <Text style={[styles.rank, { color: colors.textMuted }]}>{index + 1}</Text>
                )}
              </View>
              <Avatar name={entry.member.name} tint={entry.member.tint} size={44} />
              <View style={styles.rowText}>
                <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                  {entry.member.name}
                </Text>
                <Text style={[styles.handle, { color: colors.textMuted }]}>
                  @{entry.member.handle}
                </Text>
              </View>
              <Text style={[styles.earned, { color: colors.mint }]}>
                ₦{entry.earned.toLocaleString()}
              </Text>
            </View>
          ))}
        </View>

        {/* Your standing */}
        <Pressable
          onPress={() => router.push('/earn')}
          accessibilityRole="button"
          accessibilityLabel="Open your earnings"
          style={({ pressed }) => [
            styles.youCard,
            {
              backgroundColor: `${colors.brand}0F`,
              borderColor: `${colors.brand}33`,
              borderRadius: radius.md,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Ionicons name="trending-up-outline" size={20} color={colors.brand} />
          <Text style={[styles.youText, { color: colors.textSecondary }]}>
            Your {earnings.months[earnings.months.length - 1]} estimate is{' '}
            <Text style={[styles.youBold, { color: colors.text }]}>
              ₦{earnings.estimated.toLocaleString()}
            </Text>
            {' '}— keep engaging to climb the board.
          </Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerCenter: { alignItems: 'center', gap: 1 },
  headerTitle: { fontFamily: FONT, fontSize: 18, fontWeight: '800' },
  headerSub: { fontFamily: FONT, fontSize: 12, fontWeight: '600' },
  monthRow: { flexDirection: 'row', gap: 10 },
  monthChip: {
    paddingHorizontal: 18,
    height: 38,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  monthText: { fontFamily: FONT, fontSize: 14, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rankSlot: { width: 26, alignItems: 'center' },
  rank: { fontFamily: FONT, fontSize: 15, fontWeight: '900' },
  rowText: { flex: 1, gap: 2 },
  name: { fontFamily: FONT, fontSize: 15, fontWeight: '800' },
  handle: { fontFamily: FONT, fontSize: 12, fontWeight: '600' },
  earned: { fontFamily: FONT, fontSize: 15, fontWeight: '800' },
  youCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderWidth: 1,
  },
  youText: { fontFamily: FONT, flex: 1, fontSize: 13, lineHeight: 19, fontWeight: '500' },
  youBold: { fontFamily: FONT, fontWeight: '800' },
});
