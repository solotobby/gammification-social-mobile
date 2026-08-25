import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BackButton } from '../src/components/ui/BackButton';
import { GradientButton } from '../src/components/ui/GradientButton';
import { KeyboardAwareScreen } from '../src/components/ui/KeyboardAwareScreen';
import { OtpInput } from '../src/components/ui/OtpInput';
import { activateSession, useResendOtp, useVerifyOtp } from '../src/hooks/useAuth';
import { useFeedbackStore } from '../src/stores/feedbackStore';
import { useTheme } from '../src/theme/ThemeProvider';
import { FONT } from '../src/theme/fonts';

const RESEND_SECONDS = 30;
const CODE_LENGTH = 6;

export default function VerifyCodeScreen() {
  const { colors, brand, radius, spacing, typography } = useTheme();
  const router = useRouter();
  // `next` is the route to continue to once the code is verified — set by the
  // caller (sign-up -> /get-started, forgot-password -> /reset-password).
  // `userId` is set by sign-up: with it we verify against the API (which also
  // signs the user in); without it (forgot-password — no API endpoints yet)
  // the code is accepted as-is. `prefillOtp` is a TEMPORARY testing aid: the
  // backend doesn't email codes yet, so sign-up passes the one from the
  // register response — remove once real emails ship.
  const { email, next, userId, prefillOtp } = useLocalSearchParams<{
    email?: string;
    next?: string;
    userId?: string;
    prefillOtp?: string;
  }>();

  const [code, setCode] = useState(prefillOtp ?? '');
  const [seconds, setSeconds] = useState(RESEND_SECONDS);

  const verifyMutation = useVerifyOtp();
  const resendMutation = useResendOtp();
  const showApiError = useFeedbackStore((s) => s.showApiError);
  const showToast = useFeedbackStore((s) => s.showToast);

  useEffect(() => {
    if (seconds <= 0) return;
    const id = setInterval(() => setSeconds((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [seconds]);

  const continueToNext = () =>
    router.replace({ pathname: next ?? '/reset-password', params: { email } });

  // `value` defaults to the current state, but onComplete passes the freshly
  // entered code so we don't read a stale value during the same change event.
  const verify = (value: string = code) => {
    if (value.length !== CODE_LENGTH) return;
    if (!userId) {
      continueToNext();
      return;
    }
    verifyMutation.mutate(
      { id: userId, otp: value },
      {
        onSuccess: ({ token, me }) => {
          // Navigate first: activating the session flips the router's auth
          // guards and removes this screen, so we must already be on a route
          // (/get-started) that exists on the signed-in side.
          continueToNext();
          void activateSession(token, me);
        },
        onError: (error) => {
          setCode('');
          showApiError(error, 'Verification failed. Try again.');
        },
      },
    );
  };

  const resend = () => {
    if (userId) {
      resendMutation.mutate(
        { id: userId },
        {
          onSuccess: () => {
            setSeconds(RESEND_SECONDS);
            showToast('A new code is on its way to your email.', 'success');
          },
          onError: (error) => showApiError(error, 'Could not resend the code.'),
        },
      );
    } else {
      setSeconds(RESEND_SECONDS);
      showToast('A new code is on its way to your email.', 'success');
    }
  };

  const isComplete = code.length === CODE_LENGTH;

  return (
    <KeyboardAwareScreen>
      <View style={styles.header}>
        <BackButton onPress={() => router.back()} />
      </View>

      <View style={styles.intro}>
        <LinearGradient
          colors={[brand.violetBright, brand.violet]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.badge, { borderRadius: radius.xl, shadowColor: brand.violet }]}
        >
          <Ionicons name="shield-checkmark-outline" size={42} color="#FFFFFF" />
        </LinearGradient>

        <Text style={[typography.title, styles.title, { color: colors.text }]}>
          Enter the code
        </Text>
        <Text style={[typography.body, styles.subtitle, { color: colors.textSecondary }]}>
          We sent a {CODE_LENGTH}-digit code to{' '}
          <Text style={{ color: colors.text, fontWeight: '700' }}>
            {email || 'your email'}
          </Text>
          .
        </Text>
      </View>

      <OtpInput
        value={code}
        onChangeText={setCode}
        cellCount={CODE_LENGTH}
        onComplete={verify}
        autoFocus
      />

      <View style={[styles.resendRow, { marginTop: spacing.xl }]}>
        <Text style={[styles.resendText, { color: colors.textMuted }]}>
          Didn't get it?{' '}
        </Text>
        {seconds > 0 ? (
          <Text style={[styles.resendText, { color: colors.textSecondary }]}>
            Resend in {seconds}s
          </Text>
        ) : resendMutation.isPending ? (
          <Text style={[styles.resendText, { color: colors.textSecondary }]}>
            Sending…
          </Text>
        ) : (
          <Pressable hitSlop={8} onPress={resend} accessibilityRole="button">
            <Text style={[styles.resendText, { color: colors.brand, fontWeight: '700' }]}>
              Resend code
            </Text>
          </Pressable>
        )}
      </View>

      <GradientButton
        label="Verify"
        icon="checkmark"
        onPress={() => verify()}
        loading={verifyMutation.isPending}
        disabled={!isComplete}
        style={styles.cta}
      />
    </KeyboardAwareScreen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  intro: {
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 32,
  },
  badge: {
    width: 88,
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
    marginBottom: 24,
  },
  title: {
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 10,
    textAlign: 'center',
    maxWidth: 330,
  },
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resendText: {
    fontFamily: FONT,
    fontSize: 14,
    fontWeight: '500',
  },
  cta: {
    width: '100%',
    marginTop: 28,
  },
});
