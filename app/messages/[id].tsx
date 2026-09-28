import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError } from '../../src/api/client';
import type { UploadFile } from '../../src/api/types';
import { MediaViewer } from '../../src/components/feed/MediaViewer';
import { ConversationMenu } from '../../src/components/messages/ConversationMenu';
import { MessageBubble } from '../../src/components/messages/MessageBubble';
import { dayLabel } from '../../src/components/messages/time';
import { Avatar } from '../../src/components/ui/Avatar';
import { LevelBadge, NameWithBadge } from '../../src/components/ui/LevelBadge';
import { BackButton } from '../../src/components/ui/BackButton';
import { ScreenBackground } from '../../src/components/ui/ScreenBackground';
import type { MediaItem } from '../../src/data/media';
import {
  MAX_MESSAGE_IMAGES,
  MAX_MESSAGE_LENGTH,
  type ChatMessage,
} from '../../src/data/messages';
import { useIsOffline } from '../../src/hooks/useIsOffline';
import { useComposerInset } from '../../src/hooks/useKeyboard';
import {
  findCachedConversation,
  useLoadOlderMessages,
  useMarkConversationRead,
  useSendMessage,
  useThread,
  withOutbox,
} from '../../src/hooks/useMessages';
import { useFeedbackStore } from '../../src/stores/feedbackStore';
import { useOutboxStore } from '../../src/stores/outboxStore';
import { useTheme } from '../../src/theme/ThemeProvider';
import { FONT } from '../../src/theme/fonts';

/** A day divider or a message — the list renders one flat array of both. */
type Row =
  | { kind: 'day'; id: string; label: string }
  | { kind: 'message'; id: string; message: ChatMessage };

/** Scrolled further than this from the newest message, offer a jump back down. */
const JUMP_THRESHOLD = 480;

/** The composer's input: one line at rest, growing to about five as you type. */
const INPUT_MIN_HEIGHT = 40;
const INPUT_MAX_HEIGHT = 120;

/**
 * Unsent drafts, per thread, for the life of the app — leaving a thread to
 * check a profile and coming back shouldn't cost you what you were typing.
 */
const drafts = new Map<string, string>();

/**
 * One conversation — `GET /conversations/{id}`, ported from the right-hand
 * pane of the web's `/user/messages`.
 *
 * - **Instant and offline.** The thread renders from the persisted cache first
 *   and re-reads in the background; a thread opened from the list has its
 *   header before its first read lands. Sending never waits: a message joins
 *   the outbox and shows at once, with a clock until the server has it.
 * - **Live while open.** The newest page is re-read every few seconds while
 *   this screen is focused (there's no socket), and any new incoming message
 *   is marked read as it arrives, because you are looking at it.
 * - **History on demand.** Scrolling up pages back with `before_id`.
 *
 * It lives on the root stack, not in `(tabs)`, so it covers the tab bar the
 * way every other pushed screen does.
 */
export default function ConversationScreen() {
  const { colors, brand, radius, spacing } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const offline = useIsOffline();
  const showToast = useFeedbackStore((s) => s.showToast);

  // The bottom-anchored composer drops its safe-area inset once the keyboard
  // covers that strip — see src/hooks/useKeyboard.ts.
  const composerInset = useComposerInset(insets.bottom);

  // Poll only while this screen is actually in front.
  const [focused, setFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  const thread = useThread(id, { live: focused });
  const { loadOlder, loading: loadingOlder } = useLoadOlderMessages(id);
  const markRead = useMarkConversationRead();
  const send = useSendMessage();

  const conversation = thread.data?.conversation ?? (id ? findCachedConversation(queryClient, id) : undefined);

  const outboxItems = useOutboxStore((s) => s.items);
  const retryItem = useOutboxStore((s) => s.retry);
  const removeItem = useOutboxStore((s) => s.remove);
  const serverMessages = thread.data?.messages;
  const messages = useMemo(
    () =>
      withOutbox(
        serverMessages ?? [],
        outboxItems.filter((item) => item.conversationId === id),
      ),
    [id, outboxItems, serverMessages],
  );

  // Mark read whenever a new incoming message is on screen — on open, and as
  // the poll brings more in. Keyed on the newest incoming id so a poll that
  // finds nothing new doesn't re-send it.
  const newestIncoming = useMemo(() => {
    for (let i = (serverMessages?.length ?? 0) - 1; i >= 0; i--) {
      if (!serverMessages![i]!.mine) return serverMessages![i]!.id;
    }
    return null;
  }, [serverMessages]);
  const markedFor = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (!id || !focused || !thread.data) return;
    const unread = findCachedConversation(queryClient, id)?.unread ?? 0;
    if (markedFor.current === newestIncoming && unread === 0) return;
    markedFor.current = newestIncoming;
    if (newestIncoming || unread > 0) markRead.mutate(id);
    // `markRead` is left out on purpose: its identity changes with its state,
    // and re-running on that would mark read in a loop.
  }, [id, focused, thread.data, newestIncoming, queryClient]);

  /**
   * The thread, newest first — the list is **inverted**, so index 0 renders at
   * the bottom of the screen and new messages appear without any scrolling.
   * Day dividers are built in reading order (in the device's timezone — the
   * server's own dividers are in UTC and are dropped) and reversed with
   * everything else, which puts each back above its own day once flipped.
   */
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    let lastDay = '';
    for (const message of messages) {
      const label = dayLabel(message.sentAt);
      if (label !== lastDay) {
        out.push({ kind: 'day', id: `day-${label}-${message.id}`, label });
        lastDay = label;
      }
      out.push({ kind: 'message', id: message.id, message });
    }
    return out.reverse();
  }, [messages]);

  // --- Composer ------------------------------------------------------------

  const [draft, setDraftState] = useState(() => (id ? (drafts.get(id) ?? '') : ''));
  const setDraft = (text: string) => {
    setDraftState(text);
    if (id) drafts.set(id, text);
  };
  const [attachments, setAttachments] = useState<UploadFile[]>([]);
  // The input's height is driven from its content rather than left to the
  // native view: a multiline input on iOS grows as you type but doesn't shrink
  // back when its value is cleared, which left a two-line-tall empty box
  // after every long message sent.
  const [inputHeight, setInputHeight] = useState(INPUT_MIN_HEIGHT);
  const listRef = useRef<FlatList<Row>>(null);
  const [showJump, setShowJump] = useState(false);

  const canSend = !!conversation && (draft.trim().length > 0 || attachments.length > 0);

  const onSend = (bodyOverride?: string) => {
    if (!id) return;
    const body = bodyOverride ?? draft;
    if (!body.trim() && attachments.length === 0) return;
    send(id, body, bodyOverride ? [] : attachments);
    if (!bodyOverride) {
      setDraft('');
      setAttachments([]);
      setInputHeight(INPUT_MIN_HEIGHT);
    }
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  const pickImages = async () => {
    const remaining = MAX_MESSAGE_IMAGES - attachments.length;
    if (remaining <= 0) {
      showToast(`Up to ${MAX_MESSAGE_IMAGES} photos per message.`, 'info');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      orderedSelection: true,
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.length) return;
    const picked = result.assets.slice(0, remaining).map<UploadFile>((asset, index) => ({
      uri: asset.uri,
      name: asset.fileName ?? `photo-${Date.now()}-${index}.jpg`,
      type: asset.mimeType ?? 'image/jpeg',
    }));
    setAttachments((current) => [...current, ...picked].slice(0, MAX_MESSAGE_IMAGES));
  };

  // --- Bubble actions --------------------------------------------------------

  const [viewer, setViewer] = useState<{ media: MediaItem[]; index: number } | null>(null);

  const openImages = (message: ChatMessage, index: number) =>
    setViewer({
      media: message.images.map((uri, i) => ({ id: `${message.id}-${i}`, type: 'image', uri })),
      index,
    });

  const onFailedPress = (message: ChatMessage) =>
    Alert.alert('Message not sent', message.error ?? 'It didn’t reach Payhankey.', [
      { text: 'Retry', onPress: () => retryItem(message.id) },
      { text: 'Delete message', style: 'destructive', onPress: () => removeItem(message.id) },
      { text: 'Cancel', style: 'cancel' },
    ]);

  const onLongPress = (message: ChatMessage) => {
    if (!message.body) return;
    void Clipboard.setStringAsync(message.body).then(() => showToast('Message copied.', 'success'));
  };

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    // Inverted: offset 0 is the newest message.
    const away = event.nativeEvent.contentOffset.y > JUMP_THRESHOLD;
    if (away !== showJump) setShowJump(away);
  };

  // --- States ---------------------------------------------------------------

  // 403 is a block (either way round), 404 a thread that's gone — a cached
  // copy of either shouldn't keep rendering as if it were still open.
  const unavailable =
    thread.error instanceof ApiError &&
    (thread.error.status === 403 || thread.error.status === 404);

  if (!conversation || unavailable) {
    return (
      <View style={[styles.root, styles.missing, { backgroundColor: colors.background }]}>
        <ScreenBackground />
        {thread.isLoading && !unavailable ? (
          <ActivityIndicator color={colors.brand} />
        ) : (
          <>
            <Ionicons name="chatbubble-ellipses-outline" size={30} color={colors.textMuted} />
            <Text style={[styles.missingText, { color: colors.textMuted }]}>
              {unavailable
                ? 'This conversation isn’t available any more.'
                : offline
                  ? 'You’re offline, and this conversation isn’t saved on this device yet.'
                  : 'We couldn’t load this conversation.'}
            </Text>
            {!unavailable && !offline ? (
              <Pressable
                onPress={() => void thread.refetch()}
                accessibilityRole="button"
                style={[styles.missingBtn, { backgroundColor: colors.brand, borderRadius: radius.pill }]}
              >
                <Text style={[styles.missingBtnText, { color: colors.onBrand }]}>Try again</Text>
              </Pressable>
            ) : null}
            <Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={8}>
              <Text style={[styles.backLink, { color: colors.brand }]}>Back</Text>
            </Pressable>
          </>
        )}
      </View>
    );
  }

  const { member } = conversation;
  const firstLoad = !thread.data && thread.isLoading;

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
            onPress={() =>
              router.push({ pathname: '/member/[handle]', params: { handle: member.handle } })
            }
            accessibilityRole="button"
            accessibilityLabel={`View ${member.name}'s profile`}
            style={styles.headerIdentity}
          >
            <Avatar userId={member.id} level={member.level} name={member.name} tint={member.tint} uri={member.avatar} size={40} />
            <View style={styles.headerText}>
              <NameWithBadge
                style={[styles.headerName, { color: colors.text }]}
                name={member.name}
                userId={member.id}
                level={member.level}
                size={14}
              />
              <View style={styles.headerSubRow}>
                {conversation.muted ? (
                  <Ionicons name="notifications-off" size={12} color={colors.textMuted} />
                ) : null}
                <Text
                  style={[styles.headerSub, { color: colors.textMuted }]}
                  numberOfLines={1}
                >
                  @{member.handle}
                  {conversation.muted ? ' · Muted' : ''}
                </Text>
              </View>
            </View>
          </Pressable>
          <ConversationMenu conversation={conversation} onBlocked={() => router.back()} />
        </View>

        <View style={styles.root}>
          {firstLoad ? (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.brand} />
            </View>
          ) : (
            <FlatList
              ref={listRef}
              data={rows}
              // Only when there is something to invert: an inverted list renders
              // its empty component upside down.
              inverted={rows.length > 0}
              keyExtractor={(row) => row.id}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              showsVerticalScrollIndicator={false}
              onScroll={onScroll}
              scrollEventThrottle={64}
              // The end of an inverted list is the top of the thread.
              onEndReached={() => void loadOlder()}
              onEndReachedThreshold={0.4}
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
                  <MessageBubble
                    message={item.message}
                    onPressImage={(index) => openImages(item.message, index)}
                    onPressFailed={() => onFailedPress(item.message)}
                    onLongPress={() => onLongPress(item.message)}
                  />
                )
              }
              ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
              // Inverted, so the "footer" sits at the top of the thread.
              ListFooterComponent={
                rows.length ? (
                  loadingOlder ? (
                    <ActivityIndicator color={colors.brand} style={styles.olderSpinner} />
                  ) : thread.data && !thread.data.hasOlder ? (
                    <Text style={[styles.threadStart, { color: colors.textMuted }]}>
                      This is the start of your conversation with {member.name}.
                    </Text>
                  ) : null
                ) : null
              }
              ListEmptyComponent={
                <View style={styles.emptyThread}>
                  <Avatar userId={member.id} level={member.level} name={member.name} tint={member.tint} uri={member.avatar} size={72} />
                  <Text style={[styles.emptyTitle, { color: colors.text }]}>{member.name}{' '}<LevelBadge userId={member.id} level={member.level} size={18} /></Text>
                  <Text style={[styles.emptyHandle, { color: colors.textMuted }]}>
                    @{member.handle}
                  </Text>
                  <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                    No messages yet. Break the ice —
                  </Text>
                  <Pressable
                    onPress={() => onSend('👋')}
                    accessibilityRole="button"
                    accessibilityLabel={`Wave at ${member.name}`}
                    style={({ pressed }) => [
                      styles.wave,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                  >
                    <Text style={styles.waveEmoji}>👋</Text>
                    <Text style={[styles.waveText, { color: colors.text }]}>Say hi</Text>
                  </Pressable>
                </View>
              }
            />
          )}

          {showJump ? (
            <Pressable
              onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })}
              accessibilityRole="button"
              accessibilityLabel="Jump to newest message"
              style={[
                styles.jump,
                { backgroundColor: colors.surface, borderColor: colors.border, shadowColor: '#000' },
              ]}
            >
              <Ionicons name="chevron-down" size={20} color={colors.text} />
            </Pressable>
          ) : null}
        </View>

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
          {offline ? (
            <View style={styles.offlineHint}>
              <Ionicons name="cloud-offline-outline" size={14} color={colors.textMuted} />
              <Text style={[styles.offlineText, { color: colors.textMuted }]}>
                You’re offline — messages will send when you reconnect.
              </Text>
            </View>
          ) : null}

          {attachments.length ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.attachments}
              keyboardShouldPersistTaps="handled"
            >
              {attachments.map((file, index) => (
                <View
                  key={`${file.uri}-${index}`}
                  style={[styles.attachment, { borderColor: colors.border, borderRadius: radius.md }]}
                >
                  <Image source={{ uri: file.uri }} style={styles.attachmentImage} contentFit="cover" />
                  <Pressable
                    onPress={() => setAttachments((current) => current.filter((_, i) => i !== index))}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove photo ${index + 1}`}
                    style={[styles.attachmentRemove, { backgroundColor: colors.overlay }]}
                  >
                    <Ionicons name="close" size={14} color="#FFFFFF" />
                  </Pressable>
                </View>
              ))}
              {attachments.length < MAX_MESSAGE_IMAGES ? (
                <Pressable
                  onPress={() => void pickImages()}
                  accessibilityRole="button"
                  accessibilityLabel="Add another photo"
                  style={[
                    styles.attachment,
                    styles.addTile,
                    { borderColor: colors.border, borderRadius: radius.md },
                  ]}
                >
                  <Ionicons name="add" size={22} color={colors.textMuted} />
                </Pressable>
              ) : null}
            </ScrollView>
          ) : null}

          <View style={styles.composerRow}>
            <Pressable
              onPress={() => void pickImages()}
              accessibilityRole="button"
              accessibilityLabel="Attach photos"
              style={[styles.attachButton, { backgroundColor: colors.surfaceAlt }]}
            >
              <Ionicons name="image-outline" size={20} color={colors.brand} />
            </Pressable>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder={`Message ${member.name.split(' ')[0]}…`}
              placeholderTextColor={colors.textMuted}
              selectionColor={colors.brand}
              maxLength={MAX_MESSAGE_LENGTH}
              multiline
              onContentSizeChange={(event) =>
                setInputHeight(
                  Math.min(
                    INPUT_MAX_HEIGHT,
                    // The reported size already includes the input's own padding.
                    Math.max(INPUT_MIN_HEIGHT, Math.ceil(event.nativeEvent.contentSize.height)),
                  ),
                )
              }
              style={[
                styles.input,
                {
                  height: inputHeight,
                  backgroundColor: colors.surfaceAlt,
                  borderColor: colors.border,
                  color: colors.text,
                  borderRadius: radius.lg,
                },
              ]}
            />
            <Pressable
              onPress={() => onSend()}
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
          {draft.length > MAX_MESSAGE_LENGTH - 200 ? (
            <Text style={[styles.counter, { color: colors.textMuted }]}>
              {MAX_MESSAGE_LENGTH - draft.length} characters left
            </Text>
          ) : null}
        </View>
      </KeyboardAvoidingView>

      {viewer ? (
        <MediaViewer
          media={viewer.media}
          initialIndex={viewer.index}
          visible
          onClose={() => setViewer(null)}
        />
      ) : null}
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
  headerSubRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerSub: { fontFamily: FONT, fontSize: 12, fontWeight: '600', flexShrink: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
  olderSpinner: { paddingVertical: 12 },
  threadStart: {
    fontFamily: FONT,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  emptyThread: { alignItems: 'center', gap: 4, paddingVertical: 40 },
  emptyTitle: { fontFamily: FONT, fontSize: 17, fontWeight: '800', marginTop: 8 },
  emptyHandle: { fontFamily: FONT, fontSize: 13, fontWeight: '600' },
  emptyText: { fontFamily: FONT, fontSize: 13, fontWeight: '500', marginTop: 12 },
  wave: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    paddingHorizontal: 18,
    height: 44,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
  },
  waveEmoji: { fontSize: 20 },
  waveText: { fontFamily: FONT, fontSize: 14, fontWeight: '800' },
  jump: {
    position: 'absolute',
    right: 16,
    bottom: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  composerWrap: {
    paddingHorizontal: 12,
    paddingTop: 10,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  offlineHint: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4 },
  offlineText: { fontFamily: FONT, fontSize: 12, fontWeight: '600', flexShrink: 1 },
  attachments: { gap: 8 },
  attachment: {
    width: 64,
    height: 64,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  addTile: { alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed' },
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
  counter: { fontFamily: FONT, fontSize: 11, fontWeight: '600', textAlign: 'right' },
  missing: { alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  missingText: { fontFamily: FONT, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  missingBtn: { paddingHorizontal: 20, height: 46, alignItems: 'center', justifyContent: 'center' },
  missingBtnText: { fontFamily: FONT, fontSize: 14, fontWeight: '800' },
  backLink: { fontFamily: FONT, fontSize: 14, fontWeight: '700' },
});
