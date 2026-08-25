import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Avatar } from '../src/components/ui/Avatar';
import { BackButton } from '../src/components/ui/BackButton';
import { FieldLabel } from '../src/components/ui/FieldLabel';
import { GradientButton } from '../src/components/ui/GradientButton';
import { KeyboardAwareScreen } from '../src/components/ui/KeyboardAwareScreen';
import { ThemeToggle } from '../src/components/ui/ThemeToggle';
import { SelectField } from '../src/components/ui/SelectField';
import { TextField } from '../src/components/ui/TextField';
import { useUpdateProfile } from '../src/hooks/useAccount';
import { useMe, useMyTint } from '../src/hooks/useMe';
import { useAuthStore } from '../src/stores/authStore';
import { useTheme } from '../src/theme/ThemeProvider';
import { FONT } from '../src/theme/fonts';

const ABOUT_MAX = 160;

/** PUT /user/profile wants an ISO date; the field is typed in the same shape. */
const DOB_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const GENDERS = [
  { label: 'Female', value: 'female' },
  { label: 'Male', value: 'male' },
  { label: 'Prefer not to say', value: 'unspecified' },
];

/**
 * Settings — edit profile form (web Settings "Profile" tab). The Socials tab
 * lives on its own screen at /settings/socials.
 *
 * PUT /user/profile accepts only `date_of_birth`, `gender`, `location` and
 * `about`, so name / email / username are shown read-only rather than as
 * inputs that would silently never save.
 *
 * All four editable fields read back from `/user/me` (`data.user`), which is
 * the only endpoint that returns them flat — the profile view nests them in an
 * object under `profile.profile`. Each field tracks the server value until the
 * user edits it, so the form fills in as the query lands instead of pinning to
 * whatever was known at mount.
 */
export default function SettingsScreen() {
  const { colors, radius, spacing } = useTheme();
  const router = useRouter();
  const myTint = useMyTint();

  const { data: me } = useMe();
  const sessionUser = useAuthStore((s) => s.user);
  const name = me?.user.name ?? sessionUser?.name ?? '';
  const email = me?.user.email ?? sessionUser?.email ?? '';
  const username = me?.user.username ?? sessionUser?.username ?? '';

  const [aboutEdit, setAbout] = useState<string | null>(null);
  const [dobEdit, setDob] = useState<string | null>(null);
  const [genderEdit, setGender] = useState<string | null>(null);
  const [locationEdit, setLocation] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const about = aboutEdit ?? me?.user.about ?? '';
  // /user/me returns a plain "YYYY-MM-DD"; the profile view's copy is a full
  // timestamp, so trim defensively either way.
  const dob = dobEdit ?? me?.user.date_of_birth?.slice(0, 10) ?? '';
  const gender = genderEdit ?? me?.user.gender ?? null;
  const location = locationEdit ?? me?.user.location ?? '';

  const aboutRef = useRef<TextInput>(null);

  const updateProfile = useUpdateProfile();
  const dobInvalid = dob.length > 0 && !DOB_PATTERN.test(dob);

  const save = () => {
    setSubmitted(true);
    if (dobInvalid || updateProfile.isPending) return;
    // Send only what the user actually filled in — a blank string would
    // overwrite a value they set on the web.
    const payload = {
      ...(about.trim() ? { about: about.trim() } : {}),
      ...(dob ? { date_of_birth: dob } : {}),
      ...(gender ? { gender } : {}),
      ...(location.trim() ? { location: location.trim() } : {}),
    };
    updateProfile.mutate(payload, { onSuccess: () => router.back() });
  };

  return (
    <KeyboardAwareScreen>
      <View style={styles.headerRow}>
        <BackButton onPress={() => router.back()} />
        <Text style={[styles.headerTitle, { color: colors.text }]}>Settings</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* Avatar preview */}
      <View style={styles.avatarWrap}>
        <Avatar name={name} tint={myTint} size={76} />
        <Text style={[styles.avatarHint, { color: colors.textMuted }]}>
          Avatars come from your initials for now
        </Text>
      </View>

      <View style={[styles.form, { gap: spacing.lg }]}>
        {/* Read-only: PUT /user/profile does not accept these yet. */}
        <View
          style={[
            styles.identityCard,
            { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md },
          ]}
        >
          {[
            { icon: 'person-outline' as const, label: 'Full name', value: name },
            { icon: 'mail-outline' as const, label: 'Email', value: email },
            { icon: 'at-outline' as const, label: 'Username', value: username && `@${username}` },
          ].map((row, index) => (
            <View
              key={row.label}
              style={[
                styles.identityRow,
                index > 0 && {
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: colors.border,
                },
              ]}
            >
              <Ionicons name={row.icon} size={18} color={colors.textMuted} />
              <Text style={[styles.identityLabel, { color: colors.textMuted }]}>
                {row.label}
              </Text>
              <Text style={[styles.identityValue, { color: colors.text }]} numberOfLines={1}>
                {row.value || '—'}
              </Text>
            </View>
          ))}
          <Text style={[styles.identityNote, { color: colors.textMuted }]}>
            Name, email and username can't be changed from the app yet.
          </Text>
        </View>

        <View style={styles.field}>
          <View style={styles.labelRow}>
            <FieldLabel>About</FieldLabel>
            <Text style={[styles.counter, { color: colors.textMuted }]}>
              {about.length}/{ABOUT_MAX}
            </Text>
          </View>
          <TextField
            ref={aboutRef}
            icon="sparkles-outline"
            placeholder="A short line about you"
            value={about}
            onChangeText={setAbout}
            maxLength={ABOUT_MAX}
            returnKeyType="done"
          />
        </View>

        <View style={styles.field}>
          <FieldLabel>Date of birth</FieldLabel>
          <TextField
            icon="calendar-outline"
            placeholder="YYYY-MM-DD"
            value={dob}
            onChangeText={setDob}
            keyboardType="numbers-and-punctuation"
            maxLength={10}
            returnKeyType="done"
          />
          {(dobInvalid || (submitted && dobInvalid)) ? (
            <Text style={[styles.counter, { color: colors.danger }]}>
              Use the format YYYY-MM-DD.
            </Text>
          ) : null}
        </View>

        <View style={styles.field}>
          <FieldLabel>Gender</FieldLabel>
          <SelectField
            icon="body-outline"
            placeholder="Gender"
            title="Gender"
            value={gender}
            options={GENDERS}
            onChange={setGender}
          />
        </View>

        <View style={styles.field}>
          <FieldLabel>Location</FieldLabel>
          <TextField
            icon="location-outline"
            placeholder="City, country"
            value={location}
            onChangeText={setLocation}
            autoCapitalize="words"
            returnKeyType="done"
            onSubmitEditing={save}
          />
        </View>
      </View>

      {/* Appearance — moved here from /me so the tab stays an identity page
          and every preference lives in one place. */}
      <View
        style={[
          styles.appearanceCard,
          { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md },
        ]}
      >
        <View style={styles.appearanceHead}>
          <Ionicons name="contrast-outline" size={19} color={colors.brand} />
          <Text style={[styles.appearanceTitle, { color: colors.text }]}>Appearance</Text>
        </View>
        <ThemeToggle />
      </View>

      {/* Socials tab lives on its own screen */}
      <Pressable
        onPress={() => router.push('/settings/socials')}
        accessibilityRole="button"
        accessibilityLabel="Social profiles"
        style={({ pressed }) => [
          styles.socialsTeaser,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderRadius: radius.md,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <View style={[styles.socialsIcon, { backgroundColor: colors.surfaceAlt }]}>
          <Ionicons name="share-social-outline" size={19} color={colors.brand} />
        </View>
        <View style={styles.socialsText}>
          <Text style={[styles.socialsLabel, { color: colors.text }]}>Social profiles</Text>
          <Text style={[styles.socialsSub, { color: colors.textMuted }]}>
            Link Facebook, Instagram, X & more
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </Pressable>

      <GradientButton
        label="Save changes"
        icon="checkmark"
        loading={updateProfile.isPending}
        onPress={save}
        style={styles.cta}
      />
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
  headerTitle: { fontFamily: FONT, fontSize: 18, fontWeight: '800' },
  avatarWrap: {
    alignItems: 'center',
    gap: 10,
    marginBottom: 28,
  },
  avatarHint: { fontFamily: FONT, fontSize: 12, fontWeight: '500' },
  form: {
    marginBottom: 24,
  },
  field: { gap: 8 },
  identityCard: {
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
  },
  identityLabel: { fontFamily: FONT, fontSize: 13, fontWeight: '600' },
  identityValue: { fontFamily: FONT, flex: 1, fontSize: 13, fontWeight: '800', textAlign: 'right' },
  identityNote: { fontFamily: FONT, fontSize: 11, lineHeight: 16, fontWeight: '500', paddingTop: 4 },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  counter: { fontFamily: FONT, fontSize: 12, fontWeight: '600' },
  appearanceCard: {
    padding: 16,
    gap: 14,
    marginTop: 20,
    marginBottom: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  appearanceHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  appearanceTitle: { fontFamily: FONT, fontSize: 15, fontWeight: '700' },
  socialsTeaser: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderWidth: 1,
    marginBottom: 24,
  },
  socialsIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  socialsText: { flex: 1, gap: 1 },
  socialsLabel: { fontFamily: FONT, fontSize: 15, fontWeight: '700' },
  socialsSub: { fontFamily: FONT, fontSize: 12, fontWeight: '500' },
  cta: { width: '100%' },
});
