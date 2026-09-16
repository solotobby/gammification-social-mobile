import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BackButton } from '../src/components/ui/BackButton';
import { GradientButton } from '../src/components/ui/GradientButton';
import { KeyboardAwareScreen } from '../src/components/ui/KeyboardAwareScreen';
import { OtpInput } from '../src/components/ui/OtpInput';
import {
  activateSession,
  useForgotPassword,
  useResendOtp,
  useVerifyOtp,
} from '../src/hooks/useAuth';
import { useFeedbackStore } from '../src/stores/feedbackStore';
import { useTheme } from '../src/theme/ThemeProvider';
import { FONT } from '../src/theme/fonts';

const RESEND_SECONDS = 30;
const CODE_LENGTH = 6;

export default function VerifyCodeScreen() {
  const { colors, brand, radius, spacing, typography } = useTheme();
  const router = useRouter();
  // `next` is the route to continue to once the code is entered — set by the
  // caller (sign-up -> /get-started, forgot-password -> /reset-password).
  //
  // The two flows verify in different places, and that is a property of the
  // API, not a shortcut:
  //
  // - **Sign-up** passes `userId`, so the code is checked here against
  //   POST /verify/otp (which also signs the user in).
  // - **Password reset** has no endpoint that checks a code on its own —
  //   POST /reset-password validates the OTP and sets the password in a single
  //   call. So this screen collects the digits and forwards them to
  //   /reset-password, which is where a wrong code surfaces.
  //
  // `prefillOtp` is a TEMPORARY testing aid: the backend doesn't email codes
  // yet, so sign-up passes the one from the register response — remove once
  // real emails ship.
  const { email, next, userId, prefillOtp, expiresIn } = useLocalSearchParams<{
    email?: string;
    next?: string;
    userId?: string;
    prefillOtp?: string;
    expiresIn?: string;
  }>();

  const [code, setCode] = useState(prefillOtp ?? '');
  const [seconds, setSeconds] = useState(RESEND_SECONDS);

  const verifyMutation = useVerifyOtp();
  const resendMutation = useResendOtp();
  // The reset flow re-requests its code from /forgot-password, not /resend/otp
  // (which is keyed on a user id this flow never has).
  const forgotMutation = useForgotPassword();
  const isReset = !userId;
  const showApiError = useFeedbackStore((s) => s.showApiError);
  const showToast = useFeedbackStore((s) => s.showToast);

  useEffect(() => {
    if (seconds <= 0) return;
    const id = setInterval(() => setSeconds((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [seconds]);

  // The entered code travels on to /reset-password, which is the only thing
  // that can actually validate it.
  const continueToNext = (otp?: string) =>
    router.replace({
      pathname: next ?? '/reset-password',
      params: { email, ...(otp ? { otp } : null) },
    });

  // `value` defaults to the current state, but onComplete passes the freshly
  // entered code so we don't read a stale value during the same change event.
  const verify = (value: string = code) => {
    if (value.length !== CODE_LENGTH) return;
    if (isReset) {
      continueToNext(value);
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
    const onSuccess = () => {
      setSeconds(RESEND_SECONDS);
      setCode('');
      showToast('A new code is on its way to your email.', 'success');
    };
    const onError = (error: unknown) => showApiError(error, 'Could not resend the code.');

    if (userId) {
      resendMutation.mutate({ id: userId }, { onSuccess, onError });
    } else if (email) {
      forgotMutation.mutate({ email }, { onSuccess, onError });
    }
  };

  const resending = resendMutation.isPending || forgotMutation.isPending;
  const expiryMinutes = Number(expiresIn);

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
        {Number.isFinite(expiryMinutes) && expiryMinutes > 0 ? (
          <Text style={[styles.expiry, { color: colors.textMuted }]}>
            It expires in {expiryMinutes} minutes.
          </Text>
        ) : null}
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
        ) : resending ? (
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
        label={isReset ? 'Continue' : 'Verify'}
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
  expiry: {
    fontFamily: FONT,
    fontSize: 13,
    fontWeight: '500',
    marginTop: 6,
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
