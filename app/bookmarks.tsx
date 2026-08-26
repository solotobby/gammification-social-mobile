import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { toPost } from '../src/api/timeline';
import { FEED_GUTTER, PostCard } from '../src/components/feed/PostCard';
import { BackButton } from '../src/components/ui/BackButton';
import { GhostButton } from '../src/components/ui/GhostButton';
import { ScreenBackground } from '../src/components/ui/ScreenBackground';
import { type Post } from '../src/data/community';
import { useBookmarks } from '../src/hooks/useTimeline';
import { useTheme } from '../src/theme/ThemeProvider';
import { FONT } from '../src/theme/fonts';

/**
 * Bookmarks — GET /timeline/bookmarks, the posts saved with the bookmark action
 * on a feed card.
 *
 * The list is server-side and per-account (it used to be a per-device snapshot
 * in AsyncStorage, back when there was no endpoint), so the cards carry live
 * counts and a save made on the web shows up here. Unbookmarking from a card
 * invalidates this query, so the row leaves on the next fetch.
 */
export default function BookmarksScreen() {
  const { colors, radius, spacing } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const query = useBookmarks();
  const posts: Post[] = useMemo(
    () => (query.data?.pages ?? []).flatMap((page) => page.data).map(toPost),
    [query.data],
  );
  const total = query.data?.pages[0]?.total ?? posts.length;

  const openPost = useCallback((post: Post) => router.push(`/post/${post.id}`), [router]);

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;
  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScreenBackground />
      <FlatList
        data={posts}
        keyExtractor={(post) => post.id}
        renderItem={({ item }) => <PostCard post={item} onOpen={openPost} />}
        showsVerticalScrollIndicator={false}
        onEndReached={loadMore}
        onEndReachedThreshold={0.6}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          // Posts run full-bleed, so the list has no horizontal padding and
          // everything that isn't a post re-applies the gutter itself.
          <View style={[styles.gutter, { gap: spacing.xl, paddingBottom: spacing.lg }]}>
            <View style={styles.headerRow}>
              <BackButton onPress={() => router.back()} />
              <Text style={[styles.headerTitle, { color: colors.text }]}>Bookmarked</Text>
              <View style={{ width: 44 }} />
            </View>
            {posts.length ? (
              <Text style={[styles.count, { color: colors.textMuted }]}>
                {total} saved {total === 1 ? 'post' : 'posts'}
              </Text>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          query.isLoading ? (
            <View style={[styles.stateWrap, styles.gutter]}>
              <ActivityIndicator color={colors.brand} />
              <Text style={[styles.emptyBlurb, { color: colors.textMuted }]}>
                Loading your saved posts…
              </Text>
            </View>
          ) : query.isError ? (
            <View
              style={[
                styles.emptyCard,
                styles.gutterMargin,
                { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg },
              ]}
            >
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                Couldn't load your bookmarks
              </Text>
              <Text style={[styles.emptyBlurb, { color: colors.textMuted }]}>
                Check your connection and try again.
              </Text>
              <GhostButton label="Retry" onPress={() => void query.refetch()} />
            </View>
          ) : (
            <View
              style={[
                styles.emptyCard,
                styles.gutterMargin,
                { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg },
              ]}
            >
              <View style={[styles.emptyIcon, { backgroundColor: `${colors.brand}1A` }]}>
                <Ionicons name="bookmark" size={22} color={colors.brand} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                No bookmarked posts yet
              </Text>
              <Text style={[styles.emptyBlurb, { color: colors.textMuted }]}>
                Tap the bookmark icon on any post to find it here later.
              </Text>
              <GhostButton label="Browse feed" onPress={() => router.push('/home')} />
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
        contentContainerStyle={{
          paddingTop: insets.top + spacing.lg,
          paddingBottom: insets.bottom + spacing.xl,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  gutter: { paddingHorizontal: FEED_GUTTER },
  gutterMargin: { marginHorizontal: FEED_GUTTER },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { fontFamily: FONT, fontSize: 18, fontWeight: '800' },
  count: { fontFamily: FONT, fontSize: 13, fontWeight: '600' },
  stateWrap: { alignItems: 'center', gap: 12, paddingVertical: 40 },
  footer: { alignItems: 'center', paddingVertical: 20 },
  emptyCard: {
    alignItems: 'center',
    gap: 10,
    padding: 30,
    borderWidth: StyleSheet.hairlineWidth,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  emptyTitle: { fontFamily: FONT, fontSize: 16, fontWeight: '800' },
  emptyBlurb: {
    fontFamily: FONT,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 6,
  },
});
