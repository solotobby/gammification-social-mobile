import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { toPayKoinTransaction, type PayKoinTransaction } from '../src/api/paykoin';
import { BackButton } from '../src/components/ui/BackButton';
import { GhostButton } from '../src/components/ui/GhostButton';
import { ScreenBackground } from '../src/components/ui/ScreenBackground';
import {
  useConvertPayKoin,
  usePayKoinBalance,
  usePayKoinTopUp,
  usePayKoinTransactions,
} from '../src/hooks/usePayKoin';
import { formatMoney, symbolFor } from '../src/hooks/useCurrency';
import { useTheme } from '../src/theme/ThemeProvider';
import { FONT } from '../src/theme/fonts';

/**
 * Top-up amounts, in **coins**. The backend enforces a minimum it reports as
 * `min_top_up`; its rejection message says "100 USD", but the figure is coins —
 * a copy bug on their side, so this screen says PK and prints the cash cost
 * beside it rather than repeating the server's wording.
 */
const TOP_UP_STEPS = [100, 250, 500, 1000];

/**
 * Activity filters, mirroring the web's chips.
 *
 * Filtered **client-side**: `GET /paykoin/transactions?type=` answers 200 for a
 * nonsense value as readily as a real one, so the param is either ignored or
 * unvalidated and can't be trusted. Move this to the server once it rejects a
 * bad value. The `types` list is matched against each row's `type`.
 */
const FILTERS: { key: string; label: string; types: string[] }[] = [
  { key: 'all', label: 'All', types: [] },
  { key: 'topup', label: 'Top-ups', types: ['topup', 'top_up', 'purchase'] },
  { key: 'sent', label: 'Sent', types: ['gift_sent', 'sent', 'spend'] },
  { key: 'received', label: 'Received', types: ['gift_received', 'received', 'earned'] },
  { key: 'converted', label: 'Converted', types: ['convert', 'conversion', 'converted'] },
];

/**
 * PayKoin — the Payhankey coin used to gift creators, modelled on the web's
 * wallet page.
 *
 * The headline is the **whole** balance; the two figures under it are what it's
 * made of, and the distinction is the point: coins you *bought* can only be
 * spent on gifts, and only coins you were *gifted* can be turned back into
 * money. Showing one number without that split would make the convert action
 * look broken for anyone who had only ever topped up.
 *
 * Only part of the PayKoin API exists so far — balance, top-up, convert and the
 * transaction list are live; sending a gift is not (`POST /gifts/send` 404s for
 * every post). This screen deliberately stops at what the API can actually do.
 */
export default function PayKoinScreen() {
  const { colors, radius, spacing } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { data: balance, isLoading, isError, refetch } = usePayKoinBalance();
  const transactions = usePayKoinTransactions();
  const topUp = usePayKoinTopUp();
  const convert = useConvertPayKoin();

  const [amount, setAmount] = useState(TOP_UP_STEPS[0]);
  const [filter, setFilter] = useState('all');
  const [topUpOpen, setTopUpOpen] = useState(false);

  const rows = useMemo(
    () => transactions.data?.pages.flatMap((page) => page.data.map(toPayKoinTransaction)) ?? [],
    [transactions.data],
  );

  const visibleRows = useMemo(() => {
    const active = FILTERS.find((f) => f.key === filter);
    if (!active || !active.types.length) return rows;
    return rows.filter((row) => active.types.includes(row.type.toLowerCase()));
  }, [rows, filter]);

  if (isLoading) {
    return (
      <View style={[styles.root, styles.center, { backgroundColor: colors.background }]}>
        <ScreenBackground />
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  if (isError || !balance) {
    return (
      <View style={[styles.root, styles.center, { backgroundColor: colors.background }]}>
        <ScreenBackground />
        <Text style={[styles.stateText, { color: colors.textMuted }]}>
          We couldn't load your PayKoin balance.
        </Text>
        <GhostButton label="Retry" onPress={() => void refetch()} />
      </View>
    );
  }

  const symbol = symbolFor(balance.currency);
  const spendable = balance.paykoin_spendable ?? 0;
  const earned = balance.paykoin_earned ?? 0;
  const total = spendable + earned;
  const cost = amount * balance.rates.list;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScreenBackground />
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + spacing.lg,
          paddingBottom: insets.bottom + spacing.xl,
          paddingHorizontal: spacing.xl,
          gap: spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <BackButton onPress={() => router.back()} />
          <Text style={[styles.headerTitle, { color: colors.text }]}>PayKoin</Text>
          <View style={{ width: 44 }} />
        </View>

        {/* The coin card. Dark and gold in both themes, like the web's — PayKoin
            is its own currency, and it should read as a thing apart from the
            fiat balances rather than as one more surface card. */}
        <LinearGradient
          colors={['#241B10', '#171018']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.coinCard, { borderRadius: radius.lg }]}
        >
          <View style={styles.coinHead}>
            <View style={styles.coinBadge}>
              <Text style={styles.coinBadgeText}>PK</Text>
            </View>
            <Text style={styles.coinEyebrow}>PAYKOIN · PAYHANKEY CURRENCY</Text>
          </View>

          <Text style={styles.coinTotal}>{total.toLocaleString()} PK</Text>

          <View style={styles.coinStats}>
            <View style={styles.coinStat}>
              <Text style={styles.coinStatValue}>{spendable.toLocaleString()} PK</Text>
              <Text style={styles.coinStatLabel}>For sending gifts</Text>
            </View>
            <View style={styles.coinStat}>
              <Text style={styles.coinStatValue}>{earned.toLocaleString()} PK</Text>
              <Text style={styles.coinStatLabel}>Earned from gifts</Text>
            </View>
            <View style={styles.coinStat}>
              <Text style={styles.coinStatValue}>
                {formatMoney(balance.rates.list, symbol)} / PK
              </Text>
              <Text style={styles.coinStatLabel}>Top-up rate</Text>
            </View>
          </View>

          <Text style={styles.coinNote}>
            Top-up PayKoin is for sending gifts. Only PK earned from gifts can be converted to
            cash in your wallet.
          </Text>

          <View style={styles.coinActions}>
            <Pressable
              onPress={() => setTopUpOpen((open) => !open)}
              accessibilityRole="button"
              style={[styles.coinPrimary, { borderRadius: radius.pill }]}
            >
              <Ionicons name="add" size={16} color="#1A1206" />
              <Text style={styles.coinPrimaryText}>Top up</Text>
            </Pressable>
            <Pressable
              onPress={() => convert.mutate(earned)}
              // Only gifted coins convert — the server rejects anything else,
              // so at zero the action is unavailable rather than failing.
              disabled={earned <= 0 || convert.isPending}
              accessibilityRole="button"
              accessibilityState={{ disabled: earned <= 0 }}
              style={[
                styles.coinSecondary,
                { borderRadius: radius.pill, opacity: earned > 0 ? 1 : 0.45 },
              ]}
            >
              <Text style={styles.coinSecondaryText}>
                {convert.isPending ? 'Converting…' : 'Convert gift earnings'}
              </Text>
            </Pressable>
          </View>
        </LinearGradient>

        {/* Top-up amounts — folded away until asked for, so the card above stays
            the thing you read first. */}
        {topUpOpen ? (
          <View
            style={[
              styles.panel,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: radius.lg,
              },
            ]}
          >
            <Text style={[styles.panelTitle, { color: colors.text }]}>How much?</Text>
            <View style={styles.stepRow}>
              {TOP_UP_STEPS.map((step) => {
                const active = step === amount;
                return (
                  <Pressable
                    key={step}
                    onPress={() => setAmount(step)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={[
                      styles.step,
                      {
                        backgroundColor: active ? colors.brand : colors.surfaceAlt,
                        borderColor: active ? colors.brand : colors.border,
                        borderRadius: radius.pill,
                      },
                    ]}
                  >
                    <Text
                      style={[styles.stepText, { color: active ? colors.onBrand : colors.text }]}
                    >
                      {step.toLocaleString()}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={[styles.panelNote, { color: colors.textMuted }]}>
              {amount.toLocaleString()} PK costs {formatMoney(cost, symbol)}. Minimum{' '}
              {balance.min_top_up.toLocaleString()} PK.
            </Text>
            <Pressable
              onPress={() => topUp.mutate(amount)}
              disabled={topUp.isPending || amount < balance.min_top_up}
              accessibilityRole="button"
              style={[
                styles.buyButton,
                {
                  backgroundColor: colors.brand,
                  borderRadius: radius.pill,
                  opacity: topUp.isPending || amount < balance.min_top_up ? 0.6 : 1,
                },
              ]}
            >
              <Text style={[styles.buyText, { color: colors.onBrand }]}>
                {topUp.isPending
                  ? 'Opening checkout…'
                  : `Buy ${amount.toLocaleString()} PK · ${formatMoney(cost, symbol)}`}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {/* Activity */}
        <View style={{ gap: spacing.md }}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>PayKoin activity</Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            {FILTERS.map((item) => {
              const active = item.key === filter;
              return (
                <Pressable
                  key={item.key}
                  onPress={() => setFilter(item.key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active ? colors.brand : colors.surface,
                      borderColor: active ? colors.brand : colors.border,
                      borderRadius: radius.pill,
                    },
                  ]}
                >
                  <Text
                    style={[styles.chipText, { color: active ? colors.onBrand : colors.text }]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {transactions.isLoading ? (
            <ActivityIndicator color={colors.brand} />
          ) : visibleRows.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No activity yet</Text>
              <Text style={[styles.stateText, { color: colors.textMuted }]}>
                Top up PayKoin to send gifts on posts.
              </Text>
            </View>
          ) : (
            visibleRows.map((row) => <ActivityRow key={row.id} row={row} />)
          )}

          {transactions.hasNextPage && filter === 'all' ? (
            <GhostButton
              label={transactions.isFetchingNextPage ? 'Loading…' : 'Load more'}
              onPress={() => transactions.fetchNextPage()}
            />
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

/** One movement of coins. */
function ActivityRow({ row }: { row: PayKoinTransaction }) {
  const { colors, radius } = useTheme();
  const debit = (row.coins ?? 0) < 0;
  return (
    <View
      style={[
        styles.txRow,
        { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md },
      ]}
    >
      <View style={styles.txText}>
        <Text style={[styles.txTitle, { color: colors.text }]}>{row.title}</Text>
        <Text style={[styles.txMeta, { color: colors.textMuted }]}>
          {[row.timeAgo, row.status].filter(Boolean).join(' · ')}
        </Text>
      </View>
      {row.coins != null ? (
        <Text style={[styles.txAmount, { color: debit ? colors.pink : colors.mint }]}>
          {row.coins > 0 ? '+' : ''}
          {row.coins.toLocaleString()} PK
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 30 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontFamily: FONT, fontSize: 18, fontWeight: '800' },

  coinCard: { padding: 18, gap: 14 },
  coinHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  coinBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#E8B341',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coinBadgeText: { fontFamily: FONT, color: '#2A1D06', fontSize: 13, fontWeight: '900' },
  coinEyebrow: {
    fontFamily: FONT,
    color: 'rgba(255,255,255,0.55)',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  // FONT, never FONT_MONO: Space Mono has no ₦ glyph, so a naira amount would
  // render its symbol in a different face at a different size.
  coinTotal: { fontFamily: FONT, color: '#FFFFFF', fontSize: 34, fontWeight: '900' },
  coinStats: { flexDirection: 'row', gap: 8 },
  coinStat: {
    flex: 1,
    gap: 3,
    padding: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  coinStatValue: { fontFamily: FONT, color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  coinStatLabel: {
    fontFamily: FONT,
    color: 'rgba(255,255,255,0.55)',
    fontSize: 10.5,
    fontWeight: '700',
  },
  coinNote: {
    fontFamily: FONT,
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11.5,
    fontWeight: '600',
    lineHeight: 17,
  },
  coinActions: { flexDirection: 'row', gap: 10 },
  coinPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    paddingHorizontal: 18,
    backgroundColor: '#E8B341',
  },
  coinPrimaryText: { fontFamily: FONT, color: '#1A1206', fontSize: 13.5, fontWeight: '900' },
  coinSecondary: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  coinSecondaryText: { fontFamily: FONT, color: '#FFFFFF', fontSize: 13, fontWeight: '800' },

  panel: { padding: 16, gap: 12, borderWidth: StyleSheet.hairlineWidth },
  panelTitle: { fontFamily: FONT, fontSize: 14.5, fontWeight: '800' },
  panelNote: { fontFamily: FONT, fontSize: 12.5, fontWeight: '600', lineHeight: 18 },
  stepRow: { flexDirection: 'row', gap: 8 },
  step: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  stepText: { fontFamily: FONT, fontSize: 13, fontWeight: '800' },
  buyButton: { height: 48, alignItems: 'center', justifyContent: 'center' },
  buyText: { fontFamily: FONT, fontSize: 14.5, fontWeight: '800' },

  sectionTitle: { fontFamily: FONT, fontSize: 16, fontWeight: '800' },
  chipRow: { gap: 8, paddingRight: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderWidth: StyleSheet.hairlineWidth },
  chipText: { fontFamily: FONT, fontSize: 12.5, fontWeight: '800' },
  emptyWrap: { alignItems: 'center', gap: 6, paddingVertical: 30 },
  emptyTitle: { fontFamily: FONT, fontSize: 15, fontWeight: '800' },

  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  txText: { flex: 1, gap: 3 },
  txTitle: { fontFamily: FONT, fontSize: 14, fontWeight: '700' },
  txMeta: { fontFamily: FONT, fontSize: 12, fontWeight: '600' },
  txAmount: { fontFamily: FONT, fontSize: 14, fontWeight: '900' },
  stateText: {
    fontFamily: FONT,
    fontSize: 13.5,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
  },
});
