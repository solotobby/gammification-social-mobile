import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';

import type { UserLevel } from '../../api/levels';
import { useUserLevel } from '../../stores/levelStore';

/**
 * The colours of the two paid levels. Blue for Creator reads as the familiar
 * "verified" mark; Influencer gets purple, which is also the ring its avatar
 * wears (see `Avatar`'s `level`). Fixed across light and dark, like the brand.
 */
export const LEVEL_COLORS: Record<Exclude<UserLevel, 'basic'>, string> = {
  creator: '#1D9BF0',
  influencer: '#8B5CF6',
};

/**
 * The checkmark after a Creator's or Influencer's name. Renders nothing for
 * Basic or an unknown level, so a caller can always pass whatever the payload
 * had — or just the `userId`, and let the store answer.
 *
 * It's a vector-icon glyph, which is itself a `Text`, so it can sit **inside**
 * the name's `<Text>` — `<Text>{name} <LevelBadge … /></Text>` — and flow with
 * it, rather than needing a row wrapper at every call site.
 */
export function LevelBadge({
  level: explicit,
  userId,
  size = 15,
}: {
  level?: UserLevel;
  /** Falls back to the level the app was told for this user — see levelStore. */
  userId?: string;
  size?: number;
}) {
  const level = useUserLevel(userId, explicit);
  if (level !== 'creator' && level !== 'influencer') return null;
  return (
    <MaterialCommunityIcons
      name="check-decagram"
      size={size}
      color={LEVEL_COLORS[level]}
      accessibilityLabel={level === 'creator' ? 'Creator' : 'Influencer'}
    />
  );
}
