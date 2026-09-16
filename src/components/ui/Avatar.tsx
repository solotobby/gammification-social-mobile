import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../theme/ThemeProvider';
import type { MemberTint } from '../../data/community';
import { FONT } from '../../theme/fonts';

type Props = {
  name: string;
  /** Picks the gradient pair; keeps a member's avatar color stable everywhere. */
  tint?: MemberTint;
  size?: number;
  /**
   * The member's uploaded photo, when they have one (`user.avatar`). Falls back
   * to the initials disc when absent — or when the image fails to load, which a
   * CDN URL for a deleted file will.
   */
  uri?: string | null;
};

/**
 * A member's avatar: their uploaded photo, or initials on a brand-tinted
 * gradient disc when they have none.
 *
 * Photos arrived with `POST /user/avatar` (2026-09-16); before that every
 * avatar in the app was initials, which is why the fallback is a first-class
 * path rather than a placeholder — most accounts still have no photo.
 */
export function Avatar({ name, tint = 'violet', size = 44, uri }: Props) {
  const { brand } = useTheme();
  const [failed, setFailed] = useState(false);

  // Deep -> bright, matching the web's `linear-gradient(135deg, violet,
  // violetBright)` on .ph-avatar. The per-member tint is ours: the web paints
  // every avatar violet, but keeping a stable colour per person is what makes
  // them scannable in a feed.
  const gradients: Record<MemberTint, [string, string]> = {
    violet: [brand.violet, brand.violetBright],
    mint: [brand.mint, brand.mintBright],
    gold: ['#E09A1A', brand.gold],
    pink: [brand.pink, '#FF7BA9'],
  };

  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');

  if (uri && !failed) {
    return (
      <View
        style={[styles.disc, { width: size, height: size, borderRadius: size / 2 }]}
      >
        <Image
          source={{ uri }}
          style={{ width: size, height: size }}
          contentFit="cover"
          onError={() => setFailed(true)}
          accessibilityLabel={`${name}'s profile photo`}
        />
      </View>
    );
  }

  return (
    <LinearGradient
      colors={gradients[tint]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.disc,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Text style={[styles.initials, { fontSize: size * 0.38 }]}>{initials}</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  disc: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initials: {
    fontFamily: FONT,
    color: '#FFFFFF',
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
