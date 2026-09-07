import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewToken,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  recordRollPlay,
  recordRollWatch,
  toRoll,
  type Roll,
} from '../../src/api/rolls';
import { RollCommentsSheet } from '../../src/components/rolls/RollCommentsSheet';
import { Avatar } from '../../src/components/ui/Avatar';
import { GhostButton } from '../../src/components/ui/GhostButton';
import { useRollsFeed } from '../../src/hooks/useRolls';
import { useToggleLike } from '../../src/hooks/useTimeline';
import { useToggleFollow } from '../../src/hooks/useUser';
import { useAuthStore } from '../../src/stores/authStore';
import { useEngagementStore } from '../../src/stores/engagementStore';
import { useFollowStore } from '../../src/stores/followStore';
import { FONT } from '../../src/theme/fonts';

/**
 * Rolls — Payhankey's short-form video, a TikTok/IG-style vertical pager backed
 * by GET /rolls. Each page is a full-bleed looping video: caption bottom-left,
 * action rail bottom-right, mute and an ellipsis menu (with Clear view)
 * top-right. Tap pauses; in clear view a tap brings the overlays back.
 *
 * Likes reuse the timeline's optimistic toggle — a roll's `post_id` is the same
 * post the feed likes, so the two surfaces stay in sync through the engagement
 * store. Comments are read-only for now: GET /rolls/{id}/comments exists but
 * there's no roll-comment write endpoint.
 */

/**
 * How many pages of the randomised feed to walk looking for a roll opened by id
 * or by post. Bounded so a video that simply isn't in Rolls can't march through
 * the whole catalogue.
 */
const MAX_SEEK_PAGES = 5;

/**
 * Read `player.currentTime` without ever throwing.
 *
 * `expo-video` releases a player's **native** object when its owner unmounts,
 * and the JS handle outlives it — touching one afterwards throws
 * `NativeSharedObjectNotFoundException` ("Unable to find the native shared
 * object associated with given JavaScript object"), which surfaces as a red
 * render error over the pager.
 *
 * The pager unmounts rolls constantly (`windowSize={3}`), so a sampling
 * interval or an effect cleanup can easily land on the far side of a release.
 * Telemetry must never interrupt playback — the same rule the `/play` and
 * `/watch` calls already follow — so every access goes through here and a
 * released player simply reports nothing.
 */
function readCurrentTime(player: { currentTime: number }): number | null {
  try {
    const value = player.currentTime;
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

/** Same guard, for the writes and transport calls. */
function withPlayer(run: () => void) {
  try {
    run();
  } catch {
    // The player was released — nothing to drive any more.
  }
}

function formatCount(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K` : `${n}`;
}

type RollItemProps = {
  roll: Roll;
  active: boolean;
  muted: boolean;
  clearView: boolean;
  onToggleMute: () => void;
  onOpenMenu: () => void;
  onEnterClearView: () => void;
  onExitClearView: () => void;
  onOpenComments: () => void;
  onBack: () => void;
};

function RollItem({
  roll,
  active,
  muted,
  clearView,
  onToggleMute,
  onOpenMenu,
  onEnterClearView,
  onExitClearView,
  onOpenComments,
  onBack,
}: RollItemProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [paused, setPaused] = useState(false);

  // Likes go through the timeline mutation against the roll's post_id, so a
  // like here and a like in the feed are the same like.
  const toggleLike = useToggleLike();
  const storeLiked = useEngagementStore((s) => s.liked[roll.postId]);
  const liked = storeLiked ?? roll.likedByViewer;

  // The rolls list isn't refetched after a comment, so the rail count carries
  // this session's own comments on top of the server's number.
  const myCommentCount = useEngagementStore((s) => s.myComments[roll.postId]?.length ?? 0);
  useEffect(() => {
    useEngagementStore.getState().seedLiked(roll.postId, roll.likedByViewer);
  }, [roll.postId, roll.likedByViewer]);

  // You can't follow yourself — hide the button on your own rolls.
  const myUserId = useAuthStore((s) => s.user?.id);
  const isMine = roll.author.id === myUserId;

  const toggleFollow = useToggleFollow();
  const storedFollowing = useFollowStore((s) => s.following[roll.author.id]);
  const setStoredFollowing = useFollowStore((s) => s.setFollowing);
  const following = storedFollowing ?? roll.following;
  useEffect(() => {
    if (roll.following) setStoredFollowing(roll.author.id, true);
  }, [roll.author.id, roll.following, setStoredFollowing]);

  const onFollow = () => {
    if (toggleFollow.isPending) return;
    const next = !following;
    setStoredFollowing(roll.author.id, next);
    toggleFollow.mutate(roll.author.id, {
      onSuccess: (data) => setStoredFollowing(roll.author.id, data.following),
      onError: () => setStoredFollowing(roll.author.id, !next),
    });
  };

  // `roll.uri` is null when no rendition plays on this platform (the backend
  // currently emits WebM, which iOS can't decode) — the poster stands in.
  const player = useVideoPlayer(roll.uri, (p) => {
    p.loop = true;
    // Start muted everywhere so autoplay never gets blocked (web policy);
    // the speaker button unmutes on a real user gesture.
    p.muted = true;
  });

  useEffect(() => {
    if (!roll.uri) return;
    withPlayer(() => {
      player.muted = muted;
      if (active && !paused) player.play();
      else player.pause();
    });
  }, [player, active, paused, muted, roll.uri]);

  // Scrolling away resets the manual pause so the roll plays on return.
  useEffect(() => {
    if (!active) setPaused(false);
  }, [active]);

  // --- Play count & watch time -------------------------------------------
  // POST /rolls/{id}/play once, the first time this roll actually starts, and
  // POST /rolls/{id}/watch with the seconds watched whenever playback stops —
  // a pause, a swipe away, or the page unmounting. Both calls swallow their own
  // errors (see src/api/rolls.ts): telemetry must never interrupt playback.
  const playSent = useRef(false);
  const watchSent = useRef(false);
  /** Seconds watched but not yet reported. */
  const watched = useRef(0);
  /** `player.currentTime` at the previous sample. */
  const lastTime = useRef<number | null>(null);

  useEffect(() => {
    playSent.current = false;
    watchSent.current = false;
    watched.current = 0;
  }, [roll.id]);

  const flushWatch = useCallback(() => {
    const seconds = watched.current;
    watched.current = 0;
    // Sub-second blips are scroll noise, not viewing.
    if (seconds < 0.5) return;
    const isFirstPlay = !watchSent.current;
    watchSent.current = true;
    void recordRollWatch(roll.id, seconds, isFirstPlay);
  }, [roll.id]);

  // Nothing plays when `roll.uri` is null (a format this platform can't decode),
  // so there is no play to report either.
  const isPlaying = active && !paused && !!roll.uri;

  useEffect(() => {
    if (!isPlaying) return;
    if (!playSent.current) {
      playSent.current = true;
      void recordRollPlay(roll.id);
    }
    // Time comes from the player's own clock rather than wall time, so a
    // backgrounded app doesn't keep accruing seconds nobody watched.
    lastTime.current = readCurrentTime(player);
    const sample = () => {
      const now = readCurrentTime(player);
      // Released player: there is no clock left to read, so stop accruing and
      // keep whatever was measured up to this point.
      if (now == null) return;
      const previous = lastTime.current ?? now;
      // Rolls loop, and a loop rewinds the clock — a negative delta means the
      // video wrapped, so the new position *is* the elapsed time.
      watched.current += now >= previous ? now - previous : now;
      lastTime.current = now;
    };
    const timer = setInterval(sample, 500);
    return () => {
      clearInterval(timer);
      // One last sample so the seconds since the previous tick aren't lost.
      // Guarded like the rest: on unmount the player may already be gone.
      sample();
      lastTime.current = null;
      flushWatch();
    };
  }, [isPlaying, player, roll.id, flushWatch]);

  // Double-tap likes, the way every short-form player does. A single tap has to
  // wait out the double-tap window before it can pause, otherwise the first tap
  // of a double would pause the video underneath the heart.
  const DOUBLE_TAP_MS = 260;
  const lastTap = useRef(0);
  const singleTap = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heart = useRef(new Animated.Value(0)).current;

  useEffect(() => () => {
    if (singleTap.current) clearTimeout(singleTap.current);
  }, []);

  const runSingleTap = () => {
    // In clear view a tap restores the overlays instead of pausing.
    if (clearView) onExitClearView();
    else if (roll.uri) setPaused((p) => !p);
  };

  const onDoubleTap = () => {
    // Double tap only ever *adds* a like — it never unlikes, so a second
    // double tap isn't a silent undo.
    if (!liked) toggleLike.mutate(roll.postId);
    heart.setValue(0);
    Animated.sequence([
      Animated.spring(heart, { toValue: 1, useNativeDriver: true, friction: 4, tension: 90 }),
      Animated.timing(heart, { toValue: 0, duration: 320, delay: 260, useNativeDriver: true }),
    ]).start();
  };

  const onTapVideo = () => {
    const now = Date.now();
    if (now - lastTap.current < DOUBLE_TAP_MS) {
      if (singleTap.current) clearTimeout(singleTap.current);
      singleTap.current = null;
      lastTap.current = 0;
      onDoubleTap();
      return;
    }
    lastTap.current = now;
    singleTap.current = setTimeout(runSingleTap, DOUBLE_TAP_MS);
  };

  // Long press is the quick way into clear view — the same thing the ellipsis
  // menu's "Clear view" does, without the two taps. A tap brings the chrome
  // back, so there's no need to handle long press again once we're in it.
  const onLongPressVideo = () => {
    if (!clearView) onEnterClearView();
  };

  return (
    <View style={styles.page}>
      {roll.uri ? (
        <VideoView
          player={player}
          style={styles.video}
          contentFit="cover"
          nativeControls={false}
        />
      ) : (
        <>
          {roll.poster ? (
            <Image
              source={{ uri: roll.poster }}
              style={styles.video}
              contentFit="cover"
              transition={200}
            />
          ) : null}
          {!clearView ? (
            <View pointerEvents="none" style={styles.unplayable}>
              <Ionicons name="alert-circle-outline" size={26} color="rgba(255,255,255,0.9)" />
              <Text style={styles.unplayableText}>
                {roll.unplayableFormat
                  ? "This video's format isn't supported on iOS yet"
                  : 'Video unavailable'}
              </Text>
            </View>
          ) : null}
        </>
      )}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onTapVideo}
        onLongPress={onLongPressVideo}
        delayLongPress={300}
        accessibilityLabel="Toggle playback"
      />

      {paused ? (
        <View pointerEvents="none" style={styles.pausedBadge}>
          <Ionicons name="play" size={44} color="rgba(255,255,255,0.85)" />
        </View>
      ) : null}

      {/* Double-tap heart */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.burst,
          {
            opacity: heart,
            transform: [
              { scale: heart.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.15] }) },
            ],
          },
        ]}
      >
        <Ionicons name="heart" size={110} color="rgba(244,63,94,0.92)" />
      </Animated.View>

      {!clearView ? (
        <>
          {/* Top bar */}
          <View style={[styles.topBar, { top: insets.top + 12 }]}>
            <View style={styles.topLead}>
              {/* The tab bar is hidden on this screen, so this is the only way
                  out of the pager. */}
              <Pressable
                onPress={onBack}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Go back"
                style={styles.topBtn}
              >
                <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
              </Pressable>
              <Text style={styles.topTitle}>Rolls</Text>
            </View>
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
          <View style={[styles.infoCol, { bottom: insets.bottom + 22 }]}>
            <View style={styles.authorRow}>
              <Pressable
                onPress={() => router.push(`/member/${roll.author.handle}`)}
                accessibilityRole="button"
                accessibilityLabel={`View ${roll.author.name}'s profile`}
                style={styles.authorTap}
              >
                <Avatar name={roll.author.name} tint={roll.author.tint} size={34} />
                <Text style={styles.authorName}>@{roll.author.handle}</Text>
              </Pressable>
              {isMine ? null : (
                <Pressable
                  onPress={onFollow}
                  accessibilityRole="button"
                  accessibilityLabel={
                    following ? `Unfollow ${roll.author.name}` : `Follow ${roll.author.name}`
                  }
                  style={[styles.followBtn, following && styles.followingBtn]}
                >
                  <Text style={styles.followText}>{following ? 'Following' : 'Follow'}</Text>
                </Pressable>
              )}
            </View>
            <Text style={styles.caption} numberOfLines={2}>
              {roll.caption}
            </Text>
            {roll.hashtags.length ? (
              <Text style={styles.tags} numberOfLines={1}>
                {roll.hashtags.map((t) => `#${t}`).join(' ')}
              </Text>
            ) : null}
            <View style={styles.audioRow}>
              <Ionicons name="eye-outline" size={13} color="#FFFFFF" />
              <Text style={styles.audio} numberOfLines={1}>
                {formatCount(roll.views)} views
              </Text>
            </View>
          </View>

          {/* Bottom-right: action rail */}
          <View style={[styles.rail, { bottom: insets.bottom + 22 }]}>
            <Pressable
              onPress={() => toggleLike.mutate(roll.postId)}
              accessibilityRole="button"
              accessibilityLabel={liked ? 'Unlike' : 'Like'}
              style={styles.railBtn}
            >
              <Ionicons name={liked ? 'heart' : 'heart-outline'} size={30} color={liked ? '#F43F5E' : '#FFFFFF'} />
              <Text style={styles.railText}>
                {formatCount(roll.likes + (liked && !roll.likedByViewer ? 1 : 0))}
              </Text>
            </Pressable>
            <Pressable
              onPress={onOpenComments}
              accessibilityRole="button"
              accessibilityLabel="Comments"
              style={styles.railBtn}
            >
              <Ionicons name="chatbubble-outline" size={28} color="#FFFFFF" />
              <Text style={styles.railText}>{formatCount(roll.comments + myCommentCount)}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Share" style={styles.railBtn}>
              <Ionicons name="arrow-redo-outline" size={28} color="#FFFFFF" />
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

export default function RollsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Two ways in besides the tab itself:
  //   ?start=<videoId> — Discover's "Popular Rolls" rail, which already knows
  //     the video id.
  //   ?post=<postId>   — a video post tapped in the timeline. The feed only
  //     knows the *post*, because no post endpoint carries the roll's
  //     `video_id` and no route resolves one to the other (`/rolls/{postId}`
  //     404s, `?post_id=` is ignored). So the pager finds it itself, below.
  // Either way the pager opens on that roll and keeps paging the rest of the
  // feed from there, rather than acting as a one-off detail screen.
  const { start, post } = useLocalSearchParams<{ start?: string; post?: string }>();

  // The tab bar is hidden here, so the header's back button is the only exit.
  // Rolls is a tab rather than a pushed route, so there isn't always something
  // to pop — fall back to Home.
  const onBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/home');
  }, [router]);

  const feed = useRollsFeed();
  const rolls = useMemo(
    () => feed.data?.pages.flatMap((page) => page.data.map(toRoll)) ?? [],
    [feed.data],
  );

  const loadMore = useCallback(() => {
    if (feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage();
  }, [feed]);

  const [pageHeight, setPageHeight] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [focused, setFocused] = useState(true);
  const [muted, setMuted] = useState(true);
  const [clearView, setClearView] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [commentsFor, setCommentsFor] = useState<{ videoId: string; postId: string; count: number } | null>(
    null,
  );

  // Where the pager opens. FlatList reads `initialScrollIndex` on mount only,
  // and the list doesn't mount until the target has been resolved, so
  // recomputing this as later pages arrive can't yank the user back.
  const targetIndex = useMemo(() => {
    if (start) return rolls.findIndex((r) => r.id === start);
    if (post) return rolls.findIndex((r) => r.postId === post);
    return 0;
  }, [start, post, rolls]);
  const startIndex = targetIndex > 0 ? targetIndex : 0;

  /**
   * **Rolls is a tab, so the screen stays mounted** once it has been opened —
   * arriving a second time with a different `?post=`/`?start=` changes the
   * params but remounts nothing, and `initialScrollIndex` is only ever read on
   * mount. Without this, a second video tapped in the timeline would open the
   * pager on whatever the first one left on screen.
   *
   * So the seek is also done imperatively, keyed on the target itself: it runs
   * once per distinct param and never again, which is what keeps it from
   * fighting the user's own scrolling afterwards.
   */
  const listRef = useRef<FlatList<Roll>>(null);
  const seekedTo = useRef<string | null>(null);
  const seekTarget = start ?? post ?? null;
  useEffect(() => {
    if (!seekTarget || targetIndex < 0) return;
    if (seekedTo.current === seekTarget) return;
    // The list has to exist and know its page height before it can scroll.
    if (!pageHeight) return;
    seekedTo.current = seekTarget;
    setActiveIndex(targetIndex);
    listRef.current?.scrollToIndex({ index: targetIndex, animated: false });
  }, [seekTarget, targetIndex, pageHeight]);

  // A roll arrived at by id may not be on the first page, and the feed is
  // randomised, so there's no page it's guaranteed to be on. Walk forward a
  // bounded number of pages looking for it; past the cap the pager gives up and
  // says so rather than silently opening on a different video.
  const seeking = !!(start || post) && targetIndex < 0;
  const pagesWalked = useRef(0);
  useEffect(() => {
    if (!seeking) return;
    if (pagesWalked.current >= MAX_SEEK_PAGES) return;
    if (!feed.hasNextPage || feed.isFetchingNextPage) return;
    pagesWalked.current += 1;
    void feed.fetchNextPage();
  }, [seeking, feed]);

  // Out of pages (or out of patience) and still nothing — the handoff failed.
  const seekFailed = seeking && (!feed.hasNextPage || pagesWalked.current >= MAX_SEEK_PAGES);

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
      {feed.isLoading ? (
        <View style={styles.stateWrap}>
          <ActivityIndicator color="#FFFFFF" />
        </View>
      ) : feed.isError ? (
        <View style={styles.stateWrap}>
          <Text style={styles.stateText}>We couldn't load Rolls.</Text>
          <GhostButton label="Retry" onPress={() => void feed.refetch()} />
        </View>
      ) : rolls.length === 0 ? (
        <View style={styles.stateWrap}>
          <Ionicons name="film-outline" size={34} color="rgba(255,255,255,0.6)" />
          <Text style={styles.stateText}>No rolls yet.</Text>
        </View>
      ) : seekFailed ? (
        // Opening on an arbitrary video would be worse than saying nothing was
        // found — the user tapped one specific thing.
        <View style={styles.stateWrap}>
          <Ionicons name="videocam-off-outline" size={34} color="rgba(255,255,255,0.6)" />
          <Text style={styles.stateText}>We couldn't find that video in Rolls.</Text>
          <GhostButton label="Back" onPress={onBack} />
        </View>
      ) : seeking ? (
        <View style={styles.stateWrap}>
          <ActivityIndicator color="#FFFFFF" />
          <Text style={styles.stateText}>Finding that video…</Text>
        </View>
      ) : pageHeight > 0 ? (
        <FlatList
          ref={listRef}
          data={rolls}
          keyExtractor={(roll) => roll.id}
          renderItem={({ item, index }) => (
            <View style={{ height: pageHeight }}>
              <RollItem
                roll={item}
                active={focused && index === activeIndex}
                muted={muted}
                clearView={clearView}
                onToggleMute={() => setMuted((m) => !m)}
                onOpenMenu={() => setMenuOpen(true)}
                onEnterClearView={() => setClearView(true)}
                onExitClearView={() => setClearView(false)}
                onOpenComments={() =>
                  setCommentsFor({
                    videoId: item.id,
                    postId: item.postId,
                    count: item.comments,
                  })
                }
                onBack={onBack}
              />
            </View>
          )}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          decelerationRate="fast"
          windowSize={3}
          initialScrollIndex={startIndex}
          getItemLayout={(_, index) => ({
            length: pageHeight,
            offset: pageHeight * index,
            index,
          })}
          onEndReached={loadMore}
          onEndReachedThreshold={1.5}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
        />
      ) : null}

      {/* Comments — a sheet over the still-playing video, not a screen push. */}
      {commentsFor ? (
        <RollCommentsSheet
          videoId={commentsFor.videoId}
          postId={commentsFor.postId}
          count={commentsFor.count}
          onClose={() => setCommentsFor(null)}
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
            style={[styles.menuSheet, { paddingBottom: insets.bottom + 16 }]}
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
  stateWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingHorizontal: 32,
  },
  stateText: {
    fontFamily: FONT,
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  unplayable: {
    position: 'absolute',
    left: 28,
    right: 28,
    top: '44%',
    alignItems: 'center',
    gap: 8,
    // Posters are busy — without a scrim the notice is unreadable on top of one.
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 16,
    backgroundColor: 'rgba(10,7,26,0.72)',
  },
  unplayableText: {
    fontFamily: FONT,
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
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
  burst: {
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
  topLead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  topTitle: { fontFamily: FONT, color: '#FFFFFF', fontSize: 19, fontWeight: '900' },
  topActions: { flexDirection: 'row', gap: 10 },
  topBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Rolls hides the tab bar, so the overlays sit on the safe-area inset
  // instead of clearing TAB_BAR_CLEARANCE — `bottom` is applied inline.
  infoCol: {
    position: 'absolute',
    left: 16,
    right: 86,
    gap: 7,
  },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  authorTap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  authorName: { fontFamily: FONT, color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  followBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  followingBtn: { borderColor: 'rgba(255,255,255,0.35)' },
  followText: { fontFamily: FONT, color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  caption: { fontFamily: FONT, color: '#FFFFFF', fontSize: 14, lineHeight: 19, fontWeight: '500' },
  tags: { fontFamily: FONT, color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  audioRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  audio: { fontFamily: FONT, color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600', flex: 1 },
  rail: {
    position: 'absolute',
    right: 12,
    alignItems: 'center',
    gap: 18,
  },
  railBtn: { alignItems: 'center', gap: 3 },
  railText: { fontFamily: FONT, color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
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
  menuLabel: { fontFamily: FONT, color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
