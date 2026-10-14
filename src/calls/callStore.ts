import { create } from 'zustand';

import type { CallType } from '../api/calls';
import type { UserLevel } from '../api/levels';

/**
 * The one call this device can be on, as the UI sees it. The engine
 * (`callEngine.ts`) owns the WebRTC objects and writes here; screens only
 * read, and act through the engine's functions.
 */

export type CallPhase =
  /** We dialled; the far side hasn't picked up. */
  | 'outgoing'
  /** Someone is calling us. */
  | 'incoming'
  /** Picked up — media is negotiating. */
  | 'connecting'
  | 'connected'
  /** Media dropped mid-call; ICE is trying to recover. */
  | 'reconnecting'
  /** Over. The screen shows why for a moment, then the call is cleared. */
  | 'ended';

export type CallPeer = {
  id: string;
  name: string;
  username: string;
  avatar: string | null;
  level?: UserLevel;
};

export type ActiveCall = {
  /** Server call id — null for an outgoing call until `initiate` answers. */
  id: string | null;
  type: CallType;
  direction: 'outgoing' | 'incoming';
  peer: CallPeer;
  conversationId: string | null;
  phase: CallPhase;
  /** Outgoing only: the server has the call and the other side is being rung. */
  ringing: boolean;
  /** When media first connected — the call timer counts from here. */
  connectedAt: number | null;
  /** Why it ended, in words for the end card ("Declined", "No answer"…). */
  endedReason: string | null;
  muted: boolean;
  speaker: boolean;
  cameraOn: boolean;
  frontCamera: boolean;
  /** No camera could be opened (the iOS Simulator has none) — audio carries on. */
  cameraUnavailable: boolean;
  remoteMuted: boolean;
  remoteCameraOn: boolean;
  /**
   * Their video is actually decoding frames. A video track can exist and carry
   * nothing (a camera still starting, a peer with none), and rendering it then
   * is a black screen where their avatar should be.
   */
  remoteVideoFlowing: boolean;
  localStreamURL: string | null;
  remoteStreamURL: string | null;
  /** The call screen was swiped down; a pill offers the way back. */
  minimized: boolean;
};

type CallState = {
  call: ActiveCall | null;
  patch: (patch: Partial<ActiveCall>) => void;
  set: (call: ActiveCall | null) => void;
};

export const useCallStore = create<CallState>((set) => ({
  call: null,
  patch: (patch) => set((state) => (state.call ? { call: { ...state.call, ...patch } } : state)),
  set: (call) => set({ call }),
}));
