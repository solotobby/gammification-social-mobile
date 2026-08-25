import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { BackButton } from '../../src/components/ui/BackButton';
import { FieldLabel } from '../../src/components/ui/FieldLabel';
import { GhostButton } from '../../src/components/ui/GhostButton';
import { GradientButton } from '../../src/components/ui/GradientButton';
import { KeyboardAwareScreen } from '../../src/components/ui/KeyboardAwareScreen';
import { TextField } from '../../src/components/ui/TextField';
import { useSocials, useUpdateSocials } from '../../src/hooks/useAccount';
import { useTheme } from '../../src/theme/ThemeProvider';
import type { Socials } from '../../src/api/types';
import { FONT } from '../../src/theme/fonts';

type NetworkKey = 'facebook' | 'instagram' | 'x' | 'linkedin' | 'pinterest';

type Network = {
  key: NetworkKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  placeholder: string;
};

/**
 * The five networks PUT /user/socials accepts. TikTok is deliberately absent —
 * it isn't in the documented payload, and a field that silently never saves is
 * worse than no field. Add it back the moment the backend supports it.
 */
const NETWORKS: Network[] = [
  { key: 'facebook', label: 'Facebook', icon: 'logo-facebook', placeholder: 'facebook.com/username' },
  { key: 'instagram', label: 'Instagram', icon: 'logo-instagram', placeholder: 'instagram.com/username' },
  { key: 'x', label: 'X (Twitter)', icon: 'logo-twitter', placeholder: 'x.com/username' },
  { key: 'linkedin', label: 'LinkedIn', icon: 'logo-linkedin', placeholder: 'linkedin.com/in/username' },
  { key: 'pinterest', label: 'Pinterest', icon: 'logo-pinterest', placeholder: 'username' },
];

/**
 * Social profiles — GET/PUT /user/socials (web Settings "Socials" tab).
 */
export default function SocialsScreen() {
  const { colors, spacing } = useTheme();
  const router = useRouter();

  const socials = useSocials();
  const update = useUpdateSocials();
  const [handles, setHandles] = useState<Record<string, string>>({});

  // Seed once the saved handles land; an edit then takes over.
  useEffect(() => {
    if (!socials.data) return;
    const seeded: Record<string, string> = {};
    for (const network of NETWORKS) {
      seeded[network.key] = socials.data[network.key] ?? '';
    }
    setHandles(seeded);
  }, [socials.data]);

  const setHandle = (key: string, value: string) =>
    setHandles((prev) => ({ ...prev, [key]: value }));

  const save = () => {
    if (update.isPending) return;
    // Send every field, blanks included — clearing one has to reach the server.
    const payload: Socials = {};
    for (const network of NETWORKS) {
      payload[network.key] = handles[network.key]?.trim() ?? '';
    }
    update.mutate(payload, { onSuccess: () => router.back() });
  };

  if (socials.isLoading) {
    return (
      <KeyboardAwareScreen contentStyle={styles.center}>
        <ActivityIndicator color={colors.brand} />
      </KeyboardAwareScreen>
    );
  }

  if (socials.isError) {
    return (
      <KeyboardAwareScreen contentStyle={styles.center}>
        <Text style={[styles.lede, { color: colors.textMuted, textAlign: 'center' }]}>
          We couldn't load your social profiles.
        </Text>
        <GhostButton label="Retry" onPress={() => void socials.refetch()} />
      </KeyboardAwareScreen>
    );
  }

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

      <GradientButton
        label="Save socials"
        icon="checkmark"
        loading={update.isPending}
        onPress={save}
      />
    </KeyboardAwareScreen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', gap: 14 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  headerTitle: { fontFamily: FONT, fontSize: 18, fontWeight: '800' },
  lede: {
    fontFamily: FONT,
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
