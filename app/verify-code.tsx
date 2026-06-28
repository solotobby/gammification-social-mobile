import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BackButton } from '../src/components/ui/BackButton';
import { GradientButton } from '../src/components/ui/GradientButton';
import { KeyboardAwareScreen } from '../src/components/ui/KeyboardAwareScreen';
import { OtpInput } from '../src/components/ui/OtpInput';
import { useTheme } from '../src/theme/ThemeProvider';

const RESEND_SECONDS = 30;
const CODE_LENGTH = 6;

export default function VerifyCodeScreen() {
  const { colors, brand, radius, spacing, typography } = useTheme();
  const router = useRouter();
  // `next` is the route to continue to once the code is verified — set by the
  // caller (sign-up -> /get-started, forgot-password -> /reset-password).
  const { email, next } = useLocalSearchParams<{ email?: string; next?: string }>();

  const [code, setCode] = useState('');
  const [seconds, setSeconds] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (seconds <= 0) return;
    const id = setInterval(() => setSeconds((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [seconds]);

  // `value` defaults to the current state, but onComplete passes the freshly
  // entered code so we don't read a stale value during the same change event.
  const verify = (value: string = code) => {
    if (value.length === CODE_LENGTH) {
      router.replace({ pathname: next ?? '/reset-password', params: { email } });
    }
  };

  const resend = () => setSeconds(RESEND_SECONDS);

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
        style={[styles.cta, !isComplete && styles.ctaDisabled]}
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
    fontSize: 14,
    fontWeight: '500',
  },
  cta: {
    width: '100%',
    marginTop: 28,
  },
  ctaDisabled: {
    opacity: 0.5,
  },
});
