import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { STATUS_META } from '../../../src/components/community/communityMeta';
import { formatMoney, symbolFor } from '../../../src/hooks/useCurrency';
import { BackButton } from '../../../src/components/ui/BackButton';
import { FieldLabel } from '../../../src/components/ui/FieldLabel';
import { GradientButton } from '../../../src/components/ui/GradientButton';
import { KeyboardAwareScreen } from '../../../src/components/ui/KeyboardAwareScreen';
import { SelectField } from '../../../src/components/ui/SelectField';
import { TextField } from '../../../src/components/ui/TextField';
import {
  useCommunity,
  useCommunityCategories,
  useCommunityImage,
  useDeleteCommunity,
  useUpdateCommunity,
} from '../../../src/hooks/useCommunities';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { FONT } from '../../../src/theme/fonts';

/**
 * Community settings — `PUT /communities/{id}` plus the logo/banner routes and
 * `DELETE /communities/{id}`, all owner-only and all added 2026-09-07.
 *
 * The images are edited through a **live preview of the community's own
 * header** rather than two file pickers: banner behind, logo overlapping it,
 * laid out exactly as `/community/[id]` renders them. You're choosing how the
 * community will look, so the control should look like the thing it changes.
 *
 * **Type is read-only here, deliberately.** The PUT accepts a `type`, but
 * changing one on a live community reprices or re-gates it for everyone already
 * in it, and there is no endpoint to tell you what that would do (a paid
 * community has no "cancel everyone's subscription" route). Creating the
 * community is where that choice belongs.
 *
 * **Archive is not offered.** `POST /communities/{id}/archive` works, but the
 * detail response carries no archived flag — so the app could set a state it
 * can never read back — and archiving additionally **overwrites `type` with
 * `private`**, which unarchiving does not restore (verified live 2026-09-07 on
 * a throwaway public community: public → archive → private, and it stayed
 * private). Shipping a button that silently changes who can join is worse than
 * not shipping it. The API wrapper stays in `communities.ts` for when both are
 * fixed.
 */
export default function CommunitySettingsScreen() {
  const { colors, radius, spacing, brand } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: community, isLoading } = useCommunity(id);
  const { data: categories } = useCommunityCategories();
  const update = useUpdateCommunity(id);
  const images = useCommunityImage(id);
  const remove = useDeleteCommunity();

  const [name, setName] = useState<string | null>(null);
  const [description, setDescription] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);

  if (isLoading || !community) {
    return (
      <View style={[styles.root, styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  // Uncommitted edits win; otherwise show what the server holds.
  const nameValue = name ?? community.name;
  const descriptionValue = description ?? community.description;
  const categoryValue = categoryId ?? community.categoryId;

  const dirty =
    nameValue.trim() !== community.name ||
    descriptionValue.trim() !== community.description ||
    categoryValue !== community.categoryId;

  const typeMeta = STATUS_META[community.type];

  const onSave = () => {
    if (!dirty || update.isPending) return;
    update.mutate({
      name: nameValue.trim(),
      description: descriptionValue.trim(),
      ...(categoryValue ? { community_categories_id: categoryValue } : {}),
    });
  };

  const pick = async (kind: 'logo' | 'banner') => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: false,
      // A banner is wide, a logo is square — cropping to the shape it'll be
      // shown in beats letting the server centre-crop something unexpected.
      allowsEditing: true,
      aspect: kind === 'banner' ? [16, 9] : [1, 1],
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    images.upload.mutate({
      kind,
      file: {
        uri: asset.uri,
        name: asset.fileName ?? `${kind}.jpg`,
        type: asset.mimeType ?? 'image/jpeg',
      },
    });
  };

  /**
   * Deleting takes the community, its posts and its members with it and cannot
   * be undone, so it asks twice — once here, once in the system dialog.
   */
  const onDelete = () => {
    Alert.alert(
      `Delete ${community.name}?`,
      'This removes the community, its posts and its members for everyone. It cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () =>
            remove.mutate(community.id, {
              // Back past the detail screen — it would 404 on the way out.
              onSuccess: () => router.replace('/communities'),
            }),
        },
      ],
    );
  };

  const card = {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
  };

  return (
    <KeyboardAwareScreen contentStyle={{ gap: spacing.lg }}>
      <View style={styles.headerRow}>
        <BackButton onPress={() => router.back()} />
        <View style={styles.headerText}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Settings</Text>
          <Text style={[styles.headerSub, { color: colors.textMuted }]} numberOfLines={1}>
            {community.name}
          </Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      {/* Live header preview — banner + overlapping logo, the same shape the
          community screen renders. Both are tappable. */}
      <View style={[styles.previewCard, card]}>
        <Pressable
          onPress={() => void pick('banner')}
          accessibilityRole="button"
          accessibilityLabel="Change banner"
          style={styles.banner}
        >
          {community.banner ? (
            <Image
              source={{ uri: community.banner }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={150}
            />
          ) : (
            <LinearGradient
              colors={[brand.violetBright, brand.violet]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          )}
          <View style={styles.bannerEdit}>
            <Ionicons name="camera" size={13} color="#FFFFFF" />
            <Text style={styles.bannerEditText}>
              {community.banner ? 'Change banner' : 'Add banner'}
            </Text>
          </View>
        </Pressable>

        <View style={styles.previewBody}>
          <Pressable
            onPress={() => void pick('logo')}
            accessibilityRole="button"
            accessibilityLabel="Change logo"
            style={[
              styles.logo,
              { backgroundColor: colors.surfaceAlt, borderColor: colors.surface },
            ]}
          >
            {community.image ? (
              <Image
                source={{ uri: community.image }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={150}
              />
            ) : (
              <Text style={[styles.logoInitials, { color: colors.brand }]}>
                {community.name.slice(0, 2).toUpperCase()}
              </Text>
            )}
            <View style={[styles.logoBadge, { backgroundColor: colors.brand }]}>
              <Ionicons name="camera" size={11} color={colors.onBrand} />
            </View>
          </Pressable>

          <View style={styles.previewMeta}>
            <Text style={[styles.previewName, { color: colors.text }]} numberOfLines={1}>
              {nameValue || community.name}
            </Text>
            <Text style={[styles.previewSub, { color: colors.textMuted }]} numberOfLines={1}>
              {community.categoryName ?? 'Uncategorised'} · {community.members}{' '}
              {community.members === 1 ? 'member' : 'members'}
            </Text>
          </View>
        </View>

        {images.upload.isPending ? (
          <View style={[styles.uploading, { borderTopColor: colors.border }]}>
            <ActivityIndicator size="small" color={colors.brand} />
            <Text style={[styles.uploadingText, { color: colors.textMuted }]}>Uploading…</Text>
          </View>
        ) : community.image || community.banner ? (
          <View style={[styles.removeRow, { borderTopColor: colors.border }]}>
            {community.image ? (
              <Pressable onPress={() => images.remove.mutate('logo')} hitSlop={6}>
                <Text style={[styles.removeText, { color: colors.textMuted }]}>Remove logo</Text>
              </Pressable>
            ) : null}
            {community.banner ? (
              <Pressable onPress={() => images.remove.mutate('banner')} hitSlop={6}>
                <Text style={[styles.removeText, { color: colors.textMuted }]}>Remove banner</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>

      {/* Details */}
      <View style={[styles.sectionCard, card]}>
        <View style={styles.sectionHead}>
          <View style={[styles.sectionIcon, { backgroundColor: `${colors.brand}1A` }]}>
            <Ionicons name="create-outline" size={15} color={colors.brand} />
          </View>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Details</Text>
        </View>

        <View style={{ gap: spacing.sm }}>
          <FieldLabel>Name</FieldLabel>
          <TextField value={nameValue} onChangeText={setName} placeholder="Community name" />
        </View>

        <View style={{ gap: spacing.sm }}>
          <FieldLabel>Description</FieldLabel>
          <TextField
            value={descriptionValue}
            onChangeText={setDescription}
            placeholder="What is this community for?"
            multiline
            style={styles.multiline}
          />
        </View>

        <View style={{ gap: spacing.sm }}>
          <FieldLabel>Category</FieldLabel>
          <SelectField
            icon="pricetag-outline"
            placeholder="Pick a category"
            title="Category"
            value={categoryValue}
            options={(categories ?? []).map((c) => ({ value: c.id, label: c.name }))}
            onChange={setCategoryId}
          />
        </View>
      </View>

      {/* Access — read-only, reusing the create form's own copy for the type. */}
      <View style={[styles.sectionCard, card]}>
        <View style={styles.sectionHead}>
          <View style={[styles.sectionIcon, { backgroundColor: `${colors.brand}1A` }]}>
            <Ionicons name="lock-closed-outline" size={15} color={colors.brand} />
          </View>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Access</Text>
        </View>

        <View style={[styles.typeRow, { backgroundColor: colors.surfaceAlt, borderRadius: radius.md }]}>
          <View style={[styles.sectionIcon, { backgroundColor: `${colors.brand}1A` }]}>
            <Ionicons
              name={typeMeta.icon as keyof typeof Ionicons.glyphMap}
              size={16}
              color={colors.brand}
            />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[styles.typeLabel, { color: colors.text }]}>{typeMeta.label}</Text>
            <Text style={[styles.typeBlurb, { color: colors.textMuted }]}>
              {typeMeta.summary}
              {/* For a paid community the price *is* the access rule, so it's
                  stated here rather than left to the Feed tab's pricing card. */}
              {community.pricing
                ? ` ${formatMoney(community.pricing.memberCharge, symbolFor(community.currency))} · ${community.pricing.billingLabel.toLowerCase()}.`
                : ''}
            </Text>
          </View>
        </View>
        <Text style={[styles.note, { color: colors.textMuted }]}>
          A community's type is fixed once it's created — changing it would re-gate or reprice it
          for everyone already in.
        </Text>
      </View>

      <GradientButton
        label="Save changes"
        onPress={onSave}
        disabled={!dirty}
        loading={update.isPending}
      />

      {/* Danger zone */}
      <View
        style={[
          styles.sectionCard,
          { backgroundColor: `${colors.pink}0D`, borderColor: `${colors.pink}33`, borderRadius: radius.lg },
        ]}
      >
        <View style={styles.sectionHead}>
          <View style={[styles.sectionIcon, { backgroundColor: `${colors.pink}1A` }]}>
            <Ionicons name="warning-outline" size={15} color={colors.pink} />
          </View>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Danger zone</Text>
        </View>
        <Text style={[styles.note, { color: colors.textMuted }]}>
          Deleting removes this community, its posts and its members for everyone. There's no undo,
          and the name is not reserved.
        </Text>
        <Pressable
          onPress={onDelete}
          disabled={remove.isPending}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.danger,
            {
              borderColor: `${colors.pink}66`,
              borderRadius: radius.pill,
              opacity: pressed || remove.isPending ? 0.7 : 1,
            },
          ]}
        >
          <Ionicons name="trash-outline" size={17} color={colors.pink} />
          <Text style={[styles.dangerText, { color: colors.pink }]}>
            {remove.isPending ? 'Deleting…' : 'Delete community'}
          </Text>
        </Pressable>
      </View>
    </KeyboardAwareScreen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },

  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerText: { flex: 1, alignItems: 'center', gap: 1 },
  headerTitle: { fontFamily: FONT, fontSize: 18, fontWeight: '800' },
  headerSub: { fontFamily: FONT, fontSize: 12, fontWeight: '600' },

  previewCard: { overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  banner: { height: 104, backgroundColor: 'rgba(120,120,140,0.15)' },
  bannerEdit: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  bannerEditText: { fontFamily: FONT, color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  previewBody: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, padding: 14, paddingTop: 0 },
  // Pulled up so it overlaps the banner, the way the community header does.
  logo: {
    width: 62,
    height: 62,
    borderRadius: 20,
    marginTop: -26,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    borderWidth: 3,
  },
  logoInitials: { fontFamily: FONT, fontSize: 19, fontWeight: '900' },
  logoBadge: {
    position: 'absolute',
    right: -3,
    bottom: -3,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewMeta: { flex: 1, gap: 2, paddingBottom: 2 },
  previewName: { fontFamily: FONT, fontSize: 16, fontWeight: '800' },
  previewSub: { fontFamily: FONT, fontSize: 12, fontWeight: '600' },
  uploading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  uploadingText: { fontFamily: FONT, fontSize: 12, fontWeight: '700' },
  removeRow: {
    flexDirection: 'row',
    gap: 18,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  removeText: { fontFamily: FONT, fontSize: 12, fontWeight: '700' },

  sectionCard: { padding: 16, gap: 14, borderWidth: StyleSheet.hairlineWidth },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  sectionIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: { fontFamily: FONT, fontSize: 15, fontWeight: '800' },
  multiline: { height: 92 },
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  typeLabel: { fontFamily: FONT, fontSize: 14, fontWeight: '800' },
  typeBlurb: { fontFamily: FONT, fontSize: 12, fontWeight: '600', lineHeight: 17 },
  note: { fontFamily: FONT, fontSize: 12, fontWeight: '600', lineHeight: 17 },

  danger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderWidth: 1,
  },
  dangerText: { fontFamily: FONT, fontSize: 15, fontWeight: '800' },
});
