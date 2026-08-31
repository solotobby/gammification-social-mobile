import type SpInAppUpdates from 'sp-react-native-in-app-updates';

/**
 * Default (iOS + web) half of a Metro platform split; the real implementation is
 * `./inAppUpdatesModule.android.ts`.
 *
 * `sp-react-native-in-app-updates` resolves `./InAppUpdates` through `.android` /
 * `.ios` platform files with no web variant, so a plain import of it fails the
 * web bundle outright — an inline `require` doesn't help, Metro still walks it.
 * Keeping the package name in an `.android` file is what keeps web building.
 *
 * iOS falls here too: Payhankey has no App Store listing yet, and the library's
 * iOS path drags in `react-native-siren` plus a stale nested
 * `react-native-device-info`. Give iOS its own implementation here when the app
 * ships on the App Store.
 */

export const IN_APP_UPDATES_SUPPORTED = false;

export function createInAppUpdates(_isDebug: boolean): SpInAppUpdates | null {
  return null;
}

export function readBuildNumber(): string | undefined {
  return undefined;
}
