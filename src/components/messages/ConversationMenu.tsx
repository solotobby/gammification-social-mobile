import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Conversation } from '../../data/messages';
import { useFeedbackStore } from '../../stores/feedbackStore';
import { useMessagesStore } from '../../stores/messagesStore';
import { useTheme } from '../../theme/ThemeProvider';
import { FONT } from '../../theme/fonts';

/**
 * The "⋮" overflow in a thread's header, matching the web's. Two of its
 * actions are local and real (mute, delete this thread); blocking and
 * reporting have no endpoint — no messaging API exists at all yet — so they
 * say so rather than implying a moderation request went out, the same rule
 * `PostMenu`'s Report follows.
 */
export function ConversationMenu({
  conversation,
  onDeleted,
}: {
  conversation: Conversation;
  onDeleted: () => void;
}) {
  const { colors, radius, spacing } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const toggleMute = useMessagesStore((s) => s.toggleMute);
  const remove = useMessagesStore((s) => s.remove);
  const showToast = useFeedbackStore((s) => s.showToast);

  const close = () => {
    setOpen(false);
    setConfirming(false);
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
      <Text style={[styles.rowText, { color: tone === 'danger' ? colors.danger : colors.text }]}>
        {label}
      </Text>
    </Pressable>
  );

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Conversation options"
        style={styles.trigger}
      >
        <Ionicons name="ellipsis-vertical" size={20} color={colors.textMuted} />
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={close}>
        <Pressable style={[styles.backdrop, { backgroundColor: colors.overlay }]} onPress={close}>
          <Pressable
            onPress={(e) => e.stopPropagation()}
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
          >
            <View style={[styles.grabber, { backgroundColor: colors.border }]} />

            {confirming ? (
              <View style={styles.confirmWrap}>
                <Text style={[styles.confirmTitle, { color: colors.text }]}>
                  Delete this conversation?
                </Text>
                <Text style={[styles.confirmText, { color: colors.textMuted }]}>
                  It’s removed from this device only — {conversation.member.name} keeps their copy.
                </Text>
                <Pressable
                  onPress={() => {
                    remove(conversation.id);
                    close();
                    onDeleted();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Confirm delete conversation"
                  style={[styles.destructiveBtn, { backgroundColor: colors.danger }]}
                >
                  <Text style={styles.destructiveText}>Delete conversation</Text>
                </Pressable>
                <Pressable
                  onPress={() => setConfirming(false)}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel"
                  style={[styles.cancelBtn, { backgroundColor: colors.surfaceAlt }]}
                >
                  <Text style={[styles.cancelText, { color: colors.text }]}>Cancel</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.menuWrap}>
                {row('person-outline', `View @${conversation.member.handle}`, () => {
                  close();
                  router.push(`/member/${conversation.member.handle}`);
                })}
                {row(
                  conversation.muted ? 'notifications-outline' : 'notifications-off-outline',
                  conversation.muted ? 'Unmute conversation' : 'Mute conversation',
                  () => {
                    toggleMute(conversation.id);
                    close();
                    showToast(
                      conversation.muted ? 'Conversation unmuted.' : 'Conversation muted.',
                      'success',
                    );
                  },
                )}
                {row('ban-outline', 'Block & report', () => {
                  close();
                  showToast('Blocking isn’t wired up yet — nothing was sent.', 'info');
                })}
                {row('trash-outline', 'Delete conversation', () => setConfirming(true), 'danger')}
                {row('close-outline', 'Cancel', close)}
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: { paddingHorizontal: 16, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  grabber: { alignSelf: 'center', width: 42, height: 4, borderRadius: 2, marginBottom: 12 },
  menuWrap: { gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 8 },
  rowText: { fontFamily: FONT, fontSize: 15, fontWeight: '700' },
  confirmWrap: { gap: 10, paddingHorizontal: 8, paddingBottom: 4 },
  confirmTitle: { fontFamily: FONT, fontSize: 17, fontWeight: '800' },
  confirmText: { fontFamily: FONT, fontSize: 13, fontWeight: '500', marginBottom: 6 },
  destructiveBtn: { height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  destructiveText: { fontFamily: FONT, color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  cancelBtn: { height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontFamily: FONT, fontSize: 15, fontWeight: '700' },
});
