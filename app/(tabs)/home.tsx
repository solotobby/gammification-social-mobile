import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
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
import { TAB_BAR_CLEARANCE } from '../../src/components/navigation/TabBar';
import { GhostButton } from '../../src/components/ui/GhostButton';
import { ScreenBackground } from '../../src/components/ui/ScreenBackground';
import { useFeed } from '../../src/hooks/useTimeline';
import { type Post } from '../../src/data/community';
import { useTheme } from '../../src/theme/ThemeProvider';

/**
 * Home tab — stories rail, composer entry, and the live timeline feed
 * (GET /timeline/feed). Pages stream in as you approach the bottom;
 * pull down to refresh.
 */
export default function HomeScreen() {
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const feed = useFeed();
  const posts = useMemo(
    () => feed.data?.pages.flatMap((page) => page.data.map(toPost)) ?? [],
    [feed.data],
  );

  const loadMore = useCallback(() => {
    if (feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage();
  }, [feed]);

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
            <HomeHeader />
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
