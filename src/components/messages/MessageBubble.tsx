import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { SELF_ID, type ChatMessage } from '../../data/messages';
import { useTheme } from '../../theme/ThemeProvider';
import { FONT } from '../../theme/fonts';
import { clockTime } from './time';

/**
 * One message in a thread.
 *
 * Yours sits right on the brand gradient (the same violet pair as
 * `GradientButton`, so the app has one "this is you" colour); theirs sits left
 * on `colors.surface` with a hairline, which is the only treatment that stays
 * legible over `ScreenBackground`'s wash in both modes.
 *
 * The timestamp lives *inside* the bubble, bottom-right, like the web — a
 * separate line under every message doubles the thread's height for
 * information nobody reads twice.
 */
export function MessageBubble({ message }: { message: ChatMessage }) {
  const { colors, brand, radius } = useTheme();
  const mine = message.senderId === SELF_ID;
  const hasImage = !!message.imageUri;

  const meta = (
    <View style={styles.metaRow}>
      <Text style={[styles.time, { color: mine ? 'rgba(255,255,255,0.78)' : colors.textMuted }]}>
        {clockTime(message.sentAt)}
      </Text>
      {mine ? (
        <Ionicons
          name={message.status === 'read' ? 'checkmark-done' : 'checkmark'}
          size={13}
          color={message.status === 'read' ? '#FFFFFF' : 'rgba(255,255,255,0.78)'}
        />
      ) : null}
    </View>
  );

  const content = (
    <>
      {hasImage ? (
        <Image
          source={{ uri: message.imageUri! }}
          style={[styles.image, { borderRadius: radius.md }]}
          contentFit="cover"
          accessibilityLabel="Photo in this conversation"
        />
      ) : null}
      {message.body ? (
        <Text style={[styles.body, { color: mine ? '#FFFFFF' : colors.text }]}>{message.body}</Text>
      ) : null}
      {meta}
    </>
  );

  return (
    <View style={[styles.row, { justifyContent: mine ? 'flex-end' : 'flex-start' }]}>
      {mine ? (
        <LinearGradient
          colors={[brand.violetBright, brand.violet]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.bubble, styles.mine]}
        >
          {content}
        </LinearGradient>
      ) : (
        <View
          style={[
            styles.bubble,
            styles.theirs,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          {content}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', width: '100%' },
  bubble: {
    maxWidth: '78%',
    paddingHorizontal: 13,
    paddingVertical: 9,
    gap: 6,
  },
  // A squared corner on the sender's side points the bubble at its author.
  mine: { borderRadius: 20, borderBottomRightRadius: 6 },
  theirs: { borderRadius: 20, borderBottomLeftRadius: 6, borderWidth: StyleSheet.hairlineWidth },
  image: { width: 210, height: 260 },
  body: { fontFamily: FONT, fontSize: 15, lineHeight: 21, fontWeight: '500' },
  metaRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', gap: 3 },
  time: { fontFamily: FONT, fontSize: 10, fontWeight: '700' },
});
