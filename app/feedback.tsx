import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { FeedbackType } from '../src/api/feedback';
import { BackButton } from '../src/components/ui/BackButton';
import { FieldLabel } from '../src/components/ui/FieldLabel';
import { GradientButton } from '../src/components/ui/GradientButton';
import { KeyboardAwareScreen } from '../src/components/ui/KeyboardAwareScreen';
import { TextField } from '../src/components/ui/TextField';
import { useSubmitFeedback } from '../src/hooks/useFeedback';
import { useTheme } from '../src/theme/ThemeProvider';
import { FONT } from '../src/theme/fonts';

/**
 * The web form's four types, as tiles rather than its dropdown: four options
 * fit on screen at once, and one tap beats open-sheet-pick-close.
 */
const TYPES: { value: FeedbackType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'complaint', label: 'Complaint', icon: 'alert-circle-outline' },
  { value: 'suggestion', label: 'Suggestion', icon: 'bulb-outline' },
  { value: 'improvement', label: 'Improvement', icon: 'trending-up-outline' },
  { value: 'bug', label: 'Bug', icon: 'bug-outline' },
];

/** No backend limits exist yet; these keep a subject a summary and a report readable. */
const SUBJECT_MAX = 120;
const DETAILS_MAX = 2000;

/**
 * Send feedback — the web's Settings → "Send feedback", reached from the side
 * drawer. Same fields as the web: type, subject, details, all required.
 *
 * **Sending is a placeholder** (src/api/feedback.ts): it answers "coming soon"
 * and the form keeps everything that was typed, so nobody loses a long bug
 * report to a feature that isn't live yet.
 */
export default function FeedbackScreen() {
  const { colors, radius, spacing } = useTheme();
  const router = useRouter();
  const submit = useSubmitFeedback();

  // Suggestion is the web form's default too.
  const [type, setType] = useState<FeedbackType>('suggestion');
  const [subject, setSubject] = useState('');
  const [details, setDetails] = useState('');
  const [attempted, setAttempted] = useState(false);
  const detailsRef = useRef<TextInput>(null);

  const subjectMissing = !subject.trim();
  const detailsMissing = !details.trim();
  const result = submit.data;

  const send = () => {
    setAttempted(true);
    if (subjectMissing || detailsMissing || submit.isPending) return;
    submit.mutate({ type, subject: subject.trim(), details: details.trim() });
  };

  /** Any edit after an answer clears it — the notice is about what was sent. */
  const edited = <T,>(setter: (value: T) => void) => (value: T) => {
    if (submit.data) submit.reset();
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
        Share a complaint, suggestion, improvement idea or bug with the Payhankey team.
      </Text>

      <View style={[styles.form, { gap: spacing.lg }]}>
        <View style={styles.field}>
          <FieldLabel>Type</FieldLabel>
          <View style={styles.typeGrid} accessibilityRole="radiogroup">
            {TYPES.map((option) => {
              const active = option.value === type;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => edited(setType)(option.value)}
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
                    name={option.icon}
                    size={18}
                    color={active ? colors.brand : colors.textMuted}
                  />
                  <Text
                    style={[
                      styles.typeLabel,
                      { color: active ? colors.brand : colors.textSecondary },
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.field}>
          <FieldLabel>Subject</FieldLabel>
          <TextField
            icon="text-outline"
            placeholder="Short summary"
            value={subject}
            onChangeText={edited(setSubject)}
            maxLength={SUBJECT_MAX}
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => detailsRef.current?.focus()}
          />
          {attempted && subjectMissing ? (
            <Text style={[styles.hint, { color: colors.danger }]}>Add a short summary.</Text>
          ) : null}
        </View>

        <View style={styles.field}>
          <View style={styles.labelRow}>
            <FieldLabel>Details</FieldLabel>
            <Text style={[styles.hint, { color: colors.textMuted }]}>
              {details.length}/{DETAILS_MAX}
            </Text>
          </View>
          <TextField
            ref={detailsRef}
            placeholder="Tell us what happened or what you'd like improved…"
            value={details}
            onChangeText={edited(setDetails)}
            maxLength={DETAILS_MAX}
            multiline
            style={styles.detailsInput}
          />
          {attempted && detailsMissing ? (
            <Text style={[styles.hint, { color: colors.danger }]}>
              Tell us a little more so the team can act on it.
            </Text>
          ) : null}
        </View>
      </View>

      {result ? (
        <View
          accessibilityLiveRegion="polite"
          style={[
            styles.notice,
            {
              // Solid, not a translucent gold wash: ScreenBackground's glow
              // shows through a tint and turns it muddy.
              backgroundColor: colors.surface,
              borderColor: `${colors.gold}80`,
              borderRadius: radius.md,
            },
          ]}
        >
          <Ionicons name="time-outline" size={20} color={colors.gold} />
          <View style={styles.noticeText}>
            <Text style={[styles.noticeTitle, { color: colors.text }]}>
              {result.status === 'coming_soon' ? 'Feature coming soon' : 'Feedback sent'}
            </Text>
            <Text style={[styles.noticeBody, { color: colors.textSecondary }]}>
              {result.message}
            </Text>
          </View>
        </View>
      ) : null}

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
    marginBottom: 24,
  },
  form: { marginBottom: 24 },
  field: { gap: 8 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  typeTile: {
    // Two per row: (100% - one 10pt gap) / 2.
    flexBasis: '47%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 52,
    paddingHorizontal: 14,
    borderWidth: 1.5,
  },
  typeLabel: { fontFamily: FONT, fontSize: 15, fontWeight: '700' },
  detailsInput: { minHeight: 140 },
  hint: { fontFamily: FONT, fontSize: 12, fontWeight: '600' },
  notice: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  noticeText: { flex: 1, gap: 4 },
  noticeTitle: { fontFamily: FONT, fontSize: 15, fontWeight: '800' },
  noticeBody: { fontFamily: FONT, fontSize: 13, lineHeight: 19, fontWeight: '500' },
});
