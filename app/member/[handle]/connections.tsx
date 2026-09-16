import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Connection } from '../../../src/api/user';
import { BackButton } from '../../../src/components/ui/BackButton';
import { ScreenBackground } from '../../../src/components/ui/ScreenBackground';
import { MemberRow } from '../../../src/components/members/MemberRow';
import { useConnections, type ConnectionKind } from '../../../src/hooks/useConnections';
import { useAuthStore } from '../../../src/stores/authStore';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { FONT } from '../../../src/theme/fonts';

/**
 * Followers / Following — `GET /user/profile/{username}/followers|following`.
 *
 * These endpoints are new (2026-09-16) and notable for being the first member
 * lists in the app that report `is_following` per row, so every follow button
 * here renders its true initial state instead of always starting on "Follow".
 *
 * One screen with two tabs rather than two routes: the lists are the same shape
 * and people flip between them constantly.
 */
export default function ConnectionsScreen() {
  const { colors, radius, spacing } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { handle, tab } = useLocalSearchParams<{ handle: string; tab?: ConnectionKind }>();

  const [kind, setKind] = useState<ConnectionKind>(tab === 'following' ? 'following' : 'followers');

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage, refetch, isRefetching } =
    useConnections(handle, kind);
  const rows = data?.pages.flatMap((page) => page.data) ?? [];
  const total = data?.pages[0]?.total ?? 0;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScreenBackground />
      <FlatList
        data={rows}
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
          gap: spacing.sm,
        }}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.headerRow}>
              <BackButton onPress={() => router.back()} />
              <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
                @{handle}
              </Text>
              <View style={{ width: 44 }} />
            </View>

            <View
              style={[
                styles.tabs,
                { backgroundColor: colors.surfaceAlt, borderRadius: radius.pill },
              ]}
            >
              {(['followers', 'following'] as const).map((option) => (
                <Pressable
                  key={option}
                  onPress={() => setKind(option)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: kind === option }}
                  style={[
                    styles.tab,
                    { borderRadius: radius.pill },
                    kind === option && { backgroundColor: colors.surface },
                  ]}
                >
                  <Text
                    style={[
                      styles.tabText,
                      { color: kind === option ? colors.text : colors.textMuted },
                    ]}
                  >
                    {option === 'followers' ? 'Followers' : 'Following'}
                    {kind === option && total ? ` · ${total}` : ''}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        }
        renderItem={({ item }) => <ConnectionRow row={item} />}
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.empty}>
              <ActivityIndicator color={colors.brand} />
            </View>
          ) : (
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={28} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                {kind === 'followers'
                  ? 'No followers yet.'
                  : 'Not following anyone yet.'}
              </Text>
            </View>
          )
        }
      />
    </View>
  );
}

/**
 * One row. Delegates to the shared `MemberRow` so the follow button behaves
 * identically to Discover and search — optimistic, mirrored into `followStore`,
 * rolled back on failure — with two differences these lists can supply and the
 * others can't: a real `is_following` seed, and the member's bio in place of a
 * follower count the endpoint doesn't send.
 */
function ConnectionRow({ row }: { row: Connection }) {
  const myId = useAuthStore((s) => s.user?.id);
  // `is_me` comes from the server; the id match is belt-and-braces.
  if (row.isMe || row.id === myId) {
    return (
      <MemberRow
        member={toMemberVM(row)}
        subtitle={row.about ? `@${row.handle} · ${row.about}` : `@${row.handle}`}
      />
    );
  }
  return (
    <MemberRow
      member={toMemberVM(row)}
      initiallyFollowing={row.isFollowing}
      subtitle={row.about ? `@${row.handle} · ${row.about}` : `@${row.handle}`}
    />
  );
}

/** Connection → the `Member` shape MemberRow renders. */
function toMemberVM(row: Connection) {
  return {
    id: row.id,
    name: row.name,
    handle: row.handle,
    tint: row.tint,
    avatar: row.avatar,
    engagements: 0,
    followers: 0,
    following: 0,
  };
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { gap: 14, marginBottom: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontFamily: FONT, flex: 1, fontSize: 17, fontWeight: '800', textAlign: 'center' },
  tabs: { flexDirection: 'row', padding: 4, gap: 4 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 9 },
  tabText: { fontFamily: FONT, fontSize: 14, fontWeight: '700' },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 60 },
  emptyText: { fontFamily: FONT, fontSize: 14, fontWeight: '600' },
});
