import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import React, { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { canUseFullScreenIntent, openFullScreenIntentSettings } from '../../../modules/call-lock-screen';
import { loadNotifyKit } from '../../calls/callNotifications';
import { useTheme } from '../../theme/ThemeProvider';
import { FONT } from '../../theme/fonts';

type Problem = 'notifications' | 'fullScreen';

/**
 * "Make sure calls ring" — shown on the Calls screen (Android) only while
 * something would stop a call ringing when the app is closed:
 *
 * - notifications are off (the ringing *is* a notification), or
 * - Android 14+ has withheld full-screen-intent access, so a call can't take
 *   over the lock screen (it still rings as a heads-up notification).
 *
 * Each row goes straight to the setting that fixes it, and the card re-checks
 * when the user comes back to the app.
 */
export function CallRingingSetupCard() {
  const { colors, radius } = useTheme();
  const [problems, setProblems] = useState<Problem[]>([]);

  const check = useCallback(async () => {
    if (Platform.OS !== 'android') return;
    const found: Problem[] = [];
    try {
      const permission = await Notifications.getPermissionsAsync();
      if (!permission.granted) found.push('notifications');
    } catch {
      // Unknown — say nothing.
    }
    if (!canUseFullScreenIntent()) found.push('fullScreen');
    setProblems(found);
  }, []);

  useEffect(() => {
    void check();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void check();
    });
    return () => sub.remove();
  }, [check]);

  if (!problems.length) return null;

  const fixNotifications = async () => {
    const result = await Notifications.requestPermissionsAsync().catch(() => null);
    if (!result?.granted) void Linking.openSettings();
    void check();
  };

  const openBattery = () => {
    void loadNotifyKit()?.default.openBatteryOptimizationSettings?.();
  };

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: `${colors.gold}80`, borderRadius: radius.md },
      ]}
    >
      <View style={styles.titleRow}>
        <Ionicons name="notifications-off-outline" size={18} color={colors.gold} />
        <Text style={[styles.title, { color: colors.text }]}>Calls may not ring when Payhankey is closed</Text>
      </View>
      {problems.includes('notifications') ? (
        <SetupRow
          text="Notifications are off. Incoming calls ring as a notification."
          action="Turn on"
          onPress={() => void fixNotifications()}
        />
      ) : null}
      {problems.includes('fullScreen') ? (
        <SetupRow
          text="Allow full-screen calls so a call can light up your lock screen."
          action="Allow"
          onPress={openFullScreenIntentSettings}
        />
      ) : null}
      <SetupRow
        text="On some phones (Tecno, Infinix, Xiaomi…) also allow Payhankey to run in the background."
        action="Settings"
        onPress={openBattery}
      />
    </View>
  );
}

function SetupRow({ text, action, onPress }: { text: string; action: string; onPress: () => void }) {
  const { colors, radius } = useTheme();
  return (
    <View style={styles.row}>
      <Text style={[styles.rowText, { color: colors.textSecondary }]}>{text}</Text>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: colors.brand, borderRadius: radius.pill, opacity: pressed ? 0.8 : 1 },
        ]}
      >
        <Text style={[styles.buttonText, { color: colors.onBrand }]}>{action}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14, gap: 10, borderWidth: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, fontFamily: FONT, fontSize: 14, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowText: { flex: 1, fontFamily: FONT, fontSize: 13, lineHeight: 18, fontWeight: '500' },
  button: { paddingHorizontal: 14, height: 32, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontFamily: FONT, fontSize: 12, fontWeight: '800' },
});
