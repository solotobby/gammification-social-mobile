import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ApiError } from '../../src/api/client';
import type {
  ApiBillingInterval,
  ApiBillingType,
  ApiCommunityType,
  ApiFeePayer,
} from '../../src/api/types';
import { FieldLabel } from '../../src/components/ui/FieldLabel';
import { GradientButton } from '../../src/components/ui/GradientButton';
import { KeyboardAwareScreen } from '../../src/components/ui/KeyboardAwareScreen';
import { SelectField } from '../../src/components/ui/SelectField';
import { TextField } from '../../src/components/ui/TextField';
import { STATUS_META } from '../../src/components/community/communityMeta';
import { useCommunityCategories, useCreateCommunity } from '../../src/hooks/useCommunities';
import { useCurrency } from '../../src/hooks/useCurrency';
import { useFeedbackStore } from '../../src/stores/feedbackStore';
import { useTheme } from '../../src/theme/ThemeProvider';
import { FONT } from '../../src/theme/fonts';

const DESCRIPTION_MAX = 1000;
const TYPES: ApiCommunityType[] = ['public', 'private', 'paid', 'approval'];

/**
 * The platform's cut of every payment into a paid community. The backend is the
 * authority — it returns `platform_fee_percent` on the created community's
 * `pricing` block — but the split has to be previewed *before* anything exists
 * to read it from, so this mirrors the rate the web's create modal states.
 */
const PLATFORM_FEE_PERCENT = 10;

/**
 * Currencies whose paid communities can be billed on a repeat cycle.
 *
 * Recurring billing is only wired up on the dollar rail: creating a paid
 * community with `billing_type: "subscription"` on a naira account is rejected
 * outright — 422, `billing_type`: "Subscription billing is not available for
 * NGN communities. Use one_off." (verified live 2026-09-03). No endpoint
 * reports which currencies *do* support it, so this is an allowlist rather than
 * a naira exclusion: a currency we haven't confirmed is offered one-off only,
 * which is always accepted. Add a code here once the backend takes it.
 */
const SUBSCRIPTION_CURRENCIES = ['USD'];

const BILLING_TYPES: { value: ApiBillingType; label: string; blurb: string }[] = [
  {
    value: 'one_off',
    label: 'One-off payment',
    blurb: 'Members pay once and keep access.',
  },
  {
    value: 'subscription',
    label: 'Subscription',
    blurb: 'Members are billed again every cycle to stay in.',
  },
];

/**
 * The cadences the API accepts. `yearly`, `annually` and `daily` are all
 * rejected with "The selected billing interval is invalid", so the picker
 * offers exactly these three.
 */
const BILLING_INTERVALS: { value: ApiBillingInterval; label: string; unit: string }[] = [
  { value: 'weekly', label: 'Weekly', unit: 'week' },
  { value: 'monthly', label: 'Monthly', unit: 'month' },
  { value: 'quarterly', label: 'Quarterly', unit: 'quarter' },
];

const FEE_PAYERS: { value: ApiFeePayer; label: string; blurb: string }[] = [
  {
    value: 'creator',
    label: "I'll cover the fee",
    blurb: "It's deducted from what you receive — members pay exactly the price above.",
  },
  {
    value: 'members',
    label: 'My members will cover it',
    blurb: 'The fee is added on top, so you still receive the full price above.',
  },
];

/**
 * Create a community — the mobile port of the web's create modal, against
 * `POST /communities`.
 *
 * The form branches on **type**, and paid branches again on **billing type**:
 *
 * ```
 * public / private / approval → name, description, category
 * paid                        → + price, fee payer, billing type
 *   └ subscription            → + billing interval (weekly | monthly | quarterly)
 * ```
 *
 * The server enforces the same tree (`monthly_fee`, `fee_payer` and
 * `billing_type` are "required for paid communities"; `billing_interval` is
 * "required for subscription communities"), so the client validates it up front
 * rather than round-tripping one missing field at a time. The price is in the
 * account's wallet currency — its **minimum is currency-dependent** and only the
 * server knows it, so a too-low price is left to come back as a field error.
 *
 * The billing-type branch is **currency-gated**: subscriptions are dollar-only
 * (see `SUBSCRIPTION_CURRENCIES`), so on a naira account the paid branch stops
 * at one-off and the choice isn't offered.
 */
export default function CreateCommunityScreen() {
  const { colors, radius, spacing } = useTheme();
  const router = useRouter();
  const showToast = useFeedbackStore((s) => s.showToast);
  const { code: currencyCode, symbol, format } = useCurrency();

  const { data: categories, isLoading: loadingCategories } = useCommunityCategories();
  const createMutation = useCreateCommunity();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [type, setType] = useState<ApiCommunityType>('public');
  const [pickedBillingType, setPickedBillingType] = useState<ApiBillingType>('one_off');
  const [billingInterval, setBillingInterval] = useState<ApiBillingInterval>('monthly');
  const [feePayer, setFeePayer] = useState<ApiFeePayer>('creator');
  const [price, setPrice] = useState('');
  const [submitted, setSubmitted] = useState(false);
  /** Field errors the server rejected the last attempt with (e.g. the minimum). */
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const descriptionRef = useRef<TextInput>(null);

  const isPaid = type === 'paid';
  /**
   * Whether this account may bill on a cycle at all. `currencyCode` arrives with
   * `/user/me`, so the billing type is *derived* rather than held in state —
   * picking Subscription before the currency lands could otherwise leave a
   * value the server rejects sitting in a form that no longer shows the choice.
   */
  const supportsSubscription = SUBSCRIPTION_CURRENCIES.includes(currencyCode.toUpperCase());
  const billingType: ApiBillingType = supportsSubscription ? pickedBillingType : 'one_off';
  const isSubscription = isPaid && billingType === 'subscription';
  const intervalMeta = BILLING_INTERVALS.find((i) => i.value === billingInterval)!;

  const priceValue = Number(price.replace(/[^0-9.]/g, ''));
  const priceValid = !isPaid || (Number.isFinite(priceValue) && priceValue > 0);
  const valid = name.trim().length >= 3 && description.trim().length > 0 && !!categoryId && priceValid;

  /**
   * Preview of the fee split. The backend returns the authoritative figures on
   * the created community — this only answers "what will members pay, and what
   * do I keep?" while the price is still being typed.
   */
  const fee = isPaid && priceValid ? (priceValue * PLATFORM_FEE_PERCENT) / 100 : 0;
  const memberCharge = feePayer === 'members' ? priceValue + fee : priceValue;
  const creatorPayout = feePayer === 'members' ? priceValue : priceValue - fee;

  /** What one payment is called, for the preview copy. */
  const cadence = isSubscription ? ` / ${intervalMeta.unit}` : '';

  const onCreate = () => {
    setSubmitted(true);
    setFieldErrors({});
    if (!valid || !categoryId) return;

    createMutation.mutate(
      {
        name: name.trim(),
        description: description.trim(),
        community_categories_id: categoryId,
        type,
        // Only paid communities carry pricing, and only subscriptions carry an
        // interval — sending them otherwise is at best ignored, at worst a 422.
        ...(isPaid
          ? {
              monthly_fee: priceValue,
              fee_payer: feePayer,
              billing_type: billingType,
              ...(isSubscription ? { billing_interval: billingInterval } : {}),
            }
          : {}),
      },
      {
        onSuccess: (community) => {
          showToast(`${community.name} created.`, 'success');
          router.replace(`/community/${community.id}`);
        },
        onError: (error) => {
          if (error instanceof ApiError && error.fieldErrors) {
            setFieldErrors(error.fieldErrors);
          }
          useFeedbackStore
            .getState()
            .showApiError(error, "Couldn't create your community.");
        },
      },
    );
  };

  /** First server-side message for a field, if the last attempt was rejected. */
  const serverError = (field: string) => fieldErrors[field]?.[0];

  return (
    <KeyboardAwareScreen contentStyle={{ gap: spacing.lg }}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: colors.text }]}>Create a community</Text>
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          style={[styles.close, { backgroundColor: colors.surfaceAlt }]}
        >
          <Ionicons name="close" size={20} color={colors.text} />
        </Pressable>
      </View>

      <View
        style={[
          styles.currencyNote,
          {
            backgroundColor: `${colors.brand}0F`,
            borderColor: `${colors.brand}33`,
            borderRadius: radius.md,
          },
        ]}
      >
        <Ionicons name="information-circle-outline" size={19} color={colors.brand} />
        <Text style={[styles.currencyText, { color: colors.textSecondary }]}>
          This community will be created in your wallet currency (
          <Text style={styles.currencyBold}>{currencyCode}</Text>). Paid community prices
          use the same currency, so all amounts below are in{' '}
          <Text style={styles.currencyBold}>{symbol}</Text>.
        </Text>
      </View>

      <View style={{ gap: spacing.sm }}>
        <FieldLabel>Community name</FieldLabel>
        <TextField
          placeholder="e.g. Side Hustle Naija"
          value={name}
          onChangeText={setName}
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => descriptionRef.current?.focus()}
        />
        {submitted && name.trim().length < 3 ? (
          <Text style={[styles.error, { color: colors.danger }]}>
            Give it a name of at least 3 characters
          </Text>
        ) : null}
        {serverError('name') ? (
          <Text style={[styles.error, { color: colors.danger }]}>{serverError('name')}</Text>
        ) : null}
      </View>

      <View style={{ gap: spacing.sm }}>
        <View style={styles.labelRow}>
          <FieldLabel>Description</FieldLabel>
          <Text style={[styles.counter, { color: colors.textMuted }]}>
            {description.length}/{DESCRIPTION_MAX}
          </Text>
        </View>
        <TextInput
          ref={descriptionRef}
          value={description}
          onChangeText={(text) => setDescription(text.slice(0, DESCRIPTION_MAX))}
          placeholder="What's this community for, and who should join?"
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.brand}
          multiline
          style={[
            styles.textarea,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: radius.md,
              color: colors.text,
            },
          ]}
        />
        {submitted && !description.trim() ? (
          <Text style={[styles.error, { color: colors.danger }]}>
            Add a short description
          </Text>
        ) : null}
      </View>

      <View style={{ gap: spacing.sm }}>
        <FieldLabel>Category</FieldLabel>
        {/* `value` is the option's *value* (the category id), not its name:
            SelectField resolves the display label from `options` itself, and a
            name here never matches, so the field would sit on its placeholder
            however many times you picked something. */}
        <SelectField
          icon="pricetag-outline"
          placeholder={loadingCategories ? 'Loading categories…' : 'Select a category'}
          title="Category"
          value={categoryId}
          options={(categories ?? []).map((c) => ({ label: c.name, value: c.id }))}
          onChange={(value) => setCategoryId(value as string)}
        />
        {submitted && !categoryId ? (
          <Text style={[styles.error, { color: colors.danger }]}>Pick a category</Text>
        ) : null}
      </View>

      <View style={{ gap: spacing.sm }}>
        <FieldLabel>Status</FieldLabel>
        {TYPES.map((option) => {
          const meta = STATUS_META[option];
          const active = option === type;
          return (
            <View key={option} style={{ gap: 0 }}>
              <Pressable
                onPress={() => setType(option)}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={meta.label}
                style={[
                  styles.statusCard,
                  {
                    backgroundColor: active ? `${colors.brand}12` : colors.surface,
                    borderColor: active ? colors.brand : colors.border,
                    borderWidth: active ? 1.5 : StyleSheet.hairlineWidth,
                    borderRadius: radius.md,
                  },
                ]}
              >
                <View style={styles.statusHead}>
                  <View
                    style={[styles.radio, { borderColor: active ? colors.brand : colors.border }]}
                  >
                    {active ? (
                      <View style={[styles.radioDot, { backgroundColor: colors.brand }]} />
                    ) : null}
                  </View>
                  <View style={[styles.statusIcon, { backgroundColor: colors.surfaceAlt }]}>
                    <Ionicons
                      name={meta.icon as keyof typeof Ionicons.glyphMap}
                      size={16}
                      color={colors.brand}
                    />
                  </View>
                  <Text style={[styles.statusLabel, { color: colors.text }]}>{meta.label}</Text>
                </View>
                <Text style={[styles.statusBlurb, { color: colors.textMuted }]}>
                  {meta.blurb}
                </Text>
              </Pressable>

              {/* The paid branch expands under its own card, as on the web, so
                  the pricing questions stay attached to the choice that asks
                  them. Nothing here renders for the other three types. */}
              {option === 'paid' && active ? (
                <View
                  style={[
                    styles.paidPanel,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      borderRadius: radius.md,
                    },
                  ]}
                >
                  {/* One option is not a choice: where the currency can't be
                      billed on a cycle, the picker is replaced by a line saying
                      so, rather than offering a radio the server would 422. */}
                  {!supportsSubscription ? (
                    <View
                      style={[
                        styles.feeNote,
                        { backgroundColor: colors.surfaceAlt, borderRadius: radius.sm },
                      ]}
                    >
                      <Ionicons name="repeat-outline" size={15} color={colors.textMuted} />
                      <Text style={[styles.feeNoteText, { color: colors.textMuted }]}>
                        Members pay once and keep access. Recurring subscriptions aren't
                        available for {currencyCode} communities yet.
                      </Text>
                    </View>
                  ) : null}

                  {supportsSubscription ? <FieldLabel>How should members pay?</FieldLabel> : null}
                  {(supportsSubscription ? BILLING_TYPES : []).map((billing) => {
                    const on = billing.value === billingType;
                    return (
                      <Pressable
                        key={billing.value}
                        onPress={() => setPickedBillingType(billing.value)}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: on }}
                        accessibilityLabel={billing.label}
                        style={[
                          styles.subCard,
                          {
                            backgroundColor: on ? `${colors.brand}12` : colors.surfaceAlt,
                            borderColor: on ? colors.brand : colors.border,
                            borderRadius: radius.sm,
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.radio,
                            { borderColor: on ? colors.brand : colors.border },
                          ]}
                        >
                          {on ? (
                            <View style={[styles.radioDot, { backgroundColor: colors.brand }]} />
                          ) : null}
                        </View>
                        <View style={styles.subText}>
                          <Text style={[styles.subLabel, { color: colors.text }]}>
                            {billing.label}
                          </Text>
                          <Text style={[styles.subBlurb, { color: colors.textMuted }]}>
                            {billing.blurb}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}

                  {/* Cadence — subscriptions only. */}
                  {isSubscription ? (
                    <View style={{ gap: spacing.sm }}>
                      <FieldLabel>How often are they billed?</FieldLabel>
                      <View style={styles.intervalRow}>
                        {BILLING_INTERVALS.map((interval) => {
                          const on = interval.value === billingInterval;
                          return (
                            <Pressable
                              key={interval.value}
                              onPress={() => setBillingInterval(interval.value)}
                              accessibilityRole="radio"
                              accessibilityState={{ selected: on }}
                              accessibilityLabel={interval.label}
                              style={[
                                styles.intervalChip,
                                {
                                  backgroundColor: on ? colors.brand : colors.surfaceAlt,
                                  borderColor: on ? colors.brand : colors.border,
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.intervalText,
                                  { color: on ? colors.onBrand : colors.textSecondary },
                                ]}
                              >
                                {interval.label}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                      {serverError('billing_interval') ? (
                        <Text style={[styles.error, { color: colors.danger }]}>
                          {serverError('billing_interval')}
                        </Text>
                      ) : null}
                    </View>
                  ) : null}

                  <View style={{ gap: spacing.sm }}>
                    <FieldLabel>
                      {isSubscription ? `Price per ${intervalMeta.unit}` : 'Price (one-time)'}
                    </FieldLabel>
                    <TextField
                      icon="cash-outline"
                      placeholder={`${symbol}0`}
                      value={price}
                      onChangeText={setPrice}
                      keyboardType="decimal-pad"
                    />
                    {submitted && !priceValid ? (
                      <Text style={[styles.error, { color: colors.danger }]}>
                        Enter a price above zero
                      </Text>
                    ) : null}
                    {/* The minimum is currency-dependent and only the server
                        knows it, so its message is surfaced verbatim. */}
                    {serverError('monthly_fee') ? (
                      <Text style={[styles.error, { color: colors.danger }]}>
                        {serverError('monthly_fee')}
                      </Text>
                    ) : null}
                  </View>

                  <View
                    style={[
                      styles.feeNote,
                      { backgroundColor: colors.surfaceAlt, borderRadius: radius.sm },
                    ]}
                  >
                    <Ionicons name="pricetag-outline" size={15} color={colors.textMuted} />
                    <Text style={[styles.feeNoteText, { color: colors.textMuted }]}>
                      Payhankey charges a {PLATFORM_FEE_PERCENT}% platform fee on every
                      payment made into a paid community.
                    </Text>
                  </View>

                  <FieldLabel>Who covers the fee?</FieldLabel>
                  {FEE_PAYERS.map((payer) => {
                    const on = payer.value === feePayer;
                    return (
                      <Pressable
                        key={payer.value}
                        onPress={() => setFeePayer(payer.value)}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: on }}
                        accessibilityLabel={payer.label}
                        style={[
                          styles.subCard,
                          {
                            backgroundColor: on ? `${colors.brand}12` : colors.surfaceAlt,
                            borderColor: on ? colors.brand : colors.border,
                            borderRadius: radius.sm,
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.radio,
                            { borderColor: on ? colors.brand : colors.border },
                          ]}
                        >
                          {on ? (
                            <View style={[styles.radioDot, { backgroundColor: colors.brand }]} />
                          ) : null}
                        </View>
                        <View style={styles.subText}>
                          <Text style={[styles.subLabel, { color: colors.text }]}>
                            {payer.label}
                          </Text>
                          <Text style={[styles.subBlurb, { color: colors.textMuted }]}>
                            {payer.blurb}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                  {serverError('fee_payer') ? (
                    <Text style={[styles.error, { color: colors.danger }]}>
                      {serverError('fee_payer')}
                    </Text>
                  ) : null}

                  {/* What the two choices above actually add up to. */}
                  {priceValid && priceValue > 0 ? (
                    <View
                      style={[
                        styles.preview,
                        { borderColor: `${colors.brand}33`, borderRadius: radius.sm },
                      ]}
                    >
                      <View style={styles.previewRow}>
                        <Text style={[styles.previewLabel, { color: colors.textMuted }]}>
                          Members pay
                        </Text>
                        <Text style={[styles.previewValue, { color: colors.text }]}>
                          {format(memberCharge)}
                          {cadence}
                        </Text>
                      </View>
                      <View style={styles.previewRow}>
                        <Text style={[styles.previewLabel, { color: colors.textMuted }]}>
                          Platform fee ({PLATFORM_FEE_PERCENT}%)
                        </Text>
                        <Text style={[styles.previewValue, { color: colors.textMuted }]}>
                          −{format(fee)}
                        </Text>
                      </View>
                      <View style={[styles.previewRow, styles.previewTotal]}>
                        <Text style={[styles.previewLabel, { color: colors.text }]}>
                          You receive
                        </Text>
                        <Text style={[styles.previewValue, { color: colors.brand }]}>
                          {format(creatorPayout)}
                          {cadence}
                        </Text>
                      </View>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
          );
        })}
      </View>

      <View
        style={[
          styles.adminNote,
          { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md },
        ]}
      >
        <Ionicons name="shield-checkmark-outline" size={18} color={colors.textMuted} />
        <Text style={[styles.adminText, { color: colors.textMuted }]}>
          You'll be the community's first admin. You can add co-admins and change the status
          later from settings.
        </Text>
      </View>

      <GradientButton
        label="Create community"
        onPress={onCreate}
        loading={createMutation.isPending}
      />
    </KeyboardAwareScreen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: { fontFamily: FONT, flex: 1, fontSize: 22, fontWeight: '800' },
  close: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currencyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 13,
    borderWidth: 1,
  },
  currencyText: { fontFamily: FONT, flex: 1, fontSize: 12, lineHeight: 18, fontWeight: '500' },
  currencyBold: { fontFamily: FONT, fontWeight: '800' },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  counter: { fontFamily: FONT, fontSize: 11, fontWeight: '700' },
  textarea: {
    fontFamily: FONT,
    minHeight: 104,
    padding: 14,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '500',
    textAlignVertical: 'top',
    borderWidth: StyleSheet.hairlineWidth,
  },
  error: { fontFamily: FONT, fontSize: 12, fontWeight: '700' },
  statusCard: { padding: 14, gap: 8 },
  statusHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  statusIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusLabel: { fontFamily: FONT, flex: 1, fontSize: 15, fontWeight: '800' },
  statusBlurb: { fontFamily: FONT, fontSize: 12, lineHeight: 18, fontWeight: '600' },

  paidPanel: {
    marginTop: 8,
    marginLeft: 12,
    padding: 14,
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  subCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderWidth: 1,
  },
  subText: { flex: 1, gap: 3 },
  subLabel: { fontFamily: FONT, fontSize: 14, fontWeight: '800' },
  subBlurb: { fontFamily: FONT, fontSize: 12, lineHeight: 17, fontWeight: '500' },
  intervalRow: { flexDirection: 'row', gap: 8 },
  intervalChip: {
    flex: 1,
    height: 38,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  intervalText: { fontFamily: FONT, fontSize: 13, fontWeight: '800' },
  feeNote: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 11 },
  feeNoteText: { fontFamily: FONT, flex: 1, fontSize: 11, lineHeight: 16, fontWeight: '600' },
  preview: { padding: 12, gap: 8, borderWidth: 1 },
  previewRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  previewTotal: { paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#8882' },
  previewLabel: { fontFamily: FONT, fontSize: 12, fontWeight: '700' },
  // Money never renders in FONT_MONO — Space Mono has no ₦ glyph.
  previewValue: { fontFamily: FONT, fontSize: 14, fontWeight: '800' },

  adminNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 13,
    borderWidth: StyleSheet.hairlineWidth,
  },
  adminText: { fontFamily: FONT, flex: 1, fontSize: 12, lineHeight: 18, fontWeight: '500' },
});
