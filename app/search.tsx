import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { toTrendingMember } from '../src/api/explore';
import { toMemberFromSearch } from '../src/api/user';
import { MemberRow } from '../src/components/members/MemberRow';
import { BackButton } from '../src/components/ui/BackButton';
import { GhostButton } from '../src/components/ui/GhostButton';
import { ScreenBackground } from '../src/components/ui/ScreenBackground';
import { SectionHeader } from '../src/components/ui/SectionHeader';
import { TextField } from '../src/components/ui/TextField';
import { useDebouncedValue } from '../src/hooks/useDebouncedValue';
import { useTrendingMembers } from '../src/hooks/useExplore';
import { useSearchUsers } from '../src/hooks/useUser';
import { useTheme } from '../src/theme/ThemeProvider';

/**
 * Search screen (from the home header) — find people via /user/search, using
 * the same search UI as Explore. Shows trending members as suggestions until
 * you type.
 */
export default function SearchScreen() {
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

  const trending = useTrendingMembers();
  const suggested = useMemo(
    () => trending.data?.pages.flatMap((page) => page.data.map(toTrendingMember)) ?? [],
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
          paddingBottom: insets.bottom + spacing.xl,
          paddingHorizontal: spacing.xl,
          gap: spacing.xl,
        }}
      >
        <View style={styles.headerRow}>
          <BackButton onPress={() => router.back()} />
          <Text style={[styles.headerTitle, { color: colors.text }]}>Search</Text>
          <View style={{ width: 44 }} />
        </View>

        <TextField
          icon="search-outline"
          placeholder="Search people"
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
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
          <View style={{ gap: spacing.md }}>
            <SectionHeader title="Suggested for you" icon="sparkles" />
            {trending.isLoading ? (
              <ActivityIndicator color={colors.brand} style={{ paddingVertical: 24 }} />
            ) : suggested.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                  Start typing to find people.
                </Text>
              </View>
            ) : (
              suggested.map((member) => <MemberRow key={member.id} member={member} />)
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  emptyWrap: { alignItems: 'center', gap: 10, paddingVertical: 32 },
  emptyText: { fontSize: 14, fontWeight: '600' },
});
