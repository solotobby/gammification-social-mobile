import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDeletePost } from '../../hooks/useTimeline';
import { useTheme } from '../../theme/ThemeProvider';

/**
 * The "⋯" overflow button shown on the current user's own feed posts. It opens
 * a bottom-sheet menu whose only action today is deleting the post — a
 * destructive, irreversible call, so it asks for a second confirmation before
 * hitting DELETE /timeline/delete/post/{id}.
 */
export function PostMenu({ postId }: { postId: string }) {
  const { colors, radius, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const deletePost = useDeletePost();

  const close = () => {
    if (deletePost.isPending) return;
    setOpen(false);
    setConfirming(false);
  };

  const onDelete = () => {
    deletePost.mutate(postId, {
      onSuccess: () => {
        setOpen(false);
        setConfirming(false);
      },
    });
  };

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
        <Pressable
          style={[styles.backdrop, { backgroundColor: colors.overlay }]}
          onPress={close}
        >
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

            {confirming ? (
              <View style={styles.confirmWrap}>
                <Text style={[styles.confirmTitle, { color: colors.text }]}>
                  Delete this post?
                </Text>
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
                  onPress={() => setConfirming(false)}
                  disabled={deletePost.isPending}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel"
                  style={[styles.cancelBtn, { backgroundColor: colors.surfaceAlt }]}
                >
                  <Text style={[styles.cancelText, { color: colors.text }]}>Cancel</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.menuWrap}>
                <Pressable
                  onPress={() => setConfirming(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Delete post"
                  style={[styles.row, { borderRadius: radius.md }]}
                >
                  <Ionicons name="trash-outline" size={20} color={colors.danger} />
                  <Text style={[styles.rowText, { color: colors.danger }]}>Delete post</Text>
                </Pressable>
                <Pressable
                  onPress={close}
                  accessibilityRole="button"
                  accessibilityLabel="Close menu"
                  style={[styles.row, { borderRadius: radius.md }]}
                >
                  <Ionicons name="close-outline" size={20} color={colors.textMuted} />
                  <Text style={[styles.rowText, { color: colors.text }]}>Cancel</Text>
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
