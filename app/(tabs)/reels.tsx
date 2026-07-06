import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewToken,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TAB_BAR_CLEARANCE } from '../../src/components/navigation/TabBar';
import { Avatar } from '../../src/components/ui/Avatar';
import { isFollowing, toggleFollow } from '../../src/data/community';
import { reels, type Reel } from '../../src/data/reels';

/**
 * Reels — TikTok/IG-style vertical pager. Each page is a full-bleed looping
 * video: caption + audio line bottom-left, action rail bottom-right, mute and
 * an ellipsis menu (with Clear view) top-right. Tap pauses; in clear view a
 * tap brings the overlays back.
 */

function formatCount(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K` : `${n}`;
}

type ReelItemProps = {
  reel: Reel;
  active: boolean;
  muted: boolean;
  clearView: boolean;
  onToggleMute: () => void;
  onOpenMenu: () => void;
  onExitClearView: () => void;
};

function ReelItem({
  reel,
  active,
  muted,
  clearView,
  onToggleMute,
  onOpenMenu,
  onExitClearView,
}: ReelItemProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [paused, setPaused] = useState(false);
  const [liked, setLiked] = useState(false);
  const [following, setFollowing] = useState(() => isFollowing(reel.author.id));

  const player = useVideoPlayer(reel.uri, (p) => {
    p.loop = true;
    // Start muted everywhere so autoplay never gets blocked (web policy);
    // the speaker button unmutes on a real user gesture.
    p.muted = true;
  });

  useEffect(() => {
    player.muted = muted;
    if (active && !paused) player.play();
    else player.pause();
  }, [player, active, paused, muted]);

  // Scrolling away resets the manual pause so the reel plays on return.
  useEffect(() => {
    if (!active) setPaused(false);
  }, [active]);

  const onTapVideo = () => {
    // In clear view a tap restores the overlays instead of pausing.
    if (clearView) onExitClearView();
    else setPaused((p) => !p);
  };

  return (
    <View style={styles.page}>
      <VideoView
        player={player}
        style={styles.video}
        contentFit="cover"
        nativeControls={false}
      />
      <Pressable style={StyleSheet.absoluteFill} onPress={onTapVideo} accessibilityLabel="Toggle playback" />

      {paused ? (
        <View pointerEvents="none" style={styles.pausedBadge}>
          <Ionicons name="play" size={44} color="rgba(255,255,255,0.85)" />
        </View>
      ) : null}

      {!clearView ? (
        <>
          {/* Top bar */}
          <View style={[styles.topBar, { top: insets.top + 12 }]}>
            <Text style={styles.topTitle}>Reels</Text>
            <View style={styles.topActions}>
              <Pressable
                onPress={onToggleMute}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={muted ? 'Unmute' : 'Mute'}
                style={styles.topBtn}
              >
                <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={20} color="#FFFFFF" />
              </Pressable>
              <Pressable
                onPress={onOpenMenu}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="More options"
                style={styles.topBtn}
              >
                <Ionicons name="ellipsis-horizontal" size={20} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>

          {/* Bottom-left: author + caption + audio */}
          <View style={styles.infoCol}>
            <View style={styles.authorRow}>
              <Pressable
                onPress={() => router.push(`/member/${reel.author.handle}`)}
                accessibilityRole="button"
                accessibilityLabel={`View ${reel.author.name}'s profile`}
                style={styles.authorTap}
              >
                <Avatar name={reel.author.name} tint={reel.author.tint} size={34} />
                <Text style={styles.authorName}>@{reel.author.handle}</Text>
              </Pressable>
              <Pressable
                onPress={() => setFollowing(toggleFollow(reel.author.id))}
                accessibilityRole="button"
                accessibilityLabel={following ? `Unfollow ${reel.author.name}` : `Follow ${reel.author.name}`}
                style={[styles.followBtn, following && styles.followingBtn]}
              >
                <Text style={styles.followText}>{following ? 'Following' : 'Follow'}</Text>
              </Pressable>
            </View>
            <Text style={styles.caption} numberOfLines={2}>
              {reel.caption}
            </Text>
            <Text style={styles.tags} numberOfLines={1}>
              {reel.hashtags.map((t) => `#${t}`).join(' ')}
            </Text>
            <View style={styles.audioRow}>
              <Ionicons name="musical-notes" size={13} color="#FFFFFF" />
              <Text style={styles.audio} numberOfLines={1}>
                {reel.audio}
              </Text>
            </View>
          </View>

          {/* Bottom-right: action rail */}
          <View style={styles.rail}>
            <Pressable
              onPress={() => setLiked((l) => !l)}
              accessibilityRole="button"
              accessibilityLabel={liked ? 'Unlike' : 'Like'}
              style={styles.railBtn}
            >
              <Ionicons name={liked ? 'heart' : 'heart-outline'} size={30} color={liked ? '#F43F5E' : '#FFFFFF'} />
              <Text style={styles.railText}>{formatCount(reel.likes + (liked ? 1 : 0))}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Comments" style={styles.railBtn}>
              <Ionicons name="chatbubble-outline" size={28} color="#FFFFFF" />
              <Text style={styles.railText}>{formatCount(reel.comments)}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Share" style={styles.railBtn}>
              <Ionicons name="arrow-redo-outline" size={28} color="#FFFFFF" />
              <Text style={styles.railText}>{formatCount(reel.shares)}</Text>
            </Pressable>
          </View>
        </>
      ) : null}
    </View>
  );
}

const MENU_ITEMS: { icon: keyof typeof Ionicons.glyphMap; label: string; key: string }[] = [
  { icon: 'eye-outline', label: 'Clear view', key: 'clear' },
  { icon: 'heart-dislike-outline', label: 'Not interested', key: 'not-interested' },
  { icon: 'link-outline', label: 'Copy link', key: 'copy' },
  { icon: 'flag-outline', label: 'Report', key: 'report' },
];

export default function ReelsScreen() {
  const insets = useSafeAreaInsets();

  const [pageHeight, setPageHeight] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [focused, setFocused] = useState(true);
  const [muted, setMuted] = useState(true);
  const [clearView, setClearView] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Pause everything when the tab loses focus.
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const first = viewableItems.find((v) => v.isViewable);
      if (first?.index != null) setActiveIndex(first.index);
    },
  ).current;
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

  const onMenuAction = (key: string) => {
    setMenuOpen(false);
    if (key === 'clear') setClearView(true);
    // Other actions are dummy for the UI-only phase.
  };

  return (
    <View
      style={styles.root}
      onLayout={(e) => setPageHeight(Math.round(e.nativeEvent.layout.height))}
    >
      {pageHeight > 0 ? (
        <FlatList
          data={reels}
          keyExtractor={(reel) => reel.id}
          renderItem={({ item, index }) => (
            <View style={{ height: pageHeight }}>
              <ReelItem
                reel={item}
                active={focused && index === activeIndex}
                muted={muted}
                clearView={clearView}
                onToggleMute={() => setMuted((m) => !m)}
                onOpenMenu={() => setMenuOpen(true)}
                onExitClearView={() => setClearView(false)}
              />
            </View>
          )}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          decelerationRate="fast"
          windowSize={3}
          getItemLayout={(_, index) => ({
            length: pageHeight,
            offset: pageHeight * index,
            index,
          })}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
        />
      ) : null}

      {/* Ellipsis menu (bottom sheet) */}
      {menuOpen ? (
        <Pressable
          style={styles.menuBackdrop}
          onPress={() => setMenuOpen(false)}
          accessibilityLabel="Close menu"
        >
          <Pressable
            style={[styles.menuSheet, { paddingBottom: insets.bottom + TAB_BAR_CLEARANCE }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.menuHandle} />
            {MENU_ITEMS.map((item) => (
              <Pressable
                key={item.key}
                onPress={() => onMenuAction(item.key)}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                style={({ pressed }) => [styles.menuRow, { opacity: pressed ? 0.6 : 1 }]}
              >
                <Ionicons name={item.icon} size={21} color="#FFFFFF" />
                <Text style={styles.menuLabel}>{item.label}</Text>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  page: { flex: 1, backgroundColor: '#000000' },
  video: { width: '100%', height: '100%' },
  pausedBadge: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topTitle: { color: '#FFFFFF', fontSize: 19, fontWeight: '900' },
  topActions: { flexDirection: 'row', gap: 10 },
  topBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Bottom offsets clear the floating tab bar (TAB_BAR_CLEARANCE ~104).
  infoCol: {
    position: 'absolute',
    left: 16,
    right: 86,
    bottom: 118,
    gap: 7,
  },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  authorTap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  authorName: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  followBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  followingBtn: { borderColor: 'rgba(255,255,255,0.35)' },
  followText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  caption: { color: '#FFFFFF', fontSize: 14, lineHeight: 19, fontWeight: '500' },
  tags: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  audioRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  audio: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600', flex: 1 },
  rail: {
    position: 'absolute',
    right: 12,
    bottom: 118,
    alignItems: 'center',
    gap: 18,
  },
  railBtn: { alignItems: 'center', gap: 3 },
  railText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  menuBackdrop: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  menuSheet: {
    backgroundColor: '#17171C',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  menuHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
    marginBottom: 6,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
  },
  menuLabel: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
