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
import { SlideFeatureCard } from './SlideFeatureCard';
import { useTheme } from '../../theme/ThemeProvider';
import { FONT, FONT_WEIGHTS } from '../../theme/fonts';

type Props = {
  slide: OnboardingSlide;
  index: number;
  scrollX: Animated.Value;
  /** Space to leave clear at the top (safe area + the logo row). */
  headerOffset: number;
  /** Space the footer occupies, so nothing runs under the CTA. */
  footerOffset: number;
  /**
   * Height of the carousel. A `flex: 1` page inside a *horizontal* FlatList
   * collapses to its own content height rather than stretching, so the measured
   * height is passed in.
   */
  pageHeight: number;
};

/**
 * Share of the screen width the artwork holds *opaquely*. The art sits beside
 * the copy rather than behind it, so this is also what's left over for the text
 * column — push it up and the headline starts wrapping mid-phrase.
 */
const HERO_WIDTH_RATIO = 0.46;

/**
 * Extra width, on top of the ratio above, over which the art's left edge fades
 * out into the page. It bleeds into the gutter rather than eating the text
 * column, so widening the fade never re-wraps a headline.
 */
const HERO_FADE_RATIO = 0.05;

/**
 * One onboarding page: copy in a left column, hero artwork as a panel bleeding
 * off the right edge.
 *
 * The artwork is a tall, narrow strip (aspect ~0.36), which is why it is fitted
 * into the band between the header and the footer at its own aspect rather than
 * run full-bleed. Full-bleed would force it to ~78% of the width — it would sit
 * *under* the copy, and the only way to keep text legible on top of a photo is
 * to wash the photo out. Cropping it narrower instead is not an option either:
 * every one of the four heroes loses something that matters (a face on the left,
 * the engagement chips on the right). Fitted, it stays uncropped and unfaded.
 */
export function OnboardingSlideView({
  slide,
  index,
  scrollX,
  headerOffset,
  footerOffset,
  pageHeight,
}: Props) {
  const { colors, spacing } = useTheme();
  const { width } = useWindowDimensions();

  const inputRange = [(index - 1) * width, index * width, (index + 1) * width];

  // The art drifts slower than the page it sits on, for depth.
  const heroDrift = scrollX.interpolate({
    inputRange,
    outputRange: [width * 0.16, 0, -width * 0.16],
    extrapolate: 'clamp',
  });
  const heroScale = scrollX.interpolate({
    inputRange,
    outputRange: [0.92, 1, 0.92],
    extrapolate: 'clamp',
  });

  // Copy leaves faster and fades, so two headlines are never legible at once.
  const textDrift = scrollX.interpolate({
    inputRange,
    outputRange: [width * 0.28, 0, -width * 0.28],
    extrapolate: 'clamp',
  });
  const textOpacity = scrollX.interpolate({
    inputRange,
    outputRange: [0, 1, 0],
    extrapolate: 'clamp',
  });

  // Flush to the top of the screen, running behind the logo row, and sized from
  // the width at the art's own aspect so it is never cropped. Capped so it can
  // never reach the footer.
  const heroSolid = width * HERO_WIDTH_RATIO;
  const heroFade = width * HERO_FADE_RATIO;
  const heroWidth = heroSolid + heroFade;
  const heroHeight = Math.min(
    heroWidth / slide.aspect,
    Math.max(pageHeight - footerOffset, 0),
  );

  const titleSize = Math.min(27, width * 0.065);
  const bodySize = Math.min(14.5, width * 0.036);

  return (
    <View style={[styles.page, { width, height: pageHeight }]}>
      {/* ---- Hero artwork ---- */}
      <Animated.View
        style={[
          styles.hero,
          {
            width: heroWidth,
            height: heroHeight,
            transform: [{ translateX: heroDrift }, { scale: heroScale }],
          },
        ]}
      >
        <Image source={slide.image} resizeMode="cover" style={styles.heroImage} />
        {/* Softens the art's left edge into the page instead of ending on a
            hard vertical cut against the copy column. */}
        <LinearGradient
          colors={[colors.background, `${colors.background}00`]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={[styles.heroFadeLeft, { width: heroFade }]}
        />
        {/* Same treatment on the bottom edge: the art stops partway down the
            screen, and without this it ends on a hard horizontal cut in the gap
            above the card. */}
        <LinearGradient
          colors={[`${colors.background}00`, colors.background]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.heroFadeBottom}
        />
      </Animated.View>

      {/* ---- Copy ---- */}
      <Animated.View
        style={[
          styles.copy,
          {
            paddingTop: headerOffset + spacing.md,
            paddingBottom: footerOffset + spacing.md,
            paddingLeft: spacing.xl,
            // Clears the *opaque* part of the artwork. The fade is allowed to
            // bleed into the gutter — that is what makes the edge soft.
            paddingRight: heroSolid + spacing.md,
            opacity: textOpacity,
            transform: [{ translateX: textDrift }],
          },
        ]}
      >
        <View style={[styles.rule, { backgroundColor: colors.brand }]} />

        <Text style={[styles.overline, { color: colors.textMuted }]}>
          {slide.overline.toUpperCase()}
        </Text>

        <Text
          style={[
            styles.title,
            { color: colors.text, fontSize: titleSize, lineHeight: titleSize * 1.2 },
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
              lineHeight: bodySize * 1.5,
            },
          ]}
        >
          {slide.description}
        </Text>

        {/* Pushed to the foot of the column; it starts below the artwork, so it
            spans the full width rather than staying in the copy's gutter. */}
        <View
          style={[
            styles.cardSlot,
            // Cancels the copy's gutter so the card reaches the far margin: it
            // sits below the artwork, so it has the full width to work with.
            { marginRight: -(heroSolid - spacing.md) },
          ]}
        >
          <SlideFeatureCard card={slide.card} />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    overflow: 'hidden',
  },
  hero: {
    position: 'absolute',
    top: 0,
    right: 0,
    overflow: 'hidden',
  },
  heroFadeLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  heroFadeBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 64,
  },
  heroImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  copy: {
    flex: 1,
    justifyContent: 'flex-start',
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
    letterSpacing: -0.7,
    marginBottom: 16,
  },
  description: {
    fontFamily: FONT,
    fontWeight: '400',
  },
  cardSlot: {
    marginTop: 'auto',
    paddingTop: 24,
  },
});
