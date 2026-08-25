import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackButton } from '../src/components/ui/BackButton';
import { ScreenBackground } from '../src/components/ui/ScreenBackground';
import { SectionHeader } from '../src/components/ui/SectionHeader';
import { wallet } from '../src/data/community';
import { useTheme } from '../src/theme/ThemeProvider';
import { FONT } from '../src/theme/fonts';

/**
 * Wallets — the balance breakdown the web shows (main / referral / promotion /
 * total withdrawn), the current plan, the gated withdraw action, and a payout
 * history preview that links out to /transactions. Withdrawals unlock once bank
 * info exists and the account is Creator/Influencer tier.
 *
 * The web page embeds the whole plan checkout here; on mobile the plan cards
 * already live on /upgrade, so this shows plan *status* and links there rather
 * than carrying a second copy of the pricing table.
 */
export default function WalletScreen() {
  const { colors, brand, radius, spacing } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const balances = [
    {
      icon: 'card-outline' as const,
      label: 'Main balance',
      sub: 'Content monetization',
      value: wallet.mainBalance,
      accent: colors.brand,
    },
    {
      icon: 'people-outline' as const,
      label: 'Referral balance',
      sub: 'From people you invited',
      value: wallet.referralBalance,
      accent: colors.mint,
    },
    {
      icon: 'megaphone-outline' as const,
      label: 'Promotion balance',
      sub: 'Campaign credits',
      value: wallet.promotionBalance,
      accent: colors.gold,
    },
    {
      icon: 'arrow-down-outline' as const,
      label: 'Total withdrawn',
      sub: 'Paid out to your bank',
      value: wallet.totalWithdrawn,
      accent: colors.pink,
    },
  ];

  // Commented out with the steps card it feeds — restore both together.
  // const unlockSteps = [
  //   {
  //     icon: 'card-outline' as const,
  //     label: 'Add bank information',
  //     sub: 'Where your payouts land',
  //     route: '/bank-info',
  //     done: wallet.hasBankInfo,
  //   },
  //   {
  //     icon: 'arrow-up-circle-outline' as const,
  //     label: 'Upgrade',
  //     sub: 'Only Creator or Influencer receives payout',
  //     route: '/upgrade',
  //     done: false,
  //   },
  // ];

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
          <Text style={[styles.headerTitle, { color: colors.text }]}>Wallets</Text>
          <View style={{ width: 44 }} />
        </View>

        {/* Balance */}
        <LinearGradient
          colors={[brand.violetBright, brand.violet, brand.indigo]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.balanceCard, { borderRadius: radius.lg, shadowColor: brand.violet }]}
        >
          <Text style={styles.balanceOverline}>Wallet · {wallet.plan}</Text>
          <Text style={styles.balanceLabel}>Your earnings</Text>
          <Text style={styles.balanceValue}>₦{wallet.balance.toLocaleString()}</Text>
          <View style={styles.pendingChip}>
            <Ionicons name="hourglass-outline" size={13} color="rgba(255,255,255,0.85)" />
            <Text style={styles.pendingText}>
              ₦{wallet.pendingValidation.toLocaleString()} pending validation
            </Text>
          </View>
        </LinearGradient>

        {/* Balance breakdown */}
        <View style={styles.balanceGrid}>
          {balances.map((item) => (
            <View
              key={item.label}
              style={[
                styles.balanceCell,
                { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md },
              ]}
            >
              <View style={[styles.balanceIcon, { backgroundColor: `${item.accent}1A` }]}>
                <Ionicons name={item.icon} size={17} color={item.accent} />
              </View>
              <Text style={[styles.balanceCellValue, { color: colors.text }]}>
                ₦{item.value.toLocaleString()}
              </Text>
              <Text style={[styles.balanceCellLabel, { color: colors.text }]}>
                {item.label}
              </Text>
              <Text style={[styles.balanceCellSub, { color: colors.textMuted }]} numberOfLines={1}>
                {item.sub}
              </Text>
            </View>
          ))}
        </View>

        {/* Plan status */}
        <Pressable
          onPress={() => router.push('/upgrade')}
          accessibilityRole="button"
          accessibilityLabel="Change your plan"
          style={({ pressed }) => [
            styles.planCard,
            {
              backgroundColor: colors.surface,
              borderColor: `${colors.brand}33`,
              borderRadius: radius.lg,
              opacity: pressed ? 0.9 : 1,
            },
          ]}
        >
          <View style={[styles.stepIcon, { backgroundColor: `${colors.brand}1A` }]}>
            <Ionicons name="ribbon-outline" size={19} color={colors.brand} />
          </View>
          <View style={styles.stepText}>
            <Text style={[styles.stepLabel, { color: colors.text }]}>
              Current plan · {wallet.plan}
            </Text>
            <Text style={[styles.stepSub, { color: colors.textMuted }]}>
              {wallet.plan === 'Basic'
                ? 'Upgrade to unlock monetization and withdrawals'
                : 'Manage or change your subscription'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>

        {/* Withdrawal gate */}
        <View
          style={[
            styles.gateBanner,
            { backgroundColor: `${colors.gold}14`, borderColor: `${colors.gold}40`, borderRadius: radius.md },
          ]}
        >
          <Ionicons name="lock-open-outline" size={20} color={colors.gold} />
          <Text style={[styles.gateText, { color: colors.text }]}>
            <Text style={styles.gateBold}>Unlock withdrawals</Text> by linking a payout account
            and upgrading to Creator or Influencer.
          </Text>
        </View>

        {/* Add bank information / Upgrade steps — hidden for now.
        <View
          style={[
            styles.stepsCard,
            { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg },
          ]}
        >
          {unlockSteps.map((step, index) => (
            <Pressable
              key={step.label}
              onPress={() => router.push(step.route as never)}
              accessibilityRole="button"
              accessibilityLabel={step.label}
              style={({ pressed }) => [
                styles.stepRow,
                index > 0 && {
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: colors.border,
                },
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <View style={[styles.stepIcon, { backgroundColor: colors.surfaceAlt }]}>
                <Ionicons name={step.icon} size={19} color={colors.brand} />
              </View>
              <View style={styles.stepText}>
                <Text style={[styles.stepLabel, { color: colors.text }]}>{step.label}</Text>
                <Text style={[styles.stepSub, { color: colors.textMuted }]}>{step.sub}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          ))}
        </View>
        */}

        {/* Payout history now lives on the Earn tab. */}
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
  headerTitle: { fontFamily: FONT, fontSize: 18, fontWeight: '800' },
  balanceCard: {
    padding: 22,
    gap: 6,
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  balanceOverline: {
    fontFamily: FONT,
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  balanceLabel: { fontFamily: FONT, color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '600' },
  balanceValue: { fontFamily: FONT, color: '#FFFFFF', fontSize: 38, fontWeight: '900' },
  balanceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  balanceCell: {
    flexBasis: '47%',
    flexGrow: 1,
    padding: 14,
    gap: 4,
    borderWidth: StyleSheet.hairlineWidth,
  },
  balanceIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  balanceCellValue: { fontFamily: FONT, fontSize: 20, fontWeight: '900' },
  balanceCellLabel: { fontFamily: FONT, fontSize: 13, fontWeight: '700' },
  balanceCellSub: { fontFamily: FONT, fontSize: 11, fontWeight: '500' },
  planCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderWidth: 1,
  },
  pendingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginTop: 2,
  },
  pendingText: { fontFamily: FONT, color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600' },
  withdrawBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    backgroundColor: '#FFFFFF',
    opacity: 0.85,
    marginTop: 14,
  },
  withdrawText: { fontFamily: FONT, fontSize: 15, fontWeight: '800' },
  gateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderWidth: 1,
  },
  gateText: { fontFamily: FONT, flex: 1, fontSize: 13, lineHeight: 19, fontWeight: '500' },
  gateBold: { fontFamily: FONT, fontWeight: '800' },
  stepsCard: {
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
  },
  stepIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { flex: 1, gap: 1 },
  stepLabel: { fontFamily: FONT, fontSize: 15, fontWeight: '700' },
  stepSub: { fontFamily: FONT, fontSize: 12, fontWeight: '500' },
  historyCard: {
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
  },
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
});
