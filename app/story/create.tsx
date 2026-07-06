import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GradientButton } from '../../src/components/ui/GradientButton';
import { ScreenBackground } from '../../src/components/ui/ScreenBackground';
import { addStory, STORY_BACKGROUNDS, type StoryBackground } from '../../src/data/stories';
import { useTheme } from '../../src/theme/ThemeProvider';

type PickedMedia = { uri: string; type: 'image' | 'video' };

const MAX_TEXT = 120;

/**
 * Story composer — write a text story on a gradient, or attach a photo/video
 * from the library with an optional caption. Publishes to the in-memory store.
 */
export default function CreateStoryScreen() {
  const { colors, radius, spacing } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [mode, setMode] = useState<'text' | 'media'>('text');
  const [text, setText] = useState('');
  const [background, setBackground] = useState<StoryBackground>('violet');
  const [media, setMedia] = useState<PickedMedia | null>(null);

  const canShare = mode === 'text' ? text.trim().length > 0 : media !== null;

  const pickMedia = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      quality: 0.8,
    });
    const asset = result.assets?.[0];
    if (!result.canceled && asset) {
      setMedia({ uri: asset.uri, type: asset.type === 'video' ? 'video' : 'image' });
    }
  };

  const onShare = () => {
    if (!canShare) return;
    if (mode === 'text') {
      addStory({ type: 'text', text: text.trim(), background });
    } else if (media) {
      addStory({
        type: media.type,
        uri: media.uri,
        poster: media.type === 'video' ? media.uri : undefined,
        text: text.trim() || undefined,
      });
    }
    router.back();
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScreenBackground />
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View
          style={[
            styles.body,
            {
              paddingTop: insets.top + spacing.lg,
              paddingBottom: insets.bottom + spacing.xl,
              paddingHorizontal: spacing.xl,
              gap: spacing.lg,
            },
          ]}
        >
          {/* Header */}
          <View style={styles.headerRow}>
            <Pressable
              onPress={() => router.back()}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={[styles.closeBtn, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
            >
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Create story</Text>
            <View style={{ width: 44 }} />
          </View>

          {/* Mode toggle */}
          <View style={[styles.toggle, { backgroundColor: colors.surfaceAlt, borderRadius: radius.pill }]}>
            {(['text', 'media'] as const).map((m) => (
              <Pressable
                key={m}
                onPress={() => setMode(m)}
                accessibilityRole="button"
                accessibilityLabel={m === 'text' ? 'Text story' : 'Photo or video story'}
                style={[
                  styles.toggleItem,
                  { borderRadius: radius.pill },
                  mode === m && { backgroundColor: colors.surface },
                ]}
              >
                <Ionicons
                  name={m === 'text' ? 'text' : 'images-outline'}
                  size={15}
                  color={mode === m ? colors.brand : colors.textMuted}
                />
                <Text
                  style={[styles.toggleText, { color: mode === m ? colors.text : colors.textMuted }]}
                >
                  {m === 'text' ? 'Text' : 'Photo / Video'}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Canvas */}
          {mode === 'text' ? (
            <LinearGradient
              colors={[...STORY_BACKGROUNDS[background]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.canvas, { borderRadius: radius.lg }]}
            >
              <TextInput
                value={text}
                onChangeText={(t) => t.length <= MAX_TEXT && setText(t)}
                placeholder="Type your story…"
                placeholderTextColor="rgba(255,255,255,0.7)"
                multiline
                autoFocus
                style={[
                  styles.textInput,
                  Platform.OS === 'web' && ({ outlineStyle: 'none' } as object),
                ]}
              />
              <Text style={styles.counter}>
                {text.length} / {MAX_TEXT}
              </Text>
            </LinearGradient>
          ) : (
            <View style={[styles.canvas, { borderRadius: radius.lg, backgroundColor: colors.surface }]}>
              {media ? (
                <>
                  <Image source={{ uri: media.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                  {media.type === 'video' ? (
                    <View style={styles.videoTag}>
                      <Ionicons name="videocam" size={14} color="#FFFFFF" />
                      <Text style={styles.videoTagText}>Video</Text>
                    </View>
                  ) : null}
                  <Pressable
                    onPress={() => setMedia(null)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Remove media"
                    style={styles.removeBtn}
                  >
                    <Ionicons name="trash-outline" size={18} color="#FFFFFF" />
                  </Pressable>
                  <TextInput
                    value={text}
                    onChangeText={(t) => t.length <= MAX_TEXT && setText(t)}
                    placeholder="Add a caption…"
                    placeholderTextColor="rgba(255,255,255,0.8)"
                    style={[
                      styles.captionInput,
                      Platform.OS === 'web' && ({ outlineStyle: 'none' } as object),
                    ]}
                  />
                </>
              ) : (
                <Pressable
                  onPress={pickMedia}
                  accessibilityRole="button"
                  accessibilityLabel="Choose a photo or video"
                  style={styles.pickPrompt}
                >
                  <View style={[styles.pickIcon, { backgroundColor: colors.surfaceAlt }]}>
                    <Ionicons name="images-outline" size={26} color={colors.brand} />
                  </View>
                  <Text style={[styles.pickTitle, { color: colors.text }]}>Choose from library</Text>
                  <Text style={[styles.pickSub, { color: colors.textMuted }]}>
                    Photos and short videos work best
                  </Text>
                </Pressable>
              )}
            </View>
          )}

          {/* Gradient swatches (text mode) */}
          {mode === 'text' ? (
            <View style={styles.swatchRow}>
              {(Object.keys(STORY_BACKGROUNDS) as StoryBackground[]).map((key) => (
                <Pressable
                  key={key}
                  onPress={() => setBackground(key)}
                  accessibilityRole="button"
                  accessibilityLabel={`${key} background`}
                  style={[
                    styles.swatchRing,
                    { borderColor: background === key ? colors.brand : 'transparent' },
                  ]}
                >
                  <LinearGradient
                    colors={[...STORY_BACKGROUNDS[key]]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.swatch}
                  />
                </Pressable>
              ))}
            </View>
          ) : null}

          <View style={{ opacity: canShare ? 1 : 0.5 }}>
            <GradientButton label="Share to story" icon="paper-plane" onPress={onShare} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  toggle: { flexDirection: 'row', padding: 4 },
  toggleItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 9,
  },
  toggleText: { fontSize: 13, fontWeight: '800' },
  canvas: { flex: 1, overflow: 'hidden' },
  textInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 24,
    lineHeight: 33,
    fontWeight: '800',
    textAlign: 'center',
    textAlignVertical: 'center',
    padding: 24,
  },
  counter: {
    position: 'absolute',
    right: 14,
    bottom: 12,
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    fontWeight: '700',
  },
  videoTag: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  videoTagText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  removeBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captionInput: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  pickPrompt: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  pickIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  pickTitle: { fontSize: 16, fontWeight: '800' },
  pickSub: { fontSize: 13, fontWeight: '600' },
  swatchRow: { flexDirection: 'row', justifyContent: 'center', gap: 12 },
  swatchRing: {
    padding: 3,
    borderRadius: 22,
    borderWidth: 2,
  },
  swatch: { width: 32, height: 32, borderRadius: 16 },
});
