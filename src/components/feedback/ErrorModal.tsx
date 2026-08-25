import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { useFeedbackStore } from '../../stores/feedbackStore';
import { useTheme } from '../../theme/ThemeProvider';
import { GradientButton } from '../ui/GradientButton';
import { FONT } from '../../theme/fonts';

/**
 * Blocking dialog for hard failures (no connection, server errors) — renders
 * the feedback store's `errorModal`. Mounted once in app/_layout.tsx.
 */
export function ErrorModalHost() {
  const { colors, radius, typography } = useTheme();
  const errorModal = useFeedbackStore((s) => s.errorModal);
  const hideErrorModal = useFeedbackStore((s) => s.hideErrorModal);

  return (
    <Modal
      visible={errorModal !== null}
      transparent
      animationType="fade"
      onRequestClose={hideErrorModal}
    >
      <Pressable
        style={[styles.backdrop, { backgroundColor: colors.overlay }]}
        onPress={hideErrorModal}
        accessibilityLabel="Dismiss error"
      >
        {/* Stop backdrop-press from bubbling when tapping the card itself. */}
        <Pressable
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: radius.xl,
              shadowColor: colors.shadow,
            },
          ]}
          onPress={() => {}}
        >
          <View style={[styles.badge, { backgroundColor: `${colors.danger}22` }]}>
            <Ionicons name="cloud-offline-outline" size={30} color={colors.danger} />
          </View>

          <Text style={[typography.title, styles.title, { color: colors.text }]}>
            {errorModal?.title}
          </Text>
          <Text style={[typography.body, styles.message, { color: colors.textSecondary }]}>
            {errorModal?.message}
          </Text>

          <GradientButton
            label="Got it"
            icon="checkmark"
            onPress={hideErrorModal}
            style={styles.cta}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    paddingVertical: 30,
    paddingHorizontal: 24,
    borderWidth: 1,
    shadowOpacity: 0.35,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 16 },
    elevation: 16,
  },
  badge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  title: {
    fontFamily: FONT,
    fontSize: 22,
    textAlign: 'center',
  },
  message: {
    marginTop: 10,
    textAlign: 'center',
  },
  cta: {
    alignSelf: 'stretch',
    marginTop: 24,
  },
});
