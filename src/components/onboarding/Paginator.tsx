import React from 'react';
import { Animated, StyleSheet, useWindowDimensions, View } from 'react-native';

import { useTheme } from '../../theme/ThemeProvider';

type Props = {
  count: number;
  scrollX: Animated.Value;
};

/** Animated pagination dots — the active dot stretches into a pill. */
export function Paginator({ count, scrollX }: Props) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();

  return (
    <View style={styles.row}>
      {Array.from({ length: count }).map((_, i) => {
        const inputRange = [(i - 1) * width, i * width, (i + 1) * width];

        const dotWidth = scrollX.interpolate({
          inputRange,
          outputRange: [8, 26, 8],
          extrapolate: 'clamp',
        });
        const opacity = scrollX.interpolate({
          inputRange,
          outputRange: [0.5, 1, 0.5],
          extrapolate: 'clamp',
        });
        const backgroundColor = scrollX.interpolate({
          inputRange,
          outputRange: [colors.dotInactive, colors.brand, colors.dotInactive],
          extrapolate: 'clamp',
        });

        return (
          <Animated.View
            key={i}
            style={[styles.dot, { width: dotWidth, opacity, backgroundColor }]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
});
