import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../theme/ThemeProvider';

type Props = {
  uri: string;
  /** Intrinsic size from the picker, used for the frame's aspect ratio. */
  width?: number;
  height?: number;
  /** Clip length in milliseconds, as expo-image-picker reports it. */
  durationMs?: number;
  fileSize?: number;
  onRemove: () => void;
};

const MAX_HEIGHT = 320;
const MIN_RATIO = 9 / 16;
const MAX_RATIO = 1.91;

function formatDuration(ms: number): string {
  const whole = Math.round(ms / 1000);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

function formatSize(bytes: number): string {
  const mb = bytes / 1_000_000;
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.round(bytes / 1000)} KB`;
}

/**
 * The picked video, playable before it is posted. The attachment strip's
 * thumbnails go through expo-image, which can't decode a `.mov`/`.mp4` — a
 * video draft needs a real player to show anything at all, so it gets its own
 * full-width frame instead of an 84pt tile (only one video is allowed anyway).
 */
export function VideoPreview({ uri, width, height, durationMs, fileSize, onRemove }: Props) {
  const { colors, radius } = useTheme();

  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    // Muted so scrubbing the draft doesn't blast audio over the compose modal.
    p.muted = true;
  });

  const ratio =
    width && height ? Math.min(MAX_RATIO, Math.max(MIN_RATIO, width / height)) : 16 / 9;

  const meta = [
    durationMs ? formatDuration(durationMs) : null,
    fileSize ? formatSize(fileSize) : null,
  ].filter(Boolean);

  return (
    <View style={styles.wrap}>
      <View
        style={[styles.frame, { aspectRatio: ratio, maxHeight: MAX_HEIGHT, borderRadius: radius.md }]}
      >
        {/* Explicit 100% size: <video> is a replaced element on web, so
            absoluteFill's inset alone doesn't stretch it. */}
        <VideoView player={player} style={styles.video} contentFit="contain" nativeControls />
        <Pressable
          onPress={onRemove}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Remove video"
          style={styles.removeBtn}
        >
          <Ionicons name="close" size={16} color="#FFFFFF" />
        </Pressable>
      </View>
      <View style={styles.metaRow}>
        <Ionicons name="videocam" size={14} color={colors.textMuted} />
        <Text style={[styles.metaText, { color: colors.textMuted }]}>
          {meta.length ? `Video · ${meta.join(' · ')}` : 'Video attached'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  frame: { width: '100%', overflow: 'hidden', backgroundColor: '#000000' },
  video: { width: '100%', height: '100%' },
  removeBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 12, fontWeight: '600' },
});
