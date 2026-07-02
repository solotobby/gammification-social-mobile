import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PostCard } from '../../src/components/feed/PostCard';
import { TAB_BAR_CLEARANCE } from '../../src/components/navigation/TabBar';
import { Avatar } from '../../src/components/ui/Avatar';
import { CopyField } from '../../src/components/ui/CopyField';
import { ScreenBackground } from '../../src/components/ui/ScreenBackground';
import { SectionHeader } from '../../src/components/ui/SectionHeader';
import {
  currentUser,
  earnings,
  feedPosts,
  notifications,
  referral,
  trendingMembers,
  trendingTopics,
  type Post,
} from '../../src/data/community';
import { useTheme } from '../../src/theme/ThemeProvider';

/**
 * Home tab — the mobile take on the web dashboard/timeline: earnings pulse,
 * composer entry, referral invite, trending previews, and the post feed.
 */
export default function HomeScreen() {
  const { colors, brand, radius, spacing } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Re-snapshot the in-memory feed when returning from Compose / Post detail.
  const [posts, setPosts] = useState<Post[]>(() => [...feedPosts]);
  useFocusEffect(
    useCallback(() => {
      setPosts([...feedPosts]);
    }, []),
  );

  const hasUnread = notifications.some((n) => n.unread);
  const openPost = (post: Post) => router.push(`/post/${post.id}`);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScreenBackground />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + spacing.lg,
          paddingBottom: insets.bottom + TAB_BAR_CLEARANCE,
          paddingHorizontal: spacing.xl,
          gap: spacing.xl,
        }}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => router.push('/profile')}
            accessibilityRole="button"
            accessibilityLabel="Open profile"
          >
            <Avatar name={currentUser.name} tint={currentUser.tint} size={46} />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={[styles.hello, { color: colors.textMuted }]}>Welcome back</Text>
            <Text style={[styles.helloName, { color: colors.text }]}>
              {currentUser.name.split(' ')[0]} 👋
            </Text>
          </View>
          <Pressable
            onPress={() => router.push('/notifications')}
            accessibilityRole="button"
            accessibilityLabel="Notifications"
            style={[
              styles.bellButton,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Ionicons name="notifications-outline" size={22} color={colors.text} />
            {hasUnread ? (
              <View style={[styles.bellDot, { backgroundColor: colors.pink, borderColor: colors.surface }]} />
            ) : null}
          </Pressable>
        </View>

        {/* Earnings pulse */}
        <Pressable
          onPress={() => router.push('/earnings')}
          accessibilityRole="button"
          accessibilityLabel="Open earnings"
        >
          <LinearGradient
            colors={[brand.violetBright, brand.violet]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.earningsCard, { borderRadius: radius.lg, shadowColor: brand.violet }]}
          >
            <View style={styles.earningsLeft}>
              <Text style={styles.earningsLabel}>Estimated earnings · {earnings.monthLabel}</Text>
              <Text style={styles.earningsValue}>₦{earnings.estimated.toLocaleString()}</Text>
              <View style={styles.earningsPill}>
                <Ionicons name="flash" size={13} color="#FFFFFF" />
                <Text style={styles.earningsPillText}>
                  {earnings.monetized.engagement} monetized engagements
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={22} color="rgba(255,255,255,0.85)" />
          </LinearGradient>
        </Pressable>

        {/* Composer trigger */}
        <Pressable
          onPress={() => router.push('/compose')}
          accessibilityRole="button"
          accessibilityLabel="Create a post"
          style={[
            styles.composerCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: radius.lg,
            },
          ]}
        >
          <Avatar name={currentUser.name} tint={currentUser.tint} size={38} />
          <Text style={[styles.composerHint, { color: colors.textMuted }]} numberOfLines={1}>
            Say something amazing — every post can earn
          </Text>
          <View style={[styles.composerAction, { backgroundColor: colors.surfaceAlt }]}>
            <Ionicons name="create-outline" size={18} color={colors.brand} />
          </View>
        </Pressable>

        {/* Referral invite */}
        <View
          style={[
            styles.inviteCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: radius.lg,
            },
          ]}
        >
          <View style={styles.inviteHeader}>
            <View style={[styles.inviteIcon, { backgroundColor: `${colors.mint}1F` }]}>
              <Ionicons name="gift-outline" size={20} color={colors.mint} />
            </View>
            <View style={styles.inviteText}>
              <Text style={[styles.inviteTitle, { color: colors.text }]}>
                Invite friends & earn together
              </Text>
              <Text style={[styles.inviteSub, { color: colors.textMuted }]}>
                Friends who join boost your engagement — and your referral pays you.
              </Text>
            </View>
          </View>
          <CopyField label="Your referral link" value={referral.link} icon="link-outline" />
        </View>

        {/* Trending topics */}
        <View style={{ gap: spacing.md }}>
          <SectionHeader
            title="Trending topics"
            icon="flame"
            onSeeAll={() => router.push('/trending-topics')}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing.sm }}
          >
            {trendingTopics.map((topic) => (
              <View
                key={topic.id}
                style={[
                  styles.topicChip,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.topicTag, { color: colors.brand }]}>#{topic.tag}</Text>
                <Text style={[styles.topicCount, { color: colors.textMuted }]}>
                  {topic.posts} posts
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* Trending members rail */}
        <View style={{ gap: spacing.md }}>
          <SectionHeader
            title="Trending members"
            icon="people"
            onSeeAll={() => router.push('/trending-members')}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing.md }}
          >
            {trendingMembers.map((member) => (
              <View
                key={member.id}
                style={[
                  styles.memberCard,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <Avatar name={member.name} tint={member.tint} size={48} />
                <Text style={[styles.memberName, { color: colors.text }]} numberOfLines={1}>
                  {member.name.split(' ')[0]}
                </Text>
                <Text style={[styles.memberMeta, { color: colors.textMuted }]}>
                  {member.engagements} engagements
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* Feed */}
        <View style={{ gap: spacing.md }}>
          <SectionHeader title="Your feed" icon="sparkles" />
          {posts.map((post) => (
            <PostCard key={post.id} post={post} onOpen={openPost} />
          ))}
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
    gap: 14,
  },
  headerText: { flex: 1 },
  hello: { fontSize: 13, fontWeight: '600' },
  helloName: { fontSize: 20, fontWeight: '800' },
  bellButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  bellDot: {
    position: 'absolute',
    top: 10,
    right: 11,
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 1.5,
  },
  earningsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  earningsLeft: { flex: 1, gap: 6 },
  earningsLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '600' },
  earningsValue: { color: '#FFFFFF', fontSize: 32, fontWeight: '900' },
  earningsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    marginTop: 4,
  },
  earningsPillText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  composerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  composerHint: { flex: 1, fontSize: 14, fontWeight: '500' },
  composerAction: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteCard: {
    padding: 18,
    gap: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  inviteHeader: { flexDirection: 'row', gap: 12 },
  inviteIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteText: { flex: 1, gap: 3 },
  inviteTitle: { fontSize: 16, fontWeight: '800' },
  inviteSub: { fontSize: 13, lineHeight: 18, fontWeight: '500' },
  topicChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    gap: 1,
  },
  topicTag: { fontSize: 14, fontWeight: '800' },
  topicCount: { fontSize: 11, fontWeight: '600' },
  memberCard: {
    width: 128,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  memberName: { fontSize: 14, fontWeight: '800' },
  memberMeta: { fontSize: 11, fontWeight: '600' },
});
