import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text } from 'react-native';

import { STORY_BACKGROUNDS, type StoryItem } from '../../data/stories';
import { FONT } from '../../theme/fonts';

/**
 * Fills its parent with a thumbnail of a story item: the image / video poster,
 * or the text story's gradient with a snippet of the copy.
 */
export function StoryPreview({ item }: { item: StoryItem }) {
  if (item.type === 'text') {
    return (
      <LinearGradient
        colors={[...STORY_BACKGROUNDS[item.background ?? 'violet']]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[StyleSheet.absoluteFill, styles.textWrap]}
      >
        <Text style={styles.snippet} numberOfLines={4}>
          {item.text}
        </Text>
      </LinearGradient>
    );
  }

  return (
    <Image
      source={{ uri: item.type === 'video' ? item.poster : item.uri }}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      transition={150}
    />
  );
}

const styles = StyleSheet.create({
  textWrap: { alignItems: 'center', justifyContent: 'center', padding: 8 },
  snippet: {
    fontFamily: FONT,
    color: '#FFFFFF',
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
});
