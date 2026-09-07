import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { CommunityPost } from '../../api/communities';
import {
  useAddCommunityPostComment,
  useCommunityPostComments,
} from '../../hooks/useCommunities';
import { keyboardInset, useKeyboard } from '../../hooks/useKeyboard';
import { useTheme } from '../../theme/ThemeProvider';
import { Avatar } from '../ui/Avatar';
import { HashtagText } from '../ui/HashtagText';
import { FONT } from '../../theme/fonts';

/**
 * Comments on a community post — `GET|POST /communities/{id}/posts/{postId}/comments`.
 *
 * A sheet rather than a pushed route, mirroring `RollCommentsSheet`: a community
 * post has no detail screen of its own (there's no endpoint for one), so the
 * thread opens over the feed and closes back onto it.
 *
 * Only members may comment — the endpoint rejects everyone else — so the
 * composer is hidden rather than shown and then failed.
 */
export function CommunityCommentsSheet({
  visible,
  communityId,
  post,
  canComment,
  onClose,
}: {
  visible: boolean;
  communityId: string;
  post: CommunityPost | null;
  canComment: boolean;
  onClose: () => void;
}) {
  const { colors, radius, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const { visible: keyboardUp } = useKeyboard();
  const [draft, setDraft] = useState('');

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useCommunityPostComments(communityId, post?.id, visible);
  const addComment = useAddCommunityPostComment(communityId, post?.id);

  const comments = data?.comments ?? [];

  const onSend = () => {
    const body = draft.trim();
    if (!body || addComment.isPending) return;
    addComment.mutate(body, { onSuccess: () => setDraft('') });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close comments" />
      {/* box-none so the empty space above the sheet lets touches reach the
          backdrop behind it — otherwise this wrapper covers the whole screen
          and tap-outside-to-close never fires. */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.sheetWrap}
        pointerEvents="box-none"
      >
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              borderTopLeftRadius: radius.lg,
              borderTopRightRadius: radius.lg,
              paddingBottom: keyboardInset(insets.bottom, keyboardUp) + spacing.md,
            },
          ]}
        >
          <View style={[styles.grabber, { backgroundColor: colors.border }]} />
          <View style={styles.headerRow}>
            <Text style={[styles.title, { color: colors.text }]}>
              {post?.comments ? `${post.comments} comments` : 'Comments'}
            </Text>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={[styles.close, { backgroundColor: colors.surfaceAlt }]}
            >
              <Ionicons name="close" size={18} color={colors.text} />
            </Pressable>
          </View>

          <FlatList
            data={comments}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            onEndReachedThreshold={0.5}
            onEndReached={() => {
              if (hasNextPage && !isFetchingNextPage) fetchNextPage();
            }}
            contentContainerStyle={{ gap: spacing.md, paddingVertical: spacing.md }}
            renderItem={({ item }) => (
              <View style={styles.commentRow}>
                <Avatar name={item.author.name} tint={item.author.tint} size={32} />
                <View style={styles.commentBody}>
                  <Text style={[styles.commentName, { color: colors.text }]}>
                    {item.author.name}{' '}
                    <Text style={[styles.commentTime, { color: colors.textMuted }]}>
                      {item.timeAgo}
                    </Text>
                  </Text>
                  <HashtagText style={[styles.commentText, { color: colors.textSecondary }]}>
                    {item.body}
                  </HashtagText>
                </View>
              </View>
            )}
            ListEmptyComponent={
              isLoading ? (
                <View style={styles.empty}>
                  <ActivityIndicator color={colors.brand} />
                </View>
              ) : (
                <View style={styles.empty}>
                  <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                    No comments yet.
                  </Text>
                </View>
              )
            }
          />

          {canComment ? (
            <View
              style={[
                styles.composer,
                { backgroundColor: colors.surfaceAlt, borderRadius: radius.pill },
              ]}
            >
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="Add a comment…"
                placeholderTextColor={colors.textMuted}
                selectionColor={colors.brand}
                style={[styles.composerInput, { color: colors.text }]}
                returnKeyType="send"
                onSubmitEditing={onSend}
              />
              <Pressable
                onPress={onSend}
                disabled={!draft.trim() || addComment.isPending}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Send comment"
              >
                {addComment.isPending ? (
                  <ActivityIndicator size="small" color={colors.brand} />
                ) : (
                  <Ionicons
                    name="send"
                    size={19}
                    color={draft.trim() ? colors.brand : colors.textMuted}
                  />
                )}
              </Pressable>
            </View>
          ) : (
            <Text style={[styles.joinNote, { color: colors.textMuted }]}>
              Join this community to join the conversation.
            </Text>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: { maxHeight: '80%', minHeight: '55%', paddingHorizontal: 18, gap: 6 },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginTop: 10 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
  },
  title: { fontFamily: FONT, fontSize: 16, fontWeight: '800' },
  close: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  commentBody: { flex: 1, gap: 3 },
  commentName: { fontFamily: FONT, fontSize: 13, fontWeight: '800' },
  commentTime: { fontFamily: FONT, fontSize: 11, fontWeight: '600' },
  commentText: { fontFamily: FONT, fontSize: 13, lineHeight: 19, fontWeight: '500' },
  empty: { alignItems: 'center', paddingVertical: 30 },
  emptyText: { fontFamily: FONT, fontSize: 13, fontWeight: '600' },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    height: 46,
  },
  composerInput: { fontFamily: FONT, flex: 1, fontSize: 14, fontWeight: '500' },
  joinNote: {
    fontFamily: FONT,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 12,
  },
});
