import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

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

/**
 * A single-line name with its level badge beside it.
 *
 * Nesting the badge *inside* a `numberOfLines={1}` name truncates it along with
 * the name — a long name ends in "…" and the checkmark is simply gone, which is
 * exactly when it matters most (trending lists are full of long full names).
 * Here the name shrinks and ellipsizes on its own, and the badge always shows.
 */
export function NameWithBadge({
  name,
  userId,
  level,
  size = 15,
  style,
  containerStyle,
}: {
  name: string;
  userId?: string;
  level?: UserLevel;
  size?: number;
  style?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
}) {
  // A name style written for a bare <Text> often carries `flex: 1` so it fills
  // its row. Left on the name, that stretches the text and shoves the badge to
  // the far edge (beside the timestamp in a comment header); moved to the
  // wrapper, the row still fills the space and the badge hugs the name.
  const { flex, flexGrow, flexBasis, ...textStyle } = StyleSheet.flatten(style) ?? {};
  return (
    <View style={[styles.row, { flex, flexGrow, flexBasis }, containerStyle]}>
      <Text style={[textStyle, styles.name]} numberOfLines={1}>
        {name}
      </Text>
      <LevelBadge userId={userId} level={level} size={size} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 0, flexShrink: 1 },
  name: { flexShrink: 1 },
});
