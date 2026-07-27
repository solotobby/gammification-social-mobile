import { Ionicons } from '@expo/vector-icons';
import { useEvent } from 'expo';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../theme/ThemeProvider';
import type { MediaItem } from '../../data/media';

/** Hard ceiling for tall screens, so a portrait clip can't eat the whole feed. */
const MAX_HEIGHT = 460;
/**
 * Aspect-ratio bounds. Portrait stops at 4:5 rather than the source's 9:16 —
 * a full-bleed 9:16 frame is taller than the card and pushes the actions off
 * screen. `contentFit="contain"` letterboxes the rest, so nothing is cropped.
 */
const MIN_RATIO = 0.8;
const MAX_RATIO = 1.91;

function formatDuration(seconds: number): string {
  const whole = Math.round(seconds);
  const mins = Math.floor(whole / 60);
  return `${mins}:${String(whole % 60).padStart(2, '0')}`;
}

/**
 * A post's video, played inline in the feed. The poster frame carries the card
 * until the user taps play — mounting a real player per feed row would have
 * every visible post holding a decoder. Starts muted (feed convention) with a
 * tap-to-unmute control, and falls back to the poster plus a readable message
 * when the source won't decode on this platform.
 */
export function FeedVideo({ item, onExpand }: { item: MediaItem; onExpand?: () => void }) {
  const { colors, radius } = useTheme();
  const [started, setStarted] = useState(false);

  const player = useVideoPlayer(item.uri, (p) => {
    p.loop = true;
    p.muted = true;
  });

  // `status` drives the failure state: an undecodable source (the backend's
  // VP9/WebM renditions, for one) never leaves 'error', so the poster stays up
  // instead of the card showing an empty black box.
  const { status, error } = useEvent(player, 'statusChange', { status: player.status });
  const { muted } = useEvent(player, 'mutedChange', { muted: player.muted });
  const failed = status === 'error';

  const ratio =
    item.width && item.height
      ? Math.min(MAX_RATIO, Math.max(MIN_RATIO, item.width / item.height))
      : 16 / 9;

  const onPlay = () => {
    if (failed) return;
    setStarted(true);
    player.play();
  };

  return (
    <View
      style={[
        styles.frame,
        { aspectRatio: ratio, maxHeight: MAX_HEIGHT, borderRadius: radius.md },
      ]}
    >
      {/* Poster sits under the player so there's never a blank frame while the
          first bytes load, and so it survives a decode failure. */}
      {item.poster ? (
        <Image
          source={{ uri: item.poster }}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
          transition={150}
        />
      ) : null}

      {started && !failed ? (
        // Explicit 100% size: <video> is a replaced element on web, so
        // absoluteFill's inset alone doesn't stretch it.
        <VideoView player={player} style={styles.video} contentFit="contain" nativeControls />
      ) : (
        <Pressable
          onPress={onPlay}
          disabled={failed}
          accessibilityRole="button"
          accessibilityLabel={failed ? 'Video unavailable' : 'Play video'}
          style={({ pressed }) => [
            StyleSheet.absoluteFill,
            styles.cover,
            { opacity: pressed && !failed ? 0.85 : 1 },
          ]}
        >
          {failed ? (
            // Scrim: the poster underneath is a real frame, so plain white text
            // on top of it is unreadable half the time.
            <View style={[StyleSheet.absoluteFill, styles.errorScrim]}>
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={26} color="#FFFFFF" />
                <Text style={styles.errorText}>This video can’t be played on this device</Text>
                {error?.message ? (
                  <Text style={styles.errorDetail} numberOfLines={3}>
                    {error.message}
                  </Text>
                ) : null}
              </View>
            </View>
          ) : (
            <View style={styles.playBadge}>
              <Ionicons name="play" size={26} color="#FFFFFF" style={{ marginLeft: 3 }} />
            </View>
          )}
        </Pressable>
      )}

      {/* Duration — hidden once the native controls take over the same corner. */}
      {item.duration && !started ? (
        <View style={[styles.pill, styles.durationPill]} pointerEvents="none">
          <Text style={styles.pillText}>{formatDuration(item.duration)}</Text>
        </View>
      ) : null}

      {started && !failed ? (
        <Pressable
          onPress={() => {
            player.muted = !player.muted;
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={muted ? 'Unmute video' : 'Mute video'}
          style={[styles.pill, styles.mutePill]}
        >
          <Ionicons
            name={muted ? 'volume-mute' : 'volume-high'}
            size={15}
            color={colors.onBrand}
          />
        </Pressable>
      ) : null}

      {onExpand && !failed ? (
        <Pressable
          onPress={onExpand}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Open video full screen"
          style={[styles.pill, styles.expandPill]}
        >
          <Ionicons name="expand" size={15} color={colors.onBrand} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // alignSelf keeps the frame centered if MAX_HEIGHT is what ends up driving
  // the width (aspectRatio wins over width:'100%' once the height is capped).
  frame: { width: '100%', alignSelf: 'center', overflow: 'hidden', backgroundColor: '#000000' },
  video: { width: '100%', height: '100%' },
  cover: { alignItems: 'center', justifyContent: 'center' },
  playBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorScrim: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  errorBox: { alignItems: 'center', gap: 6, paddingHorizontal: 24 },
  errorText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  errorDetail: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
  },
  pill: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationPill: { bottom: 10, right: 10, paddingHorizontal: 8, paddingVertical: 3 },
  mutePill: { top: 10, right: 10, width: 30, height: 30 },
  expandPill: { top: 10, left: 10, width: 30, height: 30 },
  pillText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
});
