import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SELF_ID, lastMessage, type Conversation } from '../../data/messages';
import { useTheme } from '../../theme/ThemeProvider';
import { FONT } from '../../theme/fonts';
import { Avatar } from '../ui/Avatar';
import { shortAge } from './time';

/**
 * One row in the conversation list: avatar with a presence dot, the other
 * person's name, a preview of the last message, its age, and the unread count.
 *
 * The preview prefixes your own last message with a tick + "You:" the way the
 * web does, so a thread waiting on *them* reads differently from one waiting
 * on you without having to open it.
 *
 * **The row carries no overflow menu.** Pin, mute and delete all live in the
 * thread's own header (`ConversationMenu`) — one place to act on a
 * conversation rather than two, and a list of six identical "⋮" glyphs is
 * noise next to the unread badges that are the reason to scan this screen.
 * The row still *reports* the resulting state: a pin and a muted bell sit with
 * the name.
 */
export function ConversationRow({
  conversation,
  onPress,
}: {
  conversation: Conversation;
  onPress: () => void;
}) {
  const { colors, radius, spacing } = useTheme();
  const last = lastMessage(conversation);
  const mine = last?.senderId === SELF_ID;
  const unread = conversation.unread > 0;

  const preview = last
    ? last.body || (last.imageUri ? 'Photo' : '')
    : 'Say hello — this thread is empty';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Conversation with ${conversation.member.name}${
        conversation.pinned ? ', pinned' : ''
      }`}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: unread ? `${colors.brand}0F` : colors.surface,
          borderColor: unread ? `${colors.brand}33` : colors.border,
          borderRadius: radius.md,
          paddingHorizontal: spacing.md,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <View>
        <Avatar
          name={conversation.member.name}
          tint={conversation.member.tint}
          uri={conversation.member.avatar}
          size={48}
        />
        {conversation.online ? (
          <View
            style={[styles.presence, { backgroundColor: colors.mint, borderColor: colors.surface }]}
          />
        ) : null}
      </View>

      <View style={styles.body}>
        <View style={styles.nameRow}>
          {/* A pin reads as a property of the thread, so it sits with the name
              rather than in the meta column — that column already carries the
              age and the unread badge, and a third glyph there turns a
              glanceable stack into a puzzle.

              MaterialCommunityIcons, not Ionicons: Ionicons' "pin" is a map
              marker, which in a list of conversations reads as a location. */}
          {conversation.pinned ? (
            <MaterialCommunityIcons name="pin" size={14} color={colors.brand} />
          ) : null}
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {conversation.member.name}
          </Text>
          {conversation.muted ? (
            <Ionicons name="notifications-off" size={12} color={colors.textMuted} />
          ) : null}
        </View>
        <View style={styles.previewRow}>
          {mine ? (
            <Ionicons
              name={last?.status === 'read' ? 'checkmark-done' : 'checkmark'}
              size={14}
              color={last?.status === 'read' ? colors.brand : colors.textMuted}
            />
          ) : null}
          <Text
            style={[
              styles.preview,
              { color: unread ? colors.text : colors.textMuted, fontWeight: unread ? '700' : '500' },
            ]}
            numberOfLines={1}
          >
            {mine ? `You: ${preview}` : preview}
          </Text>
        </View>
      </View>

      <View style={styles.meta}>
        <Text style={[styles.age, { color: unread ? colors.brand : colors.textMuted }]}>
          {last ? shortAge(last.sentAt) : ''}
        </Text>
        {unread ? (
          <View style={[styles.badge, { backgroundColor: colors.brand }]}>
            <Text style={[styles.badgeText, { color: colors.onBrand }]}>
              {conversation.unread > 9 ? '9+' : conversation.unread}
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  presence: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2.5,
  },
  body: { flex: 1, gap: 3 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  name: { fontFamily: FONT, flexShrink: 1, fontSize: 15, fontWeight: '800' },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  preview: { fontFamily: FONT, flex: 1, fontSize: 13 },
  meta: { alignItems: 'flex-end', gap: 6, minWidth: 34 },
  age: { fontFamily: FONT, fontSize: 11, fontWeight: '700' },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontFamily: FONT, fontSize: 11, fontWeight: '900' },
});
