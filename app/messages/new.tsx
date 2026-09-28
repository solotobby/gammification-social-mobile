import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { tintFor } from '../../src/api/timeline';
import { Avatar } from '../../src/components/ui/Avatar';
import { LevelBadge } from '../../src/components/ui/LevelBadge';
import { ScreenBackground } from '../../src/components/ui/ScreenBackground';
import { TextField } from '../../src/components/ui/TextField';
import type { Member } from '../../src/data/community';
import { byRecency } from '../../src/data/messages';
import { useConnections } from '../../src/hooks/useConnections';
import { useDebouncedValue } from '../../src/hooks/useDebouncedValue';
import { useIsOffline } from '../../src/hooks/useIsOffline';
import { useConversations, useOpenConversation } from '../../src/hooks/useMessages';
import { useSearchUsers } from '../../src/hooks/useUser';
import { useAuthStore } from '../../src/stores/authStore';
import { useTheme } from '../../src/theme/ThemeProvider';
import { FONT } from '../../src/theme/fonts';

type Row =
  | { kind: 'header'; id: string; label: string }
  | { kind: 'member'; id: string; member: Member };

/** How many recent threads the picker offers before anyone types. */
const RECENT_LIMIT = 5;

const toPickerMember = (user: {
  id: string;
  name: string;
  username?: string;
  handle?: string;
  avatar?: string | null;
}): Member => ({
  id: user.id,
  name: user.name?.trim() || user.username || user.handle || 'Member',
  handle: user.username ?? user.handle ?? '',
  tint: tintFor(user.id),
  avatar: user.avatar ?? null,
  engagements: 0,
  followers: 0,
  following: 0,
});

/**
 * New-message picker — the pencil in the Messages header.
 *
 * Before anything is typed it offers the two lists people actually pick from:
 * **recent conversations** (from the cached list, so this half works offline)
 * and **people you follow** (`/user/profile/{me}/following`). Typing searches
 * every account (`GET /user/search`, debounced).
 *
 * Choosing someone goes through `useOpenConversation`: a thread already cached
 * opens at once; otherwise `POST /conversations/direct` opens-or-creates it,
 * the row showing a spinner meanwhile. It `replace`s this modal, so backing out
 * of the new thread returns to the list rather than to the picker.
 */
export default function NewMessageScreen() {
  const { colors, radius, spacing } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const offline = useIsOffline();
  const me = useAuthStore((s) => s.user);

  const [query, setQuery] = useState('');
  const debounced = useDebouncedValue(query, 300);
  const searching = query.trim().length > 0;

  const conversations = useConversations();
  const following = useConnections(me?.username, 'following');
  const search = useSearchUsers(debounced);
  const { open, openingFor } = useOpenConversation();

  const threadWith = useMemo(() => {
    const map = new Map<string, string>();
    for (const page of conversations.data?.pages ?? []) {
      for (const c of page.conversations) map.set(c.member.id, c.id);
    }
    return map;
  }, [conversations.data]);

  const rows = useMemo<Row[]>(() => {
    const notMe = (member: Member) => member.id !== me?.id;

    if (searching) {
      const hits = (search.data?.pages ?? [])
        .flatMap((page) => page.data)
        .map(toPickerMember)
        .filter(notMe);
      return hits.map((member) => ({ kind: 'member', id: member.id, member }));
    }

    const out: Row[] = [];
    const seen = new Set<string>();
    const recent = (conversations.data?.pages ?? [])
      .flatMap((page) => page.conversations)
      .slice()
      .sort(byRecency)
      .slice(0, RECENT_LIMIT)
      .map((c) => c.member);
    if (recent.length) {
      out.push({ kind: 'header', id: 'h-recent', label: 'Recent' });
      for (const member of recent) {
        seen.add(member.id);
        out.push({ kind: 'member', id: `r-${member.id}`, member });
      }
    }
    const followed = (following.data?.pages ?? [])
      .flatMap((page) => page.data)
      .filter((row) => !row.isMe && !seen.has(row.id))
      .map(toPickerMember);
    if (followed.length) {
      out.push({ kind: 'header', id: 'h-following', label: 'People you follow' });
      for (const member of followed) out.push({ kind: 'member', id: `f-${member.id}`, member });
    }
    return out;
  }, [conversations.data, following.data, me?.id, search.data, searching]);

  const searchPending = searching && (debounced !== query || search.isFetching) && !search.data;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScreenBackground />
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        onEndReached={() => {
          if (searching && search.hasNextPage && !search.isFetchingNextPage) {
            void search.fetchNextPage();
          } else if (!searching && following.hasNextPage && !following.isFetchingNextPage) {
            void following.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.5}
        contentContainerStyle={{
          paddingTop: insets.top + spacing.lg,
          paddingBottom: insets.bottom + spacing.xxl,
          paddingHorizontal: spacing.xl,
          gap: spacing.sm,
        }}
        ListHeaderComponent={
          <View style={{ gap: spacing.lg, paddingBottom: spacing.sm }}>
            <View style={styles.headerRow}>
              <Text style={[styles.title, { color: colors.text }]}>New message</Text>
              <Pressable
                onPress={() => router.back()}
                accessibilityRole="button"
                accessibilityLabel="Close"
                style={[styles.close, { backgroundColor: colors.surfaceAlt }]}
              >
                <Ionicons name="close" size={20} color={colors.text} />
              </Pressable>
            </View>
            <TextField
              icon="search-outline"
              placeholder="Search people by name or @username"
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              autoFocus
            />
            {offline ? (
              <View style={styles.offlineRow}>
                <Ionicons name="cloud-offline-outline" size={14} color={colors.textMuted} />
                <Text style={[styles.offlineText, { color: colors.textMuted }]}>
                  You’re offline — you can still open recent conversations.
                </Text>
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item }) => {
          if (item.kind === 'header') {
            return (
              <Text style={[styles.section, { color: colors.textMuted }]}>
                {item.label.toUpperCase()}
              </Text>
            );
          }
          const { member } = item;
          const existing = threadWith.has(member.id);
          const opening = openingFor === member.id;
          return (
            <Pressable
              onPress={() => void open(member, { replace: true })}
              disabled={!!openingFor}
              accessibilityRole="button"
              accessibilityLabel={`Message ${member.name}`}
              style={({ pressed }) => [
                styles.row,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderRadius: radius.md,
                  opacity: pressed || (openingFor && !opening) ? 0.6 : 1,
                },
              ]}
            >
              <Avatar userId={member.id} level={member.level} name={member.name} tint={member.tint} uri={member.avatar} size={44} />
              <View style={styles.rowText}>
                <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                  {member.name}{' '}<LevelBadge userId={member.id} level={member.level} size={14} />
                </Text>
                <Text style={[styles.handle, { color: colors.textMuted }]} numberOfLines={1}>
                  @{member.handle}
                </Text>
              </View>
              {opening ? (
                <ActivityIndicator color={colors.brand} />
              ) : existing ? (
                <Text style={[styles.existing, { color: colors.brand }]}>Open</Text>
              ) : (
                <Ionicons name="chatbubble-outline" size={18} color={colors.textMuted} />
              )}
            </Pressable>
          );
        }}
        ListFooterComponent={
          search.isFetchingNextPage || following.isFetchingNextPage ? (
            <ActivityIndicator color={colors.brand} style={styles.spinner} />
          ) : null
        }
        ListEmptyComponent={
          searchPending || (!searching && (conversations.isLoading || following.isLoading)) ? (
            <ActivityIndicator color={colors.brand} style={styles.spinner} />
          ) : (
            <Text style={[styles.empty, { color: colors.textMuted }]}>
              {searching
                ? offline
                  ? 'Search needs a connection.'
                  : `Nobody matches “${query.trim()}”.`
                : 'Search for anyone on Payhankey to start a conversation.'}
            </Text>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontFamily: FONT, flex: 1, fontSize: 22, fontWeight: '800' },
  close: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  offlineRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  offlineText: { fontFamily: FONT, fontSize: 12, fontWeight: '600', flexShrink: 1 },
  section: {
    fontFamily: FONT,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    paddingTop: 10,
    paddingBottom: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rowText: { flex: 1, gap: 2 },
  name: { fontFamily: FONT, fontSize: 15, fontWeight: '700' },
  handle: { fontFamily: FONT, fontSize: 12, fontWeight: '500' },
  existing: { fontFamily: FONT, fontSize: 12, fontWeight: '800' },
  spinner: { paddingVertical: 24 },
  empty: { fontFamily: FONT, fontSize: 13, fontWeight: '500', textAlign: 'center', paddingTop: 24 },
});
