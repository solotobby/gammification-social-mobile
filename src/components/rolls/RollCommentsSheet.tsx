import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { toRollComment } from '../../api/rolls';
import { mergeComments } from '../../api/timeline';
import { useRollComments } from '../../hooks/useRolls';
import { useAddComment } from '../../hooks/useTimeline';
import { keyboardInset, useKeyboard } from '../../hooks/useKeyboard';
import { useEngagementStore } from '../../stores/engagementStore';
import { useTheme } from '../../theme/ThemeProvider';
import { Avatar } from '../ui/Avatar';
import { FONT } from '../../theme/fonts';

/**
 * The TikTok-style comment sheet for a roll: the thread over the video rather
 * than a push to /post/[id], so playback keeps running behind it.
 *
 * Reads GET /rolls/{videoId}/comments, and writes through the *timeline*
 * comment mutation against the roll's `post_id` — there is no roll-comment
 * write endpoint, and a roll is backed by the same post the feed comments on.
 * That also means a comment written here shows up on the post in the feed.
 */
export function RollCommentsSheet({
  videoId,
  postId,
  count,
  onClose,
}: {
  videoId: string;
  postId: string;
  count: number;
  onClose: () => void;
}) {
  const { colors, radius, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const { visible: keyboardUp, height: keyboardHeight } = useKeyboard();

  const [draft, setDraft] = useState('');
  const clientSeq = useRef(0);

  const query = useRollComments(videoId);
  const addComment = useAddComment();

  // Session comments live in the engagement store keyed by post id (the API
  // returns counts, not bodies, on the surfaces that list rolls).
  const mine = useEngagementStore((s) => s.myComments[postId]);

  const comments = useMemo(() => {
    const server = (query.data?.pages ?? [])
      .flatMap((page) => page.data)
      .map((raw, i) => toRollComment(raw, i))
      .filter((c) => c.body.length > 0);
    return mergeComments(server, mine ?? []);
  }, [query.data, mine]);

  const submit = () => {
    const body = draft.trim();
    if (!body) return;
    clientSeq.current += 1;
    addComment.mutate({ postId, body, clientId: `roll-${postId}-${clientSeq.current}` });
    setDraft('');
  };

  const total = count + (mine?.length ?? 0);

  return (
    <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close comments">
      {/* The measured keyboard height, not KeyboardAvoidingView.
          KAV estimates from its own layout and lands ~a safe-area inset short
          here, leaving a strip of video between the composer and the keys.
          `endCoordinates.height` is the keyboard's true height, so padding by
          it puts the composer exactly on top of the keyboard.
          Android is excluded: `adjustResize` already shrinks the window, and
          padding as well would push the sheet up twice. */}
      <View
        style={[
          styles.avoider,
          Platform.OS === 'ios' ? { paddingBottom: keyboardHeight } : null,
        ]}
        pointerEvents="box-none"
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              borderTopLeftRadius: radius.lg,
              borderTopRightRadius: radius.lg,
            },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.text }]}>
              {total === 1 ? '1 comment' : `${total} comments`}
            </Text>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Close comments"
            >
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </Pressable>
          </View>

          {query.isLoading ? (
            <View style={styles.stateWrap}>
              <ActivityIndicator color={colors.brand} />
            </View>
          ) : comments.length === 0 ? (
            <View style={styles.stateWrap}>
              <Ionicons name="chatbubble-outline" size={28} color={colors.textMuted} />
              <Text style={[styles.stateText, { color: colors.textMuted }]}>
                No comments yet — say something.
              </Text>
            </View>
          ) : (
            <FlatList
              data={comments}
              keyExtractor={(c) => c.id}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingVertical: spacing.md, gap: spacing.lg }}
              onEndReached={() => {
                if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
              }}
              onEndReachedThreshold={0.6}
              renderItem={({ item }) => (
                <View style={styles.row}>
                  <Avatar name={item.author.name} tint={item.author.tint} size={34} />
                  <View style={styles.rowText}>
                    <Text style={[styles.rowHandle, { color: colors.textMuted }]}>
                      @{item.author.handle}
                      {item.timeAgo ? ` · ${item.timeAgo}` : ''}
                    </Text>
                    <Text style={[styles.rowBody, { color: colors.text }]}>{item.body}</Text>
                  </View>
                </View>
              )}
            />
          )}

          <View
            style={[
              styles.composer,
              {
                borderTopColor: colors.border,
                paddingBottom: keyboardInset(insets.bottom, keyboardUp) + 10,
              },
            ]}
          >
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Add a comment…"
              placeholderTextColor={colors.textMuted}
              style={[
                styles.input,
                {
                  backgroundColor: colors.surfaceAlt,
                  color: colors.text,
                  borderRadius: radius.md,
                },
              ]}
              multiline
              maxLength={300}
              onSubmitEditing={submit}
              returnKeyType="send"
            />
            <Pressable
              onPress={submit}
              disabled={!draft.trim()}
              accessibilityRole="button"
              accessibilityLabel="Post comment"
              style={[
                styles.send,
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
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  avoider: { flex: 1, justifyContent: 'flex-end' },
  // Tall enough to read a thread, short enough to keep the video visible.
  // maxHeight, not height: with the keyboard up the sheet has to be able to
  // shrink, or KeyboardAvoidingView pushes a rigid 68% box off the top of the
  // screen and takes the thread's first comments with it.
  sheet: { maxHeight: '68%', minHeight: '45%', paddingHorizontal: 18, paddingTop: 8 },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontFamily: FONT, fontSize: 15, fontWeight: '800' },
  stateWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  stateText: { fontFamily: FONT, fontSize: 13, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 10 },
  rowText: { flex: 1, gap: 3 },
  rowHandle: { fontFamily: FONT, fontSize: 12, fontWeight: '700' },
  rowBody: { fontFamily: FONT, fontSize: 14, lineHeight: 19 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    fontFamily: FONT,
    flex: 1,
    maxHeight: 96,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
  },
  send: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
