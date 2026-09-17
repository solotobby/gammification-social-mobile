import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '../../src/components/ui/Avatar';
import { ScreenBackground } from '../../src/components/ui/ScreenBackground';
import { TextField } from '../../src/components/ui/TextField';
import { members, type Member } from '../../src/data/community';
import { useMessagesStore } from '../../src/stores/messagesStore';
import { useTheme } from '../../src/theme/ThemeProvider';
import { FONT } from '../../src/theme/fonts';

/**
 * New-message picker — the pencil in the web's Messages header. Choosing a
 * person opens their thread, existing or new (`messagesStore.startWith`).
 *
 * The list is the dummy member set rather than `GET /user/search`, because
 * threads are dummy too: searching real accounts here would open a
 * conversation with someone the store has never heard of. Point it at the
 * search endpoint the moment a messaging API exists.
 */
export default function NewMessageScreen() {
  const { colors, radius, spacing } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const conversations = useMessagesStore((s) => s.conversations);
  const startWith = useMessagesStore((s) => s.startWith);
  const [query, setQuery] = useState('');

  const existing = useMemo(
    () => new Set(conversations.map((c) => c.member.id)),
    [conversations],
  );

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return members;
    return members.filter(
      (m) =>
        m.name.toLowerCase().includes(needle) || m.handle.toLowerCase().includes(needle),
    );
  }, [query]);

  const open = (member: Member) => {
    const conversationId = startWith(member);
    // replace, so backing out of the thread returns to the list rather than
    // reopening this picker.
    router.replace(`/messages/${conversationId}`);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScreenBackground />
      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + spacing.lg,
          paddingBottom: insets.bottom + spacing.xxl,
          paddingHorizontal: spacing.xl,
          gap: spacing.sm,
        }}
        ListHeaderComponent={
          <View style={{ gap: spacing.lg, paddingBottom: spacing.sm }}>
            <View style={styles.headerRow}>
              <Text style={[styles.title, { color: colors.text }]}>New message</Text>
              <Pressable
                onPress={() => router.back()}
                accessibilityRole="button"
                accessibilityLabel="Close"
                style={[styles.close, { backgroundColor: colors.surfaceAlt }]}
              >
                <Ionicons name="close" size={20} color={colors.text} />
              </Pressable>
            </View>
            <TextField
              icon="search-outline"
              placeholder="Search people"
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              autoFocus
            />
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => open(item)}
            accessibilityRole="button"
            accessibilityLabel={`Message ${item.name}`}
            style={({ pressed }) => [
              styles.row,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: radius.md,
                opacity: pressed ? 0.75 : 1,
              },
            ]}
          >
            <Avatar name={item.name} tint={item.tint} uri={item.avatar} size={44} />
            <View style={styles.rowText}>
              <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={[styles.handle, { color: colors.textMuted }]} numberOfLines={1}>
                @{item.handle}
              </Text>
            </View>
            {existing.has(item.id) ? (
              <Text style={[styles.existing, { color: colors.brand }]}>Open</Text>
            ) : (
              <Ionicons name="chatbubble-outline" size={18} color={colors.textMuted} />
            )}
          </Pressable>
        )}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: colors.textMuted }]}>
            Nobody matches “{query.trim()}”.
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontFamily: FONT, flex: 1, fontSize: 22, fontWeight: '800' },
  close: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rowText: { flex: 1, gap: 2 },
  name: { fontFamily: FONT, fontSize: 15, fontWeight: '700' },
  handle: { fontFamily: FONT, fontSize: 12, fontWeight: '500' },
  existing: { fontFamily: FONT, fontSize: 12, fontWeight: '800' },
  empty: { fontFamily: FONT, fontSize: 13, fontWeight: '500', textAlign: 'center', paddingTop: 24 },
});
