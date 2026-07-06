import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackButton } from '../src/components/ui/BackButton';
import { ScreenBackground } from '../src/components/ui/ScreenBackground';
import { SectionHeader } from '../src/components/ui/SectionHeader';
import { transactions, wallet } from '../src/data/community';
import { useTheme } from '../src/theme/ThemeProvider';

/**
 * Wallets — balance card, the (gated) withdraw action, and a payout history
 * preview that links out to /transactions. Withdrawals unlock once bank info
 * exists and the account is Creator/Influencer tier.
 */
export default function WalletScreen() {
  const { colors, brand, radius, spacing } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const recent = transactions.slice(0, 3);

  const unlockSteps = [
    {
      icon: 'card-outline' as const,
      label: 'Add bank information',
      sub: 'Where your payouts land',
      route: '/bank-info',
      done: wallet.hasBankInfo,
    },
    {
      icon: 'arrow-up-circle-outline' as const,
      label: 'Upgrade to Creator',
      sub: 'Withdrawals need Creator or Influencer',
      route: '/upgrade',
      done: false,
    },
  ];

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
          <Text style={styles.balanceLabel}>Available balance</Text>
          <Text style={styles.balanceValue}>₦{wallet.balance.toLocaleString()}</Text>
          <View style={styles.pendingChip}>
            <Ionicons name="hourglass-outline" size={13} color="rgba(255,255,255,0.85)" />
            <Text style={styles.pendingText}>
              ₦{wallet.pendingValidation.toLocaleString()} pending validation
            </Text>
          </View>

          <View
            style={[styles.withdrawBtn, { borderRadius: radius.pill }]}
            accessibilityLabel="Withdraw (locked)"
          >
            <Ionicons name="lock-closed" size={16} color={brand.violet} />
            <Text style={[styles.withdrawText, { color: brand.violet }]}>Withdraw</Text>
          </View>
        </LinearGradient>

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

        {/* Payout history preview */}
        <View style={{ gap: spacing.md }}>
          <SectionHeader
            title="Payout history"
            icon="receipt"
            onSeeAll={() => router.push('/transactions')}
          />
          <View
            style={[
              styles.historyCard,
              { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg },
            ]}
          >
            {recent.map((tx, index) => (
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
                  +₦{tx.amount.toLocaleString()}
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  balanceCard: {
    padding: 22,
    gap: 6,
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  balanceLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '600' },
  balanceValue: { color: '#FFFFFF', fontSize: 38, fontWeight: '900' },
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
  pendingText: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600' },
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
  withdrawText: { fontSize: 15, fontWeight: '800' },
  gateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderWidth: 1,
  },
  gateText: { flex: 1, fontSize: 13, lineHeight: 19, fontWeight: '500' },
  gateBold: { fontWeight: '800' },
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
  stepLabel: { fontSize: 15, fontWeight: '700' },
  stepSub: { fontSize: 12, fontWeight: '500' },
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
  txLabel: { fontSize: 14, fontWeight: '700' },
  txDate: { fontSize: 12, fontWeight: '500' },
  txAmount: { fontSize: 15, fontWeight: '800' },
});
