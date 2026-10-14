import { NativeModules } from 'react-native';

import type { InCallManager, WebRTCModule } from './native';

export type { InCallManager, WebRTCModule } from './native';

/**
 * iOS/Android accessors for the two native modules calls depend on.
 *
 * Both are required lazily, and only once their native half is confirmed
 * present: a dev client built before they were added (anything before the
 * 2026-10-14 build) has the JS but not the native code, and
 * `react-native-webrtc` only throws for a module that is `null` — a missing one
 * is `undefined`, which would crash later, mid-call. Checking first keeps every
 * older binary working, with calling hidden.
 */

let webrtc: WebRTCModule | null | undefined;
let inCall: InCallManager | null | undefined;

export function loadWebRTC(): WebRTCModule | null {
  if (webrtc !== undefined) return webrtc;
  try {
    webrtc = NativeModules.WebRTCModule
      ? // eslint-disable-next-line @typescript-eslint/no-require-imports
        (require('react-native-webrtc') as WebRTCModule)
      : null;
  } catch {
    webrtc = null;
  }
  return webrtc;
}

export function loadInCallManager(): InCallManager | null {
  if (inCall !== undefined) return inCall;
  try {
    inCall = NativeModules.InCallManager
      ? // eslint-disable-next-line @typescript-eslint/no-require-imports
        ((require('react-native-incall-manager') as { default: InCallManager }).default)
      : null;
  } catch {
    inCall = null;
  }
  return inCall;
}
