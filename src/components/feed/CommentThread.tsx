import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { MemberTint } from '../../data/community';
import { useTheme } from '../../theme/ThemeProvider';
import { FONT } from '../../theme/fonts';
import { Avatar } from '../ui/Avatar';
import { HashtagText } from '../ui/HashtagText';

/**
 * The shape both comment models already satisfy — the timeline's `Comment` and
 * communities' `CommunityComment` use identical field names, so one renderer
 * serves both rather than each screen growing its own thread markup.
 */
export type ThreadComment = {
  id: string;
  author: { id: string; name: string; handle: string; tint: MemberTint; avatar?: string | null };
  body: string;
  timeAgo: string;
  replyCount?: number;
  replies?: ThreadComment[];
};

/** Replies shown before the "view all" expander appears. */
const COLLAPSED_REPLIES = 2;

/**
 * A comment and its replies.
 *
 * Replies are indented under their parent behind a thin vertical rail — the
 * rail, not the indent alone, is what makes a long thread scannable, because
 * indentation on a 390pt screen can only afford about 28pt before the text
 * column gets too narrow to read.
 *
 * The API models exactly one level of nesting, so replying to a *reply* still
 * attaches to the root (see `postComment`). The UI matches that honestly:
 * replies carry a Reply action, but the resulting comment lands in the same
 * list rather than indenting a second time, and the composer prefills the
 * handle so the answer still reads as directed at that person.
 */
export function CommentItem({
  comment,
  onReply,
  variant = 'card',
}: {
  comment: ThreadComment;
  /** Passing this enables the Reply action; omit it for a read-only thread. */
  onReply?: (target: { rootId: string; handle: string }) => void;
  /** `card` on the post screen, `plain` inside a sheet that already insets. */
  variant?: 'card' | 'plain';
}) {
  const { colors, radius } = useTheme();
  const [expanded, setExpanded] = useState(false);

  const replies = comment.replies ?? [];
  const shown = expanded ? replies : replies.slice(0, COLLAPSED_REPLIES);
  // The server's count can exceed what it embedded, so trust it for the label.
  const total = Math.max(comment.replyCount ?? 0, replies.length);
  const hidden = total - shown.length;

  return (
    <View
      style={[
        variant === 'card' && styles.card,
        variant === 'card' && {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: radius.md,
        },
      ]}
    >
      <CommentBody
        comment={comment}
        avatarSize={variant === 'card' ? 36 : 32}
        onReply={onReply ? () => onReply({ rootId: comment.id, handle: comment.author.handle }) : undefined}
      />

      {shown.length ? (
        <View style={styles.replyWrap}>
          {/* One continuous rail rather than a border per reply — a per-row
              border breaks into dashes at the gaps and reads as noise. */}
          <View style={[styles.rail, { backgroundColor: colors.border }]} />
          <View style={styles.replyList}>
            {shown.map((reply) => (
              <CommentBody
                key={reply.id}
                comment={reply}
                avatarSize={26}
                compact
                onReply={
                  onReply
                    ? // Answers to a reply attach to the ROOT — that is all the
                      // API models — but address the person who was replying.
                      () => onReply({ rootId: comment.id, handle: reply.author.handle })
                    : undefined
                }
              />
            ))}
          </View>
        </View>
      ) : null}

      {hidden > 0 || (expanded && replies.length > COLLAPSED_REPLIES) ? (
        <Pressable
          onPress={() => setExpanded((value) => !value)}
          hitSlop={6}
          accessibilityRole="button"
          style={styles.expander}
        >
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={13}
            color={colors.brand}
          />
          <Text style={[styles.expanderText, { color: colors.brand }]}>
            {expanded
              ? 'Hide replies'
              : `View ${hidden} more ${hidden === 1 ? 'reply' : 'replies'}`}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** One comment's avatar + name + body + Reply, shared by roots and replies. */
function CommentBody({
  comment,
  avatarSize,
  compact,
  onReply,
}: {
  comment: ThreadComment;
  avatarSize: number;
  compact?: boolean;
  onReply?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <Avatar
        name={comment.author.name}
        tint={comment.author.tint}
        uri={comment.author.avatar}
        size={avatarSize}
      />
      <View style={styles.body}>
        <View style={styles.header}>
          <Text
            style={[styles.name, compact && styles.nameCompact, { color: colors.text }]}
            numberOfLines={1}
          >
            {comment.author.name}
          </Text>
          {comment.timeAgo ? (
            <Text style={[styles.time, { color: colors.textMuted }]}>{comment.timeAgo}</Text>
          ) : null}
        </View>
        <HashtagText
          style={[styles.text, compact && styles.textCompact, { color: colors.textSecondary }]}
        >
          {comment.body}
        </HashtagText>
        {onReply ? (
          <Pressable
            onPress={onReply}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Reply to ${comment.author.name}`}
          >
            <Text style={[styles.reply, { color: colors.textMuted }]}>Reply</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/**
 * The "Replying to @handle" chip that sits above a composer. Dismissing it
 * returns the composer to writing a root comment — without this the user has no
 * way to tell (or undo) what a send is about to attach to.
 */
export function ReplyingBanner({
  handle,
  onCancel,
}: {
  handle: string;
  onCancel: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.banner, { backgroundColor: colors.surfaceAlt }]}>
      <Ionicons name="return-down-forward-outline" size={14} color={colors.brand} />
      <Text style={[styles.bannerText, { color: colors.textSecondary }]} numberOfLines={1}>
        Replying to <Text style={{ color: colors.text, fontWeight: '800' }}>@{handle}</Text>
      </Text>
      <Pressable
        onPress={onCancel}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Cancel reply"
      >
        <Ionicons name="close" size={15} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14, borderWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', gap: 12 },
  body: { flex: 1, gap: 3 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontFamily: FONT, flex: 1, fontSize: 14, fontWeight: '800' },
  nameCompact: { fontSize: 13 },
  time: { fontFamily: FONT, fontSize: 12, fontWeight: '600' },
  text: { fontFamily: FONT, fontSize: 14, lineHeight: 20, fontWeight: '400' },
  textCompact: { fontSize: 13, lineHeight: 19 },
  reply: { fontFamily: FONT, fontSize: 12, fontWeight: '700', marginTop: 4 },
  replyWrap: { flexDirection: 'row', marginTop: 12, marginLeft: 14 },
  rail: { width: StyleSheet.hairlineWidth, borderRadius: 1 },
  replyList: { flex: 1, gap: 14, paddingLeft: 14 },
  expander: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
    marginLeft: 48,
  },
  expanderText: { fontFamily: FONT, fontSize: 12, fontWeight: '700' },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    marginBottom: 8,
  },
  bannerText: { fontFamily: FONT, flex: 1, fontSize: 13, fontWeight: '600' },
});
