import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useEffect } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { STORY_BACKGROUNDS, type StoryItem } from '../../data/stories';

function StoryVideo({ item, active }: { item: StoryItem; active: boolean }) {
  const player = useVideoPlayer(item.uri ?? null, (p) => {
    p.loop = true;
    // Browsers block unmuted autoplay; stories have no play button, so mute on web.
    p.muted = Platform.OS === 'web';
  });

  useEffect(() => {
    if (active) player.play();
    else player.pause();
  }, [active, player]);

  // Explicit 100% size: <video> is a replaced element on web, so
  // absoluteFill's inset alone doesn't stretch it.
  return <VideoView player={player} style={styles.video} contentFit="cover" nativeControls={false} />;
}

/**
 * Renders one story item edge-to-edge inside the viewer: text on its gradient,
 * or an image / autoplaying video with an optional caption overlay.
 */
export function StoryContent({ item, active }: { item: StoryItem; active: boolean }) {
  if (item.type === 'text') {
    return (
      <LinearGradient
        colors={[...STORY_BACKGROUNDS[item.background ?? 'violet']]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[StyleSheet.absoluteFill, styles.textWrap]}
      >
        <Text style={styles.textBody}>{item.text}</Text>
      </LinearGradient>
    );
  }

  return (
    <View style={StyleSheet.absoluteFill}>
      {item.type === 'video' ? (
        <StoryVideo item={item} active={active} />
      ) : (
        <Image source={{ uri: item.uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
      )}
      {item.text ? (
        <View style={styles.captionWrap}>
          <Text style={styles.caption}>{item.text}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  video: { width: '100%', height: '100%' },
  textWrap: { alignItems: 'center', justifyContent: 'center', padding: 32 },
  textBody: {
    color: '#FFFFFF',
    fontSize: 26,
    lineHeight: 36,
    fontWeight: '800',
    textAlign: 'center',
  },
  captionWrap: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 110,
    alignItems: 'center',
  },
  caption: {
    color: '#FFFFFF',
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '700',
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    overflow: 'hidden',
  },
});
