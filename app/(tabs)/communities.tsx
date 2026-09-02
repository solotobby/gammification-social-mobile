import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { toCommunity, type Community } from '../../src/api/communities';
import { CommunityCard } from '../../src/components/community/CommunityCard';
import { TAB_BAR_CLEARANCE } from '../../src/components/navigation/TabBar';
import { Avatar } from '../../src/components/ui/Avatar';
import { ScreenBackground } from '../../src/components/ui/ScreenBackground';
import { SectionHeader } from '../../src/components/ui/SectionHeader';
import { TextField } from '../../src/components/ui/TextField';
import {
  useCommunityCategories,
  useCommunityList,
  type CommunityFilter,
} from '../../src/hooks/useCommunities';
import { useDebouncedValue } from '../../src/hooks/useDebouncedValue';
import { useTheme } from '../../src/theme/ThemeProvider';
import { FONT } from '../../src/theme/fonts';

/** The three membership views `GET /communities?filter=` supports. */
const MEMBERSHIP_FILTERS: { value: CommunityFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'joined', label: 'Joined' },
  { value: 'mine', label: 'My communities' },
];

/**
 * Communities — `GET /communities`, paged.
 *
 * Search, the membership views and the category chips are all **server-side**:
 * the endpoint validates `search`, `filter` (`all` | `joined` | `mine`) and
 * `category_id`, so filtering happens in the query key rather than over a
 * client-side array. That matters for the category chips especially — they come
 * from `GET /communities/categories`, and there's no guarantee a category's
 * communities are all on the first page.
 */
export default function CommunitiesScreen() {
  const { colors, brand, radius, spacing } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<CommunityFilter>('all');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const search = useDebouncedValue(query.trim(), 350);

  const { data: categories } = useCommunityCategories();
  const {
    data,
    isLoading,
    isRefetching,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useCommunityList({
    filter,
    search: search || undefined,
    category_id: categoryId ?? undefined,
  });

  const communities: Community[] = useMemo(
    () => (data?.pages ?? []).flatMap((page) => page.page.data.map(toCommunity)),
    [data],
  );

  const total = data?.pages[0]?.page.total ?? 0;

  /**
   * The rail. The API has no trending/ranked communities endpoint, so this is
   * ordered by the one signal the rows actually carry — member count — and
   * labelled as exactly that. It is deliberately not called "trending": that
   * would imply a ranking nothing here computes.
   */
  const mostMembers = useMemo(
    () => [...communities].sort((a, b) => b.members - a.members).slice(0, 6),
    [communities],
  );

  const emptyLabel =
    filter === 'joined'
      ? "You haven't joined any communities yet."
      : filter === 'mine'
        ? "You haven't created a community yet."
        : search
          ? `No communities match "${search}".`
          : 'No communities yet — create the first one.';

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScreenBackground />
      <FlatList
        data={communities}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <CommunityCard community={item} />}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onRefresh={refetch}
        refreshing={isRefetching && !isFetchingNextPage}
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) fetchNextPage();
        }}
        contentContainerStyle={{
          paddingTop: insets.top + spacing.lg,
          paddingBottom: insets.bottom + TAB_BAR_CLEARANCE,
          paddingHorizontal: spacing.xl,
          gap: spacing.md,
        }}
        ListHeaderComponent={
          <View style={{ gap: spacing.xl, marginBottom: spacing.md }}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Communities</Text>

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

            {mostMembers.length > 1 ? (
              <View style={{ gap: spacing.md }}>
                <SectionHeader title="Most members" icon="people" />
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.trendRail}
                >
                  {mostMembers.map((community, index) => (
                    <Pressable
                      key={community.id}
                      onPress={() => router.push(`/community/${community.id}`)}
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
                        <Avatar name={community.name} tint={community.owner.tint} size={34} />
                      </View>
                      <Text style={[styles.trendName, { color: colors.text }]} numberOfLines={1}>
                        {community.name}
                      </Text>
                      <Text style={[styles.trendMeta, { color: colors.textMuted }]}>
                        {community.members} {community.members === 1 ? 'member' : 'members'}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ) : null}

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
                {MEMBERSHIP_FILTERS.map((item) => {
                  const active = item.value === filter && !categoryId;
                  return (
                    <Pressable
                      key={item.value}
                      onPress={() => {
                        setFilter(item.value);
                        setCategoryId(null);
                      }}
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
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
                {(categories ?? []).map((category) => {
                  const active = category.id === categoryId;
                  return (
                    <Pressable
                      key={category.id}
                      onPress={() => setCategoryId(active ? null : category.id)}
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
                        {category.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            <SectionHeader
              title={`${
                MEMBERSHIP_FILTERS.find((f) => f.value === filter && !categoryId)?.label ??
                categories?.find((c) => c.id === categoryId)?.name ??
                'All'
              }${filter === 'all' && !categoryId ? ' communities' : ''}${
                total ? ` (${total})` : ''
              }`}
              icon="people"
            />
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.emptyWrap}>
              <ActivityIndicator color={colors.brand} />
            </View>
          ) : (
            <View style={styles.emptyWrap}>
              <Ionicons name="people-outline" size={30} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>{emptyLabel}</Text>
            </View>
          )
        }
        ListFooterComponent={
          isFetchingNextPage ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator color={colors.brand} />
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerTitle: { fontFamily: FONT, fontSize: 22, fontWeight: '800' },
  createCard: {
    padding: 20,
    gap: 8,
    shadowOpacity: 0.3,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  createTitle: { fontFamily: FONT, color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  createBlurb: {
    fontFamily: FONT,
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
  createBtnText: { fontFamily: FONT, fontSize: 14, fontWeight: '800' },
  trendRail: { gap: 12, paddingRight: 4 },
  trendCard: {
    width: 148,
    padding: 14,
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
  },
  trendTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  trendRank: { fontFamily: FONT, fontSize: 15, fontWeight: '900' },
  trendName: { fontFamily: FONT, fontSize: 14, fontWeight: '800', marginTop: 2 },
  trendMeta: { fontFamily: FONT, fontSize: 12, fontWeight: '600' },
  chipRail: { gap: 8, paddingRight: 4 },
  chip: {
    paddingHorizontal: 15,
    height: 36,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  chipText: { fontFamily: FONT, fontSize: 13, fontWeight: '700' },
  emptyWrap: { alignItems: 'center', gap: 10, paddingVertical: 34 },
  emptyText: { fontFamily: FONT, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  footerLoader: { paddingVertical: 20 },
});
