import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import React, { useRef } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { ApiError } from '../src/api/client';
import { useFeedbackStore } from '../src/stores/feedbackStore';
import { BackButton } from '../src/components/ui/BackButton';
import { FieldError } from '../src/components/ui/FieldError';
import { GhostButton } from '../src/components/ui/GhostButton';
import { GradientButton } from '../src/components/ui/GradientButton';
import { KeyboardAwareScreen } from '../src/components/ui/KeyboardAwareScreen';
import { Logo } from '../src/components/ui/Logo';
import { TextField } from '../src/components/ui/TextField';
import { signUpSchema, type SignUpValues } from '../src/forms/auth';
import { useRegister } from '../src/hooks/useAuth';
import { useTheme } from '../src/theme/ThemeProvider';

export default function SignUpScreen() {
  const { colors, typography, spacing } = useTheme();
  const router = useRouter();
  const registerMutation = useRegister();
  const showApiError = useFeedbackStore((s) => s.showApiError);

  const { control, handleSubmit, setError, formState } = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: '', username: '', email: '', password: '', referral_code: '' },
  });

  const usernameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const referralRef = useRef<TextInput>(null);

  const onSubmit = handleSubmit((values) => {
    registerMutation.mutate(
      {
        name: values.name,
        username: values.username,
        email: values.email,
        password: values.password,
        ...(values.referral_code ? { referral_code: values.referral_code } : {}),
      },
      {
        // The account now exists — verify the email next, then continue into
        // the get-started flow. `prefillOtp` is a TEMPORARY testing aid while
        // the backend doesn't email codes; remove once real emails ship.
        onSuccess: (data) =>
          router.push({
            pathname: '/verify-code',
            params: {
              email: values.email,
              userId: data.id,
              next: '/get-started',
              ...(data.otp != null ? { prefillOtp: String(data.otp) } : {}),
            },
          }),
        onError: (error) => {
          // Server validation messages render inline on their fields; anything
          // else goes to the global toast/modal.
          if (error instanceof ApiError && error.fieldErrors) {
            let mappedAny = false;
            for (const [field, messages] of Object.entries(error.fieldErrors)) {
              if (field in values) {
                setError(field as keyof SignUpValues, { message: messages[0] });
                mappedAny = true;
              }
            }
            if (mappedAny) return;
          }
          showApiError(error);
        },
      },
    );
  });

  return (
    <KeyboardAwareScreen>
      <View style={styles.header}>
        <BackButton onPress={() => router.back()} />
      </View>

      <View style={styles.brand}>
        <Logo width={188} />
        <Text style={[typography.title, styles.title, { color: colors.text }]}>
          Create your account
        </Text>
        <Text style={[typography.body, styles.subtitle, { color: colors.textSecondary }]}>
          Join Payhankey and start earning from the content you love to share.
        </Text>
      </View>

      <View style={[styles.form, { gap: spacing.md }]}>
        <Controller
          control={control}
          name="name"
          render={({ field: { value, onChange, onBlur } }) => (
            <TextField
              icon="person-outline"
              placeholder="Full name"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              autoCapitalize="words"
              autoComplete="name"
              textContentType="name"
              returnKeyType="next"
              onSubmitEditing={() => usernameRef.current?.focus()}
              submitBehavior="submit"
            />
          )}
        />
        <FieldError message={formState.errors.name?.message} />
        <Controller
          control={control}
          name="username"
          render={({ field: { value, onChange, onBlur } }) => (
            <TextField
              ref={usernameRef}
              icon="at-outline"
              placeholder="Preferred username"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              textContentType="username"
              returnKeyType="next"
              onSubmitEditing={() => emailRef.current?.focus()}
              submitBehavior="submit"
            />
          )}
        />
        <FieldError message={formState.errors.username?.message} />
        <Controller
          control={control}
          name="email"
          render={({ field: { value, onChange, onBlur } }) => (
            <TextField
              ref={emailRef}
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
              autoComplete="new-password"
              textContentType="newPassword"
              returnKeyType="next"
              onSubmitEditing={() => referralRef.current?.focus()}
              submitBehavior="submit"
            />
          )}
        />
        <FieldError message={formState.errors.password?.message} />
        <Controller
          control={control}
          name="referral_code"
          render={({ field: { value, onChange, onBlur } }) => (
            <TextField
              ref={referralRef}
              icon="gift-outline"
              placeholder="Referral code (optional)"
              value={value ?? ''}
              onChangeText={onChange}
              onBlur={onBlur}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={onSubmit}
            />
          )}
        />
        <FieldError message={formState.errors.referral_code?.message} />
      </View>

      <GradientButton
        label="Create Account"
        icon="person-add-outline"
        onPress={onSubmit}
        loading={registerMutation.isPending}
        style={styles.cta}
      />

      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: colors.textSecondary }]}>
          Already registered?
        </Text>
        <GhostButton
          label="Sign in here"
          icon="log-in-outline"
          accent
          onPress={() => router.replace('/sign-in')}
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
    marginBottom: 24,
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
    marginBottom: 24,
  },
  cta: {
    width: '100%',
    marginTop: 8,
  },
  footer: {
    marginTop: 20,
    alignItems: 'center',
    gap: 12,
  },
  footerText: {
    fontSize: 14,
    fontWeight: '500',
  },
  footerBtn: {
    alignSelf: 'stretch',
  },
});
