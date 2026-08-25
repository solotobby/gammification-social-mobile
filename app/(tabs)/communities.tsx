import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CommunityCard } from '../../src/components/community/CommunityCard';
import { Avatar } from '../../src/components/ui/Avatar';
import { BackButton } from '../../src/components/ui/BackButton';
import { ScreenBackground } from '../../src/components/ui/ScreenBackground';
import { SectionHeader } from '../../src/components/ui/SectionHeader';
import { TextField } from '../../src/components/ui/TextField';
import {
  COMMUNITY_CATEGORIES,
  communities,
  isJoined,
  myCommunities,
  trendingCommunities,
} from '../../src/data/communities';
import { useTheme } from '../../src/theme/ThemeProvider';

/** Chips above the list: the two membership views, then every category. */
const FILTERS = ['All', 'Joined', 'My communities', ...COMMUNITY_CATEGORIES] as const;
type Filter = (typeof FILTERS)[number];

/**
 * Communities — the mobile port of the web `/community` page: create banner,
 * search, filter chips, and the community list. Trending sits at the top as a
 * rail rather than a sidebar, since there's no room for one on a phone.
 */
export default function CommunitiesScreen() {
  const { colors, brand, radius, spacing } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('All');

  // Membership and newly created communities are module-level state, so
  // re-snapshot on focus (same pattern as the feed / stories screens).
  const [, setTick] = useState(0);
  useFocusEffect(useCallback(() => setTick((t) => t + 1), []));

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    let list = communities;
    if (filter === 'Joined') list = list.filter((c) => isJoined(c.id));
    else if (filter === 'My communities') list = myCommunities();
    else if (filter !== 'All') list = list.filter((c) => c.category === filter);
    if (needle) {
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(needle) ||
          c.description.toLowerCase().includes(needle),
      );
    }
    return list;
  }, [query, filter]);

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
          <Text style={[styles.headerTitle, { color: colors.text }]}>Communities</Text>
          <View style={{ width: 44 }} />
        </View>

        {/* Create banner */}
        <LinearGradient
          colors={[brand.violetBright, brand.violet]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.createCard, { borderRadius: radius.lg, shadowColor: brand.violet }]}
        >
          <Text style={styles.createTitle}>Build a community, earn together</Text>
          <Text style={styles.createBlurb}>
            Group up with creators around a shared topic. Members can post, chat, and grow
            their engagement earnings side by side.
          </Text>
          <Pressable
            onPress={() => router.push('/community/create')}
            accessibilityRole="button"
            accessibilityLabel="Create community"
            style={({ pressed }) => [
              styles.createBtn,
              { borderRadius: radius.pill, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Ionicons name="add" size={18} color={brand.violet} />
            <Text style={[styles.createBtnText, { color: brand.violet }]}>
              Create community
            </Text>
          </Pressable>
        </LinearGradient>

        {/* Trending */}
        <View style={{ gap: spacing.md }}>
          <SectionHeader title="Trending communities" icon="flame" />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.trendRail}
          >
            {trendingCommunities.map((community, index) => (
              <Pressable
                key={community.id}
                onPress={() => router.push(`/community/${community.slug}`)}
                accessibilityRole="button"
                accessibilityLabel={community.name}
                style={({ pressed }) => [
                  styles.trendCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderRadius: radius.md,
                    opacity: pressed ? 0.9 : 1,
                  },
                ]}
              >
                <View style={styles.trendTop}>
                  <Text style={[styles.trendRank, { color: colors.textMuted }]}>
                    {index + 1}
                  </Text>
                  <Avatar name={community.name} tint={community.tint} size={34} />
                </View>
                <Text style={[styles.trendName, { color: colors.text }]} numberOfLines={1}>
                  {community.name}
                </Text>
                <Text style={[styles.trendMeta, { color: colors.textMuted }]}>
                  {community.people.length} members
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Search + filters */}
        <View style={{ gap: spacing.md }}>
          <TextField
            icon="search-outline"
            placeholder="Search communities"
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRail}
          >
            {FILTERS.map((item) => {
              const active = item === filter;
              return (
                <Pressable
                  key={item}
                  onPress={() => setFilter(item)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={[
                    styles.chip,
                    active
                      ? { backgroundColor: colors.brand, borderColor: colors.brand }
                      : { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: active ? colors.onBrand : colors.textSecondary },
                    ]}
                  >
                    {item}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* List */}
        <View style={{ gap: spacing.md }}>
          <SectionHeader title={`All communities (${results.length})`} icon="people" />
          {results.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Ionicons name="people-outline" size={30} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                {filter === 'Joined' || filter === 'My communities'
                  ? "You haven't joined any communities yet."
                  : 'No communities match that yet.'}
              </Text>
            </View>
          ) : (
            results.map((community) => (
              <CommunityCard key={community.id} community={community} />
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  createCard: {
    padding: 20,
    gap: 8,
    shadowOpacity: 0.3,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  createTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  createBlurb: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    backgroundColor: '#FFFFFF',
    marginTop: 8,
  },
  createBtnText: { fontSize: 14, fontWeight: '800' },
  trendRail: { gap: 12, paddingRight: 4 },
  trendCard: {
    width: 148,
    padding: 14,
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
  },
  trendTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  trendRank: { fontSize: 15, fontWeight: '900' },
  trendName: { fontSize: 14, fontWeight: '800', marginTop: 2 },
  trendMeta: { fontSize: 12, fontWeight: '600' },
  chipRail: { gap: 8, paddingRight: 4 },
  chip: {
    paddingHorizontal: 15,
    height: 36,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  chipText: { fontSize: 13, fontWeight: '700' },
  emptyWrap: { alignItems: 'center', gap: 10, paddingVertical: 34 },
  emptyText: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
});
