import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import { useQueryClient, type InfiniteData } from '@tanstack/react-query';

import { ApiError } from '../../../src/api/client';
import { toPost, type NewPostImage, type NewPostVideo } from '../../../src/api/timeline';
import type { Paginated, TimelinePost } from '../../../src/api/types';
import { AttachmentStrip } from '../../../src/components/compose/AttachmentStrip';
import { VideoPreview } from '../../../src/components/compose/VideoPreview';
import { MediaGrid } from '../../../src/components/feed/MediaGrid';
import { BackButton } from '../../../src/components/ui/BackButton';
import { GradientButton } from '../../../src/components/ui/GradientButton';
import { ScreenBackground } from '../../../src/components/ui/ScreenBackground';
import { type MediaItem } from '../../../src/data/community';
import { limitsFor } from '../../../src/data/postLimits';
import { useMe } from '../../../src/hooks/useMe';
import { usePost, useUpdatePost } from '../../../src/hooks/useTimeline';
import { useFeedbackStore } from '../../../src/stores/feedbackStore';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { FONT } from '../../../src/theme/fonts';

/**
 * Edit an existing post — PUT /timeline/post/{id}, reached from the ⋯ menu on
 * your own post.
 *
 * What the API allows, and therefore what this screen offers, is narrower than
 * compose and none of it is documented — it was established by probing:
 *
 * - **New photos append.** `images[]` adds to what the post already has, and the
 *   tier cap counts existing + new, so the picker's budget is
 *   `maxImages − existingImages`.
 * - **Individual photos can't be removed.** No endpoint returns per-image ids
 *   any more, so `remove_image_ids[]` can't be populated. The screen says so
 *   rather than showing an X that would silently do nothing.
 * - **A video can be removed or replaced** (`remove_video`, `video`).
 * - **Media can't be touched while the post is transcoding** — the backend
 *   rejects it with "Media cannot be changed while processing is in progress",
 *   so those controls disable and explain themselves.
 *
 * Photos and a video still can't be mixed, exactly as in compose.
 */
export default function EditPostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, radius, spacing } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const showToast = useFeedbackStore((s) => s.showToast);
  const queryClient = useQueryClient();

  // Prefer the copy the feed already holds. Fetching the detail endpoint
  // *registers a view*, and opening your own editor shouldn't inflate your own
  // metrics — the fetch only happens when the post isn't cached (a deep link).
  const cached = useMemo(() => {
    const feed = queryClient.getQueryData<InfiniteData<Paginated<TimelinePost>>>(['feed']);
    return feed?.pages.flatMap((page) => page.data).find((entry) => entry.id === id);
  }, [queryClient, id]);
  const query = usePost(id, !cached);
  const apiPost = cached ?? query.data?.post;
  const post = apiPost ? toPost(apiPost) : undefined;

  const { data: me } = useMe();
  const limits = limitsFor(me?.level);
  const capped = Number.isFinite(limits.maxChars);

  const updatePost = useUpdatePost();

  const [body, setBody] = useState('');
  const [images, setImages] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [video, setVideo] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [removeVideo, setRemoveVideo] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Prefill once the post resolves (it may arrive after first render).
  const [prefilled, setPrefilled] = useState(false);
  useEffect(() => {
    if (post && !prefilled) {
      setBody(post.body);
      setPrefilled(true);
    }
  }, [post, prefilled]);

  const existingMedia = post?.media ?? [];
  const existingImages = existingMedia.filter((item) => item.type === 'image');
  const existingVideo = existingMedia.find((item) => item.type === 'video');
  const mediaLocked = apiPost?.media_status === 'processing';

  const newMedia: MediaItem[] = useMemo(
    () => images.map((asset) => ({ id: asset.uri, type: 'image', uri: asset.uri })),
    [images],
  );

  const imageSlots = Math.max(0, limits.maxImages - existingImages.length);
  const hasVideo = (!!existingVideo && !removeVideo) || !!video;
  const canAddImage =
    !mediaLocked && imageSlots > images.length && !hasVideo && existingImages.length + images.length < limits.maxImages;
  const canAddVideo =
    !mediaLocked && limits.maxVideos > 0 && existingImages.length === 0 && images.length === 0;

  const remaining = limits.maxChars - body.length;
  const overLimit = capped && body.length > limits.maxChars;
  const contentChanged = !!post && body.trim() !== post.body.trim();
  const mediaChanged = images.length > 0 || !!video || removeVideo;
  const canSave =
    !!post && !overLimit && (contentChanged || mediaChanged) && !updatePost.isPending;

  const onChangeBody = (text: string) => {
    setBody(capped ? text.slice(0, limits.maxChars) : text);
  };

  const pickImages = async () => {
    if (!canAddImage) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: imageSlots > 1,
      selectionLimit: imageSlots - images.length,
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.length) return;
    setImages((current) => [...current, ...result.assets].slice(0, imageSlots));
  };

  const pickVideo = async () => {
    if (!canAddVideo) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsMultipleSelection: false,
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.length) return;
    setVideo(result.assets[0]);
    // Picking a replacement supersedes a pending removal.
    setRemoveVideo(false);
  };

  const onSave = () => {
    if (!canSave || !post) return;
    setSaveError(null);
    const imageParts: NewPostImage[] = images.map((asset, index) => ({
      uri: asset.uri,
      name: asset.fileName ?? `photo-${index + 1}.jpg`,
      type: asset.mimeType ?? 'image/jpeg',
    }));
    const videoPart: NewPostVideo | null = video
      ? {
          uri: video.uri,
          name: video.fileName ?? 'video.mp4',
          type: video.mimeType ?? 'video/mp4',
        }
      : null;

    updatePost.mutate(
      {
        postId: post.id,
        edit: {
          content: body.trim(),
          images: imageParts,
          video: videoPart,
          removeVideo: removeVideo && !video,
        },
      },
      {
        onSuccess: (data) => {
          showToast(
            data.media_status === 'processing'
              ? 'Post updated — your media will appear shortly.'
              : 'Post updated.',
            'success',
          );
          router.back();
        },
        onError: (error) =>
          setSaveError(
            error instanceof ApiError ? error.firstMessage : "Couldn't save your changes.",
          ),
      },
    );
  };

  const mediaButton = (
    icon: keyof typeof Ionicons.glyphMap,
    label: string,
    onPress: () => void,
    enabled: boolean,
  ) => (
    <Pressable
      onPress={onPress}
      disabled={!enabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        styles.mediaBtn,
        {
          backgroundColor: colors.surfaceAlt,
          borderColor: colors.border,
          borderRadius: radius.md,
          opacity: enabled ? 1 : 0.45,
        },
      ]}
    >
      <Ionicons name={icon} size={18} color={colors.brand} />
      <Text style={[styles.mediaBtnText, { color: colors.text }]}>{label}</Text>
    </Pressable>
  );

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
            gap: spacing.lg,
          }}
        >
          <View style={styles.headerRow}>
            <BackButton onPress={() => router.back()} />
            <Text style={[styles.headerTitle, { color: colors.text }]}>Edit post</Text>
            <Text
              style={[
                styles.counter,
                { color: capped && remaining < 20 ? colors.pink : colors.textMuted },
              ]}
            >
              {capped ? `${body.length} / ${limits.maxChars}` : `${body.length}`}
            </Text>
          </View>

          {!post ? (
            <View style={styles.stateWrap}>
              {query.isError ? (
                <Text style={[styles.note, { color: colors.textMuted }]}>
                  We couldn't load this post.
                </Text>
              ) : (
                <>
                  <ActivityIndicator color={colors.brand} />
                  <Text style={[styles.note, { color: colors.textMuted }]}>Loading post…</Text>
                </>
              )}
            </View>
          ) : (
            <>
              <View
                style={[
                  styles.editorCard,
                  { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg },
                ]}
              >
                <TextInput
                  value={body}
                  onChangeText={onChangeBody}
                  placeholder="Say something amazing"
                  placeholderTextColor={colors.textMuted}
                  selectionColor={colors.brand}
                  multiline
                  style={[
                    styles.input,
                    { color: colors.text },
                    Platform.OS === 'web' && ({ outlineStyle: 'none' } as object),
                  ]}
                />

                {/* What the post already has. Read-only on purpose — see the
                    header comment: there are no per-image ids to remove by. */}
                {existingImages.length ? (
                  <View style={{ gap: 8 }}>
                    <MediaGrid media={existingImages} />
                    <Text style={[styles.note, { color: colors.textMuted }]}>
                      Photos already on this post can't be removed individually — the API
                      doesn't expose per-photo ids. You can still add more.
                    </Text>
                  </View>
                ) : null}

                {existingVideo && !video ? (
                  <View style={{ gap: 8 }}>
                    <View style={{ opacity: removeVideo ? 0.4 : 1 }}>
                      <MediaGrid media={[existingVideo]} />
                    </View>
                    <Pressable
                      onPress={() => setRemoveVideo((r) => !r)}
                      disabled={mediaLocked}
                      accessibilityRole="button"
                      accessibilityLabel={removeVideo ? 'Keep video' : 'Remove video'}
                      style={[styles.removeRow, { opacity: mediaLocked ? 0.45 : 1 }]}
                    >
                      <Ionicons
                        name={removeVideo ? 'refresh-outline' : 'trash-outline'}
                        size={17}
                        color={removeVideo ? colors.brand : colors.danger}
                      />
                      <Text
                        style={[
                          styles.removeText,
                          { color: removeVideo ? colors.brand : colors.danger },
                        ]}
                      >
                        {removeVideo ? 'Keep the video after all' : 'Remove video'}
                      </Text>
                    </Pressable>
                  </View>
                ) : null}

                {/* Newly picked media */}
                {newMedia.length ? (
                  <AttachmentStrip
                    media={newMedia}
                    onRemove={(itemId) =>
                      setImages((current) => current.filter((a) => a.uri !== itemId))
                    }
                    onAdd={() => {}}
                    canAdd={false}
                  />
                ) : null}

                {video ? (
                  <VideoPreview
                    uri={video.uri}
                    width={video.width}
                    height={video.height}
                    durationMs={video.duration ?? undefined}
                    fileSize={video.fileSize}
                    onRemove={() => setVideo(null)}
                  />
                ) : null}

                {limits.maxImages > 0 || limits.maxVideos > 0 ? (
                  <View style={styles.mediaActions}>
                    {limits.maxImages > 0 && !existingVideo
                      ? mediaButton(
                          'image-outline',
                          imageSlots > 1
                            ? `Photo ${images.length}/${imageSlots}`
                            : 'Photo',
                          () => void pickImages(),
                          canAddImage,
                        )
                      : null}
                    {limits.maxVideos > 0 && existingImages.length === 0
                      ? mediaButton(
                          'videocam-outline',
                          existingVideo ? 'Replace video' : 'Video',
                          () => void pickVideo(),
                          canAddVideo,
                        )
                      : null}
                  </View>
                ) : null}

                {mediaLocked ? (
                  <Text style={[styles.note, { color: colors.textMuted }]}>
                    This post's media is still being processed. Media can't be changed until
                    that finishes — the caption can.
                  </Text>
                ) : null}
              </View>

              {saveError ? (
                <View
                  style={[
                    styles.errorBanner,
                    { backgroundColor: `${colors.pink}14`, borderColor: `${colors.pink}40`, borderRadius: radius.md },
                  ]}
                >
                  <Ionicons name="alert-circle" size={18} color={colors.pink} />
                  <Text style={[styles.errorText, { color: colors.pink }]}>{saveError}</Text>
                </View>
              ) : null}

              <View style={{ opacity: canSave || updatePost.isPending ? 1 : 0.5 }}>
                <GradientButton
                  label="Save changes"
                  icon="checkmark"
                  onPress={onSave}
                  loading={updatePost.isPending}
                />
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  headerTitle: { fontFamily: FONT, flex: 1, fontSize: 20, fontWeight: '800' },
  counter: { fontFamily: FONT, fontSize: 13, fontWeight: '800' },
  stateWrap: { alignItems: 'center', gap: 12, paddingVertical: 40 },
  editorCard: {
    padding: 18,
    gap: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  input: {
    fontFamily: FONT,
    minHeight: 120,
    fontSize: 17,
    lineHeight: 25,
    fontWeight: '400',
    textAlignVertical: 'top',
  },
  note: { fontFamily: FONT, fontSize: 12, lineHeight: 17, fontWeight: '500' },
  removeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  removeText: { fontFamily: FONT, fontSize: 13, fontWeight: '700' },
  mediaActions: { flexDirection: 'row', gap: 10 },
  mediaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  mediaBtnText: { fontFamily: FONT, fontSize: 13, fontWeight: '700' },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderWidth: 1,
  },
  errorText: { fontFamily: FONT, flex: 1, fontSize: 13, lineHeight: 19, fontWeight: '600' },
});
