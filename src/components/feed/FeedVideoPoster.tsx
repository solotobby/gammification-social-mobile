import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../theme/ThemeProvider';
import type { MediaItem } from '../../data/media';
import { FONT } from '../../theme/fonts';

/**
 * Aspect-ratio bounds. Portrait stops at 4:5 rather than the source's 9:16 — a
 * full-bleed 9:16 frame is taller than the post and pushes the actions off
 * screen. `contentFit="contain"` letterboxes the rest, so nothing is cropped.
 */
const MIN_RATIO = 0.8;
const MAX_RATIO = 1.91;
/** Hard ceiling for tall screens when the poster isn't running full-bleed. */
const MAX_HEIGHT = 460;

function formatDuration(seconds: number): string {
  const whole = Math.round(seconds);
  const mins = Math.floor(whole / 60);
  return `${mins}:${String(whole % 60).padStart(2, '0')}`;
}

/**
 * A video post in the feed: its thumbnail and a play button, and nothing else.
 *
 * **Playback lives in Rolls now.** The feed never mounts a player — tapping
 * hands off to the full-screen pager, which is the surface built for watching
 * (immersive, autoplay, watch telemetry, the action rail). That keeps a
 * scrolling feed from holding a decoder per visible post, and means a video is
 * watched in one place instead of two half-players.
 *
 * The thumbnail is the backend's own `media.thumbnail_url` (renamed from
 * `poster_url`, and present on every post endpoint), so nothing is generated
 * client-side. A post still transcoding has no thumbnail yet and falls through
 * to the placeholder tint rather than handing expo-image an undefined uri.
 */
export function FeedVideoPoster({
  item,
  onPress,
  fullBleed,
}: {
  item: MediaItem;
  onPress: () => void;
  /** Feed default: run the full width of the screen, square corners. */
  fullBleed?: boolean;
}) {
  const { radius } = useTheme();

  const ratio =
    item.width && item.height
      ? Math.min(MAX_RATIO, Math.max(MIN_RATIO, item.width / item.height))
      : 16 / 9;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Play video in Rolls"
      style={({ pressed }) => [
        styles.frame,
        { aspectRatio: ratio },
        fullBleed ? null : { maxHeight: MAX_HEIGHT, borderRadius: radius.md },
        { opacity: pressed ? 0.9 : 1 },
      ]}
    >
      {item.poster ? (
        <Image
          source={{ uri: item.poster }}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
          transition={150}
        />
      ) : null}

      {/* Scrim under the play button only — a plain white glyph disappears on a
          bright frame, and darkening the whole poster would dull the thumbnail
          the backend went to the trouble of generating. */}
      <View style={styles.center} pointerEvents="none">
        <View style={styles.playBadge}>
          <Ionicons name="play" size={28} color="#FFFFFF" style={{ marginLeft: 3 }} />
        </View>
      </View>

      {item.duration ? (
        <View style={styles.durationPill} pointerEvents="none">
          <Text style={styles.pillText}>{formatDuration(item.duration)}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  frame: { width: '100%', alignSelf: 'center', overflow: 'hidden', backgroundColor: '#000000' },
  center: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBadge: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.85)',
  },
  durationPill: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 999,
  },
  pillText: { fontFamily: FONT, color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
});
