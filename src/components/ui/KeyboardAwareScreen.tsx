import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../../theme/ThemeProvider';
import { ScreenBackground } from './ScreenBackground';

type Props = {
  children: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
};

/**
 * Screen scaffold: ambient backdrop + safe-area + a keyboard-avoiding scroll
 * container. Inputs stay visible above the keyboard and taps pass through to
 * controls while the keyboard is open.
 */
export function KeyboardAwareScreen({ children, contentStyle }: Props) {
  const insets = useSafeAreaInsets();
  const { spacing } = useTheme();

  return (
    <View style={styles.root}>
      <ScreenBackground />
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          contentContainerStyle={[
            {
              flexGrow: 1,
              paddingTop: insets.top + spacing.md,
              paddingBottom: insets.bottom + spacing.xxl,
              paddingHorizontal: spacing.xl,
            },
            contentStyle,
          ]}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
