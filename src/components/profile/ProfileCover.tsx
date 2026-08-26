import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { DEFAULT_COVER } from '../../data/media';

/**
 * The banner at the top of a profile — one shared default image across the Me
 * tab and the profile screen, so the two read as the same account rather than
 * two different-looking places.
 *
 * The image **fades into whatever sits below it** rather than ending on a hard
 * edge: a gradient from transparent to `fadeTo` covers the lower half, so the
 * photo dissolves into the card body the avatar overlaps. Pass the exact
 * colour of the surface underneath (`colors.surface`) — the fade is only
 * convincing if the last stop matches it.
 */
export function ProfileCover({
  uri = DEFAULT_COVER,
  height = 140,
  fadeTo,
}: {
  uri?: string;
  height?: number;
  /** Six-digit hex of the surface below; the gradient resolves to it. */
  fadeTo: string;
}) {
  return (
    <View style={[styles.root, { height }]} pointerEvents="none">
      <Image
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={150}
      />
      <LinearGradient
        // Alpha-suffixed hex of the same colour, so the fade never drifts
        // toward a different hue on its way down.
        colors={[`${fadeTo}00`, `${fadeTo}59`, `${fadeTo}D9`, fadeTo]}
        locations={[0, 0.45, 0.8, 1]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: '100%', overflow: 'hidden' },
});
