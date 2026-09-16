import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useMe } from '../../hooks/useMe';
import { useTheme } from '../../theme/ThemeProvider';
import { FONT } from '../../theme/fonts';

/**
 * The author-only strip under their own posts — a port of the web profile's
 * `pk-boost-strip` plus its "Upgrade to monetize this post" line.
 *
 * Two states, exactly as the web has them:
 *
 * - **Not boosted** — "Boost Post" tag, the rate per click, and a `Boost →`
 *   button into the ad studio.
 * - **Boosted** — "Boost Active" tag, "Ad running across Payhankey & Partner
 *   Websites", and `Manage →` into the campaign list.
 *
 * Shown only on the author's own posts, and only on surfaces where the author
 * is looking at their own work (the profile and the post screen) — not in the
 * middle of the Home feed, where a promo row under every one of your posts is
 * noise rather than a tool.
 */
export function PostBoostStrip({
  postId,
  boosted,
  /** Coins per click, when the caller knows it. Falls back to a generic line. */
  ratePerClick,
}: {
  postId: string;
  boosted?: boolean;
  ratePerClick?: number;
}) {
  const { colors, radius } = useTheme();
  const router = useRouter();
  const { data: me } = useMe();

  // Monetization is a level feature, and Basic is the only level without it:
  // `GET /user/levels` lists "Content monetization" first under **Creator**
  // ("Everything in Creator" carries it up to Influencer), while Basic's
  // features stop at posting, Rolls, the dashboard and joining communities.
  // So the upgrade line renders for Basic and disappears the moment they
  // upgrade. `/user/me`'s `level` is the only place the current one is reported.
  const canMonetize = !!me && me.level !== 'Basic';

  return (
    <View style={styles.wrap}>
      <View
        style={[
          styles.strip,
          { backgroundColor: colors.surfaceAlt, borderRadius: radius.sm },
        ]}
      >
        <View style={[styles.tag, { backgroundColor: `${colors.brand}22` }]}>
          <Text style={[styles.tagText, { color: colors.brand }]}>
            {boosted ? '🚀 Boost Active' : '🚀 Boost Post'}
          </Text>
        </View>

        <Text style={[styles.copy, { color: colors.textSecondary }]} numberOfLines={2}>
          {boosted
            ? 'Ad running across Payhankey & Partner Websites'
            : ratePerClick
              ? `Get clicks on Payhankey & Partner Websites · ${ratePerClick} PK / click`
              : 'Get clicks on Payhankey & Partner Websites'}
        </Text>

        <Pressable
          onPress={() => router.push(boosted ? '/boosts' : `/post/${postId}/boost`)}
          accessibilityRole="button"
          accessibilityLabel={boosted ? 'Manage this promotion' : 'Boost this post'}
          style={[
            styles.button,
            { borderColor: `${colors.brand}55`, backgroundColor: colors.surface },
          ]}
        >
          <Text style={[styles.buttonText, { color: colors.brand }]}>
            {boosted ? 'Manage' : 'Boost'}
          </Text>
          <Ionicons name="arrow-forward" size={11} color={colors.brand} />
        </Pressable>
      </View>

      {canMonetize ? null : (
        <Pressable
          onPress={() => router.push('/upgrade')}
          accessibilityRole="button"
          hitSlop={6}
          style={styles.monetise}
        >
          <Text style={[styles.monetiseText, { color: colors.brand }]}>
            💰 Upgrade to monetize this post
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  tag: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 999 },
  tagText: { fontFamily: FONT, fontSize: 11, fontWeight: '800' },
  copy: { fontFamily: FONT, flex: 1, fontSize: 11.5, fontWeight: '500', lineHeight: 15 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 11,
    borderRadius: 999,
    borderWidth: 1,
  },
  buttonText: { fontFamily: FONT, fontSize: 12, fontWeight: '800' },
  monetise: { alignSelf: 'flex-start' },
  monetiseText: { fontFamily: FONT, fontSize: 12, fontWeight: '600' },
});
