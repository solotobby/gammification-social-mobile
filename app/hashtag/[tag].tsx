import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { toPost } from '../../src/api/timeline';
import { PostCard } from '../../src/components/feed/PostCard';
import { BackButton } from '../../src/components/ui/BackButton';
import { GhostButton } from '../../src/components/ui/GhostButton';
import { ScreenBackground } from '../../src/components/ui/ScreenBackground';
import { type Post } from '../../src/data/community';
import { useHashtagPosts } from '../../src/hooks/useExplore';
import { useTheme } from '../../src/theme/ThemeProvider';

/** Posts carrying a hashtag — reached from the trending topic chips/rows. */
export default function HashtagScreen() {
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { tag } = useLocalSearchParams<{ tag: string }>();
  const hashtag = tag ?? '';

  const query = useHashtagPosts(hashtag);
  const posts = useMemo(
    () => query.data?.pages.flatMap((page) => page.data.map(toPost)) ?? [],
    [query.data],
  );

  const loadMore = useCallback(() => {
    if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
  }, [query]);

  const openPost = useCallback((post: Post) => router.push(`/post/${post.id}`), [router]);

  const header = (
    <View style={{ gap: spacing.lg }}>
      <View style={styles.headerRow}>
        <BackButton onPress={() => router.back()} />
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
          #{hashtag}
        </Text>
        <View style={{ width: 44 }} />
      </View>
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScreenBackground />
      <FlatList
        data={posts}
        keyExtractor={(post) => post.id}
        ListHeaderComponent={header}
        renderItem={({ item }) => <PostCard post={item} onOpen={openPost} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.6}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          query.isLoading ? (
            <View style={styles.stateWrap}>
              <ActivityIndicator color={colors.brand} />
              <Text style={[styles.stateText, { color: colors.textMuted }]}>Loading posts…</Text>
            </View>
          ) : query.isError ? (
            <View style={styles.stateWrap}>
              <Text style={[styles.stateText, { color: colors.textMuted }]}>
                Couldn't load posts for this hashtag.
              </Text>
              <GhostButton label="Retry" onPress={() => void query.refetch()} />
            </View>
          ) : (
            <View style={styles.stateWrap}>
              <Text style={[styles.stateText, { color: colors.textMuted }]}>
                No posts under #{hashtag} yet.
              </Text>
            </View>
          )
        }
        ListFooterComponent={
          query.isFetchingNextPage ? (
            <ActivityIndicator color={colors.brand} style={{ paddingVertical: 16 }} />
          ) : null
        }
        contentContainerStyle={{
          paddingTop: insets.top + spacing.lg,
          paddingBottom: insets.bottom + spacing.xl,
          paddingHorizontal: spacing.xl,
          gap: spacing.lg,
        }}
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
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '800' },
  stateWrap: { alignItems: 'center', gap: 14, paddingVertical: 34, paddingHorizontal: 24 },
  stateText: { fontSize: 14, fontWeight: '600', textAlign: 'center', lineHeight: 20 },
});
