import React from 'react';
import { StyleSheet, View } from 'react-native';

import { useIsOnline } from '../../stores/presenceStore';
import { useTheme } from '../../theme/ThemeProvider';

/**
 * The green "online now" dot, drawn over the bottom-right of an avatar of
 * `avatarSize`. Renders nothing unless presence says the user is online — so
 * it's safe to put on any avatar; with no socket it simply never shows.
 *
 * The parent must be the avatar's own box (`position: 'relative'` is the RN
 * default), so the dot sits on the circle's edge rather than the row's.
 */
export function OnlineDot({
  userId,
  avatarSize,
  ringColor,
}: {
  userId: string | null | undefined;
  avatarSize: number;
  /** What's behind the avatar, so the dot reads as cut out of it. Defaults to the page. */
  ringColor?: string;
}) {
  const { colors, brand } = useTheme();
  const online = useIsOnline(userId);
  if (!online) return null;
  const size = Math.max(10, Math.round(avatarSize * 0.28));
  // On the circle's 45° point rather than the bounding box's corner.
  const inset = Math.round(avatarSize * 0.146 - size / 2);
  return (
    <View
      pointerEvents="none"
      accessibilityLabel="Online"
      style={[
        styles.dot,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          right: inset,
          bottom: inset,
          backgroundColor: brand.mint,
          borderColor: ringColor ?? colors.background,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  dot: { position: 'absolute', borderWidth: 2 },
});
