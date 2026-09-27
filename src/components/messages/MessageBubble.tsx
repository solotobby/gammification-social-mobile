import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ChatMessage } from '../../data/messages';
import { useTheme } from '../../theme/ThemeProvider';
import { FONT } from '../../theme/fonts';
import { clockTime } from './time';

/** Width of a bubble's photo block — the grid below divides it. */
const PHOTO_WIDTH = 224;
const PHOTO_GAP = 3;

/**
 * One message in a thread.
 *
 * Yours sits right on the brand gradient (the same violet pair as
 * `GradientButton`, so the app has one "this is you" colour); theirs sits left
 * on `colors.surface` with a hairline, which is the only treatment that stays
 * legible over `ScreenBackground`'s wash in both modes.
 *
 * The timestamp and your delivery state live *inside* the bubble, bottom-right,
 * like the web — a separate line under every message doubles the thread's
 * height for information nobody reads twice. The state reads left to right the
 * way every chat app has taught people: a clock while it's still on this
 * device, one tick once the server has it, two once it's delivered, two bright
 * ones once it's been read. A message the server refused turns the bubble's
 * edge red and says so underneath, and tapping it offers Retry.
 */
export function MessageBubble({
  message,
  onPressImage,
  onPressFailed,
  onLongPress,
}: {
  message: ChatMessage;
  onPressImage?: (index: number) => void;
  onPressFailed?: () => void;
  onLongPress?: () => void;
}) {
  const { colors, brand, radius } = useTheme();
  const mine = message.mine;
  const failed = message.status === 'failed';

  const metaColor = mine ? 'rgba(255,255,255,0.78)' : colors.textMuted;
  const meta = (
    <View style={styles.metaRow}>
      <Text style={[styles.time, { color: metaColor }]}>{clockTime(message.sentAt)}</Text>
      {mine ? <StatusGlyph status={message.status} dim={metaColor} /> : null}
    </View>
  );

  const content = (
    <>
      {message.images.length ? (
        <PhotoGrid
          uris={message.images}
          radius={radius.md}
          onPress={onPressImage}
          // Letterbox bars take the bubble's own tone, so a banner-shaped
          // photo sits in a quiet frame rather than on a grey slab.
          matte={mine ? 'rgba(255,255,255,0.14)' : colors.surfaceAlt}
        />
      ) : null}
      {message.body ? (
        <Text style={[styles.body, { color: mine ? '#FFFFFF' : colors.text }]} selectable={false}>
          {message.body}
        </Text>
      ) : null}
      {meta}
    </>
  );

  return (
    <View style={[styles.row, { alignItems: mine ? 'flex-end' : 'flex-start' }]}>
      <Pressable
        onPress={failed ? onPressFailed : undefined}
        onLongPress={onLongPress}
        delayLongPress={300}
        // No accessibilityRole here: photo tiles inside are their own buttons,
        // and nested buttons are invalid markup on web. The "Tap to retry" row
        // below is the accessible way to act on a failed message.
        style={styles.pressable}
      >
        {mine ? (
          <LinearGradient
            colors={[brand.violetBright, brand.violet]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              styles.bubble,
              styles.mine,
              failed && { borderWidth: 1.5, borderColor: colors.danger },
            ]}
          >
            {content}
          </LinearGradient>
        ) : (
          <View
            style={[
              styles.bubble,
              styles.theirs,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            {content}
          </View>
        )}
      </Pressable>
      {failed ? (
        <Pressable
          onPress={onPressFailed}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Retry sending"
          style={styles.failedRow}
        >
          <Ionicons name="alert-circle" size={14} color={colors.danger} />
          <Text style={[styles.failedText, { color: colors.danger }]} numberOfLines={2}>
            {message.error ? `${message.error} · ` : 'Not sent · '}
            <Text style={styles.failedAction}>Tap to retry</Text>
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function StatusGlyph({ status, dim }: { status: ChatMessage['status']; dim: string }) {
  switch (status) {
    case 'sending':
      return <Ionicons name="time-outline" size={12} color={dim} />;
    case 'failed':
      return <Ionicons name="alert-circle" size={13} color="#FFFFFF" />;
    case 'read':
      return <Ionicons name="checkmark-done" size={14} color="#FFFFFF" />;
    case 'delivered':
      return <Ionicons name="checkmark-done" size={14} color={dim} />;
    default:
      return <Ionicons name="checkmark" size={13} color={dim} />;
  }
}

/**
 * Aspect ratios (width ÷ height) already measured, by URI. The API sends no
 * dimensions, so a photo's shape is only known once it has loaded;
 * remembering it means a bubble scrolled back into view (or re-rendered by a
 * poll) lays out at its real size straight away instead of jumping from the
 * placeholder shape.
 */
const knownRatios = new Map<string, number>();

const MIN_RATIO = 0.66;
const MAX_RATIO = 1.9;

/**
 * A lone photo keeps its own shape — a wide logo stays wide, a portrait stays
 * tall — rather than being cropped into a fixed box. It starts at 4:5 and
 * settles to the real ratio when the image reports its size.
 */
function SinglePhoto({
  uri,
  radius,
  matte,
  onPress,
}: {
  uri: string;
  radius: number;
  matte: string;
  onPress?: () => void;
}) {
  const [actual, setActual] = useState(() => knownRatios.get(uri));
  // The bubble clamps to a sane shape; an image shaped beyond that (a banner,
  // a long screenshot) is letterboxed inside it rather than cropped.
  const ratio = Math.min(MAX_RATIO, Math.max(MIN_RATIO, actual ?? 0.8));
  const letterbox = actual !== undefined && (actual > MAX_RATIO || actual < MIN_RATIO);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="imagebutton"
      accessibilityLabel="Photo"
      style={{
        width: PHOTO_WIDTH,
        height: PHOTO_WIDTH / ratio,
        borderRadius: radius,
        overflow: 'hidden',
        backgroundColor: letterbox ? matte : undefined,
      }}
    >
      <Image
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        contentFit={letterbox ? 'contain' : 'cover'}
        transition={150}
        recyclingKey={uri}
        onLoad={({ source }) => {
          if (!source.width || !source.height) return;
          const next = source.width / source.height;
          knownRatios.set(uri, next);
          if (actual === undefined || Math.abs(next - actual) > 0.01) setActual(next);
        }}
      />
    </Pressable>
  );
}

/**
 * One photo fills the block; two sit side by side; three or more make a 2×2
 * grid, the fourth tile carrying "+N" for any beyond it. Every tile opens the
 * full-screen viewer at its own index.
 */
function PhotoGrid({
  uris,
  radius,
  matte,
  onPress,
}: {
  uris: string[];
  radius: number;
  matte: string;
  onPress?: (index: number) => void;
}) {
  const tile = (uri: string, index: number, width: number, height: number, extra = 0) => (
    <Pressable
      key={`${uri}-${index}`}
      onPress={onPress ? () => onPress(index) : undefined}
      accessibilityRole="imagebutton"
      accessibilityLabel={`Photo ${index + 1} of ${uris.length}`}
      style={{ width, height, borderRadius: radius, overflow: 'hidden' }}
    >
      <Image
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={150}
        recyclingKey={uri}
      />
      {extra > 0 ? (
        <View style={styles.more}>
          <Text style={styles.moreText}>+{extra}</Text>
        </View>
      ) : null}
    </Pressable>
  );

  if (uris.length === 1) {
    return (
      <View style={styles.grid}>
        <SinglePhoto
          uri={uris[0]!}
          radius={radius}
          matte={matte}
          onPress={onPress ? () => onPress(0) : undefined}
        />
      </View>
    );
  }

  const half = (PHOTO_WIDTH - PHOTO_GAP) / 2;
  if (uris.length === 2) {
    return <View style={styles.grid}>{uris.map((uri, i) => tile(uri, i, half, 170))}</View>;
  }

  const shown = uris.slice(0, 4);
  return (
    <View style={[styles.grid, styles.wrap]}>
      {shown.map((uri, i) =>
        tile(uri, i, half, half, i === 3 ? uris.length - 4 : 0),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { width: '100%' },
  pressable: { maxWidth: '80%' },
  bubble: {
    paddingHorizontal: 13,
    paddingVertical: 9,
    gap: 6,
  },
  // A squared corner on the sender's side points the bubble at its author.
  mine: { borderRadius: 20, borderBottomRightRadius: 6 },
  theirs: { borderRadius: 20, borderBottomLeftRadius: 6, borderWidth: StyleSheet.hairlineWidth },
  grid: { flexDirection: 'row', gap: PHOTO_GAP, width: PHOTO_WIDTH, marginHorizontal: -6, marginTop: -3 },
  wrap: { flexWrap: 'wrap' },
  more: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreText: { fontFamily: FONT, color: '#FFFFFF', fontSize: 22, fontWeight: '800' },
  body: { fontFamily: FONT, fontSize: 15, lineHeight: 21, fontWeight: '500' },
  metaRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', gap: 3 },
  time: { fontFamily: FONT, fontSize: 10, fontWeight: '700' },
  failedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    maxWidth: '80%',
  },
  failedText: { fontFamily: FONT, fontSize: 12, fontWeight: '600', flexShrink: 1 },
  failedAction: { fontWeight: '800', textDecorationLine: 'underline' },
});
