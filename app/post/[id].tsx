import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { mergeComments, tintFor, toPostDetail } from '../../src/api/timeline';
import { PostCard } from '../../src/components/feed/PostCard';
import { Avatar } from '../../src/components/ui/Avatar';
import { BackButton } from '../../src/components/ui/BackButton';
import { HashtagText } from '../../src/components/ui/HashtagText';
import { ScreenBackground } from '../../src/components/ui/ScreenBackground';
import { addComment, findPost } from '../../src/data/community';
import { newCommentId, useAddComment, usePost } from '../../src/hooks/useTimeline';
import { useAuthStore } from '../../src/stores/authStore';
import { NO_COMMENTS, useEngagementStore } from '../../src/stores/engagementStore';
import { useTheme } from '../../src/theme/ThemeProvider';
import { FONT } from '../../src/theme/fonts';

/**
 * Post detail — the full post with its comment thread and a comment box.
 * Timeline posts load through GET /timeline/post/{id} (the View endpoint, so
 * opening the screen is what counts the view); posts from the dummy data
 * (member profiles) still resolve in-memory. The API only returns comment
 * counts, so the thread shows any comments the backend embeds plus the ones
 * you wrote this session.
 */
export default function PostDetailScreen() {
  const { colors, radius, spacing } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const dummy = findPost(id);
  const query = usePost(id, !dummy);
  const post = dummy ?? (query.data ? toPostDetail(query.data) : undefined);

  const user = useAuthStore((s) => s.user);
  const myComments = useEngagementStore((s) => s.myComments[id] ?? NO_COMMENTS);
  const remoteAddComment = useAddComment();

  const [draft, setDraft] = useState('');
  // Bump to re-render after mutating the in-memory comment list (dummy posts).
  const [, setVersion] = useState(0);

  if (!post) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <ScreenBackground />
        <View style={[styles.missing, { paddingTop: insets.top + spacing.xl }]}>
          <BackButton onPress={() => router.back()} />
          {query.isLoading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={colors.brand} />
              <Text style={[styles.missingText, { color: colors.textMuted }]}>
                Loading post…
              </Text>
            </View>
          ) : (
            <Text style={[styles.missingText, { color: colors.textMuted }]}>
              This post is no longer available.
            </Text>
          )}
        </View>
      </View>
    );
  }

  const comments = dummy ? post.comments : mergeComments(post.comments, myComments);
  const commentCount = dummy
    ? post.comments.length
    : Math.max(post.commentCount ?? 0, comments.length);

  const onSend = () => {
    const body = draft.trim();
    if (!body) return;
    if (dummy) {
      addComment(post.id, body);
      setVersion((v) => v + 1);
    } else {
      remoteAddComment.mutate({ postId: post.id, body, clientId: newCommentId() });
    }
    setDraft('');
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScreenBackground />
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingTop: insets.top + spacing.lg,
            paddingBottom: spacing.lg,
            paddingHorizontal: spacing.xl,
            gap: spacing.xl,
          }}
        >
          <View style={styles.headerRow}>
            <BackButton onPress={() => router.back()} />
            <Text style={[styles.headerTitle, { color: colors.text }]}>Post</Text>
            <View style={{ width: 44 }} />
          </View>

          <View
            style={[
              styles.postCard,
              { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg },
            ]}
          >
            <PostCard post={post} bare />
          </View>

          <View style={{ gap: spacing.md }}>
            <Text style={[styles.commentsTitle, { color: colors.text }]}>
              Comments ({commentCount})
            </Text>

            {comments.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Ionicons name="chatbubbles-outline" size={26} color={colors.textMuted} />
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                  {commentCount > 0
                    ? 'Comments on this post will appear here soon.'
                    : 'Be the first to comment — comments earn for the author.'}
                </Text>
              </View>
            ) : (
              comments.map((comment) => (
                <View
                  key={comment.id}
                  style={[
                    styles.commentRow,
                    { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md },
                  ]}
                >
                  <Avatar name={comment.author.name} tint={comment.author.tint} size={36} />
                  <View style={styles.commentBody}>
                    <View style={styles.commentHeader}>
                      <Text style={[styles.commentName, { color: colors.text }]} numberOfLines={1}>
                        {comment.author.name}
                      </Text>
                      <Text style={[styles.commentTime, { color: colors.textMuted }]}>
                        {comment.timeAgo}
                      </Text>
                    </View>
                    <HashtagText style={[styles.commentText, { color: colors.textSecondary }]}>
                      {comment.body}
                    </HashtagText>
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>

        {/* Comment input */}
        <View
          style={[
            styles.inputBar,
            {
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
              paddingBottom: insets.bottom + 10,
            },
          ]}
        >
          <Avatar name={user?.name ?? 'You'} tint={tintFor(user?.id ?? 'me')} size={34} />
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Write a comment…"
            placeholderTextColor={colors.textMuted}
            selectionColor={colors.brand}
            onSubmitEditing={onSend}
            returnKeyType="send"
            style={[
              styles.input,
              { backgroundColor: colors.surfaceAlt, color: colors.text, borderColor: colors.border },
            ]}
          />
          <Pressable
            onPress={onSend}
            disabled={!draft.trim()}
            accessibilityRole="button"
            accessibilityLabel="Send comment"
            style={[
              styles.sendBtn,
              { backgroundColor: draft.trim() ? colors.brand : colors.surfaceAlt },
            ]}
          >
            <Ionicons
              name="arrow-up"
              size={20}
              color={draft.trim() ? colors.onBrand : colors.textMuted}
            />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
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
  postCard: {
    padding: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  commentsTitle: { fontFamily: FONT, fontSize: 17, fontWeight: '800' },
  commentRow: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  commentBody: { flex: 1, gap: 3 },
  commentHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  commentName: { fontFamily: FONT, flex: 1, fontSize: 14, fontWeight: '800' },
  commentTime: { fontFamily: FONT, fontSize: 12, fontWeight: '600' },
  commentText: { fontFamily: FONT, fontSize: 14, lineHeight: 20, fontWeight: '400' },
  missing: { paddingHorizontal: 24, gap: 24 },
  missingText: { fontFamily: FONT, fontSize: 15, fontWeight: '600' },
  loadingWrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  emptyWrap: { alignItems: 'center', gap: 8, paddingVertical: 26, paddingHorizontal: 24 },
  emptyText: { fontFamily: FONT, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    fontFamily: FONT,
    flex: 1,
    height: 42,
    borderRadius: 21,
    paddingHorizontal: 16,
    // Kill the platform's default vertical padding so the placeholder sits
    // centered like typed text (it otherwise sags toward the bottom).
    paddingVertical: 0,
    textAlignVertical: 'center',
    fontSize: 14,
    fontWeight: '500',
    borderWidth: StyleSheet.hairlineWidth,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
