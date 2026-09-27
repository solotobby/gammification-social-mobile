import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SELF_ID, lastMessage, type Conversation } from '../../data/messages';
import { useTheme } from '../../theme/ThemeProvider';
import { FONT } from '../../theme/fonts';
import { Avatar } from '../ui/Avatar';
import { shortAge } from './time';

/** Avatar diameter — also what `CONVERSATION_DIVIDER_INSET` is derived from. */
const AVATAR_SIZE = 52;
const AVATAR_GAP = 14;

/**
 * Where the divider between two rows starts, measured from the row's own
 * gutter: past the avatar, so the line runs under the text column only — the
 * list reads as one column of faces rather than a stack of boxes.
 */
export const CONVERSATION_DIVIDER_INSET = AVATAR_SIZE + AVATAR_GAP;

/**
 * One row in the conversation list, laid out the way every chat app has
 * trained people to scan it: avatar, then name + time on the first line and
 * the last message + state on the second.
 *
 * **Flat, not a card.** The row is full-bleed with no border, radius or fill;
 * rows are separated by a hairline under the text column (`MessagesScreen`
 * renders it). Unread is carried by weight and colour — a bold name, a brand
 * timestamp and the count badge — not by tinting the whole row, which made an
 * inbox with a few unread threads look like a stack of alerts.
 *
 * The preview prefixes your own last message with a tick + "You:" the way the
 * web does, so a thread waiting on *them* reads differently from one waiting
 * on you without having to open it.
 *
 * **The row carries no overflow menu.** Pin, mute and delete all live in the
 * thread's own header (`ConversationMenu`) — one place to act on a
 * conversation rather than two. The row still *reports* the resulting state:
 * a muted bell and a pin sit at the end of the preview line, beside the unread
 * badge, which is where people look for them.
 *
 * The pin is MaterialCommunityIcons, not Ionicons: Ionicons' "pin" is a map
 * marker, which in a list of conversations reads as a location.
 */
export function ConversationRow({
  conversation,
  onPress,
  gutter,
}: {
  conversation: Conversation;
  onPress: () => void;
  /** Horizontal padding, so the row's press highlight still runs edge to edge. */
  gutter: number;
}) {
  const { colors } = useTheme();
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
      }${unread ? `, ${conversation.unread} unread` : ''}`}
      style={({ pressed }) => [
        styles.row,
        {
          paddingHorizontal: gutter,
          // Text colour at low alpha, so the highlight shows in both modes —
          // `surfaceAlt` is the page colour in light mode and would vanish.
          backgroundColor: pressed ? `${colors.text}0D` : 'transparent',
        },
      ]}
    >
      <View>
        <Avatar
          name={conversation.member.name}
          tint={conversation.member.tint}
          uri={conversation.member.avatar}
          size={AVATAR_SIZE}
        />
        {conversation.online ? (
          <View
            style={[
              styles.presence,
              { backgroundColor: colors.mint, borderColor: colors.background },
            ]}
          />
        ) : null}
      </View>

      <View style={styles.body}>
        <View style={styles.line}>
          <Text
            style={[styles.name, { color: colors.text, fontWeight: unread ? '800' : '700' }]}
            numberOfLines={1}
          >
            {conversation.member.name}
          </Text>
          <Text
            style={[
              styles.age,
              { color: unread ? colors.brand : colors.textMuted, fontWeight: unread ? '700' : '500' },
            ]}
          >
            {last ? shortAge(last.sentAt) : ''}
          </Text>
        </View>

        <View style={styles.line}>
          <View style={styles.previewWrap}>
            {mine ? (
              <Ionicons
                name={last?.status === 'read' ? 'checkmark-done' : 'checkmark'}
                size={16}
                color={last?.status === 'read' ? colors.brand : colors.textMuted}
              />
            ) : null}
            <Text
              style={[
                styles.preview,
                {
                  color: unread ? colors.textSecondary : colors.textMuted,
                  fontWeight: unread ? '600' : '500',
                },
              ]}
              numberOfLines={1}
            >
              {mine ? `You: ${preview}` : preview}
            </Text>
          </View>

          <View style={styles.state}>
            {conversation.muted ? (
              <Ionicons name="notifications-off" size={15} color={colors.textMuted} />
            ) : null}
            {conversation.pinned ? (
              <MaterialCommunityIcons name="pin" size={16} color={colors.textMuted} />
            ) : null}
            {unread ? (
              <View
                style={[
                  styles.badge,
                  // A muted thread still counts, but doesn't shout.
                  { backgroundColor: conversation.muted ? colors.textMuted : colors.brand },
                ]}
              >
                <Text style={[styles.badgeText, { color: colors.onBrand }]}>
                  {conversation.unread > 99 ? '99+' : conversation.unread}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: AVATAR_GAP,
    paddingVertical: 10,
  },
  presence: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2.5,
  },
  body: { flex: 1, gap: 3 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontFamily: FONT, flex: 1, fontSize: 16 },
  age: { fontFamily: FONT, fontSize: 12 },
  previewWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 3 },
  preview: { fontFamily: FONT, flex: 1, fontSize: 14 },
  state: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontFamily: FONT, fontSize: 11, fontWeight: '800' },
});
