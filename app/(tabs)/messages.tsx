import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
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

import {
  CONVERSATION_DIVIDER_INSET,
  ConversationRow,
} from '../../src/components/messages/ConversationRow';
import { DrawerAvatarButton } from '../../src/components/navigation/DrawerAvatarButton';
import {
  TabScreenHeader,
  useScrolledPastTop,
} from '../../src/components/navigation/TabScreenHeader';
import { TAB_BAR_CLEARANCE } from '../../src/components/navigation/TabBar';
import { ScreenBackground } from '../../src/components/ui/ScreenBackground';
import { TextField } from '../../src/components/ui/TextField';
import { byRecency, type Conversation, type ConversationPreview } from '../../src/data/messages';
import { useIsOffline } from '../../src/hooks/useIsOffline';
import { useConversations } from '../../src/hooks/useMessages';
import { useOutboxStore } from '../../src/stores/outboxStore';
import { useTheme } from '../../src/theme/ThemeProvider';
import { FONT } from '../../src/theme/fonts';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
] as const;

type Filter = (typeof FILTERS)[number]['value'];

/**
 * Messages tab — the conversation list, ported from the web's `/user/messages`
 * (a two-pane page there: list on the left, thread on the right). On a phone
 * the two panes are two screens, so a row pushes `/messages/[id]`.
 *
 * **`GET /conversations`**, paged 20 at a time, polled every 15s while this
 * tab is on screen and served from the persisted cache first — so the list is
 * there instantly, and fully, with no connection. The API has no server-side
 * search or filter (both params are silently ignored), so search and the
 * All / Unread chips run over the rows loaded so far.
 *
 * Unsent messages count as the newest thing in their thread: a row whose
 * latest message is still in the outbox previews *that* one, with a clock (or
 * a red "!" if the server refused it), and sorts by it — so what you just sent
 * offline is at the top of the list, where you'd look for it.
 *
 * Pinning lives in the thread header's "⋮" sheet (`ConversationMenu`) and is
 * expressed purely as ordering — `byRecency` hoists pinned threads — so nothing
 * here has to maintain a second list.
 *
 * The list is a flat inbox, not a stack of cards: rows run full width and are
 * divided by a hairline under the text column only. So the content container
 * carries no horizontal padding — the header and empty state re-apply the
 * gutter themselves, and each row takes it as a prop so its press highlight
 * still reaches both edges.
 */
export default function MessagesScreen() {
  const { colors, radius, spacing } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const offline = useIsOffline();
  const header = useScrolledPastTop();

  // Poll only while the tab is actually in front.
  const [focused, setFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  const list = useConversations({ live: focused });
  const outbox = useOutboxStore((s) => s.items);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [refreshing, setRefreshing] = useState(false);

  const conversations = useMemo<Conversation[]>(() => {
    const rows = list.data?.pages.flatMap((page) => page.conversations) ?? [];
    // The newest unsent message per thread.
    const pending = new Map<string, ConversationPreview>();
    for (const item of outbox) {
      const current = pending.get(item.conversationId);
      if (current && current.sentAt >= item.createdAt) continue;
      pending.set(item.conversationId, {
        body: item.body,
        hasImage: item.images.length > 0,
        mine: true,
        sentAt: item.createdAt,
        status: item.state === 'failed' ? 'failed' : 'sending',
      });
    }
    return rows.map((c) => {
      const unsent = pending.get(c.id);
      return unsent && (!c.last || unsent.sentAt >= c.last.sentAt) ? { ...c, last: unsent } : c;
    });
  }, [list.data, outbox]);

  const unreadCount = useMemo(
    () => conversations.filter((c) => c.unread > 0).length,
    [conversations],
  );

  const pinnedCount = useMemo(
    () => conversations.filter((c) => c.pinned).length,
    [conversations],
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return conversations
      .filter((c) => (filter === 'unread' ? c.unread > 0 : true))
      .filter((c) => {
        if (!needle) return true;
        // Name, handle and the last message — searching a thread by what was
        // said in it is the thing people actually try first.
        return (
          c.member.name.toLowerCase().includes(needle) ||
          c.member.handle.toLowerCase().includes(needle) ||
          (c.last?.body ?? '').toLowerCase().includes(needle)
        );
      })
      .slice()
      .sort(byRecency);
  }, [conversations, filter, query]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await list.refetch();
    } finally {
      setRefreshing(false);
    }
  };

  // Nothing cached and nothing back yet — the only time the list has no rows
  // to show for a reason other than "there are none".
  const firstLoad = list.isLoading && !list.data;
  const loadFailed = list.isError && !list.data;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScreenBackground />
      {/* Fixed: the title row stays put while the inbox scrolls under it. */}
      <TabScreenHeader scrolled={header.scrolled} gutter={spacing.xl}>
        <View style={styles.titleRow}>
          <DrawerAvatarButton />
          <View style={styles.titleText}>
            <Text style={[styles.title, { color: colors.text }]}>Messages</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              {offline
                ? 'Offline · showing saved messages'
                : firstLoad
                  ? 'Loading your conversations…'
                  : unreadCount > 0
                    ? `${unreadCount} conversation${unreadCount === 1 ? '' : 's'} waiting on you`
                    : pinnedCount > 0
                      ? `${pinnedCount} pinned · you’re all caught up`
                      : 'You’re all caught up'}
            </Text>
          </View>
          <Pressable
            onPress={() => router.push('/messages/new')}
            accessibilityRole="button"
            accessibilityLabel="New message"
            style={({ pressed }) => [
              styles.composeButton,
              {
                backgroundColor: colors.brand,
                opacity: pressed ? 0.8 : 1,
                shadowColor: colors.brand,
              },
            ]}
          >
            <Ionicons name="create-outline" size={21} color={colors.onBrand} />
          </Pressable>
        </View>
      </TabScreenHeader>
      <FlatList
        style={styles.root}
        data={visible}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />
        }
        onEndReached={() => {
          if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          list.isFetchingNextPage ? (
            <ActivityIndicator color={colors.brand} style={styles.footerSpinner} />
          ) : null
        }
        keyboardShouldPersistTaps="handled"
        onScroll={header.onScroll}
        scrollEventThrottle={header.scrollEventThrottle}
        contentContainerStyle={{
          // The fixed header owns the safe area; this restores the gap the
          // title row used to leave before the search field.
          paddingTop: spacing.lg - spacing.md,
          paddingBottom: insets.bottom + TAB_BAR_CLEARANCE,
        }}
        ListHeaderComponent={
          <View
            style={{ gap: spacing.lg, paddingBottom: spacing.md, paddingHorizontal: spacing.xl }}
          >
            <TextField
              icon="search-outline"
              placeholder="Search conversations"
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />

            <View style={styles.chipRail}>
              {FILTERS.map((item) => {
                const active = item.value === filter;
                return (
                  <Pressable
                    key={item.value}
                    onPress={() => setFilter(item.value)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={[
                      styles.chip,
                      { borderRadius: radius.pill },
                      active
                        ? { backgroundColor: colors.brand, borderColor: colors.brand }
                        : { backgroundColor: colors.surface, borderColor: colors.border },
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: active ? colors.onBrand : colors.textSecondary },
                      ]}
                    >
                      {item.label}
                      {item.value === 'unread' && unreadCount > 0 ? ` (${unreadCount})` : ''}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <ConversationRow
            conversation={item}
            gutter={spacing.xl}
            onPress={() =>
              router.push({ pathname: '/messages/[id]', params: { id: item.id } })
            }
          />
        )}
        ItemSeparatorComponent={() => (
          <View
            style={[
              styles.divider,
              {
                marginLeft: spacing.xl + CONVERSATION_DIVIDER_INSET,
                backgroundColor: colors.border,
              },
            ]}
          />
        )}
        ListEmptyComponent={
          firstLoad ? (
            <ActivityIndicator color={colors.brand} style={styles.footerSpinner} />
          ) : (
            <View
              style={[
                styles.empty,
                { borderColor: colors.border, borderRadius: radius.lg, marginHorizontal: spacing.xl },
              ]}
            >
              <Ionicons
                name={loadFailed ? 'cloud-offline-outline' : 'chatbubbles-outline'}
                size={28}
                color={colors.textMuted}
              />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                {loadFailed
                  ? 'Couldn’t load your messages'
                  : query.trim()
                    ? 'No conversations match that'
                    : filter === 'unread'
                      ? 'Nothing unread'
                      : 'No conversations yet'}
              </Text>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                {loadFailed
                  ? offline
                    ? 'You’re offline. They’ll load as soon as you reconnect.'
                    : 'Pull down to try again.'
                  : query.trim() || filter === 'unread'
                    ? 'Try another search, or switch back to All.'
                    : 'Message a creator from their profile, or tap the pencil to find someone.'}
              </Text>
              {!loadFailed && !query.trim() && filter === 'all' ? (
                <Pressable
                  onPress={() => router.push('/messages/new')}
                  accessibilityRole="button"
                  style={[styles.emptyCta, { backgroundColor: colors.brand, borderRadius: radius.pill }]}
                >
                  <Ionicons name="create-outline" size={16} color={colors.onBrand} />
                  <Text style={[styles.emptyCtaText, { color: colors.onBrand }]}>New message</Text>
                </Pressable>
              ) : null}
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  titleText: { flex: 1, gap: 2 },
  title: { fontFamily: FONT, fontSize: 26, fontWeight: '800' },
  subtitle: { fontFamily: FONT, fontSize: 13, fontWeight: '600' },
  composeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  chipRail: { flexDirection: 'row', gap: 8 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipText: { fontFamily: FONT, fontSize: 13, fontWeight: '700' },
  divider: { height: StyleSheet.hairlineWidth },
  empty: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 36,
    paddingHorizontal: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
  },
  emptyTitle: { fontFamily: FONT, fontSize: 15, fontWeight: '800' },
  emptyText: { fontFamily: FONT, fontSize: 13, fontWeight: '500', textAlign: 'center' },
  emptyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 18,
    height: 40,
  },
  emptyCtaText: { fontFamily: FONT, fontSize: 14, fontWeight: '800' },
  footerSpinner: { paddingVertical: 24 },
});
