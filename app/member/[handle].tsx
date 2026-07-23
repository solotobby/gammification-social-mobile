import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { toPost } from "../../src/api/timeline";
import { toMemberFromProfile } from "../../src/api/user";
import { PostCard } from "../../src/components/feed/PostCard";
import { InviteCard } from "../../src/components/referral/InviteCard";
import { Avatar } from "../../src/components/ui/Avatar";
import { BackButton } from "../../src/components/ui/BackButton";
import { GhostButton } from "../../src/components/ui/GhostButton";
import { ScreenBackground } from "../../src/components/ui/ScreenBackground";
import { type Post } from "../../src/data/community";
import { sampleImage } from "../../src/data/media";
import { useProfile, useToggleFollow } from "../../src/hooks/useUser";
import { useAuthStore } from "../../src/stores/authStore";
import { useFeedbackStore } from "../../src/stores/feedbackStore";
import { useTheme } from "../../src/theme/ThemeProvider";

/**
 * Member profile — GET /user/profile/{username}: cover, identity + stats, then
 * that member's posts (infinite). One screen serves both the logged-in user
 * (Edit Profile + referral link) and everyone else (Follow/Following). The
 * "me" handle resolves to the signed-in user's username.
 */
export default function MemberProfileScreen() {
  const { colors, radius, spacing } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { handle } = useLocalSearchParams<{ handle: string }>();

  const authUser = useAuthStore((s) => s.user);
  const showToast = useFeedbackStore((s) => s.showToast);

  // "me" (and the signed-in user's own handle) resolve to their username.
  const username = handle === "me" ? authUser?.username : handle;

  const profileQuery = useProfile(username);
  const firstPage = profileQuery.data?.pages[0];
  const profile = firstPage?.profile;

  const isMe =
    handle === "me" ||
    (!!authUser && (handle === authUser.username || profile?.id === authUser.id));

  const member = useMemo(
    () => (profile ? toMemberFromProfile(profile) : undefined),
    [profile],
  );

  const posts = useMemo(
    () => profileQuery.data?.pages.flatMap((page) => page.data.data.map(toPost)) ?? [],
    [profileQuery.data],
  );
  const postCount = firstPage?.data.total ?? posts.length;

  const toggleFollow = useToggleFollow();
  const [followOverride, setFollowOverride] = useState<boolean | null>(null);
  const following = followOverride ?? profile?.is_following ?? false;

  const onFollow = () => {
    if (!member || toggleFollow.isPending) return;
    const next = !following;
    setFollowOverride(next);
    toggleFollow.mutate(member.id, {
      onSuccess: (data) => setFollowOverride(data.following),
      onError: () => {
        setFollowOverride(!next);
        showToast("Couldn't update follow — please try again.", "error");
      },
    });
  };

  const loadMore = useCallback(() => {
    if (profileQuery.hasNextPage && !profileQuery.isFetchingNextPage) {
      void profileQuery.fetchNextPage();
    }
  }, [profileQuery]);

  // First load (no header yet) or an unknown member: dedicated states.
  if (profileQuery.isLoading) {
    return (
      <View style={[styles.root, styles.center, { backgroundColor: colors.background }]}>
        <ScreenBackground />
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  if (!username || profileQuery.isError || !member) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <ScreenBackground />
        <View style={[styles.missing, { paddingTop: insets.top + spacing.xl }]}>
          <BackButton onPress={() => router.back()} />
          <Text style={[styles.missingText, { color: colors.textMuted }]}>
            {profileQuery.isError
              ? "We couldn't load this profile."
              : "This member doesn't exist."}
          </Text>
          {profileQuery.isError ? (
            <GhostButton label="Retry" onPress={() => void profileQuery.refetch()} />
          ) : null}
        </View>
      </View>
    );
  }

  const header = (
    <View style={{ gap: spacing.xl }}>
      <View style={styles.headerRow}>
        <BackButton onPress={() => router.back()} />
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {isMe ? "My profile" : "Profile"}
        </Text>
        <View style={{ width: 44 }} />
      </View>

      {/* Identity card: cover, avatar, stats, primary action */}
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderRadius: radius.lg,
          },
        ]}
      >
        <Image
          source={{ uri: sampleImage(`cover-${member.handle}`, 900, 300) }}
          style={styles.cover}
          contentFit="cover"
          transition={150}
        />
        <View style={styles.cardBody}>
          <View style={styles.avatarRow}>
            <View style={[styles.avatarRing, { borderColor: colors.surface }]}>
              <Avatar name={member.name} tint={member.tint} size={76} />
            </View>
            {isMe ? (
              <Pressable
                onPress={() => router.push("/settings")}
                accessibilityRole="button"
                accessibilityLabel="Edit profile"
                style={[
                  styles.actionBtn,
                  { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
                ]}
              >
                <Ionicons name="pencil-outline" size={15} color={colors.text} />
                <Text style={[styles.actionText, { color: colors.text }]}>Edit Profile</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={onFollow}
                accessibilityRole="button"
                accessibilityLabel={
                  following ? `Unfollow ${member.name}` : `Follow ${member.name}`
                }
                style={[
                  styles.actionBtn,
                  following
                    ? { backgroundColor: colors.surfaceAlt, borderColor: colors.border }
                    : { backgroundColor: colors.brand, borderColor: colors.brand },
                ]}
              >
                <Ionicons
                  name={following ? "checkmark" : "person-add-outline"}
                  size={15}
                  color={following ? colors.textSecondary : colors.onBrand}
                />
                <Text
                  style={[
                    styles.actionText,
                    { color: following ? colors.textSecondary : colors.onBrand },
                  ]}
                >
                  {following ? "Following" : "Follow"}
                </Text>
              </Pressable>
            )}
          </View>

          <Text style={[styles.name, { color: colors.text }]}>{member.name}</Text>
          <Text style={[styles.handle, { color: colors.textMuted }]}>@{member.handle}</Text>
          {profile?.profile ? (
            <Text style={[styles.bio, { color: colors.textSecondary }]}>{profile.profile}</Text>
          ) : null}
          <Text style={[styles.stats, { color: colors.textSecondary }]}>
            <Text style={styles.statValue}>{member.followers}</Text> Followers ·{" "}
            <Text style={styles.statValue}>{member.following}</Text> Following ·{" "}
            <Text style={styles.statValue}>{postCount}</Text>{" "}
            {postCount === 1 ? "Post" : "Posts"}
          </Text>
        </View>
      </View>

      {isMe && <InviteCard />}

      <Text style={[styles.feedTitle, { color: colors.text }]}>
        {isMe ? "Your posts" : "Posts"} ({postCount})
      </Text>
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScreenBackground />
      <FlatList
        data={posts}
        keyExtractor={(post) => post.id}
        renderItem={({ item }) => (
          <PostCard post={item} onOpen={(post) => router.push(`/post/${post.id}`)} />
        )}
        ListHeaderComponent={header}
        onEndReached={loadMore}
        onEndReachedThreshold={0.6}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons name="leaf-outline" size={26} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {isMe ? "Your feed is waiting" : "No posts yet"}
            </Text>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              {isMe
                ? "Share your first post — it can start earning the moment people engage."
                : `${member.name.split(" ")[0]} hasn't posted anything yet.`}
            </Text>
          </View>
        }
        ListFooterComponent={
          profileQuery.isFetchingNextPage ? (
            <ActivityIndicator color={colors.brand} style={{ paddingVertical: 16 }} />
          ) : null
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + spacing.lg,
          paddingBottom: insets.bottom + spacing.xl,
          paddingHorizontal: spacing.xl,
          gap: spacing.lg,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center" },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: { fontSize: 18, fontWeight: "800" },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  cover: { height: 120 },
  cardBody: {
    paddingHorizontal: 18,
    paddingBottom: 18,
    gap: 2,
  },
  avatarRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginTop: -38,
    marginBottom: 8,
  },
  avatarRing: {
    borderWidth: 4,
    borderRadius: 42,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 38,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
  },
  actionText: { fontSize: 13, fontWeight: "800" },
  name: { fontSize: 21, fontWeight: "800" },
  handle: { fontSize: 13, fontWeight: "600" },
  bio: { fontSize: 14, fontWeight: "500", marginTop: 8, lineHeight: 20 },
  stats: { fontSize: 13, fontWeight: "500", marginTop: 8 },
  statValue: { fontWeight: "900" },
  feedTitle: { fontSize: 17, fontWeight: "800" },
  emptyWrap: {
    alignItems: "center",
    gap: 6,
    paddingVertical: 30,
    paddingHorizontal: 24,
  },
  emptyTitle: { fontSize: 15, fontWeight: "800" },
  emptyText: {
    fontSize: 13,
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 19,
  },
  missing: { paddingHorizontal: 24, gap: 24 },
  missingText: { fontSize: 15, fontWeight: "600" },
});
