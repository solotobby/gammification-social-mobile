import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { toPost } from '../../src/api/timeline';
import { PostCard } from '../../src/components/feed/PostCard';
import { HomeHeader } from '../../src/components/home/HomeHeader';
import { type FeedTab } from '../../src/components/home/FeedTabs';
import { TAB_BAR_CLEARANCE } from '../../src/components/navigation/TabBar';
import { GhostButton } from '../../src/components/ui/GhostButton';
import { ScreenBackground } from '../../src/components/ui/ScreenBackground';
import { useFeed } from '../../src/hooks/useTimeline';
import { useFollowStore } from '../../src/stores/followStore';
import { useHiddenStore } from '../../src/stores/hiddenStore';
import { type Post } from '../../src/data/community';
import { useTheme } from '../../src/theme/ThemeProvider';

/**
 * Home tab — monetization signal, stories rail, composer entry, and the live
 * timeline feed (GET /timeline/feed) under a For You / Following filter. Pages
 * stream in as you approach the bottom; pull down to refresh.
 */
export default function HomeScreen() {
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [feedTab, setFeedTab] = useState<FeedTab>('for-you');

  const feed = useFeed();

  // "Hide this post" has no endpoint, so hidden ids are filtered out here
  // rather than server-side (src/stores/hiddenStore.ts).
  const hiddenIds = useHiddenStore((s) => s.ids);
  const allPosts = useMemo(
    () =>
      (feed.data?.pages.flatMap((page) => page.data.map(toPost)) ?? []).filter(
        (post) => !hiddenIds.includes(post.id),
      ),
    [feed.data, hiddenIds],
  );

  // There is no following feed endpoint yet — /timeline/feed returns one
  // stream and carries no `is_following` flag — so Following is filtered on the
  // client against the device's follow set (src/stores/followStore.ts). When the
  // backend grows `GET /timeline/feed?filter=following`, this becomes a second
  // query and the filter goes away.
  const followedIds = useFollowStore((s) => s.following);
  const posts = useMemo(
    () =>
      feedTab === 'following'
        ? allPosts.filter((post) => !!post.ownerId && !!followedIds[post.ownerId])
        : allPosts,
    [allPosts, feedTab, followedIds],
  );

  const loadMore = useCallback(() => {
    if (feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage();
  }, [feed]);

  // A filtered page can yield zero Following posts, and an empty list never
  // reaches onEndReached — so pull a few more pages to look for matches. Capped
  // per visit so following nobody doesn't walk the whole timeline; past the cap
  // the empty state takes over.
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = feed;
  const autoPagesFetched = useRef(0);
  useEffect(() => {
    if (feedTab !== 'following') {
      autoPagesFetched.current = 0;
      return;
    }
    if (posts.length >= 5 || autoPagesFetched.current >= 3) return;
    if (!hasNextPage || isFetchingNextPage) return;
    autoPagesFetched.current += 1;
    void fetchNextPage();
  }, [feedTab, posts.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const [refreshing, setRefreshing] = useState(false);
  const { refetch } = feed;
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  const openPost = useCallback((post: Post) => router.push(`/post/${post.id}`), [router]);

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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            // iOS renders our own indicator (below) instead — the native one is
            // hidden on EVERY iOS version so two spinners can never show.
            // Android keeps its native material spinner, tinted to the brand.
            tintColor="transparent"
            colors={[colors.brand]}
          />
        }
        ListHeaderComponent={
          <>
            {/* RN's RefreshControl spinner doesn't render at all on iOS 26, so
                iOS uses this indicator instead (native one is tinted
                transparent above). Android shows only its native spinner. */}
            {refreshing && Platform.OS === 'ios' ? (
              <View style={styles.refreshRow}>
                <ActivityIndicator size="large" color={colors.brand} />
              </View>
            ) : null}
            <HomeHeader feedTab={feedTab} onChangeFeedTab={setFeedTab} />
          </>
        }
        ListEmptyComponent={
          feed.isLoading ? (
            <View style={styles.stateWrap}>
              <ActivityIndicator color={colors.brand} />
              <Text style={[styles.stateText, { color: colors.textMuted }]}>
                Loading your feed…
              </Text>
            </View>
          ) : feed.isError ? (
            <View style={styles.stateWrap}>
              <Text style={[styles.stateText, { color: colors.textMuted }]}>
                We couldn't load the feed. Check your connection and try again.
              </Text>
              <GhostButton label="Retry" onPress={() => void feed.refetch()} />
            </View>
          ) : feedTab === 'following' ? (
            <View style={styles.stateWrap}>
              <Text style={[styles.stateText, { color: colors.textMuted }]}>
                Nothing from the people you follow yet. Follow a few creators and
                their posts land here.
              </Text>
              <GhostButton label="Find people" onPress={() => router.push('/discover')} />
            </View>
          ) : (
            <View style={styles.stateWrap}>
              <Text style={[styles.stateText, { color: colors.textMuted }]}>
                No posts yet — be the first to say something amazing.
              </Text>
            </View>
          )
        }
        ListFooterComponent={
          feed.isFetchingNextPage ? (
            <View style={styles.footer}>
              <ActivityIndicator color={colors.brand} />
              <Text style={[styles.footerText, { color: colors.textMuted }]}>
                Loading more posts…
              </Text>
            </View>
          ) : posts.length && !feed.hasNextPage ? (
            <View style={styles.footer}>
              <Text style={[styles.footerText, { color: colors.textMuted }]}>
                You're all caught up ✨
              </Text>
            </View>
          ) : null
        }
        contentContainerStyle={{
          paddingTop: insets.top + spacing.lg,
          paddingBottom: insets.bottom + TAB_BAR_CLEARANCE,
          paddingHorizontal: spacing.xl,
          gap: spacing.lg,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
  },
  footerText: { fontSize: 13, fontWeight: '700' },
  refreshRow: { alignItems: 'center', paddingBottom: 14 },
  stateWrap: {
    alignItems: 'center',
    gap: 14,
    paddingVertical: 34,
    paddingHorizontal: 24,
  },
  stateText: { fontSize: 14, fontWeight: '600', textAlign: 'center', lineHeight: 20 },
});
