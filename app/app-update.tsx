import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GhostButton } from '../src/components/ui/GhostButton';
import { GradientButton } from '../src/components/ui/GradientButton';
import { ScreenBackground } from '../src/components/ui/ScreenBackground';
import { currentVersionName, useAppUpdateFlow } from '../src/hooks/useInAppUpdate';
import { useTheme } from '../src/theme/ThemeProvider';

/**
 * Shown when Play reports a newer build (see `useUpdateCheck`). "Update now"
 * runs the flexible download in-place and installs it — the user never leaves
 * for the Play Store listing.
 */
export default function AppUpdateScreen() {
  const { colors, brand, radius, spacing, typography } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { current } = useLocalSearchParams<{ current?: string }>();
  const { downloadProgress, installStatus, isUpdating, handleUpdate } = useAppUpdateFlow();

  const version = current || currentVersionName();

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
            colors={[brand.violetBright, brand.violet]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.badge, { borderRadius: radius.pill, shadowColor: brand.violet }]}
          >
            <Ionicons name="cloud-download-outline" size={60} color="#FFFFFF" />
          </LinearGradient>

          <Text style={[typography.title, styles.title, { color: colors.text }]}>
            Update available
          </Text>
          <Text style={[typography.body, styles.subtitle, { color: colors.textSecondary }]}>
            A new version of Payhankey is ready. Update now to get the latest
            features and fixes.
          </Text>

          {version ? (
            <View
              style={[
                styles.versionPill,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderRadius: radius.pill,
                },
              ]}
            >
              <Text style={[typography.caption, { color: colors.textMuted }]}>
                You're on version {version}
              </Text>
            </View>
          ) : null}

          {isUpdating ? (
            <View style={styles.progress}>
              <View style={[styles.track, { backgroundColor: colors.surfaceAlt }]}>
                <LinearGradient
                  colors={[brand.violet, brand.violetBright]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.fill, { width: `${downloadProgress}%` }]}
                />
              </View>
              <Text style={[typography.caption, styles.status, { color: colors.textSecondary }]}>
                {downloadProgress > 0 ? `${downloadProgress}% · ` : ''}
                {installStatus || 'Working…'}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.actions}>
          <GradientButton
            label={isUpdating ? 'Updating…' : 'Update now'}
            icon="cloud-download-outline"
            onPress={() => void handleUpdate()}
            loading={isUpdating}
            style={styles.cta}
          />
          {/* Flexible updates are optional by design — trapping the user on this
              screen is neither required by Play nor kind. */}
          {isUpdating ? (
            <View style={styles.pending}>
              <ActivityIndicator color={colors.brand} />
              <Text style={[typography.caption, { color: colors.textMuted }]}>
                Keep this screen open until the download finishes.
              </Text>
            </View>
          ) : (
            <GhostButton label="Not now" onPress={() => router.back()} style={styles.cta} />
          )}
        </View>
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
  versionPill: {
    marginTop: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  progress: {
    width: '100%',
    marginTop: 32,
    alignItems: 'center',
  },
  track: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
  },
  status: {
    marginTop: 10,
    textAlign: 'center',
  },
  actions: {
    gap: 12,
  },
  cta: {
    width: '100%',
  },
  pending: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
});
