import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BoostCampaignPanel } from '../../../src/components/analytics/BoostCampaignPanel';
import { GhostButton } from '../../../src/components/ui/GhostButton';
import { ScreenBackground } from '../../../src/components/ui/ScreenBackground';
import { usePostBoost } from '../../../src/hooks/useBoost';
import { formatMoney, resolveSymbol, useCurrency } from '../../../src/hooks/useCurrency';
import { usePostAnalytics } from '../../../src/hooks/useTimeline';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { brand } from '../../../src/theme/colors';
import { FONT } from '../../../src/theme/fonts';

/**
 * Per-post analytics — the mobile version of the web's
 * `/post/timeline/{id}/analytics` page, in the web's two tabs:
 *
 * - **Boost campaign** — the post's ad campaign, from `GET /boosts` (to find
 *   it) + `GET /boosts/{id}` (its click breakdown). See `BoostCampaignPanel`.
 * - **Creator monetization** — `GET /timeline/post/{id}/analytics`.
 *   Everything there is the server's: the monetized/unmonetized split (which
 *   the client could never have derived), the per-metric revenue, and the
 *   currency symbol the money is printed with. It still says *estimated*
 *   because the API does — payouts settle at month end.
 *
 * `?tab=boost` opens on the campaign — it's what the "Post Boost Activated"
 * notification and the boost strip's Manage link send. Without it the screen
 * opens on monetization, what "View analytics" in the post menu is for.
 *
 * The web page ends with the full plan checkout; on mobile the plan cards live
 * on /upgrade only, so this screen links there instead of duplicating them.
 */

type AnalyticsTab = 'boost' | 'monetization';

export default function PostAnalyticsScreen() {
  const { id, tab: tabParam } = useLocalSearchParams<{
    id: string;
    tab?: string;
  }>();
  const { colors, radius, spacing } = useTheme();
  const { symbol: accountSymbol } = useCurrency();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [tab, setTab] = useState<AnalyticsTab>(tabParam === 'boost' ? 'boost' : 'monetization');

  const query = usePostAnalytics(id);
  const data = query.data;
  const boost = usePostBoost(id);
  const liveCampaign = boost.campaign && !boost.campaign.isComplete ? boost.campaign : undefined;
  const isBasic = data?.post.account_level?.toLowerCase() === 'basic';

  // Money prints in the symbol the endpoint sent, falling back to the account's
  // — a post's earnings must never be relabelled into another currency.
  const symbol = resolveSymbol(data?.summary.currencySymbol) ?? accountSymbol;
  const format = (amount: number) => formatMoney(amount, symbol);

  const stats = data?.stats;
  const summary = data?.summary;
  const monetizedEngagement = stats?.monetized_engagement ?? 0;

  const tile = (
    icon: keyof typeof Ionicons.glyphMap,
    tint: string,
    value: string,
    label: string,
  ) => (
    <View
      key={label}
      style={[
        styles.tile,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: radius.lg,
        },
      ]}
    >
      <View style={[styles.tileIcon, { backgroundColor: `${tint}1A` }]}>
        <Ionicons name={icon} size={17} color={tint} />
      </View>
      <Text style={[styles.tileValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.tileLabel, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );

  const cell = (value: string, label: string) => (
    <View
      key={label}
      style={[styles.cell, { backgroundColor: colors.surfaceAlt, borderRadius: radius.md }]}
    >
      <Text style={[styles.cellValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.cellLabel, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );

  const breakdownRow = (label: string, sub: string, amount: number) => (
    <View key={label} style={[styles.breakRow, { borderBottomColor: colors.border }]}>
      <Text style={[styles.breakLabel, { color: colors.text }]}>
        {label} <Text style={{ color: colors.textMuted, fontWeight: '500' }}>{sub}</Text>
      </Text>
      <Text style={[styles.breakAmount, { color: colors.brand }]}>{format(amount)}</Text>
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScreenBackground />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + spacing.md,
          paddingHorizontal: spacing.lg,
          paddingBottom: insets.bottom + spacing.xl,
          gap: spacing.lg,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back to post"
          style={styles.backRow}
        >
          <Ionicons name="arrow-back" size={18} color={colors.textMuted} />
          <Text style={[styles.backText, { color: colors.textMuted }]}>Back to post</Text>
        </Pressable>

        {/* This screen has no local fallback to render any more — every figure
            comes from the endpoint, so say what's happening rather than paint a
            page of zeros. */}
        {query.isLoading ? (
          <View style={styles.stateWrap}>
            <ActivityIndicator color={colors.brand} />
            <Text style={[styles.cellLabel, { color: colors.textMuted }]}>Loading analytics…</Text>
          </View>
        ) : null}

        {query.isError ? (
          <View
            style={[
              styles.groupCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: radius.lg,
              },
            ]}
          >
            <Text style={[styles.groupTitle, { color: colors.text }]}>Couldn't load analytics</Text>
            <Text style={[styles.cellLabel, { color: colors.textMuted }]}>
              Check your connection and try again.
            </Text>
            <GhostButton label="Retry" onPress={() => void query.refetch()} />
          </View>
        ) : null}

        {/* Hero */}
        <LinearGradient
          colors={[brand.violetBright, brand.violet]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { borderRadius: radius.lg }]}
        >
          <Text style={styles.heroEyebrow}>PERFORMANCE & AD INTELLIGENCE</Text>
          <Text style={styles.heroTitle}>Post Analytics</Text>
          <Text style={styles.heroSub}>
            Reach, guaranteed click delivery across Payhankey & partner websites, and what this post
            has earned.
          </Text>
          <View style={styles.heroBadges}>
            {data?.post.account_level ? (
              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeText}>
                  {data.post.account_level.toUpperCase()} ACCOUNT
                </Text>
              </View>
            ) : null}
            {/* Basic is the one level without content monetization (see
                PostBoostStrip), so the web flags it on this page. */}
            {isBasic ? (
              <View style={[styles.heroBadge, { backgroundColor: colors.gold }]}>
                <Text style={[styles.heroBadgeText, { color: '#1A1300' }]}>
                  MONETIZATION PAUSED
                </Text>
              </View>
            ) : null}
            {liveCampaign ? (
              <View style={[styles.heroBadge, { backgroundColor: colors.mint }]}>
                <Text style={[styles.heroBadgeText, { color: '#032014' }]}>
                  {liveCampaign.isPaused ? 'BOOST PAUSED' : 'ACTIVE BOOST CAMPAIGN'}
                </Text>
              </View>
            ) : null}
          </View>
          {data ? (
            <View style={styles.heroQuote}>
              <Text style={styles.heroQuoteText} numberOfLines={3}>
                {data.post.content}
              </Text>
            </View>
          ) : null}
          <Text style={styles.heroMeta}>
            {data ? `Posted ${data.post.posted_ago}` : 'Loading…'}
            {'   '}
            {monetizedEngagement} monetized engagement
            {monetizedEngagement === 1 ? '' : 's'}
          </Text>
          <View style={styles.heroActions}>
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="View post"
              style={styles.heroBtn}
            >
              <Text style={styles.heroBtnText}>View post</Text>
            </Pressable>
            <Pressable
              onPress={() => router.replace('/home')}
              accessibilityRole="button"
              accessibilityLabel="Back to feed"
              style={styles.heroBtn}
            >
              <Text style={styles.heroBtnText}>Back to feed</Text>
            </Pressable>
          </View>
        </LinearGradient>

        {/* The web's two tabs. */}
        <View
          style={[
            styles.tabs,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: radius.lg,
            },
          ]}
          accessibilityRole="tablist"
        >
          {(
            [
              { key: 'boost', label: 'Boost campaign', icon: 'rocket-outline' },
              {
                key: 'monetization',
                label: 'Creator monetization',
                icon: 'stats-chart-outline',
              },
            ] as const
          ).map((item) => {
            const active = tab === item.key;
            return (
              <Pressable
                key={item.key}
                onPress={() => setTab(item.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                style={[
                  styles.tab,
                  {
                    borderRadius: radius.md,
                    backgroundColor: active ? `${colors.brand}14` : 'transparent',
                    borderColor: active ? colors.brand : 'transparent',
                  },
                ]}
              >
                <Ionicons
                  name={item.icon}
                  size={15}
                  color={active ? colors.brand : colors.textMuted}
                />
                <Text
                  style={[styles.tabText, { color: active ? colors.brand : colors.textMuted }]}
                  numberOfLines={1}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {tab === 'boost' ? (
          <BoostCampaignPanel
            postId={id}
            campaign={boost.campaign}
            detail={boost.detail}
            isLoading={boost.isLoading}
            isError={boost.isError}
            onRetry={() => void boost.refetch()}
          />
        ) : (
          <>
            {/* Estimated total */}
            <View style={[styles.totalCard, { borderRadius: radius.lg }]}>
              <Text style={styles.totalEyebrow}>ESTIMATED TOTAL EARNINGS</Text>
              <Text style={[styles.totalValue, { color: colors.mintBright }]}>
                {format(summary?.estimated_total_earnings ?? 0)}
              </Text>
              <Text style={styles.totalSplit}>
                Views {format(summary?.earnings_breakdown.views ?? 0)} · Likes{' '}
                {format(summary?.earnings_breakdown.likes ?? 0)} · Comments{' '}
                {format(summary?.earnings_breakdown.comments ?? 0)}
              </Text>
            </View>

            {/* Headline tiles */}
            <View style={styles.tileGrid}>
              {tile('eye-outline', colors.brand, String(stats?.total_views ?? 0), 'Total views')}
              {tile(
                'heart-outline',
                colors.mint,
                String(stats?.monetized_likes ?? 0),
                'Monetized likes',
              )}
              {tile(
                'chatbubble-outline',
                colors.pink,
                String(stats?.total_comments ?? 0),
                'Total comments',
              )}
              {tile(
                'trending-up',
                colors.gold,
                String(monetizedEngagement),
                'Monetized engagement',
              )}
            </View>

            {/* Per-metric breakdowns */}
            {[
              { title: 'Views', metric: data?.views },
              { title: 'Likes', metric: data?.likes },
              { title: 'Comments', metric: data?.comments },
            ].map((group) => (
              <View
                key={group.title}
                style={[
                  styles.groupCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderRadius: radius.lg,
                  },
                ]}
              >
                <Text style={[styles.groupTitle, { color: colors.text }]}>{group.title}</Text>
                <View style={styles.cellRow}>
                  {cell(String(group.metric?.monetized ?? 0), 'Monetized')}
                  {cell(String(group.metric?.unmonetized ?? 0), 'Unmonetized')}
                  {cell(String(group.metric?.total ?? 0), 'Total')}
                  {cell(format(group.metric?.revenue ?? 0), 'Revenue')}
                </View>
              </View>
            ))}

            {/* Revenue breakdown */}
            <View
              style={[
                styles.groupCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderRadius: radius.lg,
                },
              ]}
            >
              <Text style={[styles.groupTitle, { color: colors.text }]}>Revenue breakdown</Text>
              {(data?.revenue_breakdown ?? []).map((row) =>
                breakdownRow(row.label, `${row.monetized_count} monetized`, row.revenue),
              )}
              <Text style={[styles.footnote, { color: colors.textMuted }]}>
                Figures are estimates based on current monetized engagement. Final payout may differ
                after validation.
              </Text>
            </View>

            <Pressable
              onPress={() => router.push('/upgrade')}
              accessibilityRole="button"
              accessibilityLabel="Choose your creator plan"
              style={({ pressed }) => [
                styles.upgradeRow,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderRadius: radius.lg,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <View style={[styles.tileIcon, { backgroundColor: `${colors.brand}1A` }]}>
                <Ionicons name="arrow-up-circle-outline" size={19} color={colors.brand} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.groupTitle, { color: colors.text }]}>Earn more per post</Text>
                <Text style={[styles.cellLabel, { color: colors.textMuted }]}>
                  Compare Creator & Influencer plans
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stateWrap: { alignItems: 'center', gap: 12, paddingVertical: 24 },
  backText: { fontFamily: FONT, fontSize: 14, fontWeight: '700' },
  hero: { padding: 20, gap: 8 },
  heroEyebrow: {
    fontFamily: FONT,
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  heroTitle: {
    fontFamily: FONT,
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
  },
  heroSub: {
    fontFamily: FONT,
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  heroBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tabs: {
    flexDirection: 'row',
    gap: 6,
    padding: 5,
    borderWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderWidth: 1,
  },
  tabText: { fontFamily: FONT, fontSize: 13, fontWeight: '800', flexShrink: 1 },
  heroBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  heroBadgeText: {
    fontFamily: FONT,
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  heroQuote: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: 10,
    padding: 12,
    marginTop: 2,
  },
  heroQuoteText: {
    fontFamily: FONT,
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '600',
  },
  heroMeta: {
    fontFamily: FONT,
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
    fontWeight: '600',
  },
  heroActions: { flexDirection: 'row', gap: 10, marginTop: 6 },
  heroBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  heroBtnText: {
    fontFamily: FONT,
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  totalCard: { backgroundColor: '#141024', padding: 20, gap: 4 },
  totalEyebrow: {
    fontFamily: FONT,
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  // Not Space Mono: it has no ₦ glyph, so the symbol fell back to another
  // font and rendered smaller than the digits beside it.
  totalValue: { fontFamily: FONT, fontSize: 30, fontWeight: '800' },
  totalSplit: {
    fontFamily: FONT,
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '600',
  },
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: {
    width: '47.8%',
    flexGrow: 1,
    padding: 14,
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
  },
  tileIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileValue: { fontFamily: FONT, fontSize: 22, fontWeight: '900' },
  tileLabel: { fontFamily: FONT, fontSize: 12, fontWeight: '600' },
  groupCard: { padding: 16, gap: 12, borderWidth: StyleSheet.hairlineWidth },
  groupTitle: { fontFamily: FONT, fontSize: 15, fontWeight: '800' },
  cellRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: {
    width: '47.5%',
    flexGrow: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 2,
  },
  cellValue: { fontFamily: FONT, fontSize: 17, fontWeight: '800' },
  cellLabel: { fontFamily: FONT, fontSize: 11, fontWeight: '600' },
  breakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  breakLabel: { fontFamily: FONT, fontSize: 14, fontWeight: '700' },
  breakAmount: { fontFamily: FONT, fontSize: 14, fontWeight: '800' },
  footnote: {
    fontFamily: FONT,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '500',
  },
  upgradeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
