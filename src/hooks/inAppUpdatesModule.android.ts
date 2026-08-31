import type SpInAppUpdates from 'sp-react-native-in-app-updates';

/**
 * Android half of the platform split — see `./inAppUpdatesModule.ts` for why it
 * exists. Only this file ever names `sp-react-native-in-app-updates`, so the
 * package (which ships no web build and would break the web bundle) is reached
 * exclusively from the Android bundle.
 */

export const IN_APP_UPDATES_SUPPORTED = true;

export function createInAppUpdates(isDebug: boolean): SpInAppUpdates | null {
  const Ctor = require('sp-react-native-in-app-updates').default;
  return new Ctor(isDebug);
}

/** Installed `versionCode`, as a string. */
export function readBuildNumber(): string | undefined {
  const { getBuildNumber } = require('react-native-device-info');
  return String(getBuildNumber());
}
