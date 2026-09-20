import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef } from 'react';
import {
  Animated,
  BackHandler,
  Dimensions,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { currentUser, referral } from '../../data/community';
import { useLogout } from '../../hooks/useAuth';
import { useMe, useMyAvatar, useMyTint } from '../../hooks/useMe';
import { useProfile } from '../../hooks/useUser';
import { useAuthStore } from '../../stores/authStore';
import { useDrawerStore } from '../../stores/drawerStore';
import { useTheme } from '../../theme/ThemeProvider';
import { FONT } from '../../theme/fonts';
import { Avatar } from '../ui/Avatar';

/**
 * How wide the panel is: most of the screen, but never the whole of it — the
 * strip of dimmed app still showing on the right is what tells you this is a
 * layer over Home rather than a screen you navigated to.
 */
const PANEL_WIDTH = Math.min(320, Dimensions.get('window').width * 0.84);

/** Past this much of a leftward drag, letting go closes rather than settles. */
const CLOSE_THRESHOLD = PANEL_WIDTH * 0.35;

/** A flick closes at any distance — velocity is intent. */
const CLOSE_VELOCITY = 0.4;

const OPEN_MS = 220;
const CLOSE_MS = 180;

type DrawerItem = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub: string;
  route: string;
};

/**
 * The account destinations, moved here wholesale from the old Me tab. They are
 * the web sidebar's rows, and a sidebar is what they were always shaped like —
 * a flat list of places, too many to be a tab and too shallow to deserve a
 * screen of their own in front of them.
 */
const SECTIONS: { title: string; items: DrawerItem[] }[] = [
  {
    title: 'Explore',
    items: [
      {
        icon: 'compass-outline',
        label: 'Discover',
        sub: 'People, Rolls & what’s trending',
        route: '/discover',
      },
      { icon: 'bookmark-outline', label: 'Bookmarks', sub: 'Posts you saved', route: '/bookmarks' },
      { icon: 'newspaper-outline', label: 'Blog', sub: 'Tips & product stories', route: '/blog' },
    ],
  },
  {
    title: 'Money',
    items: [
      { icon: 'wallet-outline', label: 'Wallets', sub: 'Balance & withdrawals', route: '/wallet' },
      {
        icon: 'diamond-outline',
        label: 'PayKoin',
        sub: 'Coins for gifting creators',
        route: '/paykoin',
      },
      {
        icon: 'card-outline',
        label: 'Bank information',
        sub: 'Payout account & currency',
        route: '/bank-info',
      },
      {
        icon: 'swap-horizontal-outline',
        label: 'Transactions',
        sub: 'Payout & earning history',
        route: '/transactions',
      },
    ],
  },
  {
    title: 'Grow',
    items: [
      {
        icon: 'megaphone-outline',
        label: 'Promotions',
        sub: 'Posts you’re boosting',
        route: '/boosts',
      },
      {
        icon: 'people-outline',
        label: 'My referrals',
        sub: `${referral.total} referral so far`,
        route: '/referrals',
      },
      {
        icon: 'arrow-up-circle-outline',
        label: 'Upgrade level',
        sub: 'Creator & Influencer plans',
        route: '/upgrade',
      },
    ],
  },
  {
    title: 'Account',
    items: [
      {
        icon: 'settings-outline',
        label: 'Settings',
        sub: 'Profile details & socials',
        route: '/settings',
      },
      {
        icon: 'help-buoy-outline',
        label: 'How it works',
        sub: 'Earning explained',
        route: '/how-it-works',
      },
    ],
  },
];

/**
 * The app's side drawer: identity at the top, the account destinations under
 * it, log out at the bottom.
 *
 * **Why this is hand-rolled rather than `@react-navigation/drawer`.** That
 * package needs `react-native-reanimated` and `react-native-gesture-handler`,
 * both of which are native modules — adding them means a fresh EAS build
 * before anyone can see the drawer at all, and this project has deliberately
 * stayed off both (the onboarding carousel is plain `Animated` for the same
 * reason). `Animated` + `PanResponder` are in React Native itself, so this
 * reloads over Metro like any other change.
 *
 * It is mounted beside `<Tabs>` in `app/(tabs)/_layout.tsx`, which is what
 * lets it cover the floating tab bar. Tapping a row closes the drawer and
 * pushes on the root stack, so the screen it opens covers the shell exactly as
 * it did when these rows lived on the Me tab.
 */
export function AppDrawer() {
  const { colors } = useTheme();

  const open = useDrawerStore((s) => s.open);
  const closeDrawer = useDrawerStore((s) => s.closeDrawer);

  // One driver from 0 (closed) to 1 (open): the panel reads it as a translate,
  // the backdrop as an opacity, so the two can never disagree about how open
  // the drawer is — which is what a second value for the scrim would risk
  // during a drag.
  const progress = useRef(new Animated.Value(0)).current;

  // `open` is the *intent*; this is whether the panel is still on screen. They
  // differ for the length of the closing animation, and unmounting on intent
  // alone would make the drawer vanish rather than slide away.
  const [mounted, setMounted] = React.useState(open);

  useEffect(() => {
    if (open) setMounted(true);
    const animation = Animated.timing(progress, {
      toValue: open ? 1 : 0,
      duration: open ? OPEN_MS : CLOSE_MS,
      // Only transform and opacity are driven, so this can all run off the JS
      // thread — the list behind it keeps scrolling smoothly while it moves.
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished && !open) setMounted(false);
    });
    return () => animation.stop();
  }, [open, progress]);

  // Android's back button should close the drawer before it leaves the screen
  // underneath — the same expectation any other overlay sets.
  useEffect(() => {
    if (!open || Platform.OS !== 'android') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      closeDrawer();
      return true;
    });
    return () => subscription.remove();
  }, [open, closeDrawer]);

  // Drag the panel leftwards to dismiss. Claimed only for a gesture that is
  // clearly horizontal and clearly leftward, so the menu itself still scrolls
  // and a tap on a row is still a tap.
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_event, gesture) =>
        gesture.dx < -6 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.6,
      onPanResponderMove: (_event, gesture) => {
        const next = 1 + Math.min(0, gesture.dx) / PANEL_WIDTH;
        progress.setValue(Math.max(0, Math.min(1, next)));
      },
      onPanResponderRelease: (_event, gesture) => {
        const shouldClose = gesture.dx < -CLOSE_THRESHOLD || gesture.vx < -CLOSE_VELOCITY;
        if (shouldClose) {
          useDrawerStore.getState().closeDrawer();
        } else {
          // Settle back open. The store never changed, so the effect above
          // won't run — this is the only thing that puts the panel back.
          Animated.timing(progress, {
            toValue: 1,
            duration: 140,
            useNativeDriver: true,
          }).start();
        }
      },
    }),
  ).current;

  if (!mounted) return null;

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-PANEL_WIDTH, 0],
  });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Scrim. It fades with the same driver as the panel, so a half-dragged
          drawer is half-dimmed rather than fully dark behind a panel that has
          mostly left. */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: progress }]}>
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]}
          onPress={closeDrawer}
          accessibilityRole="button"
          accessibilityLabel="Close menu"
        />
      </Animated.View>

      <Animated.View
        {...pan.panHandlers}
        style={[
          styles.panel,
          {
            width: PANEL_WIDTH,
            backgroundColor: colors.background,
            borderRightColor: colors.border,
            transform: [{ translateX }],
          },
        ]}
      >
        <DrawerContents />
      </Animated.View>
    </View>
  );
}

/**
 * Everything inside the panel. Split out from `AppDrawer` so that it — and so
 * the `/user/me` and `/user/profile/{username}` reads behind the identity card
 * — mount only while the drawer is actually on screen. `AppDrawer` itself sits
 * beside every tab, and firing a profile fetch on launch for a menu nobody has
 * opened is exactly the kind of cost a drawer should not have.
 */
function DrawerContents() {
  const { colors, radius, spacing, brand } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const logout = useLogout();
  const closeDrawer = useDrawerStore((s) => s.closeDrawer);

  // Identity, read exactly as the old Me tab read it: the API's user, with the
  // session snapshot covering the moment before /user/me resolves and the
  // dummy user as the last-ditch fallback.
  const { data: me } = useMe();
  const sessionUser = useAuthStore((s) => s.user);
  const displayName = me?.user.name ?? sessionUser?.name ?? currentUser.name;
  const displayUsername = me?.user.username ?? sessionUser?.username ?? currentUser.handle;
  const level = me?.level ?? 'Basic';
  const myTint = useMyTint();
  const myAvatar = useMyAvatar();

  const profilePage = useProfile(me?.user.username ?? sessionUser?.username).data?.pages[0];
  const followers = profilePage?.profile.followers ?? 0;
  const following = profilePage?.profile.following ?? 0;

  // Close first, then push: the drawer is a layer over the shell, and leaving
  // it open behind a screen it just opened would mean coming back to a menu
  // still sitting there.
  const go = useCallback(
    (route: string) => {
      closeDrawer();
      router.push(route as never);
    },
    [closeDrawer, router],
  );

  const section = (title: string, items: DrawerItem[]) => (
    <View key={title} style={{ gap: spacing.xs }}>
      <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{title.toUpperCase()}</Text>
      <View
        style={[
          styles.group,
          { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg },
        ]}
      >
        {items.map((item, index) => (
          <Pressable
            key={item.label}
            onPress={() => go(item.route)}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            style={({ pressed }) => [
              styles.itemRow,
              index > 0 && {
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: colors.border,
              },
              { opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <View style={[styles.itemIcon, { backgroundColor: colors.surfaceAlt }]}>
              <Ionicons name={item.icon} size={17} color={colors.brand} />
            </View>
            <View style={styles.itemText}>
              <Text style={[styles.itemLabel, { color: colors.text }]} numberOfLines={1}>
                {item.label}
              </Text>
              <Text style={[styles.itemSub, { color: colors.textMuted }]} numberOfLines={1}>
                {item.sub}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </Pressable>
        ))}
      </View>
    </View>
  );

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        paddingTop: insets.top + spacing.lg,
        paddingBottom: insets.bottom + spacing.xl,
        paddingHorizontal: spacing.lg,
        gap: spacing.lg,
      }}
    >
      {/* Identity — the way into the profile now that the Me tab is gone.
          Avatar and name together are one target, because they read as one
          thing and a name you can't tap next to an avatar you can is the
          kind of detail that makes a menu feel unfinished. */}
      <Pressable
        onPress={() => go('/member/me')}
        accessibilityRole="button"
        accessibilityLabel="View my profile"
        style={({ pressed }) => [
          styles.identity,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderRadius: radius.lg,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <View style={styles.identityHead}>
          <Avatar name={displayName} tint={myTint} uri={myAvatar} size={52} />
          <View style={styles.identityText}>
            <Text style={[styles.identityName, { color: colors.text }]} numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={[styles.identityHandle, { color: colors.textMuted }]} numberOfLines={1}>
              @{displayUsername}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </View>

        <View style={styles.identityMeta}>
          <View style={[styles.levelPill, { backgroundColor: `${brand.violet}1F` }]}>
            <Ionicons name="ribbon-outline" size={12} color={colors.brand} />
            <Text style={[styles.levelText, { color: colors.brand }]}>{level}</Text>
          </View>
          <Text style={[styles.countText, { color: colors.textMuted }]}>
            <Text style={{ color: colors.text, fontWeight: '800' }}>
              {followers.toLocaleString()}
            </Text>
            {' followers · '}
            <Text style={{ color: colors.text, fontWeight: '800' }}>
              {following.toLocaleString()}
            </Text>
            {' following'}
          </Text>
        </View>
      </Pressable>

      {SECTIONS.map((group) => section(group.title, group.items))}

      <Pressable
        onPress={async () => {
          closeDrawer();
          await logout();
          router.replace('/');
        }}
        accessibilityRole="button"
        accessibilityLabel="Log out"
        style={({ pressed }) => [
          styles.logout,
          {
            borderColor: `${colors.pink}55`,
            backgroundColor: `${colors.pink}0F`,
            borderRadius: radius.pill,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <Ionicons name="log-out-outline" size={18} color={colors.pink} />
        <Text style={[styles.logoutText, { color: colors.pink }]}>Log out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  identity: { borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 12 },
  identityHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  identityText: { flex: 1, gap: 2 },
  identityName: { fontFamily: FONT, fontSize: 16, fontWeight: '800' },
  identityHandle: { fontFamily: FONT, fontSize: 12, fontWeight: '600' },
  identityMeta: { gap: 8 },
  levelPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  levelText: { fontFamily: FONT, fontSize: 11, fontWeight: '800' },
  countText: { fontFamily: FONT, fontSize: 12, fontWeight: '600' },
  sectionTitle: {
    fontFamily: FONT,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.7,
    paddingLeft: 4,
  },
  group: { borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  itemIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: { flex: 1, gap: 1 },
  itemLabel: { fontFamily: FONT, fontSize: 14, fontWeight: '700' },
  itemSub: { fontFamily: FONT, fontSize: 11, fontWeight: '500' },
  logout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderWidth: 1,
  },
  logoutText: { fontFamily: FONT, fontSize: 14, fontWeight: '800' },
});
