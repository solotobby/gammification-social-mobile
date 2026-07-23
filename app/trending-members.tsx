import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { toTrendingMember } from '../src/api/explore';
import { Avatar } from '../src/components/ui/Avatar';
import { BackButton } from '../src/components/ui/BackButton';
import { GhostButton } from '../src/components/ui/GhostButton';
import { ScreenBackground } from '../src/components/ui/ScreenBackground';
import { type Member } from '../src/data/community';
import { useTrendingMembers } from '../src/hooks/useExplore';
import { useToggleFollow } from '../src/hooks/useUser';
import { useFeedbackStore } from '../src/stores/feedbackStore';
import { useTheme } from '../src/theme/ThemeProvider';

const MEDALS = ['trophy', 'medal', 'medal-outline'] as const;
const MEDAL_TINTS = ['gold', 'pink', 'mint'] as const;

function TrendingRow({ member, index }: { member: Member; index: number }) {
  const { colors, radius } = useTheme();
  const router = useRouter();
  const toggleFollow = useToggleFollow();
  const showToast = useFeedbackStore((s) => s.showToast);
  const [following, setFollowing] = useState(false);
  const medal = index < 3;

  const onFollow = () => {
    if (toggleFollow.isPending) return;
    const next = !following;
    setFollowing(next);
    toggleFollow.mutate(member.id, {
      onSuccess: (data) => setFollowing(data.following),
      onError: () => {
        setFollowing(!next);
        showToast("Couldn't update follow — please try again.", 'error');
      },
    });
  };

  return (
    <View
      style={[
        styles.row,
        { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md },
      ]}
    >
      <View style={styles.rankSlot}>
        {medal ? (
          <Ionicons name={MEDALS[index]} size={20} color={colors[MEDAL_TINTS[index]]} />
        ) : (
          <Text style={[styles.rank, { color: colors.textMuted }]}>{index + 1}</Text>
        )}
      </View>
      <Pressable
        onPress={() => router.push(`/member/${member.handle}`)}
        accessibilityRole="button"
        accessibilityLabel={`View ${member.name}'s profile`}
        style={styles.memberTap}
      >
        <Avatar name={member.name} tint={member.tint} size={44} />
        <View style={styles.rowText}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {member.name}
          </Text>
          <View style={styles.metaRow}>
            <Ionicons name="pulse" size={13} color={colors.mint} />
            <Text style={[styles.meta, { color: colors.textMuted }]}>
              {member.engagements} engagements
            </Text>
          </View>
        </View>
      </Pressable>
      <Pressable
        onPress={onFollow}
        accessibilityRole="button"
        accessibilityLabel={following ? `Unfollow ${member.name}` : `Follow ${member.name}`}
        style={[
          styles.followBtn,
          following
            ? { backgroundColor: colors.surfaceAlt, borderColor: colors.border }
            : { backgroundColor: colors.brand, borderColor: colors.brand },
        ]}
      >
        <Ionicons
          name={following ? 'checkmark' : 'person-add-outline'}
          size={17}
          color={following ? colors.textSecondary : colors.onBrand}
        />
      </Pressable>
    </View>
  );
}

/** Full list behind the dashboard's "Trending Members" card. */
export default function TrendingMembersScreen() {
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const query = useTrendingMembers();
  const members = useMemo(
    () => query.data?.pages.flatMap((page) => page.data.map(toTrendingMember)) ?? [],
    [query.data],
  );

  const loadMore = useCallback(() => {
    if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
  }, [query]);

  const header = (
    <View style={styles.headerRow}>
      <BackButton onPress={() => router.back()} />
      <View style={styles.headerCenter}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Trending members</Text>
        <Text style={[styles.headerSub, { color: colors.textMuted }]}>By engagement</Text>
      </View>
      <View style={{ width: 44 }} />
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScreenBackground />
      <FlatList
        data={members}
        keyExtractor={(member) => member.id}
        ListHeaderComponent={header}
        renderItem={({ item, index }) => <TrendingRow member={item} index={index} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.6}
        ListEmptyComponent={
          query.isLoading ? (
            <View style={styles.stateWrap}>
              <ActivityIndicator color={colors.brand} />
            </View>
          ) : query.isError ? (
            <View style={styles.stateWrap}>
              <Text style={[styles.stateText, { color: colors.textMuted }]}>
                Couldn't load trending members.
              </Text>
              <GhostButton label="Retry" onPress={() => void query.refetch()} />
            </View>
          ) : (
            <View style={styles.stateWrap}>
              <Text style={[styles.stateText, { color: colors.textMuted }]}>
                No trending members yet.
              </Text>
            </View>
          )
        }
        ListFooterComponent={
          query.isFetchingNextPage ? (
            <ActivityIndicator color={colors.brand} style={{ paddingVertical: 16 }} />
          ) : null
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + spacing.lg,
          paddingBottom: insets.bottom + spacing.xl,
          paddingHorizontal: spacing.xl,
          gap: spacing.md,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerCenter: { alignItems: 'center', gap: 1 },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  headerSub: { fontSize: 12, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rankSlot: { width: 26, alignItems: 'center' },
  rank: { fontSize: 15, fontWeight: '900' },
  memberTap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowText: { flex: 1, gap: 2 },
  name: { fontSize: 15, fontWeight: '800' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  meta: { fontSize: 12, fontWeight: '600' },
  followBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  stateWrap: { alignItems: 'center', gap: 14, paddingVertical: 34, paddingHorizontal: 24 },
  stateText: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
});
