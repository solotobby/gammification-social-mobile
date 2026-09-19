import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ConversationMenu } from '../../src/components/messages/ConversationMenu';
import { MessageBubble } from '../../src/components/messages/MessageBubble';
import { dayLabel } from '../../src/components/messages/time';
import { Avatar } from '../../src/components/ui/Avatar';
import { BackButton } from '../../src/components/ui/BackButton';
import { ScreenBackground } from '../../src/components/ui/ScreenBackground';
import type { ChatMessage } from '../../src/data/messages';
import { useComposerInset } from '../../src/hooks/useKeyboard';
import { useMessagesStore } from '../../src/stores/messagesStore';
import { useTheme } from '../../src/theme/ThemeProvider';
import { FONT } from '../../src/theme/fonts';

/** A day divider or a message — the list renders one flat array of both. */
type Row =
  | { kind: 'day'; id: string; label: string }
  | { kind: 'message'; id: string; message: ChatMessage };

/**
 * One conversation, ported from the right-hand pane of the web's
 * `/user/messages`: header with the other person and their presence, the
 * thread itself under day dividers, and a composer with a photo attachment.
 *
 * **Dummy data** (`src/data/messages.ts`) — there is no messaging API. Sending
 * appends to `messagesStore` and nothing replies: a fabricated incoming
 * message would demo well and misrepresent the product.
 *
 * It lives on the root stack, not in `(tabs)`, so it covers the tab bar the
 * way every other pushed screen does.
 */
export default function ConversationScreen() {
  const { colors, brand, radius, spacing } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  // The bottom-anchored composer drops its safe-area inset once the keyboard
  // covers that strip — see src/hooks/useKeyboard.ts.
  const composerInset = useComposerInset(insets.bottom);

  const conversation = useMessagesStore((s) => s.conversations.find((c) => c.id === id));
  const send = useMessagesStore((s) => s.send);
  const markRead = useMessagesStore((s) => s.markRead);

  const [draft, setDraft] = useState('');
  const [attachment, setAttachment] = useState<string | null>(null);

  // Opening the thread is what clears its unread count.
  useEffect(() => {
    if (id) markRead(id);
  }, [id, markRead]);

  /**
   * The thread, newest first — the list is **inverted**, so index 0 renders at
   * the bottom of the screen.
   *
   * Inverted rather than scrolled-to-end on purpose: a plain list has to be
   * told to scroll after every layout pass, and it under-shoots whenever a
   * pass lands late (the composer measuring, a photo bubble), leaving the
   * newest message clipped under the composer. An inverted list simply starts
   * at the bottom and stays there.
   *
   * Day dividers are built in reading order and reversed with everything else,
   * which puts each one back above its own day's messages once flipped.
   */
  const rows = useMemo<Row[]>(() => {
    if (!conversation) return [];
    const out: Row[] = [];
    let lastDay = '';
    for (const message of conversation.messages) {
      const label = dayLabel(message.sentAt);
      if (label !== lastDay) {
        out.push({ kind: 'day', id: `day-${label}-${message.id}`, label });
        lastDay = label;
      }
      out.push({ kind: 'message', id: message.id, message });
    }
    return out.reverse();
  }, [conversation]);

  if (!conversation) {
    return (
      <View style={[styles.root, styles.missing, { backgroundColor: colors.background }]}>
        <ScreenBackground />
        <Ionicons name="chatbubble-ellipses-outline" size={30} color={colors.textMuted} />
        <Text style={[styles.missingText, { color: colors.textMuted }]}>
          This conversation is no longer here.
        </Text>
        <Pressable
          onPress={() => router.replace('/messages')}
          accessibilityRole="button"
          accessibilityLabel="Back to messages"
          style={[styles.missingBtn, { backgroundColor: colors.brand, borderRadius: radius.pill }]}
        >
          <Text style={[styles.missingBtnText, { color: colors.onBrand }]}>Back to Messages</Text>
        </Pressable>
      </View>
    );
  }

  const canSend = draft.trim().length > 0 || !!attachment;

  const onSend = () => {
    if (!canSend) return;
    send(conversation.id, draft, attachment ?? undefined);
    setDraft('');
    setAttachment(null);
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.length) return;
    setAttachment(result.assets[0]!.uri);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScreenBackground />
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header — pinned, so the person you're talking to never scrolls away */}
        <View
          style={[
            styles.header,
            {
              paddingTop: insets.top + spacing.sm,
              backgroundColor: colors.surface,
              borderBottomColor: colors.border,
            },
          ]}
        >
          <BackButton onPress={() => router.back()} />
          <Pressable
            onPress={() => router.push(`/member/${conversation.member.handle}`)}
            accessibilityRole="button"
            accessibilityLabel={`View ${conversation.member.name}'s profile`}
            style={styles.headerIdentity}
          >
            <View>
              <Avatar
                name={conversation.member.name}
                tint={conversation.member.tint}
                uri={conversation.member.avatar}
                size={40}
              />
              {conversation.online ? (
                <View
                  style={[
                    styles.presence,
                    { backgroundColor: colors.mint, borderColor: colors.surface },
                  ]}
                />
              ) : null}
            </View>
            <View style={styles.headerText}>
              <Text style={[styles.headerName, { color: colors.text }]} numberOfLines={1}>
                {conversation.member.name}
              </Text>
              <Text
                style={[
                  styles.headerPresence,
                  { color: conversation.online ? colors.mint : colors.textMuted },
                ]}
                numberOfLines={1}
              >
                {conversation.online ? 'Active now' : (conversation.lastActive ?? 'Offline')}
                {conversation.muted ? ' · Muted' : ''}
              </Text>
            </View>
          </Pressable>
          <ConversationMenu
            conversation={conversation}
            onDeleted={() => router.replace('/messages')}
          />
        </View>

        <FlatList
          data={rows}
          // Only when there is something to invert: an inverted list renders
          // its empty component upside down.
          inverted={rows.length > 0}
          keyExtractor={(row) => row.id}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.listContent,
            {
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.lg,
              // An empty thread has no bottom to sit at, so its placeholder
              // centres rather than clinging to the composer.
              justifyContent: rows.length ? 'flex-start' : 'center',
            },
          ]}
          renderItem={({ item }) =>
            item.kind === 'day' ? (
              <View style={styles.dayRow}>
                <Text
                  style={[
                    styles.dayLabel,
                    {
                      color: colors.textMuted,
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      borderRadius: radius.pill,
                    },
                  ]}
                >
                  {item.label}
                </Text>
              </View>
            ) : (
              <MessageBubble message={item.message} />
            )
          }
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListEmptyComponent={
            <View style={styles.emptyThread}>
              <Avatar
                name={conversation.member.name}
                tint={conversation.member.tint}
                uri={conversation.member.avatar}
                size={64}
              />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                {conversation.member.name}
              </Text>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                No messages yet — say hello.
              </Text>
            </View>
          }
        />

        {/* Composer */}
        <View
          style={[
            styles.composerWrap,
            {
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
              paddingBottom: composerInset + 10,
            },
          ]}
        >
          {attachment ? (
            <View style={[styles.attachment, { borderColor: colors.border, borderRadius: radius.md }]}>
              <Image source={{ uri: attachment }} style={styles.attachmentImage} />
              <Pressable
                onPress={() => setAttachment(null)}
                accessibilityRole="button"
                accessibilityLabel="Remove photo"
                style={[styles.attachmentRemove, { backgroundColor: colors.overlay }]}
              >
                <Ionicons name="close" size={14} color="#FFFFFF" />
              </Pressable>
            </View>
          ) : null}

          <View style={styles.composerRow}>
            <Pressable
              onPress={() => void pickImage()}
              accessibilityRole="button"
              accessibilityLabel="Attach a photo"
              style={[styles.attachButton, { backgroundColor: colors.surfaceAlt }]}
            >
              <Ionicons name="image-outline" size={20} color={colors.brand} />
            </Pressable>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Message…"
              placeholderTextColor={colors.textMuted}
              selectionColor={colors.brand}
              multiline
              style={[
                styles.input,
                {
                  backgroundColor: colors.surfaceAlt,
                  borderColor: colors.border,
                  color: colors.text,
                  borderRadius: radius.lg,
                },
              ]}
            />
            <Pressable
              onPress={onSend}
              disabled={!canSend}
              accessibilityRole="button"
              accessibilityLabel="Send message"
              style={[
                styles.sendButton,
                { backgroundColor: canSend ? brand.violet : colors.surfaceAlt },
              ]}
            >
              <Ionicons
                name="send"
                size={18}
                color={canSend ? '#FFFFFF' : colors.textMuted}
                style={styles.sendGlyph}
              />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerIdentity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerText: { flex: 1 },
  headerName: { fontFamily: FONT, fontSize: 15, fontWeight: '800' },
  headerPresence: { fontFamily: FONT, fontSize: 12, fontWeight: '600' },
  presence: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2.5,
  },
  listContent: { flexGrow: 1 },
  dayRow: { alignItems: 'center', paddingVertical: 6 },
  dayLabel: {
    fontFamily: FONT,
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: 12,
    paddingVertical: 5,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  emptyThread: { alignItems: 'center', gap: 6, paddingVertical: 40 },
  emptyTitle: { fontFamily: FONT, fontSize: 16, fontWeight: '800', marginTop: 6 },
  emptyText: { fontFamily: FONT, fontSize: 13, fontWeight: '500' },
  composerWrap: {
    paddingHorizontal: 12,
    paddingTop: 10,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  attachment: {
    width: 64,
    height: 64,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  attachmentImage: { width: '100%', height: '100%' },
  attachmentRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  attachButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    fontFamily: FONT,
    fontSize: 15,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The paper-plane glyph is drawn with its own optical offset; nudge it back.
  sendGlyph: { marginLeft: -1 },
  missing: { alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  missingText: { fontFamily: FONT, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  missingBtn: { paddingHorizontal: 20, height: 46, alignItems: 'center', justifyContent: 'center' },
  missingBtnText: { fontFamily: FONT, fontSize: 14, fontWeight: '800' },
});
