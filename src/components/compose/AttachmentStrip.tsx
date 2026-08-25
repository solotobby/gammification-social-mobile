import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../theme/ThemeProvider';
import type { MediaItem } from '../../data/media';
import { FONT } from '../../theme/fonts';

type Props = {
  media: MediaItem[];
  onRemove: (id: string) => void;
  onAdd: () => void;
  /** Hides the trailing add tile once the limit is reached. */
  canAdd: boolean;
};

const TILE = 84;

/** Thumbnails of media attached to a draft post, with remove + add tiles. */
export function AttachmentStrip({ media, onRemove, onAdd, canAdd }: Props) {
  const { colors, radius } = useTheme();

  if (!media.length && !canAdd) return null;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {media.map((item) => (
        <View key={item.id} style={[styles.tile, { borderRadius: radius.sm }]}>
          <Image
            source={{ uri: item.type === 'video' ? item.poster ?? item.uri : item.uri }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
          {item.type === 'video' ? (
            <View style={styles.videoBadge}>
              <Ionicons name="play" size={12} color="#FFFFFF" />
            </View>
          ) : null}
          <Pressable
            onPress={() => onRemove(item.id)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Remove attachment"
            style={styles.removeBtn}
          >
            <Ionicons name="close" size={14} color="#FFFFFF" />
          </Pressable>
        </View>
      ))}
      {canAdd ? (
        <Pressable
          onPress={onAdd}
          accessibilityRole="button"
          accessibilityLabel="Add photos or videos"
          style={[
            styles.tile,
            styles.addTile,
            { borderRadius: radius.sm, borderColor: colors.border, backgroundColor: colors.surfaceAlt },
          ]}
        >
          <Ionicons name="images-outline" size={22} color={colors.brand} />
          <Text style={[styles.addText, { color: colors.textMuted }]}>Add</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 10 },
  tile: { width: TILE, height: TILE, overflow: 'hidden' },
  addTile: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  addText: { fontFamily: FONT, fontSize: 11, fontWeight: '700' },
  videoBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtn: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
