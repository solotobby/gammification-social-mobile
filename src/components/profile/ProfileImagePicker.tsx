import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import type { UploadFile } from '../../api/types';
import { useUpdateAvatar, useUpdateBanner } from '../../hooks/useAccount';
import { useMe, useMyTint } from '../../hooks/useMe';
import { useTheme } from '../../theme/ThemeProvider';
import { FONT } from '../../theme/fonts';
import { Avatar } from '../ui/Avatar';

/**
 * Cover + profile photo, both editable in place — `POST /user/avatar` and
 * `POST /user/banner`.
 *
 * Laid out the way the profile itself is (cover with the avatar overlapping its
 * bottom edge) so what you tap is what you get, rather than two abstract "upload"
 * rows that give no sense of the result. Each upload answers with the whole
 * updated user, so the new image appears without a refetch.
 */
export function ProfileImagePicker() {
  const { colors, radius } = useTheme();
  const { data: me } = useMe();
  const tint = useMyTint();

  const avatar = useUpdateAvatar();
  const banner = useUpdateBanner();

  const pick = async (
    onPicked: (file: UploadFile) => void,
    aspect: [number, number],
  ) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      // Cropping to the shape it will actually be shown in — a square avatar
      // and a wide cover — so the user frames the picture rather than
      // discovering later that the backend centre-cropped it.
      aspect,
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    onPicked({
      uri: asset.uri,
      name: asset.fileName ?? `upload-${Date.now()}.jpg`,
      type: asset.mimeType ?? 'image/jpeg',
    });
  };

  const bannerUri = me?.user.banner;
  const avatarUri = me?.user.avatar;

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => pick((file) => banner.mutate(file), [16, 9])}
        disabled={banner.isPending}
        accessibilityRole="button"
        accessibilityLabel="Change cover photo"
        style={[styles.cover, { backgroundColor: colors.surfaceAlt, borderRadius: radius.md }]}
      >
        {bannerUri ? (
          <Image source={{ uri: bannerUri }} style={styles.coverImage} contentFit="cover" />
        ) : null}
        <View style={styles.coverBadge}>
          {banner.isPending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="camera-outline" size={14} color="#FFFFFF" />
              <Text style={styles.coverBadgeText}>
                {bannerUri ? 'Change cover' : 'Add cover'}
              </Text>
            </>
          )}
        </View>
      </Pressable>

      <Pressable
        onPress={() => pick((file) => avatar.mutate(file), [1, 1])}
        disabled={avatar.isPending}
        accessibilityRole="button"
        accessibilityLabel="Change profile photo"
        style={[styles.avatarWrap, { borderColor: colors.surface }]}
      >
        {avatarUri ? (
          <Image source={{ uri: avatarUri }} style={styles.avatarImage} contentFit="cover" />
        ) : (
          <Avatar name={me?.user.name ?? 'You'} tint={tint} size={84} />
        )}
        <View style={[styles.avatarBadge, { backgroundColor: colors.brand, borderColor: colors.surface }]}>
          {avatar.isPending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name="camera" size={14} color={colors.onBrand} />
          )}
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  // Bottom padding leaves room for the avatar overhanging the cover.
  wrap: { paddingBottom: 46 },
  cover: { height: 124, overflow: 'hidden', justifyContent: 'flex-end', alignItems: 'flex-end' },
  coverImage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  coverBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    margin: 10,
    paddingVertical: 6,
    paddingHorizontal: 11,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  coverBadgeText: { fontFamily: FONT, fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  avatarWrap: {
    position: 'absolute',
    left: 16,
    bottom: 0,
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarBadge: {
    position: 'absolute',
    right: 0,
    bottom: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
