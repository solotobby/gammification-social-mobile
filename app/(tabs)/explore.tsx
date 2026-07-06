import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MemberRow } from '../../src/components/members/MemberRow';
import { TAB_BAR_CLEARANCE } from '../../src/components/navigation/TabBar';
import { ScreenBackground } from '../../src/components/ui/ScreenBackground';
import { SectionHeader } from '../../src/components/ui/SectionHeader';
import { TextField } from '../../src/components/ui/TextField';
import { members, trendingTopics } from '../../src/data/community';
import { useTheme } from '../../src/theme/ThemeProvider';

/**
 * Explore tab — the web "Search People" plus the dashboard's trending rails,
 * merged into one discovery surface.
 */
export default function ExploreScreen() {
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return members.filter(
      (m) => m.name.toLowerCase().includes(q) || m.handle.toLowerCase().includes(q),
    );
  }, [query]);

  const searching = query.trim().length > 0;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScreenBackground />
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingTop: insets.top + spacing.lg,
          paddingBottom: insets.bottom + TAB_BAR_CLEARANCE,
          paddingHorizontal: spacing.xl,
          gap: spacing.xl,
        }}
      >
        <Text style={[styles.title, { color: colors.text }]}>Explore</Text>

        <TextField
          icon="search-outline"
          placeholder="Search people"
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />

        {searching ? (
          <View style={{ gap: spacing.md }}>
            <SectionHeader title={`Results (${results.length})`} icon="people" />
            {results.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Ionicons name="search" size={28} color={colors.textMuted} />
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                  No one matches “{query.trim()}” yet
                </Text>
              </View>
            ) : (
              results.map((member) => <MemberRow key={member.id} member={member} />)
            )}
          </View>
        ) : (
          <>
            {/* Trending topics */}
            <View style={{ gap: spacing.md }}>
              <SectionHeader
                title="Trending topics"
                icon="flame"
                onSeeAll={() => router.push('/trending-topics')}
              />
              <View style={styles.topicWrap}>
                {trendingTopics.map((topic) => (
                  <View
                    key={topic.id}
                    style={[
                      styles.topicChip,
                      { backgroundColor: colors.surface, borderColor: colors.border },
                    ]}
                  >
                    <Text style={[styles.topicTag, { color: colors.brand }]}>#{topic.tag}</Text>
                    <Text style={[styles.topicCount, { color: colors.textMuted }]}>
                      {topic.posts}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Trending members */}
            <View style={{ gap: spacing.md }}>
              <SectionHeader
                title="Trending members"
                icon="people"
                onSeeAll={() => router.push('/trending-members')}
              />
              {members.slice(0, 6).map((member) => (
                <MemberRow key={member.id} member={member} />
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  title: { fontSize: 26, fontWeight: '800' },
  topicWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  topicChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  topicTag: { fontSize: 14, fontWeight: '800' },
  topicCount: { fontSize: 12, fontWeight: '700' },
  emptyWrap: { alignItems: 'center', gap: 10, paddingVertical: 32 },
  emptyText: { fontSize: 14, fontWeight: '600' },
});
