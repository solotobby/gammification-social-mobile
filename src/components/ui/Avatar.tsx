import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text } from 'react-native';

import { useTheme } from '../../theme/ThemeProvider';
import type { MemberTint } from '../../data/community';
import { FONT } from '../../theme/fonts';

type Props = {
  name: string;
  /** Picks the gradient pair; keeps a member's avatar color stable everywhere. */
  tint?: MemberTint;
  size?: number;
};

/** Initials avatar on a brand-tinted gradient disc (no remote images yet). */
export function Avatar({ name, tint = 'violet', size = 44 }: Props) {
  const { brand } = useTheme();

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
  },
  initials: {
    fontFamily: FONT,
    color: '#FFFFFF',
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
