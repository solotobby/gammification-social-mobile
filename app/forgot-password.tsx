import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BackButton } from '../src/components/ui/BackButton';
import { GradientButton } from '../src/components/ui/GradientButton';
import { KeyboardAwareScreen } from '../src/components/ui/KeyboardAwareScreen';
import { TextField } from '../src/components/ui/TextField';
import { useTheme } from '../src/theme/ThemeProvider';

export default function ForgotPasswordScreen() {
  const { colors, brand, radius, typography } = useTheme();
  const router = useRouter();
  const [email, setEmail] = useState('');

  const submit = () =>
    router.push({
      pathname: '/verify-code',
      params: { email, next: '/reset-password' },
    });

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
          <Ionicons name="lock-closed-outline" size={42} color="#FFFFFF" />
        </LinearGradient>

        <Text style={[typography.title, styles.title, { color: colors.text }]}>
          Forgot password?
        </Text>
        <Text style={[typography.body, styles.subtitle, { color: colors.textSecondary }]}>
          No worries — enter the email tied to your account and we'll send you a
          6-digit code to reset it.
        </Text>
      </View>

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
        returnKeyType="send"
        onSubmitEditing={submit}
      />

      <GradientButton
        label="Send reset code"
        icon="paper-plane-outline"
        onPress={submit}
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
  cta: {
    width: '100%',
    marginTop: 24,
  },
});
