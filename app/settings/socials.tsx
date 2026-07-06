import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BackButton } from '../../src/components/ui/BackButton';
import { FieldLabel } from '../../src/components/ui/FieldLabel';
import { GradientButton } from '../../src/components/ui/GradientButton';
import { KeyboardAwareScreen } from '../../src/components/ui/KeyboardAwareScreen';
import { TextField } from '../../src/components/ui/TextField';
import { useTheme } from '../../src/theme/ThemeProvider';

type Network = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  placeholder: string;
};

const NETWORKS: Network[] = [
  { key: 'facebook', label: 'Facebook', icon: 'logo-facebook', placeholder: 'facebook.com/username' },
  { key: 'tiktok', label: 'TikTok', icon: 'logo-tiktok', placeholder: '@username' },
  { key: 'instagram', label: 'Instagram', icon: 'logo-instagram', placeholder: '@username' },
  { key: 'x', label: 'X (Twitter)', icon: 'logo-twitter', placeholder: '@username' },
  { key: 'linkedin', label: 'LinkedIn', icon: 'logo-linkedin', placeholder: 'linkedin.com/in/username' },
  { key: 'pinterest', label: 'Pinterest', icon: 'logo-pinterest', placeholder: '@username' },
];

/** Social profiles — link handles across networks (web Settings "Socials" tab). */
export default function SocialsScreen() {
  const { colors, spacing } = useTheme();
  const router = useRouter();

  const [handles, setHandles] = useState<Record<string, string>>({});

  const setHandle = (key: string, value: string) =>
    setHandles((prev) => ({ ...prev, [key]: value }));

  return (
    <KeyboardAwareScreen>
      <View style={styles.headerRow}>
        <BackButton onPress={() => router.back()} />
        <Text style={[styles.headerTitle, { color: colors.text }]}>Social profiles</Text>
        <View style={{ width: 44 }} />
      </View>

      <Text style={[styles.lede, { color: colors.textSecondary }]}>
        Link your handles so the community can find you everywhere you post.
      </Text>

      <View style={[styles.form, { gap: spacing.lg }]}>
        {NETWORKS.map((network) => (
          <View key={network.key} style={styles.field}>
            <FieldLabel>{network.label}</FieldLabel>
            <TextField
              icon={network.icon}
              placeholder={network.placeholder}
              value={handles[network.key] ?? ''}
              onChangeText={(v) => setHandle(network.key, v)}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
            />
          </View>
        ))}
      </View>

      <GradientButton label="Save socials" icon="checkmark" onPress={() => router.back()} />
    </KeyboardAwareScreen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  lede: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '500',
    marginBottom: 24,
  },
  form: {
    marginBottom: 24,
  },
  field: { gap: 8 },
});
