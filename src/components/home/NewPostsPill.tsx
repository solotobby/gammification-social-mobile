import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { fetchPost, tintFor } from '../../api/timeline';
import { prependToFeed } from '../../hooks/useTimeline';
import { useFollowStore } from '../../stores/followStore';
import { useHiddenStore } from '../../stores/hiddenStore';
import { useNewPostsStore, type NewPost } from '../../stores/newPostsStore';
import { useViewedStore } from '../../stores/viewedStore';
import { brand } from '../../theme/colors';
import { FONT } from '../../theme/fonts';
import { Avatar } from '../ui/Avatar';
import type { FeedTab } from './FeedTabs';

/** Faces shown on the pill — enough to say who posted. */
const MAX_FACES = 3;

/**
 * "↑ 3 new posts" — floats over the top of Home's feed once other people
 * publish while it's open (realtime `post.created`, src/stores/newPostsStore.ts).
 *
 * The event carries no media and nothing about the viewer, so tapping fetches
 * each post in full, puts them at the top of the feed and scrolls there. On
 * this API fetching a post is also what counts a view (there's no view
 * endpoint — see `recordPostView`), the same call the on-screen view tracker
 * makes, so they're claimed in viewedStore and it doesn't make it again.
 *
 * Following only counts people you follow, and hidden posts never count.
 */
export function NewPostsPill({
  top,
  feedTab,
  feedPostIds,
  onShown,
}: {
  /** Where the feed list starts — the pill floats just inside it. */
  top: number;
  feedTab: FeedTab;
  /** Posts already in the feed — a pull-to-refresh can bring a new one in. */
  feedPostIds: Set<string>;
  onShown: () => void;
}) {
  const queryClient = useQueryClient();
  const pending = useNewPostsStore((s) => s.posts);
  const hiddenIds = useHiddenStore((s) => s.ids);
  const followed = useFollowStore((s) => s.following);
  const [loading, setLoading] = useState(false);

  const visible = useMemo(
    () =>
      pending.filter(
        (post) =>
          !feedPostIds.has(post.id) &&
          !hiddenIds.includes(post.id) &&
          (feedTab !== 'following' || !!followed[post.authorId]),
      ),
    [pending, feedPostIds, hiddenIds, feedTab, followed],
  );

  // One that reached the feed some other way (a refresh) isn't new any more.
  useEffect(() => {
    const arrived = pending.filter((post) => feedPostIds.has(post.id)).map((post) => post.id);
    if (arrived.length) useNewPostsStore.getState().remove(arrived);
  }, [pending, feedPostIds]);

  // Keep showing the last count while the pill animates away.
  const shownPosts = useRef<NewPost[]>([]);
  if (visible.length) shownPosts.current = visible;
  const present = visible.length > 0;

  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.spring(progress, {
      toValue: present ? 1 : 0,
      friction: 8,
      tension: 90,
      useNativeDriver: true,
    }).start();
  }, [present, progress]);

  const show = async () => {
    if (loading) return;
    setLoading(true);
    const ids = visible.map((post) => post.id);
    const results = await Promise.allSettled(ids.map((id) => fetchPost(id)));
    const posts = results.flatMap((result) =>
      result.status === 'fulfilled' && result.value?.post ? [result.value.post] : [],
    );
    posts.forEach((post) => useViewedStore.getState().claim(post.id));
    prependToFeed(queryClient, posts);
    // Whether or not each one could still be fetched (deleted meanwhile, say),
    // none of them is new any more.
    useNewPostsStore.getState().remove(ids);
    setLoading(false);
    onShown();
  };

  const count = shownPosts.current.length;
  const faces = shownPosts.current
    .filter((post, index, all) => all.findIndex((p) => p.authorId === post.authorId) === index)
    .slice(0, MAX_FACES);

  return (
    <Animated.View
      pointerEvents={present ? 'box-none' : 'none'}
      style={[
        styles.wrap,
        {
          top: top + 10,
          opacity: progress,
          transform: [
            { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [-14, 0] }) },
            { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) },
          ],
        },
      ]}
    >
      <Pressable
        onPress={() => void show()}
        accessibilityRole="button"
        accessibilityLabel={`Show ${count} new ${count === 1 ? 'post' : 'posts'}`}
        style={({ pressed }) => [styles.pressable, { opacity: pressed ? 0.85 : 1 }]}
      >
        <LinearGradient
          colors={[brand.violet, brand.violetBright]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.pill}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name="arrow-up" size={15} color="#FFFFFF" />
          )}
          <View style={styles.faces}>
            {faces.map((post, index) => (
              <View key={post.authorId} style={[styles.face, index > 0 && styles.faceOverlap]}>
                <Avatar
                  name={post.authorName || '?'}
                  uri={post.authorAvatar}
                  tint={tintFor(post.authorId)}
                  userId={post.authorId}
                  size={22}
                />
              </View>
            ))}
          </View>
          <Text style={styles.label} numberOfLines={1}>
            {count} new {count === 1 ? 'post' : 'posts'}
          </Text>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  pressable: {
    borderRadius: 20,
    shadowColor: brand.violet,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 38,
    paddingLeft: 12,
    paddingRight: 16,
    borderRadius: 20,
  },
  faces: { flexDirection: 'row', alignItems: 'center' },
  face: { borderRadius: 13, borderWidth: 2, borderColor: brand.violet },
  faceOverlap: { marginLeft: -8 },
  label: { fontFamily: FONT, fontSize: 13, fontWeight: '800', color: '#FFFFFF' },
});
