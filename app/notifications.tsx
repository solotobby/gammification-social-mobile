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

/** Icon + accent per notification kind. */
function useKindMeta(): Record<
  NotificationKind,
  { icon: keyof typeof Ionicons.glyphMap; tint: string }
> {
  const { colors } = useTheme();
  return {
    like: { icon: 'heart', tint: colors.pink },
    comment: { icon: 'chatbubble', tint: colors.brand },
    follow: { icon: 'person-add', tint: colors.brandBright },
    mention: { icon: 'at', tint: colors.brandBright },
    profile_view: { icon: 'eye', tint: colors.brand },
    community: { icon: 'people', tint: colors.brandBright },
    payout: { icon: 'cash', tint: colors.mint },
    referral: { icon: 'gift', tint: colors.gold },
    gift: { icon: 'gift', tint: colors.gold },
    system: { icon: 'megaphone', tint: colors.brand },
    generic: { icon: 'notifications', tint: colors.brand },
  };
}

/**
 * Notification center — `GET /notifications`, with per-row and bulk
 * mark-as-read.
 *
 * Rows never materialise on the staging backend (every route answers 200 but no
 * engagement writes one), so the empty state below is what this screen shows
 * today. The mapper is alias-tolerant for the same reason — see
 * src/api/notifications.ts.
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
   * Tapping a row marks it read and follows whatever target the payload named.
   * With no target it just reads — better than navigating somewhere arbitrary.
   */
  const onOpen = useCallback(
    (item: AppNotificationItem) => {
      if (item.unread) markRead.mutate(item.id);
      if (item.postId) router.push(`/post/${item.postId}`);
      else if (item.communityId) router.push(`/community/${item.communityId}`);
      else if (item.kind === 'follow' && item.username) router.push(`/member/${item.username}`);
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
              accessibilityLabel={item.text}
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
                  <Avatar name={item.actor.name} tint={item.actor.tint} size={38} />
                  <View style={[styles.kindBadge, { backgroundColor: meta.tint }]}>
                    <Ionicons name={meta.icon} size={10} color="#FFFFFF" />
                  </View>
                </View>
              ) : (
                <View style={[styles.iconWrap, { backgroundColor: `${meta.tint}1A` }]}>
                  <Ionicons name={meta.icon} size={18} color={meta.tint} />
                </View>
              )}

              <View style={styles.rowText}>
                <Text style={[styles.text, { color: colors.text }]}>{item.text}</Text>
                <View style={styles.metaRow}>
                  {item.timeAgo ? (
                    <Text style={[styles.time, { color: colors.textMuted }]}>{item.timeAgo}</Text>
                  ) : null}
                  {item.amount != null ? (
                    <Text style={[styles.amount, { color: colors.mint }]}>
                      +{format(item.amount, item.currencySymbol ?? undefined)}
                    </Text>
                  ) : null}
                </View>
              </View>

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
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kindBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 17,
    height: 17,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: 4 },
  text: { fontFamily: FONT, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  time: { fontFamily: FONT, fontSize: 12, fontWeight: '600' },
  amount: { fontFamily: FONT, fontSize: 12, fontWeight: '800' },
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
