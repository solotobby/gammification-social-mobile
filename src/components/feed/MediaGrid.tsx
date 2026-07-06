import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../theme/ThemeProvider';
import type { MediaItem } from '../../data/media';
import { MediaViewer } from './MediaViewer';

const GAP = 4;

type CellProps = {
  item: MediaItem;
  onPress: () => void;
  /** Extra items hidden behind this cell — renders the "+N" overlay. */
  overflow?: number;
  style?: object;
};

/** One tile: image (or video poster with a play badge), tappable into the viewer. */
function MediaCell({ item, onPress, overflow, style }: CellProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={item.type === 'video' ? 'Play video' : 'View image'}
      style={({ pressed }) => [styles.cell, style, { opacity: pressed ? 0.85 : 1 }]}
    >
      <Image
        source={{ uri: item.type === 'video' ? item.poster : item.uri }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={150}
      />
      {item.type === 'video' ? (
        <View style={styles.playBadge}>
          <Ionicons name="play" size={20} color="#FFFFFF" style={{ marginLeft: 2 }} />
        </View>
      ) : null}
      {overflow ? (
        <View style={styles.overflow}>
          <Text style={styles.overflowText}>+{overflow}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/**
 * Post media, laid out by count (1 hero, 2 side-by-side, 3 lead + stack,
 * 4+ grid with a "+N" spill). Tapping any tile opens the full-screen carousel
 * at that item.
 */
export function MediaGrid({ media }: { media: MediaItem[] }) {
  const { radius } = useTheme();
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  if (!media.length) return null;

  const open = (index: number) => () => setViewerIndex(index);
  const visible = media.slice(0, 4);
  const overflow = media.length - 4;

  let layout: React.ReactNode;
  if (media.length === 1) {
    layout = <MediaCell item={media[0]} onPress={open(0)} style={styles.single} />;
  } else if (media.length === 2) {
    layout = (
      <View style={styles.row}>
        <MediaCell item={media[0]} onPress={open(0)} style={styles.half} />
        <MediaCell item={media[1]} onPress={open(1)} style={styles.half} />
      </View>
    );
  } else if (media.length === 3) {
    layout = (
      <View style={styles.row}>
        <MediaCell item={media[0]} onPress={open(0)} style={styles.lead} />
        <View style={styles.stack}>
          <MediaCell item={media[1]} onPress={open(1)} style={styles.stackCell} />
          <MediaCell item={media[2]} onPress={open(2)} style={styles.stackCell} />
        </View>
      </View>
    );
  } else {
    layout = (
      <View style={styles.grid}>
        {visible.map((item, i) => (
          <MediaCell
            key={item.id}
            item={item}
            onPress={open(i)}
            overflow={i === 3 && overflow > 0 ? overflow : undefined}
            style={styles.quarter}
          />
        ))}
      </View>
    );
  }

  return (
    <>
      <View style={[styles.frame, { borderRadius: radius.md }]}>{layout}</View>
      <MediaViewer
        media={media}
        initialIndex={viewerIndex ?? 0}
        visible={viewerIndex !== null}
        onClose={() => setViewerIndex(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden' },
  cell: { overflow: 'hidden', borderRadius: 2, backgroundColor: 'rgba(120,120,140,0.15)' },
  single: { height: 220 },
  row: { flexDirection: 'row', gap: GAP },
  half: { flex: 1, height: 175 },
  lead: { flex: 1.55, height: 240 },
  stack: { flex: 1, gap: GAP },
  stackCell: { flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  quarter: { width: '48.8%', flexGrow: 1, height: 130 },
  playBadge: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -22,
    marginLeft: -22,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overflow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overflowText: { color: '#FFFFFF', fontSize: 22, fontWeight: '900' },
});
