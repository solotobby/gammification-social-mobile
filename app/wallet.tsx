import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackButton } from '../src/components/ui/BackButton';
import { GhostButton } from '../src/components/ui/GhostButton';
import { ScreenBackground } from '../src/components/ui/ScreenBackground';
import { useWallet } from '../src/hooks/useAccount';
import { formatMoney, resolveSymbol, symbolFor } from '../src/hooks/useCurrency';
import { useMe } from '../src/hooks/useMe';
import { useTheme } from '../src/theme/ThemeProvider';
import { FONT } from '../src/theme/fonts';

/**
 * Wallets — GET /user/wallet: the balance breakdown (main / referral /
 * promotion) and their total, the current plan, and the gated withdraw notice.
 *
 * Every figure comes from the API's own `formatted` strings, so the symbol here
 * can never disagree with the one on the feed's earned pill. The web's "total
 * withdrawn" cell and a "pending validation" chip are deliberately absent: the
 * endpoint returns no such number, and this screen used to invent both.
 *
 * The web page embeds the whole plan checkout here; on mobile the plan cards
 * already live on /upgrade, so this shows plan *status* and links there rather
 * than carrying a second copy of the pricing table.
 */

/** Icon + accent per balance `type`; unknown types still render, just plainly. */
const BALANCE_STYLE: Record<string, { icon: 'card-outline' | 'people-outline' | 'megaphone-outline'; accent: 'brand' | 'mint' | 'gold' }> = {
  main: { icon: 'card-outline', accent: 'brand' },
  referral: { icon: 'people-outline', accent: 'mint' },
  promoter: { icon: 'megaphone-outline', accent: 'gold' },
};
export default function WalletScreen() {
  const { colors, brand, radius, spacing } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const query = useWallet();
  const { data: me } = useMe();
  const plan = me?.level ?? 'Basic';

  // The API's `formatted` strings and `currency_symbol` spell naira as the code
  // "NGN" rather than ₦ (USD does come back as "$"), so amounts are formatted
  // here through the same resolver the feed's earned pill uses — one symbol for
  // the same currency everywhere in the app.
  const symbol =
    resolveSymbol(query.data?.currency_symbol) ?? symbolFor(query.data?.currency);
  const money = (amount: number) => formatMoney(amount, symbol);

  const accents = { brand: colors.brand, mint: colors.mint, gold: colors.gold };
  const balances = (query.data?.balances ?? []).map((balance) => {
    const style = BALANCE_STYLE[balance.type];
    return {
      key: balance.type,
      icon: style?.icon ?? ('wallet-outline' as const),
      accent: style ? accents[style.accent] : colors.pink,
      label: balance.label,
      sub: balance.description ?? '',
      value: money(balance.amount),
    };
  });

  // Commented out with the steps card it feeds — restore both together.
  // const unlockSteps = [
  //   {
  //     icon: 'card-outline' as const,
  //     label: 'Add bank information',
  //     sub: 'Where your payouts land',
  //     route: '/bank-info',
  //     done: /* from GET /user/bank */ false,
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
          <Text style={styles.balanceOverline}>Wallet · {plan}</Text>
          <Text style={styles.balanceLabel}>Your earnings</Text>
          {query.isLoading ? (
            <ActivityIndicator color="#FFFFFF" style={styles.balanceSpinner} />
          ) : (
            <Text style={styles.balanceValue}>
              {query.data ? money(query.data.total.amount) : '—'}
            </Text>
          )}
        </LinearGradient>

        {query.isError ? (
          <View
            style={[
              styles.gateBanner,
              { backgroundColor: `${colors.pink}14`, borderColor: `${colors.pink}40`, borderRadius: radius.md },
            ]}
          >
            <Ionicons name="alert-circle" size={20} color={colors.pink} />
            <View style={{ flex: 1, gap: 10 }}>
              <Text style={[styles.gateText, { color: colors.text }]}>
                We couldn't load your balances.
              </Text>
              <GhostButton label="Retry" onPress={() => void query.refetch()} />
            </View>
          </View>
        ) : null}

        {/* Balance breakdown */}
        <View style={styles.balanceGrid}>
          {balances.map((item) => (
            <View
              key={item.key}
              style={[
                styles.balanceCell,
                { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md },
              ]}
            >
              <View style={[styles.balanceIcon, { backgroundColor: `${item.accent}1A` }]}>
                <Ionicons name={item.icon} size={17} color={item.accent} />
              </View>
              <Text style={[styles.balanceCellValue, { color: colors.text }]}>
                {item.value}
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
              Current plan · {plan}
            </Text>
            <Text style={[styles.stepSub, { color: colors.textMuted }]}>
              {plan === 'Basic'
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
  balanceSpinner: { alignSelf: 'flex-start', marginVertical: 12 },
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
