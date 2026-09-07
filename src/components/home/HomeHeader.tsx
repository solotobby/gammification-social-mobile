import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { currentUser } from '../../data/community';
import { useMe, useMyTint } from '../../hooks/useMe';
import { useUnreadNotificationCount } from '../../hooks/useNotifications';
import { useAuthStore } from '../../stores/authStore';
import { useTheme } from '../../theme/ThemeProvider';
// import { StoriesRail } from '../stories/StoriesRail';
import { Avatar } from '../ui/Avatar';
import { EarningsPulse } from './EarningsPulse';
import { FeedTabs, type FeedTab } from './FeedTabs';
import { FONT } from '../../theme/fonts';

/**
 * Everything above the feed on Home: greeting row (profile, search,
 * notifications), the monetization signal, the composer trigger, and the
 * For You / Following filter. (The stories rail is commented out below.)
 */
function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function HomeHeader({
  feedTab,
  onChangeFeedTab,
}: {
  feedTab: FeedTab;
  onChangeFeedTab: (tab: FeedTab) => void;
}) {
  const { colors, radius, spacing } = useTheme();
  const router = useRouter();
  const greeting = getGreeting();

  // GET /notifications/unread-count, polled while the app is focused.
  const { data: unreadCount = 0 } = useUnreadNotificationCount();

  // Signed-in identity from /user/me; the session snapshot bridges the gap
  // while the query loads, and the dummy user covers logged-out previews.
  const { data: me } = useMe();
  const sessionUser = useAuthStore((s) => s.user);
  const displayName = me?.user.name ?? sessionUser?.name ?? currentUser.name;
  const myTint = useMyTint();

  const iconButton = [
    styles.iconButton,
    { backgroundColor: colors.surface, borderColor: colors.border },
  ];

  return (
    <View style={{ gap: spacing.xl }}>
      {/* Greeting row */}
      <View style={styles.headerRow}>
        <Pressable
          onPress={() => router.push('/me')}
          accessibilityRole="button"
          accessibilityLabel="Open profile"
        >
          <Avatar name={displayName} tint={myTint} size={46} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={[styles.hello, { color: colors.textMuted }]}>{greeting}</Text>
          <Text style={[styles.helloName, { color: colors.text }]}>
            {displayName.split(' ')[0]} 👋
          </Text>
        </View>
        <Pressable
          onPress={() => router.push('/search')}
          accessibilityRole="button"
          accessibilityLabel="Search people"
          style={iconButton}
        >
          <Ionicons name="search-outline" size={22} color={colors.text} />
        </Pressable>
        <Pressable
          onPress={() => router.push('/notifications')}
          accessibilityRole="button"
          accessibilityLabel="Notifications"
          style={iconButton}
        >
          <Ionicons name="notifications-outline" size={22} color={colors.text} />
          {unreadCount > 0 ? (
            <View
              style={[
                styles.bellBadge,
                { backgroundColor: colors.pink, borderColor: colors.surface },
              ]}
            >
              <Text style={styles.bellBadgeText} numberOfLines={1}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      {/* Monetization signal — earning stays visible without a dashboard */}
      <EarningsPulse />

      {/* Stories — hidden for now; there is no stories endpoint, so the rail
          runs entirely on dummy data (src/data/stories.ts). Re-enable when the
          backend ships it. */}
      {/* <StoriesRail /> */}

      {/* Composer trigger */}
      <Pressable
        onPress={() => router.push('/compose')}
        accessibilityRole="button"
        accessibilityLabel="Create a post"
        style={[
          styles.composerCard,
          { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg },
        ]}
      >
        <Text style={[styles.composerHint, { color: colors.textMuted }]} numberOfLines={1}>
          Say something amazing every post can earn
        </Text>
        <View style={[styles.composerAction, { backgroundColor: colors.surfaceAlt }]}>
          <Ionicons name="create-outline" size={18} color={colors.brand} />
        </View>
      </Pressable>

      {/* Feed filter — sits last so it reads as the header of the list below */}
      <FeedTabs value={feedTab} onChange={onChangeFeedTab} />
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerText: { flex: 1 },
  hello: { fontFamily: FONT, fontSize: 13, fontWeight: '600' },
  helloName: { fontFamily: FONT, fontSize: 20, fontWeight: '800' },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  // Sits half off the bell's top-right. minWidth (not width) lets "99+" widen
  // the pill instead of clipping, while a single digit stays a circle.
  bellBadge: {
    position: 'absolute',
    top: 4,
    right: 3,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  bellBadgeText: {
    fontFamily: FONT,
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  composerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  composerHint: { fontFamily: FONT, flex: 1, fontSize: 14, fontWeight: '500' },
  composerAction: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
