import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GradientButton } from '../src/components/ui/GradientButton';
import { ScreenBackground } from '../src/components/ui/ScreenBackground';
import { useTheme } from '../src/theme/ThemeProvider';

export default function ResetSuccessScreen() {
  const { colors, brand, radius, spacing, typography } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScreenBackground />

      <View
        style={[
          styles.content,
          {
            paddingTop: insets.top + spacing.xl,
            paddingBottom: insets.bottom + spacing.xl,
            paddingHorizontal: spacing.xl,
          },
        ]}
      >
        <View style={styles.center}>
          <LinearGradient
            colors={[brand.mintBright, brand.mint]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.badge, { borderRadius: radius.pill, shadowColor: brand.mint }]}
          >
            <Ionicons name="checkmark" size={64} color="#FFFFFF" />
          </LinearGradient>

          <Text style={[typography.title, styles.title, { color: colors.text }]}>
            Password reset!
          </Text>
          <Text style={[typography.body, styles.subtitle, { color: colors.textSecondary }]}>
            Your password has been changed successfully. You can now sign in with
            your new password.
          </Text>
        </View>

        <GradientButton
          label="Back to sign in"
          icon="log-in-outline"
          onPress={() => router.replace('/sign-in')}
          style={styles.cta}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    flex: 1,
    justifyContent: 'space-between',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.45,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 14,
    marginBottom: 32,
  },
  title: {
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 12,
    textAlign: 'center',
    maxWidth: 320,
  },
  cta: {
    width: '100%',
  },
});
