import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { BoostCampaign } from '../src/api/boost';
import { BackButton } from '../src/components/ui/BackButton';
import { ScreenBackground } from '../src/components/ui/ScreenBackground';
import { useBoosts, useToggleBoost } from '../src/hooks/useBoost';
import { useTheme } from '../src/theme/ThemeProvider';
import { FONT } from '../src/theme/fonts';

/**
 * Your promotions — `GET /boosts`, with pause/resume per campaign.
 *
 * The number that matters on a card is clicks *delivered against clicks bought*,
 * since that is exactly what was paid for: the progress bar is the campaign's
 * completion, not an engagement rate.
 */
export default function BoostsScreen() {
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage, refetch, isRefetching } =
    useBoosts();
  const campaigns = data?.pages.flatMap((page) => page.data) ?? [];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScreenBackground />
      <FlatList
        data={campaigns}
        keyExtractor={(item) => item.id}
        onRefresh={refetch}
        refreshing={isRefetching}
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) fetchNextPage();
        }}
        contentContainerStyle={{
          paddingTop: insets.top + spacing.lg,
          paddingBottom: insets.bottom + spacing.xl,
          paddingHorizontal: 16,
          gap: spacing.md,
        }}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.headerRow}>
              <BackButton onPress={() => router.back()} />
              <Text style={[styles.headerTitle, { color: colors.text }]}>Promotions</Text>
              <View style={{ width: 44 }} />
            </View>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Posts you're paying to put in front of more people.
            </Text>
          </View>
        }
        renderItem={({ item }) => <CampaignCard campaign={item} />}
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.empty}>
              <ActivityIndicator color={colors.brand} />
            </View>
          ) : (
            <View style={styles.empty}>
              <Ionicons name="megaphone-outline" size={30} color={colors.textMuted} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                No promotions yet
              </Text>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                Open any of your posts and choose Promote to reach people beyond
                your followers.
              </Text>
            </View>
          )
        }
      />
    </View>
  );
}

function CampaignCard({ campaign }: { campaign: BoostCampaign }) {
  const { colors, radius } = useTheme();
  const router = useRouter();
  const toggle = useToggleBoost();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md },
      ]}
    >
      <View style={styles.cardHeader}>
        <View
          style={[
            styles.statusPill,
            {
              backgroundColor: campaign.isPaused ? `${colors.gold}1A` : `${colors.mint}1A`,
            },
          ]}
        >
          <View
            style={[
              styles.statusDot,
              { backgroundColor: campaign.isPaused ? colors.gold : colors.mint },
            ]}
          />
          <Text
            style={[
              styles.statusText,
              { color: campaign.isPaused ? colors.gold : colors.mint },
            ]}
          >
            {campaign.isPaused ? 'Paused' : 'Running'}
          </Text>
        </View>
        {campaign.timeAgo ? (
          <Text style={[styles.time, { color: colors.textMuted }]}>{campaign.timeAgo}</Text>
        ) : null}
      </View>

      {campaign.postBody ? (
        <Text style={[styles.body, { color: colors.text }]} numberOfLines={2}>
          {campaign.postBody}
        </Text>
      ) : null}

      {/* Delivery — the thing that was actually bought. */}
      <View style={styles.progressBlock}>
        <View style={styles.progressLabels}>
          <Text style={[styles.progressText, { color: colors.textSecondary }]}>
            {campaign.clicksDelivered.toLocaleString()} of{' '}
            {campaign.clicksBought.toLocaleString()} clicks
          </Text>
          <Text style={[styles.progressPct, { color: colors.textMuted }]}>
            {Math.round(campaign.progress * 100)}%
          </Text>
        </View>
        <View style={[styles.track, { backgroundColor: colors.surfaceAlt }]}>
          <View
            style={[
              styles.fill,
              {
                backgroundColor: campaign.isPaused ? colors.gold : colors.brand,
                // Always paint a sliver at 0 so the bar reads as a bar rather
                // than an empty box.
                width: `${Math.max(2, campaign.progress * 100)}%`,
              },
            ]}
          />
        </View>
      </View>

      <View style={styles.metaRow}>
        {campaign.cta ? (
          <View style={styles.metaItem}>
            <Ionicons name="hand-left-outline" size={13} color={colors.textMuted} />
            <Text style={[styles.metaText, { color: colors.textMuted }]}>{campaign.cta}</Text>
          </View>
        ) : null}
        {campaign.coinCost != null ? (
          <View style={styles.metaItem}>
            <Ionicons name="pricetag-outline" size={13} color={colors.textMuted} />
            <Text style={[styles.metaText, { color: colors.textMuted }]}>
              {campaign.coinCost.toLocaleString()} PK
            </Text>
          </View>
        ) : null}
        {campaign.impressions != null ? (
          <View style={styles.metaItem}>
            <Ionicons name="eye-outline" size={13} color={colors.textMuted} />
            <Text style={[styles.metaText, { color: colors.textMuted }]}>
              {campaign.impressions.toLocaleString()}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={[styles.actions, { borderTopColor: colors.border }]}>
        <Pressable
          onPress={() => toggle.mutate({ boostId: campaign.id, paused: campaign.isPaused })}
          disabled={toggle.isPending}
          accessibilityRole="button"
          style={styles.action}
        >
          <Ionicons
            name={campaign.isPaused ? 'play-outline' : 'pause-outline'}
            size={16}
            color={colors.text}
          />
          <Text style={[styles.actionText, { color: colors.text }]}>
            {campaign.isPaused ? 'Resume' : 'Pause'}
          </Text>
        </Pressable>
        {campaign.postId ? (
          <Pressable
            onPress={() => router.push(`/post/${campaign.postId}`)}
            accessibilityRole="button"
            style={styles.action}
          >
            <Ionicons name="open-outline" size={16} color={colors.text} />
            <Text style={[styles.actionText, { color: colors.text }]}>View post</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { gap: 10, marginBottom: 6 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontFamily: FONT, fontSize: 18, fontWeight: '800' },
  subtitle: { fontFamily: FONT, fontSize: 14, fontWeight: '500', lineHeight: 20 },
  card: { padding: 16, borderWidth: StyleSheet.hairlineWidth, gap: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontFamily: FONT, fontSize: 11, fontWeight: '800' },
  time: { fontFamily: FONT, fontSize: 12, fontWeight: '600' },
  body: { fontFamily: FONT, fontSize: 14, lineHeight: 20, fontWeight: '500' },
  progressBlock: { gap: 6 },
  progressLabels: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progressText: { fontFamily: FONT, fontSize: 13, fontWeight: '700' },
  progressPct: { fontFamily: FONT, fontSize: 12, fontWeight: '700' },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontFamily: FONT, fontSize: 12, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 20, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionText: { fontFamily: FONT, fontSize: 13, fontWeight: '700' },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 60, paddingHorizontal: 30 },
  emptyTitle: { fontFamily: FONT, fontSize: 16, fontWeight: '800' },
  emptyText: { fontFamily: FONT, fontSize: 13, fontWeight: '500', textAlign: 'center', lineHeight: 19 },
});
