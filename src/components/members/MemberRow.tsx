import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { useTheme } from '../../theme/ThemeProvider';
import { Avatar } from '../ui/Avatar';
import { useToggleFollow } from '../../hooks/useUser';
import { useAuthStore } from '../../stores/authStore';
import { useFeedbackStore } from '../../stores/feedbackStore';
import { useFollowStore } from '../../stores/followStore';
import type { Member } from '../../data/community';

/**
 * A member result row with a follow toggle — shared by Discover, the search
 * screen, and anywhere else people are listed. Tapping the row opens the
 * member's profile; the follow button hits /user/toggle/follow optimistically.
 *
 * The search / trending endpoints don't report whether the signed-in user
 * already follows each result, so the button starts from the device's follow
 * store (or an `initiallyFollowing` override) and the returned state reconciles
 * it. Every toggle is mirrored back into that store, which is what fills Home's
 * Following tab — see src/stores/followStore.ts.
 */
export function MemberRow({
  member,
  initiallyFollowing,
}: {
  member: Member;
  initiallyFollowing?: boolean;
}) {
  const { colors, radius } = useTheme();
  const router = useRouter();
  const toggleFollow = useToggleFollow();
  const showToast = useFeedbackStore((s) => s.showToast);
  const knownFollowing = useFollowStore((s) => !!s.following[member.id]);
  const setStoredFollowing = useFollowStore((s) => s.setFollowing);
  const [following, setFollowing] = useState(initiallyFollowing ?? knownFollowing);

  // You can't follow yourself — hide the button when this row is the signed-in
  // user. Matched on either identifier: not every list endpoint returns ids
  // from the same shape, but the handle is always the username.
  const me = useAuthStore((s) => s.user);
  const isMe =
    !!me &&
    (member.id === me.id || member.handle.toLowerCase() === me.username.toLowerCase());

  const onFollow = () => {
    if (toggleFollow.isPending) return;
    const next = !following;
    setFollowing(next); // optimistic
    setStoredFollowing(member.id, next);
    toggleFollow.mutate(member.id, {
      onSuccess: (data) => {
        setFollowing(data.following);
        setStoredFollowing(member.id, data.following);
      },
      onError: () => {
        setFollowing(!next);
        setStoredFollowing(member.id, !next);
        showToast("Couldn't update follow — please try again.", 'error');
      },
    });
  };

  return (
    // No accessibilityRole on the row: it holds the follow button, and nested
    // <button> elements are invalid on web.
    <Pressable
      onPress={() => router.push(`/member/${member.handle}`)}
      style={({ pressed }) => [
        styles.memberRow,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: radius.md,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <Avatar name={member.name} tint={member.tint} size={44} />
      <Pressable
        onPress={() => router.push(`/member/${member.handle}`)}
        accessibilityRole="button"
        accessibilityLabel={`View ${member.name}'s profile`}
        style={styles.memberText}
      >
        <Text style={[styles.memberName, { color: colors.text }]} numberOfLines={1}>
          {member.name}
        </Text>
        <Text style={[styles.memberMeta, { color: colors.textMuted }]} numberOfLines={1}>
          @{member.handle} · {member.followers} followers
        </Text>
      </Pressable>
      {isMe ? null : (
        <Pressable
          onPress={onFollow}
          accessibilityRole="button"
          accessibilityLabel={following ? `Unfollow ${member.name}` : `Follow ${member.name}`}
          style={[
            styles.followBtn,
            following
              ? { backgroundColor: colors.surfaceAlt, borderColor: colors.border }
              : { backgroundColor: colors.brand, borderColor: colors.brand },
          ]}
        >
          <Text
            style={[
              styles.followText,
              { color: following ? colors.textSecondary : colors.onBrand },
            ]}
          >
            {following ? 'Following' : 'Follow'}
          </Text>
        </Pressable>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  memberText: { flex: 1, gap: 2 },
  memberName: { fontSize: 15, fontWeight: '800' },
  memberMeta: { fontSize: 13, fontWeight: '500' },
  followBtn: {
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  followText: { fontSize: 13, fontWeight: '800' },
});
