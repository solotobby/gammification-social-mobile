import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BackButton } from '../src/components/ui/BackButton';
import { CopyField } from '../src/components/ui/CopyField';
import { GradientButton } from '../src/components/ui/GradientButton';
import { KeyboardAwareScreen } from '../src/components/ui/KeyboardAwareScreen';
import { Logo } from '../src/components/ui/Logo';
import { SelectField, type SelectOption } from '../src/components/ui/SelectField';
import { useUpdateOnboarding } from '../src/hooks/useAuth';
import { useMyReferral } from '../src/hooks/useMe';
import { useChannels, useCurrencies } from '../src/hooks/useUser';
import { useFeedbackStore } from '../src/stores/feedbackStore';
import { useTheme } from '../src/theme/ThemeProvider';

// Shown only until the live lists load (or if the request fails), so the picker
// is never empty. The real options come from /user/currency/list + /user/channel.
const FALLBACK_CURRENCIES: SelectOption[] = [
  { label: 'USD — United States of America', value: 'USD' },
  { label: 'NGN — Nigeria', value: 'NGN' },
  { label: 'GBP — United Kingdom', value: 'GBP' },
];

const FALLBACK_HEARD_FROM: SelectOption[] = [
  { label: 'Facebook', value: 'Facebook' },
  { label: 'Twitter(X)', value: 'Twitter(X)' },
  { label: 'Google', value: 'Google' },
];

const TOTAL_STEPS = 3;

export default function GetStartedScreen() {
  const { colors, brand, radius, spacing, typography } = useTheme();
  const router = useRouter();
  const onboardMutation = useUpdateOnboarding();
  const showApiError = useFeedbackStore((s) => s.showApiError);

  const { data: currencies } = useCurrencies();
  const { data: channels } = useChannels();

  const currencyOptions = useMemo<SelectOption[]>(
    () =>
      currencies?.length
        ? currencies.map((c) => ({ label: `${c.code} — ${c.country}`, value: c.code }))
        : FALLBACK_CURRENCIES,
    [currencies],
  );
  const heardOptions = useMemo<SelectOption[]>(
    () =>
      channels?.length
        ? channels.map((name) => ({ label: name, value: name }))
        : FALLBACK_HEARD_FROM,
    [channels],
  );

  const [step, setStep] = useState(0);
  const [currency, setCurrency] = useState<string | null>(null);
  const [heard, setHeard] = useState<string | null>(null);

  const { code: referralCode, link: referralLink } = useMyReferral();

  const isLastStep = step === TOTAL_STEPS - 1;

  const finish = () => {
    if (!heard || !currency) return;
    onboardMutation.mutate(
      { heard, currency },
      {
        onSuccess: () => router.replace('/home'),
        onError: (error) => showApiError(error, 'Could not save your preferences.'),
      },
    );
  };

  const goNext = () => (isLastStep ? finish() : setStep(step + 1));
  const goPrev = () => step > 0 && setStep(step - 1);

  const hero: {
    icon: keyof typeof Ionicons.glyphMap;
    gradient: [string, string];
  }[] = [
    { icon: 'rocket-outline', gradient: [brand.violetBright, brand.violet] },
    { icon: 'gift-outline', gradient: [brand.gold, brand.pink] },
    { icon: 'trending-up-outline', gradient: [brand.mintBright, brand.mint] },
  ];

  const ctaLabel = isLastStep ? 'Get Started' : 'Continue';
  const ctaIcon = isLastStep ? 'checkmark' : 'arrow-forward';

  return (
    <KeyboardAwareScreen>
      {/* Header */}
      <View style={styles.header}>
        {step > 0 ? <BackButton onPress={goPrev} /> : <View style={styles.spacer44} />}
        <Logo width={150} />
        <View style={styles.spacer44} />
      </View>

      {/* Hero badge */}
      <View style={styles.heroWrap}>
        <LinearGradient
          colors={hero[step].gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { borderRadius: radius.xl, shadowColor: hero[step].gradient[1] }]}
        >
          <Ionicons name={hero[step].icon} size={48} color="#FFFFFF" />
        </LinearGradient>
      </View>

      {/* Step content */}
      <View style={styles.body}>
        {step === 0 && (
          <>
            <Text style={[typography.title, styles.title, { color: colors.text }]}>
              Welcome to Payhankey!
            </Text>
            <Text style={[typography.body, styles.text, { color: colors.textSecondary }]}>
              Start earning money by posting engaging content. The more views, likes
              and comments you get, the more you earn!
            </Text>
          </>
        )}

        {step === 1 && (
          <>
            <Text style={[typography.title, styles.title, { color: colors.text }]}>
              Refer & earn more
            </Text>
            <Text style={[typography.body, styles.text, { color: colors.textSecondary }]}>
              Share your unique referral link and code with friends and followers to
              earn even more.
            </Text>
            <View style={[styles.referBlock, { gap: spacing.lg }]}>
              <CopyField
                label="Your referral link"
                value={referralLink ?? 'Loading…'}
                icon="link-outline"
              />
              <CopyField
                label="Your referral code"
                value={referralCode ?? 'Loading…'}
                icon="pricetag-outline"
                emphasized
              />
            </View>
          </>
        )}

        {step === 2 && (
          <>
            <Text style={[typography.title, styles.title, { color: colors.text }]}>
              More posts, more earnings
            </Text>
            <Text style={[typography.body, styles.text, { color: colors.textSecondary }]}>
              Start posting and sharing to get views and comments. Tell us how you
              heard about us and the currency you want to be paid in.
            </Text>
            <View style={[styles.selects, { gap: spacing.md }]}>
              <SelectField
                icon="cash-outline"
                placeholder="Select currency"
                title="Payout currency"
                value={currency}
                options={currencyOptions}
                onChange={setCurrency}
              />
              <SelectField
                icon="megaphone-outline"
                placeholder="How did you hear about us?"
                title="How did you hear about us?"
                value={heard}
                options={heardOptions}
                onChange={setHeard}
              />
            </View>
          </>
        )}
      </View>

      <View style={styles.flexSpacer} />

      {/* Footer: dots + CTA */}
      <View style={styles.footer}>
        <View style={styles.dots}>
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === step
                  ? { width: 24, backgroundColor: colors.brand }
                  : { width: 8, backgroundColor: colors.dotInactive },
              ]}
            />
          ))}
        </View>
        <GradientButton
          label={ctaLabel}
          icon={ctaIcon}
          onPress={goNext}
          loading={onboardMutation.isPending}
          disabled={isLastStep && (!currency || !heard)}
          style={styles.cta}
        />
      </View>
    </KeyboardAwareScreen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  spacer44: { width: 44, height: 44 },
  heroWrap: {
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 28,
  },
  hero: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  body: {
    alignItems: 'center',
  },
  title: {
    textAlign: 'center',
  },
  text: {
    marginTop: 12,
    textAlign: 'center',
    maxWidth: 340,
  },
  referBlock: {
    width: '100%',
    marginTop: 28,
  },
  selects: {
    width: '100%',
    marginTop: 24,
  },
  flexSpacer: {
    flex: 1,
    minHeight: 24,
  },
  footer: {
    alignItems: 'center',
    gap: 22,
    marginTop: 24,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  cta: {
    width: '100%',
  },
});
