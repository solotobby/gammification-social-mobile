import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { toTopic } from '../src/api/explore';
import { BackButton } from '../src/components/ui/BackButton';
import { GhostButton } from '../src/components/ui/GhostButton';
import { ScreenBackground } from '../src/components/ui/ScreenBackground';
import { useTrendingHashtags } from '../src/hooks/useExplore';
import { useTheme } from '../src/theme/ThemeProvider';
import { FONT } from '../src/theme/fonts';

/** Full ranked list behind the dashboard's "Trending Topics" card. */
export default function TrendingTopicsScreen() {
  const { colors, radius, spacing } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const query = useTrendingHashtags();
  const topics = useMemo(
    () => query.data?.pages.flatMap((page) => page.data.map(toTopic)) ?? [],
    [query.data],
  );

  const loadMore = useCallback(() => {
    if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
  }, [query]);

  const header = (
    <View style={{ gap: spacing.xl }}>
      <View style={styles.headerRow}>
        <BackButton onPress={() => router.back()} />
        <Text style={[styles.headerTitle, { color: colors.text }]}>Trending topics</Text>
        <View style={{ width: 44 }} />
      </View>

      <View
        style={[
          styles.subBanner,
          { backgroundColor: `${colors.gold}14`, borderColor: `${colors.gold}40`, borderRadius: radius.md },
        ]}
      >
        <Ionicons name="flame" size={18} color={colors.gold} />
        <Text style={[styles.subText, { color: colors.text }]}>
          Post with a trending hashtag to ride the wave — trending posts get more
          engagements, and engagements pay.
        </Text>
      </View>
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScreenBackground />
      <FlatList
        data={topics}
        keyExtractor={(topic) => topic.id}
        ListHeaderComponent={header}
        renderItem={({ item, index }) => (
          <Pressable
            onPress={() => router.push(`/hashtag/${encodeURIComponent(item.tag)}`)}
            accessibilityRole="button"
            accessibilityLabel={`See posts tagged ${item.tag}`}
            style={({ pressed }) => [
              styles.row,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: radius.md,
                opacity: pressed ? 0.9 : 1,
              },
            ]}
          >
            <Text style={[styles.rank, { color: colors.textMuted }]}>{index + 1}</Text>
            <View style={styles.rowText}>
              <Text style={[styles.tag, { color: colors.brand }]}>#{item.tag}</Text>
              <Text style={[styles.count, { color: colors.textMuted }]}>
                {item.posts} {item.posts === 1 ? 'post' : 'posts'}
              </Text>
            </View>
            <Ionicons name="trending-up" size={20} color={colors.mint} />
          </Pressable>
        )}
        onEndReached={loadMore}
        onEndReachedThreshold={0.6}
        ListEmptyComponent={
          query.isLoading ? (
            <View style={styles.stateWrap}>
              <ActivityIndicator color={colors.brand} />
            </View>
          ) : query.isError ? (
            <View style={styles.stateWrap}>
              <Text style={[styles.stateText, { color: colors.textMuted }]}>
                Couldn't load trending topics.
              </Text>
              <GhostButton label="Retry" onPress={() => void query.refetch()} />
            </View>
          ) : (
            <View style={styles.stateWrap}>
              <Text style={[styles.stateText, { color: colors.textMuted }]}>
                No trending topics yet.
              </Text>
            </View>
          )
        }
        ListFooterComponent={
          query.isFetchingNextPage ? (
            <ActivityIndicator color={colors.brand} style={{ paddingVertical: 16 }} />
          ) : null
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + spacing.lg,
          paddingBottom: insets.bottom + spacing.xl,
          paddingHorizontal: spacing.xl,
          gap: spacing.md,
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
  subBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderWidth: 1,
  },
  subText: { fontFamily: FONT, flex: 1, fontSize: 13, lineHeight: 19, fontWeight: '500' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rank: { fontFamily: FONT, width: 22, fontSize: 16, fontWeight: '900', textAlign: 'center' },
  rowText: { flex: 1, gap: 2 },
  tag: { fontFamily: FONT, fontSize: 16, fontWeight: '800' },
  count: { fontFamily: FONT, fontSize: 12, fontWeight: '600' },
  stateWrap: { alignItems: 'center', gap: 14, paddingVertical: 34, paddingHorizontal: 24 },
  stateText: { fontFamily: FONT, fontSize: 14, fontWeight: '600', textAlign: 'center' },
});
