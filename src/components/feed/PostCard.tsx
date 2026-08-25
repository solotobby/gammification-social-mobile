import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { mergeComments } from "../../api/timeline";
import { newCommentId, useAddComment, useToggleLike } from "../../hooks/useTimeline";
import { useAuthStore } from "../../stores/authStore";
import { useBookmarkStore } from "../../stores/bookmarkStore";
import { NO_COMMENTS, useEngagementStore } from "../../stores/engagementStore";
import { useCurrency } from "../../hooks/useCurrency";
import { useTheme } from "../../theme/ThemeProvider";
import { Avatar } from "../ui/Avatar";
import { HashtagText } from "../ui/HashtagText";
import { MediaGrid } from "./MediaGrid";
import { PostMenu } from "./PostMenu";
import type { Comment, Post } from "../../data/community";
import { FONT, FONT_MONO } from '../../theme/fonts';

type Props = {
  post: Post;
  /** Tap anywhere on the card (or the comment action) — opens the detail screen. */
  onOpen?: (post: Post) => void;
  /** Renders the body without the surrounding card chrome (used on the detail screen). */
  bare?: boolean;
};

/** One comment row — shared by the card strip and kept small on purpose. */
function CommentRow({ comment }: { comment: Comment }) {
  const { colors, radius } = useTheme();
  return (
    <View
      style={[
        styles.commentRow,
        { backgroundColor: colors.surfaceAlt, borderRadius: radius.md },
      ]}
    >
      <Avatar name={comment.author.name} tint={comment.author.tint} size={28} />
      <View style={styles.commentBody}>
        <View style={styles.commentHeader}>
          <Text style={[styles.commentName, { color: colors.text }]} numberOfLines={1}>
            {comment.author.name}
          </Text>
          {comment.timeAgo ? (
            <Text style={[styles.commentTime, { color: colors.textMuted }]}>
              {comment.timeAgo}
            </Text>
          ) : null}
        </View>
        <HashtagText style={[styles.commentText, { color: colors.textSecondary }]}>
          {comment.body}
        </HashtagText>
      </View>
    </View>
  );
}

/**
 * Inline "write a comment" row under a feed post — submits through the
 * comment API with an optimistic append (the comment shows immediately).
 */
export function CommentComposer({ postId, autoFocus }: { postId: string; autoFocus?: boolean }) {
  const { colors } = useTheme();
  const addComment = useAddComment();
  const [draft, setDraft] = useState("");

  const canSend = draft.trim().length > 0;
  const onSend = () => {
    const body = draft.trim();
    if (!body) return;
    addComment.mutate({ postId, body, clientId: newCommentId() });
    setDraft("");
  };

  return (
    // No avatar here on purpose: the card already carries the author's, and on a
    // narrow row it costs width without telling you anything the placeholder
    // doesn't. Comment rows keep theirs — there it identifies the speaker.
    <View style={styles.composerRow}>
      <TextInput
        value={draft}
        onChangeText={setDraft}
        placeholder="Write a comment…"
        placeholderTextColor={colors.textMuted}
        selectionColor={colors.brand}
        onSubmitEditing={onSend}
        returnKeyType="send"
        autoFocus={autoFocus}
        style={[
          styles.composerInput,
          { backgroundColor: colors.surfaceAlt, color: colors.text, borderColor: colors.border },
        ]}
      />
      <Pressable
        onPress={onSend}
        disabled={!canSend}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel="Send comment"
        style={[
          styles.composerSend,
          { backgroundColor: canSend ? colors.brand : colors.surfaceAlt },
        ]}
      >
        <Ionicons
          name="arrow-up"
          size={17}
          color={canSend ? colors.onBrand : colors.textMuted}
        />
      </Pressable>
    </View>
  );
}

/**
 * Instagram-style "liked by" row — a small stack of the first few likers'
 * avatars and a "Liked by <name> and N others" line, shown just above the
 * action row. Renders only when the post carries a liker preview.
 */
function LikedByRow({ likedBy, count }: { likedBy: NonNullable<Post['likedBy']>; count: number }) {
  const { colors } = useTheme();
  const router = useRouter();
  if (!likedBy.length) return null;

  const avatars = likedBy.slice(0, 3);
  const names = likedBy.slice(0, 2).map((liker) => liker.name.split(' ')[0]);
  const others = Math.max(0, count - names.length);

  return (
    <View style={styles.likedByRow}>
      <View style={styles.likedAvatars}>
        {avatars.map((liker, i) => (
          <View
            key={liker.id}
            style={[
              styles.likedAvatarRing,
              { borderColor: colors.surface, marginLeft: i === 0 ? 0 : -9, zIndex: avatars.length - i },
            ]}
          >
            <Avatar name={liker.name} tint={liker.tint} size={22} />
          </View>
        ))}
      </View>
      <Text style={[styles.likedText, { color: colors.textSecondary }]} numberOfLines={1}>
        Liked by{' '}
        <Text
          style={[styles.likedName, { color: colors.text }]}
          onPress={() => router.push(`/member/${likedBy[0].handle}`)}
        >
          {names[0]}
        </Text>
        {names[1] ? (
          <>
            {others > 0 ? ', ' : ' and '}
            <Text style={[styles.likedName, { color: colors.text }]}>{names[1]}</Text>
          </>
        ) : null}
        {others > 0 ? (
          <Text style={styles.likedName}>
            {` and ${others.toLocaleString()} ${others === 1 ? 'other' : 'others'}`}
          </Text>
        ) : null}
      </Text>
    </View>
  );
}

/**
 * A feed post: author row with earned badge, body, hashtags, and the
 * like / comment / views / share action row. API posts (`post.remote`) like
 * optimistically through the timeline API and grow a comment strip: any
 * comments the backend embeds on the post, the ones you write this session,
 * and an inline composer.
 */
export function PostCard({ post, onOpen, bare }: Props) {
  const { colors, radius } = useTheme();
  const { format } = useCurrency();
  const router = useRouter();

  // Dummy posts (member profiles) keep the local-only heart; API posts toggle
  // through the optimistic mutation + engagement store.
  const [localLiked, setLocalLiked] = useState(false);
  const remoteLiked = useEngagementStore((s) => !!s.liked[post.id]);
  const toggleLike = useToggleLike();
  const liked = post.remote ? remoteLiked : localLiked;

  // Seed the heart from the server's `is_liked_by_viewer` (endpoints that send
  // it) so a liked post shows filled on first render; a session toggle wins.
  useEffect(() => {
    if (post.remote && post.likedByViewer != null) {
      useEngagementStore.getState().seedLiked(post.id, post.likedByViewer);
    }
  }, [post.id, post.remote, post.likedByViewer]);
  const onLike = () => {
    if (post.remote) toggleLike.mutate(post.id);
    else setLocalLiked((l) => !l);
  };

  // Remote like counts are patched in the query cache by the mutation, so
  // `post.likes` already reflects the optimistic toggle.
  const likeCount = post.remote ? post.likes : post.likes + (liked ? 1 : 0);

  const myComments = useEngagementStore((s) => s.myComments[post.id] ?? NO_COMMENTS);
  const stripComments = bare ? NO_COMMENTS : mergeComments(post.comments, myComments);
  const commentCount = post.commentCount ?? post.comments.length;

  // Only the author sees the overflow menu (delete). There's no "is mine" API
  // flag — a post's ownerId (its user_id) is matched against the signed-in user.
  const myUserId = useAuthStore((s) => s.user?.id);
  const isMine = !!post.remote && !!post.ownerId && post.ownerId === myUserId;

  // Bookmarks are local-only (no endpoint yet) — see src/stores/bookmarkStore.ts.
  const bookmarked = useBookmarkStore((s) => s.posts.some((p) => p.id === post.id));
  const toggleBookmark = useBookmarkStore((s) => s.toggle);

  const content = (
    <>
      <View style={styles.headerRow}>
        {/* Author → their profile */}
        <Pressable
          onPress={() => router.push(`/member/${post.author.handle}`)}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`View ${post.author.name}'s profile`}
          style={styles.authorTap}
        >
          <Avatar name={post.author.name} tint={post.author.tint} size={42} />
          <View style={styles.headerText}>
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
              {post.author.name.split(" ")[0]}
            </Text>
            <Text
              style={[styles.meta, { color: colors.textMuted }]}
              numberOfLines={1}
            >
              @{post.author.handle} · {post.timeAgo}
            </Text>
          </View>
        </Pressable>
        {post.earned != null ? (
          <View
            style={[
              styles.earnedPill,
              {
                backgroundColor: `${colors.mint}1A`,
                borderColor: `${colors.mint}40`,
              },
            ]}
          >
            <Ionicons name="trending-up" size={12} color={colors.mint} />
            <Text style={[styles.earnedText, { color: colors.mint }]}>
              {format(post.earned)}
            </Text>
          </View>
        ) : null}
        {/* Every post gets the overflow — the menu itself decides whether to
            offer the author's actions or a reader's. */}
        {post.remote && !bare ? <PostMenu post={post} isMine={isMine} /> : null}
      </View>

      {/* Feed cards clamp to 3 lines; the detail screen (bare) shows it all. */}
      <HashtagText style={[styles.body, { color: colors.text }]} numberOfLines={bare ? undefined : 3}>
        {post.body}
      </HashtagText>

      {post.media?.length ? <MediaGrid media={post.media} /> : null}

      {/* Freshly posted media is transcoding server-side — say so rather than
          leaving a gap where the video will land. The feed doesn't poll for
          it; a pull-to-refresh swaps in the finished media. */}
      {post.mediaPending ? (
        <View
          style={[
            styles.pendingMedia,
            { backgroundColor: colors.surfaceAlt, borderColor: colors.border, borderRadius: radius.md },
          ]}
        >
          <ActivityIndicator size="small" color={colors.brand} />
          <Text style={[styles.pendingText, { color: colors.textMuted }]}>
            Processing media — pull to refresh
          </Text>
        </View>
      ) : null}

      {post.hashtags?.length ? (
        <View style={styles.tagRow}>
          {post.hashtags.map((tag) => (
            <Text
              key={tag}
              suppressHighlighting
              style={[styles.tag, { color: colors.brand }]}
              onPress={() => router.push(`/hashtag/${encodeURIComponent(tag)}`)}
            >
              #{tag}
            </Text>
          ))}
        </View>
      ) : null}

      {post.likedBy?.length ? <LikedByRow likedBy={post.likedBy} count={likeCount} /> : null}

      <View style={[styles.actionRow, { borderTopColor: colors.border }]}>
        <Pressable
          onPress={onLike}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={liked ? "Unlike" : "Like"}
          style={styles.action}
        >
          <Ionicons
            name={liked ? "heart" : "heart-outline"}
            size={19}
            color={liked ? colors.pink : colors.textMuted}
          />
          <Text
            style={[
              styles.actionText,
              { color: liked ? colors.pink : colors.textMuted },
            ]}
          >
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
          <Ionicons
            name="chatbubble-outline"
            size={18}
            color={colors.textMuted}
          />
          <Text style={[styles.actionText, { color: colors.textMuted }]}>
            {commentCount}
          </Text>
        </Pressable>

        <View style={styles.action}>
          <Ionicons name="eye-outline" size={19} color={colors.textMuted} />
          <Text style={[styles.actionText, { color: colors.textMuted }]}>
            {post.views}
          </Text>
        </View>

        <Pressable
          onPress={() => toggleBookmark(post)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={bookmarked ? "Remove bookmark" : "Bookmark"}
          style={styles.action}
        >
          <Ionicons
            name={bookmarked ? "bookmark" : "bookmark-outline"}
            size={18}
            color={bookmarked ? colors.brand : colors.textMuted}
          />
        </Pressable>

        <Pressable
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Share"
          style={styles.action}
        >
          <Ionicons
            name="share-social-outline"
            size={18}
            color={colors.textMuted}
          />
        </Pressable>
      </View>

      {/* Comment strip + inline composer — API-backed feed cards only. The
          detail screen (bare) renders the full thread + its own input bar. */}
      {post.remote && !bare ? (
        <View style={styles.commentStrip}>
          {stripComments.map((comment) => (
            <CommentRow key={comment.id} comment={comment} />
          ))}
          <CommentComposer postId={post.id} />
        </View>
      ) : null}
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
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  authorTap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerText: { flex: 1, gap: 1 },
  name: { fontFamily: FONT, fontSize: 15, fontWeight: "800" },
  meta: { fontFamily: FONT, fontSize: 13, fontWeight: "500" },
  earnedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  earnedText: { fontFamily: FONT_MONO, fontSize: 12, fontWeight: "700" },
  body: { fontFamily: FONT, fontSize: 15, lineHeight: 22, fontWeight: "400" },
  pendingMedia: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 92,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pendingText: { fontFamily: FONT, fontSize: 13, fontWeight: "600" },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tag: { fontFamily: FONT, fontSize: 14, fontWeight: "700" },
  likedByRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  likedAvatars: { flexDirection: "row", alignItems: "center" },
  likedAvatarRing: {
    borderWidth: 2,
    borderRadius: 13,
  },
  likedText: { fontFamily: FONT, flex: 1, fontSize: 13, fontWeight: "500" },
  likedName: { fontFamily: FONT, fontWeight: "800" },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    paddingRight: 6,
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minWidth: 42,
  },
  actionText: { fontFamily: FONT, fontSize: 13, fontWeight: "700" },
  commentStrip: { gap: 8 },
  commentRow: {
    flexDirection: "row",
    gap: 10,
    padding: 10,
  },
  commentBody: { flex: 1, gap: 2 },
  commentHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  commentName: { fontFamily: FONT, flexShrink: 1, fontSize: 13, fontWeight: "800" },
  commentTime: { fontFamily: FONT, fontSize: 11, fontWeight: "600" },
  commentText: { fontFamily: FONT, fontSize: 13, lineHeight: 18, fontWeight: "400" },
  composerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  composerInput: {
    fontFamily: FONT,
    flex: 1,
    height: 38,
    borderRadius: 19,
    paddingHorizontal: 14,
    // Kill the platform's default vertical padding so the placeholder sits
    // centered like typed text (it otherwise sags toward the bottom).
    paddingVertical: 0,
    textAlignVertical: "center",
    fontSize: 13,
    fontWeight: "500",
    borderWidth: StyleSheet.hairlineWidth,
  },
  composerSend: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
});
