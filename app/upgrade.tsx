import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackButton } from '../src/components/ui/BackButton';
import { ScreenBackground } from '../src/components/ui/ScreenBackground';
import { SUBSCRIPTION_DISCOUNT, tiers, type Tier } from '../src/data/community';
import { useTheme } from '../src/theme/ThemeProvider';

/** The dummy user's current plan (matches "Basic level" on the Me tab). */
const CURRENT_TIER: Tier['name'] = 'Basic';

/** How the plan is paid for — mirrors the web checkout's two modes. */
type Billing = 'subscription' | 'payg';

function naira(n: number): string {
  return `₦${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function TierCard({
  tier,
  billing,
  selected,
  onSelect,
}: {
  tier: Tier;
  billing: Billing;
  selected: boolean;
  onSelect: () => void;
}) {
  const { colors, brand, radius } = useTheme();
  const isCurrent = tier.name === CURRENT_TIER;
  const discounted = billing === 'subscription' && tier.price > 0;
  const payable = discounted ? Math.round(tier.price * (1 - SUBSCRIPTION_DISCOUNT)) : tier.price;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: tier.popular ? `${colors.brand}66` : colors.border,
          borderWidth: tier.popular ? 1.5 : StyleSheet.hairlineWidth,
          borderRadius: radius.lg,
        },
      ]}
    >
      {tier.popular ? (
        <LinearGradient
          colors={[brand.violetBright, brand.violet]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.popularPill, { borderRadius: radius.pill }]}
        >
          <Ionicons name="star" size={11} color={colors.onBrand} />
          <Text style={[styles.popularText, { color: colors.onBrand }]}>Most popular</Text>
        </LinearGradient>
      ) : null}

      <View style={styles.cardHeader}>
        <Text style={[styles.tierName, { color: colors.text }]}>{tier.name}</Text>
        <Text style={[styles.tagline, { color: colors.textMuted }]}>{tier.tagline}</Text>
        <View style={styles.priceRow}>
          {discounted ? (
            <Text style={[styles.priceWas, { color: colors.textMuted }]}>
              ₦{tier.price.toLocaleString()}
            </Text>
          ) : null}
          <Text style={[styles.price, { color: colors.text }]}>
            {tier.price === 0 ? 'Free' : naira(payable)}
          </Text>
          {tier.price > 0 ? (
            <Text style={[styles.priceUnit, { color: colors.textMuted }]}>/ month</Text>
          ) : null}
        </View>
        {discounted ? (
          <View style={[styles.discountPill, { backgroundColor: `${colors.mint}1A` }]}>
            <Text style={[styles.discountText, { color: colors.mint }]}>
              10% subscription discount
            </Text>
          </View>
        ) : null}
        <Text style={[styles.priceNote, { color: colors.textMuted }]}>
          {tier.price === 0
            ? 'No payment required'
            : billing === 'subscription'
              ? 'Renews monthly · cancel anytime'
              : 'Billed each month · no stored subscription'}
        </Text>
      </View>

      <View style={styles.benefits}>
        {tier.benefits.map((benefit) => (
          <View key={benefit} style={styles.benefitRow}>
            <Ionicons name="checkmark-circle" size={18} color={colors.mint} />
            <Text style={[styles.benefitText, { color: colors.textSecondary }]}>{benefit}</Text>
          </View>
        ))}
        {tier.locked?.map((benefit) => (
          <View key={benefit} style={styles.benefitRow}>
            <Ionicons name="close-circle" size={18} color={colors.dotInactive} />
            <Text style={[styles.benefitText, styles.lockedText, { color: colors.textMuted }]}>
              {benefit}
            </Text>
          </View>
        ))}
        {tier.bonus ? (
          <View style={styles.benefitRow}>
            <Ionicons name="gift" size={18} color={colors.gold} />
            <Text style={[styles.benefitText, { color: colors.textSecondary }]}>
              <Text style={styles.bonusAmount}>{naira(tier.bonus)}</Text> upgrade bonus on
              payment
            </Text>
          </View>
        ) : null}
      </View>

      {isCurrent ? (
        <View
          style={[
            styles.cta,
            { backgroundColor: colors.surfaceAlt, borderRadius: radius.pill },
          ]}
        >
          <Text style={[styles.ctaText, { color: colors.textMuted }]}>Current plan</Text>
        </View>
      ) : (
        <Pressable
          onPress={onSelect}
          accessibilityRole="button"
          accessibilityLabel={selected ? `${tier.name} selected` : `Upgrade to ${tier.name}`}
          style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
        >
          <LinearGradient
            colors={
              selected ? [colors.mint, colors.mintBright] : [brand.violetBright, brand.violet]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.cta, { borderRadius: radius.pill }]}
          >
            <Ionicons
              name={selected ? 'checkmark' : 'arrow-up-circle-outline'}
              size={18}
              color={colors.onBrand}
            />
            <Text style={[styles.ctaText, { color: colors.onBrand }]}>
              {selected
                ? 'Selected — payments coming soon'
                : billing === 'subscription'
                  ? 'Subscribe & save 10%'
                  : `Upgrade to ${tier.name}`}
            </Text>
          </LinearGradient>
        </Pressable>
      )}
    </View>
  );
}

/**
 * Upgrade level — Basic / Creator / Influencer plan cards. UI-only: picking a
 * plan just marks it selected until payments arrive with the API.
 */
export default function UpgradeScreen() {
  const { colors, radius, spacing } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<Tier['name'] | null>(null);
  const [billing, setBilling] = useState<Billing>('subscription');

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScreenBackground />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + spacing.lg,
          paddingBottom: insets.bottom + spacing.xl,
          paddingHorizontal: spacing.xl,
          gap: spacing.xl,
        }}
      >
        <View style={styles.headerRow}>
          <BackButton onPress={() => router.back()} />
          <Text style={[styles.headerTitle, { color: colors.text }]}>Upgrade level</Text>
          <View style={{ width: 44 }} />
        </View>

        <Text style={[styles.lede, { color: colors.textSecondary }]}>
          Start free. Upgrade when you want monetization, communities, and higher earning
          potential. Cancel anytime.
        </Text>

        {/* Billing mode */}
        <View style={{ gap: 10 }}>
          <View
            style={[
              styles.billingToggle,
              { backgroundColor: colors.surfaceAlt, borderRadius: radius.pill },
            ]}
          >
            {/* Short labels on purpose: "Direct subscription" plus the SAVE tag
                overflows a half-width slot on a 375pt phone. The note below
                spells the full name out. */}
            {([
              { key: 'subscription' as const, label: 'Subscription', tag: 'SAVE 10%' },
              { key: 'payg' as const, label: 'Pay as you go' },
            ]).map((mode) => {
              const active = mode.key === billing;
              return (
                <Pressable
                  key={mode.key}
                  onPress={() => setBilling(mode.key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={[
                    styles.billingOption,
                    active && { backgroundColor: colors.brand, borderRadius: radius.pill },
                  ]}
                >
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.billingText,
                      { color: active ? colors.onBrand : colors.textSecondary },
                    ]}
                  >
                    {mode.label}
                  </Text>
                  {mode.tag ? (
                    <View
                      style={[
                        styles.billingTag,
                        { backgroundColor: active ? 'rgba(255,255,255,0.22)' : colors.surface },
                      ]}
                    >
                      <Text
                        style={[
                          styles.billingTagText,
                          { color: active ? colors.onBrand : colors.mint },
                        ]}
                      >
                        {mode.tag}
                      </Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
          <Text style={[styles.billingNote, { color: colors.textMuted }]}>
            {billing === 'subscription'
              ? 'Direct subscription renews monthly with 10% off.'
              : 'Pay as you go is billed each month with no stored subscription.'}
          </Text>
        </View>

        {tiers.map((tier) => (
          <TierCard
            key={tier.name}
            tier={tier}
            billing={billing}
            selected={selected === tier.name}
            onSelect={() => setSelected(tier.name)}
          />
        ))}

        <View
          style={[
            styles.note,
            { backgroundColor: `${colors.brand}0F`, borderColor: `${colors.brand}33`, borderRadius: radius.md },
          ]}
        >
          <Ionicons name="information-circle-outline" size={20} color={colors.brand} />
          <Text style={[styles.noteText, { color: colors.textSecondary }]}>
            Plans are preview-only for now — billing goes live with the API.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  lede: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '500',
    marginTop: -8,
  },
  card: {
    padding: 20,
    gap: 18,
  },
  popularPill: {
    position: 'absolute',
    top: -12,
    right: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  popularText: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  cardHeader: { gap: 3 },
  tierName: { fontSize: 20, fontWeight: '800' },
  tagline: { fontSize: 13, fontWeight: '500' },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  price: { fontSize: 30, fontWeight: '900' },
  priceWas: { fontSize: 15, fontWeight: '700', textDecorationLine: 'line-through' },
  priceUnit: { fontSize: 13, fontWeight: '600' },
  discountPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginTop: 6,
  },
  discountText: { fontSize: 11, fontWeight: '800' },
  priceNote: { fontSize: 12, fontWeight: '600', marginTop: 6 },
  bonusAmount: { fontWeight: '900' },
  billingToggle: {
    flexDirection: 'row',
    padding: 4,
    gap: 4,
  },
  billingOption: {
    // Size to content, then split the leftover space evenly — an equal-width
    // `flex: 1` split starves the longer option (label + SAVE tag) and
    // ellipsizes it. minWidth keeps the shrink well-behaved if it ever does
    // run out of room.
    flexGrow: 1,
    flexBasis: 'auto',
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 42,
    paddingHorizontal: 8,
  },
  billingText: { flexShrink: 1, fontSize: 13, fontWeight: '800' },
  billingTag: { flexShrink: 0, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999 },
  billingTagText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.3 },
  billingNote: { fontSize: 12, lineHeight: 17, fontWeight: '500', textAlign: 'center' },
  benefits: { gap: 10 },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  benefitText: { flex: 1, fontSize: 14, fontWeight: '600' },
  lockedText: { textDecorationLine: 'line-through', fontWeight: '500' },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
  },
  ctaText: { fontSize: 14, fontWeight: '800' },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderWidth: 1,
  },
  noteText: { flex: 1, fontSize: 13, lineHeight: 19, fontWeight: '500' },
});
