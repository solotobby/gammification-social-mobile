import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { BackButton } from '../src/components/ui/BackButton';
import { GradientButton } from '../src/components/ui/GradientButton';
import { KeyboardAwareScreen } from '../src/components/ui/KeyboardAwareScreen';
import { TextField } from '../src/components/ui/TextField';
import { useTheme } from '../src/theme/ThemeProvider';

const MIN_LENGTH = 8;

export default function ResetPasswordScreen() {
  const { colors, brand, radius, spacing, typography } = useTheme();
  const router = useRouter();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const confirmRef = useRef<TextInput>(null);

  const tooShort = password.length > 0 && password.length < MIN_LENGTH;
  const mismatch = confirm.length > 0 && confirm !== password;
  const valid = password.length >= MIN_LENGTH && confirm === password;

  const submit = () => {
    setSubmitted(true);
    if (valid) router.replace('/reset-success');
  };

  const hint = (() => {
    if (tooShort) return `Use at least ${MIN_LENGTH} characters.`;
    if (mismatch) return "Passwords don't match yet.";
    return `Use at least ${MIN_LENGTH} characters with a mix of letters and numbers.`;
  })();
  const hintColor = tooShort || mismatch ? colors.pink : colors.textMuted;

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
          <Ionicons name="key-outline" size={42} color="#FFFFFF" />
        </LinearGradient>

        <Text style={[typography.title, styles.title, { color: colors.text }]}>
          Set a new password
        </Text>
        <Text style={[typography.body, styles.subtitle, { color: colors.textSecondary }]}>
          Create a strong password you haven't used before.
        </Text>
      </View>

      <View style={[styles.form, { gap: spacing.md }]}>
        <TextField
          icon="lock-closed-outline"
          placeholder="New password"
          value={password}
          onChangeText={setPassword}
          secure
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="next"
          onSubmitEditing={() => confirmRef.current?.focus()}
          submitBehavior="submit"
        />
        <TextField
          ref={confirmRef}
          icon="lock-closed-outline"
          placeholder="Confirm new password"
          value={confirm}
          onChangeText={setConfirm}
          secure
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="done"
          onSubmitEditing={submit}
        />
        <Text style={[styles.hint, { color: hintColor }]}>{hint}</Text>
      </View>

      <GradientButton
        label="Reset password"
        icon="checkmark"
        onPress={submit}
        style={[styles.cta, submitted && !valid && styles.ctaShake]}
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
    marginBottom: 28,
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
  form: {
    marginBottom: 24,
  },
  hint: {
    fontSize: 13,
    fontWeight: '500',
    paddingHorizontal: 4,
  },
  cta: {
    width: '100%',
  },
  ctaShake: {
    opacity: 0.9,
  },
});
