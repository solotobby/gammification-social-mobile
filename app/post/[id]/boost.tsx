import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { ApiBoostPackage } from '../../../src/api/types';
import { BackButton } from '../../../src/components/ui/BackButton';
import { GradientButton } from '../../../src/components/ui/GradientButton';
import { KeyboardAwareScreen } from '../../../src/components/ui/KeyboardAwareScreen';
import { TextField } from '../../../src/components/ui/TextField';
import { Avatar } from '../../../src/components/ui/Avatar';
import { useBoostConfig, useStartBoost } from '../../../src/hooks/useBoost';
import { useCurrency } from '../../../src/hooks/useCurrency';
import { useMe, useMyAvatar, useMyTint } from '../../../src/hooks/useMe';
import { usePayKoinBalance } from '../../../src/hooks/usePayKoin';
import { useFeedbackStore } from '../../../src/stores/feedbackStore';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { FONT } from '../../../src/theme/fonts';

/**
 * Promote a post — the mobile port of the web's "Payhankey Ad Studio".
 *
 * Follows the web's three numbered steps (destination + call-to-action,
 * networks, click budget) and its live ad preview, so a creator who has boosted
 * on the web recognises this immediately.
 *
 * **Everything priced here comes from `GET .../boost/config`** — the coin rate
 * per click, the bundles, the allowed button wordings and the caller's balance.
 * Nothing is hardcoded, because the rates differ per currency exactly as the
 * subscription prices do.
 *
 * Two things the web shows are deliberately **not** reproduced: its estimated
 * impression range and estimated CTR. Neither is in the API, and the web's own
 * two figures don't agree with each other arithmetically (100 clicks at a
 * claimed 2.8–4.2% CTR is ~2,400–3,600 impressions, not the ~6,500–11,000 it
 * prints). Inventing a reach forecast on a screen whose job is to take someone's
 * money is the same mistake as an invented earnings figure — see `earnedOf`.
 * Ask the backend for real projections and this section can go in.
 */
export default function BoostPostScreen() {
  const { colors, brand, radius, spacing } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { format } = useCurrency();
  const showToast = useFeedbackStore((s) => s.showToast);
  const { data: me } = useMe();
  const myTint = useMyTint();
  const myAvatar = useMyAvatar();

  const { data: config, isLoading, isError } = useBoostConfig(id);
  // Coins are priced from the PayKoin top-up rate, NOT from the boost config's
  // own `fiat_per_pk` / `fiat_cost` — those are hard-coded to naira and
  // overstate a dollar price 100×. See the note on `BoostConfig.fiatPerCoin`.
  const { data: coinRates } = usePayKoinBalance();
  const fiatPerCoin = coinRates?.rates?.list ?? null;
  const startBoost = useStartBoost();

  const [clicks, setClicks] = useState<number | null>(null);
  const [customClicks, setCustomClicks] = useState('');
  const [cta, setCta] = useState<string | null>(null);
  const [targetUrl, setTargetUrl] = useState('');
  const [onPayhankey, setOnPayhankey] = useState(true);
  const [onPartners, setOnPartners] = useState(true);

  // Default to a bundle and the first allowed wording once the config lands — a
  // screen that opens with nothing chosen makes the user do work the server
  // already has an opinion about.
  useEffect(() => {
    if (!config) return;
    setClicks((current) => current ?? config.packages[0]?.clicks ?? config.minClicks);
    setCta((current) => current ?? config.ctaOptions[0] ?? null);
  }, [config]);

  const cost = useMemo(() => {
    if (!config || !clicks) return 0;
    // A bundle's own quoted price wins; the per-click rate covers a custom count.
    const bundle = config.packages.find((pack) => pack.clicks === clicks);
    return bundle?.pk_cost ?? clicks * config.ratePerClick;
  }, [config, clicks]);

  /** What the coins are worth in the wallet currency, or null if unknown. */
  const fiatCost = fiatPerCoin != null ? cost * fiatPerCoin : null;

  const shortfall = config ? Math.max(0, cost - config.spendable) : 0;
  const trimmedUrl = targetUrl.trim();
  const urlLooksValid = /^https?:\/\/\S+\.\S+/i.test(trimmedUrl);
  const placementChosen = onPayhankey || onPartners;
  const aboveMinimum = !!config && !!clicks && clicks >= config.minClicks;
  const ready =
    !!config && aboveMinimum && !!cta && urlLooksValid && placementChosen && shortfall === 0;

  const applyCustom = (value: string) => {
    setCustomClicks(value);
    const parsed = parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed > 0) setClicks(parsed);
  };

  const pickPackage = (pack: ApiBoostPackage) => {
    setClicks(pack.clicks);
    setCustomClicks('');
  };

  const submit = () => {
    if (!ready || !id || !clicks || !cta) return;
    startBoost.mutate(
      {
        postId: id,
        payload: {
          target_url: trimmedUrl,
          cta,
          clicks,
          platform_payhankey: onPayhankey,
          platform_partner: onPartners,
        },
      },
      {
        onSuccess: () => {
          showToast('Your post is being promoted.', 'success');
          router.replace('/boosts');
        },
      },
    );
  };

  if (isLoading) {
    return (
      <KeyboardAwareScreen>
        <Header onBack={() => router.back()} />
        <View style={styles.center}>
          <ActivityIndicator color={colors.brand} />
        </View>
      </KeyboardAwareScreen>
    );
  }

  if (isError || !config) {
    return (
      <KeyboardAwareScreen>
        <Header onBack={() => router.back()} />
        <View style={styles.center}>
          <Text style={[styles.muted, { color: colors.textMuted }]}>
            Couldn't load promotion options for this post.
          </Text>
        </View>
      </KeyboardAwareScreen>
    );
  }

  // The backend can switch boosting off wholesale; say so rather than rendering
  // a form whose submit is guaranteed to fail.
  if (!config.enabled) {
    return (
      <KeyboardAwareScreen>
        <Header onBack={() => router.back()} />
        <View style={styles.center}>
          <Ionicons name="megaphone-outline" size={30} color={colors.textMuted} />
          <Text style={[styles.muted, { color: colors.textMuted }]}>
            Promotions aren't available right now.
          </Text>
        </View>
      </KeyboardAwareScreen>
    );
  }

  if (config.postIsBoosted) {
    return (
      <KeyboardAwareScreen>
        <Header onBack={() => router.back()} />
        <View style={styles.center}>
          <Ionicons name="checkmark-circle-outline" size={30} color={colors.mint} />
          <Text style={[styles.muted, { color: colors.textMuted }]}>
            This post already has a promotion running.
          </Text>
          <Pressable onPress={() => router.replace('/boosts')} accessibilityRole="button">
            <Text style={[styles.link, { color: colors.brand }]}>Manage your promotions</Text>
          </Pressable>
        </View>
      </KeyboardAwareScreen>
    );
  }

  const postBody = config.post?.content ?? '';
  const myName = me?.user.name ?? 'You';
  const rateLine = `${config.ratePerClick} PK${
    fiatPerCoin != null ? ` (${format(config.ratePerClick * fiatPerCoin)})` : ''
  } / click`;

  return (
    <KeyboardAwareScreen>
      <Header onBack={() => router.back()} />

      {/* Hero — the web's dark "Ad Studio" banner, with the post it will promote. */}
      <LinearGradient
        colors={[brand.indigo, brand.violet]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, { borderRadius: radius.lg }]}
      >
        <View style={styles.heroBadges}>
          <HeroBadge label="AD STUDIO" />
          <HeroBadge label={rateLine.toUpperCase()} />
        </View>
        <Text style={styles.heroTitle}>Supercharge your post's reach</Text>
        <Text style={styles.heroSub}>
          Turn this post into a sponsored ad across Payhankey and verified partner
          sites. You only pay when someone actually clicks.
        </Text>
        {postBody ? (
          <View style={styles.heroPost}>
            <Avatar name={myName} tint={myTint} uri={myAvatar} size={26} />
            <Text style={styles.heroPostText} numberOfLines={2}>
              {postBody}
            </Text>
          </View>
        ) : null}
      </LinearGradient>

      {/* 1 — destination + button wording */}
      <StepHeader index={1} title="Target link & button" sub="Where a click takes people" />
      <TextField
        icon="link-outline"
        placeholder="https://yourwebsite.com/product"
        value={targetUrl}
        onChangeText={setTargetUrl}
        keyboardType="url"
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="URL"
      />
      {trimmedUrl && !urlLooksValid ? (
        <Text style={[styles.fieldHint, { color: colors.pink }]}>
          Enter a full link, starting with https://
        </Text>
      ) : null}

      <Text style={[styles.microLabel, { color: colors.textMuted }]}>BUTTON ACTION</Text>
      <View style={styles.chips}>
        {/* Only the server's own wordings — anything else is rejected. */}
        {config.ctaOptions.map((option) => {
          const active = option === cta;
          return (
            <Pressable
              key={option}
              onPress={() => setCta(option)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[
                styles.chip,
                {
                  borderRadius: radius.pill,
                  borderColor: active ? colors.brand : colors.border,
                  backgroundColor: active ? `${colors.brand}14` : colors.surface,
                },
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: active ? colors.brand : colors.textSecondary },
                ]}
              >
                {option}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* 2 — networks */}
      <StepHeader
        index={2}
        title="Advertising networks"
        sub="Choose where the sponsored post runs"
      />
      <View style={styles.networks}>
        <NetworkCard
          icon="flame"
          title="Payhankey Feed"
          body="Native in-feed placement on creator timelines and discovery."
          tag="Highly active audience"
          selected={onPayhankey}
          onToggle={() => setOnPayhankey((value) => !value)}
        />
        <NetworkCard
          icon="globe-outline"
          title="Partner Websites"
          body="High-volume click placements across the external partner network."
          tag="Guaranteed traffic"
          selected={onPartners}
          onToggle={() => setOnPartners((value) => !value)}
        />
      </View>
      {!placementChosen ? (
        <Text style={[styles.fieldHint, { color: colors.pink }]}>
          Pick at least one network to run on.
        </Text>
      ) : null}

      {/* 3 — budget */}
      <StepHeader
        index={3}
        title="Click budget"
        sub={`Fixed rate: ${rateLine}`}
      />
      <View style={styles.packages}>
        {config.packages.map((pack) => {
          const active = pack.clicks === clicks && !customClicks;
          return (
            <Pressable
              key={pack.clicks}
              onPress={() => pickPackage(pack)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${pack.clicks} clicks for ${pack.pk_cost} PayKoin`}
              style={[
                styles.package,
                {
                  borderRadius: radius.md,
                  borderColor: active ? colors.brand : colors.border,
                  backgroundColor: active ? `${colors.brand}0F` : colors.surface,
                },
              ]}
            >
              <Text style={[styles.packageClicks, { color: colors.text }]}>
                {pack.clicks.toLocaleString()}
              </Text>
              <Text style={[styles.packageUnit, { color: colors.textMuted }]}>clicks</Text>
              <Text style={[styles.packageCost, { color: colors.brand }]}>
                {pack.pk_cost.toLocaleString()} PK
              </Text>
              {fiatPerCoin != null ? (
                <Text style={[styles.packageFiat, { color: colors.textMuted }]}>
                  {format(pack.pk_cost * fiatPerCoin)}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <View
        style={[
          styles.customRow,
          { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md },
        ]}
      >
        <Text style={[styles.customLabel, { color: colors.textSecondary }]}>
          Or enter custom clicks (min. {config.minClicks})
        </Text>
        <View style={styles.customInputWrap}>
          <TextInput
            value={customClicks}
            onChangeText={applyCustom}
            placeholder={String(config.minClicks)}
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
            selectionColor={colors.brand}
            style={[
              styles.customInput,
              { backgroundColor: colors.surfaceAlt, color: colors.text, borderColor: colors.border },
            ]}
          />
          <Text style={[styles.customUnit, { color: colors.textMuted }]}>clicks</Text>
        </View>
      </View>
      {clicks && !aboveMinimum ? (
        <Text style={[styles.fieldHint, { color: colors.pink }]}>
          The minimum is {config.minClicks} clicks.
        </Text>
      ) : null}

      {/* Live preview — what the ad will look like in someone's feed. */}
      <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>LIVE AD PREVIEW</Text>
      <View
        style={[
          styles.preview,
          { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md },
        ]}
      >
        <View style={styles.previewHead}>
          <Avatar name={myName} tint={myTint} uri={myAvatar} size={34} />
          <View style={styles.previewWho}>
            <View style={styles.previewNameRow}>
              <Text style={[styles.previewName, { color: colors.text }]} numberOfLines={1}>
                {myName}
              </Text>
              <View style={[styles.sponsoredTag, { backgroundColor: `${colors.gold}22` }]}>
                <Text style={[styles.sponsoredTagText, { color: colors.gold }]}>Sponsored</Text>
              </View>
            </View>
            <Text style={[styles.previewHandle, { color: colors.textMuted }]} numberOfLines={1}>
              @{me?.user.username ?? 'you'} · Just now
            </Text>
          </View>
        </View>
        {postBody ? (
          <Text style={[styles.previewBody, { color: colors.text }]} numberOfLines={3}>
            {postBody}
          </Text>
        ) : null}
        <View
          style={[
            styles.previewCta,
            { backgroundColor: colors.surfaceAlt, borderRadius: radius.sm },
          ]}
        >
          <View style={styles.previewDest}>
            <Text style={[styles.previewDestLabel, { color: colors.textMuted }]}>
              DESTINATION
            </Text>
            <Text style={[styles.previewDestUrl, { color: colors.textSecondary }]} numberOfLines={1}>
              {hostOf(trimmedUrl) || 'yourwebsite.com'}
            </Text>
          </View>
          <View style={[styles.previewBtn, { backgroundColor: colors.brand }]}>
            <Text style={[styles.previewBtnText, { color: colors.onBrand }]}>
              {cta ?? 'Learn More'}
            </Text>
            <Ionicons name="arrow-forward" size={12} color={colors.onBrand} />
          </View>
        </View>
      </View>

      {/* What the campaign guarantees. Only figures the API actually reports —
          see the note at the top of this file about the web's estimates. */}
      <View
        style={[
          styles.summary,
          { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md },
        ]}
      >
        <SummaryRow label="Guaranteed clicks" value={`${(clicks ?? 0).toLocaleString()}`} />
        <SummaryRow label="Rate per click" value={rateLine} />
        <SummaryRow
          label="Networks"
          value={
            onPayhankey && onPartners
              ? 'Payhankey & Partners'
              : onPayhankey
                ? 'Payhankey Feed'
                : onPartners
                  ? 'Partner Websites'
                  : 'None selected'
          }
        />
      </View>

      <View style={styles.assurances}>
        {[
          ['shield-checkmark-outline', 'Only verified human visits are counted'],
          ['stats-chart-outline', 'Track clicks in your post analytics'],
        ].map(([icon, text]) => (
          <View key={text} style={styles.assurance}>
            <Ionicons name={icon as never} size={14} color={colors.mint} />
            <Text style={[styles.assuranceText, { color: colors.textMuted }]}>{text}</Text>
          </View>
        ))}
      </View>

      {/* Total + launch */}
      <View
        style={[
          styles.total,
          { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md },
        ]}
      >
        <Text style={[styles.totalValue, { color: colors.text }]}>
          {cost.toLocaleString()} PayKoin
        </Text>
        <Text style={[styles.totalSub, { color: colors.textMuted }]}>
          {fiatCost != null ? `${format(fiatCost)} · ` : ''}
          {(clicks ?? 0).toLocaleString()} guaranteed clicks
        </Text>
        <Text
          style={[
            styles.totalBalance,
            { color: shortfall > 0 ? colors.pink : colors.textSecondary },
          ]}
        >
          Balance: {config.spendable.toLocaleString()} PK
          {shortfall > 0 ? ` · ${shortfall.toLocaleString()} PK short` : ''}
        </Text>
      </View>

      {shortfall > 0 ? (
        <Pressable
          onPress={() => router.push('/paykoin')}
          accessibilityRole="button"
          style={[
            styles.topUpCta,
            { backgroundColor: colors.surfaceAlt, borderRadius: radius.pill },
          ]}
        >
          <Ionicons name="add-circle-outline" size={18} color={colors.text} />
          <Text style={[styles.topUpCtaText, { color: colors.text }]}>
            Top up {shortfall.toLocaleString()} PK to launch
          </Text>
        </Pressable>
      ) : (
        <GradientButton
          label="Launch boost campaign"
          icon="rocket-outline"
          onPress={submit}
          loading={startBoost.isPending}
          disabled={!ready}
          style={styles.cta}
        />
      )}
    </KeyboardAwareScreen>
  );
}

/** "https://shop.example.com/x" → "shop.example.com". */
function hostOf(url: string): string {
  const match = url.match(/^https?:\/\/([^/?#]+)/i);
  return match ? match[1] : '';
}

function Header({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.header}>
      <BackButton onPress={onBack} />
    </View>
  );
}

function HeroBadge({ label }: { label: string }) {
  return (
    <View style={styles.heroBadge}>
      <Text style={styles.heroBadgeText}>{label}</Text>
    </View>
  );
}

function StepHeader({ index, title, sub }: { index: number; title: string; sub: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.stepHeader}>
      <View style={[styles.stepNumber, { backgroundColor: `${colors.brand}1A` }]}>
        <Text style={[styles.stepNumberText, { color: colors.brand }]}>{index}</Text>
      </View>
      <View style={styles.stepCopy}>
        <Text style={[styles.stepTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.stepSub, { color: colors.textMuted }]}>{sub}</Text>
      </View>
    </View>
  );
}

function NetworkCard({
  icon,
  title,
  body,
  tag,
  selected,
  onToggle,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  tag: string;
  selected: boolean;
  onToggle: () => void;
}) {
  const { colors, radius } = useTheme();
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={title}
      style={[
        styles.network,
        {
          borderRadius: radius.md,
          borderColor: selected ? colors.brand : colors.border,
          backgroundColor: selected ? `${colors.brand}0F` : colors.surface,
        },
      ]}
    >
      <View style={styles.networkTop}>
        <View
          style={[
            styles.networkCheck,
            {
              backgroundColor: selected ? colors.brand : 'transparent',
              borderColor: selected ? colors.brand : colors.border,
            },
          ]}
        >
          {selected ? <Ionicons name="checkmark" size={12} color={colors.onBrand} /> : null}
        </View>
        <Text style={[styles.networkTitle, { color: colors.text }]}>{title}</Text>
      </View>
      <Text style={[styles.networkBody, { color: colors.textMuted }]}>{body}</Text>
      <View style={[styles.networkTag, { backgroundColor: colors.surfaceAlt }]}>
        <Ionicons name={icon} size={11} color={colors.gold} />
        <Text style={[styles.networkTagText, { color: colors.textSecondary }]}>{tag}</Text>
      </View>
    </Pressable>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.summaryRow}>
      <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.summaryValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', marginBottom: 8 },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
  muted: { fontFamily: FONT, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  link: { fontFamily: FONT, fontSize: 14, fontWeight: '700' },

  hero: { padding: 18, gap: 10, marginTop: 6 },
  heroBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  heroBadge: {
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  heroBadgeText: {
    fontFamily: FONT,
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: '#FFFFFF',
  },
  heroTitle: { fontFamily: FONT, fontSize: 22, fontWeight: '800', color: '#FFFFFF', marginTop: 2 },
  heroSub: {
    fontFamily: FONT,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.78)',
  },
  heroPost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
    padding: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  heroPostText: { fontFamily: FONT, flex: 1, fontSize: 12.5, fontWeight: '500', color: '#FFFFFF' },

  stepHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 26, marginBottom: 12 },
  stepNumber: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  stepNumberText: { fontFamily: FONT, fontSize: 13, fontWeight: '800' },
  stepCopy: { flex: 1 },
  stepTitle: { fontFamily: FONT, fontSize: 16, fontWeight: '800' },
  stepSub: { fontFamily: FONT, fontSize: 12, fontWeight: '500', marginTop: 1 },

  microLabel: {
    fontFamily: FONT,
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: 16,
    marginBottom: 8,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { paddingVertical: 8, paddingHorizontal: 13, borderWidth: 1 },
  chipText: { fontFamily: FONT, fontSize: 12.5, fontWeight: '700' },

  networks: { gap: 10 },
  network: { padding: 14, borderWidth: 1.5, gap: 7 },
  networkTop: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  networkCheck: {
    width: 19,
    height: 19,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  networkTitle: { fontFamily: FONT, fontSize: 15, fontWeight: '800' },
  networkBody: { fontFamily: FONT, fontSize: 12.5, lineHeight: 18, fontWeight: '500' },
  networkTag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 999,
  },
  networkTagText: { fontFamily: FONT, fontSize: 11, fontWeight: '700' },

  packages: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  package: {
    // Two to a row: each tile carries four lines, which a quarter-width column
    // can't hold without wrapping the price.
    width: '48%',
    alignItems: 'center',
    paddingVertical: 13,
    borderWidth: 1.5,
  },
  packageClicks: { fontFamily: FONT, fontSize: 19, fontWeight: '800' },
  packageUnit: { fontFamily: FONT, fontSize: 11, fontWeight: '600' },
  packageCost: { fontFamily: FONT, fontSize: 13, fontWeight: '800', marginTop: 5 },
  packageFiat: { fontFamily: FONT, fontSize: 11, fontWeight: '600', marginTop: 1 },

  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 10,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  customLabel: { fontFamily: FONT, flex: 1, fontSize: 12.5, fontWeight: '600' },
  customInputWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  customInput: {
    fontFamily: FONT,
    width: 74,
    height: 38,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 0,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
    borderWidth: StyleSheet.hairlineWidth,
  },
  customUnit: { fontFamily: FONT, fontSize: 12, fontWeight: '600' },

  sectionLabel: {
    fontFamily: FONT,
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: 26,
    marginBottom: 10,
  },
  preview: { padding: 14, borderWidth: StyleSheet.hairlineWidth, gap: 10 },
  previewHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  previewWho: { flex: 1, gap: 2 },
  previewNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  previewName: { fontFamily: FONT, fontSize: 14, fontWeight: '800' },
  sponsoredTag: { paddingVertical: 2, paddingHorizontal: 7, borderRadius: 999 },
  sponsoredTagText: { fontFamily: FONT, fontSize: 10, fontWeight: '800' },
  previewHandle: { fontFamily: FONT, fontSize: 11.5, fontWeight: '500' },
  previewBody: { fontFamily: FONT, fontSize: 13.5, lineHeight: 19, fontWeight: '500' },
  previewCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    padding: 10,
  },
  previewDest: { flex: 1, gap: 1 },
  previewDestLabel: { fontFamily: FONT, fontSize: 9, fontWeight: '800', letterSpacing: 0.7 },
  previewDestUrl: { fontFamily: FONT, fontSize: 12, fontWeight: '600' },
  previewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  previewBtnText: { fontFamily: FONT, fontSize: 12, fontWeight: '800' },

  summary: { marginTop: 18, padding: 16, borderWidth: StyleSheet.hairlineWidth, gap: 10 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  summaryLabel: { fontFamily: FONT, fontSize: 13, fontWeight: '600' },
  summaryValue: { fontFamily: FONT, fontSize: 13, fontWeight: '800' },

  assurances: { gap: 7, marginTop: 14 },
  assurance: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  assuranceText: { fontFamily: FONT, fontSize: 12, fontWeight: '500' },

  total: { marginTop: 20, padding: 16, borderWidth: StyleSheet.hairlineWidth, gap: 3 },
  totalValue: { fontFamily: FONT, fontSize: 24, fontWeight: '800' },
  totalSub: { fontFamily: FONT, fontSize: 13, fontWeight: '600' },
  totalBalance: { fontFamily: FONT, fontSize: 12, fontWeight: '700', marginTop: 5 },

  fieldHint: { fontFamily: FONT, fontSize: 12.5, fontWeight: '500', marginTop: 8, paddingHorizontal: 4 },
  topUpCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    marginTop: 16,
  },
  topUpCtaText: { fontFamily: FONT, fontSize: 15, fontWeight: '700' },
  cta: { width: '100%', marginTop: 16 },
});
