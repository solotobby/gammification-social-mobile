import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import React, { useRef } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useFeedbackStore } from '../src/stores/feedbackStore';
import { BackButton } from '../src/components/ui/BackButton';
import { FieldError } from '../src/components/ui/FieldError';
import { GhostButton } from '../src/components/ui/GhostButton';
import { GradientButton } from '../src/components/ui/GradientButton';
import { KeyboardAwareScreen } from '../src/components/ui/KeyboardAwareScreen';
import { Logo } from '../src/components/ui/Logo';
import { TextField } from '../src/components/ui/TextField';
import { signInSchema, type SignInValues } from '../src/forms/auth';
import { activateSession, useLogin } from '../src/hooks/useAuth';
import { useTheme } from '../src/theme/ThemeProvider';
import { FONT } from '../src/theme/fonts';

export default function SignInScreen() {
  const { colors, typography, spacing } = useTheme();
  const router = useRouter();
  const loginMutation = useLogin();
  const showApiError = useFeedbackStore((s) => s.showApiError);

  const { control, handleSubmit, formState } = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  });

  const passwordRef = useRef<TextInput>(null);

  const onSubmit = handleSubmit((values) => {
    loginMutation.mutate(values, {
      onSuccess: ({ me, access_token }) => {
        // Activating the session flips the router's auth guards: this screen
        // is removed and onboarded users auto-land on the (tabs) shell. Users
        // who never finished onboarding resume it instead.
        void activateSession(access_token, me);
        if (!me.user.is_onboarded) router.replace('/get-started');
      },
      onError: (error) => showApiError(error, 'Sign in failed. Please try again.'),
    });
  });

  return (
    <KeyboardAwareScreen>
      <View style={styles.header}>
        <BackButton onPress={() => router.back()} />
      </View>

      <View style={styles.brand}>
        <Logo width={188} />
        <Text style={[typography.title, styles.title, { color: colors.text }]}>
          Welcome back
        </Text>
        <Text style={[typography.body, styles.subtitle, { color: colors.textSecondary }]}>
          Sign in to pick up right where you left off.
        </Text>
      </View>

      <View style={[styles.form, { gap: spacing.md }]}>
        <Controller
          control={control}
          name="email"
          render={({ field: { value, onChange, onBlur } }) => (
            <TextField
              icon="mail-outline"
              placeholder="Email address"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              submitBehavior="submit"
            />
          )}
        />
        <FieldError message={formState.errors.email?.message} />
        <Controller
          control={control}
          name="password"
          render={({ field: { value, onChange, onBlur } }) => (
            <TextField
              ref={passwordRef}
              icon="lock-closed-outline"
              placeholder="Password"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              secure
              autoCapitalize="none"
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="done"
              onSubmitEditing={onSubmit}
            />
          )}
        />
        <FieldError message={formState.errors.password?.message} />

        <Pressable
          hitSlop={8}
          onPress={() => router.push('/forgot-password')}
          accessibilityRole="button"
          accessibilityLabel="Forgot password"
          style={styles.forgot}
        >
          <Text style={[styles.forgotText, { color: colors.brand }]}>
            Forgot password?
          </Text>
        </Pressable>
      </View>

      <GradientButton
        label="Sign In"
        icon="log-in-outline"
        onPress={onSubmit}
        loading={loginMutation.isPending}
        style={styles.cta}
      />

      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: colors.textSecondary }]}>
          New to Payhankey?
        </Text>
        <GhostButton
          label="Create an account"
          icon="person-add-outline"
          accent
          onPress={() => router.replace('/sign-up')}
          style={styles.footerBtn}
        />
      </View>
    </KeyboardAwareScreen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  brand: {
    alignItems: 'center',
    marginBottom: 28,
  },
  title: {
    marginTop: 22,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 8,
    textAlign: 'center',
    maxWidth: 320,
  },
  form: {
    marginBottom: 28,
  },
  forgot: {
    alignSelf: 'flex-end',
    marginTop: 2,
  },
  forgotText: {
    fontFamily: FONT,
    fontSize: 14,
    fontWeight: '700',
  },
  cta: {
    width: '100%',
    marginTop: 8,
  },
  footer: {
    marginTop: 24,
    alignItems: 'center',
    gap: 12,
  },
  footerText: {
    fontFamily: FONT,
    fontSize: 14,
    fontWeight: '500',
  },
  footerBtn: {
    alignSelf: 'stretch',
  },
});
