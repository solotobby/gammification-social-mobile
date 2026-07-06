import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackButton } from '../src/components/ui/BackButton';
import { ScreenBackground } from '../src/components/ui/ScreenBackground';
import { SectionHeader } from '../src/components/ui/SectionHeader';
import { earnings } from '../src/data/community';
import { useTheme } from '../src/theme/ThemeProvider';

const STEPS: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string }[] = [
  {
    icon: 'person-add-outline',
    title: 'Create your account',
    body: 'Sign up, verify your email, and set up your profile. A referral code at signup earns your inviter a bonus.',
  },
  {
    icon: 'create-outline',
    title: 'Post every day',
    body: 'Short posts (160 characters) keep the feed moving. Consistency beats luck — the top earners post daily.',
  },
  {
    icon: 'heart-outline',
    title: 'Engage with the community',
    body: 'Likes, comments, and views on your posts all count as engagement — the raw material of your earnings.',
  },
  {
    icon: 'shield-checkmark-outline',
    title: 'Engagement gets validated',
    body: 'At month end every interaction is checked. Validated engagement converts at ₦1,500 per 1,000.',
  },
  {
    icon: 'cash-outline',
    title: 'Get paid',
    body: 'Payouts land in your wallet. Link a bank account and upgrade to Creator or Influencer to withdraw.',
  },
];

const FAQS: { q: string; a: string }[] = [
  {
    q: 'How much can I earn?',
    a: `Every 1,000 validated engagements pays ₦${earnings.ratePerThousand.toLocaleString()}. There's no cap — more posts and more engagement mean a bigger payout.`,
  },
  {
    q: 'When do payouts happen?',
    a: 'Once a month, after validation runs at month end. Your Earnings tab shows the running estimate for the current month.',
  },
  {
    q: 'Why do withdrawals need Creator or Influencer?',
    a: 'Monetization and withdrawals are part of the paid tiers. Basic accounts still earn — the balance waits in your wallet until you upgrade.',
  },
  {
    q: 'What counts as a validated engagement?',
    a: 'Genuine likes, comments, and views from real members. Automated or spammy interactions are filtered out during validation.',
  },
];

function FaqRow({ q, a }: { q: string; a: string }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <Pressable
      onPress={() => setOpen((o) => !o)}
      accessibilityRole="button"
      accessibilityLabel={q}
      style={styles.faqRow}
    >
      <View style={styles.faqHeader}>
        <Text style={[styles.faqQuestion, { color: colors.text }]}>{q}</Text>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={colors.textMuted}
        />
      </View>
      {open ? (
        <Text style={[styles.faqAnswer, { color: colors.textSecondary }]}>{a}</Text>
      ) : null}
    </Pressable>
  );
}

/** How it works — the earning loop explained (steps + FAQ). */
export default function HowItWorksScreen() {
  const { colors, brand, radius, spacing } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScreenBackground />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + spacing.lg,
          paddingBottom: insets.bottom + spacing.xl,
          paddingHorizontal: spacing.xl,
          gap: spacing.xl,
        }}
      >
        <View style={styles.headerRow}>
          <BackButton onPress={() => router.back()} />
          <Text style={[styles.headerTitle, { color: colors.text }]}>How it works</Text>
          <View style={{ width: 44 }} />
        </View>

        {/* The pitch */}
        <LinearGradient
          colors={[brand.violetBright, brand.violet]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.pitch, { borderRadius: radius.lg, shadowColor: brand.violet }]}
        >
          <Text style={styles.pitchTitle}>Engagement pays. Literally.</Text>
          <Text style={styles.pitchBody}>
            Every {'1,000'} validated engagements on your posts puts{' '}
            ₦{earnings.ratePerThousand.toLocaleString()} in your wallet.
          </Text>
        </LinearGradient>

        {/* Steps */}
        <View style={{ gap: spacing.md }}>
          <SectionHeader title="The earning loop" icon="sync" />
          <View
            style={[
              styles.stepsCard,
              { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg },
            ]}
          >
            {STEPS.map((step, index) => (
              <View
                key={step.title}
                style={[
                  styles.stepRow,
                  index > 0 && {
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: colors.border,
                  },
                ]}
              >
                <View style={styles.stepLeading}>
                  <View style={[styles.stepIcon, { backgroundColor: colors.surfaceAlt }]}>
                    <Ionicons name={step.icon} size={19} color={colors.brand} />
                  </View>
                  <Text style={[styles.stepNumber, { color: colors.textMuted }]}>
                    {index + 1}
                  </Text>
                </View>
                <View style={styles.stepText}>
                  <Text style={[styles.stepTitle, { color: colors.text }]}>{step.title}</Text>
                  <Text style={[styles.stepBody, { color: colors.textSecondary }]}>
                    {step.body}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* FAQ */}
        <View style={{ gap: spacing.md }}>
          <SectionHeader title="Questions, answered" icon="help-circle" />
          <View
            style={[
              styles.faqCard,
              { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg },
            ]}
          >
            {FAQS.map((faq, index) => (
              <View
                key={faq.q}
                style={
                  index > 0
                    ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }
                    : undefined
                }
              >
                <FaqRow q={faq.q} a={faq.a} />
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  pitch: {
    padding: 22,
    gap: 8,
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  pitchTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '900' },
  pitchBody: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  stepsCard: {
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
  },
  stepRow: {
    flexDirection: 'row',
    gap: 14,
    paddingVertical: 16,
  },
  stepLeading: { alignItems: 'center', gap: 4 },
  stepIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumber: { fontSize: 11, fontWeight: '800' },
  stepText: { flex: 1, gap: 3 },
  stepTitle: { fontSize: 15, fontWeight: '800' },
  stepBody: { fontSize: 13, lineHeight: 19, fontWeight: '500' },
  faqCard: {
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
  },
  faqRow: {
    paddingVertical: 15,
    gap: 8,
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  faqQuestion: { flex: 1, fontSize: 14, fontWeight: '700' },
  faqAnswer: { fontSize: 13, lineHeight: 19, fontWeight: '500' },
});
