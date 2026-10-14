import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  acceptIncoming,
  decline,
  flipCamera,
  hangUp,
  setMinimized,
  toggleCamera,
  toggleMute,
  toggleSpeaker,
} from '../src/calls/callEngine';
import { useCallStore, type ActiveCall } from '../src/calls/callStore';
import { loadWebRTC } from '../src/calls/native';
import { tintFor } from '../src/api/timeline';
import { Avatar } from '../src/components/ui/Avatar';
import { brand } from '../src/theme/colors';
import { FONT } from '../src/theme/fonts';

/**
 * The call screen — full-screen over everything, presented by `CallHost`
 * (src/components/calls/CallHost.tsx) whenever a call starts or rings.
 *
 * Always dark, whatever the app theme: it's a screen you hold to your face or
 * watch video on, and a white flash at the ear is nobody's idea of a call.
 *
 * Leaving it (the chevron, a swipe, Android back) doesn't end the call — it
 * minimises it to the pill `CallHost` draws over the app. Only the red button
 * hangs up.
 */
export default function CallScreen() {
  const call = useCallStore((s) => s.call);
  const insets = useSafeAreaInsets();

  // Any way out of this screen while the call is live is a minimise.
  useEffect(
    () => () => {
      const current = useCallStore.getState().call;
      if (current && current.phase !== 'ended') setMinimized(true);
    },
    [],
  );

  if (!call) return <View style={styles.root} />;

  const RTCView = loadWebRTC()?.RTCView;
  const showRemoteVideo =
    call.type === 'video' &&
    !!call.remoteStreamURL &&
    call.remoteCameraOn &&
    call.remoteVideoFlowing &&
    call.phase !== 'ended';
  const showLocalVideo = call.type === 'video' && !!call.localStreamURL && call.cameraOn;
  const firstName = call.peer.name.split(' ')[0] ?? call.peer.name;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      {showRemoteVideo && RTCView ? (
        <RTCView streamURL={call.remoteStreamURL!} objectFit="cover" style={StyleSheet.absoluteFill} zOrder={0} />
      ) : (
        <LinearGradient
          colors={[brand.indigo, '#0B0820', '#000000']}
          locations={[0, 0.6, 1]}
          style={StyleSheet.absoluteFill}
        />
      )}
      {/* Keeps the white text legible over bright video. */}
      {showRemoteVideo ? (
        <LinearGradient
          colors={['rgba(0,0,0,0.55)', 'transparent', 'transparent', 'rgba(0,0,0,0.6)']}
          locations={[0, 0.25, 0.65, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      ) : null}

      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        {call.phase !== 'incoming' && call.phase !== 'ended' ? (
          <Pressable
            onPress={() => {
              setMinimized(true);
              if (router.canGoBack()) router.back();
              else router.replace('/home');
            }}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Minimise call"
            style={styles.topButton}
          >
            <Ionicons name="chevron-down" size={26} color="#FFFFFF" />
          </Pressable>
        ) : (
          <View style={styles.topButton} />
        )}
        <Text style={styles.topLabel}>
          {call.type === 'video' ? 'Payhankey video call' : 'Payhankey voice call'}
        </Text>
        <View style={styles.topButton} />
      </View>

      {/* Who and what's happening */}
      <View style={[styles.identity, showRemoteVideo && styles.identityOverVideo]}>
        {!showRemoteVideo ? (
          <View style={styles.avatarRing}>
            <Avatar
              userId={call.peer.id}
              level={call.peer.level}
              name={call.peer.name}
              tint={tintFor(call.peer.id)}
              uri={call.peer.avatar}
              size={120}
            />
          </View>
        ) : null}
        <Text style={[styles.name, showRemoteVideo && styles.nameSmall]} numberOfLines={1}>
          {call.peer.name}
        </Text>
        <CallStatus call={call} />
        {call.remoteMuted && call.phase !== 'ended' ? (
          <View style={styles.chip}>
            <Ionicons name="mic-off" size={13} color="#FFFFFF" />
            <Text style={styles.chipText}>{firstName} is muted</Text>
          </View>
        ) : null}
        {call.type === 'video' && call.cameraUnavailable && call.phase !== 'ended' ? (
          <View style={styles.chip}>
            <Ionicons name="videocam-off" size={13} color="#FFFFFF" />
            <Text style={styles.chipText}>No camera available — you’re on audio</Text>
          </View>
        ) : null}
        {call.type === 'video' &&
        !call.remoteCameraOn &&
        (call.phase === 'connected' || call.phase === 'reconnecting') ? (
          <View style={styles.chip}>
            <Ionicons name="videocam-off" size={13} color="#FFFFFF" />
            <Text style={styles.chipText}>{firstName}’s camera is off</Text>
          </View>
        ) : null}
      </View>

      {/* Your own camera, picture-in-picture */}
      {showLocalVideo && RTCView ? (
        <View style={[styles.selfView, { top: insets.top + 60 }]}>
          <RTCView
            streamURL={call.localStreamURL!}
            objectFit="cover"
            mirror={call.frontCamera}
            zOrder={1}
            style={StyleSheet.absoluteFill}
          />
        </View>
      ) : null}

      {/* Controls */}
      <View style={[styles.controls, { paddingBottom: insets.bottom + 28 }]}>
        {call.phase === 'incoming' ? (
          <View style={styles.answerRow}>
            <RoundButton
              icon="call"
              label="Decline"
              color="#EF4444"
              rotate
              onPress={decline}
            />
            <RoundButton
              icon={call.type === 'video' ? 'videocam' : 'call'}
              label="Accept"
              color={brand.mint}
              onPress={() => void acceptIncoming()}
            />
          </View>
        ) : call.phase === 'ended' ? null : (
          <>
            <View style={styles.toggleRow}>
              <ToggleButton
                icon={call.muted ? 'mic-off' : 'mic-outline'}
                label={call.muted ? 'Unmute' : 'Mute'}
                active={call.muted}
                onPress={toggleMute}
              />
              <ToggleButton
                icon={call.speaker ? 'volume-high' : 'volume-medium-outline'}
                label="Speaker"
                active={call.speaker}
                onPress={toggleSpeaker}
              />
              {call.type === 'video' ? (
                <>
                  <ToggleButton
                    icon={call.cameraOn ? 'videocam-outline' : 'videocam-off'}
                    label={call.cameraOn ? 'Camera' : 'Camera off'}
                    active={!call.cameraOn}
                    disabled={call.cameraUnavailable}
                    onPress={toggleCamera}
                  />
                  <ToggleButton
                    icon="camera-reverse-outline"
                    label="Flip"
                    disabled={!call.cameraOn || call.cameraUnavailable}
                    onPress={flipCamera}
                  />
                </>
              ) : null}
            </View>
            <RoundButton icon="call" label="End" color="#EF4444" rotate onPress={() => hangUp()} />
          </>
        )}
      </View>
    </View>
  );
}

/** "Calling…", "Ringing…", the running clock, or why it ended. */
function CallStatus({ call }: { call: ActiveCall }) {
  const [now, setNow] = useState(Date.now());
  const ticking = !!call.connectedAt && (call.phase === 'connected' || call.phase === 'reconnecting');
  useEffect(() => {
    if (!ticking) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [ticking]);

  let text: string;
  switch (call.phase) {
    case 'outgoing':
      text = call.ringing ? 'Ringing…' : 'Calling…';
      break;
    case 'incoming':
      text = call.type === 'video' ? 'Incoming video call' : 'Incoming voice call';
      break;
    case 'connecting':
      text = 'Connecting…';
      break;
    case 'reconnecting':
      text = 'Reconnecting…';
      break;
    case 'connected':
      text = clock(now - (call.connectedAt ?? now));
      break;
    default:
      text = call.endedReason ?? 'Call ended';
  }
  return (
    <Text style={styles.status} accessibilityLiveRegion="polite">
      {text}
    </Text>
  );
}

function clock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(h ? 2 : 1, '0');
  const ss = String(s).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function RoundButton({
  icon,
  label,
  color,
  rotate,
  onPress,
}: {
  icon: IconName;
  label: string;
  color: string;
  rotate?: boolean;
  onPress: () => void;
}) {
  return (
    <View style={styles.buttonWrap}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => [styles.round, { backgroundColor: color, opacity: pressed ? 0.8 : 1 }]}
      >
        <Ionicons
          name={icon}
          size={30}
          color="#FFFFFF"
          style={rotate ? { transform: [{ rotate: '135deg' }] } : undefined}
        />
      </Pressable>
      <Text style={styles.buttonLabel}>{label}</Text>
    </View>
  );
}

function ToggleButton({
  icon,
  label,
  active,
  disabled,
  onPress,
}: {
  icon: IconName;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <View style={[styles.buttonWrap, disabled && styles.disabled]}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected: !!active, disabled: !!disabled }}
        style={({ pressed }) => [
          styles.toggle,
          {
            backgroundColor: active ? '#FFFFFF' : 'rgba(255,255,255,0.16)',
            opacity: pressed ? 0.75 : 1,
          },
        ]}
      >
        <Ionicons name={icon} size={24} color={active ? brand.ink : '#FFFFFF'} />
      </Pressable>
      <Text style={styles.buttonLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  topButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topLabel: {
    fontFamily: FONT,
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 0.3,
  },
  identity: { alignItems: 'center', paddingHorizontal: 32, marginTop: 56, gap: 6 },
  identityOverVideo: { marginTop: 8 },
  avatarRing: {
    padding: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginBottom: 14,
  },
  name: { fontFamily: FONT, fontSize: 28, fontWeight: '800', color: '#FFFFFF', textAlign: 'center' },
  nameSmall: { fontSize: 20 },
  status: {
    fontFamily: FONT,
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.78)',
    fontVariant: ['tabular-nums'],
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  chipText: { fontFamily: FONT, fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  selfView: {
    position: 'absolute',
    right: 16,
    width: 108,
    height: 160,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#1F1A3A',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  controls: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', gap: 28 },
  answerRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', paddingHorizontal: 56 },
  toggleRow: { flexDirection: 'row', justifyContent: 'center', gap: 18, paddingHorizontal: 16 },
  buttonWrap: { alignItems: 'center', gap: 8 },
  disabled: { opacity: 0.4 },
  round: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  toggle: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  buttonLabel: { fontFamily: FONT, fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.85)' },
});
