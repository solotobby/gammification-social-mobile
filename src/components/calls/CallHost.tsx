import { Ionicons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { setShowOverLockScreen } from '../../../modules/call-lock-screen';
import { setMinimized } from '../../calls/callEngine';
import { useCallStore } from '../../calls/callStore';
import { brand } from '../../theme/colors';
import { FONT } from '../../theme/fonts';

/**
 * Presents calls. Mounted once in app/_layout.tsx, above every screen, while
 * signed in.
 *
 * - A call that starts (we dial) or rings (they dial) opens `/call` from
 *   wherever the user is — including over a modal like /compose.
 * - When the call is cleared, `/call` closes itself.
 * - A minimised call (the user left `/call` mid-call) shows a green pill near
 *   the top of every screen, below the header; tapping it goes back. A ringing call is never
 *   left minimised — it reopens, because it's waiting on an answer.
 */
export function CallHost() {
  const call = useCallStore((s) => s.call);
  const pathname = usePathname();
  const onCallScreen = pathname === '/call';
  const insets = useSafeAreaInsets();

  const active = !!call && call.phase !== 'ended';
  const wantsScreen = !!call && (!call.minimized || call.phase === 'incoming');

  // A call — ringing or live — shows over the lock screen and wakes it, so an
  // incoming call opened by its full-screen notification is actually seen.
  // Off again the moment the call is over, or the app would sit on top of the
  // lock screen whenever it happened to be open when the phone locked. Not
  // cleared on mount: a call's full-screen launch sets it natively before
  // this mounts, and useCallNotifications takes it back if no call follows.
  const wasActive = useRef(false);
  useEffect(() => {
    if (active) setShowOverLockScreen(true);
    else if (wasActive.current) setShowOverLockScreen(false);
    wasActive.current = active;
  }, [active]);

  useEffect(() => {
    if (wantsScreen && !onCallScreen && call?.phase !== 'ended') {
      if (call?.minimized) setMinimized(false);
      router.push('/call');
    }
    // Keyed on identity + phase only: re-presenting on every patch would fight
    // the user's own navigation.
  }, [call?.id, call?.phase, wantsScreen]);

  useEffect(() => {
    if (!call && onCallScreen) {
      if (router.canGoBack()) router.back();
      else router.replace('/home');
    }
  }, [call, onCallScreen]);

  if (!active || onCallScreen || !call.minimized) return null;

  return (
    <Pressable
      onPress={() => {
        setMinimized(false);
        router.push('/call');
      }}
      accessibilityRole="button"
      accessibilityLabel={`Return to your call with ${call.peer.name}`}
      // Just under where screen headers end, so it floats over scrolling
      // content rather than covering a back button or a header action.
      style={[styles.pill, { top: insets.top + PILL_OFFSET }]}
    >
      <Ionicons name={call.type === 'video' ? 'videocam' : 'call'} size={15} color="#FFFFFF" />
      <Text style={styles.pillText} numberOfLines={1}>
        {call.peer.name.split(' ')[0]} · <PillStatus connectedAt={call.connectedAt} phase={call.phase} />
      </Text>
      <Text style={styles.pillHint}>Tap to return</Text>
    </Pressable>
  );
}

function PillStatus({ connectedAt, phase }: { connectedAt: number | null; phase: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!connectedAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [connectedAt]);
  if (phase === 'reconnecting') return <>Reconnecting…</>;
  if (!connectedAt) return <>{phase === 'outgoing' ? 'Calling…' : 'Connecting…'}</>;
  const total = Math.floor((now - connectedAt) / 1000);
  return (
    <>
      {Math.floor(total / 60)}:{String(total % 60).padStart(2, '0')}
    </>
  );
}

/** Headers in this app run ~58pt below the safe area (avatar row + padding). */
const PILL_OFFSET = 66;

const styles = StyleSheet.create({
  pill: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    height: 36,
    borderRadius: 18,
    backgroundColor: brand.mint,
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
    maxWidth: '92%',
  },
  pillText: {
    fontFamily: FONT,
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
    flexShrink: 1,
  },
  pillHint: { fontFamily: FONT, fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.85)' },
});
