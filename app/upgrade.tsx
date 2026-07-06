import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackButton } from '../src/components/ui/BackButton';
import { ScreenBackground } from '../src/components/ui/ScreenBackground';
import { tiers, type Tier } from '../src/data/community';
import { useTheme } from '../src/theme/ThemeProvider';

/** The dummy user's current plan (matches "Basic level" on the Profile tab). */
const CURRENT_TIER: Tier['name'] = 'Basic';

function TierCard({
  tier,
  selected,
  onSelect,
}: {
  tier: Tier;
  selected: boolean;
  onSelect: () => void;
}) {
  const { colors, brand, radius } = useTheme();
  const isCurrent = tier.name === CURRENT_TIER;

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
          <Text style={[styles.price, { color: colors.text }]}>
            ₦{tier.price.toLocaleString()}
          </Text>
          <Text style={[styles.priceUnit, { color: colors.textMuted }]}>/ month</Text>
        </View>
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
              {selected ? 'Selected — payments coming soon' : `Upgrade to ${tier.name}`}
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
          Higher levels unlock monetization, withdrawals, and more reach for every post.
        </Text>

        {tiers.map((tier) => (
          <TierCard
            key={tier.name}
            tier={tier}
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
    gap: 6,
    marginTop: 8,
  },
  price: { fontSize: 30, fontWeight: '900' },
  priceUnit: { fontSize: 13, fontWeight: '600' },
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
