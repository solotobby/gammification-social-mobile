import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

/**
 * Local Expo module (Android only) — see
 * android/src/main/java/expo/modules/calllockscreen/CallLockScreenModule.kt.
 * Every function is a safe no-op where the native half is missing: iOS, web,
 * or an Android binary built before the module existed.
 */
type CallLockScreenNative = {
  setShowOverLockScreen(enabled: boolean): boolean;
  isDeviceLocked(): boolean;
  canUseFullScreenIntent(): boolean;
  openFullScreenIntentSettings(): boolean;
};

const native =
  Platform.OS === 'android' ? requireOptionalNativeModule<CallLockScreenNative>('CallLockScreen') : null;

/** Show the app over the lock screen (and wake the screen) while a call needs it. */
export function setShowOverLockScreen(enabled: boolean): void {
  try {
    native?.setShowOverLockScreen(enabled);
  } catch {
    // Window flags are best-effort; the call itself doesn't depend on them.
  }
}

export function isDeviceLocked(): boolean {
  try {
    return native?.isDeviceLocked() ?? false;
  } catch {
    return false;
  }
}

/** Android 14+: may an incoming call take over the screen? True where the question doesn't apply. */
export function canUseFullScreenIntent(): boolean {
  try {
    return native?.canUseFullScreenIntent() ?? true;
  } catch {
    return true;
  }
}

export function openFullScreenIntentSettings(): void {
  try {
    native?.openFullScreenIntentSettings();
  } catch {
    // Settings page unavailable on this device.
  }
}
