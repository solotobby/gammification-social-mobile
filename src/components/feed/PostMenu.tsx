import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDeletePost } from '../../hooks/useTimeline';
import { useToggleFollow } from '../../hooks/useUser';
import { useFeedbackStore } from '../../stores/feedbackStore';
import { useFollowStore } from '../../stores/followStore';
import { useHiddenStore } from '../../stores/hiddenStore';
import { useTheme } from '../../theme/ThemeProvider';
import type { Post } from '../../data/community';

/**
 * The "⋯" overflow on every feed post. What it offers depends on who wrote it:
 *
 * - **Your own post** — Edit, Analytics, Delete.
 * - **Someone else's** — Follow/Unfollow, Hide, Report.
 *
 * Only two of these are backed by a real endpoint. Delete hits
 * DELETE /timeline/delete/post/{id} (destructive, so it double-confirms) and
 * Follow goes through GET /user/toggle/follow mirrored into `followStore`, the
 * same path the profile and Discover rows use, so the state stays consistent
 * wherever the author shows up. Hide is client-side (`hiddenStore`).
 *
 * Edit and Report have no endpoint yet: both render their real flow and stop
 * at the point where the request would go out, saying so plainly rather than
 * pretending the change was saved. Analytics pushes /post/[id]/analytics.
 */

const REPORT_REASONS = [
  'Spam or misleading',
  'Harassment or hate',
  'Nudity or sexual content',
  'Violence or dangerous acts',
  'Scam or fraud',
  'Something else',
];

type View_ = 'menu' | 'confirmDelete' | 'edit' | 'report';

export function PostMenu({ post, isMine }: { post: Post; isMine: boolean }) {
  const { colors, radius, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const showToast = useFeedbackStore((s) => s.showToast);

  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View_>('menu');
  const [draft, setDraft] = useState(post.body);
  const [reason, setReason] = useState<string | null>(null);

  const deletePost = useDeletePost();

  // Follow state mirrors the same store the profile and Discover rows read.
  const toggleFollow = useToggleFollow();
  const authorId = post.ownerId ?? post.author.id;
  const storedFollowing = useFollowStore((s) => s.following[authorId]);
  const setStoredFollowing = useFollowStore((s) => s.setFollowing);
  const following = storedFollowing ?? false;

  const hide = useHiddenStore((s) => s.hide);

  const close = () => {
    if (deletePost.isPending) return;
    setOpen(false);
    setView('menu');
    setReason(null);
    setDraft(post.body);
  };

  const onDelete = () => {
    deletePost.mutate(post.id, {
      onSuccess: () => {
        setOpen(false);
        setView('menu');
      },
    });
  };

  const onFollow = () => {
    if (toggleFollow.isPending) return;
    const next = !following;
    setStoredFollowing(authorId, next);
    close();
    toggleFollow.mutate(authorId, {
      onSuccess: (data) => {
        setStoredFollowing(authorId, data.following);
        showToast(
          data.following ? `Following @${post.author.handle}` : `Unfollowed @${post.author.handle}`,
          'success',
        );
      },
      onError: () => {
        setStoredFollowing(authorId, !next);
        showToast("Couldn't update follow — please try again.", 'error');
      },
    });
  };

  const onHide = () => {
    hide(post.id);
    close();
    showToast('Post hidden from your feed.', 'success');
  };

  const onSubmitReport = () => {
    close();
    // No moderation endpoint yet — say what actually happened.
    showToast('Reporting isn’t wired up yet — nothing was sent.', 'info');
  };

  const onSaveEdit = () => {
    close();
    // There is no update-post endpoint; don't imply the edit persisted.
    showToast('Editing isn’t available yet — your post is unchanged.', 'info');
  };

  const row = (
    icon: keyof typeof Ionicons.glyphMap,
    label: string,
    onPress: () => void,
    tone?: 'danger',
  ) => (
    <Pressable
      key={label}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.row,
        { borderRadius: radius.md, opacity: pressed ? 0.6 : 1 },
      ]}
    >
      <Ionicons name={icon} size={20} color={tone === 'danger' ? colors.danger : colors.text} />
      <Text
        style={[styles.rowText, { color: tone === 'danger' ? colors.danger : colors.text }]}
      >
        {label}
      </Text>
    </Pressable>
  );

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Post options"
        style={styles.trigger}
      >
        <Ionicons name="ellipsis-horizontal" size={20} color={colors.textMuted} />
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={close}>
        <Pressable style={[styles.backdrop, { backgroundColor: colors.overlay }]} onPress={close}>
          <Pressable
            style={[
              styles.sheet,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderTopLeftRadius: radius.xl,
                borderTopRightRadius: radius.xl,
                paddingBottom: insets.bottom + spacing.lg,
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[styles.grabber, { backgroundColor: colors.border }]} />

            {view === 'menu' ? (
              <View style={styles.menuWrap}>
                {isMine ? (
                  <>
                    {row('create-outline', 'Edit post', () => setView('edit'))}
                    {row('stats-chart-outline', 'View analytics', () => {
                      close();
                      router.push(`/post/${post.id}/analytics`);
                    })}
                    {row('trash-outline', 'Delete post', () => setView('confirmDelete'), 'danger')}
                  </>
                ) : (
                  <>
                    {row(
                      following ? 'person-remove-outline' : 'person-add-outline',
                      following ? `Unfollow @${post.author.handle}` : `Follow @${post.author.handle}`,
                      onFollow,
                    )}
                    {row('eye-off-outline', 'Hide this post', onHide)}
                    {row('flag-outline', 'Report post', () => setView('report'))}
                  </>
                )}
                {row('close-outline', 'Cancel', close)}
              </View>
            ) : view === 'confirmDelete' ? (
              <View style={styles.confirmWrap}>
                <Text style={[styles.confirmTitle, { color: colors.text }]}>Delete this post?</Text>
                <Text style={[styles.confirmText, { color: colors.textMuted }]}>
                  This can't be undone.
                </Text>
                <Pressable
                  onPress={onDelete}
                  disabled={deletePost.isPending}
                  accessibilityRole="button"
                  accessibilityLabel="Confirm delete post"
                  style={[styles.destructiveBtn, { backgroundColor: colors.danger }]}
                >
                  {deletePost.isPending ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.destructiveText}>Delete post</Text>
                  )}
                </Pressable>
                <Pressable
                  onPress={() => setView('menu')}
                  disabled={deletePost.isPending}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel"
                  style={[styles.cancelBtn, { backgroundColor: colors.surfaceAlt }]}
                >
                  <Text style={[styles.cancelText, { color: colors.text }]}>Cancel</Text>
                </Pressable>
              </View>
            ) : view === 'edit' ? (
              <View style={styles.paneWrap}>
                <Text style={[styles.paneTitle, { color: colors.text }]}>Edit post</Text>
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  multiline
                  maxLength={160}
                  style={[
                    styles.editInput,
                    {
                      backgroundColor: colors.surfaceAlt,
                      color: colors.text,
                      borderRadius: radius.md,
                    },
                  ]}
                />
                <Text style={[styles.paneNote, { color: colors.textMuted }]}>
                  The API has no update-post endpoint yet, so saving won't change anything
                  server-side.
                </Text>
                <Pressable
                  onPress={onSaveEdit}
                  accessibilityRole="button"
                  accessibilityLabel="Save changes"
                  style={[styles.destructiveBtn, { backgroundColor: colors.brand }]}
                >
                  <Text style={styles.destructiveText}>Save changes</Text>
                </Pressable>
                <Pressable
                  onPress={() => setView('menu')}
                  accessibilityRole="button"
                  accessibilityLabel="Back"
                  style={[styles.cancelBtn, { backgroundColor: colors.surfaceAlt }]}
                >
                  <Text style={[styles.cancelText, { color: colors.text }]}>Back</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.paneWrap}>
                <Text style={[styles.paneTitle, { color: colors.text }]}>Report post</Text>
                <ScrollView style={styles.reasonList} keyboardShouldPersistTaps="handled">
                  {REPORT_REASONS.map((r) => (
                    <Pressable
                      key={r}
                      onPress={() => setReason(r)}
                      accessibilityRole="button"
                      accessibilityLabel={r}
                      style={({ pressed }) => [
                        styles.reasonRow,
                        {
                          borderRadius: radius.md,
                          backgroundColor: reason === r ? `${colors.brand}1A` : 'transparent',
                          opacity: pressed ? 0.6 : 1,
                        },
                      ]}
                    >
                      <Ionicons
                        name={reason === r ? 'radio-button-on' : 'radio-button-off'}
                        size={19}
                        color={reason === r ? colors.brand : colors.textMuted}
                      />
                      <Text style={[styles.reasonText, { color: colors.text }]}>{r}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
                <Pressable
                  onPress={onSubmitReport}
                  disabled={!reason}
                  accessibilityRole="button"
                  accessibilityLabel="Submit report"
                  style={[
                    styles.destructiveBtn,
                    { backgroundColor: reason ? colors.danger : colors.surfaceAlt },
                  ]}
                >
                  <Text
                    style={[
                      styles.destructiveText,
                      !reason && { color: colors.textMuted },
                    ]}
                  >
                    Submit report
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setView('menu')}
                  accessibilityRole="button"
                  accessibilityLabel="Back"
                  style={[styles.cancelBtn, { backgroundColor: colors.surfaceAlt }]}
                >
                  <Text style={[styles.cancelText, { color: colors.text }]}>Back</Text>
                </Pressable>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    paddingTop: 10,
    paddingHorizontal: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  grabber: {
    width: 40,
    height: 5,
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 14,
  },
  menuWrap: { gap: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  rowText: { fontSize: 16, fontWeight: '700' },
  confirmWrap: { gap: 12, paddingHorizontal: 4, paddingTop: 2 },
  confirmTitle: { fontSize: 18, fontWeight: '800' },
  confirmText: { fontSize: 14, fontWeight: '500', marginBottom: 4 },
  paneWrap: { gap: 12, paddingHorizontal: 4, paddingTop: 2 },
  paneTitle: { fontSize: 18, fontWeight: '800' },
  paneNote: { fontSize: 13, fontWeight: '500', lineHeight: 18 },
  editInput: {
    minHeight: 108,
    maxHeight: 180,
    padding: 14,
    fontSize: 15,
    lineHeight: 21,
    textAlignVertical: 'top',
  },
  reasonList: { maxHeight: 260 },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 10,
  },
  reasonText: { fontSize: 15, fontWeight: '600' },
  destructiveBtn: {
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  destructiveText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  cancelBtn: {
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: { fontSize: 16, fontWeight: '700' },
});
