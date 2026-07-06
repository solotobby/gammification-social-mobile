import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PostCard } from '../../src/components/feed/PostCard';
import { HomeHeader } from '../../src/components/home/HomeHeader';
import { TAB_BAR_CLEARANCE } from '../../src/components/navigation/TabBar';
import { ScreenBackground } from '../../src/components/ui/ScreenBackground';
import { feedPosts, type Post } from '../../src/data/community';
import { FEED_MAX_PAGES, fetchFeedPage } from '../../src/data/feed';
import { useTheme } from '../../src/theme/ThemeProvider';

/**
 * Home tab — stories rail, composer entry, and the infinite feed. Rendered
 * with a FlatList: the seed posts load first and older pages stream in as
 * you approach the bottom.
 */
export default function HomeScreen() {
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Seed feed snapshot + generated pages appended below it.
  const [posts, setPosts] = useState<Post[]>(() => [...feedPosts]);
  const [loadingMore, setLoadingMore] = useState(false);
  const pageRef = useRef(0);
  const loadedRef = useRef<Post[]>([]);
  const exhausted = pageRef.current >= FEED_MAX_PAGES;

  // Re-snapshot the in-memory seed feed (new composed posts) when returning
  // from Compose / Post detail, keeping already-loaded pages in place.
  useFocusEffect(
    useCallback(() => {
      setPosts([...feedPosts, ...loadedRef.current]);
    }, []),
  );

  const loadMore = useCallback(async () => {
    if (loadingMore || pageRef.current >= FEED_MAX_PAGES) return;
    setLoadingMore(true);
    const page = await fetchFeedPage(pageRef.current + 1);
    pageRef.current += 1;
    loadedRef.current = [...loadedRef.current, ...page];
    setPosts([...feedPosts, ...loadedRef.current]);
    setLoadingMore(false);
  }, [loadingMore]);

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
        ListHeaderComponent={<HomeHeader />}
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footer}>
              <ActivityIndicator color={colors.brand} />
              <Text style={[styles.footerText, { color: colors.textMuted }]}>
                Loading more posts…
              </Text>
            </View>
          ) : exhausted ? (
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
});
