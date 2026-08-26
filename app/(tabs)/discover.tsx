import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { toTopic, toTrendingMember } from '../../src/api/explore';
import { toMemberFromSearch } from '../../src/api/user';
import { CommunityBadge } from '../../src/components/community/CommunityBadge';
import { MemberRow } from '../../src/components/members/MemberRow';
import { Avatar } from '../../src/components/ui/Avatar';
import { TAB_BAR_CLEARANCE } from '../../src/components/navigation/TabBar';
import { GhostButton } from '../../src/components/ui/GhostButton';
import { ScreenBackground } from '../../src/components/ui/ScreenBackground';
import { SectionHeader } from '../../src/components/ui/SectionHeader';
import { TextField } from '../../src/components/ui/TextField';
import { trendingCommunities } from '../../src/data/communities';
import { toTopRoll } from '../../src/api/rolls';
import { useDebouncedValue } from '../../src/hooks/useDebouncedValue';
import { useTrending } from '../../src/hooks/useExplore';
import { useTopRolls } from '../../src/hooks/useRolls';
import { useSearchUsers } from '../../src/hooks/useUser';
import { useTheme } from '../../src/theme/ThemeProvider';
import { FONT } from '../../src/theme/fonts';

/** Ways to earn / learn that already have a screen — no dead ends on this page. */
const OPPORTUNITIES: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  sub: string;
  route: string;
}[] = [
  { icon: 'arrow-up-circle-outline', title: 'Upgrade level', sub: 'Creator & Influencer', route: '/upgrade' },
  { icon: 'gift-outline', title: 'Invite & earn', sub: 'Referral rewards', route: '/referrals' },
  { icon: 'trophy-outline', title: 'Top earners', sub: 'This month’s leaders', route: '/top-earners' },
  { icon: 'school-outline', title: 'Creator Academy', sub: 'How earning works', route: '/how-it-works' },
];

/** The Rolls rail shows a handful — the tab itself has the rest. */
const POPULAR_ROLLS_SHOWN = 6;

/**
 * Discover tab — people search (/user/search) plus the reasons to open this
 * screen daily: what's trending, popular Rolls, creators worth following, and
 * the creator opportunities that pay. Communities land here in a later phase.
 */
export default function DiscoverScreen() {
  const { colors, radius, spacing } = useTheme();
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

  // GET /rolls/top — a genuinely ranked list, unlike the randomised pager this
  // rail used to slice its first page from. Tapping a card still opens the
  // pager at that video and keeps paging from there.
  const rollsFeed = useTopRolls();
  const popularRolls = useMemo(
    () => (rollsFeed.data ?? []).map(toTopRoll).slice(0, POPULAR_ROLLS_SHOWN),
    [rollsFeed.data],
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
        <Text style={[styles.title, { color: colors.text }]}>Discover</Text>

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
            {/* Trending now */}
            <View style={{ gap: spacing.md }}>
              <SectionHeader
                title="Trending now"
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
                      <Text style={styles.topicFlame}>🔥</Text>
                      <Text style={[styles.topicTag, { color: colors.brand }]}>#{topic.tag}</Text>
                      <Text style={[styles.topicCount, { color: colors.textMuted }]}>
                        {topic.posts}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            {/* Popular Rolls */}
            <View style={{ gap: spacing.md }}>
              <SectionHeader
                title="Popular Rolls"
                icon="film"
                onSeeAll={() => router.push('/rolls')}
              />
              {rollsFeed.isLoading ? (
                <ActivityIndicator color={colors.brand} />
              ) : popularRolls.length === 0 ? (
                <Text style={[styles.emptyRail, { color: colors.textMuted }]}>
                  No rolls yet.
                </Text>
              ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.rollRail}
              >
                {popularRolls.map((roll) => (
                  <Pressable
                    key={roll.id}
                    onPress={() => router.push(`/rolls?start=${roll.id}`)}
                    accessibilityRole="button"
                    accessibilityLabel={`Watch ${roll.author.name}'s roll`}
                    style={({ pressed }) => [
                      styles.rollCard,
                      {
                        backgroundColor: colors.surfaceAlt,
                        borderRadius: radius.md,
                        opacity: pressed ? 0.9 : 1,
                      },
                    ]}
                  >
                    {roll.poster ? (
                      <Image
                        source={{ uri: roll.poster }}
                        style={StyleSheet.absoluteFill}
                        contentFit="cover"
                        transition={200}
                      />
                    ) : null}
                    <LinearGradient
                      colors={['transparent', 'rgba(10,7,26,0.85)']}
                      style={StyleSheet.absoluteFill}
                    />
                    {/* /rolls/top sends no counts, so the badge is the play
                        affordance alone rather than an invented number. */}
                    <View style={styles.rollPlay}>
                      <Ionicons name="play" size={13} color="#FFFFFF" />
                    </View>
                    <Text style={styles.rollHandle} numberOfLines={1}>
                      @{roll.author.handle}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
              )}
            </View>

            {/* Popular communities */}
            <View style={{ gap: spacing.md }}>
              <SectionHeader
                title="Popular communities"
                icon="people-circle"
                onSeeAll={() => router.push('/communities')}
              />
              {trendingCommunities.map((community) => (
                <Pressable
                  key={community.id}
                  onPress={() => router.push(`/community/${community.slug}`)}
                  accessibilityRole="button"
                  accessibilityLabel={community.name}
                  style={({ pressed }) => [
                    styles.communityRow,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      borderRadius: radius.md,
                      opacity: pressed ? 0.9 : 1,
                    },
                  ]}
                >
                  <Avatar name={community.name} tint={community.tint} size={42} />
                  <View style={styles.communityText}>
                    <Text style={[styles.communityName, { color: colors.text }]} numberOfLines={1}>
                      {community.name}
                    </Text>
                    <Text
                      style={[styles.communityMeta, { color: colors.textMuted }]}
                      numberOfLines={1}
                    >
                      {community.category} · {community.people.length} members
                    </Text>
                  </View>
                  <CommunityBadge status={community.status} />
                </Pressable>
              ))}
            </View>

            {/* Growing creators */}
            <View style={{ gap: spacing.md }}>
              <SectionHeader
                title="Growing creators"
                icon="trending-up"
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

            {/* Creator opportunities */}
            <View style={{ gap: spacing.md }}>
              <SectionHeader title="Creator opportunities" icon="sparkles" />
              <View style={styles.oppGrid}>
                {OPPORTUNITIES.map((item) => (
                  <Pressable
                    key={item.title}
                    onPress={() => router.push(item.route as never)}
                    accessibilityRole="button"
                    accessibilityLabel={item.title}
                    style={({ pressed }) => [
                      styles.oppCard,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                        borderRadius: radius.md,
                        opacity: pressed ? 0.9 : 1,
                      },
                    ]}
                  >
                    <View style={[styles.oppIcon, { backgroundColor: colors.surfaceAlt }]}>
                      <Ionicons name={item.icon} size={19} color={colors.brand} />
                    </View>
                    <Text style={[styles.oppTitle, { color: colors.text }]}>{item.title}</Text>
                    <Text style={[styles.oppSub, { color: colors.textMuted }]} numberOfLines={1}>
                      {item.sub}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  title: { fontFamily: FONT, fontSize: 26, fontWeight: '800' },
  topicWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  topicChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  topicFlame: { fontFamily: FONT, fontSize: 12 },
  topicTag: { fontFamily: FONT, fontSize: 14, fontWeight: '800' },
  topicCount: { fontFamily: FONT, fontSize: 12, fontWeight: '700' },
  rollRail: { gap: 12, paddingRight: 4 },
  rollCard: {
    width: 124,
    height: 176,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    padding: 10,
  },
  rollPlay: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(10,7,26,0.55)',
  },
  rollHandle: { fontFamily: FONT, color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  emptyRail: { fontFamily: FONT, fontSize: 13, fontWeight: '600', paddingVertical: 12 },
  communityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  communityText: { flex: 1, gap: 2 },
  communityName: { fontFamily: FONT, fontSize: 15, fontWeight: '800' },
  communityMeta: { fontFamily: FONT, fontSize: 12, fontWeight: '600' },
  oppGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  oppCard: {
    flexBasis: '47%',
    flexGrow: 1,
    padding: 14,
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
  },
  oppIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  oppTitle: { fontFamily: FONT, fontSize: 14, fontWeight: '800' },
  oppSub: { fontFamily: FONT, fontSize: 12, fontWeight: '600' },
  emptyWrap: { alignItems: 'center', gap: 10, paddingVertical: 32 },
  emptyText: { fontFamily: FONT, fontSize: 14, fontWeight: '600' },
});
