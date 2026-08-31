import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { ActivityIndicator, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { toBlogPost } from '../../src/api/blog';
import { BackButton } from '../../src/components/ui/BackButton';
import { GhostButton } from '../../src/components/ui/GhostButton';
import { ScreenBackground } from '../../src/components/ui/ScreenBackground';
import { useBlogPost } from '../../src/hooks/useBlog';
import { useTheme } from '../../src/theme/ThemeProvider';
import { FONT } from '../../src/theme/fonts';

/**
 * One blog story — GET /blogs/{slug}.
 *
 * The body arrives as rich text, and the app carries no HTML renderer (that
 * would be a new native-ish dependency for one screen), so `toBlogPost` flattens
 * the markup and this splits the result into paragraphs. Swap in a real renderer
 * if the stories ever need images or links inline.
 */
export default function BlogPostScreen() {
  const { colors, radius, spacing } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { slug } = useLocalSearchParams<{ slug: string }>();
  const query = useBlogPost(slug);

  const post = useMemo(() => (query.data ? toBlogPost(query.data) : undefined), [query.data]);
  const paragraphs = useMemo(
    () => (post?.body ? post.body.split(/\n{2,}/).filter((p) => p.trim()) : []),
    [post?.body],
  );

  const share = () => {
    if (!post) return;
    void Share.share({
      message: `${post.title}\n\nhttps://payhankey.com/blog/${post.slug}`,
    });
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScreenBackground />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + spacing.lg,
          paddingBottom: insets.bottom + spacing.xl,
          paddingHorizontal: spacing.xl,
          gap: spacing.lg,
        }}
      >
        <View style={styles.headerRow}>
          <BackButton onPress={() => router.back()} />
          <Text style={[styles.headerTitle, { color: colors.text }]}>Story</Text>
          <Ionicons
            name="share-outline"
            size={22}
            color={post ? colors.text : 'transparent'}
            onPress={share}
            accessibilityRole="button"
            accessibilityLabel="Share this story"
            style={{ width: 44, textAlign: 'right' }}
          />
        </View>

        {query.isLoading ? (
          <View style={styles.stateWrap}>
            <ActivityIndicator color={colors.brand} />
          </View>
        ) : query.isError || !post ? (
          <View style={styles.stateWrap}>
            <Text style={[styles.stateText, { color: colors.textMuted }]}>
              {query.error && (query.error as { status?: number }).status === 404
                ? "That story isn't available any more."
                : "Couldn't load this story."}
            </Text>
            <GhostButton label="Retry" onPress={() => void query.refetch()} />
          </View>
        ) : (
          <>
            {post.image ? (
              <Image
                source={{ uri: post.image }}
                style={[styles.cover, { borderRadius: radius.lg }]}
                contentFit="cover"
                transition={180}
              />
            ) : null}

            <View style={{ gap: 10 }}>
              <View style={[styles.categoryPill, { backgroundColor: colors.surfaceAlt }]}>
                <Text style={[styles.categoryText, { color: colors.brand }]}>{post.category}</Text>
              </View>
              <Text style={[styles.title, { color: colors.text }]}>{post.title}</Text>
              <Text style={[styles.meta, { color: colors.textMuted }]}>
                {[post.date, `${post.readMinutes} min read`].filter(Boolean).join(' · ')}
              </Text>
            </View>

            {paragraphs.length ? (
              <View style={{ gap: spacing.md }}>
                {paragraphs.map((paragraph, index) => (
                  <Text key={index} style={[styles.body, { color: colors.textSecondary }]}>
                    {paragraph}
                  </Text>
                ))}
              </View>
            ) : (
              <Text style={[styles.body, { color: colors.textSecondary }]}>{post.excerpt}</Text>
            )}
          </>
        )}
      </ScrollView>
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
  cover: { width: '100%', height: 200 },
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
  title: { fontFamily: FONT, fontSize: 24, lineHeight: 31, fontWeight: '800' },
  meta: { fontFamily: FONT, fontSize: 12, fontWeight: '600' },
  body: { fontFamily: FONT, fontSize: 15, lineHeight: 24, fontWeight: '500' },
  stateWrap: { alignItems: 'center', gap: 14, paddingVertical: 40, paddingHorizontal: 24 },
  stateText: { fontFamily: FONT, fontSize: 14, fontWeight: '600', textAlign: 'center' },
});
