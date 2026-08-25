import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../../theme/ThemeProvider';
import { Avatar } from '../ui/Avatar';
import type { StoryItem } from '../../data/stories';
import { FONT } from '../../theme/fonts';

type Props = {
  item: StoryItem;
  onClose: () => void;
};

/** Bottom sheet on your own story: view count + who has seen this item. */
export function StoryViewersSheet({ item, onClose }: Props) {
  const { colors, radius } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.sheet,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderTopLeftRadius: radius.lg,
          borderTopRightRadius: radius.lg,
          paddingBottom: insets.bottom + 16,
        },
      ]}
    >
      <View style={styles.headerRow}>
        <Ionicons name="eye-outline" size={18} color={colors.textMuted} />
        <Text style={[styles.title, { color: colors.text }]}>
          {item.views} view{item.views === 1 ? '' : 's'}
        </Text>
        <Pressable
          onPress={onClose}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Close viewers"
        >
          <Ionicons name="close" size={22} color={colors.text} />
        </Pressable>
      </View>
      <ScrollView style={styles.list}>
        {item.viewers.length === 0 ? (
          <Text style={[styles.empty, { color: colors.textMuted }]}>
            No viewers yet — share your story to get eyes on it.
          </Text>
        ) : (
          item.viewers.map((viewer) => (
            <View key={viewer.id} style={styles.viewerRow}>
              <Avatar name={viewer.name} tint={viewer.tint} size={36} />
              <View style={styles.viewerText}>
                <Text style={[styles.viewerName, { color: colors.text }]} numberOfLines={1}>
                  {viewer.name}
                </Text>
                <Text style={[styles.viewerHandle, { color: colors.textMuted }]} numberOfLines={1}>
                  @{viewer.handle}
                </Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: 340,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontFamily: FONT, flex: 1, fontSize: 16, fontWeight: '800' },
  list: { marginTop: 12 },
  empty: { fontFamily: FONT, fontSize: 13, fontWeight: '600', paddingVertical: 14 },
  viewerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  viewerText: { flex: 1, gap: 1 },
  viewerName: { fontFamily: FONT, fontSize: 14, fontWeight: '800' },
  viewerHandle: { fontFamily: FONT, fontSize: 12, fontWeight: '600' },
});
