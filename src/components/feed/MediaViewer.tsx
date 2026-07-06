import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { MediaItem } from '../../data/media';

type Props = {
  media: MediaItem[];
  /** Index the carousel opens on. */
  initialIndex: number;
  visible: boolean;
  onClose: () => void;
};

/** Video page — plays only while it is the active carousel page. */
function ViewerVideo({ item, active }: { item: MediaItem; active: boolean }) {
  const player = useVideoPlayer(item.uri, (p) => {
    p.loop = true;
  });

  useEffect(() => {
    if (active) player.play();
    else player.pause();
  }, [active, player]);

  return (
    // Explicit 100% size: <video> is a replaced element on web, so
    // absoluteFill's inset alone doesn't stretch it.
    <VideoView player={player} style={styles.video} contentFit="contain" nativeControls />
  );
}

/**
 * Full-screen media carousel: swipe (or arrow through) a post's images and
 * videos on a black backdrop with a position counter.
 */
export function MediaViewer({ media, initialIndex, visible, onClose }: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(initialIndex);
  const listRef = useRef<FlatList<MediaItem>>(null);

  // Re-sync when reopened on a different item.
  useEffect(() => {
    if (visible) setIndex(initialIndex);
  }, [visible, initialIndex]);

  const goTo = (next: number) => {
    const clamped = Math.max(0, Math.min(media.length - 1, next));
    listRef.current?.scrollToIndex({ index: clamped, animated: true });
    setIndex(clamped);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <FlatList
          ref={listRef}
          data={media}
          horizontal
          pagingEnabled
          initialScrollIndex={initialIndex}
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.id}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          onScroll={(e) => {
            const next = Math.round(e.nativeEvent.contentOffset.x / width);
            if (next !== index && next >= 0 && next < media.length) setIndex(next);
          }}
          scrollEventThrottle={64}
          renderItem={({ item, index: i }) => (
            <View style={{ width, height }}>
              {item.type === 'video' ? (
                <ViewerVideo item={item} active={visible && i === index} />
              ) : (
                <Image
                  source={{ uri: item.uri }}
                  style={StyleSheet.absoluteFill}
                  contentFit="contain"
                  transition={150}
                />
              )}
            </View>
          )}
        />

        {/* Top bar: counter + close */}
        <View style={[styles.topBar, { top: insets.top + 12 }]}>
          <View style={styles.counterPill}>
            <Text style={styles.counterText}>
              {index + 1} / {media.length}
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Close media viewer"
            style={styles.closeBtn}
          >
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </Pressable>
        </View>

        {/* Prev / next arrows (also make the carousel usable with a mouse on web) */}
        {index > 0 ? (
          <Pressable
            onPress={() => goTo(index - 1)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Previous media"
            style={[styles.arrow, styles.arrowLeft]}
          >
            <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
          </Pressable>
        ) : null}
        {index < media.length - 1 ? (
          <Pressable
            onPress={() => goTo(index + 1)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Next media"
            style={[styles.arrow, styles.arrowRight]}
          >
            <Ionicons name="chevron-forward" size={26} color="#FFFFFF" />
          </Pressable>
        ) : null}

        {/* Dots */}
        {media.length > 1 ? (
          <View style={[styles.dots, { bottom: insets.bottom + 24 }]}>
            {media.map((item, i) => (
              <View key={item.id} style={[styles.dot, i === index && styles.dotActive]} />
            ))}
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000000' },
  video: { width: '100%', height: '100%' },
  topBar: {
    position: 'absolute',
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  counterPill: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  counterText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrow: {
    position: 'absolute',
    top: '50%',
    marginTop: -22,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowLeft: { left: 14 },
  arrowRight: { right: 14 },
  dots: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  dotActive: { backgroundColor: '#FFFFFF' },
});
