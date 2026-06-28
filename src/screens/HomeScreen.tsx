import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemeToggle } from '../components/ui/ThemeToggle';
import { useTheme } from '../theme/ThemeProvider';

type Props = {
  onReplay: () => void;
};

/**
 * Placeholder landing screen shown after onboarding. Its real purpose here is to
 * demonstrate that the whole app reacts to the active palette and lets you flip
 * between System / Light / Dark.
 */
export function HomeScreen({ onReplay }: Props) {
  const { colors, brand, radius, spacing, typography, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={[colors.backgroundElevated, colors.background]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + spacing.xl,
          paddingBottom: insets.bottom + spacing.xl,
          paddingHorizontal: spacing.xl,
          gap: spacing.xl,
        }}
      >
        <View>
          <Text style={[styles.greeting, { color: colors.textMuted }]}>
            Welcome back 👋
          </Text>
          <Text style={[typography.hero, { color: colors.text }]}>
            You're all set
          </Text>
        </View>

        {/* Balance card */}
        <LinearGradient
          colors={[brand.violetBright, brand.violet]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.balanceCard, { borderRadius: radius.lg }]}
        >
          <Text style={styles.balanceLabel}>Available balance</Text>
          <Text style={styles.balanceValue}>$12,480.50</Text>
          <View style={styles.balanceRow}>
            <View style={styles.balancePill}>
              <Ionicons name="arrow-up" size={14} color="#FFFFFF" />
              <Text style={styles.balancePillText}>Send</Text>
            </View>
            <View style={styles.balancePill}>
              <Ionicons name="arrow-down" size={14} color="#FFFFFF" />
              <Text style={styles.balancePillText}>Request</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Appearance switcher */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: radius.lg,
            },
          ]}
        >
          <Text style={[typography.caption, { color: colors.textMuted }]}>
            APPEARANCE
          </Text>
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            Theme — currently {isDark ? 'Dark' : 'Light'}
          </Text>
          <ThemeToggle />
        </View>

        <Pressable
          onPress={onReplay}
          accessibilityRole="button"
          style={[
            styles.replay,
            { borderColor: colors.border, backgroundColor: colors.surfaceAlt },
          ]}
        >
          <Ionicons name="play-back-outline" size={18} color={colors.brand} />
          <Text style={[styles.replayText, { color: colors.text }]}>
            Replay welcome screen
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  greeting: { fontSize: 15, fontWeight: '600', marginBottom: 4 },
  balanceCard: {
    padding: 22,
    gap: 6,
    shadowColor: '#5A4FDC',
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  balanceLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    fontWeight: '600',
  },
  balanceValue: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '900',
    marginBottom: 10,
  },
  balanceRow: { flexDirection: 'row', gap: 12 },
  balancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
  },
  balancePillText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  card: {
    padding: 20,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  cardTitle: { fontSize: 18, fontWeight: '800', marginBottom: 14 },
  replay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  replayText: { fontSize: 15, fontWeight: '700' },
});
