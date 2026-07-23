import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { toTopic, toTrendingMember } from '../../src/api/explore';
import { toMemberFromSearch } from '../../src/api/user';
import { MemberRow } from '../../src/components/members/MemberRow';
import { TAB_BAR_CLEARANCE } from '../../src/components/navigation/TabBar';
import { GhostButton } from '../../src/components/ui/GhostButton';
import { ScreenBackground } from '../../src/components/ui/ScreenBackground';
import { SectionHeader } from '../../src/components/ui/SectionHeader';
import { TextField } from '../../src/components/ui/TextField';
import { useDebouncedValue } from '../../src/hooks/useDebouncedValue';
import { useTrending } from '../../src/hooks/useExplore';
import { useSearchUsers } from '../../src/hooks/useUser';
import { useTheme } from '../../src/theme/ThemeProvider';

/**
 * Explore tab — people search (/user/search) plus the trending rails
 * (/explore/trending), merged into one discovery surface.
 */
export default function ExploreScreen() {
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const debounced = useDebouncedValue(query.trim());

  const searching = query.trim().length > 0;

  const search = useSearchUsers(debounced);
  const results = useMemo(
    () => search.data?.pages.flatMap((page) => page.data.map(toMemberFromSearch)) ?? [],
    [search.data],
  );

  const trending = useTrending();
  const topics = useMemo(() => trending.data?.hashtags.map(toTopic) ?? [], [trending.data]);
  const trendingMembers = useMemo(
    () => trending.data?.members.map(toTrendingMember) ?? [],
    [trending.data],
  );

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
            {search.isLoading ? (
              <ActivityIndicator color={colors.brand} style={{ paddingVertical: 24 }} />
            ) : search.isError ? (
              <View style={styles.emptyWrap}>
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                  Couldn't search right now.
                </Text>
                <GhostButton label="Retry" onPress={() => void search.refetch()} />
              </View>
            ) : results.length === 0 ? (
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
              {trending.isLoading ? (
                <ActivityIndicator color={colors.brand} style={{ paddingVertical: 16 }} />
              ) : topics.length === 0 ? (
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                  No trending topics yet.
                </Text>
              ) : (
                <View style={styles.topicWrap}>
                  {topics.map((topic) => (
                    <Pressable
                      key={topic.id}
                      onPress={() => router.push(`/hashtag/${encodeURIComponent(topic.tag)}`)}
                      accessibilityRole="button"
                      accessibilityLabel={`See posts tagged ${topic.tag}`}
                      style={[
                        styles.topicChip,
                        { backgroundColor: colors.surface, borderColor: colors.border },
                      ]}
                    >
                      <Text style={[styles.topicTag, { color: colors.brand }]}>#{topic.tag}</Text>
                      <Text style={[styles.topicCount, { color: colors.textMuted }]}>
                        {topic.posts}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            {/* Trending members */}
            <View style={{ gap: spacing.md }}>
              <SectionHeader
                title="Trending members"
                icon="people"
                onSeeAll={() => router.push('/trending-members')}
              />
              {trending.isLoading ? (
                <ActivityIndicator color={colors.brand} style={{ paddingVertical: 16 }} />
              ) : trendingMembers.length === 0 ? (
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                  No trending members yet.
                </Text>
              ) : (
                trendingMembers.map((member) => <MemberRow key={member.id} member={member} />)
              )}
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
