import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
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

import { AttachmentStrip } from '../src/components/compose/AttachmentStrip';
import { Avatar } from '../src/components/ui/Avatar';
import { GradientButton } from '../src/components/ui/GradientButton';
import { ScreenBackground } from '../src/components/ui/ScreenBackground';
import { addPost, currentUser, trendingTopics, type MediaItem } from '../src/data/community';
import { useTheme } from '../src/theme/ThemeProvider';

const MAX_LENGTH = 160;
const MAX_MEDIA = 6;

let attachmentId = 0;

/**
 * Compose modal — the dashboard's "Say something amazing" box as its own
 * screen: 160-char counter, hashtag suggestions, and the earning reminder.
 */
export default function ComposeScreen() {
  const { colors, radius, spacing } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [body, setBody] = useState('');
  const [media, setMedia] = useState<MediaItem[]>([]);

  const remaining = MAX_LENGTH - body.length;
  const canPost = body.trim().length > 0 || media.length > 0;

  const onPost = () => {
    if (!canPost) return;
    addPost(body.trim(), media);
    router.back();
  };

  const pickMedia = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_MEDIA - media.length,
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.length) return;
    const picked: MediaItem[] = result.assets.map((asset) => ({
      id: `att${++attachmentId}`,
      type: asset.type === 'video' ? 'video' : 'image',
      uri: asset.uri,
      // No thumbnail generation in the dummy phase — the grid falls back to the uri.
      poster: asset.type === 'video' ? asset.uri : undefined,
    }));
    setMedia((current) => [...current, ...picked].slice(0, MAX_MEDIA));
  };

  const addTag = (tag: string) => {
    const insert = `#${tag}`;
    if (body.includes(insert)) return;
    const next = body.length ? `${body.trimEnd()} ${insert}` : insert;
    if (next.length <= MAX_LENGTH) setBody(next);
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
              <Avatar name={currentUser.name} tint={currentUser.tint} size={40} />
              <View>
                <Text style={[styles.editorName, { color: colors.text }]}>
                  {currentUser.name}
                </Text>
                <Text style={[styles.editorHandle, { color: colors.textMuted }]}>
                  @{currentUser.handle}
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
              onRemove={(id) => setMedia((current) => current.filter((m) => m.id !== id))}
              onAdd={pickMedia}
              canAdd={media.length < MAX_MEDIA}
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

          {/* Hashtag suggestions */}
          {/* <View style={styles.tagRow}>
            {trendingTopics.slice(0, 4).map((topic) => (
              <Pressable
                key={topic.id}
                onPress={() => addTag(topic.tag)}
                accessibilityRole="button"
                accessibilityLabel={`Add hashtag ${topic.tag}`}
                style={({ pressed }) => [
                  styles.tagChip,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Text style={[styles.tagText, { color: colors.brand }]}>#{topic.tag}</Text>
              </Pressable>
            ))}
          </View> */}

          <View style={{ opacity: canPost ? 1 : 0.5 }}>
            <GradientButton label="Post" icon="paper-plane" onPress={onPost} />
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
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tagChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  tagText: { fontSize: 14, fontWeight: '800' },
});
