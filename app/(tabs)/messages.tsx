import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ConversationRow } from '../../src/components/messages/ConversationRow';
import { TAB_BAR_CLEARANCE } from '../../src/components/navigation/TabBar';
import { ScreenBackground } from '../../src/components/ui/ScreenBackground';
import { TextField } from '../../src/components/ui/TextField';
import { byRecency, lastMessage } from '../../src/data/messages';
import { useMessagesStore } from '../../src/stores/messagesStore';
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
 * **Dummy data.** There is no messaging API yet — see `src/data/messages.ts`.
 * Search and the All / Unread filter run client-side over the seeded threads;
 * when the endpoints land, expect `search` to become a query param the way
 * `GET /communities` does, rather than a filter over one page.
 */
export default function MessagesScreen() {
  const { colors, radius, spacing } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const conversations = useMessagesStore((s) => s.conversations);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const unreadCount = useMemo(
    () => conversations.filter((c) => c.unread > 0).length,
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
          (lastMessage(c)?.body ?? '').toLowerCase().includes(needle)
        );
      })
      .slice()
      .sort(byRecency);
  }, [conversations, filter, query]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScreenBackground />
      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingTop: insets.top + spacing.lg,
          paddingBottom: insets.bottom + TAB_BAR_CLEARANCE,
          paddingHorizontal: spacing.xl,
          gap: spacing.sm,
        }}
        ListHeaderComponent={
          <View style={{ gap: spacing.lg, paddingBottom: spacing.sm }}>
            <View style={styles.titleRow}>
              <View style={styles.titleText}>
                <Text style={[styles.title, { color: colors.text }]}>Messages</Text>
                <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                  {unreadCount > 0
                    ? `${unreadCount} conversation${unreadCount === 1 ? '' : 's'} waiting on you`
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
            onPress={() => router.push(`/messages/${item.id}`)}
          />
        )}
        ListEmptyComponent={
          <View style={[styles.empty, { borderColor: colors.border, borderRadius: radius.lg }]}>
            <Ionicons name="chatbubbles-outline" size={28} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {query.trim()
                ? 'No conversations match that'
                : filter === 'unread'
                  ? 'Nothing unread'
                  : 'No conversations yet'}
            </Text>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              {query.trim() || filter === 'unread'
                ? 'Try another search, or switch back to All.'
                : 'Start a chat with a creator you follow.'}
            </Text>
          </View>
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
});
