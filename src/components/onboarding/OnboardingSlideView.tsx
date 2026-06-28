import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import {
  Animated,
  Image,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import type { OnboardingSlide } from '../../data/onboarding';
import { useTheme } from '../../theme/ThemeProvider';

type Props = {
  slide: OnboardingSlide;
  index: number;
  scrollX: Animated.Value;
};

/**
 * A single onboarding page: a generated "hero" illustration (gradient squircle
 * with floating fintech chips) above a title + description block. Decorative
 * layers parallax as the user swipes for a modern, layered feel.
 */
export function OnboardingSlideView({ slide, index, scrollX }: Props) {
  const { colors, radius, spacing, typography, isDark } = useTheme();
  const { width } = useWindowDimensions();

  const inputRange = [
    (index - 1) * width,
    index * width,
    (index + 1) * width,
  ];

  // Hero scales/fades slightly as it leaves the viewport.
  const heroScale = scrollX.interpolate({
    inputRange,
    outputRange: [0.82, 1, 0.82],
    extrapolate: 'clamp',
  });
  const heroOpacity = scrollX.interpolate({
    inputRange,
    outputRange: [0.3, 1, 0.3],
    extrapolate: 'clamp',
  });

  // Floating chips drift at different rates for depth.
  const chipADrift = scrollX.interpolate({
    inputRange,
    outputRange: [40, 0, -40],
    extrapolate: 'clamp',
  });
  const chipBDrift = scrollX.interpolate({
    inputRange,
    outputRange: [-30, 0, 30],
    extrapolate: 'clamp',
  });

  // Text rises and fades in as the page settles.
  const textTranslate = scrollX.interpolate({
    inputRange,
    outputRange: [40, 0, 40],
    extrapolate: 'clamp',
  });
  const textOpacity = scrollX.interpolate({
    inputRange,
    outputRange: [0, 1, 0],
    extrapolate: 'clamp',
  });

  return (
    <View style={[styles.page, { width, paddingHorizontal: spacing.xl }]}>
      {/* ---- Hero illustration ---- */}
      <View style={styles.heroArea}>
        {/* soft ambient glow */}
        <View
          style={[
            styles.glow,
            { backgroundColor: slide.gradient[0], opacity: isDark ? 0.28 : 0.22 },
          ]}
        />

        <Animated.View
          style={{
            transform: [{ scale: heroScale }],
            opacity: heroOpacity,
          }}
        >
          <LinearGradient
            colors={slide.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              styles.heroCard,
              {
                borderRadius: radius.xl + 8,
                shadowColor: slide.gradient[1],
              },
            ]}
          >
            {slide.image ? (
              <Image
                source={slide.image}
                resizeMode="cover"
                style={styles.heroImage}
              />
            ) : (
              <Ionicons name={slide.icon} size={104} color="rgba(255,255,255,0.96)" />
            )}

            {/* decorative inner ring */}
            <View style={styles.innerRing} />
          </LinearGradient>
        </Animated.View>

        {/* Floating chip — incoming money */}
        <Animated.View
          style={[
            styles.chip,
            styles.chipTopLeft,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              shadowColor: colors.shadow,
              transform: [{ translateX: chipADrift }],
            },
          ]}
        >
          <View
            style={[styles.chipDot, { backgroundColor: colors.mint }]}
          >
            <Ionicons name="arrow-down" size={14} color={colors.onBrand} />
          </View>
          <View>
            <Text style={[styles.chipLabel, { color: colors.textMuted }]}>
              Received
            </Text>
            <Text style={[styles.chipValue, { color: colors.text }]}>
              + $2,500
            </Text>
          </View>
        </Animated.View>

        {/* Floating chip — payment sent */}
        <Animated.View
          style={[
            styles.chip,
            styles.chipBottomRight,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              shadowColor: colors.shadow,
              transform: [{ translateX: chipBDrift }],
            },
          ]}
        >
          <View
            style={[styles.chipDot, { backgroundColor: slide.accent }]}
          >
            <Ionicons name="checkmark" size={14} color={colors.onBrand} />
          </View>
          <View>
            <Text style={[styles.chipLabel, { color: colors.textMuted }]}>
              Payment
            </Text>
            <Text style={[styles.chipValue, { color: colors.text }]}>
              Sent
            </Text>
          </View>
        </Animated.View>
      </View>

      {/* ---- Text block ---- */}
      <Animated.View
        style={[
          styles.textBlock,
          { opacity: textOpacity, transform: [{ translateY: textTranslate }] },
        ]}
      >
        <Text
          style={[
            styles.overline,
            typography.overline,
            { color: colors.brand, letterSpacing: 1.5 },
          ]}
        >
          {slide.overline}
        </Text>
        <Text style={[typography.title, styles.title, { color: colors.text }]}>
          {slide.title}
        </Text>
        <Text
          style={[
            typography.body,
            styles.description,
            { color: colors.textSecondary },
          ]}
        >
          {slide.description}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroArea: {
    width: '100%',
    height: 320,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  glow: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
  },
  heroCard: {
    width: 230,
    height: 230,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.45,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 18 },
    elevation: 16,
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  innerRing: {
    position: 'absolute',
    width: 196,
    height: 196,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.18)',
    pointerEvents: 'none',
  },
  chip: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  chipTopLeft: {
    top: 18,
    left: 0,
  },
  chipBottomRight: {
    bottom: 22,
    right: 0,
  },
  chipDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chipValue: {
    fontSize: 14,
    fontWeight: '800',
  },
  textBlock: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  overline: {
    marginBottom: 12,
  },
  title: {
    textAlign: 'center',
    marginBottom: 14,
  },
  description: {
    textAlign: 'center',
    maxWidth: 320,
  },
});
