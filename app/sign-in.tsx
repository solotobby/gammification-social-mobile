import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { BackButton } from '../src/components/ui/BackButton';
import { GhostButton } from '../src/components/ui/GhostButton';
import { GradientButton } from '../src/components/ui/GradientButton';
import { KeyboardAwareScreen } from '../src/components/ui/KeyboardAwareScreen';
import { Logo } from '../src/components/ui/Logo';
import { TextField } from '../src/components/ui/TextField';
import { useTheme } from '../src/theme/ThemeProvider';

export default function SignInScreen() {
  const { colors, typography, spacing } = useTheme();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const passwordRef = useRef<TextInput>(null);

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
        <TextField
          icon="mail-outline"
          placeholder="Email address"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
          submitBehavior="submit"
        />
        <TextField
          ref={passwordRef}
          icon="lock-closed-outline"
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secure
          autoCapitalize="none"
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="done"
          onSubmitEditing={() => router.replace('/home')}
        />

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
        onPress={() => router.replace('/home')}
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
    fontSize: 14,
    fontWeight: '700',
  },
  cta: {
    width: '100%',
  },
  footer: {
    marginTop: 24,
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
