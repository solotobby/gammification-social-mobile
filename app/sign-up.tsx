import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { BackButton } from '../src/components/ui/BackButton';
import { GhostButton } from '../src/components/ui/GhostButton';
import { GradientButton } from '../src/components/ui/GradientButton';
import { KeyboardAwareScreen } from '../src/components/ui/KeyboardAwareScreen';
import { Logo } from '../src/components/ui/Logo';
import { TextField } from '../src/components/ui/TextField';
import { useTheme } from '../src/theme/ThemeProvider';

export default function SignUpScreen() {
  const { colors, typography, spacing } = useTheme();
  const router = useRouter();

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [referral, setReferral] = useState('');

  const usernameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const referralRef = useRef<TextInput>(null);

  // Verify the email next, then continue into the get-started flow.
  const goVerify = () =>
    router.push({
      pathname: '/verify-code',
      params: { email, next: '/get-started' },
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
        <TextField
          icon="person-outline"
          placeholder="Full name"
          value={fullName}
          onChangeText={setFullName}
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          returnKeyType="next"
          onSubmitEditing={() => usernameRef.current?.focus()}
          submitBehavior="submit"
        />
        <TextField
          ref={usernameRef}
          icon="at-outline"
          placeholder="Preferred username"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
          textContentType="username"
          returnKeyType="next"
          onSubmitEditing={() => emailRef.current?.focus()}
          submitBehavior="submit"
        />
        <TextField
          ref={emailRef}
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
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="next"
          onSubmitEditing={() => referralRef.current?.focus()}
          submitBehavior="submit"
        />
        <TextField
          ref={referralRef}
          icon="gift-outline"
          placeholder="Referral code (optional)"
          value={referral}
          onChangeText={setReferral}
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={goVerify}
        />
      </View>

      <GradientButton
        label="Create Account"
        icon="person-add-outline"
        onPress={goVerify}
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
