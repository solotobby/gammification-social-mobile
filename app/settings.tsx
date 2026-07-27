import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Avatar } from '../src/components/ui/Avatar';
import { BackButton } from '../src/components/ui/BackButton';
import { FieldLabel } from '../src/components/ui/FieldLabel';
import { GradientButton } from '../src/components/ui/GradientButton';
import { KeyboardAwareScreen } from '../src/components/ui/KeyboardAwareScreen';
import { SelectField } from '../src/components/ui/SelectField';
import { TextField } from '../src/components/ui/TextField';
import { useMe, useMyTint } from '../src/hooks/useMe';
import { useAuthStore } from '../src/stores/authStore';
import { useTheme } from '../src/theme/ThemeProvider';

const ABOUT_MAX = 40;

const GENDERS = [
  { label: 'Female', value: 'female' },
  { label: 'Male', value: 'male' },
  { label: 'Prefer not to say', value: 'unspecified' },
];

/**
 * Settings — edit profile form (web Settings "Profile" tab). The Socials tab
 * lives on its own screen at /settings/socials.
 */
export default function SettingsScreen() {
  const { colors, radius, spacing } = useTheme();
  const router = useRouter();
  const myTint = useMyTint();

  // These three come from the signed-in account, which may still be loading, so
  // an untouched field tracks /user/me and an edit takes over from there —
  // seeding useState once would pin the form to whatever was known at mount.
  const { data: me } = useMe();
  const sessionUser = useAuthStore((s) => s.user);
  const [nameEdit, setName] = useState<string | null>(null);
  const [emailEdit, setEmail] = useState<string | null>(null);
  const [usernameEdit, setUsername] = useState<string | null>(null);
  const name = nameEdit ?? me?.user.name ?? sessionUser?.name ?? '';
  const email = emailEdit ?? me?.user.email ?? sessionUser?.email ?? '';
  const username = usernameEdit ?? me?.user.username ?? sessionUser?.username ?? '';

  const [about, setAbout] = useState('Building and sharing daily.');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState<string | null>(null);
  const [location, setLocation] = useState('Lagos, Nigeria');

  const emailRef = useRef<TextInput>(null);
  const usernameRef = useRef<TextInput>(null);
  const aboutRef = useRef<TextInput>(null);

  const save = () => router.back();

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
        <View style={styles.field}>
          <FieldLabel>Full name</FieldLabel>
          <TextField
            icon="person-outline"
            placeholder="Full name"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            autoComplete="name"
            textContentType="name"
            returnKeyType="next"
            onSubmitEditing={() => emailRef.current?.focus()}
            submitBehavior="submit"
          />
        </View>

        <View style={styles.field}>
          <FieldLabel>Email</FieldLabel>
          <TextField
            ref={emailRef}
            icon="mail-outline"
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="next"
            onSubmitEditing={() => usernameRef.current?.focus()}
            submitBehavior="submit"
          />
        </View>

        <View style={styles.field}>
          <FieldLabel>Username</FieldLabel>
          <TextField
            ref={usernameRef}
            icon="at-outline"
            placeholder="Username"
            value={username}
            onChangeText={(v) => setUsername(v.toLowerCase().replace(/\s/g, ''))}
            autoCapitalize="none"
            returnKeyType="next"
            onSubmitEditing={() => aboutRef.current?.focus()}
            submitBehavior="submit"
          />
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
            placeholder="DD/MM/YYYY"
            value={dob}
            onChangeText={setDob}
            keyboardType="numbers-and-punctuation"
            maxLength={10}
            returnKeyType="done"
          />
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
            Link Instagram, TikTok, X & more
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </Pressable>

      <GradientButton label="Save changes" icon="checkmark" onPress={save} style={styles.cta} />
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
  avatarWrap: {
    alignItems: 'center',
    gap: 10,
    marginBottom: 28,
  },
  avatarHint: { fontSize: 12, fontWeight: '500' },
  form: {
    marginBottom: 24,
  },
  field: { gap: 8 },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  counter: { fontSize: 12, fontWeight: '600' },
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
  socialsLabel: { fontSize: 15, fontWeight: '700' },
  socialsSub: { fontSize: 12, fontWeight: '500' },
  cta: { width: '100%' },
});
