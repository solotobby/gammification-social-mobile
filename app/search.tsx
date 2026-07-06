import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MemberRow } from '../src/components/members/MemberRow';
import { BackButton } from '../src/components/ui/BackButton';
import { ScreenBackground } from '../src/components/ui/ScreenBackground';
import { SectionHeader } from '../src/components/ui/SectionHeader';
import { TextField } from '../src/components/ui/TextField';
import { members } from '../src/data/community';
import { useTheme } from '../src/theme/ThemeProvider';

/**
 * Search screen (from the home header) — find people on the platform, using
 * the same search UI as Explore. Shows suggested members until you type.
 */
export default function SearchScreen() {
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
          <View style={{ gap: spacing.md }}>
            <SectionHeader title="Suggested for you" icon="sparkles" />
            {members.slice(0, 6).map((member) => (
              <MemberRow key={member.id} member={member} />
            ))}
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
