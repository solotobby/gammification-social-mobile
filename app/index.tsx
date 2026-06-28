import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ViewToken,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Paginator } from '../src/components/onboarding/Paginator';
import { OnboardingSlideView } from '../src/components/onboarding/OnboardingSlideView';
import { GradientButton } from '../src/components/ui/GradientButton';
import { Logo } from '../src/components/ui/Logo';
import { onboardingSlides } from '../src/data/onboarding';
import { useTheme } from '../src/theme/ThemeProvider';

export default function WelcomeScreen() {
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const scrollX = useRef(new Animated.Value(0)).current;
  const listRef = useRef<Animated.FlatList<(typeof onboardingSlides)[number]>>(null);
  const [index, setIndex] = useState(0);

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

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Ambient gradient wash behind everything */}
      <LinearGradient
        colors={[colors.backgroundElevated, colors.background]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.6 }}
        style={StyleSheet.absoluteFill}
      />

      {/* ---- Header ---- */}
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.xl },
        ]}
      >
        <Logo width={150} />

        {!isLast && (
          <Pressable
            hitSlop={12}
            onPress={() => router.push('/sign-up')}
            accessibilityRole="button"
            accessibilityLabel="Skip onboarding"
          >
            <Text style={[styles.skip, { color: colors.textMuted }]}>Skip</Text>
          </Pressable>
        )}
      </View>

      {/* ---- Carousel ---- */}
      <Animated.FlatList
        ref={listRef}
        data={onboardingSlides}
        keyExtractor={(item) => item.key}
        renderItem={({ item, index: i }) => (
          <OnboardingSlideView slide={item} index={i} scrollX={scrollX} />
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
        style={styles.list}
      />

      {/* ---- Footer ---- */}
      <View
        style={[
          styles.footer,
          {
            paddingBottom: insets.bottom + spacing.lg,
            paddingHorizontal: spacing.xl,
          },
        ]}
      >
        <Paginator count={onboardingSlides.length} scrollX={scrollX} />

        <GradientButton
          label={isLast ? 'Get Started' : 'Continue'}
          icon={isLast ? 'checkmark' : 'arrow-forward'}
          onPress={goNext}
          style={styles.cta}
        />

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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
  },
  skip: {
    fontSize: 15,
    fontWeight: '700',
  },
  list: {
    flex: 1,
  },
  footer: {
    alignItems: 'center',
    gap: 22,
    paddingTop: 8,
  },
  cta: {
    width: '100%',
  },
  signIn: {
    fontSize: 14,
    fontWeight: '500',
  },
});
