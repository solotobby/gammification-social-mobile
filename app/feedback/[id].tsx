import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError } from '../../src/api/client';
import {
  FEEDBACK_REPLY_MAX,
  FEEDBACK_REPLY_MIN,
  type FeedbackMessage,
} from '../../src/api/feedback';
import { clockTime, dayLabel } from '../../src/components/messages/time';
import { TicketStatusPill } from '../../src/components/support/TicketStatusPill';
import { BackButton } from '../../src/components/ui/BackButton';
import { ScreenBackground } from '../../src/components/ui/ScreenBackground';
import { useFeedbackTicket, useReplyToFeedback } from '../../src/hooks/useFeedback';
import { useComposerInset } from '../../src/hooks/useKeyboard';
import { useTheme } from '../../src/theme/ThemeProvider';
import { brand } from '../../src/theme/colors';
import { FONT } from '../../src/theme/fonts';

/**
 * One feedback ticket — `GET /feedback/{id}` — as a conversation with the
 * Payhankey team: your messages on the right in the brand gradient (like a
 * DM), the team's on the left, labelled. An `admin_note` from the team sits
 * above the thread. While the ticket `is_open` you can reply at the bottom
 * (`POST /feedback/{id}/messages`, 2–5000 chars); a closed one says so and
 * offers new feedback instead.
 *
 * There's no realtime event for staff replies (none fired while probing), so
 * an open ticket re-reads every 30s while it's on screen.
 */
export default function FeedbackTicketScreen() {
  const { colors, radius, spacing } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const composerInset = useComposerInset(insets.bottom);

  const [focused, setFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  const ticket = useFeedbackTicket(id, { live: focused });
  const reply = useReplyToFeedback(id ?? '');
  const [draft, setDraft] = useState('');
  const listRef = useRef<FlatList<FeedbackMessage>>(null);

  const messages = ticket.data?.messages ?? [];
  // Newest at the bottom: follow the thread down whenever it grows.
  useEffect(() => {
    if (!messages.length) return;
    const t = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(t);
  }, [messages.length]);

  const canSend = draft.trim().length >= FEEDBACK_REPLY_MIN && !reply.isPending;
  const send = () => {
    if (!canSend) return;
    reply.mutate(draft.trim(), { onSuccess: () => setDraft('') });
  };

  const missing = ticket.error instanceof ApiError && ticket.error.status === 404;

  if (!ticket.data) {
    return (
      <View style={[styles.root, styles.center, { backgroundColor: colors.background }]}>
        <ScreenBackground />
        {ticket.isLoading ? (
          <ActivityIndicator color={colors.brand} />
        ) : (
          <>
            <Ionicons name="chatbubbles-outline" size={30} color={colors.textMuted} />
            <Text style={[styles.centerText, { color: colors.textMuted }]}>
              {missing ? 'This ticket isn’t available.' : 'We couldn’t load this ticket.'}
            </Text>
            {!missing ? (
              <Pressable onPress={() => void ticket.refetch()} accessibilityRole="button" hitSlop={8}>
                <Text style={[styles.link, { color: colors.brand }]}>Try again</Text>
              </Pressable>
            ) : null}
            <Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={8}>
              <Text style={[styles.link, { color: colors.brand }]}>Back</Text>
            </Pressable>
          </>
        )}
      </View>
    );
  }

  const t = ticket.data;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScreenBackground />
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View
          style={[
            styles.header,
            { paddingTop: insets.top + spacing.sm, backgroundColor: colors.surface, borderBottomColor: colors.border },
          ]}
        >
          <BackButton onPress={() => router.back()} />
          <View style={styles.headerText}>
            <Text style={[styles.subject, { color: colors.text }]} numberOfLines={2}>
              {t.subject}
            </Text>
            <View style={styles.headerMeta}>
              <TicketStatusPill status={t.status} label={t.status_label} />
              <Text style={[styles.metaText, { color: colors.textMuted }]}>{t.type_label}</Text>
            </View>
          </View>
        </View>

        <FlatList
          ref={listRef}
          style={styles.root}
          data={messages}
          keyExtractor={(m) => m.id}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          contentContainerStyle={{ padding: spacing.lg, gap: 10 }}
          ListHeaderComponent={
            t.admin_note ? (
              <View
                style={[
                  styles.note,
                  { backgroundColor: colors.surface, borderColor: `${colors.brand}55`, borderRadius: radius.md },
                ]}
              >
                <Ionicons name="information-circle" size={18} color={colors.brand} />
                <View style={styles.noteText}>
                  <Text style={[styles.noteTitle, { color: colors.text }]}>Note from the team</Text>
                  <Text style={[styles.noteBody, { color: colors.textSecondary }]}>{t.admin_note}</Text>
                </View>
              </View>
            ) : null
          }
          renderItem={({ item, index }) => {
            const previous = messages[index - 1];
            const day = dayLabel(Date.parse(item.created_at));
            const showDay = !previous || dayLabel(Date.parse(previous.created_at)) !== day;
            return (
              <>
                {showDay ? (
                  <Text
                    style={[
                      styles.day,
                      { color: colors.textMuted, backgroundColor: colors.surface, borderColor: colors.border },
                    ]}
                  >
                    {day}
                  </Text>
                ) : null}
                <TicketMessage message={item} />
              </>
            );
          }}
          ListFooterComponent={
            !t.is_open ? (
              <View style={styles.closed}>
                <Text style={[styles.closedText, { color: colors.textMuted }]}>
                  This ticket is {t.status_label.toLowerCase() || 'closed'} and no longer takes replies.
                </Text>
                <Pressable onPress={() => router.replace('/feedback')} accessibilityRole="button" hitSlop={8}>
                  <Text style={[styles.link, { color: colors.brand }]}>Send new feedback</Text>
                </Pressable>
              </View>
            ) : t.last_message_by === 'user' && messages.length > 0 ? (
              <Text style={[styles.waiting, { color: colors.textMuted }]}>
                Sent to the Payhankey team — they’ll reply here.
              </Text>
            ) : null
          }
        />

        {t.is_open ? (
          <View
            style={[
              styles.composer,
              { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: composerInset + 10 },
            ]}
          >
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Reply to the team…"
              placeholderTextColor={colors.textMuted}
              selectionColor={colors.brand}
              maxLength={FEEDBACK_REPLY_MAX}
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
              onPress={send}
              disabled={!canSend}
              accessibilityRole="button"
              accessibilityLabel="Send reply"
              style={[styles.sendButton, { backgroundColor: canSend ? brand.violet : colors.surfaceAlt }]}
            >
              {reply.isPending ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Ionicons name="send" size={18} color={canSend ? '#FFFFFF' : colors.textMuted} />
              )}
            </Pressable>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </View>
  );
}

function TicketMessage({ message }: { message: FeedbackMessage }) {
  const { colors } = useTheme();
  const staff = message.is_staff;
  const time = clockTime(Date.parse(message.created_at));
  if (staff) {
    return (
      <View style={[styles.row, { alignItems: 'flex-start' }]}>
        <View style={styles.staffLabel}>
          <Ionicons name="shield-checkmark" size={12} color={colors.brand} />
          <Text style={[styles.staffName, { color: colors.brand }]}>
            {message.sender?.name?.trim() ? `${message.sender.name.trim()} · Payhankey` : 'Payhankey team'}
          </Text>
        </View>
        <View
          style={[styles.bubble, styles.theirs, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Text style={[styles.body, { color: colors.text }]}>{message.body}</Text>
          <Text style={[styles.time, { color: colors.textMuted }]}>{time}</Text>
        </View>
      </View>
    );
  }
  return (
    <View style={[styles.row, { alignItems: 'flex-end' }]}>
      <LinearGradient
        colors={[brand.violetBright, brand.violet]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.bubble, styles.mine]}
      >
        <Text style={[styles.body, { color: '#FFFFFF' }]}>{message.body}</Text>
        <Text style={[styles.time, { color: 'rgba(255,255,255,0.78)' }]}>{time}</Text>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  centerText: { fontFamily: FONT, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  link: { fontFamily: FONT, fontSize: 14, fontWeight: '800' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerText: { flex: 1, gap: 4 },
  subject: { fontFamily: FONT, fontSize: 15, fontWeight: '800' },
  headerMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaText: { fontFamily: FONT, fontSize: 12, fontWeight: '600' },
  note: { flexDirection: 'row', gap: 10, padding: 12, borderWidth: 1, marginBottom: 6 },
  noteText: { flex: 1, gap: 2 },
  noteTitle: { fontFamily: FONT, fontSize: 13, fontWeight: '800' },
  noteBody: { fontFamily: FONT, fontSize: 13, lineHeight: 19, fontWeight: '500' },
  day: {
    alignSelf: 'center',
    fontFamily: FONT,
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    marginVertical: 4,
  },
  row: { width: '100%', gap: 4 },
  staffLabel: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 4 },
  staffName: { fontFamily: FONT, fontSize: 11, fontWeight: '800' },
  bubble: { maxWidth: '82%', paddingHorizontal: 13, paddingVertical: 9, gap: 4 },
  mine: { borderRadius: 20, borderBottomRightRadius: 6 },
  theirs: { borderRadius: 20, borderBottomLeftRadius: 6, borderWidth: StyleSheet.hairlineWidth },
  body: { fontFamily: FONT, fontSize: 15, lineHeight: 21, fontWeight: '500' },
  time: { fontFamily: FONT, fontSize: 10, fontWeight: '700', alignSelf: 'flex-end' },
  closed: { alignItems: 'center', gap: 8, paddingVertical: 16 },
  closedText: { fontFamily: FONT, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  waiting: { fontFamily: FONT, fontSize: 12, fontWeight: '600', textAlign: 'center', paddingVertical: 8 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
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
  sendButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
