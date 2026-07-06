import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TAB_BAR_CLEARANCE } from '../../src/components/navigation/TabBar';
import { Avatar } from '../../src/components/ui/Avatar';
import { ScreenBackground } from '../../src/components/ui/ScreenBackground';
import { SectionHeader } from '../../src/components/ui/SectionHeader';
import { ThemeToggle } from '../../src/components/ui/ThemeToggle';
import { currentUser, referral } from '../../src/data/community';
import { useTheme } from '../../src/theme/ThemeProvider';

type MenuItem = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub: string;
  /** Route to push once the screen exists; menu rows without one show a Soon badge. */
  route?: string;
};

// Account destinations mapped from the web sidebar. Routes land here as the
// corresponding screens get built (see docs/APP_FLOW.md).
const MENU: MenuItem[] = [
  { icon: 'wallet-outline', label: 'Wallets', sub: 'Balance & withdrawals', route: '/wallet' },
  { icon: 'card-outline', label: 'Bank information', sub: 'Payout account & currency', route: '/bank-info' },
  { icon: 'swap-horizontal-outline', label: 'Transactions', sub: 'Payout & earning history', route: '/transactions' },
  { icon: 'trophy-outline', label: 'Top earners', sub: 'Monthly leaderboard', route: '/top-earners' },
  { icon: 'people-outline', label: 'My referrals', sub: `${referral.total} referral so far`, route: '/referrals' },
  { icon: 'arrow-up-circle-outline', label: 'Upgrade level', sub: 'Creator & Influencer plans', route: '/upgrade' },
  { icon: 'settings-outline', label: 'Settings', sub: 'Profile details & socials', route: '/settings' },
  { icon: 'newspaper-outline', label: 'Blog', sub: 'Tips & product stories', route: '/blog' },
  { icon: 'help-buoy-outline', label: 'How it works', sub: 'Earning explained', route: '/how-it-works' },
];

/**
 * Profile tab — identity card plus the account hub that fans out to the
 * remaining (not yet built) account screens from the web sidebar.
 */
export default function ProfileScreen() {
  const { colors, brand, radius, spacing } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

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
        {/* Identity card — tap through to the full profile (posts + stats) */}
        <Pressable
          onPress={() => router.push(`/member/${currentUser.handle}`)}
          accessibilityRole="button"
          accessibilityLabel="View my profile"
          style={({ pressed }) => [
            styles.identityCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: radius.lg,
              opacity: pressed ? 0.9 : 1,
            },
          ]}
        >
          <LinearGradient
            colors={[brand.violetBright, brand.violet, brand.indigo]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cover}
          />
          <View style={styles.identityBody}>
            <View style={[styles.avatarRing, { borderColor: colors.surface }]}>
              <Avatar name={currentUser.name} tint={currentUser.tint} size={76} />
            </View>
            <Text style={[styles.name, { color: colors.text }]}>{currentUser.name}</Text>
            <Text style={[styles.handle, { color: colors.textMuted }]}>
              @{currentUser.handle} · Basic level
            </Text>
            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Text style={[styles.statValue, { color: colors.text }]}>
                  {currentUser.followers}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Followers</Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
              <View style={styles.stat}>
                <Text style={[styles.statValue, { color: colors.text }]}>
                  {currentUser.following}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Following</Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
              <View style={styles.stat}>
                <Text style={[styles.statValue, { color: colors.text }]}>
                  {currentUser.engagements}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Engagements</Text>
              </View>
            </View>
          </View>
        </Pressable>

        {/* Appearance */}
        <View
          style={[
            styles.appearanceCard,
            { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg },
          ]}
        >
          <SectionHeader title="Appearance" icon="contrast" />
          <ThemeToggle />
        </View>

        {/* Account menu */}
        <View style={{ gap: spacing.md }}>
          <SectionHeader title="Account" icon="person-circle" />
          <View
            style={[
              styles.menuCard,
              { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg },
            ]}
          >
            {MENU.map((item, index) => (
              <Pressable
                key={item.label}
                disabled={!item.route}
                onPress={() => item.route && router.push(item.route as never)}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                style={({ pressed }) => [
                  styles.menuRow,
                  index > 0 && {
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: colors.border,
                  },
                  { opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <View style={[styles.menuIcon, { backgroundColor: colors.surfaceAlt }]}>
                  <Ionicons name={item.icon} size={19} color={colors.brand} />
                </View>
                <View style={styles.menuText}>
                  <Text style={[styles.menuLabel, { color: colors.text }]}>{item.label}</Text>
                  <Text style={[styles.menuSub, { color: colors.textMuted }]}>{item.sub}</Text>
                </View>
                {item.route ? (
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                ) : (
                  <View style={[styles.soonPill, { backgroundColor: colors.surfaceAlt }]}>
                    <Text style={[styles.soonText, { color: colors.textMuted }]}>Soon</Text>
                  </View>
                )}
              </Pressable>
            ))}
          </View>
        </View>

        {/* Log out */}
        <Pressable
          onPress={() => router.replace('/')}
          accessibilityRole="button"
          accessibilityLabel="Log out"
          style={({ pressed }) => [
            styles.logout,
            {
              borderColor: `${colors.pink}55`,
              backgroundColor: `${colors.pink}0F`,
              borderRadius: radius.pill,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Ionicons name="log-out-outline" size={19} color={colors.pink} />
          <Text style={[styles.logoutText, { color: colors.pink }]}>Log out</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  identityCard: {
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  cover: { height: 96 },
  identityBody: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    marginTop: -38,
    gap: 3,
  },
  avatarRing: {
    borderWidth: 4,
    borderRadius: 42,
    marginBottom: 6,
  },
  name: { fontSize: 21, fontWeight: '800' },
  handle: { fontSize: 13, fontWeight: '600' },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    gap: 18,
  },
  stat: { alignItems: 'center', gap: 1, minWidth: 72 },
  statValue: { fontSize: 18, fontWeight: '900' },
  statLabel: { fontSize: 12, fontWeight: '600' },
  statDivider: { width: StyleSheet.hairlineWidth, height: 26 },
  appearanceCard: {
    padding: 18,
    gap: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  menuCard: {
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
  },
  menuIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuText: { flex: 1, gap: 1 },
  menuLabel: { fontSize: 15, fontWeight: '700' },
  menuSub: { fontSize: 12, fontWeight: '500' },
  soonPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  soonText: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  logout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderWidth: 1,
  },
  logoutText: { fontSize: 15, fontWeight: '800' },
});
