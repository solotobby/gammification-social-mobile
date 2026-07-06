import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StoryContent } from '../../src/components/stories/StoryContent';
import { StoryViewersSheet } from '../../src/components/stories/StoryViewersSheet';
import { Avatar } from '../../src/components/ui/Avatar';
import { currentUser } from '../../src/data/community';
import { findStoryGroup, getStoryGroups, markStoriesSeen } from '../../src/data/stories';

/**
 * Full-screen story viewer: segmented progress bars auto-advance through a
 * member's items, tap right/left to skip/rewind, and finishing a group rolls
 * into the next member's stories. Your own stories add a viewers sheet.
 */
export default function StoryViewerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { member: memberId } = useLocalSearchParams<{ member: string }>();

  const group = findStoryGroup(memberId ?? '');
  const isMine = memberId === currentUser.id;

  const [index, setIndex] = useState(0);
  const [showViewers, setShowViewers] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;

  const item = group?.items[index];

  // Replacing /story/a with /story/b reuses this screen — restart at item 0.
  useEffect(() => {
    setIndex(0);
    setShowViewers(false);
    if (memberId) markStoriesSeen(memberId);
  }, [memberId]);

  const goToNextGroup = useCallback(() => {
    const groups = getStoryGroups();
    const at = groups.findIndex((g) => g.member.id === memberId);
    const next = groups[at + 1];
    if (next) router.replace(`/story/${next.member.id}`);
    else router.back();
  }, [memberId, router]);

  const advance = useCallback(() => {
    if (!group) return;
    if (index < group.items.length - 1) setIndex((i) => i + 1);
    else goToNextGroup();
  }, [group, index, goToNextGroup]);

  const rewind = () => {
    if (index > 0) setIndex((i) => i - 1);
    else {
      const groups = getStoryGroups();
      const at = groups.findIndex((g) => g.member.id === memberId);
      const prev = groups[at - 1];
      if (prev) router.replace(`/story/${prev.member.id}`);
    }
  };

  // Drive the current segment; pause while the viewers sheet is open.
  useEffect(() => {
    if (!item || showViewers) return;
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: item.durationMs,
      useNativeDriver: false,
    });
    animation.start(({ finished }) => {
      if (finished) advance();
    });
    return () => animation.stop();
  }, [item, showViewers, progress, advance]);

  if (!group || !item) {
    return (
      <View style={styles.root}>
        <View style={[styles.missing, { paddingTop: insets.top + 24 }]}>
          <Text style={styles.missingText}>This story is no longer available.</Text>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={styles.missingBtn}
          >
            <Text style={styles.missingBtnText}>Go back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StoryContent item={item} active={!showViewers} />

      {/* Tap zones: left third rewinds, the rest advances */}
      <View style={StyleSheet.absoluteFill}>
        <View style={styles.tapRow}>
          <Pressable style={styles.tapLeft} onPress={rewind} accessibilityLabel="Previous story" />
          <Pressable style={styles.tapRight} onPress={advance} accessibilityLabel="Next story" />
        </View>
      </View>

      {/* Progress segments */}
      <View style={[styles.progressRow, { top: insets.top + 10 }]}>
        {group.items.map((seg, i) => (
          <View key={seg.id} style={styles.track}>
            <Animated.View
              style={[
                styles.fill,
                i < index && styles.fillDone,
                i === index && {
                  width: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          </View>
        ))}
      </View>

      {/* Header */}
      <View style={[styles.header, { top: insets.top + 26 }]}>
        <Avatar name={group.member.name} tint={group.member.tint} size={38} />
        <View style={styles.headerText}>
          <Text style={styles.headerName} numberOfLines={1}>
            {isMine ? 'Your story' : group.member.name}
          </Text>
          <Text style={styles.headerTime}>{item.timeAgo}</Text>
        </View>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Close story"
          style={styles.closeBtn}
        >
          <Ionicons name="close" size={24} color="#FFFFFF" />
        </Pressable>
      </View>

      {/* Own-story footer: views + viewer list */}
      {isMine ? (
        <Pressable
          onPress={() => setShowViewers(true)}
          accessibilityRole="button"
          accessibilityLabel="See who viewed your story"
          style={[styles.viewsPill, { bottom: insets.bottom + 24 }]}
        >
          <Ionicons name="eye-outline" size={16} color="#FFFFFF" />
          <Text style={styles.viewsText}>{item.views} views</Text>
          <Ionicons name="chevron-up" size={14} color="rgba(255,255,255,0.8)" />
        </Pressable>
      ) : null}

      {showViewers ? <StoryViewersSheet item={item} onClose={() => setShowViewers(false)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  tapRow: { flex: 1, flexDirection: 'row' },
  tapLeft: { flex: 1 },
  tapRight: { flex: 2 },
  progressRow: {
    position: 'absolute',
    left: 12,
    right: 12,
    flexDirection: 'row',
    gap: 4,
  },
  track: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 2, backgroundColor: '#FFFFFF', width: '0%' },
  fillDone: { width: '100%' },
  header: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerText: { flex: 1, gap: 1 },
  headerName: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  headerTime: { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '600' },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewsPill: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
  },
  viewsText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  missing: { flex: 1, alignItems: 'center', gap: 16, paddingHorizontal: 24 },
  missingText: { color: 'rgba(255,255,255,0.8)', fontSize: 15, fontWeight: '600' },
  missingBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
  },
  missingBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
});
