import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '../src/components/ui/Avatar';
import { BackButton } from '../src/components/ui/BackButton';
import { CopyField } from '../src/components/ui/CopyField';
import { GhostButton } from '../src/components/ui/GhostButton';
import { ScreenBackground } from '../src/components/ui/ScreenBackground';
import { SectionHeader } from '../src/components/ui/SectionHeader';
import { useReferrals } from '../src/hooks/useAccount';
import { useMyReferral } from '../src/hooks/useMe';
import { useTheme } from '../src/theme/ThemeProvider';

function TotalCard({ label, value }: { label: string; value: string }) {
  const { colors, radius } = useTheme();
  return (
    <View
      style={[
        styles.totalCard,
        { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md },
      ]}
    >
      <Text style={[styles.totalValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.totalLabel, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

/**
 * My referrals — totals, the referral link, and everyone who joined with it,
 * from GET /user/referrals. The link itself comes from the signed-in user's own
 * referral code rather than this endpoint, so it renders even if the list
 * request fails.
 */
export default function ReferralsScreen() {
  const { colors, radius, spacing } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { link } = useMyReferral();

  const query = useReferrals();
  const referredUsers = query.data?.users ?? [];

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
          <Text style={[styles.headerTitle, { color: colors.text }]}>My referrals</Text>
          <View style={{ width: 44 }} />
        </View>

        {/* Totals */}
        <View style={styles.totalsRow}>
          <TotalCard
            label="Total referrals"
            value={(query.data?.total ?? 0).toLocaleString()}
          />
          <TotalCard
            label="This month"
            value={(query.data?.thisMonth ?? 0).toLocaleString()}
          />
        </View>

        <CopyField label="Your referral link" value={link ?? 'Loading…'} icon="link-outline" />

        {/* How it pays */}
        <View
          style={[
            styles.payBanner,
            { backgroundColor: `${colors.mint}14`, borderColor: `${colors.mint}40`, borderRadius: radius.md },
          ]}
        >
          <Ionicons name="gift-outline" size={20} color={colors.mint} />
          <Text style={[styles.payText, { color: colors.text }]}>
            Every friend who joins with your link pays you a{' '}
            <Text style={styles.payBold}>referral bonus</Text> — and their engagement boosts
            yours.
          </Text>
        </View>

        {/* Referred users */}
        <View style={{ gap: spacing.md }}>
          <SectionHeader title="People you referred" icon="people" />
          {query.isLoading ? (
            <ActivityIndicator color={colors.brand} style={{ paddingVertical: 28 }} />
          ) : query.isError ? (
            <View
              style={[
                styles.emptyCard,
                { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg },
              ]}
            >
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                We couldn't load your referrals.
              </Text>
              <GhostButton label="Retry" onPress={() => void query.refetch()} />
            </View>
          ) : referredUsers.length === 0 ? (
            <View
              style={[
                styles.emptyCard,
                { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg },
              ]}
            >
              <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceAlt }]}>
                <Ionicons name="person-add-outline" size={28} color={colors.brand} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No referrals yet</Text>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                Share your link above — your first bonus lands as soon as someone joins.
              </Text>
            </View>
          ) : (
            <View
              style={[
                styles.listCard,
                { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg },
              ]}
            >
              {referredUsers.map((user, index) => (
                <View
                  key={user.id}
                  style={[
                    styles.userRow,
                    index > 0 && {
                      borderTopWidth: StyleSheet.hairlineWidth,
                      borderTopColor: colors.border,
                    },
                  ]}
                >
                  <Avatar name={user.name} tint={user.tint} size={44} />
                  <View style={styles.userText}>
                    <Text style={[styles.userName, { color: colors.text }]} numberOfLines={1}>
                      {user.name}
                    </Text>
                    <Text style={[styles.userMeta, { color: colors.textMuted }]}>
                      {[user.handle && `@${user.handle}`, user.joined && `joined ${user.joined}`]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </View>
                  {user.earned > 0 ? (
                    <Text style={[styles.userEarned, { color: colors.mint }]}>
                      +₦{user.earned.toLocaleString()}
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          )}
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
  totalsRow: { flexDirection: 'row', gap: 12 },
  totalCard: {
    flex: 1,
    padding: 16,
    gap: 2,
    borderWidth: StyleSheet.hairlineWidth,
  },
  totalValue: { fontSize: 28, fontWeight: '900' },
  totalLabel: { fontSize: 12, fontWeight: '700' },
  payBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderWidth: 1,
  },
  payText: { flex: 1, fontSize: 13, lineHeight: 19, fontWeight: '500' },
  payBold: { fontWeight: '800' },
  listCard: {
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
  },
  userText: { flex: 1, gap: 2 },
  userName: { fontSize: 15, fontWeight: '800' },
  userMeta: { fontSize: 12, fontWeight: '600' },
  userEarned: { fontSize: 15, fontWeight: '800' },
  emptyCard: {
    alignItems: 'center',
    gap: 8,
    padding: 28,
    borderWidth: StyleSheet.hairlineWidth,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  emptyTitle: { fontSize: 16, fontWeight: '800' },
  emptyText: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
    textAlign: 'center',
    maxWidth: 260,
  },
});
