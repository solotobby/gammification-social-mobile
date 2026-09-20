import React from 'react';
import { Pressable } from 'react-native';

import { currentUser } from '../../data/community';
import { useMe, useMyAvatar, useMyTint } from '../../hooks/useMe';
import { useAuthStore } from '../../stores/authStore';
import { useDrawerStore } from '../../stores/drawerStore';
import { Avatar } from '../ui/Avatar';

/**
 * The signed-in user's avatar, opening the side drawer.
 *
 * It is the drawer's handle on every tab that has a header to put it in —
 * Home, Earn, Communities and Messages. **Not Rolls**: that screen is
 * deliberately immersive (`TabBar` hides itself there and the overlays sit on
 * the safe-area inset), and a menu button over full-screen video would be the
 * one piece of chrome that never goes away.
 *
 * It renders the same identity as the drawer's own header, which is what makes
 * the connection between the two obvious without a label.
 */
export function DrawerAvatarButton({ size = 40 }: { size?: number }) {
  const openDrawer = useDrawerStore((s) => s.openDrawer);

  // Same fallback chain as the drawer and the Home header: the API's user, the
  // session snapshot while /user/me resolves, then the dummy user.
  const { data: me } = useMe();
  const sessionUser = useAuthStore((s) => s.user);
  const displayName = me?.user.name ?? sessionUser?.name ?? currentUser.name;
  const tint = useMyTint();
  const uri = useMyAvatar();

  return (
    <Pressable onPress={openDrawer} accessibilityRole="button" accessibilityLabel="Open menu">
      <Avatar name={displayName} tint={tint} uri={uri} size={size} />
    </Pressable>
  );
}
