import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import type { BoostBreakdownRow, BoostCampaign, BoostDetail } from '../../api/boost';
import { useToggleBoost } from '../../hooks/useBoost';
import { useCurrency } from '../../hooks/useCurrency';
import { usePayKoinBalance } from '../../hooks/usePayKoin';
import { useTheme } from '../../theme/ThemeProvider';
import { FONT } from '../../theme/fonts';
import { GhostButton } from '../ui/GhostButton';
import { GradientButton } from '../ui/GradientButton';

/**
 * The "Boost Campaign" tab of a post's analytics — the mobile port of the
 * web's `/post/timeline/{id}/analytics?tab=boost`.
 *
 * **Only what the API reports is drawn.** `GET /boosts/{id}` gives the
 * campaign (clicks bought / delivered / remaining, cost, CTA, target,
 * networks) and a count of recorded clicks by device, browser and network.
 * The web page also shows ad impressions, CTR, top locations, a click log and
 * a clicks-over-time chart; none of those has an endpoint (every plausible
 * route 404s — see `ApiBoostDetail`), so they are left out rather than
 * approximated. Same rule as per-post earnings: no invented figures on a
 * screen about money.
 *
 * Nor is the web's "Extend Boost (+ Clicks)" reproduced: there is no extend
 * endpoint, and the boost screen refuses a post that already has a campaign.
 */
export function BoostCampaignPanel({
  postId,
  campaign,
  detail,
  isLoading,
  isError,
  onRetry,
}: {
  postId: string;
  campaign: BoostCampaign | undefined;
  detail: BoostDetail | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  const { colors, radius } = useTheme();
  const router = useRouter();
  const { format } = useCurrency();
  const toggle = useToggleBoost();
  // Coins → money at the PayKoin top-up rate: what the coins were actually
  // bought at. NOT the boost config's `fiat_per_pk`, which is hard-coded to
  // naira (see `BoostConfig.fiatPerCoin`).
  const fiatPerCoin = usePayKoinBalance().data?.rates?.list;
  const inMoney = (coins: number | null | undefined) =>
    coins != null && fiatPerCoin ? format(coins * fiatPerCoin) : null;

  const card = [
    styles.card,
    { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg },
  ];

  if (!campaign && isLoading) {
    return (
      <View style={styles.state}>
        <ActivityIndicator color={colors.brand} />
        <Text style={[styles.muted, { color: colors.textMuted }]}>Loading campaign…</Text>
      </View>
    );
  }

  if (!campaign && isError) {
    return (
      <View style={card}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Couldn't load this campaign</Text>
        <Text style={[styles.muted, { color: colors.textMuted }]}>
          Check your connection and try again.
        </Text>
        <GhostButton label="Retry" onPress={onRetry} />
      </View>
    );
  }

  if (!campaign) {
    return (
      <View style={[card, styles.emptyCard]}>
        <View style={[styles.emptyOrb, { backgroundColor: `${colors.brand}14` }]}>
          <Ionicons name="rocket-outline" size={28} color={colors.brand} />
        </View>
        <Text style={[styles.cardTitle, { color: colors.text, textAlign: 'center' }]}>
          This post isn't boosted
        </Text>
        <Text style={[styles.muted, { color: colors.textMuted, textAlign: 'center' }]}>
          Boost it to buy guaranteed clicks from the Payhankey feed and partner websites. Its
          campaign analytics will show up here.
        </Text>
        <GradientButton
          label="Boost this post"
          icon="rocket-outline"
          onPress={() => router.push(`/post/${postId}/boost`)}
        />
      </View>
    );
  }

  const statusLabel = campaign.isComplete
    ? 'COMPLETED'
    : campaign.isPaused
      ? 'PAUSED'
      : 'ACTIVE CAMPAIGN';
  const statusTint = campaign.isComplete ? '#FFFFFF' : campaign.isPaused ? colors.gold : colors.mintBright;
  const networks = [
    campaign.onPayhankey ? 'Payhankey Feed' : null,
    campaign.onPartners ? 'Partner Websites' : null,
  ]
    .filter(Boolean)
    .join(' & ');
  const rateMoney = inMoney(campaign.coinsPerClick);
  const pct = Math.round(campaign.progress * 100);
  const clicksRecorded = detail?.clicksRecorded ?? campaign.clicksDelivered;

  return (
    <View style={styles.wrap}>
      {/* Campaign hero — what was bought and how much of it has landed. */}
      <LinearGradient
        colors={['#2A1470', '#4A22B8']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, { borderRadius: radius.lg }]}
      >
        <View style={styles.heroTop}>
          <View style={styles.statusPill}>
            <View style={[styles.statusDot, { backgroundColor: statusTint }]} />
            <Text style={[styles.statusText, { color: statusTint }]}>{statusLabel}</Text>
          </View>
          {campaign.coinsPerClick != null ? (
            <Text style={styles.rate}>
              <Text style={styles.rateStrong}>
                {formatCoins(campaign.coinsPerClick)} PK{rateMoney ? ` (${rateMoney})` : ''}
              </Text>{' '}
              / click
            </Text>
          ) : null}
        </View>

        <Text style={styles.heroTitle}>
          {campaign.clicksDelivered.toLocaleString()} of {campaign.clicksBought.toLocaleString()}{' '}
          guaranteed clicks delivered
        </Text>

        <View style={styles.heroFacts}>
          {campaign.targetUrl ? (
            <Text style={styles.heroFact} numberOfLines={1}>
              Target:{' '}
              <Text
                style={styles.heroLink}
                onPress={() => void Linking.openURL(campaign.targetUrl!).catch(() => undefined)}
              >
                {campaign.targetUrl.replace(/^https?:\/\//, '')}
              </Text>
            </Text>
          ) : null}
          <Text style={styles.heroFact}>
            {campaign.cta ? (
              <>
                CTA: <Text style={styles.heroStrong}>{campaign.cta}</Text>
                {networks ? ' · ' : ''}
              </>
            ) : null}
            {networks ? (
              <>
                Networks: <Text style={styles.heroStrong}>{networks}</Text>
              </>
            ) : null}
          </Text>
        </View>

        <View style={styles.progressBox}>
          <View style={styles.progressLabels}>
            <Text style={styles.progressLabel}>Delivery progress ({pct}%)</Text>
            <Text style={styles.progressLabel}>
              {campaign.clicksRemaining.toLocaleString()} click
              {campaign.clicksRemaining === 1 ? '' : 's'} remaining
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.max(2, pct)}%`,
                  backgroundColor: campaign.isPaused ? colors.gold : colors.mintBright,
                },
              ]}
            />
          </View>
        </View>
      </LinearGradient>

      {/* Headline tiles. */}
      <View style={styles.tiles}>
        <Tile
          icon="navigate-outline"
          tint={colors.brand}
          value={campaign.clicksDelivered.toLocaleString()}
          label="Delivered clicks"
        />
        <Tile
          icon="hourglass-outline"
          tint={colors.brandBright}
          value={campaign.clicksRemaining.toLocaleString()}
          label="Clicks remaining"
        />
        <Tile
          icon="pricetag-outline"
          tint={colors.mint}
          value={campaign.coinsPerClick != null ? `${formatCoins(campaign.coinsPerClick)} PK` : '—'}
          label={rateMoney ? `Cost per click (${rateMoney})` : 'Cost per click'}
        />
        <Tile
          icon="wallet-outline"
          tint={colors.gold}
          value={campaign.coinCost != null ? `${formatCoins(campaign.coinCost)} PK` : '—'}
          label={
            inMoney(campaign.coinCost) ? `Campaign budget (${inMoney(campaign.coinCost)})` : 'Campaign budget'
          }
        />
      </View>

      {/* Networks — where the recorded clicks came from. */}
      <View style={card}>
        <View style={styles.cardHead}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Delivery networks</Text>
          <Text style={[styles.cardHint, { color: colors.textMuted }]}>
            {clicksRecorded.toLocaleString()} recorded
          </Text>
        </View>
        {networkRows(campaign, detail?.byNetwork ?? [], clicksRecorded).map((row) => (
          <View key={row.key} style={styles.networkRow}>
            <View style={[styles.networkIcon, { backgroundColor: `${colors.brand}14` }]}>
              <Ionicons name={row.icon} size={16} color={colors.brand} />
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <View style={styles.barLabels}>
                <Text style={[styles.barLabel, { color: colors.text }]}>{row.label}</Text>
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: row.enabled ? `${colors.mint}1F` : colors.surfaceAlt },
                  ]}
                >
                  <Text
                    style={[
                      styles.badgeText,
                      { color: row.enabled ? colors.mint : colors.textMuted },
                    ]}
                  >
                    {row.enabled ? row.badge : 'Not selected'}
                  </Text>
                </View>
              </View>
              <ShareBar share={row.share} tint={colors.brand} />
              <Text style={[styles.barValue, { color: colors.textMuted }]}>
                {pctLabel(row.share)} · {row.clicks.toLocaleString()} click
                {row.clicks === 1 ? '' : 's'}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* Device breakdown — the web's three buckets always show, so an empty
          one reads as "none" rather than "not tracked". */}
      <Breakdown
        title="Device breakdown"
        hint="User-agent"
        rows={deviceRows(detail?.byDevice ?? [], clicksRecorded)}
        tint={colors.mint}
        total={clicksRecorded}
      />
      <Breakdown
        title="Browsers"
        hint="User-agent"
        rows={(detail?.byBrowser ?? []).map((row) => ({ ...row, key: row.label }))}
        tint={colors.brandBright}
        total={clicksRecorded}
      />

      {/* The receipt. */}
      <View style={card}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Campaign details</Text>
        {[
          campaign.reference ? ['Reference', campaign.reference] : null,
          campaign.createdAt ? ['Launched', formatDate(campaign.createdAt)] : null,
          ['Clicks bought', campaign.clicksBought.toLocaleString()],
          campaign.cta ? ['Call to action', campaign.cta] : null,
        ]
          .filter((row): row is string[] => !!row)
          .map(([label, value]) => (
            <View key={label} style={[styles.detailRow, { borderTopColor: colors.border }]}>
              <Text style={[styles.detailLabel, { color: colors.textMuted }]}>{label}</Text>
              <Text style={[styles.detailValue, { color: colors.text }]} selectable>
                {value}
              </Text>
            </View>
          ))}
      </View>

      <View style={styles.actions}>
        {campaign.isComplete ? null : (
          <GhostButton
            label={
              toggle.isPending
                ? 'Updating…'
                : campaign.isPaused
                  ? 'Resume delivery'
                  : 'Pause delivery'
            }
            icon={campaign.isPaused ? 'play' : 'pause'}
            disabled={toggle.isPending}
            onPress={() => toggle.mutate({ boostId: campaign.id, paused: campaign.isPaused })}
            style={{ flex: 1 }}
          />
        )}
        <GhostButton
          label="All promotions"
          icon="megaphone-outline"
          onPress={() => router.push('/boosts')}
          style={{ flex: 1 }}
        />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------

type Row = BoostBreakdownRow & { key: string };

function Tile({
  icon,
  tint,
  value,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  value: string;
  label: string;
}) {
  const { colors, radius } = useTheme();
  return (
    <View
      style={[
        styles.tile,
        { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg },
      ]}
    >
      <View style={[styles.tileIcon, { backgroundColor: `${tint}1A` }]}>
        <Ionicons name={icon} size={17} color={tint} />
      </View>
      <Text style={[styles.tileValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.tileLabel, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

function ShareBar({ share, tint }: { share: number; tint: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.track, { backgroundColor: colors.surfaceAlt }]}>
      {share > 0 ? (
        <View style={[styles.fill, { width: `${Math.min(100, share * 100)}%`, backgroundColor: tint }]} />
      ) : null}
    </View>
  );
}

function Breakdown({
  title,
  hint,
  rows,
  tint,
  total,
}: {
  title: string;
  hint: string;
  rows: Row[];
  tint: string;
  total: number;
}) {
  const { colors, radius } = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg },
      ]}
    >
      <View style={styles.cardHead}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.cardHint, { color: colors.textMuted }]}>{hint}</Text>
      </View>
      {total === 0 || rows.length === 0 ? (
        <Text style={[styles.muted, { color: colors.textMuted }]}>No clicks recorded yet.</Text>
      ) : (
        rows.map((row) => (
          <View key={row.key} style={{ gap: 6 }}>
            <View style={styles.barLabels}>
              <Text style={[styles.barLabel, { color: colors.text }]}>{row.label}</Text>
              <Text style={[styles.barValue, { color: colors.text }]}>
                {pctLabel(row.share)} ({row.clicks.toLocaleString()} click
                {row.clicks === 1 ? '' : 's'})
              </Text>
            </View>
            <ShareBar share={row.share} tint={tint} />
          </View>
        ))
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------

/** The backend's device labels → the web's wording, fixed order, zeros kept. */
function deviceRows(byDevice: BoostBreakdownRow[], total: number): Row[] {
  const fixed: { match: RegExp; label: string; key: string }[] = [
    { match: /^(mobile|phone|smartphone)$/i, label: 'Mobile (iOS & Android)', key: 'mobile' },
    { match: /^(desktop|laptop|pc|computer)$/i, label: 'Desktop / Laptop', key: 'desktop' },
    { match: /^tablet$/i, label: 'Tablet', key: 'tablet' },
  ];
  const rows: Row[] = fixed.map(({ match, label, key }) => {
    const clicks = byDevice.filter((row) => match.test(row.label)).reduce((n, r) => n + r.clicks, 0);
    return { key, label, clicks, share: total > 0 ? clicks / total : 0 };
  });
  const other = byDevice.filter((row) => !fixed.some(({ match }) => match.test(row.label)));
  return [...rows, ...other.map((row) => ({ ...row, key: row.label }))];
}

/**
 * The two networks a campaign can buy, each with its recorded clicks. The
 * backend keys `by_platform` as `payhankey` (seen live); the partner key has
 * not been seen yet, so anything that isn't `payhankey` counts as partner.
 */
function networkRows(campaign: BoostCampaign, byNetwork: BoostBreakdownRow[], total: number) {
  const feed = byNetwork
    .filter((row) => /payhankey|feed/i.test(row.label))
    .reduce((n, r) => n + r.clicks, 0);
  const partner = byNetwork
    .filter((row) => !/payhankey|feed/i.test(row.label))
    .reduce((n, r) => n + r.clicks, 0);
  return [
    {
      key: 'feed',
      label: 'Payhankey sponsored feed',
      badge: 'In-feed',
      icon: 'flame-outline' as const,
      enabled: campaign.onPayhankey,
      clicks: feed,
      share: total > 0 ? feed / total : 0,
    },
    {
      key: 'partner',
      label: 'Partner websites network',
      badge: 'Verified',
      icon: 'globe-outline' as const,
      enabled: campaign.onPartners,
      clicks: partner,
      share: total > 0 ? partner / total : 0,
    },
  ];
}

function pctLabel(share: number): string {
  return `${Math.round(share * 100)}%`;
}

/** Coins can be fractional when derived from cost ÷ clicks. */
function formatCoins(coins: number): string {
  return coins.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  state: { alignItems: 'center', gap: 12, paddingVertical: 32 },
  muted: { fontFamily: FONT, fontSize: 13, lineHeight: 19, fontWeight: '500' },
  card: { padding: 16, gap: 12, borderWidth: StyleSheet.hairlineWidth },
  emptyCard: { alignItems: 'center', paddingVertical: 24 },
  emptyOrb: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontFamily: FONT, fontSize: 15, fontWeight: '800' },
  cardHint: { fontFamily: FONT, fontSize: 12, fontWeight: '600' },
  hero: { padding: 18, gap: 12 },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderColor: 'rgba(255,255,255,0.22)',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontFamily: FONT, fontSize: 11, fontWeight: '800', letterSpacing: 0.6 },
  rate: { fontFamily: FONT, color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '600', flexShrink: 1 },
  rateStrong: { color: '#FFFFFF', fontWeight: '800' },
  heroTitle: { fontFamily: FONT, color: '#FFFFFF', fontSize: 22, lineHeight: 28, fontWeight: '900' },
  heroFacts: { gap: 4 },
  heroFact: { fontFamily: FONT, color: 'rgba(255,255,255,0.8)', fontSize: 13, lineHeight: 18, fontWeight: '500' },
  heroStrong: { color: '#FFFFFF', fontWeight: '800' },
  heroLink: { color: '#FFFFFF', fontWeight: '700', textDecorationLine: 'underline' },
  progressBox: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  progressLabel: { fontFamily: FONT, color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.18)',
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 4 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: '47.8%', flexGrow: 1, padding: 14, gap: 6, borderWidth: StyleSheet.hairlineWidth },
  tileIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tileValue: { fontFamily: FONT, fontSize: 22, fontWeight: '900' },
  tileLabel: { fontFamily: FONT, fontSize: 12, fontWeight: '600' },
  networkRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  networkIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  barLabels: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  barLabel: { fontFamily: FONT, fontSize: 13.5, fontWeight: '700', flexShrink: 1 },
  barValue: { fontFamily: FONT, fontSize: 12.5, fontWeight: '700' },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontFamily: FONT, fontSize: 10.5, fontWeight: '800' },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  detailLabel: { fontFamily: FONT, fontSize: 13, fontWeight: '600' },
  detailValue: { fontFamily: FONT, fontSize: 13, fontWeight: '700', flexShrink: 1, textAlign: 'right' },
  actions: { flexDirection: 'row', gap: 10 },
});
