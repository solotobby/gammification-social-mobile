/**
 * Default (web) half of a Metro platform split; the real accessors are in
 * `./native.native.ts`.
 *
 * Calls run on `react-native-webrtc`, which has no web build — its views come
 * from `requireNativeComponent` — so nothing here may name the package. Web
 * simply reports calling as unavailable and hides the call buttons.
 */

import type * as WebRTC from 'react-native-webrtc';
import type InCallManagerType from 'react-native-incall-manager';

export type WebRTCModule = typeof WebRTC;
export type InCallManager = typeof InCallManagerType;

export function loadWebRTC(): WebRTCModule | null {
  return null;
}

export function loadInCallManager(): InCallManager | null {
  return null;
}
