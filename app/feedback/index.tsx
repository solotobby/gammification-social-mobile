import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ApiError } from '../../src/api/client';
import {
  FEEDBACK_MESSAGE_MAX,
  FEEDBACK_MESSAGE_MIN,
  FEEDBACK_SUBJECT_MAX,
  FEEDBACK_SUBJECT_MIN,
  type FeedbackType,
} from '../../src/api/feedback';
import { BackButton } from '../../src/components/ui/BackButton';
import { FieldLabel } from '../../src/components/ui/FieldLabel';
import { GradientButton } from '../../src/components/ui/GradientButton';
import { KeyboardAwareScreen } from '../../src/components/ui/KeyboardAwareScreen';
import { TextField } from '../../src/components/ui/TextField';
import { useFeedbackTickets, useFeedbackTypes, useSubmitFeedback } from '../../src/hooks/useFeedback';
import { useFeedbackStore } from '../../src/stores/feedbackStore';
import { useTheme } from '../../src/theme/ThemeProvider';
import { FONT } from '../../src/theme/fonts';

/** An icon per known type; anything new the backend adds gets the generic one. */
const TYPE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  complaint: 'alert-circle-outline',
  suggestion: 'bulb-outline',
  improvement: 'trending-up-outline',
  bug: 'bug-outline',
  other: 'ellipsis-horizontal-circle-outline',
};

/**
 * Send feedback — the web's Settings → "Send feedback", reached from the side
 * drawer. Opens a support ticket (`POST /feedback`) the Payhankey team answers
 * in a conversation, which is where sending lands you (`/feedback/[id]`).
 * Earlier tickets are one tap away in the header (`/feedback/tickets`).
 *
 * The types come from `GET /feedback/types` (five, "Other" included), as tiles
 * rather than the web's dropdown: one tap beats open-sheet-pick-close. The
 * length rules are the server's (subject 4–120, details 10–5000) and are
 * checked here first, so the common mistakes never cost a round trip; anything
 * the server still refuses is shown on its own field.
 */
export default function FeedbackScreen() {
  const { colors, radius, spacing } = useTheme();
  const router = useRouter();
  const types = useFeedbackTypes();
  const submit = useSubmitFeedback();
  const tickets = useFeedbackTickets();
  const showToast = useFeedbackStore((s) => s.showToast);
  const showApiError = useFeedbackStore((s) => s.showApiError);

  // Suggestion is the web form's default too.
  const [type, setType] = useState<FeedbackType>('suggestion');
  const [subject, setSubject] = useState('');
  const [details, setDetails] = useState('');
  const [attempted, setAttempted] = useState(false);
  const [serverErrors, setServerErrors] = useState<Record<string, string[]>>({});
  const detailsRef = useRef<TextInput>(null);

  const ticketCount = tickets.data?.pages[0]?.total ?? 0;
  const subjectError =
    serverErrors.subject?.[0] ??
    (!attempted
      ? null
      : !subject.trim()
        ? 'Add a short summary.'
        : subject.trim().length < FEEDBACK_SUBJECT_MIN
          ? `Use at least ${FEEDBACK_SUBJECT_MIN} characters.`
          : null);
  const detailsError =
    serverErrors.message?.[0] ??
    (!attempted
      ? null
      : !details.trim()
        ? 'Tell us a little more so the team can act on it.'
        : details.trim().length < FEEDBACK_MESSAGE_MIN
          ? `Use at least ${FEEDBACK_MESSAGE_MIN} characters.`
          : null);
  const typeError = serverErrors.type?.[0] ?? null;

  const send = () => {
    setAttempted(true);
    setServerErrors({});
    const s = subject.trim();
    const d = details.trim();
    if (s.length < FEEDBACK_SUBJECT_MIN || d.length < FEEDBACK_MESSAGE_MIN || submit.isPending) return;
    submit.mutate(
      { type, subject: s, message: d },
      {
        onSuccess: (ticket) => {
          showToast('Feedback sent — the team will reply here.', 'success');
          router.replace({ pathname: '/feedback/[id]', params: { id: ticket.id } });
        },
        onError: (error) => {
          if (error instanceof ApiError && error.fieldErrors) setServerErrors(error.fieldErrors);
          else showApiError(error, 'Couldn’t send your feedback.');
        },
      },
    );
  };

  /** Editing a field clears the server's complaint about it. */
  const edited = <T,>(setter: (value: T) => void, field: string) => (value: T) => {
    if (serverErrors[field]) setServerErrors((current) => ({ ...current, [field]: [] }));
    setter(value);
  };

  return (
    <KeyboardAwareScreen>
      <View style={styles.headerRow}>
        <BackButton onPress={() => router.back()} />
        <Text style={[styles.headerTitle, { color: colors.text }]}>Send feedback</Text>
        <View style={{ width: 44 }} />
      </View>

      <Text style={[styles.lede, { color: colors.textSecondary }]}>
        Share a complaint, suggestion, improvement idea or bug with the Payhankey team. They’ll
        reply right here in the app.
      </Text>

      {ticketCount > 0 ? (
        <Pressable
          onPress={() => router.push('/feedback/tickets')}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.ticketsLink,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: radius.md,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <View style={[styles.ticketsIcon, { backgroundColor: `${colors.brand}14` }]}>
            <Ionicons name="chatbubbles" size={18} color={colors.brand} />
          </View>
          <View style={styles.ticketsText}>
            <Text style={[styles.ticketsTitle, { color: colors.text }]}>Your feedback</Text>
            <Text style={[styles.ticketsSub, { color: colors.textMuted }]}>
              {ticketCount} ticket{ticketCount === 1 ? '' : 's'} · see replies from the team
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>
      ) : null}

      <View style={[styles.form, { gap: spacing.lg }]}>
        <View style={styles.field}>
          <FieldLabel>Type</FieldLabel>
          <View style={styles.typeGrid} accessibilityRole="radiogroup">
            {types.map((option) => {
              const active = option.key === type;
              return (
                <Pressable
                  key={option.key}
                  onPress={() => edited(setType, 'type')(option.key)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                  accessibilityLabel={option.label}
                  style={({ pressed }) => [
                    styles.typeTile,
                    {
                      backgroundColor: active ? `${colors.brand}14` : colors.surface,
                      borderColor: active ? colors.brand : colors.border,
                      borderRadius: radius.md,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <Ionicons
                    name={TYPE_ICONS[option.key] ?? 'chatbubble-ellipses-outline'}
                    size={18}
                    color={active ? colors.brand : colors.textMuted}
                  />
                  <Text
                    style={[styles.typeLabel, { color: active ? colors.brand : colors.textSecondary }]}
                    numberOfLines={1}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {typeError ? <Text style={[styles.hint, { color: colors.danger }]}>{typeError}</Text> : null}
        </View>

        <View style={styles.field}>
          <FieldLabel>Subject</FieldLabel>
          <TextField
            icon="text-outline"
            placeholder="Short summary"
            value={subject}
            onChangeText={edited(setSubject, 'subject')}
            maxLength={FEEDBACK_SUBJECT_MAX}
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => detailsRef.current?.focus()}
          />
          {subjectError ? (
            <Text style={[styles.hint, { color: colors.danger }]}>{subjectError}</Text>
          ) : null}
        </View>

        <View style={styles.field}>
          <View style={styles.labelRow}>
            <FieldLabel>Details</FieldLabel>
            <Text style={[styles.hint, { color: colors.textMuted }]}>
              {details.length}/{FEEDBACK_MESSAGE_MAX}
            </Text>
          </View>
          <TextField
            ref={detailsRef}
            placeholder="Tell us what happened or what you'd like improved…"
            value={details}
            onChangeText={edited(setDetails, 'message')}
            maxLength={FEEDBACK_MESSAGE_MAX}
            multiline
            style={styles.detailsInput}
          />
          {detailsError ? (
            <Text style={[styles.hint, { color: colors.danger }]}>{detailsError}</Text>
          ) : null}
        </View>
      </View>

      <GradientButton
        label="Send feedback"
        icon="paper-plane-outline"
        loading={submit.isPending}
        onPress={send}
      />
    </KeyboardAwareScreen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  headerTitle: { fontFamily: FONT, fontSize: 18, fontWeight: '800' },
  lede: {
    fontFamily: FONT,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '500',
    marginBottom: 20,
  },
  ticketsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 24,
  },
  ticketsIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  ticketsText: { flex: 1, gap: 2 },
  ticketsTitle: { fontFamily: FONT, fontSize: 15, fontWeight: '800' },
  ticketsSub: { fontFamily: FONT, fontSize: 12, fontWeight: '600' },
  form: { marginBottom: 24 },
  field: { gap: 8 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  typeTile: {
    // Two per row: (100% - one 10pt gap) / 2. An odd last one spans the row.
    flexBasis: '47%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 52,
    paddingHorizontal: 14,
    borderWidth: 1.5,
  },
  typeLabel: { fontFamily: FONT, fontSize: 15, fontWeight: '700', flexShrink: 1 },
  detailsInput: { minHeight: 140 },
  hint: { fontFamily: FONT, fontSize: 12, fontWeight: '600' },
});
