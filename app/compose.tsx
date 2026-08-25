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
import { tintFor, type NewPostImage, type NewPostVideo } from '../src/api/timeline';
import { AttachmentStrip } from '../src/components/compose/AttachmentStrip';
import { VideoPreview } from '../src/components/compose/VideoPreview';
import { Avatar } from '../src/components/ui/Avatar';
import { GradientButton } from '../src/components/ui/GradientButton';
import { HashtagSpans } from '../src/components/ui/HashtagText';
import { ScreenBackground } from '../src/components/ui/ScreenBackground';
import { type MediaItem } from '../src/data/community';
import { limitsFor } from '../src/data/postLimits';
import { useMe } from '../src/hooks/useMe';
import { useCreatePost } from '../src/hooks/useTimeline';
import { useAuthStore } from '../src/stores/authStore';
import { useFeedbackStore } from '../src/stores/feedbackStore';
import { useTheme } from '../src/theme/ThemeProvider';
import { FONT } from '../src/theme/fonts';

/**
 * Compose modal — posts to the timeline API as multipart form data (`content`
 * plus optional `images[]` or a single `video`). What can be attached depends
 * on the account level from /user/me: Basic is text-only (160 chars), Creator
 * adds up to 1 photo, Influencer up to 4 photos or 1 video. The limits are
 * shown up front and enforced here so the user hits them before the request.
 */
export default function ComposeScreen() {
  const { colors, radius, spacing } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const showToast = useFeedbackStore((s) => s.showToast);
  const createPost = useCreatePost();

  const { data: me } = useMe();
  const limits = limitsFor(me?.level);
  const capped = Number.isFinite(limits.maxChars);

  const [body, setBody] = useState('');
  const [images, setImages] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [video, setVideo] = useState<ImagePicker.ImagePickerAsset | null>(null);
  // Compose is a native modal, so the global toast/error hosts in the root
  // layout can't appear above it — failures surface inline instead.
  const [postError, setPostError] = useState<string | null>(null);

  // The strip renders MediaItems; keep ids stable per asset uri. Only images go
  // through it — a picked video gets its own player preview below.
  const media: MediaItem[] = useMemo(
    () => images.map((asset) => ({ id: asset.uri, type: 'image', uri: asset.uri })),
    [images],
  );

  const remaining = limits.maxChars - body.length;
  const overLimit = capped && body.length > limits.maxChars;
  const hasContent = body.trim().length > 0 || images.length > 0 || !!video;
  const canPost = hasContent && !overLimit && !createPost.isPending;

  // Media rules: images and a video are mutually exclusive (backend rejects
  // "both"), and each tier caps how many of each it allows.
  const canAddImage = limits.maxImages > 0 && images.length < limits.maxImages && !video;
  const canAddVideo = limits.maxVideos > 0 && !video && images.length === 0;
  const showsMedia = limits.maxImages > 0 || limits.maxVideos > 0;

  const onChangeBody = (text: string) => {
    // Clamp rather than reject. Native has no `value` prop to snap back from
    // (the styled children are the source of truth), so ignoring the change
    // would leave the extra characters sitting in the input. Clamping also
    // means pasting past the limit truncates instead of silently doing nothing.
    setBody(capped ? text.slice(0, limits.maxChars) : text);
  };

  const onPost = () => {
    if (!canPost) return;
    setPostError(null);
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
    createPost.mutate(
      { content: body.trim(), images: imageParts, video: videoPart },
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

  const pickImages = async () => {
    if (!canAddImage) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: limits.maxImages > 1,
      selectionLimit: limits.maxImages - images.length,
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.length) return;
    setImages((current) => [...current, ...result.assets].slice(0, limits.maxImages));
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
  };

  // The strip only carries images now — the video preview removes itself.
  const onRemove = (id: string) => {
    setImages((current) => current.filter((a) => a.uri !== id));
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
                { color: capped && remaining < 20 ? colors.pink : colors.textMuted },
              ]}
            >
              {capped ? `${body.length} / ${limits.maxChars}` : `${body.length}`}
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
              <View style={styles.editorHeaderText}>
                <Text style={[styles.editorName, { color: colors.text }]}>
                  {user?.name ?? 'You'}
                </Text>
                <Text style={[styles.editorHandle, { color: colors.textMuted }]}>
                  @{user?.username ?? 'you'}
                </Text>
              </View>
              {/* Level badge */}
              <View
                style={[
                  styles.levelBadge,
                  { backgroundColor: `${colors.brand}1A`, borderColor: `${colors.brand}40` },
                ]}
              >
                <Ionicons name="ribbon" size={12} color={colors.brand} />
                <Text style={[styles.levelText, { color: colors.brand }]}>{limits.level}</Text>
              </View>
            </View>
            <TextInput
              // Native drives the text through the styled children below;
              // passing `value` as well makes iOS render the content twice.
              value={Platform.OS === 'web' ? body : undefined}
              onChangeText={onChangeBody}
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
            >
              {/* Styled children tint hashtags as they're typed. Native only:
                  react-native-web renders this as a <textarea>, which can't
                  hold styled children — there `value` alone drives the text. */}
              {Platform.OS === 'web' ? null : <HashtagSpans text={body} />}
            </TextInput>

            {/* Attachment thumbnails (adds happen via the buttons below) */}
            {media.length ? (
              <AttachmentStrip media={media} onRemove={onRemove} onAdd={() => {}} canAdd={false} />
            ) : null}

            {/* A picked video previews as a real, playable frame — you see what
                you're about to post before the upload starts. */}
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

            {/* Media actions — vary by level */}
            {showsMedia ? (
              <View style={styles.mediaActions}>
                {limits.maxImages > 0 ? (
                  <Pressable
                    onPress={pickImages}
                    disabled={!canAddImage}
                    accessibilityRole="button"
                    accessibilityLabel="Add photo"
                    style={[
                      styles.mediaBtn,
                      {
                        backgroundColor: colors.surfaceAlt,
                        borderColor: colors.border,
                        borderRadius: radius.md,
                        opacity: canAddImage ? 1 : 0.45,
                      },
                    ]}
                  >
                    <Ionicons name="image-outline" size={18} color={colors.brand} />
                    <Text style={[styles.mediaBtnText, { color: colors.text }]}>
                      Photo{limits.maxImages > 1 ? ` ${images.length}/${limits.maxImages}` : ''}
                    </Text>
                  </Pressable>
                ) : null}
                {limits.maxVideos > 0 ? (
                  <Pressable
                    onPress={pickVideo}
                    disabled={!canAddVideo}
                    accessibilityRole="button"
                    accessibilityLabel="Add video"
                    style={[
                      styles.mediaBtn,
                      {
                        backgroundColor: colors.surfaceAlt,
                        borderColor: colors.border,
                        borderRadius: radius.md,
                        opacity: canAddVideo ? 1 : 0.45,
                      },
                    ]}
                  >
                    <Ionicons name="videocam-outline" size={18} color={colors.brand} />
                    <Text style={[styles.mediaBtnText, { color: colors.text }]}>Video</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </View>

          {/* Level limits banner — always states what this tier can attach */}
          <View
            style={[
              styles.tierBanner,
              { backgroundColor: `${colors.brand}12`, borderColor: `${colors.brand}33`, borderRadius: radius.md },
            ]}
          >
            <Ionicons name="information-circle" size={18} color={colors.brand} />
            <Text style={[styles.tierText, { color: colors.text }]}>
              {limits.level === 'Basic' ? (
                <>
                  As a Basic member you can post{' '}
                  <Text style={styles.tierEmphasis}>text only (up to 160 characters)</Text>.{' '}
                  <Text style={{ color: colors.brand }} onPress={() => router.push('/upgrade')}>
                    Upgrade
                  </Text>{' '}
                  to add photos and videos.
                </>
              ) : (
                <>
                  As {limits.level === 'Influencer' ? 'an' : 'a'}{' '}
                  <Text style={styles.tierEmphasis}>{limits.level}</Text> you can post{' '}
                  {limits.mediaSummary.replace(/^Unlimited text and /, 'unlimited text with ')}.
                  {limits.maxVideos > 0 && limits.maxImages > 0
                    ? ' Photos and a video can’t be mixed in one post.'
                    : ''}
                </>
              )}
            </Text>
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
  headerTitle: { fontFamily: FONT, flex: 1, fontSize: 20, fontWeight: '800' },
  counter: { fontFamily: FONT, fontSize: 13, fontWeight: '800' },
  editorCard: {
    padding: 18,
    gap: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  editorHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  editorHeaderText: { flex: 1 },
  editorName: { fontFamily: FONT, fontSize: 15, fontWeight: '800' },
  editorHandle: { fontFamily: FONT, fontSize: 13, fontWeight: '500' },
  levelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  levelText: { fontFamily: FONT, fontSize: 12, fontWeight: '800' },
  input: {
    fontFamily: FONT,
    minHeight: 130,
    fontSize: 17,
    lineHeight: 25,
    fontWeight: '400',
    textAlignVertical: 'top',
  },
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
  tierBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderWidth: 1,
  },
  tierText: { fontFamily: FONT, flex: 1, fontSize: 13, lineHeight: 19, fontWeight: '500' },
  tierEmphasis: { fontFamily: FONT, fontWeight: '800' },
  hintBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderWidth: 1,
  },
  hintText: { fontFamily: FONT, flex: 1, fontSize: 13, lineHeight: 19, fontWeight: '500' },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderWidth: 1,
  },
  errorText: { fontFamily: FONT, flex: 1, fontSize: 13, lineHeight: 19, fontWeight: '600' },
});
