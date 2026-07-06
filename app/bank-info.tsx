import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { BackButton } from '../src/components/ui/BackButton';
import { GradientButton } from '../src/components/ui/GradientButton';
import { KeyboardAwareScreen } from '../src/components/ui/KeyboardAwareScreen';
import { SelectField } from '../src/components/ui/SelectField';
import { TextField } from '../src/components/ui/TextField';
import { useTheme } from '../src/theme/ThemeProvider';

const BANKS = [
  'Access Bank',
  'Fidelity Bank',
  'First Bank',
  'GTBank',
  'Kuda',
  'Moniepoint',
  'Opay',
  'PalmPay',
  'Stanbic IBTC',
  'UBA',
  'Union Bank',
  'Wema Bank',
  'Zenith Bank',
].map((name) => ({ label: name, value: name }));

const CURRENCIES = [
  { label: 'NGN — Nigerian Naira', value: 'NGN' },
  { label: 'USD — US Dollar', value: 'USD' },
  { label: 'GHS — Ghanaian Cedi', value: 'GHS' },
  { label: 'KES — Kenyan Shilling', value: 'KES' },
];

const ACCOUNT_NUMBER_LENGTH = 10;

/** Bank information — payout account + base currency (single form screen). */
export default function BankInfoScreen() {
  const { colors, spacing } = useTheme();
  const router = useRouter();

  const [bank, setBank] = useState<string | null>(null);
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [currency, setCurrency] = useState<string | null>('NGN');
  const [submitted, setSubmitted] = useState(false);
  const accountNameRef = useRef<TextInput>(null);

  const numberIncomplete =
    accountNumber.length > 0 && accountNumber.length < ACCOUNT_NUMBER_LENGTH;
  const valid =
    !!bank && accountNumber.length === ACCOUNT_NUMBER_LENGTH && accountName.trim().length > 1;

  const save = () => {
    setSubmitted(true);
    if (valid) router.back();
  };

  const hint = (() => {
    if (numberIncomplete || (submitted && accountNumber.length !== ACCOUNT_NUMBER_LENGTH))
      return `Account numbers are ${ACCOUNT_NUMBER_LENGTH} digits.`;
    if (submitted && !bank) return 'Pick your bank to continue.';
    if (submitted && accountName.trim().length <= 1) return 'Enter the name on the account.';
    return 'Use the exact name on the account — payouts fail on a mismatch.';
  })();
  const hintError =
    numberIncomplete || (submitted && !valid) ? colors.pink : colors.textMuted;

  return (
    <KeyboardAwareScreen>
      <View style={styles.headerRow}>
        <BackButton onPress={() => router.back()} />
        <Text style={[styles.headerTitle, { color: colors.text }]}>Bank information</Text>
        <View style={{ width: 44 }} />
      </View>

      <Text style={[styles.lede, { color: colors.textSecondary }]}>
        Monthly payouts are sent to this account once your engagement is validated.
      </Text>

      <View style={[styles.form, { gap: spacing.md }]}>
        <SelectField
          icon="business-outline"
          placeholder="Bank"
          title="Choose your bank"
          value={bank}
          options={BANKS}
          onChange={setBank}
        />
        <TextField
          icon="card-outline"
          placeholder="Account number"
          value={accountNumber}
          onChangeText={(v) => setAccountNumber(v.replace(/\D/g, ''))}
          keyboardType="number-pad"
          maxLength={ACCOUNT_NUMBER_LENGTH}
          returnKeyType="next"
          onSubmitEditing={() => accountNameRef.current?.focus()}
          submitBehavior="submit"
        />
        <TextField
          ref={accountNameRef}
          icon="person-outline"
          placeholder="Account name"
          value={accountName}
          onChangeText={setAccountName}
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          returnKeyType="done"
          onSubmitEditing={save}
        />
        <SelectField
          icon="globe-outline"
          placeholder="Base currency"
          title="Base currency"
          value={currency}
          options={CURRENCIES}
          onChange={setCurrency}
        />
        <Text style={[styles.hint, { color: hintError }]}>{hint}</Text>
      </View>

      <GradientButton label="Save bank details" icon="checkmark" onPress={save} />
    </KeyboardAwareScreen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  lede: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '500',
    marginBottom: 24,
  },
  form: {
    marginBottom: 24,
  },
  hint: {
    fontSize: 13,
    fontWeight: '500',
    paddingHorizontal: 4,
  },
});
