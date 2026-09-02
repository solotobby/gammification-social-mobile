import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { toMember, type CommunityPost } from '../../src/api/communities';
import { CommunityBadge } from '../../src/components/community/CommunityBadge';
import { CommunityPostCard } from '../../src/components/community/CommunityPostCard';
import { CommunityCommentsSheet } from '../../src/components/community/CommunityCommentsSheet';
import { joinActionFor } from '../../src/components/community/communityMeta';
import { ShareSheet } from '../../src/components/community/ShareSheet';
import { ProfileCover } from '../../src/components/profile/ProfileCover';
import { Avatar } from '../../src/components/ui/Avatar';
import { BackButton } from '../../src/components/ui/BackButton';
import { CopyField } from '../../src/components/ui/CopyField';
import { ScreenBackground } from '../../src/components/ui/ScreenBackground';
import {
  useCommunity,
  useCommunityInvites,
  useCommunityPosts,
  useCreateCommunityPost,
  useJoinCommunity,
  useJoinRequests,
  useLeaveCommunity,
  useReviewJoinRequest,
} from '../../src/hooks/useCommunities';
import { formatMoney, symbolFor } from '../../src/hooks/useCurrency';
import { useTheme } from '../../src/theme/ThemeProvider';
import { FONT } from '../../src/theme/fonts';

const TABS = ['Feed', 'About'] as const;
type Tab = (typeof TABS)[number];

/**
 * Community detail — `GET /communities/{id}`.
 *
 * Keyed on the **id**, not the slug: `GET /communities/{slug}` 404s, so the slug
 * is share metadata only.
 *
 * The feed is gated by the API's own `access` block rather than by inspecting
 * the type here. `GET /communities/{id}/posts` 422s for a viewer who isn't
 * allowed in, so the query is disabled unless `canViewFeed`, and the backend's
 * `gateMessage` — which is written per type — is shown in the feed's place.
 *
 * There is no members endpoint on this API (`/communities/{id}/members` 404s),
 * so the web's Members tab has no data source and is left out rather than
 * faked. `access.canViewMembers` and the owner row are all the API exposes.
 */
export default function CommunityScreen() {
  const { colors, radius, spacing } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // `invite` arrives on a shared private-community link (…/c/<slug>?invite=<token>)
  // and is the only thing that lets a private community be joined.
  const { id, invite } = useLocalSearchParams<{ id: string; invite?: string }>();

  const { data: community, isLoading, isError } = useCommunity(id);
  const join = useJoinCommunity();
  const leave = useLeaveCommunity();
  const createPost = useCreateCommunityPost(id);

  const [tab, setTab] = useState<Tab>('Feed');
  const [draft, setDraft] = useState('');
  const [shareOpen, setShareOpen] = useState(false);
  const [commentsFor, setCommentsFor] = useState<CommunityPost | null>(null);

  const canViewFeed = community?.access.canViewFeed ?? false;
  const {
    data: postsData,
    isLoading: loadingPosts,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch: refetchPosts,
    isRefetching,
  } = useCommunityPosts(id, canViewFeed);

  const posts = postsData?.posts ?? [];

  // Owner/admin surfaces. Both endpoints 403 for anyone else, so they're gated
  // rather than fetched-and-caught.
  const isAdminOf =
    community?.membership === 'owner' || community?.membership === 'admin';
  const { data: invites } = useCommunityInvites(id, !!isAdminOf && community?.type === 'private');
  const { data: joinRequests } = useJoinRequests(
    id,
    !!isAdminOf && community?.type === 'approval',
  );
  const reviewRequest = useReviewJoinRequest(id);

  if (isLoading) {
    return (
      <View style={[styles.root, styles.center, { backgroundColor: colors.background }]}>
        <ScreenBackground />
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  if (isError || !community) {
    return (
      <View style={[styles.root, styles.center, { backgroundColor: colors.background }]}>
        <ScreenBackground />
        <Text style={[styles.missing, { color: colors.textMuted }]}>
          That community couldn't be loaded.
        </Text>
        <Pressable onPress={() => router.back()} accessibilityRole="button">
          <Text style={[styles.missingLink, { color: colors.brand }]}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const base = joinActionFor(community.type, community.membership);
  // A private community is only "invite only" until you actually hold a token;
  // arriving through an invite link makes the join button live.
  const action =
    community.type === 'private' && invite && community.membership === 'none'
      ? { label: 'Accept invite', blocked: false }
      : base;
  const isMember = community.membership === 'member' || community.membership === 'admin';
  const isOwner = community.membership === 'owner';
  const canPost = isMember || isOwner;
  const busy = join.isPending || leave.isPending;

  // Each community prices in its own currency, never the account default.
  const symbol = symbolFor(community.currency);
  const pricing = community.pricing;

  const onMembershipPress = () => {
    if (busy) return;
    if (isMember) leave.mutate(community.id);
    else if (!action.blocked) join.mutate({ id: community.id, inviteToken: invite });
  };

  const onPost = () => {
    const body = draft.trim();
    if (!body || createPost.isPending) return;
    createPost.mutate(body, { onSuccess: () => setDraft('') });
  };

  const header = (
    <View>
      <View style={styles.coverWrap}>
        <ProfileCover uri={community.banner ?? undefined} fadeTo={colors.background} />
        <View style={[styles.coverNav, { top: insets.top + 8 }]}>
          <BackButton onPress={() => router.back()} />
          <Pressable
            onPress={() => setShareOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Share community"
            style={[styles.iconBtn, { backgroundColor: colors.surface }]}
          >
            <Ionicons name="share-outline" size={18} color={colors.text} />
          </Pressable>
        </View>
      </View>

      <View style={{ paddingHorizontal: spacing.xl, gap: spacing.lg }}>
        <View style={styles.identityRow}>
          <Avatar name={community.name} tint={community.owner.tint} size={64} />
          <View style={styles.identityText}>
            <Text style={[styles.name, { color: colors.text }]}>{community.name}</Text>
            <Text style={[styles.meta, { color: colors.textMuted }]}>
              {community.categoryName ? `${community.categoryName} · ` : ''}
              {community.members} {community.members === 1 ? 'member' : 'members'}
            </Text>
          </View>
          <CommunityBadge status={community.type} />
        </View>

        {community.description ? (
          <Text style={[styles.description, { color: colors.textSecondary }]}>
            {community.description}
          </Text>
        ) : null}

        {/* Pricing — every figure is the backend's, including the label. */}
        {pricing ? (
          <View
            style={[
              styles.pricingCard,
              {
                backgroundColor: colors.surface,
                borderColor: `${colors.brand}33`,
                borderRadius: radius.md,
              },
            ]}
          >
            <View style={styles.pricingHead}>
              <Ionicons name="cash-outline" size={16} color={colors.brand} />
              <Text style={[styles.pricingLabel, { color: colors.brand }]}>
                {pricing.billingLabel}
              </Text>
            </View>
            <View style={styles.pricingRow}>
              <Text style={[styles.pricingKey, { color: colors.textMuted }]}>Members pay</Text>
              <Text style={[styles.pricingValue, { color: colors.text }]}>
                {formatMoney(pricing.memberCharge, symbol)}
              </Text>
            </View>
            {isOwner ? (
              <>
                <View style={styles.pricingRow}>
                  <Text style={[styles.pricingKey, { color: colors.textMuted }]}>
                    Platform fee ({pricing.platformFeePercent}%)
                  </Text>
                  <Text style={[styles.pricingValue, { color: colors.textMuted }]}>
                    −{formatMoney(pricing.platformFee, symbol)}
                  </Text>
                </View>
                <View style={styles.pricingRow}>
                  <Text style={[styles.pricingKey, { color: colors.text }]}>You receive</Text>
                  <Text style={[styles.pricingValue, { color: colors.brand }]}>
                    {formatMoney(pricing.creatorPayout, symbol)}
                  </Text>
                </View>
              </>
            ) : (
              <Text style={[styles.pricingNote, { color: colors.textMuted }]}>
                {pricing.feePayer === 'members'
                  ? `Includes the ${pricing.platformFeePercent}% platform fee.`
                  : `The ${pricing.platformFeePercent}% platform fee is covered by the owner.`}
              </Text>
            )}
          </View>
        ) : null}

        {/* Membership action */}
        <Pressable
          onPress={onMembershipPress}
          disabled={busy || (action.blocked && !isMember)}
          accessibilityRole="button"
          accessibilityLabel={isMember ? 'Leave community' : action.label}
          style={[
            styles.actionBtn,
            {
              borderRadius: radius.pill,
              backgroundColor: isMember || action.blocked ? colors.surface : colors.brand,
              borderColor: isMember || action.blocked ? colors.border : colors.brand,
              opacity: action.blocked && !isMember ? 0.6 : 1,
            },
          ]}
        >
          {busy ? (
            <ActivityIndicator size="small" color={isMember ? colors.text : colors.onBrand} />
          ) : (
            <Text
              style={[
                styles.actionText,
                { color: isMember || action.blocked ? colors.text : colors.onBrand },
              ]}
            >
              {isOwner ? 'You own this community' : isMember ? 'Leave community' : action.label}
            </Text>
          )}
        </Pressable>

        {/* Tabs */}
        <View style={[styles.tabRow, { backgroundColor: colors.surfaceAlt, borderRadius: radius.pill }]}>
          {TABS.map((item) => {
            const active = item === tab;
            return (
              <Pressable
                key={item}
                onPress={() => setTab(item)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[
                  styles.tabBtn,
                  {
                    backgroundColor: active ? colors.surface : 'transparent',
                    borderRadius: radius.pill,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.tabText,
                    { color: active ? colors.text : colors.textMuted },
                  ]}
                >
                  {item}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {tab === 'About' ? (
          <View style={{ gap: spacing.lg, paddingBottom: spacing.xl }}>
            <View style={{ gap: spacing.sm }}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Owner</Text>
              <Pressable
                onPress={() => router.push(`/member/${community.owner.handle}`)}
                accessibilityRole="button"
                style={[
                  styles.ownerRow,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderRadius: radius.md,
                  },
                ]}
              >
                <Avatar name={community.owner.name} tint={community.owner.tint} size={40} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.ownerName, { color: colors.text }]}>
                    {community.owner.name}
                  </Text>
                  <Text style={[styles.ownerHandle, { color: colors.textMuted }]}>
                    @{community.owner.handle}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Pressable>
            </View>

            {/* Private communities can only be joined with an invite token, and
                the backend issues exactly one standing link per community. The
                owner shares this; opening it joins the recipient outright. */}
            {invites?.link_invite ? (
              <View style={{ gap: spacing.sm }}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Invite link</Text>
                <CopyField
                  label="Anyone with this link can join"
                  icon="key-outline"
                  value={`${community.shareUrl}?invite=${invites.link_invite.token}`}
                />
                <Text style={[styles.hint, { color: colors.textMuted }]}>
                  Used {invites.link_invite.uses_count}{' '}
                  {invites.link_invite.uses_count === 1 ? 'time' : 'times'}.
                </Text>
              </View>
            ) : null}

            {/* Pending requests on an approval community. */}
            {community.type === 'approval' && isAdminOf ? (
              <View style={{ gap: spacing.sm }}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  Join requests{joinRequests?.length ? ` (${joinRequests.length})` : ''}
                </Text>
                {joinRequests?.length ? (
                  joinRequests.map((request) => (
                    <View
                      key={request.id}
                      style={[
                        styles.requestRow,
                        {
                          backgroundColor: colors.surface,
                          borderColor: colors.border,
                          borderRadius: radius.md,
                        },
                      ]}
                    >
                      <Avatar
                        name={request.user.name || request.user.username}
                        tint={toMember(request.user).tint}
                        size={38}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.ownerName, { color: colors.text }]} numberOfLines={1}>
                          {request.user.name || request.user.username}
                        </Text>
                        <Text style={[styles.ownerHandle, { color: colors.textMuted }]}>
                          @{request.user.username}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() =>
                          reviewRequest.mutate({ requestId: request.id, approve: false })
                        }
                        disabled={reviewRequest.isPending}
                        accessibilityRole="button"
                        accessibilityLabel={`Deny ${request.user.username}`}
                        style={[
                          styles.reviewBtn,
                          { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
                        ]}
                      >
                        <Text style={[styles.reviewText, { color: colors.textSecondary }]}>
                          Deny
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() =>
                          reviewRequest.mutate({ requestId: request.id, approve: true })
                        }
                        disabled={reviewRequest.isPending}
                        accessibilityRole="button"
                        accessibilityLabel={`Approve ${request.user.username}`}
                        style={[
                          styles.reviewBtn,
                          { backgroundColor: colors.brand, borderColor: colors.brand },
                        ]}
                      >
                        <Text style={[styles.reviewText, { color: colors.onBrand }]}>Approve</Text>
                      </Pressable>
                    </View>
                  ))
                ) : (
                  <Text style={[styles.hint, { color: colors.textMuted }]}>
                    No one is waiting to join right now.
                  </Text>
                )}
              </View>
            ) : null}

            <View style={{ gap: spacing.sm }}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Share this community</Text>
              <CopyField label="Community link" value={community.shareUrl} icon="link-outline" />
            </View>

            <View style={{ gap: spacing.sm }}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Details</Text>
              <View
                style={[
                  styles.detailCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderRadius: radius.md,
                  },
                ]}
              >
                <DetailRow label="Status" value={community.type} colors={colors} capitalize />
                {community.categoryName ? (
                  <DetailRow label="Category" value={community.categoryName} colors={colors} />
                ) : null}
                <DetailRow
                  label="Members"
                  value={String(community.members)}
                  colors={colors}
                />
                {community.posts !== undefined ? (
                  <DetailRow label="Posts" value={String(community.posts)} colors={colors} />
                ) : null}
                {community.createdAgo ? (
                  <DetailRow label="Created" value={community.createdAgo} colors={colors} />
                ) : null}
              </View>
            </View>
          </View>
        ) : null}

        {/* Composer — members only; the endpoint rejects everyone else. */}
        {tab === 'Feed' && canPost ? (
          <View
            style={[
              styles.composer,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: radius.md,
              },
            ]}
          >
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder={`Share something with ${community.name}…`}
              placeholderTextColor={colors.textMuted}
              selectionColor={colors.brand}
              multiline
              style={[styles.composerInput, { color: colors.text }]}
            />
            <Pressable
              onPress={onPost}
              disabled={!draft.trim() || createPost.isPending}
              accessibilityRole="button"
              accessibilityLabel="Post to community"
              style={[
                styles.composerBtn,
                {
                  backgroundColor: draft.trim() ? colors.brand : colors.surfaceAlt,
                  borderRadius: radius.pill,
                },
              ]}
            >
              {createPost.isPending ? (
                <ActivityIndicator size="small" color={colors.onBrand} />
              ) : (
                <Text
                  style={[
                    styles.composerBtnText,
                    { color: draft.trim() ? colors.onBrand : colors.textMuted },
                  ]}
                >
                  Post
                </Text>
              )}
            </Pressable>
          </View>
        ) : null}

        {/* The gate. The message is the backend's own, and differs per type. */}
        {tab === 'Feed' && !canViewFeed ? (
          <View
            style={[
              styles.gate,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: radius.md,
              },
            ]}
          >
            <Ionicons name="lock-closed-outline" size={26} color={colors.textMuted} />
            <Text style={[styles.gateText, { color: colors.textSecondary }]}>
              {community.access.gateMessage ??
                'You need to join this community before you can see its posts.'}
            </Text>
            {community.type === 'paid' ? (
              <Text style={[styles.gateNote, { color: colors.textMuted }]}>
                Paying for a community isn't available in the app yet — join it on the web for
                now.
              </Text>
            ) : null}
            {community.type === 'private' ? (
              <Text style={[styles.gateNote, { color: colors.textMuted }]}>
                Ask an admin for an invite link — opening it joins you automatically.
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScreenBackground />
      <FlatList
        data={tab === 'Feed' && canViewFeed ? posts : []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: spacing.xl }}>
            <CommunityPostCard
              post={item}
              communityId={community.id}
              onOpenComments={() => setCommentsFor(item)}
            />
          </View>
        )}
        ListHeaderComponent={header}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onRefresh={canViewFeed ? refetchPosts : undefined}
        refreshing={canViewFeed ? isRefetching && !isFetchingNextPage : false}
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) fetchNextPage();
        }}
        contentContainerStyle={{
          paddingBottom: insets.bottom + 40,
          gap: spacing.md,
        }}
        ListEmptyComponent={
          tab === 'Feed' && canViewFeed ? (
            loadingPosts ? (
              <View style={styles.emptyWrap}>
                <ActivityIndicator color={colors.brand} />
              </View>
            ) : (
              <View style={styles.emptyWrap}>
                <Ionicons name="chatbubbles-outline" size={28} color={colors.textMuted} />
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                  {canPost ? 'No posts yet — start the conversation.' : 'No posts yet.'}
                </Text>
              </View>
            )
          ) : null
        }
        ListFooterComponent={
          isFetchingNextPage ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator color={colors.brand} />
            </View>
          ) : null
        }
      />

      <ShareSheet
        visible={shareOpen}
        title={community.name}
        url={community.shareUrl}
        message={`Join ${community.name} on Payhankey`}
        onClose={() => setShareOpen(false)}
      />

      <CommunityCommentsSheet
        visible={!!commentsFor}
        communityId={community.id}
        post={commentsFor}
        canComment={canPost}
        onClose={() => setCommentsFor(null)}
      />
    </View>
  );
}

function DetailRow({
  label,
  value,
  colors,
  capitalize,
}: {
  label: string;
  value: string;
  colors: ReturnType<typeof useTheme>['colors'];
  capitalize?: boolean;
}) {
  return (
    <View style={styles.detailRow}>
      <Text style={[styles.detailKey, { color: colors.textMuted }]}>{label}</Text>
      <Text
        style={[
          styles.detailValue,
          { color: colors.text },
          capitalize ? { textTransform: 'capitalize' } : null,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', gap: 10 },
  missing: { fontFamily: FONT, fontSize: 15, fontWeight: '600' },
  missingLink: { fontFamily: FONT, fontSize: 14, fontWeight: '800' },
  coverWrap: { position: 'relative' },
  coverNav: {
    position: 'absolute',
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: -12 },
  identityText: { flex: 1, gap: 3 },
  name: { fontFamily: FONT, fontSize: 20, fontWeight: '800' },
  meta: { fontFamily: FONT, fontSize: 13, fontWeight: '600' },
  description: { fontFamily: FONT, fontSize: 14, lineHeight: 21, fontWeight: '500' },

  pricingCard: { padding: 14, gap: 8, borderWidth: 1 },
  pricingHead: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  pricingLabel: { fontFamily: FONT, fontSize: 13, fontWeight: '800' },
  pricingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pricingKey: { fontFamily: FONT, fontSize: 13, fontWeight: '600' },
  // Money never renders in FONT_MONO — Space Mono has no ₦ glyph.
  pricingValue: { fontFamily: FONT, fontSize: 14, fontWeight: '800' },
  pricingNote: { fontFamily: FONT, fontSize: 12, lineHeight: 17, fontWeight: '500' },

  actionBtn: {
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  actionText: { fontFamily: FONT, fontSize: 14, fontWeight: '800' },

  tabRow: { flexDirection: 'row', padding: 4, gap: 4 },
  tabBtn: { flex: 1, height: 38, alignItems: 'center', justifyContent: 'center' },
  tabText: { fontFamily: FONT, fontSize: 13, fontWeight: '800' },

  sectionTitle: { fontFamily: FONT, fontSize: 15, fontWeight: '800' },
  ownerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  ownerName: { fontFamily: FONT, fontSize: 14, fontWeight: '800' },
  ownerHandle: { fontFamily: FONT, fontSize: 12, fontWeight: '600' },
  detailCard: { padding: 14, gap: 10, borderWidth: StyleSheet.hairlineWidth },
  hint: { fontFamily: FONT, fontSize: 12, lineHeight: 17, fontWeight: '500' },
  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  reviewBtn: {
    paddingHorizontal: 13,
    height: 32,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  reviewText: { fontFamily: FONT, fontSize: 12, fontWeight: '800' },
  detailRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  detailKey: { fontFamily: FONT, fontSize: 13, fontWeight: '600' },
  detailValue: { fontFamily: FONT, fontSize: 13, fontWeight: '800' },

  composer: { padding: 12, gap: 10, borderWidth: StyleSheet.hairlineWidth },
  composerInput: {
    fontFamily: FONT,
    minHeight: 62,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    textAlignVertical: 'top',
  },
  composerBtn: {
    alignSelf: 'flex-end',
    paddingHorizontal: 20,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerBtnText: { fontFamily: FONT, fontSize: 13, fontWeight: '800' },

  gate: { alignItems: 'center', gap: 10, padding: 22, borderWidth: StyleSheet.hairlineWidth },
  gateText: { fontFamily: FONT, fontSize: 14, lineHeight: 20, fontWeight: '600', textAlign: 'center' },
  gateNote: { fontFamily: FONT, fontSize: 12, lineHeight: 17, fontWeight: '500', textAlign: 'center' },

  emptyWrap: { alignItems: 'center', gap: 10, paddingVertical: 34, paddingHorizontal: 20 },
  emptyText: { fontFamily: FONT, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  footerLoader: { paddingVertical: 20 },
});
