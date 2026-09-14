import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import type { OnboardingSlide } from '../../data/onboarding';
import { SlideVisual, VISUAL_HEIGHT } from './SlideVisual';
import { useTheme } from '../../theme/ThemeProvider';
import { FONT, FONT_WEIGHTS } from '../../theme/fonts';

type Props = {
  slide: OnboardingSlide;
  index: number;
  scrollX: Animated.Value;
};

/**
 * One onboarding page: a vignette of the app on top, the slide's copy under it.
 *
 * Stacked rather than side-by-side on purpose. The copy is the thing being read
 * and it gets the full width, which is what keeps a three-line headline from
 * wrapping mid-phrase on a small phone; the illustration sits above it and
 * shrinks (rather than reflowing) when there isn't room.
 */
export function OnboardingSlideView({ slide, index, scrollX }: Props) {
  const { colors, spacing, brand } = useTheme();
  const { width, height } = useWindowDimensions();

  const inputRange = [(index - 1) * width, index * width, (index + 1) * width];

  // The visual drifts slower than the page it sits on, for depth; the copy
  // leaves faster and fades, so two headlines are never legible at once.
  const visualDrift = scrollX.interpolate({
    inputRange,
    outputRange: [width * 0.18, 0, -width * 0.18],
    extrapolate: 'clamp',
  });
  const visualScale = scrollX.interpolate({
    inputRange,
    outputRange: [0.9, 1, 0.9],
    extrapolate: 'clamp',
  });
  const copyDrift = scrollX.interpolate({
    inputRange,
    outputRange: [width * 0.32, 0, -width * 0.32],
    extrapolate: 'clamp',
  });
  const copyOpacity = scrollX.interpolate({
    inputRange,
    outputRange: [0, 1, 0],
    extrapolate: 'clamp',
  });

  // Small phones get the same layout at a smaller stage rather than a different
  // one — the vignettes are compositions, so reflowing them breaks them.
  const visualScaleFactor = Math.min(1, Math.max(0.78, (height - 560) / VISUAL_HEIGHT));

  const titleSize = Math.min(30, width * 0.076);
  const bodySize = Math.min(15, width * 0.038);

  const tones = {
    brand: brand.violet,
    mint: brand.mint,
    gold: brand.gold,
    pink: brand.pink,
  } as const;

  return (
    <View style={[styles.page, { width, paddingHorizontal: spacing.xl }]}>
      <Animated.View
        style={[
          styles.visual,
          { transform: [{ translateX: visualDrift }, { scale: visualScale }] },
        ]}
      >
        <SlideVisual visual={slide.visual} scale={visualScaleFactor} />
      </Animated.View>

      <Animated.View
        style={[
          styles.copy,
          { opacity: copyOpacity, transform: [{ translateX: copyDrift }] },
        ]}
      >
        <View style={[styles.rule, { backgroundColor: colors.brand }]} />

        <Text style={[styles.overline, { color: colors.textMuted }]}>
          {slide.overline.toUpperCase()}
        </Text>

        <Text
          style={[
            styles.title,
            { color: colors.text, fontSize: titleSize, lineHeight: titleSize * 1.22 },
          ]}
        >
          {slide.title.map((segment, i) => (
            <Text key={i} style={segment.accent ? { color: colors.brand } : undefined}>
              {segment.text}
            </Text>
          ))}
        </Text>

        <Text
          style={[
            styles.description,
            {
              color: colors.textSecondary,
              fontSize: bodySize,
              lineHeight: bodySize * 1.55,
            },
          ]}
        >
          {slide.description}
        </Text>

        <View style={styles.highlights}>
          {slide.highlights.map((highlight) => {
            const tone = tones[highlight.tone];
            return (
              <View
                key={highlight.label}
                style={[
                  styles.highlight,
                  { backgroundColor: `${tone}14`, borderColor: `${tone}2E` },
                ]}
              >
                <Ionicons name={highlight.icon} size={12} color={tone} />
                <Text style={[styles.highlightLabel, { color: colors.textSecondary }]}>
                  {highlight.label}
                </Text>
              </View>
            );
          })}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    justifyContent: 'center',
    gap: 28,
  },
  visual: {
    alignItems: 'center',
  },
  copy: {
    alignItems: 'flex-start',
  },
  rule: {
    width: 30,
    height: 3,
    borderRadius: 2,
    marginBottom: 14,
  },
  overline: {
    fontFamily: FONT,
    fontSize: 10.5,
    lineHeight: 15,
    fontWeight: '700',
    letterSpacing: 1.3,
    marginBottom: 10,
  },
  title: {
    fontFamily: FONT_WEIGHTS.extrabold,
    letterSpacing: -0.8,
    marginBottom: 14,
  },
  description: {
    fontFamily: FONT,
    fontWeight: '400',
  },
  highlights: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 18,
  },
  highlight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  highlightLabel: {
    fontFamily: FONT,
    fontSize: 12,
    fontWeight: '600',
  },
});
