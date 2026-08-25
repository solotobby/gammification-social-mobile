import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '../../theme/ThemeProvider';

type Props = {
  label: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
  /** Shows a spinner and blocks presses while an async action runs. */
  loading?: boolean;
  disabled?: boolean;
};

/** Primary CTA — a brand-gradient pill with a press-scale animation. */
export function GradientButton({
  label,
  onPress,
  icon = 'arrow-forward',
  style,
  loading,
  disabled,
}: Props) {
  const { colors, brand, radius, typography } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;
  const blocked = loading || disabled;

  const animateTo = (to: number) =>
    Animated.spring(scale, {
      toValue: to,
      useNativeDriver: true,
      speed: 40,
      bounciness: 6,
    }).start();

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        onPress={blocked ? undefined : onPress}
        onPressIn={blocked ? undefined : () => animateTo(0.96)}
        onPressOut={blocked ? undefined : () => animateTo(1)}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: !!blocked, busy: !!loading }}
      >
        {/* Deep -> bright, matching the web's
            `linear-gradient(135deg, var(--ph-violet), var(--ph-violet-bright))`
            on .ph-post-btn. */}
        <LinearGradient
          colors={[brand.violet, brand.violetBright]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.button,
            { borderRadius: radius.pill, shadowColor: brand.violet },
            blocked && styles.blocked,
          ]}
        >
          {loading ? (
            <ActivityIndicator color={colors.onBrand} />
          ) : (
            <>
              <Text style={[typography.button, { color: colors.onBrand }]}>{label}</Text>
              {icon ? (
                <View style={styles.iconWrap}>
                  <Ionicons name={icon} size={18} color={colors.onBrand} />
                </View>
              ) : null}
            </>
          )}
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 28,
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  iconWrap: {
    width: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blocked: {
    opacity: 0.6,
  },
});
