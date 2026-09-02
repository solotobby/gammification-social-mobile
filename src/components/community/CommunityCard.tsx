import { useRouter } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Community } from '../../api/communities';
import { useJoinCommunity } from '../../hooks/useCommunities';
import { formatMoney, symbolFor } from '../../hooks/useCurrency';
import { useMe } from '../../hooks/useMe';
import { useTheme } from '../../theme/ThemeProvider';
import { Avatar } from '../ui/Avatar';
import { CommunityBadge } from './CommunityBadge';
import { joinActionFor } from './communityMeta';
import { FONT } from '../../theme/fonts';

/**
 * One community in a list — avatar, name, category · members, description, and
 * the membership action.
 *
 * The button's wording follows the community's type: public ones Join outright,
 * approval ones Request to join, private ones can't be joined from the app at
 * all. Paid ones show what a member would actually be charged, which is *not*
 * the list price when the owner has chosen to pass the platform fee on — so it
 * reads `pricing.memberCharge`, the figure the backend computed.
 *
 * Membership is server state: every community response carries the viewer's own
 * block, so joining just writes the returned community back into the caches.
 */
export function CommunityCard({ community }: { community: Community }) {
  const { colors, radius } = useTheme();
  const router = useRouter();
  const join = useJoinCommunity();
  const { data: me } = useMe();

  /**
   * List rows omit the `membership` block the detail endpoint sends, so a
   * community you own would otherwise offer you a "Join" button. There's no
   * `is_owner` flag either, so ownership is derived the same way post ownership
   * is: compare the owner's id against the signed-in user's.
   */
  const membership =
    community.membership === 'none' && me?.user.id && community.owner.id === me.user.id
      ? 'owner'
      : community.membership;

  const action = joinActionFor(community.type, membership);
  const filled = membership === 'none' && !action.blocked;

  // Each community prices in its own currency — never relabel it with the
  // account default.
  const symbol = symbolFor(community.currency);
  const priceLabel =
    community.type === 'paid' && community.pricing
      ? formatMoney(community.pricing.memberCharge, symbol)
      : null;

  const label =
    priceLabel && membership === 'none' ? `${action.label} · ${priceLabel}` : action.label;

  return (
    // No accessibilityRole on the row: it holds the join button, and nested
    // <button> elements are invalid on web.
    <Pressable
      onPress={() => router.push(`/community/${community.id}`)}
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
        <Avatar name={community.name} tint={community.owner.tint} size={44} />
        <View style={styles.headerText}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {community.name}
          </Text>
          <Text style={[styles.meta, { color: colors.textMuted }]} numberOfLines={1}>
            {community.categoryName ? `${community.categoryName} · ` : ''}
            {community.members} {community.members === 1 ? 'member' : 'members'}
          </Text>
        </View>
        <CommunityBadge status={community.type} />
      </View>

      {community.description ? (
        <Text style={[styles.description, { color: colors.textSecondary }]} numberOfLines={2}>
          {community.description}
        </Text>
      ) : null}

      <View style={styles.footerRow}>
        <Text style={[styles.billing, { color: colors.textMuted }]} numberOfLines={1}>
          {/* The backend writes this label ("One-off payment", "Billed monthly"). */}
          {community.pricing?.billingLabel ?? `@${community.owner.handle}`}
        </Text>
        <Pressable
          onPress={() => {
            if (action.blocked || join.isPending) return;
            join.mutate({ id: community.id });
          }}
          disabled={action.blocked || join.isPending}
          accessibilityRole="button"
          accessibilityLabel={`${label} ${community.name}`}
          accessibilityState={{ disabled: action.blocked }}
          style={[
            styles.joinBtn,
            filled
              ? { backgroundColor: colors.brand, borderColor: colors.brand }
              : { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
            action.blocked ? { opacity: 0.6 } : null,
          ]}
        >
          {join.isPending ? (
            <ActivityIndicator size="small" color={filled ? colors.onBrand : colors.textSecondary} />
          ) : (
            <Text
              style={[
                styles.joinText,
                { color: filled ? colors.onBrand : colors.textSecondary },
              ]}
            >
              {label}
            </Text>
          )}
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
  name: { fontFamily: FONT, fontSize: 15, fontWeight: '800' },
  meta: { fontFamily: FONT, fontSize: 12, fontWeight: '600' },
  description: { fontFamily: FONT, fontSize: 13, lineHeight: 19, fontWeight: '500' },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  billing: { fontFamily: FONT, flex: 1, fontSize: 12, fontWeight: '700' },
  joinBtn: {
    paddingHorizontal: 16,
    minWidth: 88,
    height: 36,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  joinText: { fontFamily: FONT, fontSize: 13, fontWeight: '800' },
});
