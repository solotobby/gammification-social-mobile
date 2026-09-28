import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Payout } from '../src/api/account';
import { BackButton } from '../src/components/ui/BackButton';
import { GhostButton } from '../src/components/ui/GhostButton';
import { ScreenBackground } from '../src/components/ui/ScreenBackground';
import { usePayouts } from '../src/hooks/useAccount';
import { useCurrency } from '../src/hooks/useCurrency';
import { useTheme } from '../src/theme/ThemeProvider';
import { FONT } from '../src/theme/fonts';

/**
 * The server's `?status=` values. "Queued" is the one the collection shows;
 * "Paid" matches the `total_paid` aggregate beside it. `undefined` is every
 * payout, which is what the endpoint answers with no param at all.
 */
const FILTERS: { label: string; status?: string }[] = [
  { label: 'All' },
  { label: 'Queued', status: 'Queued' },
  { label: 'Paid', status: 'Paid' },
];

/**
 * Payout history — GET /user/payouts, the dedicated withdrawals endpoint.
 *
 * `/wallet` shows the first page of this under its balances; this is the whole
 * list, filterable by status on the server (each filter is its own query key,
 * so switching back is instant). The paid / queued totals come from the
 * response's `summary`, which repeats on every page and ignores the filter, so
 * they're read from the first page rather than summed from rows that may not
 * all be loaded.
 *
 * Every test account has an empty list, so the row fields are inference (see
 * `fetchPayouts`); the screen is built to read right with nothing in it.
 */
export default function PayoutsScreen() {
  const { colors, radius, spacing } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { format } = useCurrency();

  const [filter, setFilter] = useState(FILTERS[0]);
  const query = usePayouts(filter.status);
  const payouts = useMemo(
    () => (query.data?.pages ?? []).flatMap((page) => page.payouts),
    [query.data],
  );
  const summary = query.data?.pages[0];

  const [refreshing, setRefreshing] = useState(false);
  const { refetch, hasNextPage, isFetchingNextPage, fetchNextPage } = query;
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);
  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const tone = (state: Payout['state']) =>
    state === 'paid'
      ? colors.mint
      : state === 'failed'
        ? colors.pink
        : state === 'processing'
          ? colors.brand
          : colors.gold;

  const header = (
    <View style={{ gap: spacing.lg, marginBottom: spacing.md }}>
      <View style={styles.headerRow}>
        <BackButton onPress={() => router.back()} />
        <Text style={[styles.headerTitle, { color: colors.text }]}>Payout history</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.totals}>
        {[
          {
            label: 'Paid out',
            value: summary?.totalPaid ?? 0,
            color: colors.mint,
            icon: 'checkmark-circle' as const,
          },
          {
            label: 'Queued',
            value: summary?.totalQueued ?? 0,
            color: colors.gold,
            icon: 'time' as const,
          },
        ].map((total) => (
          <View
            key={total.label}
            style={[
              styles.total,
              { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md },
            ]}
          >
            <View style={[styles.totalIcon, { backgroundColor: `${total.color}1A` }]}>
              <Ionicons name={total.icon} size={16} color={total.color} />
            </View>
            <Text style={[styles.totalValue, { color: colors.text }]}>
              {query.isLoading ? '—' : format(total.value)}
            </Text>
            <Text style={[styles.totalLabel, { color: colors.textMuted }]}>{total.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.chips}>
        {FILTERS.map((option) => {
          const active = option.label === filter.label;
          return (
            <Pressable
              key={option.label}
              onPress={() => setFilter(option)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[
                styles.chip,
                active
                  ? { backgroundColor: colors.brand, borderColor: colors.brand }
                  : { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.chipText, { color: active ? colors.onBrand : colors.text }]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  const empty = query.isLoading ? (
    <ActivityIndicator color={colors.brand} style={{ paddingVertical: 48 }} />
  ) : query.isError ? (
    <View style={styles.empty}>
      <Text style={[styles.emptyText, { color: colors.textMuted }]}>
        We couldn't load your payouts.
      </Text>
      <GhostButton label="Retry" onPress={() => void refetch()} />
    </View>
  ) : (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceAlt }]}>
        <Ionicons name="cash-outline" size={34} color={colors.brand} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>
        {filter.status ? `No ${filter.label.toLowerCase()} payouts` : 'No payouts yet'}
      </Text>
      <Text style={[styles.emptyText, { color: colors.textMuted }]}>
        Once you withdraw from your wallet, each payout shows here with its status
        until it lands in your account.
      </Text>
      <GhostButton label="Go to wallet" onPress={() => router.push('/wallet')} />
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScreenBackground />
      <FlatList
        data={payouts}
        keyExtractor={(payout) => payout.id}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />
        }
        ListFooterComponent={
          isFetchingNextPage ? (
            <ActivityIndicator color={colors.brand} style={{ paddingVertical: 20 }} />
          ) : null
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + spacing.lg,
          paddingBottom: insets.bottom + spacing.xl,
          paddingHorizontal: spacing.xl,
          flexGrow: 1,
        }}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        renderItem={({ item }) => (
          <View
            style={[
              styles.row,
              { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md },
            ]}
          >
            <View style={[styles.rowIcon, { backgroundColor: `${tone(item.state)}1A` }]}>
              <Ionicons name="arrow-up-outline" size={18} color={tone(item.state)} />
            </View>
            <View style={styles.rowBody}>
              <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
                {item.description}
              </Text>
              <Text style={[styles.rowMeta, { color: colors.textMuted }]} numberOfLines={1}>
                {[item.date, item.reference].filter(Boolean).join(' · ')}
              </Text>
            </View>
            <View style={styles.rowTrailing}>
              <Text style={[styles.rowAmount, { color: colors.text }]}>
                {item.formatted ?? format(item.amount)}
              </Text>
              <View style={[styles.statusPill, { backgroundColor: `${tone(item.state)}1A` }]}>
                <Text style={[styles.statusText, { color: tone(item.state) }]}>
                  {item.status || item.state}
                </Text>
              </View>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontFamily: FONT, fontSize: 18, fontWeight: '800' },
  totals: { flexDirection: 'row', gap: 10 },
  total: { flex: 1, padding: 14, borderWidth: 1, gap: 4 },
  totalIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  totalValue: { fontFamily: FONT, fontSize: 20, fontWeight: '800' },
  totalLabel: { fontFamily: FONT, fontSize: 12, fontWeight: '600' },
  chips: { flexDirection: 'row', gap: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1 },
  chipText: { fontFamily: FONT, fontSize: 13, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderWidth: 1 },
  rowIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1, gap: 3 },
  rowTitle: { fontFamily: FONT, fontSize: 14, fontWeight: '700' },
  rowMeta: { fontFamily: FONT, fontSize: 11, fontWeight: '500' },
  rowTrailing: { alignItems: 'flex-end', gap: 5 },
  rowAmount: { fontFamily: FONT, fontSize: 15, fontWeight: '800' },
  statusPill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 },
  statusText: {
    fontFamily: FONT,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 48 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: { fontFamily: FONT, fontSize: 17, fontWeight: '800' },
  emptyText: {
    fontFamily: FONT,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
    textAlign: 'center',
    maxWidth: 270,
    marginBottom: 6,
  },
});
