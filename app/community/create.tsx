import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { FieldLabel } from '../../src/components/ui/FieldLabel';
import { GradientButton } from '../../src/components/ui/GradientButton';
import { KeyboardAwareScreen } from '../../src/components/ui/KeyboardAwareScreen';
import { SelectField } from '../../src/components/ui/SelectField';
import { TextField } from '../../src/components/ui/TextField';
import {
  COMMUNITY_CATEGORIES,
  STATUS_META,
  addCommunity,
  type CommunityCategory,
  type CommunityStatus,
} from '../../src/data/communities';
import { useFeedbackStore } from '../../src/stores/feedbackStore';
import { useTheme } from '../../src/theme/ThemeProvider';
import { FONT } from '../../src/theme/fonts';

const DESCRIPTION_MAX = 1000;
const STATUSES: CommunityStatus[] = ['public', 'private', 'paid', 'approval'];

/**
 * Create a community — the mobile port of the web's create modal. Name,
 * description, category, and a status the member picks from four cards.
 * Paid communities ask for a monthly price in the wallet's currency (₦).
 *
 * Creation is local for now (src/data/communities.ts); the new community
 * appears at the top of the list with the creator as owner.
 */
export default function CreateCommunityScreen() {
  const { colors, radius, spacing } = useTheme();
  const router = useRouter();
  const showToast = useFeedbackStore((s) => s.showToast);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<CommunityCategory | null>(null);
  const [status, setStatus] = useState<CommunityStatus>('public');
  const [price, setPrice] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const descriptionRef = useRef<TextInput>(null);

  const priceValue = parseInt(price.replace(/[^0-9]/g, ''), 10);
  const priceValid = status !== 'paid' || (Number.isFinite(priceValue) && priceValue > 0);
  const valid = name.trim().length >= 3 && !!category && priceValid;

  const onCreate = () => {
    setSubmitted(true);
    if (!valid || !category) return;
    const community = addCommunity({
      name,
      description,
      category,
      status,
      price: status === 'paid' ? priceValue : undefined,
    });
    showToast(`${community.name} created.`, 'success');
    router.replace(`/community/${community.slug}`);
  };

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
          { backgroundColor: `${colors.brand}0F`, borderColor: `${colors.brand}33`, borderRadius: radius.md },
        ]}
      >
        <Ionicons name="information-circle-outline" size={19} color={colors.brand} />
        <Text style={[styles.currencyText, { color: colors.textSecondary }]}>
          This community will be created in your wallet currency (
          <Text style={styles.currencyBold}>NGN</Text>). Paid community prices use the same
          currency as your wallet.
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
      </View>

      <View style={{ gap: spacing.sm }}>
        <FieldLabel>Category</FieldLabel>
        <SelectField
          icon="pricetag-outline"
          placeholder="Select a category"
          title="Category"
          value={category}
          options={COMMUNITY_CATEGORIES.map((c) => ({ label: c, value: c }))}
          onChange={(value) => setCategory(value as CommunityCategory)}
        />
        {submitted && !category ? (
          <Text style={[styles.error, { color: colors.danger }]}>Pick a category</Text>
        ) : null}
      </View>

      <View style={{ gap: spacing.sm }}>
        <FieldLabel>Status</FieldLabel>
        {STATUSES.map((option) => {
          const meta = STATUS_META[option];
          const active = option === status;
          return (
            <Pressable
              key={option}
              onPress={() => setStatus(option)}
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
                  style={[
                    styles.radio,
                    { borderColor: active ? colors.brand : colors.border },
                  ]}
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
          );
        })}
      </View>

      {status === 'paid' ? (
        <View style={{ gap: spacing.sm }}>
          <FieldLabel>Monthly price (₦)</FieldLabel>
          <TextField
            icon="cash-outline"
            placeholder="2500"
            value={price}
            onChangeText={setPrice}
            keyboardType="number-pad"
          />
          {submitted && !priceValid ? (
            <Text style={[styles.error, { color: colors.danger }]}>
              Enter a price above zero
            </Text>
          ) : null}
        </View>
      ) : null}

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

      <GradientButton label="Create community" onPress={onCreate} />
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
  adminNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 13,
    borderWidth: StyleSheet.hairlineWidth,
  },
  adminText: { fontFamily: FONT, flex: 1, fontSize: 12, lineHeight: 18, fontWeight: '500' },
});
