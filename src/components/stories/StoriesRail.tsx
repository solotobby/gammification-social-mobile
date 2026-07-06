import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { currentUser, type Member } from '../../data/community';
import { memberStories, myStories, type StoryItem } from '../../data/stories';
import { useTheme } from '../../theme/ThemeProvider';
import { Avatar } from '../ui/Avatar';
import { StoryPreview } from './StoryPreview';

const CARD_WIDTH = 104;
const CARD_HEIGHT = 148;

type CardShellProps = {
  onPress: () => void;
  label: string;
  children: React.ReactNode;
};

/** Rounded rail card. No accessibilityRole: some cards nest a real button. */
function CardShell({ onPress, label, children }: CardShellProps) {
  const { colors, radius } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.card,
        {
          borderRadius: radius.md,
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      {children}
    </Pressable>
  );
}

/** First card — your latest story (with an add badge), or a "Create story" prompt. */
function MyStoryCard({ latest }: { latest?: StoryItem }) {
  const { colors, brand } = useTheme();
  const router = useRouter();

  return (
    <CardShell
      label={latest ? 'View your story' : 'Create a story'}
      onPress={() => router.push(latest ? `/story/${currentUser.id}` : '/story/create')}
    >
      {latest ? (
        <StoryPreview item={latest} />
      ) : (
        <View style={styles.createBody}>
          <Avatar name={currentUser.name} tint={currentUser.tint} size={52} />
        </View>
      )}
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.65)']} style={styles.scrim} />
      <Pressable
        onPress={() => router.push('/story/create')}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={latest ? 'Add to your story' : 'Create story'}
        style={[styles.plusBadge, { backgroundColor: brand.violet, borderColor: colors.surface }]}
      >
        <Ionicons name="add" size={18} color="#FFFFFF" />
      </Pressable>
      <Text style={styles.cardLabel} numberOfLines={2}>
        {latest ? 'Your story' : 'Create story'}
      </Text>
    </CardShell>
  );
}

/** A member's story card — preview of their latest item + avatar ring. */
function MemberStoryCard({
  member,
  latest,
  seen,
}: {
  member: Member;
  latest: StoryItem;
  seen?: boolean;
}) {
  const { colors, brand } = useTheme();
  const router = useRouter();

  return (
    <CardShell label={`View ${member.name}'s story`} onPress={() => router.push(`/story/${member.id}`)}>
      <StoryPreview item={latest} />
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.65)']} style={styles.scrim} />
      <View
        style={[
          styles.avatarRing,
          { borderColor: seen ? colors.border : brand.violet, backgroundColor: colors.surface },
        ]}
      >
        <Avatar name={member.name} tint={member.tint} size={30} />
      </View>
      <Text style={styles.cardLabel} numberOfLines={2}>
        {member.name.split(' ')[0]}
      </Text>
    </CardShell>
  );
}

/**
 * Facebook-style stories rail for the top of the home feed: your story first
 * (or a create prompt), then everyone else's, freshest to oldest.
 */
export function StoriesRail() {
  const { spacing } = useTheme();
  // Stories live in a mutable store — re-snapshot whenever home regains focus
  // (e.g. after publishing from /story/create or watching a story).
  const [, setVersion] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setVersion((v) => v + 1);
    }, []),
  );

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: spacing.sm, paddingRight: spacing.sm }}
    >
      <MyStoryCard latest={myStories[myStories.length - 1]} />
      {memberStories.map((group) => (
        <MemberStoryCard
          key={group.member.id}
          member={group.member}
          latest={group.items[group.items.length - 1]}
          seen={group.seen}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  scrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 64,
  },
  createBody: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 18 },
  plusBadge: {
    position: 'absolute',
    bottom: 34,
    alignSelf: 'center',
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarRing: {
    position: 'absolute',
    top: 8,
    left: 8,
    padding: 2,
    borderRadius: 19,
    borderWidth: 2,
  },
  cardLabel: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 8,
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
});
