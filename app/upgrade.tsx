import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { sortLevels, type ApiLevel, type ApiLevelsData } from '../src/api/levels';
import { BackButton } from '../src/components/ui/BackButton';
import { ScreenBackground } from '../src/components/ui/ScreenBackground';
import { useLevelCheckout, useLevels } from '../src/hooks/useLevels';
import { formatMoney, resolveSymbol } from '../src/hooks/useCurrency';
import { useTheme } from '../src/theme/ThemeProvider';
import { FONT } from '../src/theme/fonts';

/**
 * Upgrade level — `GET /user/levels`, with payment through
 * `POST /user/levels/{id}/checkout`.
 *
 * Everything shown is the backend's: prices, the currency to print them in, the
 * feature list, the badge, and the per-level media limits. This screen used to
 * hardcode ₦ prices, a "Basic" current tier and a 10% subscription discount —
 * all three are wrong for a USD account, and the discount is currently 0.
 *
 * All of it is currency-split, and the dollar account is the unrepresentative
 * one: naira has a Korapay provider, two billing modes and a real 10% discount,
 * while every USD level currently reports `payment.available: false`. The
 * billing-mode toggle therefore renders off `billing.modes.length`, not off an
 * assumption about how many modes exist.
 */
export default function UpgradeScreen() {
  const { colors, radius, spacing } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { data, isLoading, isError, refetch, isRefetching } = useLevels();
  const checkout = useLevelCheckout();

  const levels = data ? sortLevels(data.levels) : [];
  /**
   * `currency_symbol` is not reliably a symbol — a USD account gets "$" but an
   * NGN one gets the literal string "NGN". `resolveSymbol` maps a bare currency
   * code to its glyph so naira renders as ₦ rather than "NGN1,680".
   */
  const symbol = resolveSymbol(data?.currency_symbol) ?? '$';

  /**
   * Billing mode. Only offered when the account actually has a choice —
   * `billing.modes` is `["subscription"]` on USD but `["subscription","payg"]`
   * on NGN, and the two charge **different amounts** (₦1,512 vs ₦1,680), so on
   * an account that supports both this is a price control, not decoration.
   */
  const modes = data?.billing.modes ?? [];
  const [pickedMode, setPickedMode] = useState<string | null>(null);
  const mode = pickedMode ?? data?.billing.default_mode ?? 'subscription';

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

        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.brand} />
          </View>
        ) : isError ? (
          <View style={styles.center}>
            <Ionicons name="cloud-offline-outline" size={30} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              Couldn't load the plans.
            </Text>
            <Pressable onPress={() => refetch()} accessibilityRole="button">
              <Text style={[styles.retry, { color: colors.brand }]}>
                {isRefetching ? 'Retrying…' : 'Try again'}
              </Text>
            </Pressable>
          </View>
        ) : (
          <>
            {data?.subscription ? <CurrentPlan data={data} /> : null}

            {modes.length > 1 ? (
              <View style={{ gap: 10 }}>
                <View
                  style={[
                    styles.billingToggle,
                    { backgroundColor: colors.surfaceAlt, borderRadius: radius.pill },
                  ]}
                >
                  {modes.map((option) => {
                    const active = option === mode;
                    return (
                      <Pressable
                        key={option}
                        onPress={() => setPickedMode(option)}
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
                          {option === 'payg' ? 'Pay as you go' : 'Subscription'}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={[styles.billingNote, { color: colors.textMuted }]}>
                  {mode === 'payg'
                    ? 'Billed once each period, with no stored subscription.'
                    : data?.billing.subscription_discount_percent
                      ? `Renews automatically, ${data.billing.subscription_discount_percent}% cheaper than pay as you go.`
                      : 'Renews automatically — cancel anytime.'}
                </Text>
              </View>
            ) : null}

            {levels.map((level) => (
              <LevelCard
                key={level.id}
                level={level}
                symbol={symbol}
                mode={mode}
                busy={checkout.isPending && checkout.variables?.levelId === level.id}
                disabled={checkout.isPending}
                onUpgrade={() => checkout.mutate({ levelId: level.id, billingMode: mode })}
              />
            ))}

            <View
              style={[
                styles.note,
                {
                  backgroundColor: `${colors.brand}0F`,
                  borderColor: `${colors.brand}33`,
                  borderRadius: radius.md,
                },
              ]}
            >
              <Ionicons name="lock-closed-outline" size={20} color={colors.brand} />
              <Text style={[styles.noteText, { color: colors.textSecondary }]}>
                Payments are handled by our payment provider on their own secure page.
                Payhankey never sees your card details.
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

/** Where the account sits today, plus when it renews. */
function CurrentPlan({ data }: { data: ApiLevelsData }) {
  const { colors, radius } = useTheme();
  const sub = data.subscription!;
  const renews = sub.next_payment_date
    ? new Date(sub.next_payment_date).toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null;

  return (
    <View
      style={[
        styles.currentCard,
        { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md },
      ]}
    >
      <View style={styles.currentRow}>
        <Text style={[styles.currentLabel, { color: colors.textMuted }]}>Current plan</Text>
        <Text style={[styles.currentValue, { color: colors.text }]}>{sub.plan_name}</Text>
      </View>
      {renews ? (
        <View style={styles.currentRow}>
          <Text style={[styles.currentLabel, { color: colors.textMuted }]}>Renews</Text>
          <Text style={[styles.currentValue, { color: colors.textSecondary }]}>{renews}</Text>
        </View>
      ) : null}
    </View>
  );
}

function LevelCard({
  level,
  symbol,
  mode,
  busy,
  disabled,
  onUpgrade,
}: {
  level: ApiLevel;
  symbol: string;
  mode: string;
  busy: boolean;
  disabled: boolean;
  onUpgrade: () => void;
}) {
  const { colors, brand, radius } = useTheme();
  const price = level.pricing;

  /**
   * **Show what checkout actually bills.**
   *
   * `pricing.subscription_price` claims a discounted figure (1.08 vs a 1.2
   * `list_price`), but two other signals contradict it: the account reports
   * `subscription_discount_percent: 0`, and `POST .../checkout` — with
   * `billing_mode: "subscription"` — initialises for the **list price** (1.2 and
   * 5, verified live 2026-09-03). Advertising 1.08 and then charging 1.2 is a
   * false price promise, and a wrong number on a money surface is worse than a
   * plain one, so the list price is the headline.
   *
   * The discount is honoured the moment the backend states one explicitly:
   * `subscription_discount_percent > 0` is the single switch, because that's the
   * field the checkout amount should follow. Re-check the charged amount before
   * trusting `subscription_price` again.
   */
  const discountPercent = price.subscription_discount_percent;
  // Pay-as-you-go always bills the list price; only a subscription can discount.
  const discounted =
    mode !== 'payg' && discountPercent > 0 && price.subscription_price < price.list_price;
  const payable = discounted ? price.subscription_price : price.list_price;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: level.badge ? `${colors.brand}66` : colors.border,
          borderWidth: level.badge ? 1.5 : StyleSheet.hairlineWidth,
          borderRadius: radius.lg,
        },
      ]}
    >
      {/* The badge is backend copy ("Most popular"), not a client guess. */}
      {level.badge ? (
        <LinearGradient
          colors={[brand.violetBright, brand.violet]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.popularPill, { borderRadius: radius.pill }]}
        >
          <Ionicons name="star" size={11} color={colors.onBrand} />
          <Text style={[styles.popularText, { color: colors.onBrand }]}>{level.badge}</Text>
        </LinearGradient>
      ) : null}

      <View style={styles.cardHeader}>
        <Text style={[styles.tierName, { color: colors.text }]}>{level.name}</Text>
        <Text style={[styles.tagline, { color: colors.textMuted }]}>{level.tagline}</Text>
        <View style={styles.priceRow}>
          {discounted ? (
            <Text style={[styles.priceWas, { color: colors.textMuted }]}>
              {formatMoney(price.list_price, symbol)}
            </Text>
          ) : null}
          <Text style={[styles.price, { color: colors.text }]}>
            {level.is_free ? 'Free' : formatMoney(payable, symbol)}
          </Text>
          {!level.is_free ? (
            <Text style={[styles.priceUnit, { color: colors.textMuted }]}>
              / {price.interval.replace(/ly$/, '')}
            </Text>
          ) : null}
        </View>
        {discounted ? (
          <View style={[styles.discountPill, { backgroundColor: `${colors.mint}1A` }]}>
            <Text style={[styles.discountText, { color: colors.mint }]}>
              Save {discountPercent}% on subscription
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.benefits}>
        {level.features.map((feature) => (
          <View key={feature} style={styles.benefitRow}>
            <Ionicons name="checkmark-circle" size={18} color={colors.mint} />
            <Text style={[styles.benefitText, { color: colors.textSecondary }]}>{feature}</Text>
          </View>
        ))}

        {/* Concrete limits, straight from the level — these are the numbers that
            actually gate the composer. */}
        {level.media.images.allowed ? (
          <View style={styles.benefitRow}>
            <Ionicons name="image-outline" size={18} color={colors.textMuted} />
            <Text style={[styles.benefitText, { color: colors.textSecondary }]}>
              Up to {level.media.images.max}{' '}
              {level.media.images.max === 1 ? 'image' : 'images'} per post
            </Text>
          </View>
        ) : null}
        {level.media.video.allowed ? (
          <View style={styles.benefitRow}>
            <Ionicons name="videocam-outline" size={18} color={colors.textMuted} />
            <Text style={[styles.benefitText, { color: colors.textSecondary }]}>
              Video posts up to {level.media.video.max_seconds}s
            </Text>
          </View>
        ) : null}
        {price.reg_bonus > 0 ? (
          <View style={styles.benefitRow}>
            <Ionicons name="gift" size={18} color={colors.gold} />
            <Text style={[styles.benefitText, { color: colors.textSecondary }]}>
              <Text style={styles.bonusAmount}>{formatMoney(price.reg_bonus, symbol)}</Text>{' '}
              signup bonus
            </Text>
          </View>
        ) : null}
      </View>

      {level.is_current ? (
        <View
          style={[styles.cta, { backgroundColor: colors.surfaceAlt, borderRadius: radius.pill }]}
        >
          <Ionicons name="checkmark-circle" size={18} color={colors.mint} />
          <Text style={[styles.ctaText, { color: colors.textSecondary }]}>Current plan</Text>
        </View>
      ) : level.payment.available ? (
        <Pressable
          onPress={onUpgrade}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={`Upgrade to ${level.name}`}
          accessibilityState={{ disabled, busy }}
          style={({ pressed }) => [{ opacity: pressed || disabled ? 0.85 : 1 }]}
        >
          <LinearGradient
            colors={[brand.violetBright, brand.violet]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.cta, { borderRadius: radius.pill }]}
          >
            {busy ? (
              <ActivityIndicator size="small" color={colors.onBrand} />
            ) : (
              <>
                <Ionicons name="arrow-up-circle-outline" size={18} color={colors.onBrand} />
                <Text style={[styles.ctaText, { color: colors.onBrand }]}>
                  Upgrade to {level.name}
                </Text>
              </>
            )}
          </LinearGradient>
        </Pressable>
      ) : (
        // Not current and not payable — i.e. a level below the one you're on.
        // The backend decides this via `payment.available`; the app doesn't
        // guess at downgrade rules it has no endpoint for.
        <View
          style={[styles.cta, { backgroundColor: colors.surfaceAlt, borderRadius: radius.pill }]}
        >
          <Text style={[styles.ctaText, { color: colors.textMuted }]}>
            {level.is_downgrade ? 'Included in your plan' : 'Not available'}
          </Text>
        </View>
      )}
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
  headerTitle: { fontFamily: FONT, fontSize: 18, fontWeight: '800' },
  lede: { fontFamily: FONT, fontSize: 14, lineHeight: 21, fontWeight: '500' },
  center: { alignItems: 'center', gap: 10, paddingVertical: 40 },
  emptyText: { fontFamily: FONT, fontSize: 14, fontWeight: '600' },
  retry: { fontFamily: FONT, fontSize: 14, fontWeight: '800' },

  billingToggle: { flexDirection: 'row', padding: 4, gap: 4 },
  billingOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
  },
  billingText: { fontFamily: FONT, fontSize: 13, fontWeight: '800' },
  billingNote: { fontFamily: FONT, fontSize: 12, lineHeight: 17, fontWeight: '500' },
  currentCard: { padding: 14, gap: 8, borderWidth: StyleSheet.hairlineWidth },
  currentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  currentLabel: { fontFamily: FONT, fontSize: 13, fontWeight: '600' },
  currentValue: { fontFamily: FONT, fontSize: 14, fontWeight: '800' },

  card: { padding: 18, gap: 16 },
  popularPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  popularText: { fontFamily: FONT, fontSize: 11, fontWeight: '800' },
  cardHeader: { gap: 6 },
  tierName: { fontFamily: FONT, fontSize: 20, fontWeight: '800' },
  tagline: { fontFamily: FONT, fontSize: 13, lineHeight: 19, fontWeight: '500' },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 7, marginTop: 4 },
  // Money never renders in FONT_MONO — Space Mono has no ₦ glyph.
  priceWas: {
    fontFamily: FONT,
    fontSize: 15,
    fontWeight: '600',
    textDecorationLine: 'line-through',
  },
  price: { fontFamily: FONT, fontSize: 26, fontWeight: '800' },
  priceUnit: { fontFamily: FONT, fontSize: 13, fontWeight: '600' },
  discountPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  discountText: { fontFamily: FONT, fontSize: 11, fontWeight: '800' },
  benefits: { gap: 9 },
  benefitRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  benefitText: { fontFamily: FONT, flex: 1, fontSize: 13, lineHeight: 19, fontWeight: '500' },
  bonusAmount: { fontFamily: FONT, fontWeight: '800' },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    height: 48,
  },
  ctaText: { fontFamily: FONT, fontSize: 14, fontWeight: '800' },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    padding: 14,
    borderWidth: 1,
  },
  noteText: { fontFamily: FONT, flex: 1, fontSize: 12, lineHeight: 18, fontWeight: '500' },
});
