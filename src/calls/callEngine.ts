import { AppState, Platform, Vibration } from 'react-native';

import { ApiError } from '../api/client';
import {
  acceptCall as apiAccept,
  endCall as apiEnd,
  fetchCall,
  initiateCall,
  rejectCall as apiReject,
  relaySignal,
  FALLBACK_ICE_SERVERS,
  type CallSignal,
  type CallType,
  type IceServer,
  type SignalType,
} from '../api/calls';
import { toUserLevel } from '../api/levels';
import { queryClient } from '../api/queryClient';
import { holdRealtime } from '../realtime/socket';
import { useAuthStore } from '../stores/authStore';
import { useFeedbackStore } from '../stores/feedbackStore';
import { useCallStore, type ActiveCall, type CallPeer } from './callStore';
import {
  cancelIncomingCallNotification,
  showIncomingCallNotification,
  showMissedCallNotification,
  startOngoingCallService,
  stopOngoingCallService,
} from './callNotifications';
import { isDeviceLocked } from '../../modules/call-lock-screen';
import { loadInCallManager, loadWebRTC, type WebRTCModule } from './native';
import { waitForChannel } from '../realtime/socket';

/**
 * Peer-to-peer voice and video calls over WebRTC, signalled through the API.
 *
 * The flow is the backend's (see the integration guide and src/api/calls.ts):
 *
 *   caller                         API / Reverb                     callee
 *   initiate ───────────────────▶ incoming_call ─────────────────▶ rings
 *                                  accepted ◀──────────────────── accept
 *   offer (SDP) ────────────────▶ relay ──────────────────────────▶
 *            ◀─────────────────── relay ◀──────────────── answer (SDP)
 *   ice_candidate ◀────────────── relay ───────────────▶ ice_candidate
 *   end / reject ───────────────▶ ended / rejected ───────────────▶
 *
 * Only the caller ever offers — including the ICE-restart offer that recovers
 * a dropped connection — so there's no glare to resolve.
 *
 * One call at a time. A second `incoming_call` while busy is answered `busy`
 * without disturbing the call in progress.
 *
 * Every signal can arrive twice (user channel *and* conversation channel —
 * see src/api/calls.ts), and in any order relative to our own state: an
 * `offer` can beat the callee's peer connection, an ICE candidate can beat the
 * SDP it belongs to. So signals are deduped, early offers are parked until
 * there's a connection to give them to, and early candidates wait for the
 * remote description.
 */

type RTCPeerConnection = InstanceType<WebRTCModule['RTCPeerConnection']>;
type MediaStream = InstanceType<WebRTCModule['MediaStream']>;

/** Unanswered outgoing calls give up after this long. */
const RING_TIMEOUT_MS = 45_000;
/** Media that hasn't connected this long after pickup isn't going to. */
const CONNECT_TIMEOUT_MS = 30_000;
/** A dropped connection gets this long to recover before the call ends. */
const RECONNECT_TIMEOUT_MS = 20_000;
/** A ringing call re-checks its server status this often (see `watchForAnswerElsewhere`). */
const ANSWER_ELSEWHERE_POLL_MS = 4_000;
/** How long the end card stays before the call is cleared. */
const END_CARD_MS = 1_800;

type Session = {
  callId: string | null;
  type: CallType;
  direction: 'outgoing' | 'incoming';
  conversationId: string | null;
  iceServers: IceServer[];
  pc: RTCPeerConnection | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  remoteDescriptionSet: boolean;
  pendingCandidates: unknown[];
  /** Offers that arrived before the callee's peer connection existed. */
  parkedOffers: CallSignal[];
  /** Media connected at least once. */
  everConnected: boolean;
  iceRestarted: boolean;
  /** `end`/`reject` has been sent — never twice (it corrupts the record). */
  closedOnServer: boolean;
  /** Accept is under way — a second tap (or a notification action) is ignored. */
  accepting: boolean;
  finished: boolean;
  timers: Set<ReturnType<typeof setTimeout>>;
  releaseHold: () => void;
};

let session: Session | null = null;

// ---------------------------------------------------------------------------
// Public surface
// ---------------------------------------------------------------------------

/** This build can make calls (its binary carries WebRTC). */
export function callsSupported(): boolean {
  return !!loadWebRTC();
}

/** Ring someone. Media is opened first, so a refused permission never rings them. */
export async function startCall(input: {
  peer: CallPeer;
  type: CallType;
  conversationId?: string | null;
}): Promise<void> {
  const rtc = loadWebRTC();
  if (!rtc) {
    toast('Calling needs the latest version of the app.', 'info');
    return;
  }
  if (session) {
    toast('You’re already on a call.', 'info');
    return;
  }

  const s = newSession({
    type: input.type,
    direction: 'outgoing',
    conversationId: input.conversationId ?? null,
  });
  publish({
    id: null,
    type: input.type,
    direction: 'outgoing',
    peer: input.peer,
    conversationId: s.conversationId,
    phase: 'outgoing',
  });
  audio.startCall(input.type);

  const opened = await openMedia(s, rtc);
  if (!opened || s.finished) {
    if (!opened) finish(s, 'Microphone access is needed to call.');
    return;
  }
  void startOngoingCallService(input.peer.name, !!s.localStream?.getVideoTracks().length);

  try {
    const { call, iceServers } = await initiateCall({
      receiverId: input.peer.id,
      type: input.type,
      conversationId: s.conversationId,
    });
    s.callId = call.id;
    s.iceServers = iceServers;
    s.conversationId = call.conversation_id ?? s.conversationId;
    if (s.finished) {
      // Hung up while the call was being placed.
      closeOnServer(s, 'caller_hung_up');
      return;
    }
    patch({ id: call.id, ringing: true, conversationId: s.conversationId });
    audio.ringback(true);
    timer(s, RING_TIMEOUT_MS, () => {
      if (!s.pc) hangUp('no_answer');
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 486) {
      finish(s, `${input.peer.name.split(' ')[0]} is on another call.`);
    } else if (error instanceof ApiError && error.status === 422) {
      finish(s, error.firstMessage);
    } else {
      finish(s, error instanceof ApiError ? error.message : 'Couldn’t place the call.');
    }
  }
}

/** Pick up the ringing call. */
export async function acceptIncoming(): Promise<void> {
  const s = session;
  const rtc = loadWebRTC();
  if (!s || !rtc || s.direction !== 'incoming' || s.pc || !s.callId || s.accepting) return;
  s.accepting = true;
  audio.stopRinging();
  void cancelIncomingCallNotification(s.callId);
  audio.startCall(s.type);
  patch({ phase: 'connecting' });

  const opened = await openMedia(s, rtc);
  if (s.finished) return;
  if (!opened) {
    decline();
    toastAfterEnd('Microphone access is needed to answer calls.');
    return;
  }
  const peerName = useCallStore.getState().call?.peer.name ?? 'Payhankey';
  void startOngoingCallService(peerName, !!s.localStream?.getVideoTracks().length);
  const pc = createPeerConnection(s, rtc);

  try {
    const { iceServers } = await apiAccept(s.callId);
    // The accept response is the server's word on ICE; the ringing signal's
    // copy is only a hint. Swap them in before the offer is answered.
    if (iceServers.length && !s.finished) {
      try {
        pc.setConfiguration({ iceServers });
      } catch {
        // Older native builds can't reconfigure; the signal's servers stand.
      }
    }
  } catch (error) {
    s.closedOnServer = true;
    finish(
      s,
      error instanceof ApiError && !!error.status && error.status >= 400 && error.status < 500
        ? 'This call has ended.'
        : 'Couldn’t answer the call.',
    );
    return;
  }
  if (s.finished) return;
  timer(s, CONNECT_TIMEOUT_MS, () => {
    if (!s.everConnected) hangUp('connection_failed', 'Couldn’t connect the call.');
  });
  // An offer that beat us here is answered now.
  for (const offer of s.parkedOffers.splice(0)) void onOffer(s, offer);
}

/** Turn the ringing call down. */
export function decline() {
  const s = session;
  if (!s || s.direction !== 'incoming') return;
  if (!s.closedOnServer && s.callId) {
    s.closedOnServer = true;
    void apiReject(s.callId, 'user_declined').catch(() => {});
  }
  finish(s, 'Declined', { quiet: true });
}

/** Hang up — cancels an unanswered outgoing call, declines an incoming one. */
export function hangUp(reason = 'hung_up', message?: string) {
  const s = session;
  if (!s) return;
  if (s.direction === 'incoming' && !s.pc) {
    decline();
    return;
  }
  const answered = s.everConnected || !!s.pc;
  // An unanswered call we placed is "cancelled" server-side either way; the
  // reason just says why.
  const serverReason = !answered && reason === 'hung_up' ? 'caller_hung_up' : reason;
  closeOnServer(s, serverReason);
  finish(
    s,
    message ??
      (reason === 'no_answer'
        ? 'No answer'
        : answered
          ? 'Call ended'
          : 'Call cancelled'),
  );
}

export function toggleMute() {
  const s = session;
  const call = useCallStore.getState().call;
  if (!s || !call) return;
  const muted = !call.muted;
  s.localStream?.getAudioTracks().forEach((track) => (track.enabled = !muted));
  patch({ muted });
  signal(s, 'mute_state', { muted });
}

export function toggleSpeaker() {
  const call = useCallStore.getState().call;
  if (!call) return;
  const speaker = !call.speaker;
  audio.speaker(speaker);
  patch({ speaker });
}

export function toggleCamera() {
  const s = session;
  const call = useCallStore.getState().call;
  if (!s || !call || call.cameraUnavailable) return;
  const cameraOn = !call.cameraOn;
  s.localStream?.getVideoTracks().forEach((track) => (track.enabled = cameraOn));
  patch({ cameraOn });
  signal(s, 'video_state', { enabled: cameraOn });
}

export function flipCamera() {
  const s = session;
  const call = useCallStore.getState().call;
  const track = s?.localStream?.getVideoTracks()[0];
  if (!s || !call || !track) return;
  const front = !call.frontCamera;
  track
    .applyConstraints({ facingMode: front ? 'user' : 'environment' })
    .then(() => patch({ frontCamera: front }))
    .catch(() => {
      // Single-camera device — nothing to flip to.
    });
}

export function setMinimized(minimized: boolean) {
  patch({ minimized });
}

// ---------------------------------------------------------------------------
// Signals
// ---------------------------------------------------------------------------

const seen = new Map<string, number>();

/** Every `call.signal`, from whichever channel carried it. */
export function handleCallSignal(raw: unknown) {
  const signal = raw as CallSignal;
  if (!signal || typeof signal !== 'object' || !signal.signal_type) return;
  const me = useAuthStore.getState().user?.id;
  if (me && signal.from_user_id === me) {
    // Another of *our* devices answered or declined the call this one is
    // ringing for — the backend sends that to our other devices since
    // 2026-10-15 (`data.accepted_by_other_device`). Anything else from
    // ourselves is an echo (the conversation channel) and is dropped.
    onOtherDevice(signal);
    return;
  }
  if (me && signal.to_user_id && signal.to_user_id !== me) return;
  if (isDuplicate(signal)) return;

  const callId = signal.call_id ?? signal.data?.call_id;

  if (signal.signal_type === 'incoming_call') {
    onIncoming(signal, callId);
    return;
  }

  const s = session;
  if (!s || !callId || s.callId !== callId || s.finished) return;

  switch (signal.signal_type) {
    case 'accepted':
      if (s.direction === 'outgoing' && !s.pc) void onAccepted(s);
      return;
    case 'offer':
      if (s.direction !== 'incoming') return;
      if (!s.pc) s.parkedOffers.push(signal);
      else void onOffer(s, signal);
      return;
    case 'answer':
      if (s.direction === 'outgoing') void onAnswer(s, signal);
      return;
    case 'ice_candidate':
      void onCandidate(s, signal.data);
      return;
    case 'rejected':
      s.closedOnServer = true;
      finish(s, signal.data?.reason === 'busy' ? 'Busy' : 'Declined');
      return;
    case 'busy':
      s.closedOnServer = true;
      finish(s, 'Busy');
      return;
    case 'ended': {
      s.closedOnServer = true;
      // `status: "completed"` on a call that was still ringing here means
      // another of our devices answered it — not a missed call.
      const missed = s.direction === 'incoming' && !s.pc && signal.data?.status !== 'completed';
      if (s.direction === 'incoming' && !s.pc && !missed) {
        finish(s, 'Answered on another device', { quiet: true });
        return;
      }
      finish(s, missed ? 'Missed call' : 'Call ended', { quiet: missed });
      if (missed) {
        const name = useCallStore.getState().call?.peer.name;
        // Over the lock screen the call screen goes as the phone re-locks,
        // taking any toast with it — leave a notification there too.
        if ((ringsInBackground() || isDeviceLocked()) && s.callId) {
          void showMissedCallNotification(s.callId, name ?? '', s.type);
        } else {
          toastAfterEnd(name ? `Missed call from ${name}.` : 'Missed call.', 'info');
        }
      }
      return;
    }
    case 'mute_state':
      patch({ remoteMuted: !!signal.data?.muted });
      return;
    case 'video_state': {
      const data = signal.data ?? {};
      const on = typeof data.enabled === 'boolean' ? data.enabled : !data.video_off;
      patch({ remoteCameraOn: on });
      return;
    }
  }
}

function onOtherDevice(signal: CallSignal) {
  const s = session;
  const callId = signal.call_id ?? signal.data?.call_id;
  if (!s || s.finished || s.direction !== 'incoming' || s.pc || !callId || s.callId !== callId) return;
  if (signal.signal_type === 'accepted') {
    s.closedOnServer = true;
    finish(s, 'Answered on another device', { quiet: true });
    toastAfterEnd('Answered on another device.', 'info');
  } else if (signal.signal_type === 'rejected' || signal.signal_type === 'ended') {
    s.closedOnServer = true;
    finish(s, 'Declined', { quiet: true });
  }
}

function isDuplicate(signal: CallSignal): boolean {
  const now = Date.now();
  for (const [key, at] of seen) if (now - at > 60_000) seen.delete(key);
  const key = `${signal.call_id ?? ''}|${signal.signal_type}|${JSON.stringify(signal.data ?? null)}`;
  if (seen.has(key)) return true;
  seen.set(key, now);
  return false;
}

function onIncoming(signal: CallSignal, callId: string | undefined) {
  if (!callId) return;
  if (session) {
    if (session.callId !== callId) {
      // Already on a call: tell them we're busy, without interrupting ours.
      void apiReject(callId, 'busy').catch(() => {});
    }
    return;
  }
  if (!loadWebRTC()) return; // This binary can't answer; push/web can.
  const caller = signal.caller ?? { id: signal.from_user_id };
  const type: CallType = signal.call_type === 'video' ? 'video' : 'audio';
  const s = newSession({
    type,
    direction: 'incoming',
    conversationId: signal.conversation_id ?? null,
  });
  s.callId = callId;
  s.iceServers = Array.isArray(signal.data?.ice_servers) && signal.data.ice_servers.length
    ? signal.data.ice_servers
    : FALLBACK_ICE_SERVERS;
  publish({
    id: callId,
    type,
    direction: 'incoming',
    peer: {
      id: caller.id,
      name: caller.name?.trim() || caller.username || 'Someone',
      username: caller.username ?? '',
      avatar: caller.avatar ?? null,
      level: toUserLevel(caller.level),
    },
    conversationId: s.conversationId,
    phase: 'incoming',
  });
  if (ringsInBackground()) {
    // Backgrounded but alive (the socket outlives the screen for a minute):
    // our own UI can't be seen, so ring through the notification instead.
    void showIncomingCallNotification({
      callId,
      callerName: caller.name?.trim() || caller.username || 'Someone',
      callerAvatar: caller.avatar ?? null,
      callType: type,
    });
  } else {
    audio.ring();
    // The push may have put the notification up first; the screen has it now.
    void cancelIncomingCallNotification(callId);
  }
  // The caller gives up at 45s and ends the call, which reaches us as `ended`.
  // This is the backstop for an `ended` we never hear.
  timer(s, RING_TIMEOUT_MS + 5_000, () => {
    if (!s.pc) finish(s, 'Missed call', { quiet: true });
  });
  watchForAnswerElsewhere(s);
}

/**
 * Stop ringing once another of *your* devices has answered or declined.
 *
 * Since 2026-10-15 the backend says so directly (`onOtherDevice`). Before that
 * it told only the caller (verified 2026-10-14: the iPhone kept ringing after
 * Android picked up), and an event can still be lost across a reconnect, so a
 * ringing device also asks the server every few seconds whether the call is
 * still ringing.
 */
function watchForAnswerElsewhere(s: Session) {
  const check = async () => {
    if (s.finished || s.pc || !s.callId) return;
    try {
      const call = await fetchCall(s.callId);
      if (s.finished || s.pc) return;
      if (call.status !== 'ringing') {
        s.closedOnServer = true;
        if (call.status === 'ongoing' || call.status === 'completed') {
          finish(s, 'Answered on another device', { quiet: true });
          toastAfterEnd('Answered on another device.', 'info');
        } else {
          finish(s, call.status === 'rejected' ? 'Declined' : 'Missed call', { quiet: true });
        }
        return;
      }
    } catch {
      // A failed check just waits for the next one (or for `ended`).
    }
    timer(s, ANSWER_ELSEWHERE_POLL_MS, () => void check());
  };
  timer(s, ANSWER_ELSEWHERE_POLL_MS, () => void check());
}

async function onAccepted(s: Session) {
  const rtc = loadWebRTC();
  if (!rtc) return;
  audio.ringback(false);
  patch({ phase: 'connecting' });
  createPeerConnection(s, rtc);
  timer(s, CONNECT_TIMEOUT_MS, () => {
    if (!s.everConnected) hangUp('connection_failed', 'Couldn’t connect the call.');
  });
  await sendOffer(s);
}

async function sendOffer(s: Session, iceRestart = false) {
  if (!s.pc || s.finished) return;
  try {
    const offer = await s.pc.createOffer(iceRestart ? { iceRestart: true } : {});
    await s.pc.setLocalDescription(offer);
    signal(s, 'offer', { type: 'offer', sdp: offer.sdp });
  } catch (error) {
    if (__DEV__) console.warn('[call] offer failed', error);
    hangUp('connection_failed', 'Couldn’t connect the call.');
  }
}

async function onOffer(s: Session, offer: CallSignal) {
  const rtc = loadWebRTC();
  const sdp = readSdp(offer.data);
  if (!rtc || !s.pc || !sdp) return;
  try {
    await s.pc.setRemoteDescription(new rtc.RTCSessionDescription({ type: 'offer', sdp }));
    s.remoteDescriptionSet = true;
    await flushCandidates(s);
    const answer = await s.pc.createAnswer();
    await s.pc.setLocalDescription(answer);
    signal(s, 'answer', { type: 'answer', sdp: answer.sdp });
  } catch (error) {
    if (__DEV__) console.warn('[call] answer failed', error);
    hangUp('connection_failed', 'Couldn’t connect the call.');
  }
}

async function onAnswer(s: Session, answer: CallSignal) {
  const rtc = loadWebRTC();
  const sdp = readSdp(answer.data);
  if (!rtc || !s.pc || !sdp) return;
  // A stale answer (e.g. a duplicate after an ICE restart) must not be applied
  // to a connection that isn't waiting for one.
  if (s.pc.signalingState !== 'have-local-offer') return;
  try {
    await s.pc.setRemoteDescription(new rtc.RTCSessionDescription({ type: 'answer', sdp }));
    s.remoteDescriptionSet = true;
    await flushCandidates(s);
  } catch (error) {
    if (__DEV__) console.warn('[call] remote answer failed', error);
  }
}

async function onCandidate(s: Session, data: unknown) {
  const list = Array.isArray((data as { candidates?: unknown[] })?.candidates)
    ? (data as { candidates: unknown[] }).candidates
    : [data];
  for (const raw of list) {
    const init = readCandidate(raw);
    if (!init) continue;
    if (!s.pc || !s.remoteDescriptionSet) s.pendingCandidates.push(init);
    else await addCandidate(s, init);
  }
}

async function flushCandidates(s: Session) {
  for (const init of s.pendingCandidates.splice(0)) await addCandidate(s, init);
}

async function addCandidate(s: Session, init: unknown) {
  const rtc = loadWebRTC();
  if (!rtc || !s.pc) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await s.pc.addIceCandidate(new rtc.RTCIceCandidate(init as any));
  } catch {
    // A candidate for a superseded generation — harmless.
  }
}

/**
 * The SDP out of a relayed offer/answer, repaired.
 *
 * **The relay strips the SDP's trailing `\r\n`** (verified 2026-10-14 —
 * Laravel's TrimStrings middleware runs over the whole request, nested `data`
 * included), and libwebrtc refuses an SDP whose last line isn't terminated:
 * `setRemoteDescription` fails with "SessionDescription is NULL". So the
 * terminator is put back. Harmless once the backend exempts `data.sdp`.
 */
function readSdp(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as { sdp?: unknown; description?: { sdp?: unknown } };
  let sdp: string | null = null;
  if (typeof d.sdp === 'string') sdp = d.sdp;
  else if (d.sdp && typeof d.sdp === 'object' && typeof (d.sdp as { sdp?: unknown }).sdp === 'string') {
    sdp = (d.sdp as { sdp: string }).sdp;
  } else if (typeof d.description?.sdp === 'string') sdp = d.description.sdp;
  if (!sdp) return null;
  return sdp.endsWith('\n') ? sdp : `${sdp}\r\n`;
}

/** Accepts `{candidate, sdpMid, sdpMLineIndex}`, a nested `{candidate: {...}}`, or a bare string. */
function readCandidate(raw: unknown): { candidate: string; sdpMid?: string | null; sdpMLineIndex?: number | null } | null {
  if (!raw) return null;
  if (typeof raw === 'string') return { candidate: raw, sdpMid: '0', sdpMLineIndex: 0 };
  const r = raw as { candidate?: unknown; sdpMid?: string | null; sdpMLineIndex?: number | null };
  if (r.candidate && typeof r.candidate === 'object') return readCandidate(r.candidate);
  if (typeof r.candidate !== 'string' || !r.candidate) return null;
  return {
    candidate: r.candidate,
    sdpMid: r.sdpMid ?? null,
    sdpMLineIndex: typeof r.sdpMLineIndex === 'number' ? r.sdpMLineIndex : null,
  };
}

// ---------------------------------------------------------------------------
// Media & connection
// ---------------------------------------------------------------------------

async function openMedia(s: Session, rtc: WebRTCModule): Promise<boolean> {
  const wantVideo = s.type === 'video';
  let stream: MediaStream | null = null;
  let cameraUnavailable = false;
  try {
    stream = await rtc.mediaDevices.getUserMedia({
      audio: true,
      video: wantVideo ? { facingMode: 'user', width: 640, height: 480, frameRate: 24 } : false,
    });
  } catch (error) {
    if (!wantVideo) {
      if (__DEV__) console.warn('[call] microphone unavailable', error);
      return false;
    }
    // No camera (the Simulator has none) or camera permission refused: carry
    // on with audio, and still receive their video.
    try {
      stream = await rtc.mediaDevices.getUserMedia({ audio: true, video: false });
      cameraUnavailable = true;
    } catch (audioError) {
      if (__DEV__) console.warn('[call] microphone unavailable', audioError);
      return false;
    }
  }
  if (s.finished) {
    stream.getTracks().forEach((track) => track.stop());
    stream.release();
    return false;
  }
  s.localStream = stream;
  const hasVideo = stream.getVideoTracks().length > 0;
  patch({
    localStreamURL: hasVideo ? stream.toURL() : null,
    cameraOn: hasVideo,
    cameraUnavailable: wantVideo && (cameraUnavailable || !hasVideo),
  });
  return true;
}

/**
 * The peer connection's event surface. react-native-webrtc's published typings
 * import a vendored `event-target-shim` they don't ship, so `addEventListener`
 * is missing from its types though present at runtime.
 */
type PeerEvents = {
  addEventListener(type: 'icecandidate' | 'track' | 'iceconnectionstatechange', listener: (event: unknown) => void): void;
};

function createPeerConnection(s: Session, rtc: WebRTCModule): RTCPeerConnection {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pc = new rtc.RTCPeerConnection({ iceServers: s.iceServers as any });
  const events = pc as unknown as PeerEvents;
  s.pc = pc;

  s.localStream?.getTracks().forEach((track) => pc.addTrack(track, s.localStream!));
  // A video call we can't send video on (no camera) still wants theirs.
  if (s.type === 'video' && s.direction === 'outgoing' && !s.localStream?.getVideoTracks().length) {
    pc.addTransceiver('video', { direction: 'recvonly' });
  }

  events.addEventListener('icecandidate', (event) => {
    const candidate = (event as unknown as { candidate?: { toJSON?: () => unknown } | null }).candidate;
    if (!candidate) return;
    signal(s, 'ice_candidate', candidate.toJSON ? candidate.toJSON() : candidate);
  });

  events.addEventListener('track', (event) => {
    const stream = (event as unknown as { streams?: MediaStream[] }).streams?.[0];
    if (!stream || s.finished) return;
    s.remoteStream = stream;
    patch({ remoteStreamURL: stream.toURL() });
  });

  events.addEventListener('iceconnectionstatechange', () => onIceState(s, pc.iceConnectionState));
  return pc;
}

function onIceState(s: Session, state: string) {
  if (s.finished || session !== s) return;
  if (__DEV__) console.log('[call] ice', state);
  if (state === 'connected' || state === 'completed') {
    const first = !s.everConnected;
    s.everConnected = true;
    clearReconnectTimer(s);
    patch(first ? { phase: 'connected', connectedAt: Date.now() } : { phase: 'connected' });
    if (first && s.type === 'video') watchRemoteVideo(s);
    if (first && __DEV__) logStats(s);
    return;
  }
  if (!s.everConnected) {
    if (state === 'failed') hangUp('connection_failed', 'Couldn’t connect the call.');
    return;
  }
  if (state === 'disconnected' || state === 'failed') {
    patch({ phase: 'reconnecting' });
    // Only the caller offers, so the caller drives the restart.
    if (state === 'failed' && s.direction === 'outgoing' && !s.iceRestarted) {
      s.iceRestarted = true;
      void sendOffer(s, true);
    }
    if (!reconnectTimers.has(s)) {
      reconnectTimers.set(
        s,
        timer(s, RECONNECT_TIMEOUT_MS, () => hangUp('connection_lost', 'Connection lost')),
      );
    }
  }
}

/**
 * Track whether their video is really arriving: frames decoded since the last
 * sample. Drives `remoteVideoFlowing`, so the screen shows their video only
 * while there's a picture and falls back to their avatar when it stops.
 */
function watchRemoteVideo(s: Session) {
  let lastFrames = 0;
  let stalls = 0;
  const tick = async () => {
    if (s.finished || !s.pc) return;
    try {
      const report = (await s.pc.getStats()) as Map<string, Record<string, unknown>>;
      let frames = 0;
      report.forEach((stat) => {
        if (stat.type === 'inbound-rtp' && (stat.kind ?? stat.mediaType) === 'video') {
          frames += Number(stat.framesDecoded ?? 0);
        }
      });
      const flowing = frames > lastFrames;
      stalls = flowing ? 0 : stalls + 1;
      lastFrames = frames;
      const current = useCallStore.getState().call?.remoteVideoFlowing;
      // On at the first new frame; off only after ~3s without one, so a brief
      // network hiccup doesn't flash the avatar.
      if (flowing && !current) patch({ remoteVideoFlowing: true });
      else if (!flowing && current && stalls >= 2) patch({ remoteVideoFlowing: false });
    } catch {
      // Stats unavailable — leave the view as it is.
    }
    timer(s, 1_500, () => void tick());
  };
  timer(s, 500, () => void tick());
}

/** Dev only: media byte counters every 5s, to tell "connected" from "carrying audio". */
function logStats(s: Session) {
  const tick = async () => {
    if (s.finished || !s.pc) return;
    try {
      const report = (await s.pc.getStats()) as Map<string, Record<string, unknown>>;
      const lines: string[] = [];
      report.forEach((stat) => {
        if (stat.type === 'inbound-rtp' || stat.type === 'outbound-rtp') {
          const bytes = stat.type === 'inbound-rtp' ? stat.bytesReceived : stat.bytesSent;
          lines.push(`${stat.type}:${stat.kind ?? stat.mediaType}=${bytes}`);
        }
      });
      console.log('[call] stats', lines.join(' '));
    } catch {
      // Stats are diagnostics only.
    }
    timer(s, 5_000, () => void tick());
  };
  timer(s, 2_000, () => void tick());
}

const reconnectTimers = new WeakMap<Session, ReturnType<typeof setTimeout>>();
function clearReconnectTimer(s: Session) {
  const t = reconnectTimers.get(s);
  if (t) {
    clearTimeout(t);
    s.timers.delete(t);
    reconnectTimers.delete(s);
  }
}

// ---------------------------------------------------------------------------
// Session plumbing
// ---------------------------------------------------------------------------

function newSession(init: Pick<Session, 'type' | 'direction' | 'conversationId'>): Session {
  const s: Session = {
    ...init,
    callId: null,
    iceServers: FALLBACK_ICE_SERVERS,
    pc: null,
    localStream: null,
    remoteStream: null,
    remoteDescriptionSet: false,
    pendingCandidates: [],
    parkedOffers: [],
    everConnected: false,
    iceRestarted: false,
    closedOnServer: false,
    accepting: false,
    finished: false,
    timers: new Set(),
    // The socket carries the signalling — keep it up even if the app is
    // backgrounded mid-call.
    releaseHold: holdRealtime('call'),
  };
  session = s;
  return s;
}

function publish(
  init: Pick<ActiveCall, 'id' | 'type' | 'direction' | 'peer' | 'conversationId' | 'phase'>,
) {
  useCallStore.getState().set({
    ...init,
    ringing: false,
    connectedAt: null,
    endedReason: null,
    muted: false,
    speaker: init.type === 'video',
    cameraOn: init.type === 'video',
    frontCamera: true,
    cameraUnavailable: false,
    remoteMuted: false,
    remoteCameraOn: init.type === 'video',
    remoteVideoFlowing: false,
    localStreamURL: null,
    remoteStreamURL: null,
    minimized: false,
  });
}

function patch(p: Partial<ActiveCall>) {
  useCallStore.getState().patch(p);
}

function timer(s: Session, ms: number, fn: () => void): ReturnType<typeof setTimeout> {
  const t = setTimeout(() => {
    s.timers.delete(t);
    if (!s.finished) fn();
  }, ms);
  s.timers.add(t);
  return t;
}

/** Relay a signal for the current call. Fire and forget — a lost one surfaces as a failed connect. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function signal(s: Session, type: SignalType, data: any) {
  if (!s.callId || s.finished) return;
  relaySignal(s.callId, type, data).catch((error) => {
    if (__DEV__) console.warn('[call] signal failed', type, String(error));
  });
}

function closeOnServer(s: Session, reason: string) {
  if (s.closedOnServer || !s.callId) return;
  s.closedOnServer = true;
  void apiEnd(s.callId, reason).catch(() => {});
}

/** Tear everything down and show why. Idempotent. */
function finish(s: Session, reason: string, { quiet = false }: { quiet?: boolean } = {}) {
  if (s.finished) return;
  s.finished = true;
  s.timers.forEach(clearTimeout);
  s.timers.clear();
  audio.stopRinging();
  audio.end();

  try {
    s.pc?.close();
  } catch {
    // Already closed.
  }
  s.localStream?.getTracks().forEach((track) => track.stop());
  try {
    s.localStream?.release();
  } catch {
    // Already released.
  }
  s.pc = null;
  s.localStream = null;
  s.remoteStream = null;
  s.releaseHold();
  if (s.callId) void cancelIncomingCallNotification(s.callId);
  void stopOngoingCallService();

  // The call history should already show this one when it's next opened.
  setTimeout(() => void queryClient.invalidateQueries({ queryKey: ['calls'] }), 1_500);

  patch({
    phase: 'ended',
    endedReason: reason,
    localStreamURL: null,
    remoteStreamURL: null,
  });
  // A declined or missed incoming call needs no end card — it just goes.
  setTimeout(
    () => {
      if (session === s) session = null;
      const current = useCallStore.getState().call;
      if (current && current.phase === 'ended' && (current.id === s.callId || !current.id)) {
        useCallStore.getState().set(null);
      }
    },
    quiet ? 300 : END_CARD_MS,
  );
}

function toast(message: string, kind: 'info' | 'error' = 'info') {
  useFeedbackStore.getState().showToast(message, kind);
}

function toastAfterEnd(message: string, kind: 'info' | 'error' = 'error') {
  setTimeout(() => toast(message, kind), 400);
}

// ---------------------------------------------------------------------------
// Audio routing, ringtone and ringback (react-native-incall-manager)
// ---------------------------------------------------------------------------

/** The in-app ringtone is playing (it must not be started twice). */
let ringing = false;

const audio = {
  /** Claim the audio session for a call: earpiece for voice, speaker for video. */
  startCall(type: CallType) {
    const m = loadInCallManager();
    if (!m) return;
    try {
      m.start({ media: type, auto: true });
      m.setKeepScreenOn(true);
      if (type === 'video') m.setForceSpeakerphoneOn(true);
    } catch {
      // Audio routing is best-effort; the call works without it.
    }
  },
  ringback(on: boolean) {
    const m = loadInCallManager();
    if (!m) return;
    try {
      if (on) m.startRingback('_DTMF_');
      else m.stopRingback();
    } catch {
      // Best-effort.
    }
  },
  ring() {
    if (ringing) return;
    ringing = true;
    const m = loadInCallManager();
    const pattern = [0, 900, 1100];
    try {
      if (m) m.startRingtone('_DEFAULT_', pattern, 'default', 45);
      else Vibration.vibrate(pattern, true);
    } catch {
      Vibration.vibrate(pattern, true);
    }
  },
  stopRinging() {
    ringing = false;
    const m = loadInCallManager();
    try {
      m?.stopRingtone();
    } catch {
      // Best-effort.
    }
    Vibration.cancel();
  },
  speaker(on: boolean) {
    const m = loadInCallManager();
    try {
      m?.setForceSpeakerphoneOn(on);
    } catch {
      // Best-effort.
    }
  },
  end() {
    const m = loadInCallManager();
    if (!m) return;
    try {
      m.stopRingback();
      m.setForceSpeakerphoneOn(false);
      m.setKeepScreenOn(false);
      m.stop();
    } catch {
      // Best-effort.
    }
  },
};

/** For sign-out: drop any call without ceremony. */
export function abandonCall() {
  if (session) hangUp();
}

/**
 * Pick a ringing call back up when the app is opened for it — from the
 * incoming-call notification (tapped, its full-screen takeover, or Answer),
 * or a launch while one is still ringing. The socket's `incoming_call` went out
 * before this process was listening, so the call is read back from
 * `GET /calls/{id}` and rung locally if it's still ringing for us.
 *
 * With `autoAccept` (the notification's Answer) it's picked up at once — but
 * only after our `private-user` channel is subscribed: the caller sends its
 * offer the moment we accept, and a socket that isn't listening yet would miss
 * it. Safe to call twice for one call (a cold start can deliver the same tap
 * through two paths).
 */
const resuming = new Set<string>();
export async function resumeIncomingCall(
  callId: string,
  { autoAccept = false }: { autoAccept?: boolean } = {},
): Promise<void> {
  if (!loadWebRTC()) return;
  if (session) {
    if (autoAccept && session.callId === callId && session.direction === 'incoming' && !session.pc) {
      await waitForCallChannel();
      await acceptIncoming();
    }
    return;
  }
  if (resuming.has(callId)) return;
  resuming.add(callId);
  try {
    const call = await fetchCall(callId);
    const me = useAuthStore.getState().user?.id;
    if (call.status !== 'ringing' || call.receiver_id !== me) {
      void cancelIncomingCallNotification(callId);
      const name = call.caller?.name?.trim() || call.caller?.username;
      toast(
        call.status === 'ongoing' || call.status === 'completed'
          ? 'That call was answered on another device.'
          : name
            ? `Missed call from ${name}.`
            : 'That call has ended.',
        'info',
      );
      return;
    }
    handleCallSignal({
      call_id: call.id,
      conversation_id: call.conversation_id ?? null,
      from_user_id: call.caller_id,
      to_user_id: call.receiver_id,
      signal_type: 'incoming_call',
      call_type: call.call_type,
      caller: call.caller ?? { id: call.caller_id },
      data: { call_id: call.id, resumed: true },
    } satisfies CallSignal);
    if (autoAccept) {
      await waitForCallChannel();
      await acceptIncoming();
    }
  } catch {
    toast('That call has ended.', 'info');
  } finally {
    resuming.delete(callId);
  }
}

/** Decline the call this process is ringing for, if it is. True when it was. */
export function declineIfRinging(callId: string): boolean {
  const s = session;
  if (!s || s.callId !== callId || s.direction !== 'incoming' || s.pc) return false;
  decline();
  return true;
}

/** Up to 10s for the socket to be listening on our own channel. */
async function waitForCallChannel(): Promise<void> {
  const me = useAuthStore.getState().user?.id;
  if (me) await waitForChannel(`private-user.${me}`, 10_000);
}

/** Ring through the notification, not the screen: Android, app not in front. */
function ringsInBackground(): boolean {
  return Platform.OS === 'android' && AppState.currentState !== 'active';
}

/**
 * Hand ringing between the screen and the notification as the app comes and
 * goes: in front, the call screen rings; behind, the notification does (and
 * shows over the lock screen). Android only — iOS has no notification to ring.
 */
if (Platform.OS === 'android') {
  AppState.addEventListener('change', (state) => {
    const s = session;
    if (!s || s.finished || s.direction !== 'incoming' || s.pc || !s.callId) return;
    if (state === 'active') {
      void cancelIncomingCallNotification(s.callId);
      audio.ring();
    } else if (state === 'background') {
      audio.stopRinging();
      const call = useCallStore.getState().call;
      void showIncomingCallNotification({
        callId: s.callId,
        callerName: call?.peer.name ?? 'Someone',
        callerAvatar: call?.peer.avatar ?? null,
        callType: s.type,
      });
    }
  });
}
