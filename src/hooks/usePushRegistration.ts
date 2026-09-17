import Constants from 'expo-constants';
import * as Application from 'expo-application';
import * as Device from 'expo-device';
import * as Network from 'expo-network';
import * as Notifications from 'expo-notifications';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';

import { registerDeviceToken } from '../api/notifications';
import type { DeviceTokenPayload } from '../api/types';
import { useAuthStore } from '../stores/authStore';

/**
 * Push registration — ask for permission, get the Expo push token, and send it
 * to `POST /notifications/device-token` with what the device can tell us about
 * itself.
 *
 * **Where the prompt happens, and why it is not at launch.** This runs from
 * Home, the first screen after auth, rather than from the root layout. iOS
 * gives an app exactly one chance to ask: once someone taps "Don't Allow", the
 * only way back is the Settings app, so the ask has to land when the app has
 * already shown what it is. Firing it over the splash screen — before the user
 * has seen a single post — is the reliable way to get a permanent no.
 *
 * **Everything here fails silently.** A refused permission, a simulator with
 * no APNs, an offline device, a 500 from the endpoint — none of it is the
 * user's problem and none of it should interrupt the feed. Push is an
 * enhancement; the app works identically without it.
 */

/**
 * Show a push that lands while the app is in the foreground.
 *
 * Without a handler, expo-notifications drops foreground notifications
 * entirely — the payload arrives and nothing is drawn — which looks exactly
 * like push being broken. Set at module scope so it is installed before any
 * notification can be delivered.
 *
 * `shouldShowBanner`/`shouldShowList` replaced the old single
 * `shouldShowAlert` in SDK 53+.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Map expo-network's connection type onto the backend's `location_type`
 * vocabulary (its example sends "cellular").
 *
 * Anything exotic — VPN, Bluetooth tethering, WiMAX — reports `unknown` rather
 * than being forced into a bucket it doesn't belong in.
 */
function connectionType(type: Network.NetworkStateType | undefined): string {
  switch (type) {
    case Network.NetworkStateType.WIFI:
      return 'wifi';
    case Network.NetworkStateType.CELLULAR:
      return 'cellular';
    case Network.NetworkStateType.ETHERNET:
      return 'ethernet';
    default:
      return 'unknown';
  }
}

/**
 * A stable id for this install.
 *
 * iOS: `identifierForVendor`, which survives app updates and resets when every
 * app from this vendor is removed. Android: `ANDROID_ID`, per app-signing-key
 * and per user. Neither is a hardware serial, which is the point — both are
 * exactly the "which device is this" handle the backend needs, and neither can
 * be used to track someone across vendors.
 */
async function deviceId(): Promise<string | undefined> {
  try {
    if (Platform.OS === 'ios') {
      return (await Application.getIosIdForVendorAsync()) ?? undefined;
    }
    if (Platform.OS === 'android') return Application.getAndroidId() ?? undefined;
  } catch {
    // An id we can't read is a column the backend leaves null, not a failure.
  }
  return undefined;
}

/** "Alan's iPhone" when the OS exposes it, else the model. */
function deviceName(): string | undefined {
  const named = Device.deviceName?.trim();
  if (named) return named;
  const model = [Device.manufacturer, Device.modelName].filter(Boolean).join(' ').trim();
  return model || undefined;
}

/**
 * The EAS project id, which `getExpoPushTokenAsync` needs in any build that
 * isn't Expo Go. It lives under `extra.eas.projectId` in app.json;
 * `easConfig.projectId` is where the manifest surfaces it at runtime.
 */
function projectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId
  );
}

/**
 * Ask, collect, send. Returns the token on success and null on any refusal or
 * failure — callers use it for logging only.
 */
export async function registerForPush(): Promise<string | null> {
  // A simulator has no APNs/FCM registration to hand out, so the token request
  // throws. Bail before the permission dialog rather than prompting for
  // something that cannot be delivered.
  if (!Device.isDevice) return null;

  try {
    // Android needs a channel before a notification can be shown at all, and
    // creating it up front means the first push doesn't land silently.
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Payhankey',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    // Ask only if we haven't been answered before: requesting again after a
    // denial is a no-op on iOS, and re-prompting an already-granted user is
    // wasted work.
    const existing = await Notifications.getPermissionsAsync();
    const status = existing.granted
      ? existing
      : existing.canAskAgain
        ? await Notifications.requestPermissionsAsync()
        : existing;
    if (!status.granted) return null;

    const { data: token } = await Notifications.getExpoPushTokenAsync({
      projectId: projectId(),
    });
    if (!token) return null;

    const network = await Network.getNetworkStateAsync().catch(() => undefined);

    const payload: DeviceTokenPayload = {
      token,
      platform: Platform.OS === 'android' ? 'android' : Platform.OS === 'ios' ? 'ios' : 'web',
      device_name: deviceName(),
      device_id: await deviceId(),
      location_type: connectionType(network?.type),
      // `ip_address` and `location` are deliberately omitted — see
      // `registerDeviceToken` for why.
    };

    await registerDeviceToken(payload);
    return token;
  } catch {
    // Silent by design — see the module comment.
    return null;
  }
}

/**
 * Register this device for push once per signed-in session.
 *
 * Keyed on the user's id, so signing into a different account on the same
 * device registers the token against that account too — otherwise the second
 * user would never receive anything, since the row is owned by whoever
 * registered it.
 */
export function usePushRegistration() {
  const userId = useAuthStore((s) => s.user?.id);
  const token = useAuthStore((s) => s.token);
  const queryClient = useQueryClient();
  // Which account this device has already been registered for this session.
  const registeredFor = useRef<string | null>(null);

  useEffect(() => {
    if (!token || !userId) return;
    if (registeredFor.current === userId) return;
    registeredFor.current = userId;
    void registerForPush();
  }, [token, userId]);

  /**
   * Tapping a notification opens the notifications screen.
   *
   * Deliberately **not** deep-linked to the post/community the payload refers
   * to: no engagement writes a notification row on staging (see
   * `src/api/notifications.ts`), so there is no real payload to read the ids
   * out of, and a route built on a guessed field name would send people to the
   * wrong place. The list is always correct. Narrow this once real rows exist.
   */
  useEffect(() => {
    if (!token) return;
    const subscription = Notifications.addNotificationResponseReceivedListener(() => {
      // The prefix covers both `['notifications','list']` and the badge's
      // `['notifications','unread-count']`.
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      router.push('/notifications');
    });
    return () => subscription.remove();
  }, [queryClient, token]);
}
