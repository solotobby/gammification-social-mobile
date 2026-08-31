import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { toBlogPost, type BlogPost } from '../src/api/blog';
import { BackButton } from '../src/components/ui/BackButton';
import { GhostButton } from '../src/components/ui/GhostButton';
import { ScreenBackground } from '../src/components/ui/ScreenBackground';
import { useBlogs } from '../src/hooks/useBlog';
import { useTheme } from '../src/theme/ThemeProvider';
import { FONT } from '../src/theme/fonts';

/**
 * Blog — tips & product stories from GET /blogs (paginated). The newest story
 * gets the featured gradient treatment; every card opens `/blog/[slug]`.
 */
export default function BlogScreen() {
  const { colors, brand, radius, spacing } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const query = useBlogs();
  const posts = useMemo(
    () => query.data?.pages.flatMap((page) => page.data.map(toBlogPost)) ?? [],
    [query.data],
  );

  const [featured, ...rest] = posts;

  const loadMore = useCallback(() => {
    if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
  }, [query]);

  const open = useCallback(
    (post: BlogPost) => {
      if (post.slug) router.push(`/blog/${encodeURIComponent(post.slug)}`);
    },
    [router],
  );

  const header = (
    <View style={{ gap: spacing.xl }}>
      <View style={styles.headerRow}>
        <BackButton onPress={() => router.back()} />
        <Text style={[styles.headerTitle, { color: colors.text }]}>Blog</Text>
        <View style={{ width: 44 }} />
      </View>

      {featured ? (
        <Pressable
          onPress={() => open(featured)}
          accessibilityRole="button"
          accessibilityLabel={`Read ${featured.title}`}
          style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1 })}
        >
          <LinearGradient
            colors={[brand.violetBright, brand.violet, brand.indigo]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.featured, { borderRadius: radius.lg, shadowColor: brand.violet }]}
          >
            <View style={styles.featuredPill}>
              <Ionicons name="sparkles" size={12} color="#FFFFFF" />
              <Text style={styles.featuredPillText}>Latest · {featured.category}</Text>
            </View>
            <Text style={styles.featuredTitle}>{featured.title}</Text>
            {featured.excerpt ? (
              <Text style={styles.featuredExcerpt} numberOfLines={3}>
                {featured.excerpt}
              </Text>
            ) : null}
            <Text style={styles.featuredMeta}>
              {[featured.date, `${featured.readMinutes} min read`].filter(Boolean).join(' · ')}
            </Text>
          </LinearGradient>
        </Pressable>
      ) : null}
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScreenBackground />
      <FlatList
        data={rest}
        keyExtractor={(post, index) => post.slug || `blog-${index}`}
        ListHeaderComponent={header}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => open(item)}
            accessibilityRole="button"
            accessibilityLabel={`Read ${item.title}`}
            style={({ pressed }) => [
              styles.card,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: radius.lg,
                opacity: pressed ? 0.9 : 1,
              },
            ]}
          >
            {item.image ? (
              <Image
                source={{ uri: item.image }}
                style={[styles.cardImage, { borderRadius: radius.md }]}
                contentFit="cover"
                transition={180}
              />
            ) : null}
            <View style={[styles.categoryPill, { backgroundColor: colors.surfaceAlt }]}>
              <Text style={[styles.categoryText, { color: colors.brand }]}>{item.category}</Text>
            </View>
            <Text style={[styles.cardTitle, { color: colors.text }]}>{item.title}</Text>
            {item.excerpt ? (
              <Text style={[styles.cardExcerpt, { color: colors.textSecondary }]} numberOfLines={3}>
                {item.excerpt}
              </Text>
            ) : null}
            <Text style={[styles.cardMeta, { color: colors.textMuted }]}>
              {[item.date, `${item.readMinutes} min read`].filter(Boolean).join(' · ')}
            </Text>
          </Pressable>
        )}
        onEndReached={loadMore}
        onEndReachedThreshold={0.6}
        ListEmptyComponent={
          // The featured card already covers the one-story case, so this only
          // shows when there is genuinely nothing (or nothing yet).
          featured ? null : query.isLoading ? (
            <View style={styles.stateWrap}>
              <ActivityIndicator color={colors.brand} />
            </View>
          ) : query.isError ? (
            <View style={styles.stateWrap}>
              <Text style={[styles.stateText, { color: colors.textMuted }]}>
                Couldn't load the blog.
              </Text>
              <GhostButton label="Retry" onPress={() => void query.refetch()} />
            </View>
          ) : (
            <View style={styles.stateWrap}>
              <Ionicons name="newspaper-outline" size={26} color={colors.textMuted} />
              <Text style={[styles.stateText, { color: colors.textMuted }]}>
                No stories published yet. Check back soon.
              </Text>
            </View>
          )
        }
        ListFooterComponent={
          query.isFetchingNextPage ? (
            <ActivityIndicator color={colors.brand} style={{ paddingVertical: 16 }} />
          ) : null
        }
        refreshing={query.isRefetching && !query.isFetchingNextPage}
        onRefresh={() => void query.refetch()}
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
  featured: {
    padding: 22,
    gap: 10,
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  featuredPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  featuredPillText: {
    fontFamily: FONT,
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  featuredTitle: { fontFamily: FONT, color: '#FFFFFF', fontSize: 21, lineHeight: 27, fontWeight: '800' },
  featuredExcerpt: {
    fontFamily: FONT,
    color: 'rgba(255,255,255,0.82)',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
  },
  featuredMeta: { fontFamily: FONT, color: 'rgba(255,255,255,0.65)', fontSize: 12, fontWeight: '600' },
  card: {
    padding: 18,
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cardImage: { width: '100%', height: 150, marginBottom: 2 },
  categoryPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  categoryText: {
    fontFamily: FONT,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  cardTitle: { fontFamily: FONT, fontSize: 17, lineHeight: 22, fontWeight: '800' },
  cardExcerpt: { fontFamily: FONT, fontSize: 13, lineHeight: 19, fontWeight: '500' },
  cardMeta: { fontFamily: FONT, fontSize: 12, fontWeight: '600' },
  stateWrap: { alignItems: 'center', gap: 14, paddingVertical: 34, paddingHorizontal: 24 },
  stateText: { fontFamily: FONT, fontSize: 14, fontWeight: '600', textAlign: 'center' },
});
