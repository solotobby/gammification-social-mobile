import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../theme/ThemeProvider';
import { Avatar } from '../ui/Avatar';
import type { Post } from '../../data/community';

type Props = {
  post: Post;
  /** Tap anywhere on the card (or the comment action) — opens the detail screen. */
  onOpen?: (post: Post) => void;
  /** Renders the body without the surrounding card chrome (used on the detail screen). */
  bare?: boolean;
};

/**
 * A feed post: author row with earned badge, body, hashtags, and the
 * like / comment / views / share action row. Like state is local-only (dummy).
 */
export function PostCard({ post, onOpen, bare }: Props) {
  const { colors, radius } = useTheme();
  const [liked, setLiked] = useState(false);

  const likeCount = post.likes + (liked ? 1 : 0);

  const content = (
    <>
      <View style={styles.headerRow}>
        <Avatar name={post.author.name} tint={post.author.tint} size={42} />
        <View style={styles.headerText}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {post.author.name}
          </Text>
          <Text style={[styles.meta, { color: colors.textMuted }]} numberOfLines={1}>
            @{post.author.handle} · {post.timeAgo}
          </Text>
        </View>
        <View
          style={[
            styles.earnedPill,
            { backgroundColor: `${colors.mint}1A`, borderColor: `${colors.mint}40` },
          ]}
        >
          <Ionicons name="trending-up" size={12} color={colors.mint} />
          <Text style={[styles.earnedText, { color: colors.mint }]}>
            ₦{post.earned.toFixed(2)}
          </Text>
        </View>
      </View>

      <Text style={[styles.body, { color: colors.text }]}>{post.body}</Text>

      {post.hashtags?.length ? (
        <View style={styles.tagRow}>
          {post.hashtags.map((tag) => (
            <Text key={tag} style={[styles.tag, { color: colors.brand }]}>
              #{tag}
            </Text>
          ))}
        </View>
      ) : null}

      <View style={[styles.actionRow, { borderTopColor: colors.border }]}>
        <Pressable
          onPress={() => setLiked((l) => !l)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={liked ? 'Unlike' : 'Like'}
          style={styles.action}
        >
          <Ionicons
            name={liked ? 'heart' : 'heart-outline'}
            size={19}
            color={liked ? colors.pink : colors.textMuted}
          />
          <Text style={[styles.actionText, { color: liked ? colors.pink : colors.textMuted }]}>
            {likeCount}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => onOpen?.(post)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Comments"
          style={styles.action}
        >
          <Ionicons name="chatbubble-outline" size={18} color={colors.textMuted} />
          <Text style={[styles.actionText, { color: colors.textMuted }]}>
            {post.comments.length}
          </Text>
        </Pressable>

        <View style={styles.action}>
          <Ionicons name="eye-outline" size={19} color={colors.textMuted} />
          <Text style={[styles.actionText, { color: colors.textMuted }]}>{post.views}</Text>
        </View>

        <Pressable hitSlop={8} accessibilityRole="button" accessibilityLabel="Share" style={styles.action}>
          <Ionicons name="share-social-outline" size={18} color={colors.textMuted} />
        </Pressable>
      </View>
    </>
  );

  if (bare) {
    return <View style={styles.bare}>{content}</View>;
  }

  return (
    // No accessibilityRole here: the card holds real buttons (like/share), and
    // nesting <button> elements is invalid on web. The comment action is the
    // accessible route into the detail screen.
    <Pressable
      onPress={() => onOpen?.(post)}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: radius.lg,
          opacity: pressed ? 0.92 : 1,
        },
      ]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 18,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  bare: { gap: 12 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerText: { flex: 1, gap: 1 },
  name: { fontSize: 15, fontWeight: '800' },
  meta: { fontSize: 13, fontWeight: '500' },
  earnedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  earnedText: { fontSize: 12, fontWeight: '800' },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tag: { fontSize: 14, fontWeight: '700' },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    paddingRight: 6,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 42,
  },
  actionText: { fontSize: 13, fontWeight: '700' },
});
