import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackButton } from '../src/components/ui/BackButton';
import { ScreenBackground } from '../src/components/ui/ScreenBackground';
import { transactions } from '../src/data/community';
import { useTheme } from '../src/theme/ThemeProvider';

/** Transactions — full payout & referral history (web "Transaction" table). */
export default function TransactionsScreen() {
  const { colors, radius, spacing } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

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
          flexGrow: 1,
        }}
      >
        <View style={styles.headerRow}>
          <BackButton onPress={() => router.back()} />
          <Text style={[styles.headerTitle, { color: colors.text }]}>Transactions</Text>
          <View style={{ width: 44 }} />
        </View>

        {transactions.length === 0 ? (
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceAlt }]}>
              <Ionicons name="receipt-outline" size={34} color={colors.brand} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No transactions yet</Text>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              Payouts land here once your engagement is validated at month end.
            </Text>
          </View>
        ) : (
          <View style={{ gap: spacing.md }}>
            {transactions.map((tx) => (
              <View
                key={tx.id}
                style={[
                  styles.card,
                  { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md },
                ]}
              >
                <View style={[styles.icon, { backgroundColor: `${colors.mint}1A` }]}>
                  <Ionicons
                    name={tx.kind === 'payout' ? 'cash-outline' : 'gift-outline'}
                    size={18}
                    color={colors.mint}
                  />
                </View>
                <View style={styles.body}>
                  <Text style={[styles.description, { color: colors.text }]}>
                    {tx.description}
                  </Text>
                  <Text style={[styles.reference, { color: colors.textMuted }]}>
                    {tx.reference} · {tx.date}
                  </Text>
                </View>
                <View style={styles.trailing}>
                  <Text style={[styles.amount, { color: colors.mint }]}>
                    +₦{tx.amount.toLocaleString()}
                  </Text>
                  <View
                    style={[
                      styles.statusPill,
                      {
                        backgroundColor:
                          tx.status === 'paid' ? `${colors.mint}1A` : `${colors.gold}1A`,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        { color: tx.status === 'paid' ? colors.mint : colors.gold },
                      ]}
                    >
                      {tx.status}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
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
  body: { flex: 1, gap: 3 },
  description: { fontSize: 14, fontWeight: '700' },
  reference: { fontSize: 11, fontWeight: '500' },
  trailing: { alignItems: 'flex-end', gap: 5 },
  amount: { fontSize: 15, fontWeight: '800' },
  statusPill: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingBottom: 80,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: { fontSize: 17, fontWeight: '800' },
  emptyText: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
    textAlign: 'center',
    maxWidth: 260,
  },
});
