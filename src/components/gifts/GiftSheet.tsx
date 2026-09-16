import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GIFT_TIERS, tierLabel } from '../../api/gifts';
import type { ApiGiftArtifact, GiftPostType } from '../../api/types';
import { usePostGifts, useGiftCatalog, useSendGift } from '../../hooks/useGifts';
import { useFeedbackStore } from '../../stores/feedbackStore';
import { useTheme } from '../../theme/ThemeProvider';
import { FONT } from '../../theme/fonts';

/**
 * Send a gift on someone's post — the PayKoin spend surface.
 *
 * Modelled on the web's gift modal (balance chip with a top-up route, tiles
 * grouped by tier, anything above the balance dimmed) with one deliberate
 * difference: the web sends on a single tap, this selects first and sends from
 * a footer button. Coins are bought with real money, and a mis-tap on a phone
 * is far likelier than on a mouse — one tap should not be able to spend.
 *
 * Own posts never reach here: the backend refuses them ("You cannot gift your
 * own post.") and `PostCard` hides the action, exactly as it does for bookmarks.
 */
export function GiftSheet({
  visible,
  postId,
  postType = 'timeline',
  recipientName,
  onClose,
}: {
  visible: boolean;
  postId: string | undefined;
  postType?: GiftPostType;
  recipientName: string;
  onClose: () => void;
}) {
  const { colors, brand, radius, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const showToast = useFeedbackStore((s) => s.showToast);

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const catalog = useGiftCatalog();
  // Opens the sheet with one request: this carries the post's gifts *and* the
  // viewer's spendable balance.
  const postGifts = usePostGifts(postId, postType, visible);
  const sendGift = useSendGift();

  const spendable = postGifts.data?.spendable ?? 0;
  const gifts = catalog.data ?? [];
  const selected = gifts.find((gift) => gift.id === selectedId) ?? null;
  const canAfford = selected ? selected.price <= spendable : false;

  /** Tier order is fixed; anything with an unknown tier lands in a final group. */
  const grouped = useMemo(() => {
    const byTier = new Map<string, ApiGiftArtifact[]>();
    for (const gift of gifts) {
      const tier = gift.tier ?? 'other';
      byTier.set(tier, [...(byTier.get(tier) ?? []), gift]);
    }
    const known = GIFT_TIERS.filter((tier) => byTier.has(tier)).map((tier) => ({
      tier: tier as string,
      gifts: byTier.get(tier)!,
    }));
    const extra = [...byTier.keys()]
      .filter((tier) => !GIFT_TIERS.includes(tier as (typeof GIFT_TIERS)[number]))
      .map((tier) => ({ tier, gifts: byTier.get(tier)! }));
    return [...known, ...extra];
  }, [gifts]);

  const close = () => {
    setSelectedId(null);
    onClose();
  };

  const send = () => {
    if (!selected || !postId || !canAfford || sendGift.isPending) return;
    sendGift.mutate(
      { artifact_id: selected.id, post_id: postId, post_type: postType },
      {
        onSuccess: () => {
          close();
          showToast(`${selected.emoji} ${selected.name} sent to ${recipientName}.`, 'success');
        },
      },
    );
  };

  const topUp = () => {
    close();
    router.push('/paykoin');
  };

  const received = postGifts.data?.recent ?? [];
  const totalReceived = postGifts.data?.total ?? 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close} accessibilityLabel="Close gifts" />
      <View style={styles.sheetWrap} pointerEvents="box-none">
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              borderTopLeftRadius: radius.lg,
              borderTopRightRadius: radius.lg,
              paddingBottom: insets.bottom + spacing.md,
            },
          ]}
        >
          <View style={[styles.grabber, { backgroundColor: colors.border }]} />

          {/* Header — who it's for, and what you have to spend. */}
          <View style={styles.headerRow}>
            <View style={styles.headerCopy}>
              <Text style={[styles.overline, { color: colors.textMuted }]}>SEND A GIFT</Text>
              <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                Support {recipientName}
              </Text>
            </View>
            <Pressable
              onPress={close}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={[styles.close, { backgroundColor: colors.surfaceAlt }]}
            >
              <Ionicons name="close" size={18} color={colors.text} />
            </Pressable>
          </View>

          <LinearGradient
            colors={[brand.violetBright, brand.violet]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.balanceCard, { borderRadius: radius.md }]}
          >
            <View>
              <Text style={styles.balanceLabel}>YOUR PAYKOIN</Text>
              <Text style={styles.balanceValue}>
                {postGifts.isLoading ? '—' : `${spendable.toLocaleString()} PK`}
              </Text>
            </View>
            <Pressable
              onPress={topUp}
              accessibilityRole="button"
              style={styles.topUp}
              hitSlop={6}
            >
              <Ionicons name="add" size={15} color="#FFFFFF" />
              <Text style={styles.topUpText}>Top up</Text>
            </Pressable>
          </LinearGradient>

          {/* What the post has already received, when it has. */}
          {totalReceived > 0 ? (
            <View style={styles.receivedRow}>
              <Text style={[styles.receivedText, { color: colors.textMuted }]}>
                {totalReceived} {totalReceived === 1 ? 'gift' : 'gifts'} so far
              </Text>
              <View style={styles.receivedEmojis}>
                {received.slice(0, 6).map((gift, index) => (
                  <Text key={`${gift.artifact_id ?? index}`} style={styles.receivedEmoji}>
                    {gift.emoji ?? '🎁'}
                  </Text>
                ))}
              </View>
            </View>
          ) : null}

          {catalog.isLoading ? (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.brand} />
            </View>
          ) : (
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={{ paddingBottom: spacing.md }}
              showsVerticalScrollIndicator={false}
            >
              {grouped.map(({ tier, gifts: tierGifts }) => (
                <View key={tier} style={styles.tierBlock}>
                  <Text style={[styles.tierLabel, { color: colors.textMuted }]}>
                    {tierLabel(tier).toUpperCase()}
                  </Text>
                  <View style={styles.grid}>
                    {tierGifts.map((gift) => {
                      const affordable = gift.price <= spendable;
                      const isSelected = gift.id === selectedId;
                      return (
                        <Pressable
                          key={gift.id}
                          onPress={() => setSelectedId(gift.id)}
                          accessibilityRole="button"
                          accessibilityLabel={`${gift.name}, ${gift.price} PayKoin${
                            affordable ? '' : ', more than your balance'
                          }`}
                          style={[
                            styles.tile,
                            {
                              backgroundColor: isSelected ? colors.surfaceAlt : 'transparent',
                              borderColor: isSelected ? colors.brand : colors.border,
                              borderRadius: radius.md,
                            },
                            // Dimmed rather than disabled: tapping still selects
                            // it, and the footer then explains the shortfall and
                            // offers a top-up — more useful than a dead tile.
                            !affordable && styles.tileDim,
                          ]}
                        >
                          <Text style={styles.tileEmoji}>{gift.emoji}</Text>
                          <Text
                            style={[styles.tileName, { color: colors.text }]}
                            numberOfLines={1}
                          >
                            {gift.name}
                          </Text>
                          <Text
                            style={[
                              styles.tilePrice,
                              { color: affordable ? colors.gold : colors.textMuted },
                            ]}
                          >
                            {gift.price} PK
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))}
            </ScrollView>
          )}

          {/* Footer: confirm, or explain why not. */}
          <View style={styles.footer}>
            {selected && !canAfford ? (
              <Pressable
                onPress={topUp}
                accessibilityRole="button"
                style={[
                  styles.cta,
                  { backgroundColor: colors.surfaceAlt, borderRadius: radius.pill },
                ]}
              >
                <Ionicons name="add-circle-outline" size={18} color={colors.text} />
                <Text style={[styles.ctaText, { color: colors.text }]}>
                  Top up {(selected.price - spendable).toLocaleString()} PK to send this
                </Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={send}
                disabled={!selected || sendGift.isPending}
                accessibilityRole="button"
                style={[styles.ctaWrap, { borderRadius: radius.pill }]}
              >
                <LinearGradient
                  colors={
                    selected
                      ? [brand.violetBright, brand.violet]
                      : [colors.border, colors.border]
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.cta, { borderRadius: radius.pill }]}
                >
                  {sendGift.isPending ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Text
                        style={[
                          styles.ctaText,
                          { color: selected ? '#FFFFFF' : colors.textMuted },
                        ]}
                      >
                        {selected
                          ? `Send ${selected.emoji} ${selected.name} · ${selected.price} PK`
                          : 'Pick a gift'}
                      </Text>
                    </>
                  )}
                </LinearGradient>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: { maxHeight: '88%', paddingHorizontal: 18 },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginTop: 10 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginTop: 14,
    gap: 12,
  },
  headerCopy: { flex: 1 },
  overline: { fontFamily: FONT, fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  title: { fontFamily: FONT, fontSize: 21, fontWeight: '800', marginTop: 3 },
  close: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  balanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 14,
  },
  balanceLabel: {
    fontFamily: FONT,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.9,
    color: 'rgba(255,255,255,0.75)',
  },
  balanceValue: { fontFamily: FONT, fontSize: 22, fontWeight: '800', color: '#FFFFFF', marginTop: 2 },
  topUp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 7,
    paddingHorizontal: 13,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  topUpText: { fontFamily: FONT, fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  receivedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  receivedText: { fontFamily: FONT, fontSize: 13, fontWeight: '600' },
  receivedEmojis: { flexDirection: 'row', gap: 2 },
  receivedEmoji: { fontSize: 16 },
  loading: { paddingVertical: 48, alignItems: 'center' },
  scroll: { marginTop: 14 },
  tierBlock: { marginBottom: 18 },
  tierLabel: { fontFamily: FONT, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: {
    // Four to a row at phone widths, wrapping to as many rows as the tier needs.
    // 22.5% not 25%: four tiles plus the three 8pt gaps between them have to fit
    // inside the sheet's own padding, and 23.5% overflowed by a couple of points
    // — which silently drops the row to three.
    width: '22.5%',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderWidth: 1.5,
  },
  tileDim: { opacity: 0.4 },
  tileEmoji: { fontSize: 26 },
  tileName: { fontFamily: FONT, fontSize: 11, fontWeight: '600', marginTop: 6, textAlign: 'center' },
  tilePrice: { fontFamily: FONT, fontSize: 11, fontWeight: '800', marginTop: 2 },
  footer: { paddingTop: 10 },
  ctaWrap: { overflow: 'hidden' },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    paddingHorizontal: 18,
  },
  ctaText: { fontFamily: FONT, fontSize: 15, fontWeight: '700' },
});
