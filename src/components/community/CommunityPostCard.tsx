import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { recordCommunityPostView, type CommunityPost } from '../../api/communities';
import {
  useDeleteCommunityPost,
  useToggleCommunityPostLike,
} from '../../hooks/useCommunities';
import { useTheme } from '../../theme/ThemeProvider';
import { Avatar } from '../ui/Avatar';
import { HashtagText } from '../ui/HashtagText';
import { ShareSheet } from './ShareSheet';
import { FONT } from '../../theme/fonts';

/**
 * The web link for one community post.
 *
 * **This shape is an assumption**, exactly like the timeline permalink in
 * `PostMenu`: a community post carries no `share_url` of its own (verified live
 * 2026-09-17 — the posts response is `{id, content, likes_count, …}` and
 * nothing else), so the only thing the API gives us is the *community's*
 * `share_url`, which the post is hung off as a query param. Confirm it against
 * the web app and switch to a server-sent URL the moment one appears.
 *
 * It inherits `shareUrlFor`'s localhost guard, so the link is already a real
 * payhankey.com one rather than the `http://localhost/c/<slug>` the backend
 * still sends.
 */
export function postShareUrl(communityShareUrl: string, postId: string): string {
  const separator = communityShareUrl.includes('?') ? '&' : '?';
  return `${communityShareUrl}${separator}post=${encodeURIComponent(postId)}`;
}

/**
 * One post inside a community.
 *
 * Distinct from the timeline's `PostCard` on purpose: community posts are a
 * different shape (`is_liked`/`likes_count` rather than the timeline's
 * `is_liked_by_viewer` + queued like), carry no earnings, and their like
 * endpoint answers the **settled** count — so the heart renders straight from
 * server state with no engagement store behind it.
 *
 * Sharing reuses the community's own `ShareSheet` (copy link + hand off to the
 * OS sheet). See {@link postShareUrl} for where the link comes from.
 */
export function CommunityPostCard({
  post,
  communityId,
  onOpenComments,
  canDelete,
  communityShareUrl,
  communityName,
}: {
  post: CommunityPost;
  communityId: string;
  onOpenComments: () => void;
  /** The author, or an owner/admin of the community — anyone else gets 403. */
  canDelete?: boolean;
  /** The community's own `shareUrl`; sharing is hidden without it. */
  communityShareUrl?: string;
  /** Names the community in the share payload. */
  communityName?: string;
}) {
  const { colors, radius, spacing } = useTheme();
  const toggleLike = useToggleCommunityPostLike(communityId);
  const remove = useDeleteCommunityPost(communityId);
  const [shareOpen, setShareOpen] = useState(false);

  /** Deleting is irreversible and there is no undo, so it confirms first. */
  const onDelete = () => {
    Alert.alert('Delete this post?', 'It will be removed for everyone in the community.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => remove.mutate(post.id) },
    ]);
  };

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
        <Avatar name={post.author.name} tint={post.author.tint} uri={post.author.avatar} size={38} />
        <View style={styles.headerText}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {post.author.name}
          </Text>
          <Text style={[styles.meta, { color: colors.textMuted }]} numberOfLines={1}>
            @{post.author.handle} · {post.timeAgo}
          </Text>
        </View>
        {canDelete ? (
          <Pressable
            onPress={onDelete}
            disabled={remove.isPending}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Delete post"
          >
            <Ionicons
              name="trash-outline"
              size={17}
              color={remove.isPending ? colors.textMuted : colors.textMuted}
            />
          </Pressable>
        ) : null}
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

        {/* Share is an action *on* the post rather than a count of it, so it
            sits against the right edge and leaves the three figures packed at
            the left — the same arrangement the timeline card uses. */}
        {communityShareUrl ? (
          <Pressable
            onPress={() => setShareOpen(true)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Share ${post.author.name}'s post`}
            style={[styles.action, styles.actionEnd]}
          >
            <Ionicons name="share-social-outline" size={18} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      {/* The latest few comments the list endpoint embeds, like the timeline's
          comments_preview — enough to show a thread is alive without a tap. */}
      {post.commentsPreview.length > 0 ? (
        <View style={[styles.previewWrap, { borderTopColor: colors.border }]}>
          {post.commentsPreview.slice(0, 2).map((comment) => (
            <View key={comment.id} style={styles.previewRow}>
              <Avatar name={comment.author.name} tint={comment.author.tint} uri={comment.author.avatar} size={22} />
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

      {/* Mounted per card but only rendered when opened — the Modal is cheap
          while `visible` is false. */}
      {communityShareUrl ? (
        <ShareSheet
          visible={shareOpen}
          title="post"
          heading="Share this post"
          lede={
            communityName
              ? `Send this post from ${communityName} to anyone on Payhankey.`
              : 'Send this post to anyone on Payhankey.'
          }
          linkLabel="Post link"
          url={postShareUrl(communityShareUrl, post.id)}
          message={`${post.author.name} on Payhankey`}
          onClose={() => setShareOpen(false)}
        />
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
  // Eats the free space so share is flushed right whatever the counts read.
  actionEnd: { marginLeft: 'auto' },
  actionText: { fontFamily: FONT, fontSize: 13, fontWeight: '700' },
  previewWrap: { gap: 8, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  previewRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  previewText: { fontFamily: FONT, flex: 1, fontSize: 13, lineHeight: 19, fontWeight: '500' },
  previewMore: { fontFamily: FONT, fontSize: 12, fontWeight: '800' },
});
