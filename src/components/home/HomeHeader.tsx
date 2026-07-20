import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { currentUser, notifications } from '../../data/community';
import { useMe, useMyTint } from '../../hooks/useMe';
import { useAuthStore } from '../../stores/authStore';
import { useTheme } from '../../theme/ThemeProvider';
import { StoriesRail } from '../stories/StoriesRail';
import { Avatar } from '../ui/Avatar';

/**
 * Everything above the feed on Home: greeting row (profile, search,
 * notifications), the stories rail, and the composer trigger.
 */
function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function HomeHeader() {
  const { colors, radius, spacing } = useTheme();
  const router = useRouter();
  const hasUnread = notifications.some((n) => n.unread);
  const greeting = getGreeting();

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
          onPress={() => router.push('/profile')}
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
          {hasUnread ? (
            <View style={[styles.bellDot, { backgroundColor: colors.pink, borderColor: colors.surface }]} />
          ) : null}
        </Pressable>
      </View>

      {/* Stories */}
      <StoriesRail />

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
  hello: { fontSize: 13, fontWeight: '600' },
  helloName: { fontSize: 20, fontWeight: '800' },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  bellDot: {
    position: 'absolute',
    top: 10,
    right: 11,
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 1.5,
  },
  composerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  composerHint: { flex: 1, fontSize: 14, fontWeight: '500' },
  composerAction: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
