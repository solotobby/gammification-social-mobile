import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { toCommunityMember, type MemberAction } from '../../../src/api/communities';
import { CommunityMemberRow } from '../../../src/components/community/CommunityMemberRow';
import { BackButton } from '../../../src/components/ui/BackButton';
import { ScreenBackground } from '../../../src/components/ui/ScreenBackground';
import {
  useBannedMembers,
  useCommunity,
  useModerateMember,
} from '../../../src/hooks/useCommunities';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { FONT } from '../../../src/theme/fonts';

/**
 * Banned members — `GET /communities/{id}/members/banned`, owner/admin only.
 *
 * Its own screen rather than a tab: a healthy community's ban list is empty and
 * rarely looked at, so it doesn't earn a permanent slot next to Feed and
 * Members. Rows carry the same moderation menu, which for a banned member
 * offers only Unban.
 */
export default function BannedMembersScreen() {
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: community } = useCommunity(id);
  const isAdmin = community?.membership === 'owner' || community?.membership === 'admin';
  const query = useBannedMembers(id, !!isAdmin);
  const moderate = useModerateMember(id);

  const rows = useMemo(
    () => query.data?.pages.flatMap((page) => page.data.map(toCommunityMember)) ?? [],
    [query.data],
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScreenBackground />
      <FlatList
        data={rows}
        keyExtractor={(row) => row.id}
        showsVerticalScrollIndicator={false}
        onEndReachedThreshold={0.6}
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage();
        }}
        contentContainerStyle={{
          paddingTop: insets.top + spacing.lg,
          paddingBottom: insets.bottom + spacing.xl,
          paddingHorizontal: spacing.xl,
          gap: spacing.md,
        }}
        ListHeaderComponent={
          <View style={[styles.headerRow, { paddingBottom: spacing.xs }]}>
            <BackButton onPress={() => router.back()} />
            <Text style={[styles.headerTitle, { color: colors.text }]}>Banned members</Text>
            <View style={{ width: 44 }} />
          </View>
        }
        renderItem={({ item }) => (
          <CommunityMemberRow
            row={item}
            canModerate={!!isAdmin}
            viewerIsOwner={community?.membership === 'owner'}
            pending={moderate.isPending}
            onAction={(action: MemberAction | 'remove') =>
              moderate.mutate({ userId: item.id, action })
            }
          />
        )}
        ListEmptyComponent={
          query.isLoading ? (
            <View style={styles.stateWrap}>
              <ActivityIndicator color={colors.brand} />
            </View>
          ) : (
            <View style={styles.stateWrap}>
              <Ionicons name="shield-checkmark-outline" size={30} color={colors.textMuted} />
              <Text style={[styles.stateText, { color: colors.textMuted }]}>
                Nobody is banned from this community.
              </Text>
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontFamily: FONT, fontSize: 18, fontWeight: '800' },
  stateWrap: { alignItems: 'center', gap: 14, paddingVertical: 44, paddingHorizontal: 24 },
  stateText: {
    fontFamily: FONT,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
  },
});
