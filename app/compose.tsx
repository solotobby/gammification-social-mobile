import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import * as ImagePicker from 'expo-image-picker';

import { ApiError } from '../src/api/client';
import { tintFor, type NewPostImage } from '../src/api/timeline';
import { AttachmentStrip } from '../src/components/compose/AttachmentStrip';
import { Avatar } from '../src/components/ui/Avatar';
import { GradientButton } from '../src/components/ui/GradientButton';
import { ScreenBackground } from '../src/components/ui/ScreenBackground';
import { type MediaItem } from '../src/data/community';
import { useCreatePost } from '../src/hooks/useTimeline';
import { useAuthStore } from '../src/stores/authStore';
import { useFeedbackStore } from '../src/stores/feedbackStore';
import { useTheme } from '../src/theme/ThemeProvider';

const MAX_LENGTH = 160;
const MAX_MEDIA = 6;

/**
 * Compose modal — posts to the timeline API as multipart form data:
 * `content` plus optional `images[]` picked from the library.
 */
export default function ComposeScreen() {
  const { colors, radius, spacing } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const showToast = useFeedbackStore((s) => s.showToast);
  const createPost = useCreatePost();

  const [body, setBody] = useState('');
  const [assets, setAssets] = useState<ImagePicker.ImagePickerAsset[]>([]);
  // Compose is a native modal, so the global toast/error hosts in the root
  // layout can't appear above it — failures surface inline instead.
  const [postError, setPostError] = useState<string | null>(null);

  // The strip renders MediaItems; keep ids stable per asset uri.
  const media: MediaItem[] = useMemo(
    () => assets.map((asset) => ({ id: asset.uri, type: 'image', uri: asset.uri })),
    [assets],
  );

  const remaining = MAX_LENGTH - body.length;
  const canPost = (body.trim().length > 0 || assets.length > 0) && !createPost.isPending;

  const onPost = () => {
    if (!canPost) return;
    setPostError(null);
    const images: NewPostImage[] = assets.map((asset, index) => ({
      uri: asset.uri,
      name: asset.fileName ?? `photo-${index + 1}.jpg`,
      type: asset.mimeType ?? 'image/jpeg',
    }));
    createPost.mutate(
      { content: body.trim(), images },
      {
        onSuccess: (data) => {
          showToast(
            data.media_status === 'processing'
              ? 'Post created — your media will appear shortly.'
              : 'Post created 🎉',
            'success',
          );
          router.back();
        },
        onError: (error) =>
          setPostError(
            error instanceof ApiError ? error.firstMessage : "Couldn't create your post.",
          ),
      },
    );
  };

  const pickMedia = async () => {
    // The create-post API accepts images only (images[]), so no videos here.
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_MEDIA - assets.length,
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.length) return;
    setAssets((current) => [...current, ...result.assets].slice(0, MAX_MEDIA));
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScreenBackground />
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingTop: insets.top + spacing.lg,
            paddingBottom: insets.bottom + spacing.xl,
            paddingHorizontal: spacing.xl,
            gap: spacing.xl,
          }}
        >
          {/* Header */}
          <View style={styles.headerRow}>
            <Pressable
              onPress={() => router.back()}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={[
                styles.closeBtn,
                { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
              ]}
            >
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
            <Text style={[styles.headerTitle, { color: colors.text }]}>New post</Text>
            <Text
              style={[
                styles.counter,
                { color: remaining < 20 ? colors.pink : colors.textMuted },
              ]}
            >
              {body.length} / {MAX_LENGTH}
            </Text>
          </View>

          {/* Editor */}
          <View
            style={[
              styles.editorCard,
              { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg },
            ]}
          >
            <View style={styles.editorHeader}>
              <Avatar name={user?.name ?? 'You'} tint={tintFor(user?.id ?? 'me')} size={40} />
              <View>
                <Text style={[styles.editorName, { color: colors.text }]}>
                  {user?.name ?? 'You'}
                </Text>
                <Text style={[styles.editorHandle, { color: colors.textMuted }]}>
                  @{user?.username ?? 'you'}
                </Text>
              </View>
            </View>
            <TextInput
              value={body}
              onChangeText={(text) => text.length <= MAX_LENGTH && setBody(text)}
              placeholder="Say something amazing every post can earn"
              placeholderTextColor={colors.textMuted}
              selectionColor={colors.brand}
              multiline
              autoFocus
              style={[
                styles.input,
                { color: colors.text },
                // Suppress the browser's default focus ring on web.
                Platform.OS === 'web' && ({ outlineStyle: 'none' } as object),
              ]}
            />

            {/* Attachments */}
            <AttachmentStrip
              media={media}
              onRemove={(id) => setAssets((current) => current.filter((a) => a.uri !== id))}
              onAdd={pickMedia}
              canAdd={assets.length < MAX_MEDIA}
            />
          </View>

          {/* Earning hint */}
          <View
            style={[
              styles.hintBanner,
              { backgroundColor: `${colors.mint}14`, borderColor: `${colors.mint}40`, borderRadius: radius.md },
            ]}
          >
            <Ionicons name="flash" size={18} color={colors.mint} />
            <Text style={[styles.hintText, { color: colors.text }]}>
              Every like, comment & view on this post earns you money. Add hashtags for more
              visibility.
            </Text>
          </View>

          {postError ? (
            <View
              style={[
                styles.errorBanner,
                { backgroundColor: `${colors.pink}14`, borderColor: `${colors.pink}40`, borderRadius: radius.md },
              ]}
            >
              <Ionicons name="alert-circle" size={18} color={colors.pink} />
              <Text style={[styles.errorText, { color: colors.pink }]}>{postError}</Text>
            </View>
          ) : null}

          <View style={{ opacity: canPost || createPost.isPending ? 1 : 0.5 }}>
            <GradientButton
              label="Post"
              icon="paper-plane"
              onPress={onPost}
              loading={createPost.isPending}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: '800' },
  counter: { fontSize: 13, fontWeight: '800' },
  editorCard: {
    padding: 18,
    gap: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  editorHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  editorName: { fontSize: 15, fontWeight: '800' },
  editorHandle: { fontSize: 13, fontWeight: '500' },
  input: {
    minHeight: 130,
    fontSize: 17,
    lineHeight: 25,
    fontWeight: '400',
    textAlignVertical: 'top',
  },
  hintBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderWidth: 1,
  },
  hintText: { flex: 1, fontSize: 13, lineHeight: 19, fontWeight: '500' },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderWidth: 1,
  },
  errorText: { flex: 1, fontSize: 13, lineHeight: 19, fontWeight: '600' },
});
