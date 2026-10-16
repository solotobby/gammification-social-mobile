import { api } from './client';
import type { ApiEnvelope } from './types';

/**
 * Voice & video calls — `/calls/*` (the "Chat, Voice&Video Call" folder,
 * added 2026-10-14). Signalling for a peer-to-peer WebRTC call: the API keeps
 * a call record and relays SDP/ICE over Reverb (`call.signal`), and the media
 * itself never touches the server.
 *
 * Verified against the live API on 2026-10-14 — several things differ from
 * the integration guide:
 *
 * - **`call.signal` goes to the conversation channel too**, when the call has
 *   a `conversation_id`, as well as to the receiver's `private-user.{id}`. A
 *   client holding both channels sees each signal twice, so the engine dedupes.
 * - ~~Ending a call twice corrupts it~~ — **fixed 2026-10-15** (a second `end`
 *   now leaves status, duration and `ended_at` alone). The engine still ends
 *   each call exactly once.
 * - `POST /calls/signal` (the generic relay) validates `call_type` against
 *   `audio|video`, not the guide's `voice`. The engine uses the per-call
 *   `POST /calls/{id}/signal`, which needs no addressing at all.
 * - Calling yourself is a 422 "You cannot call yourself."; accepting someone
 *   else's call is a 403 "Only the designated recipient can accept this call."
 * - A busy receiver is **HTTP 486** with the call row already `status: "busy"`.
 * - ~~The relay strips the SDP's trailing `\r\n`~~ — **fixed 2026-10-15**.
 *   `readSdp` in the engine still restores it; harmless now, and it protects
 *   against a regression that would make every call fail.
 * - **The TURN server added on 2026-10-15 is dead.** `ice_servers` now lists
 *   `turn:openrelay.metered.ca` with the public `openrelayproject` login, but
 *   that free service has been shut down: the host resolves to `192.0.2.1` /
 *   `100::1` (reserved, unroutable) and a raw TURN Allocate gets no answer.
 *   Calls still work wherever STUN does; symmetric NATs (common on mobile
 *   data) still fail until a working TURN server is configured.
 * - **A ringing call never times out on the server.** One left ringing by a
 *   client that went away stayed `ringing` for 40+ minutes, and every call to
 *   that person answered **486 busy** meanwhile. Our clients always end or
 *   reject their own calls (45s ring timeout); the backend should expire
 *   ringing calls itself.
 * - **The receiver's other devices are told** when one of them answers
 *   (2026-10-15): an `accepted` signal *from yourself* with
 *   `data.accepted_by_other_device: true` — see `onOtherDevice` in the engine.
 * - Incoming-call **pushes are data-only** since 2026-10-15 (verified on
 *   Android): `{type: "call_incoming", call_id, caller_id, caller_name,
 *   caller_avatar, call_type, conversation_id, channel_name}`, then
 *   `{type: "call_cancelled", call_id}` when it stops ringing — no title or
 *   body, `priority: high`, `ttl: 45`, `channelId: "calls"`. Data-only means
 *   the system shows **nothing** for them on its own.
 */

export type CallType = 'audio' | 'video';

export type CallStatus =
  | 'ringing'
  | 'ongoing'
  | 'completed'
  | 'missed'
  | 'rejected'
  | 'cancelled'
  | 'busy'
  | 'failed';

export type SignalType =
  | 'incoming_call'
  | 'offer'
  | 'answer'
  | 'ice_candidate'
  | 'accepted'
  | 'rejected'
  | 'busy'
  | 'ended'
  | 'mute_state'
  | 'video_state';

export type ApiCallParty = {
  id: string;
  name?: string | null;
  username?: string | null;
  avatar?: string | null;
  level?: string | null;
};

export type ApiCall = {
  id: string;
  caller_id: string;
  receiver_id: string;
  conversation_id?: string | null;
  call_type: CallType;
  status: CallStatus;
  channel_name?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  duration?: number | null;
  end_reason?: string | null;
  created_at?: string | null;
  caller?: ApiCallParty | null;
  receiver?: ApiCallParty | null;
};

export type IceServer = { urls: string | string[]; username?: string; credential?: string };

/** What arrives as `call.signal` on `private-user.{me}` (and the conversation channel). */
export type CallSignal = {
  call_id?: string;
  conversation_id?: string | null;
  from_user_id: string;
  to_user_id: string;
  signal_type: SignalType;
  call_type?: CallType;
  caller?: ApiCallParty | null;
  // The payload varies by signal type: SDP, an ICE candidate, mute state…
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any;
};

type CallEnvelope = ApiEnvelope<{ call: ApiCall; ice_servers?: IceServer[]; is_busy?: boolean }>;

/** Used when a response carries no ICE servers at all. */
export const FALLBACK_ICE_SERVERS: IceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

/**
 * `POST /calls/initiate` — creates the call (`ringing`), broadcasts
 * `incoming_call` to the receiver and pushes their devices. A busy receiver
 * answers 486, which surfaces as an `ApiError` with that status.
 */
export async function initiateCall(input: {
  receiverId: string;
  type: CallType;
  conversationId?: string | null;
}): Promise<{ call: ApiCall; iceServers: IceServer[] }> {
  const { data } = await api.post<CallEnvelope>('/calls/initiate', {
    receiver_id: input.receiverId,
    call_type: input.type,
    ...(input.conversationId ? { conversation_id: input.conversationId } : {}),
    meta: { camera: 'front' },
  });
  return { call: data.data.call, iceServers: iceServersOf(data.data.ice_servers) };
}

/** `POST /calls/{id}/accept` — `ongoing`, and an `accepted` signal to the caller. */
export async function acceptCall(id: string): Promise<{ call: ApiCall; iceServers: IceServer[] }> {
  const { data } = await api.post<CallEnvelope>(`/calls/${id}/accept`);
  return { call: data.data.call, iceServers: iceServersOf(data.data.ice_servers) };
}

/** `POST /calls/{id}/reject` — `user_declined` or `busy`. */
export async function rejectCall(id: string, reason: 'user_declined' | 'busy' = 'user_declined') {
  await api.post(`/calls/${id}/reject`, { reason });
}

/**
 * `POST /calls/{id}/end` — `completed` if it was answered, otherwise
 * `cancelled`. **Call once per call** — see the note at the top.
 */
export async function endCall(id: string, reason: string): Promise<ApiCall | null> {
  const { data } = await api.post<CallEnvelope>(`/calls/${id}/end`, { reason });
  return data.data?.call ?? null;
}

/** `POST /calls/{id}/signal` — relay SDP / ICE / media state to the other party. */
export async function relaySignal(
  id: string,
  signalType: SignalType,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
): Promise<void> {
  await api.post(`/calls/${id}/signal`, { signal_type: signalType, data: payload });
}

/** `GET /calls/{id}` — one call's current record (used to check a ringing call is still live). */
export async function fetchCall(id: string): Promise<ApiCall> {
  const { data } = await api.get<ApiEnvelope<ApiCall>>(`/calls/${id}`);
  return data.data;
}

export type CallHistoryPage = {
  calls: ApiCall[];
  page: number;
  lastPage: number;
  total: number;
};

/** `GET /calls` — your calls, newest first, 20 a page. `meta` sits beside `data`. */
export async function fetchCallHistory(page: number): Promise<CallHistoryPage> {
  const { data } = await api.get<{
    data: ApiCall[];
    meta?: { current_page?: number; last_page?: number; total?: number };
  }>('/calls', { params: { page, per_page: 20 } });
  return {
    calls: Array.isArray(data.data) ? data.data : [],
    page: data.meta?.current_page ?? page,
    lastPage: data.meta?.last_page ?? page,
    total: data.meta?.total ?? 0,
  };
}

function iceServersOf(raw: IceServer[] | undefined): IceServer[] {
  return Array.isArray(raw) && raw.length ? raw : FALLBACK_ICE_SERVERS;
}
