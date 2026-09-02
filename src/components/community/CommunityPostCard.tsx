import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { recordCommunityPostView, type CommunityPost } from '../../api/communities';
import { useToggleCommunityPostLike } from '../../hooks/useCommunities';
import { useTheme } from '../../theme/ThemeProvider';
import { Avatar } from '../ui/Avatar';
import { HashtagText } from '../ui/HashtagText';
import { FONT } from '../../theme/fonts';

/**
 * One post inside a community.
 *
 * Distinct from the timeline's `PostCard` on purpose: community posts are a
 * different shape (`is_liked`/`likes_count` rather than the timeline's
 * `is_liked_by_viewer` + queued like), carry no earnings, and their like
 * endpoint answers the **settled** count — so the heart renders straight from
 * server state with no engagement store behind it.
 */
export function CommunityPostCard({
  post,
  communityId,
  onOpenComments,
}: {
  post: CommunityPost;
  communityId: string;
  onOpenComments: () => void;
}) {
  const { colors, radius, spacing } = useTheme();
  const toggleLike = useToggleCommunityPostLike(communityId);

  // A view is recorded once per post per mount, like the rolls' play counter.
  const viewed = useRef(false);
  useEffect(() => {
    if (viewed.current) return;
    viewed.current = true;
    recordCommunityPostView(communityId, post.id);
  }, [communityId, post.id]);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: radius.md,
        },
      ]}
    >
      <View style={styles.headerRow}>
        <Avatar name={post.author.name} tint={post.author.tint} size={38} />
        <View style={styles.headerText}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {post.author.name}
          </Text>
          <Text style={[styles.meta, { color: colors.textMuted }]} numberOfLines={1}>
            @{post.author.handle} · {post.timeAgo}
          </Text>
        </View>
      </View>

      {post.body ? <HashtagText style={[styles.body, { color: colors.text }]}>{post.body}</HashtagText> : null}

      {post.media.length > 0 ? (
        <View style={[styles.mediaRow, { gap: spacing.sm }]}>
          {post.media.slice(0, 4).map((uri) => (
            <Image
              key={uri}
              source={{ uri }}
              style={[styles.media, { borderRadius: radius.sm }]}
              contentFit="cover"
              transition={150}
            />
          ))}
        </View>
      ) : null}

      <View style={styles.actionRow}>
        <Pressable
          onPress={() => {
            if (!toggleLike.isPending) toggleLike.mutate(post.id);
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={post.liked ? 'Unlike post' : 'Like post'}
          style={styles.action}
        >
          <Ionicons
            name={post.liked ? 'heart' : 'heart-outline'}
            size={19}
            color={post.liked ? colors.danger : colors.textMuted}
          />
          <Text
            style={[styles.actionText, { color: post.liked ? colors.danger : colors.textMuted }]}
          >
            {post.likes}
          </Text>
        </Pressable>

        <Pressable
          onPress={onOpenComments}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Open comments"
          style={styles.action}
        >
          <Ionicons name="chatbubble-outline" size={18} color={colors.textMuted} />
          <Text style={[styles.actionText, { color: colors.textMuted }]}>{post.comments}</Text>
        </Pressable>

        <View style={styles.action}>
          <Ionicons name="eye-outline" size={18} color={colors.textMuted} />
          <Text style={[styles.actionText, { color: colors.textMuted }]}>{post.views}</Text>
        </View>
      </View>

      {/* The latest few comments the list endpoint embeds, like the timeline's
          comments_preview — enough to show a thread is alive without a tap. */}
      {post.commentsPreview.length > 0 ? (
        <View style={[styles.previewWrap, { borderTopColor: colors.border }]}>
          {post.commentsPreview.slice(0, 2).map((comment) => (
            <View key={comment.id} style={styles.previewRow}>
              <Avatar name={comment.author.name} tint={comment.author.tint} size={22} />
              <Text style={[styles.previewText, { color: colors.textSecondary }]} numberOfLines={2}>
                <Text style={{ fontWeight: '800', color: colors.text }}>
                  {comment.author.name}
                </Text>{' '}
                {comment.body}
              </Text>
            </View>
          ))}
          {post.comments > 2 ? (
            <Pressable onPress={onOpenComments} accessibilityRole="button">
              <Text style={[styles.previewMore, { color: colors.brand }]}>
                View all {post.comments} comments
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14, gap: 11, borderWidth: StyleSheet.hairlineWidth },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerText: { flex: 1, gap: 2 },
  name: { fontFamily: FONT, fontSize: 14, fontWeight: '800' },
  meta: { fontFamily: FONT, fontSize: 12, fontWeight: '600' },
  body: { fontFamily: FONT, fontSize: 14, lineHeight: 21, fontWeight: '500' },
  mediaRow: { flexDirection: 'row', flexWrap: 'wrap' },
  media: { width: 96, height: 96 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionText: { fontFamily: FONT, fontSize: 13, fontWeight: '700' },
  previewWrap: { gap: 8, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  previewRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  previewText: { fontFamily: FONT, flex: 1, fontSize: 13, lineHeight: 19, fontWeight: '500' },
  previewMore: { fontFamily: FONT, fontSize: 12, fontWeight: '800' },
});
