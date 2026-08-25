import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Modal, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../../theme/ThemeProvider';
import { CopyField } from '../ui/CopyField';
import { GradientButton } from '../ui/GradientButton';

/**
 * Bottom sheet for sharing a community link.
 *
 * The web version lists WhatsApp / X / Facebook / LinkedIn / Telegram as
 * separate tiles; on mobile that's the OS share sheet's job — it already knows
 * which apps are installed and respects the user's share extensions. So this
 * keeps the copyable link (the one thing the OS sheet doesn't surface well) and
 * hands everything else to `Share.share`.
 */
export function ShareSheet({
  visible,
  title,
  url,
  message,
  onClose,
}: {
  visible: boolean;
  title: string;
  url: string;
  /** Text that leads the share payload; falls back to the title. */
  message?: string;
  onClose: () => void;
}) {
  const { colors, radius, spacing } = useTheme();
  const insets = useSafeAreaInsets();

  const onShare = async () => {
    try {
      await Share.share({ message: `${message ?? title}\n${url}`, url });
    } finally {
      onClose();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={[styles.backdrop, { backgroundColor: colors.overlay }]}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close share sheet"
      />
      <View
        style={[
          styles.sheet,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            paddingBottom: insets.bottom + spacing.xl,
          },
        ]}
      >
        <View style={[styles.grabber, { backgroundColor: colors.border }]} />
        <View style={styles.titleRow}>
          <Ionicons name="share-social-outline" size={20} color={colors.brand} />
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            Share {title}
          </Text>
        </View>
        <Text style={[styles.lede, { color: colors.textMuted }]}>
          Invite people to join this community on Payhankey.
        </Text>

        <CopyField label="Public link" value={url} icon="link-outline" />

        <GradientButton label="Share via…" onPress={() => void onShare()} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1 },
  sheet: {
    paddingHorizontal: 24,
    paddingTop: 10,
    gap: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  grabber: {
    width: 42,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 8,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, fontSize: 18, fontWeight: '800' },
  lede: { fontSize: 13, fontWeight: '500', marginTop: -6 },
});
