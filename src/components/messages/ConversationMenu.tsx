import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Conversation } from '../../data/messages';
import { useBlockMessaging, useSetConversationFlag } from '../../hooks/useMessages';
import { useFeedbackStore } from '../../stores/feedbackStore';
import { useTheme } from '../../theme/ThemeProvider';
import { FONT } from '../../theme/fonts';

/**
 * The "⋮" overflow in a thread's header, matching the web's: pin, mute, view
 * profile and block — all four real (`/conversations/{id}/pin|mute`,
 * `/conversations/block/{userId}`). Pin and mute are optimistic and survive
 * going offline; block asks first and needs a connection, because it hides
 * the thread and the person doing it should know it actually happened.
 *
 * There's no "delete conversation": the API has no such route, and a local
 * hide would bring the thread back on the next poll.
 *
 * **This is the only place these actions live.** The conversation list shows
 * the resulting state (a pin, a muted bell) but carries no menu of its own:
 * one place to act on a thread beats two, and a column of identical "⋮"
 * glyphs competes with the unread badges that are the reason to scan a list.
 */
export function ConversationMenu({
  conversation,
  onBlocked,
}: {
  conversation: Conversation;
  onBlocked: () => void;
}) {
  const { colors, radius, spacing } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const setFlag = useSetConversationFlag();
  const block = useBlockMessaging();
  const showToast = useFeedbackStore((s) => s.showToast);
  const showApiError = useFeedbackStore((s) => s.showApiError);
  const { member } = conversation;

  const close = () => {
    setOpen(false);
    setConfirming(false);
  };

  /**
   * `icon` takes either family: most rows are Ionicons, but the pin is a
   * MaterialCommunityIcon because Ionicons' "pin" is a map marker, which reads
   * as a location rather than something fastened to the top of a list.
   */
  const row = (
    icon:
      | keyof typeof Ionicons.glyphMap
      | { mc: keyof typeof MaterialCommunityIcons.glyphMap },
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
      {typeof icon === 'string' ? (
        <Ionicons name={icon} size={20} color={tone === 'danger' ? colors.danger : colors.text} />
      ) : (
        <MaterialCommunityIcons
          name={icon.mc}
          size={20}
          color={tone === 'danger' ? colors.danger : colors.text}
        />
      )}
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
                  Block {member.name}?
                </Text>
                <Text style={[styles.confirmText, { color: colors.textMuted }]}>
                  They won’t be able to message you, and this conversation will be hidden. You can
                  unblock them from their profile — the conversation comes back as it was.
                </Text>
                <Pressable
                  onPress={() =>
                    block.mutate(
                      { member, conversationId: conversation.id },
                      {
                        onSuccess: () => {
                          close();
                          showToast(`Blocked ${member.name}.`, 'success');
                          onBlocked();
                        },
                        onError: (error) => showApiError(error, `Couldn’t block ${member.name}.`),
                      },
                    )
                  }
                  disabled={block.isPending}
                  accessibilityRole="button"
                  accessibilityLabel={`Confirm block ${member.name}`}
                  style={[
                    styles.destructiveBtn,
                    { backgroundColor: colors.danger, opacity: block.isPending ? 0.7 : 1 },
                  ]}
                >
                  {block.isPending ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.destructiveText}>Block</Text>
                  )}
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
                {row(
                  { mc: conversation.pinned ? 'pin-off' : 'pin' },
                  conversation.pinned ? 'Unpin conversation' : 'Pin conversation',
                  () => {
                    setFlag.mutate({ id: conversation.id, flag: 'pinned', value: !conversation.pinned });
                    close();
                    showToast(
                      conversation.pinned
                        ? 'Unpinned — back in date order.'
                        : 'Pinned to the top of your messages.',
                      'success',
                    );
                  },
                )}
                {row(
                  conversation.muted ? 'notifications-outline' : 'notifications-off-outline',
                  conversation.muted ? 'Unmute notifications' : 'Mute notifications',
                  () => {
                    setFlag.mutate({ id: conversation.id, flag: 'muted', value: !conversation.muted });
                    close();
                    showToast(
                      conversation.muted
                        ? 'Notifications on for this conversation.'
                        : 'Muted — you won’t be notified about new messages here.',
                      'success',
                    );
                  },
                )}
                {row('person-outline', `View ${member.name}’s profile`, () => {
                  close();
                  router.push({ pathname: '/member/[handle]', params: { handle: member.handle } });
                })}
                {row('ban-outline', `Block ${member.name}`, () => setConfirming(true), 'danger')}
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
