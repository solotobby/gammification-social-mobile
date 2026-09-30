import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
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

import { toAppNotification, type AppNotificationItem, type NotificationKind } from '../src/api/notifications';
import { BackButton } from '../src/components/ui/BackButton';
import { Avatar } from '../src/components/ui/Avatar';
import { GhostButton } from '../src/components/ui/GhostButton';
import { ScreenBackground } from '../src/components/ui/ScreenBackground';
import { useCurrency } from '../src/hooks/useCurrency';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from '../src/hooks/useNotifications';
import { useTheme } from '../src/theme/ThemeProvider';
import { FONT } from '../src/theme/fonts';

/**
 * Icon + accent per notification kind. Each event gets its own glyph so a
 * scan down the list reads as "likes, a message, a gift" before any text is.
 */
function useKindMeta(): Record<
  NotificationKind,
  { icon: keyof typeof Ionicons.glyphMap; tint: string }
> {
  const { colors } = useTheme();
  return {
    like: { icon: 'heart', tint: colors.pink },
    comment: { icon: 'chatbubble', tint: colors.brand },
    reply: { icon: 'arrow-undo', tint: colors.brand },
    mention: { icon: 'at', tint: colors.brandBright },
    follow: { icon: 'person-add', tint: colors.brandBright },
    message: { icon: 'chatbubbles', tint: colors.brandBright },
    gift: { icon: 'gift', tint: colors.gold },
    profile_view: { icon: 'eye', tint: colors.brand },
    boost: { icon: 'rocket', tint: colors.brand },
    community: { icon: 'people', tint: colors.brandBright },
    payout: { icon: 'cash', tint: colors.mint },
    referral: { icon: 'people-circle', tint: colors.gold },
    level: { icon: 'ribbon', tint: colors.gold },
    system: { icon: 'megaphone', tint: colors.brand },
    generic: { icon: 'notifications', tint: colors.brand },
  };
}

/**
 * Notification center — `GET /notifications`, with per-row and bulk
 * mark-as-read.
 *
 * Rows are structured (`type` + `target` + `actor`) for anything written since
 * 2026-09-29; older rows are backfilled as `system` and only their web icon and
 * link say what they were. `toAppNotification` resolves both into a kind and an
 * app route — see src/api/notifications.ts.
 */
export default function NotificationsScreen() {
  const { colors, radius, spacing } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const kindMeta = useKindMeta();
  const { format } = useCurrency();

  const query = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const items = useMemo(
    () => query.data?.pages.flatMap((page) => page.page.data.map(toAppNotification)) ?? [],
    [query.data],
  );
  const unreadCount = query.data?.pages[0]?.unreadCount ?? 0;

  const [refreshing, setRefreshing] = useState(false);
  const { refetch } = query;
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  const loadMore = useCallback(() => {
    if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
  }, [query]);

  /**
   * Tapping a row marks it read and opens what it's about — the post, the
   * thread, the profile, the campaign. With no destination it just reads,
   * which beats navigating somewhere arbitrary.
   */
  const onOpen = useCallback(
    (item: AppNotificationItem) => {
      if (item.unread) markRead.mutate(item.id);
      if (item.route) router.push(item.route);
    },
    [markRead, router],
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScreenBackground />
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        onEndReached={loadMore}
        onEndReachedThreshold={0.6}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={colors.brand}
            colors={[colors.brand]}
          />
        }
        contentContainerStyle={{
          paddingTop: insets.top + spacing.lg,
          paddingBottom: insets.bottom + spacing.xl,
          paddingHorizontal: spacing.xl,
          gap: spacing.md,
        }}
        ListHeaderComponent={
          <View style={{ gap: spacing.lg, paddingBottom: spacing.xs }}>
            <View style={styles.headerRow}>
              <BackButton onPress={() => router.back()} />
              <Text style={[styles.headerTitle, { color: colors.text }]}>Notifications</Text>
              <View style={{ width: 44 }} />
            </View>
            {unreadCount > 0 ? (
              <View style={styles.unreadRow}>
                <Text style={[styles.unreadLabel, { color: colors.textMuted }]}>
                  {unreadCount} unread
                </Text>
                <GhostButton
                  label={markAllRead.isPending ? 'Marking…' : 'Mark all read'}
                  onPress={() => markAllRead.mutate()}
                />
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item }) => {
          const meta = kindMeta[item.kind];
          return (
            <Pressable
              onPress={() => onOpen(item)}
              accessibilityRole="button"
              accessibilityLabel={item.body ? `${item.title}. ${item.body}` : item.title}
              style={({ pressed }) => [
                styles.row,
                {
                  // Unread sits on a faint brand wash as well as carrying the
                  // dot — a 1px border change is easy to miss down a list.
                  backgroundColor: item.unread ? `${colors.brand}0F` : colors.surface,
                  borderColor: item.unread ? `${colors.brand}40` : colors.border,
                  borderRadius: radius.lg,
                  opacity: pressed ? 0.9 : 1,
                },
              ]}
            >
              {/* The actor's avatar when the payload names one — a face reads
                  faster than an icon — with the kind badge tucked on its
                  corner so the event is still legible at a glance. */}
              {item.actor ? (
                <View>
                  <Avatar
                    userId={item.actor.id}
                    level={item.actor.level}
                    name={item.actor.name}
                    tint={item.actor.tint}
                    uri={item.actor.avatar}
                    size={40}
                  />
                  <View
                    style={[
                      styles.kindBadge,
                      { backgroundColor: meta.tint, borderColor: colors.surface },
                    ]}
                  >
                    <Ionicons name={meta.icon} size={10} color="#FFFFFF" />
                  </View>
                </View>
              ) : (
                <View style={[styles.iconWrap, { backgroundColor: `${meta.tint}1A` }]}>
                  <Ionicons name={meta.icon} size={19} color={meta.tint} />
                </View>
              )}

              <View style={styles.rowText}>
                <Text style={[styles.text, { color: colors.text }]} numberOfLines={2}>
                  {item.title}
                </Text>
                {item.body ? (
                  <Text
                    style={[styles.body, { color: colors.textSecondary }]}
                    numberOfLines={2}
                  >
                    {/* A DM's body is what they said — quote it. */}
                    {item.kind === 'message' ? `“${item.body}”` : item.body}
                  </Text>
                ) : null}
                <View style={styles.metaRow}>
                  {item.timeAgo ? (
                    <Text style={[styles.time, { color: colors.textMuted }]}>{item.timeAgo}</Text>
                  ) : null}
                  {item.amountLabel ? (
                    <Text style={[styles.amount, { color: colors.mint }]}>{item.amountLabel}</Text>
                  ) : item.amount != null ? (
                    <Text style={[styles.amount, { color: colors.mint }]}>
                      +{format(item.amount, item.currency ?? undefined)}
                    </Text>
                  ) : null}
                  {item.coins != null ? (
                    <View style={[styles.coinPill, { backgroundColor: `${colors.gold}1F` }]}>
                      <Text style={[styles.coinText, { color: colors.gold }]}>
                        +{item.coins.toLocaleString()} PK
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>

              {item.previewImage ? (
                <Image
                  source={{ uri: item.previewImage }}
                  style={[styles.preview, { backgroundColor: colors.surfaceAlt }]}
                  contentFit="cover"
                />
              ) : null}
              {item.unread ? (
                <View style={[styles.unreadDot, { backgroundColor: colors.brand }]} />
              ) : null}
            </Pressable>
          );
        }}
        ListEmptyComponent={
          query.isLoading ? (
            <View style={styles.stateWrap}>
              <ActivityIndicator color={colors.brand} />
            </View>
          ) : query.isError ? (
            <View style={styles.stateWrap}>
              <Text style={[styles.stateText, { color: colors.textMuted }]}>
                We couldn't load your notifications. Check your connection and try again.
              </Text>
              <GhostButton label="Retry" onPress={() => void query.refetch()} />
            </View>
          ) : (
            <View style={styles.stateWrap}>
              <View style={[styles.emptyOrb, { backgroundColor: `${colors.brand}14` }]}>
                <Ionicons name="notifications-outline" size={30} color={colors.brand} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>You're all caught up</Text>
              <Text style={[styles.stateText, { color: colors.textMuted }]}>
                Likes, comments, follows and payouts land here as they happen.
              </Text>
              {/* The kinds this screen will show, so an empty list still says
                  what the screen is for. */}
              <View style={styles.emptyChips}>
                {[
                  { icon: 'heart' as const, label: 'Likes', tint: colors.pink },
                  { icon: 'chatbubble' as const, label: 'Comments', tint: colors.brand },
                  { icon: 'person-add' as const, label: 'Follows', tint: colors.brandBright },
                  { icon: 'cash' as const, label: 'Payouts', tint: colors.mint },
                ].map((chip) => (
                  <View
                    key={chip.label}
                    style={[
                      styles.emptyChip,
                      { backgroundColor: colors.surface, borderColor: colors.border },
                    ]}
                  >
                    <Ionicons name={chip.icon} size={12} color={chip.tint} />
                    <Text style={[styles.emptyChipText, { color: colors.textSecondary }]}>
                      {chip.label}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )
        }
        ListFooterComponent={
          query.isFetchingNextPage ? (
            <View style={styles.footer}>
              <ActivityIndicator color={colors.brand} />
            </View>
          ) : null
        }
      />
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
  unreadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  unreadLabel: { fontFamily: FONT, fontSize: 13, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderWidth: 1,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kindBadge: {
    position: 'absolute',
    right: -3,
    bottom: -3,
    width: 19,
    height: 19,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: 3 },
  text: { fontFamily: FONT, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  body: { fontFamily: FONT, fontSize: 13, lineHeight: 18, fontWeight: '500' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 1 },
  time: { fontFamily: FONT, fontSize: 12, fontWeight: '600' },
  amount: { fontFamily: FONT, fontSize: 12, fontWeight: '800' },
  coinPill: { borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
  coinText: { fontFamily: FONT, fontSize: 11, fontWeight: '800' },
  preview: { width: 44, height: 44, borderRadius: 8 },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
  footer: { alignItems: 'center', paddingVertical: 14 },
  stateWrap: { alignItems: 'center', gap: 12, paddingVertical: 48, paddingHorizontal: 24 },
  emptyOrb: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  emptyTitle: { fontFamily: FONT, fontSize: 17, fontWeight: '800' },
  emptyChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 6,
  },
  emptyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  emptyChipText: { fontFamily: FONT, fontSize: 11.5, fontWeight: '700' },
  stateText: {
    fontFamily: FONT,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
  },
});
