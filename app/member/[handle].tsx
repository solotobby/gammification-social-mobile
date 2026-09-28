import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import { FEED_GUTTER, PostCard } from "../../src/components/feed/PostCard";
import { ProfileCover } from "../../src/components/profile/ProfileCover";
import { InviteCard } from "../../src/components/referral/InviteCard";
import { Avatar } from "../../src/components/ui/Avatar";
import { LevelBadge } from "../../src/components/ui/LevelBadge";
import { BackButton } from "../../src/components/ui/BackButton";
import { GhostButton } from "../../src/components/ui/GhostButton";
import { ScreenBackground } from "../../src/components/ui/ScreenBackground";
import { type Post } from "../../src/data/community";
import { useBoostRate } from "../../src/hooks/useBoost";
import { useOpenConversation, useUnblockMessaging } from "../../src/hooks/useMessages";
import { useKeyboardFocusScroll } from "../../src/hooks/useKeyboard";
import { useProfile, useToggleFollow } from "../../src/hooks/useUser";
import { useAuthStore } from "../../src/stores/authStore";
import { useBlockedStore } from "../../src/stores/blockedStore";
import { useFeedbackStore } from "../../src/stores/feedbackStore";
import { useFollowStore } from "../../src/stores/followStore";
import { useTheme } from "../../src/theme/ThemeProvider";
import { FONT } from '../../src/theme/fonts';

/**
 * Member profile — GET /user/profile/{username}: cover, identity + stats, then
 * that member's posts (infinite). One screen serves both the logged-in user
 * (Edit Profile + referral link) and everyone else (Message + Follow). The
 * "me" handle resolves to the signed-in user's username.
 *
 * **Message** is the main way into a conversation: it opens the existing
 * thread straight from cache (offline too), or opens-or-creates one with
 * `POST /conversations/direct`. Someone you've blocked from this device shows
 * **Unblock** in its place — the API can't list blocks, so that's the only way
 * back to them (see `blockedStore`).
 */
export default function MemberProfileScreen() {
  const { colors, radius, spacing } = useTheme();
  // Android-only: see useKeyboardFocusScroll.
  const listRef = useKeyboardFocusScroll<FlatList>();
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

  // The per-click rate shown in each own-post boost strip. Read once from the
  // first post — it's an account-level figure, not a per-post one — and only on
  // your own profile, where the strip is rendered at all.
  const boostRate = useBoostRate(posts[0]?.id, isMe && posts.length > 0);

  const { open: openConversation, openingFor } = useOpenConversation();
  const unblock = useUnblockMessaging();
  const blocked = useBlockedStore((s) => (member ? !!s.blocked[member.id] : false));

  const toggleFollow = useToggleFollow();
  const [followOverride, setFollowOverride] = useState<boolean | null>(null);
  const storedFollowing = useFollowStore((s) => (member ? !!s.following[member.id] : false));
  const setStoredFollowing = useFollowStore((s) => s.setFollowing);
  const following = followOverride ?? profile?.is_following ?? storedFollowing;

  // This screen is the only place the API reports follow state on read, so its
  // answer seeds the device's follow set — that's how a follow made on the web
  // reaches Home's Following tab.
  useEffect(() => {
    if (member && profile?.is_following != null) {
      setStoredFollowing(member.id, profile.is_following);
    }
  }, [member, profile?.is_following, setStoredFollowing]);

  const onFollow = () => {
    if (!member || toggleFollow.isPending) return;
    const next = !following;
    setFollowOverride(next);
    setStoredFollowing(member.id, next);
    toggleFollow.mutate(member.id, {
      onSuccess: (data) => {
        setFollowOverride(data.following);
        setStoredFollowing(member.id, data.following);
      },
      onError: () => {
        setFollowOverride(!next);
        setStoredFollowing(member.id, !next);
        showToast("Couldn't update follow — please try again.", "error");
      },
    });
  };

  // `/user/profile/{username}` can take close to a minute on the backend (see
  // SLOW_READ_TIMEOUT). A bare spinner for that long reads as broken, so say so
  // once the wait is clearly not a normal one.
  const [slowLoad, setSlowLoad] = useState(false);
  const firstLoad = profileQuery.isLoading;
  useEffect(() => {
    if (!firstLoad) {
      setSlowLoad(false);
      return;
    }
    const timer = setTimeout(() => setSlowLoad(true), 6_000);
    return () => clearTimeout(timer);
  }, [firstLoad]);

  const loadMore = useCallback(() => {
    if (profileQuery.hasNextPage && !profileQuery.isFetchingNextPage) {
      void profileQuery.fetchNextPage();
    }
  }, [profileQuery]);

  // First load (no header yet) or an unknown member: dedicated states.
  if (profileQuery.isLoading) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <ScreenBackground />
        <View style={[styles.missing, { paddingTop: insets.top + spacing.xl }]}>
          <BackButton onPress={() => router.back()} />
        </View>
        <View style={[styles.center, styles.loadingBody]}>
          <ActivityIndicator color={colors.brand} />
          {slowLoad ? (
            <Text style={[styles.slowText, { color: colors.textMuted }]}>
              Profiles are slow to load right now. Hang on — this can take up to a
              minute.
            </Text>
          ) : null}
        </View>
      </View>
    );
  }

  // A failed *background* refetch keeps the profile already on screen — the
  // endpoint is slow enough to time out now and then, and swapping a loaded
  // profile for an error would take its Message and Follow buttons with it.
  if (!username || !member) {
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
    // Posts below run full-bleed, so the list drops its horizontal padding and
    // the whole header re-applies the gutter.
    <View style={[styles.gutter, { gap: spacing.xl, paddingBottom: spacing.lg }]}>
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
        {/* Shared default banner, fading into the card body below it. */}
        {/* The member's uploaded banner when they have one, else the shared
            default — `banner` rides along on the profile response. */}
        <ProfileCover uri={profile?.banner ?? undefined} fadeTo={colors.surface} />
        <View style={styles.cardBody}>
          <View style={styles.avatarRow}>
            <View style={[styles.avatarRing, { borderColor: colors.surface }]}>
              <Avatar userId={member.id} level={member.level} name={member.name} tint={member.tint} uri={member.avatar} size={76} />
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
              <View style={styles.actions}>
                {blocked ? (
                  <Pressable
                    onPress={() =>
                      unblock.mutate(member, {
                        onSuccess: () =>
                          showToast(`Unblocked ${member.name} — you can message them again.`, "success"),
                        onError: () =>
                          showToast("Couldn't unblock — check your connection and try again.", "error"),
                      })
                    }
                    disabled={unblock.isPending}
                    accessibilityRole="button"
                    accessibilityLabel={`Unblock ${member.name}`}
                    style={[
                      styles.actionBtn,
                      { backgroundColor: colors.surfaceAlt, borderColor: colors.danger },
                    ]}
                  >
                    {unblock.isPending ? (
                      <ActivityIndicator size="small" color={colors.danger} />
                    ) : (
                      <Ionicons name="ban-outline" size={15} color={colors.danger} />
                    )}
                    <Text style={[styles.actionText, { color: colors.danger }]}>Unblock</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={() => void openConversation(member)}
                    disabled={!!openingFor}
                    accessibilityRole="button"
                    accessibilityLabel={`Message ${member.name}`}
                    style={[
                      styles.actionBtn,
                      { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
                    ]}
                  >
                    {openingFor === member.id ? (
                      <ActivityIndicator size="small" color={colors.text} />
                    ) : (
                      <Ionicons name="chatbubble-ellipses-outline" size={15} color={colors.text} />
                    )}
                    <Text style={[styles.actionText, { color: colors.text }]}>Message</Text>
                  </Pressable>
                )}
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
              </View>
            )}
          </View>

          <Text style={[styles.name, { color: colors.text }]}>{member.name}{' '}<LevelBadge userId={member.id} level={member.level} size={20} /></Text>
          <Text style={[styles.handle, { color: colors.textMuted }]}>@{member.handle}</Text>
          {/* `profile.profile` used to BE the bio string; it is now the nested
              profile record, so the blurb reads from its `about` field. */}
          {profile?.profile?.about ? (
            <Text style={[styles.bio, { color: colors.textSecondary }]}>
              {profile.profile.about}
            </Text>
          ) : null}
          {profile?.profile?.location ? (
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={13} color={colors.textMuted} />
              <Text style={[styles.location, { color: colors.textMuted }]}>
                {profile.profile.location}
              </Text>
            </View>
          ) : null}
          {/* Followers / Following open the real lists (they have endpoints
              now). Plain <Text onPress> rather than nested Pressables — this
              sits inside the profile card, and nesting accessibilityRole
              ="button" is invalid markup on web. */}
          <Text style={[styles.stats, { color: colors.textSecondary }]}>
            <Text
              style={styles.statLink}
              onPress={() =>
                router.push(`/member/${member.handle}/connections?tab=followers`)
              }
            >
              <Text style={styles.statValue}>{member.followers}</Text> Followers
            </Text>
            {" · "}
            <Text
              style={styles.statLink}
              onPress={() =>
                router.push(`/member/${member.handle}/connections?tab=following`)
              }
            >
              <Text style={styles.statValue}>{member.following}</Text> Following
            </Text>
            {" · "}
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
          <PostCard
            post={item}
            onOpen={(post) => router.push(`/post/${post.id}`)}
            // Your own profile is where the web surfaces the boost strip, and
            // it's the natural place: it's the one screen that lists only your
            // posts, so a promote action per row is a tool rather than clutter.
            showBoostStrip={isMe}
            boostRatePerClick={boostRate}
          />
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
        keyboardShouldPersistTaps="handled"
        // iOS: scroll a focused input clear of the keyboard — the posts here
        // carry the same inline comment composer the feed does.
        // Android: RN insets the list but never scrolls the focused input
        // clear of the keyboard, so the composer you tapped stays under it.
        ref={listRef}
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{
          paddingTop: insets.top + spacing.lg,
          paddingBottom: insets.bottom + spacing.xl,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  loadingBody: { flex: 1, paddingHorizontal: 32, paddingBottom: 80 },
  slowText: {
    fontFamily: FONT,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "500",
    textAlign: "center",
    maxWidth: 260,
    marginTop: 14,
  },
  root: { flex: 1 },
  gutter: { paddingHorizontal: FEED_GUTTER },
  center: { alignItems: "center", justifyContent: "center" },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: { fontFamily: FONT, fontSize: 18, fontWeight: "800" },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
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
  actions: { flexDirection: "row", alignItems: "center", gap: 8 },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 38,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
  },
  actionText: { fontFamily: FONT, fontSize: 13, fontWeight: "800" },
  name: { fontFamily: FONT, fontSize: 21, fontWeight: "800" },
  handle: { fontFamily: FONT, fontSize: 13, fontWeight: "600" },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  location: { fontFamily: FONT, fontSize: 13, fontWeight: "600" },
  bio: { fontFamily: FONT, fontSize: 14, fontWeight: "500", marginTop: 8, lineHeight: 20 },
  stats: { fontFamily: FONT, fontSize: 13, fontWeight: "500", marginTop: 8 },
  statValue: { fontFamily: FONT, fontWeight: "900" },
  statLink: { fontFamily: FONT, textDecorationLine: "underline" },
  feedTitle: { fontFamily: FONT, fontSize: 17, fontWeight: "800" },
  emptyWrap: {
    alignItems: "center",
    gap: 6,
    paddingVertical: 30,
    paddingHorizontal: 24,
  },
  emptyTitle: { fontFamily: FONT, fontSize: 15, fontWeight: "800" },
  emptyText: {
    fontFamily: FONT,
    fontSize: 13,
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 19,
  },
  missing: { paddingHorizontal: 24, gap: 24 },
  missingText: { fontFamily: FONT, fontSize: 15, fontWeight: "600" },
});
