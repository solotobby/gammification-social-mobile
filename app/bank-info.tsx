import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { BackButton } from '../src/components/ui/BackButton';
import { FieldLabel } from '../src/components/ui/FieldLabel';
import { GhostButton } from '../src/components/ui/GhostButton';
import { GradientButton } from '../src/components/ui/GradientButton';
import { KeyboardAwareScreen } from '../src/components/ui/KeyboardAwareScreen';
import { SelectField } from '../src/components/ui/SelectField';
import { TextField } from '../src/components/ui/TextField';
import { useBank, useSaveBank } from '../src/hooks/useAccount';
import { useTheme } from '../src/theme/ThemeProvider';
import type { BankFormField, WithdrawalMethod } from '../src/api/types';
import { FONT } from '../src/theme/fonts';

/**
 * Bank information — payout destination, driven by GET /user/bank.
 *
 * The backend decides which fields apply from the account's wallet currency
 * (a USD wallet is asked for PayPal / USDT, an NGN one for bank details), so
 * this screen renders `form.fields` instead of hard-coding a Nigerian bank
 * form. A field carrying `required_if` only applies when `payment_method`
 * currently equals that value — that's how the PayPal and USDT inputs
 * show and hide.
 */

/** Seed the inputs from whatever is already saved. */
function initialValues(
  fields: BankFormField[],
  saved: WithdrawalMethod | null | undefined,
  fallbackMethod: string | null | undefined,
): Record<string, string> {
  const values: Record<string, string> = {};
  for (const field of fields) {
    const existing = saved?.[field.name as keyof WithdrawalMethod];
    values[field.name] = existing == null ? '' : String(existing);
  }
  if (!values.payment_method) {
    values.payment_method =
      saved?.payment_method ??
      fallbackMethod ??
      fields.find((f) => f.name === 'payment_method')?.options?.[0] ??
      '';
  }
  return values;
}

export default function BankInfoScreen() {
  const { colors, radius, spacing } = useTheme();
  const router = useRouter();

  const bank = useBank();
  const save = useSaveBank();

  const fields = useMemo(() => bank.data?.form.fields ?? [], [bank.data]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  // Re-seed whenever the form or the saved method arrives/changes.
  useEffect(() => {
    if (!bank.data) return;
    setValues(
      initialValues(
        bank.data.form.fields,
        bank.data.withdrawal_method,
        bank.data.form.payment_method,
      ),
    );
  }, [bank.data]);

  const method = values.payment_method ?? '';

  /** A `required_if` field only applies to its own payment method. */
  const applies = (field: BankFormField) =>
    !field.required_if || field.required_if === method;
  const isRequired = (field: BankFormField) =>
    field.required === true || (!!field.required_if && field.required_if === method);

  const visible = fields.filter(applies);
  const missing = visible.filter((f) => isRequired(f) && !values[f.name]?.trim());
  const valid = missing.length === 0;

  const set = (name: string, value: string) =>
    setValues((prev) => ({ ...prev, [name]: value }));

  const onSave = () => {
    setSubmitted(true);
    if (!valid || save.isPending) return;
    // Send only the fields that apply to the chosen method — posting a blank
    // `usdt_wallet` alongside a PayPal method trips the backend's validation.
    const payload: Record<string, string> = {};
    for (const field of visible) {
      const value = values[field.name]?.trim();
      if (value) payload[field.name] = value;
    }
    save.mutate(payload, { onSuccess: () => router.back() });
  };

  if (bank.isLoading) {
    return (
      <KeyboardAwareScreen contentStyle={styles.center}>
        <ActivityIndicator color={colors.brand} />
      </KeyboardAwareScreen>
    );
  }

  if (bank.isError || !bank.data) {
    return (
      <KeyboardAwareScreen contentStyle={styles.center}>
        <Text style={[styles.errorText, { color: colors.textMuted }]}>
          We couldn't load your payout form.
        </Text>
        <GhostButton label="Retry" onPress={() => void bank.refetch()} />
      </KeyboardAwareScreen>
    );
  }

  const currency = bank.data.form.currency;
  const saved = bank.data.withdrawal_method;

  return (
    <KeyboardAwareScreen>
      <View style={styles.headerRow}>
        <BackButton onPress={() => router.back()} />
        <Text style={[styles.headerTitle, { color: colors.text }]}>Bank information</Text>
        <View style={{ width: 44 }} />
      </View>

      <Text style={[styles.lede, { color: colors.textSecondary }]}>
        Configure where we send your earnings. Currency:{' '}
        <Text style={styles.ledeBold}>{currency}</Text>
      </Text>

      {saved?.is_active ? (
        <View
          style={[
            styles.savedBanner,
            { backgroundColor: `${colors.mint}14`, borderColor: `${colors.mint}40`, borderRadius: radius.md },
          ]}
        >
          <Ionicons name="checkmark-circle-outline" size={20} color={colors.mint} />
          <Text style={[styles.savedText, { color: colors.text }]}>
            Payouts go to your saved {saved.payment_method} destination. Update it below.
          </Text>
        </View>
      ) : null}

      <View style={[styles.form, { gap: spacing.md }]}>
        {visible.map((field) => {
          const value = values[field.name] ?? '';
          const showError = submitted && isRequired(field) && !value.trim();

          return (
            <View key={field.name} style={{ gap: spacing.sm }}>
              <FieldLabel>{field.label}</FieldLabel>
              {field.type === 'select' ? (
                <SelectField
                  icon="swap-horizontal-outline"
                  placeholder={field.label}
                  title={field.label}
                  value={value || null}
                  options={(field.options ?? []).map((option) => ({
                    label: option.toUpperCase(),
                    value: option,
                  }))}
                  onChange={(next) => set(field.name, next)}
                />
              ) : (
                <TextField
                  icon={
                    field.type === 'email'
                      ? 'mail-outline'
                      : field.name.includes('account')
                        ? 'card-outline'
                        : 'wallet-outline'
                  }
                  placeholder={field.label}
                  value={value}
                  onChangeText={(next) => set(field.name, next)}
                  keyboardType={
                    field.type === 'email'
                      ? 'email-address'
                      : field.type === 'number' || field.name === 'account_number'
                        ? 'number-pad'
                        : 'default'
                  }
                  autoCapitalize={field.type === 'email' ? 'none' : 'sentences'}
                  autoCorrect={false}
                />
              )}
              {showError ? (
                <Text style={[styles.hint, { color: colors.danger }]}>
                  {field.label} is required.
                </Text>
              ) : null}
            </View>
          );
        })}
      </View>

      <Text style={[styles.hint, { color: colors.textMuted, marginBottom: spacing.lg }]}>
        Use the exact details on the account — payouts fail on a mismatch.
      </Text>

      <GradientButton
        label="Save payout information"
        icon="checkmark"
        loading={save.isPending}
        onPress={onSave}
      />
    </KeyboardAwareScreen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', gap: 14 },
  errorText: { fontFamily: FONT, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  headerTitle: { fontFamily: FONT, fontSize: 18, fontWeight: '800' },
  lede: {
    fontFamily: FONT,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '500',
    marginBottom: 20,
  },
  ledeBold: { fontFamily: FONT, fontWeight: '800' },
  savedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderWidth: 1,
    marginBottom: 20,
  },
  savedText: { fontFamily: FONT, flex: 1, fontSize: 13, lineHeight: 19, fontWeight: '500' },
  form: { marginBottom: 12 },
  hint: {
    fontFamily: FONT,
    fontSize: 13,
    fontWeight: '500',
    paddingHorizontal: 4,
  },
});
