import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import type { SlideVisualKey } from '../../data/onboarding';
import { useTheme } from '../../theme/ThemeProvider';
import { FONT, FONT_WEIGHTS } from '../../theme/fonts';

/**
 * The illustration above each slide's copy: a small vignette of the app's own
 * surfaces — a post and its engagement, an earnings tile, the Koin balance, a
 * chat thread.
 *
 * These are *static illustrations*, not live UI: nothing is pressable, none of
 * it comes from the API, and none of it reuses `PostCard` or the wallet screens
 * (which all expect a signed-in account). Onboarding runs pre-auth.
 *
 * **No money figures anywhere.** There is no account `baseCurrency` to format
 * against yet, and hardcoding the mock's naira would mislabel the app for a
 * dollar account — the exact trap `useCurrency` exists to avoid. Engagement
 * counts, percentages and Koin are currency-neutral, so those are what the
 * vignettes show.
 */

/** Intrinsic height of the stage, so every slide's copy starts on the same line. */
export const VISUAL_HEIGHT = 216;

const STAGE_WIDTH = 300;

type Props = {
  visual: SlideVisualKey;
  /** Shrinks the whole stage on narrow phones instead of reflowing it. */
  scale?: number;
};

export function SlideVisual({ visual, scale = 1 }: Props) {
  const Vignette = {
    engagement: EngagementVisual,
    earnings: EarningsVisual,
    koin: KoinVisual,
    connect: ConnectVisual,
  }[visual];

  return (
    <View style={[styles.stage, { height: VISUAL_HEIGHT * scale }]}>
      <View style={[styles.stageInner, { transform: [{ scale }] }]}>
        <Vignette />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Shared pieces
// ---------------------------------------------------------------------------

function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, radius } = useTheme();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: radius.lg,
          shadowColor: colors.shadow,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** A floating pill — the "+247 Likes" / "You received a gift" chips. */
function Chip({
  icon,
  tone,
  label,
  sub,
  style,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tone: string;
  label: string;
  sub?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, radius } = useTheme();
  return (
    <View
      style={[
        styles.chip,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: radius.pill,
          shadowColor: colors.shadow,
        },
        style,
      ]}
    >
      <View style={[styles.chipIcon, { backgroundColor: tone }]}>
        <Ionicons name={icon} size={12} color="#FFFFFF" />
      </View>
      <View>
        <Text style={[styles.chipLabel, { color: colors.text }]}>{label}</Text>
        {sub ? (
          <Text style={[styles.chipSub, { color: colors.textMuted }]}>{sub}</Text>
        ) : null}
      </View>
    </View>
  );
}

function Stat({
  icon,
  label,
  tone,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  tone: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={13} color={tone} />
      <Text style={[styles.statLabel, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Vignettes
// ---------------------------------------------------------------------------

/** Slide 1 — a post, and the engagement landing on it. */
function EngagementVisual() {
  const { colors, brand, radius } = useTheme();

  return (
    <View style={styles.vignette}>
      <Card style={{ width: STAGE_WIDTH - 40 }}>
        <View style={styles.postHead}>
          <LinearGradient
            colors={[brand.violet, brand.violetBright]}
            style={[styles.avatar, { borderRadius: radius.pill }]}
          >
            <Text style={styles.avatarText}>AS</Text>
          </LinearGradient>
          <View style={styles.postWho}>
            <View style={styles.postNameRow}>
              <Text style={[styles.postName, { color: colors.text }]}>Ada Sunshine</Text>
              <Ionicons name="checkmark-circle" size={13} color={colors.brand} />
            </View>
            <Text style={[styles.postHandle, { color: colors.textMuted }]}>
              @adasunshine · 2h
            </Text>
          </View>
        </View>

        <Text style={[styles.postBody, { color: colors.textSecondary }]}>
          Good content. Better energy. ✨ Grateful for this community! 💜
        </Text>

        <View style={[styles.postStats, { borderTopColor: colors.border }]}>
          <Stat icon="heart" label="2.4K" tone={brand.pink} />
          <Stat icon="chatbubble" label="412" tone={brand.violet} />
          <Stat icon="eye" label="18.6K" tone={colors.textMuted} />
        </View>
      </Card>

      <Chip
        icon="heart"
        tone={brand.pink}
        label="+247"
        sub="Likes"
        style={{ position: 'absolute', top: 0, right: 0 }}
      />
      <Chip
        icon="chatbubble"
        tone={brand.violet}
        label="+38"
        sub="Comments"
        style={{ position: 'absolute', bottom: 4, left: 0 }}
      />
    </View>
  );
}

/** Slide 2 — what the engagement turns into. */
function EarningsVisual() {
  const { colors, brand } = useTheme();

  // Illustrative only — a rising month, drawn as fractions of the chart height.
  const bars = [0.35, 0.5, 0.42, 0.68, 0.82, 1];

  return (
    <View style={styles.vignette}>
      <Card style={{ width: STAGE_WIDTH - 40 }}>
        <View style={styles.rowBetween}>
          <View>
            <Text style={[styles.tileLabel, { color: colors.textMuted }]}>
              ENGAGEMENT
            </Text>
            <Text style={[styles.tileValue, { color: colors.text }]}>18.6K</Text>
          </View>
          <View style={[styles.delta, { backgroundColor: `${brand.mint}1F` }]}>
            <Ionicons name="arrow-up" size={12} color={brand.mint} />
            <Text style={[styles.deltaText, { color: brand.mint }]}>+320%</Text>
          </View>
        </View>

        <View style={styles.chart}>
          {bars.map((v, i) => (
            <LinearGradient
              key={i}
              colors={
                i === bars.length - 1
                  ? [brand.violetBright, brand.violet]
                  : [`${brand.violet}55`, `${brand.violet}22`]
              }
              style={[styles.bar, { height: 44 * v }]}
            />
          ))}
        </View>

        <Text style={[styles.tileFoot, { color: colors.textMuted }]}>
          Eligible engagement · viral posts · referrals
        </Text>
      </Card>

      <Chip
        icon="trophy"
        tone={brand.gold}
        label="Reward unlocked"
        sub="Viral post · 24h"
        style={{ position: 'absolute', bottom: 0, right: 0 }}
      />
    </View>
  );
}

/** Slide 3 — Koin: the balance, and one landing in it. */
function KoinVisual() {
  const { colors, brand, radius } = useTheme();

  return (
    <View style={styles.vignette}>
      <LinearGradient
        colors={[brand.violet, brand.violetBright]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.koinCard,
          { borderRadius: 24, shadowColor: brand.violet, width: STAGE_WIDTH - 40 },
        ]}
      >
        <LinearGradient
          colors={['#F7CE68', brand.gold]}
          style={[styles.coin, { borderRadius: radius.pill }]}
        >
          <Text style={styles.coinMark}>P</Text>
        </LinearGradient>

        <Text style={styles.koinLabel}>YOUR KOIN BALANCE</Text>
        <Text style={styles.koinValue}>1,250 Koin</Text>
      </LinearGradient>

      <Chip
        icon="arrow-up"
        tone={brand.mint}
        label="+120 Koin"
        sub="Just now"
        style={{ position: 'absolute', bottom: 0, left: 4 }}
      />
      <Chip
        icon="gift"
        tone={brand.pink}
        label="Gift sent"
        style={{ position: 'absolute', top: 2, right: 0 }}
      />
    </View>
  );
}

/** Slide 4 — the people side: chat, and a gift arriving. */
function ConnectVisual() {
  const { colors, brand, radius } = useTheme();

  return (
    <View style={[styles.vignette, styles.chatColumn]}>
      <View style={[styles.bubbleRow, { justifyContent: 'flex-start' }]}>
        <View
          style={[
            styles.bubble,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderTopLeftRadius: 6,
              shadowColor: colors.shadow,
            },
          ]}
        >
          <Text style={[styles.bubbleText, { color: colors.text }]}>
            This post is fire! 🔥
          </Text>
        </View>
      </View>

      <View style={[styles.bubbleRow, { justifyContent: 'flex-end' }]}>
        <LinearGradient
          colors={[brand.violet, brand.violetBright]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.bubble,
            { borderTopRightRadius: 6, shadowColor: brand.violet },
          ]}
        >
          <Text style={[styles.bubbleText, { color: '#FFFFFF' }]}>
            Let's collab sometime! 💜
          </Text>
        </LinearGradient>
      </View>

      <View style={[styles.bubbleRow, { justifyContent: 'flex-start' }]}>
        <View
          style={[
            styles.giftRow,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: radius.lg,
              shadowColor: colors.shadow,
            },
          ]}
        >
          <View style={[styles.chipIcon, { backgroundColor: brand.pink }]}>
            <Ionicons name="gift" size={12} color="#FFFFFF" />
          </View>
          <View>
            <Text style={[styles.chipLabel, { color: colors.text }]}>
              You received a gift 🎁
            </Text>
            <Text style={[styles.chipSub, { color: colors.textMuted }]}>
              from @tobicreates · 2m ago
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stageInner: {
    width: STAGE_WIDTH,
    height: VISUAL_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vignette: {
    width: STAGE_WIDTH,
    height: VISUAL_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // --- shared -------------------------------------------------------------
  card: {
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 10,
    shadowOpacity: 0.14,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderWidth: StyleSheet.hairlineWidth,
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  chipIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipLabel: {
    fontFamily: FONT,
    fontSize: 12.5,
    fontWeight: '700',
  },
  chipSub: {
    fontFamily: FONT,
    fontSize: 10,
    fontWeight: '500',
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  // --- post ---------------------------------------------------------------
  postHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  avatar: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: FONT,
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  postWho: {
    flex: 1,
  },
  postNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  postName: {
    fontFamily: FONT,
    fontSize: 13,
    fontWeight: '700',
  },
  postHandle: {
    fontFamily: FONT,
    fontSize: 11,
    fontWeight: '500',
  },
  postBody: {
    fontFamily: FONT,
    fontSize: 12.5,
    lineHeight: 18,
  },
  postStats: {
    flexDirection: 'row',
    gap: 18,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statLabel: {
    fontFamily: FONT,
    fontSize: 11.5,
    fontWeight: '600',
  },

  // --- earnings -----------------------------------------------------------
  tileLabel: {
    fontFamily: FONT,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  tileValue: {
    fontFamily: FONT_WEIGHTS.extrabold,
    fontSize: 26,
    letterSpacing: -0.6,
    marginTop: 2,
  },
  delta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 999,
  },
  deltaText: {
    fontFamily: FONT,
    fontSize: 12,
    fontWeight: '700',
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    height: 44,
  },
  bar: {
    flex: 1,
    borderRadius: 5,
  },
  tileFoot: {
    fontFamily: FONT,
    fontSize: 10.5,
    fontWeight: '600',
  },

  // --- koin ---------------------------------------------------------------
  koinCard: {
    alignItems: 'center',
    paddingVertical: 22,
    paddingHorizontal: 18,
    gap: 4,
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 10,
  },
  coin: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  coinMark: {
    fontFamily: FONT_WEIGHTS.extrabold,
    fontSize: 26,
    color: '#7A4B06',
  },
  koinLabel: {
    fontFamily: FONT,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: 'rgba(255,255,255,0.75)',
  },
  koinValue: {
    fontFamily: FONT_WEIGHTS.extrabold,
    fontSize: 26,
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },

  // --- connect ------------------------------------------------------------
  chatColumn: {
    justifyContent: 'center',
    gap: 10,
  },
  bubbleRow: {
    flexDirection: 'row',
    width: STAGE_WIDTH - 20,
  },
  bubble: {
    maxWidth: '78%',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  bubbleText: {
    fontFamily: FONT,
    fontSize: 13,
    fontWeight: '600',
  },
  giftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
});
