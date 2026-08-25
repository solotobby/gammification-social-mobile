import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CommunityBadge } from '../../src/components/community/CommunityBadge';
import { ShareSheet } from '../../src/components/community/ShareSheet';
import { Avatar } from '../../src/components/ui/Avatar';
import { BackButton } from '../../src/components/ui/BackButton';
import { CopyField } from '../../src/components/ui/CopyField';
import { HashtagText } from '../../src/components/ui/HashtagText';
import { ScreenBackground } from '../../src/components/ui/ScreenBackground';
import { TextField } from '../../src/components/ui/TextField';
import {
  addCommunityPost,
  communityLink,
  communityOwner,
  findCommunity,
  membershipOf,
  toggleMembership,
  type CommunityRole,
} from '../../src/data/communities';
import { useTheme } from '../../src/theme/ThemeProvider';
import { FONT } from '../../src/theme/fonts';

const TABS = ['Feed', 'About', 'Members'] as const;
type Tab = (typeof TABS)[number];

const ROLE_LABEL: Record<CommunityRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
};

/**
 * Community detail — cover, identity row with the membership action, then the
 * Feed / About / Members tabs from the web.
 *
 * The feed is gated the way the web gates it: gated communities show the
 * "approval required" state instead of posts until the request is accepted, and
 * the composer only appears once you've actually joined.
 */
export default function CommunityScreen() {
  const { colors, brand, radius, spacing } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { slug } = useLocalSearchParams<{ slug: string }>();

  const community = useMemo(() => findCommunity(slug), [slug]);

  const [tab, setTab] = useState<Tab>('Feed');
  const [membership, setMembership] = useState(() =>
    community ? membershipOf(community) : 'none',
  );
  const [draft, setDraft] = useState('');
  const [postTick, setPostTick] = useState(0);
  const [shareOpen, setShareOpen] = useState(false);
  const [memberQuery, setMemberQuery] = useState('');

  const filteredMembers = useMemo(() => {
    if (!community) return [];
    const needle = memberQuery.trim().toLowerCase();
    if (!needle) return community.people;
    return community.people.filter(
      (p) =>
        p.member.name.toLowerCase().includes(needle) ||
        p.member.handle.toLowerCase().includes(needle),
    );
  }, [community, memberQuery, postTick]);

  if (!community) {
    return (
      <View style={[styles.root, styles.center, { backgroundColor: colors.background }]}>
        <ScreenBackground />
        <Text style={[styles.missing, { color: colors.textMuted }]}>
          That community doesn't exist.
        </Text>
        <Pressable onPress={() => router.back()} accessibilityRole="button">
          <Text style={[styles.missingLink, { color: colors.brand }]}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const owner = communityOwner(community);
  const memberCount = community.people.length;
  const gated = community.status === 'approval' || community.status === 'private';
  const joined = membership === 'joined';

  const actionLabel =
    membership === 'joined'
      ? 'Leave'
      : membership === 'requested'
        ? 'Requested'
        : gated
          ? 'Request to join'
          : community.status === 'paid'
            ? `Join · ₦${community.price?.toLocaleString()}`
            : 'Join';

  const onPost = () => {
    const body = draft.trim();
    if (!body) return;
    addCommunityPost(community, body);
    setDraft('');
    setPostTick((t) => t + 1);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScreenBackground />
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingBottom: insets.bottom + spacing.xxl,
          gap: spacing.lg,
        }}
      >
        {/* Cover + floating controls */}
        <View>
          <LinearGradient
            colors={[brand.violetBright, brand.violet, brand.indigo]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.cover, { paddingTop: insets.top + spacing.sm }]}
          >
            <View style={styles.coverBar}>
              <BackButton onPress={() => router.back()} />
              <Pressable
                onPress={() => setShareOpen(true)}
                accessibilityRole="button"
                accessibilityLabel={`Share ${community.name}`}
                style={styles.coverAction}
              >
                <Ionicons name="share-social-outline" size={19} color="#FFFFFF" />
              </Pressable>
            </View>
          </LinearGradient>

          {/* Identity */}
          <View style={[styles.identity, { paddingHorizontal: spacing.xl }]}>
            <View style={[styles.avatarRing, { borderColor: colors.background }]}>
              <Avatar name={community.name} tint={community.tint} size={78} />
            </View>
            <Text style={[styles.name, { color: colors.text }]}>{community.name}</Text>
            <View style={styles.metaRow}>
              <Text style={[styles.meta, { color: colors.textMuted }]}>
                {memberCount} {memberCount === 1 ? 'member' : 'members'} ·{' '}
                {community.posts.length} {community.posts.length === 1 ? 'post' : 'posts'}
              </Text>
              <CommunityBadge status={community.status} long />
              <Text style={[styles.meta, { color: colors.textMuted }]}>
                · {community.category}
              </Text>
            </View>
            {owner ? (
              <Text style={[styles.ledBy, { color: colors.textMuted }]}>
                Led by {owner.name}
              </Text>
            ) : null}

            <Pressable
              onPress={() => setMembership(toggleMembership(community))}
              accessibilityRole="button"
              accessibilityLabel={`${actionLabel} ${community.name}`}
              style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1, width: '100%' }]}
            >
              {membership === 'none' ? (
                <LinearGradient
                  colors={[brand.violetBright, brand.violet]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.joinBtn, { borderRadius: radius.pill }]}
                >
                  <Text style={[styles.joinText, { color: colors.onBrand }]}>
                    {actionLabel}
                  </Text>
                  <Ionicons name="arrow-forward" size={17} color={colors.onBrand} />
                </LinearGradient>
              ) : (
                <View
                  style={[
                    styles.joinBtn,
                    {
                      backgroundColor: colors.surfaceAlt,
                      borderColor: colors.border,
                      borderWidth: StyleSheet.hairlineWidth,
                      borderRadius: radius.pill,
                    },
                  ]}
                >
                  <Ionicons
                    name={joined ? 'checkmark-circle' : 'time-outline'}
                    size={17}
                    color={colors.textSecondary}
                  />
                  <Text style={[styles.joinText, { color: colors.textSecondary }]}>
                    {actionLabel}
                  </Text>
                </View>
              )}
            </Pressable>
          </View>
        </View>

        {/* Tabs */}
        <View style={[styles.tabRow, { borderBottomColor: colors.border, marginHorizontal: spacing.xl }]}>
          {TABS.map((item) => {
            const active = item === tab;
            return (
              <Pressable
                key={item}
                onPress={() => setTab(item)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                style={styles.tab}
              >
                <Text
                  style={[styles.tabText, { color: active ? colors.text : colors.textMuted }]}
                >
                  {item}
                </Text>
                <View
                  style={[
                    styles.tabUnderline,
                    { backgroundColor: active ? colors.brand : 'transparent' },
                  ]}
                />
              </Pressable>
            );
          })}
        </View>

        <View style={{ paddingHorizontal: spacing.xl, gap: spacing.lg }}>
          {tab === 'Feed' ? (
            membership !== 'joined' && gated ? (
              <View
                style={[
                  styles.gateCard,
                  { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg },
                ]}
              >
                <Ionicons name="lock-closed-outline" size={26} color={colors.gold} />
                <Text style={[styles.gateTitle, { color: colors.text }]}>
                  {membership === 'requested' ? 'Request sent' : 'Approval required'}
                </Text>
                <Text style={[styles.gateBlurb, { color: colors.textMuted }]}>
                  {membership === 'requested'
                    ? 'An admin will review your request. Posts appear here once you’re in.'
                    : 'Your join request must be approved before you can view posts here.'}
                </Text>
              </View>
            ) : (
              <>
                {joined ? (
                  <View
                    style={[
                      styles.composer,
                      { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg },
                    ]}
                  >
                    <TextInput
                      value={draft}
                      onChangeText={setDraft}
                      placeholder={`What's on your mind? Share with ${community.name}…`}
                      placeholderTextColor={colors.textMuted}
                      selectionColor={colors.brand}
                      multiline
                      style={[styles.composerInput, { color: colors.text }]}
                    />
                    <View style={styles.composerFooter}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Add photo or video"
                        style={styles.composerMedia}
                      >
                        <Ionicons name="image-outline" size={18} color={colors.textMuted} />
                        <Text style={[styles.composerMediaText, { color: colors.textMuted }]}>
                          Photo/Video
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={onPost}
                        disabled={!draft.trim()}
                        accessibilityRole="button"
                        accessibilityLabel="Post to community"
                        style={[
                          styles.postBtn,
                          {
                            backgroundColor: draft.trim() ? colors.brand : colors.surfaceAlt,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.postBtnText,
                            { color: draft.trim() ? colors.onBrand : colors.textMuted },
                          ]}
                        >
                          Post
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                ) : null}

                {community.posts.length === 0 ? (
                  <View style={styles.emptyWrap}>
                    <Ionicons name="chatbubbles-outline" size={30} color={colors.textMuted} />
                    <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                      No posts yet.{joined ? ' Be the first to say something.' : ''}
                    </Text>
                  </View>
                ) : (
                  community.posts.map((post) => (
                    <View
                      key={post.id}
                      style={[
                        styles.postCard,
                        { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg },
                      ]}
                    >
                      <View style={styles.postHeader}>
                        <Avatar name={post.author.name} tint={post.author.tint} size={38} />
                        <View style={styles.postHeaderText}>
                          <Text style={[styles.postName, { color: colors.text }]} numberOfLines={1}>
                            {post.author.name}
                          </Text>
                          <Text style={[styles.postMeta, { color: colors.textMuted }]} numberOfLines={1}>
                            @{post.author.handle} · {post.timeAgo}
                          </Text>
                        </View>
                      </View>
                      <HashtagText style={[styles.postBody, { color: colors.text }]}>
                        {post.body}
                      </HashtagText>
                      <View style={[styles.postActions, { borderTopColor: colors.border }]}>
                        <View style={styles.postAction}>
                          <Ionicons name="heart-outline" size={18} color={colors.textMuted} />
                          <Text style={[styles.postActionText, { color: colors.textMuted }]}>
                            {post.likes}
                          </Text>
                        </View>
                        <View style={styles.postAction}>
                          <Ionicons name="chatbubble-outline" size={17} color={colors.textMuted} />
                          <Text style={[styles.postActionText, { color: colors.textMuted }]}>
                            {post.comments}
                          </Text>
                        </View>
                        <View style={styles.postAction}>
                          <Ionicons name="eye-outline" size={18} color={colors.textMuted} />
                          <Text style={[styles.postActionText, { color: colors.textMuted }]}>
                            {post.views}
                          </Text>
                        </View>
                      </View>
                    </View>
                  ))
                )}
              </>
            )
          ) : null}

          {tab === 'About' ? (
            <View
              style={[
                styles.aboutCard,
                { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg },
              ]}
            >
              <Text style={[styles.aboutTitle, { color: colors.text }]}>
                About this community
              </Text>
              {community.description ? (
                <Text style={[styles.aboutBlurb, { color: colors.textSecondary }]}>
                  {community.description}
                </Text>
              ) : null}
              {[
                { label: 'Category', value: community.category },
                { label: 'Status', value: community.status === 'paid'
                  ? `Paid · ₦${community.price?.toLocaleString()}/mo`
                  : community.status.charAt(0).toUpperCase() + community.status.slice(1) },
                { label: 'Created', value: community.createdAt },
                { label: 'Members', value: `${memberCount}` },
                { label: 'Admin', value: owner?.name ?? '—' },
              ].map((row) => (
                <View key={row.label} style={[styles.aboutRow, { borderTopColor: colors.border }]}>
                  <Text style={[styles.aboutLabel, { color: colors.textMuted }]}>
                    {row.label}
                  </Text>
                  <Text style={[styles.aboutValue, { color: colors.text }]} numberOfLines={1}>
                    {row.value}
                  </Text>
                </View>
              ))}
              <View style={{ marginTop: 6 }}>
                <CopyField
                  label="Public link"
                  value={communityLink(community.slug)}
                  icon="link-outline"
                />
              </View>
            </View>
          ) : null}

          {tab === 'Members' ? (
            <View style={{ gap: spacing.md }}>
              <TextField
                icon="search-outline"
                placeholder="Search members by name or username"
                value={memberQuery}
                onChangeText={setMemberQuery}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <View
                style={[
                  styles.memberCard,
                  { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg },
                ]}
              >
                {filteredMembers.length === 0 ? (
                  <Text style={[styles.emptyText, { color: colors.textMuted, paddingVertical: 24 }]}>
                    No one matches that.
                  </Text>
                ) : (
                  filteredMembers.map((entry, index) => (
                    <Pressable
                      key={entry.member.id}
                      onPress={() => router.push(`/member/${entry.member.handle}`)}
                      accessibilityRole="button"
                      accessibilityLabel={`View ${entry.member.name}'s profile`}
                      style={({ pressed }) => [
                        styles.memberRow,
                        index > 0 && {
                          borderTopWidth: StyleSheet.hairlineWidth,
                          borderTopColor: colors.border,
                        },
                        { opacity: pressed ? 0.7 : 1 },
                      ]}
                    >
                      <Avatar name={entry.member.name} tint={entry.member.tint} size={38} />
                      <View style={styles.memberText}>
                        <Text style={[styles.memberName, { color: colors.text }]} numberOfLines={1}>
                          {entry.member.name}
                        </Text>
                        <Text style={[styles.memberHandle, { color: colors.textMuted }]} numberOfLines={1}>
                          @{entry.member.handle}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.rolePill,
                          {
                            backgroundColor:
                              entry.role === 'member' ? colors.surfaceAlt : `${colors.brand}1A`,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.roleText,
                            {
                              color:
                                entry.role === 'member' ? colors.textMuted : colors.brand,
                            },
                          ]}
                        >
                          {ROLE_LABEL[entry.role]}
                        </Text>
                      </View>
                    </Pressable>
                  ))
                )}
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <ShareSheet
        visible={shareOpen}
        title={community.name}
        url={communityLink(community.slug)}
        message={`Join ${community.name} on Payhankey`}
        onClose={() => setShareOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', gap: 10 },
  missing: { fontFamily: FONT, fontSize: 15, fontWeight: '600' },
  missingLink: { fontFamily: FONT, fontSize: 15, fontWeight: '800' },
  cover: { height: 180, paddingHorizontal: 24 },
  coverBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  coverAction: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  identity: { alignItems: 'center', marginTop: -42, gap: 4 },
  avatarRing: { borderWidth: 4, borderRadius: 43, marginBottom: 6 },
  name: { fontFamily: FONT, fontSize: 22, fontWeight: '800', textAlign: 'center' },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
  },
  meta: { fontFamily: FONT, fontSize: 13, fontWeight: '600' },
  ledBy: { fontFamily: FONT, fontSize: 13, fontWeight: '500', marginTop: 2 },
  joinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    marginTop: 16,
  },
  joinText: { fontFamily: FONT, fontSize: 15, fontWeight: '800' },
  tabRow: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, alignItems: 'center', gap: 8 },
  tabText: { fontFamily: FONT, fontSize: 15, fontWeight: '800' },
  tabUnderline: { height: 3, width: 44, borderRadius: 2 },
  gateCard: {
    alignItems: 'center',
    gap: 8,
    padding: 26,
    borderWidth: StyleSheet.hairlineWidth,
  },
  gateTitle: { fontFamily: FONT, fontSize: 16, fontWeight: '800' },
  gateBlurb: { fontFamily: FONT, fontSize: 13, lineHeight: 19, fontWeight: '500', textAlign: 'center' },
  composer: {
    padding: 14,
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  composerInput: {
    fontFamily: FONT,
    minHeight: 60,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '500',
    textAlignVertical: 'top',
  },
  composerFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  composerMedia: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  composerMediaText: { fontFamily: FONT, fontSize: 13, fontWeight: '700' },
  postBtn: {
    paddingHorizontal: 20,
    height: 36,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postBtnText: { fontFamily: FONT, fontSize: 13, fontWeight: '800' },
  postCard: {
    padding: 16,
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  postHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  postHeaderText: { flex: 1, gap: 1 },
  postName: { fontFamily: FONT, fontSize: 14, fontWeight: '800' },
  postMeta: { fontFamily: FONT, fontSize: 12, fontWeight: '500' },
  postBody: { fontFamily: FONT, fontSize: 15, lineHeight: 22, fontWeight: '400' },
  postActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 22,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
  },
  postAction: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  postActionText: { fontFamily: FONT, fontSize: 13, fontWeight: '700' },
  aboutCard: {
    padding: 18,
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  aboutTitle: { fontFamily: FONT, fontSize: 16, fontWeight: '800' },
  aboutBlurb: { fontFamily: FONT, fontSize: 13, lineHeight: 19, fontWeight: '500', marginBottom: 4 },
  aboutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  aboutLabel: { fontFamily: FONT, fontSize: 13, fontWeight: '600' },
  aboutValue: { fontFamily: FONT, flexShrink: 1, fontSize: 13, fontWeight: '800' },
  memberCard: { borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  memberText: { flex: 1, gap: 1 },
  memberName: { fontFamily: FONT, fontSize: 14, fontWeight: '800' },
  memberHandle: { fontFamily: FONT, fontSize: 12, fontWeight: '500' },
  rolePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  roleText: { fontFamily: FONT, fontSize: 11, fontWeight: '800' },
  emptyWrap: { alignItems: 'center', gap: 10, paddingVertical: 34 },
  emptyText: { fontFamily: FONT, fontSize: 14, fontWeight: '600', textAlign: 'center' },
});
