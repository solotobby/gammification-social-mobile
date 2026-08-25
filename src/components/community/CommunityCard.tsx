import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  membershipOf,
  toggleMembership,
  type Community,
} from '../../data/communities';
import { useTheme } from '../../theme/ThemeProvider';
import { Avatar } from '../ui/Avatar';
import { CommunityBadge } from './CommunityBadge';

/**
 * One community in a list — avatar, name, category · members, description, and
 * the membership action. The button's wording follows the status: open
 * communities Join outright, gated ones Request to join.
 *
 * Membership lives in the shared session store (src/data/communities.ts) so the
 * card, the detail screen, and the Discover rail never disagree.
 */
export function CommunityCard({ community }: { community: Community }) {
  const { colors, radius } = useTheme();
  const router = useRouter();
  const [membership, setMembership] = useState(() => membershipOf(community));

  const memberCount = community.people.length;
  const gated = community.status === 'approval' || community.status === 'private';

  const actionLabel =
    membership === 'joined'
      ? 'Joined'
      : membership === 'requested'
        ? 'Requested'
        : gated
          ? 'Request to join'
          : community.status === 'paid'
            ? `Join · ₦${community.price?.toLocaleString()}`
            : 'Join';

  const filled = membership === 'none';

  return (
    // No accessibilityRole on the row: it holds the join button, and nested
    // <button> elements are invalid on web.
    <Pressable
      onPress={() => router.push(`/community/${community.slug}`)}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: radius.lg,
          opacity: pressed ? 0.92 : 1,
        },
      ]}
    >
      <View style={styles.headerRow}>
        <Avatar name={community.name} tint={community.tint} size={44} />
        <View style={styles.headerText}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {community.name}
          </Text>
          <Text style={[styles.meta, { color: colors.textMuted }]} numberOfLines={1}>
            {community.category} · {memberCount} {memberCount === 1 ? 'member' : 'members'}
          </Text>
        </View>
        <CommunityBadge status={community.status} />
      </View>

      {community.description ? (
        <Text style={[styles.description, { color: colors.textSecondary }]} numberOfLines={2}>
          {community.description}
        </Text>
      ) : null}

      <View style={styles.footerRow}>
        <Text style={[styles.postCount, { color: colors.textMuted }]}>
          {community.posts.length} {community.posts.length === 1 ? 'post' : 'posts'}
        </Text>
        <Pressable
          onPress={() => setMembership(toggleMembership(community))}
          accessibilityRole="button"
          accessibilityLabel={`${actionLabel} ${community.name}`}
          style={[
            styles.joinBtn,
            filled
              ? { backgroundColor: colors.brand, borderColor: colors.brand }
              : { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
          ]}
        >
          <Text
            style={[
              styles.joinText,
              { color: filled ? colors.onBrand : colors.textSecondary },
            ]}
          >
            {actionLabel}
          </Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerText: { flex: 1, gap: 2 },
  name: { fontSize: 15, fontWeight: '800' },
  meta: { fontSize: 12, fontWeight: '600' },
  description: { fontSize: 13, lineHeight: 19, fontWeight: '500' },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  postCount: { fontSize: 12, fontWeight: '700' },
  joinBtn: {
    paddingHorizontal: 16,
    height: 36,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  joinText: { fontSize: 13, fontWeight: '800' },
});
