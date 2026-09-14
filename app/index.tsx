import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
  type ViewToken,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Paginator } from '../src/components/onboarding/Paginator';
import { OnboardingSlideView } from '../src/components/onboarding/OnboardingSlideView';
import { GradientButton } from '../src/components/ui/GradientButton';
import { Logo } from '../src/components/ui/Logo';
import { ScreenBackground } from '../src/components/ui/ScreenBackground';
import { onboardingSlides } from '../src/data/onboarding';
import { useTheme } from '../src/theme/ThemeProvider';
import { FONT } from '../src/theme/fonts';

/**
 * Welcome / onboarding carousel.
 *
 * Each page is full-bleed artwork (see `OnboardingSlideView`), so the header and
 * footer are overlaid on the list rather than stacked around it — otherwise the
 * art would be boxed into the middle of the screen instead of running under the
 * chrome the way the design has it. Their measured heights are handed back down
 * so each slide knows how much room to leave its copy.
 */
export default function WelcomeScreen() {
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height: windowHeight } = useWindowDimensions();

  const scrollX = useRef(new Animated.Value(0)).current;
  const listRef = useRef<Animated.FlatList<(typeof onboardingSlides)[number]>>(null);
  const [index, setIndex] = useState(0);

  // Measured so the copy can clear them on any screen size.
  const [headerHeight, setHeaderHeight] = useState(insets.top + 56);
  const [footerHeight, setFooterHeight] = useState(200);
  // The carousel fills the root, but a horizontal FlatList won't stretch its
  // pages to that height on its own — measure it and hand it to each slide.
  const [pageHeight, setPageHeight] = useState(windowHeight);

  const lastIndex = onboardingSlides.length - 1;
  const isLast = index === lastIndex;

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems[0]?.index != null) {
        setIndex(viewableItems[0].index);
      }
    },
  ).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const goNext = useCallback(() => {
    if (index < lastIndex) {
      listRef.current?.scrollToIndex({ index: index + 1, animated: true });
    } else {
      router.push('/sign-up');
    }
  }, [index, lastIndex, router]);

  // The CTA wording is per-slide but the button doesn't scroll with the pages,
  // so cross-fade the label instead of letting it snap mid-swipe.
  const ctaFade = useRef(new Animated.Value(1)).current;
  const [ctaLabel, setCtaLabel] = useState(onboardingSlides[0].cta);

  useEffect(() => {
    const next = onboardingSlides[index].cta;
    if (next === ctaLabel) return;
    Animated.timing(ctaFade, {
      toValue: 0,
      duration: 110,
      useNativeDriver: true,
    }).start(() => {
      setCtaLabel(next);
      Animated.timing(ctaFade, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }).start();
    });
  }, [index, ctaLabel, ctaFade]);

  return (
    <View
      style={[styles.root, { backgroundColor: colors.background }]}
      onLayout={(e: LayoutChangeEvent) => setPageHeight(e.nativeEvent.layout.height)}
    >
      <ScreenBackground />

      <Animated.FlatList
        ref={listRef}
        data={onboardingSlides}
        keyExtractor={(item) => item.key}
        renderItem={({ item, index: i }) => (
          <OnboardingSlideView
            slide={item}
            index={i}
            scrollX={scrollX}
            headerOffset={headerHeight}
            footerOffset={footerHeight}
            pageHeight={pageHeight}
          />
        )}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false },
        )}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        style={StyleSheet.absoluteFill}
      />

      {/* ---- Header ---- */}
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.xl },
        ]}
        onLayout={(e: LayoutChangeEvent) =>
          setHeaderHeight(e.nativeEvent.layout.height)
        }
      >
        <Logo width={148} />

        {!isLast && (
          <Pressable
            hitSlop={12}
            onPress={() => router.push('/sign-up')}
            accessibilityRole="button"
            accessibilityLabel="Skip onboarding"
            style={[
              styles.skipPill,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                shadowColor: colors.shadow,
              },
            ]}
          >
            <Text style={[styles.skip, { color: colors.brand }]}>Skip</Text>
          </Pressable>
        )}
      </View>

      {/* ---- Footer ---- */}
      <View
        style={[
          styles.footer,
          {
            paddingBottom: insets.bottom + spacing.lg,
            paddingHorizontal: spacing.xl,
          },
        ]}
        onLayout={(e: LayoutChangeEvent) =>
          setFooterHeight(e.nativeEvent.layout.height)
        }
      >
        <Paginator count={onboardingSlides.length} scrollX={scrollX} />

        <Animated.View style={[styles.cta, { opacity: ctaFade }]}>
          <GradientButton label={ctaLabel} icon="arrow-forward" onPress={goNext} />
        </Animated.View>

        <Pressable
          hitSlop={8}
          onPress={() => router.push('/sign-in')}
          accessibilityRole="button"
          accessibilityLabel="Log in to existing account"
        >
          <Text style={[styles.signIn, { color: colors.textSecondary }]}>
            Already have an account?{' '}
            <Text style={{ color: colors.brand, fontWeight: '700' }}>Log in</Text>
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
  },
  skipPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    // The artwork runs under the header and its own white cards can sit right
    // behind this pill — the shadow is what keeps the two from merging.
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  skip: {
    fontFamily: FONT,
    fontSize: 14,
    fontWeight: '700',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    gap: 20,
    paddingTop: 8,
  },
  cta: {
    width: '100%',
  },
  signIn: {
    fontFamily: FONT,
    fontSize: 14,
    fontWeight: '500',
  },
});
