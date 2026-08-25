import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PostCard } from '../src/components/feed/PostCard';
import { BackButton } from '../src/components/ui/BackButton';
import { GhostButton } from '../src/components/ui/GhostButton';
import { ScreenBackground } from '../src/components/ui/ScreenBackground';
import { type Post } from '../src/data/community';
import { useBookmarkStore } from '../src/stores/bookmarkStore';
import { useTheme } from '../src/theme/ThemeProvider';
import { FONT } from '../src/theme/fonts';

/**
 * Bookmarks — posts saved with the bookmark action on a feed card.
 *
 * Cards render from the stored snapshot, so counts are frozen at the moment
 * they were saved; tapping through opens the live post detail.
 */
export default function BookmarksScreen() {
  const { colors, radius, spacing } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const posts = useBookmarkStore((s) => s.posts);
  const clear = useBookmarkStore((s) => s.reset);

  const openPost = useCallback((post: Post) => router.push(`/post/${post.id}`), [router]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScreenBackground />
      <FlatList
        data={posts}
        keyExtractor={(post) => post.id}
        renderItem={({ item }) => <PostCard post={item} onOpen={openPost} />}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={{ gap: spacing.xl, paddingBottom: spacing.lg }}>
            <View style={styles.headerRow}>
              <BackButton onPress={() => router.back()} />
              <Text style={[styles.headerTitle, { color: colors.text }]}>Bookmarked</Text>
              {posts.length ? (
                <Pressable
                  onPress={clear}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Clear all bookmarks"
                  style={styles.clear}
                >
                  <Text style={[styles.clearText, { color: colors.textMuted }]}>Clear</Text>
                </Pressable>
              ) : (
                <View style={{ width: 44 }} />
              )}
            </View>
            {posts.length ? (
              <Text style={[styles.count, { color: colors.textMuted }]}>
                {posts.length} saved {posts.length === 1 ? 'post' : 'posts'}
              </Text>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <View
            style={[
              styles.emptyCard,
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
  headerTitle: { fontFamily: FONT, fontSize: 18, fontWeight: '800' },
  clear: { width: 44, alignItems: 'flex-end' },
  clearText: { fontFamily: FONT, fontSize: 14, fontWeight: '700' },
  count: { fontFamily: FONT, fontSize: 13, fontWeight: '600' },
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
