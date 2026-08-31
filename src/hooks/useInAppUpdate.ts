import Constants, { ExecutionEnvironment } from 'expo-constants';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import type SpInAppUpdates from 'sp-react-native-in-app-updates';
import type { InstallationResult, StatusUpdateEvent } from 'sp-react-native-in-app-updates';

import {
  createInAppUpdates,
  IN_APP_UPDATES_SUPPORTED,
  readBuildNumber,
} from './inAppUpdatesModule';

/**
 * Google Play in-app updates — ported from the Freebyz app.
 *
 * `useUpdateCheck` runs once at launch and, when Play reports a newer build,
 * routes to `/app-update`. That screen drives `useAppUpdateFlow`, which starts a
 * FLEXIBLE update: Play downloads the new bundle in the background, reports
 * progress, and we install it as soon as the download completes.
 *
 * Android only, and never inside Expo Go — see `./inAppUpdatesModule.ts` for the
 * platform split and why iOS and web sit it out.
 */

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

/** Play in-app updates exist on Android only, and never inside Expo Go / web. */
const inAppUpdatesSupported = IN_APP_UPDATES_SUPPORTED && !isExpoGo;

/**
 * The library's own enums live behind the package entry point, which also
 * imports the native module — so they're mirrored here and the package itself
 * is only ever `require`d on a platform that has it.
 * (Values from sp-react-native-in-app-updates/src/types.ts.)
 */
const InstallStatus = {
  UNKNOWN: 0,
  PENDING: 1,
  DOWNLOADING: 2,
  INSTALLING: 3,
  INSTALLED: 4,
  FAILED: 5,
  CANCELED: 6,
  DOWNLOADED: 11,
} as const;

/** FLEXIBLE keeps the app usable while Play downloads in the background. */
const UPDATE_TYPE_FLEXIBLE = 0;

let instance: SpInAppUpdates | null = null;
let instanceResolved = false;

/**
 * One shared instance: the status listener the update flow registers has to sit
 * on the same object `startUpdate` is called on. Required lazily so neither web
 * nor Expo Go ever evaluates the native module's JS.
 */
function getInAppUpdates(): SpInAppUpdates | null {
  if (instanceResolved) return instance;
  instanceResolved = true;

  if (!inAppUpdatesSupported) return null;

  try {
    instance = createInAppUpdates(__DEV__);
  } catch (error) {
    console.warn('SpInAppUpdates native module unavailable:', error);
    instance = null;
  }

  return instance;
}

/** Version name of this binary (1.0.1) — what the user is shown. */
export function currentVersionName(): string {
  return Constants.expoConfig?.version ?? '';
}

/**
 * Version *code* of this binary ("7"), as a string.
 *
 * This is what `checkNeedsUpdate` must be given on Android: the library reports
 * Play's `versionCode` as `storeVersion` and semver-compares it against
 * `curVersion`, so handing it the version *name* compares "7" with "1.0.1" —
 * apples to oranges, and permanently true once the version code passes the
 * major. Comparing code against code is the only correct pairing.
 */
function currentVersionCode(): string | undefined {
  try {
    return readBuildNumber();
  } catch (error) {
    console.warn('Could not read the build number:', error);
    return undefined;
  }
}

/** Only ask Play once per launch — a second check would re-route the user. */
let checkedThisLaunch = false;

/**
 * Asks Play whether a newer build is live and routes to `/app-update` if so.
 * Resolves to whether the user was sent to the update screen.
 */
export function useUpdateCheck() {
  const router = useRouter();

  const checkForUpdate = useCallback(async () => {
    const inAppUpdates = getInAppUpdates();
    if (!inAppUpdates || checkedThisLaunch) return false;
    checkedThisLaunch = true;

    try {
      const result = await inAppUpdates.checkNeedsUpdate({
        curVersion: currentVersionCode(),
      });
      if (!result.shouldUpdate) return false;

      router.push({
        pathname: '/app-update',
        params: { current: currentVersionName() },
      });
      return true;
    } catch (error) {
      // A failed check must never block launch — the user simply keeps the
      // version they have.
      console.warn('In-app update check failed:', error);
      return false;
    }
  }, [router]);

  return { checkForUpdate };
}

export type AppUpdateFlow = {
  /** 0-100 while Play downloads; stays 0 where Play sends no byte counts. */
  downloadProgress: number;
  /** Human-readable step, shown under the progress bar. */
  installStatus: string;
  isUpdating: boolean;
  handleUpdate: () => Promise<void>;
};

/** Download + install half of the flow, driven by the `/app-update` screen. */
export function useAppUpdateFlow(): AppUpdateFlow {
  const [isUpdating, setIsUpdating] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [installStatus, setInstallStatus] = useState('');
  // Play re-emits DOWNLOADED; installing twice throws.
  const hasInstalled = useRef(false);

  // Subscribed on mount rather than inside handleUpdate: registering before
  // startUpdate is what guarantees the first progress events aren't missed, and
  // one registration means no stacking listeners if the button is pressed twice.
  useEffect(() => {
    const inAppUpdates = getInAppUpdates();
    if (!inAppUpdates) return;

    const onStatus = (status: StatusUpdateEvent) => {
      if (status?.bytesDownloaded && status?.totalBytesToDownload) {
        setDownloadProgress(
          Math.round((status.bytesDownloaded / status.totalBytesToDownload) * 100),
        );
      }

      switch (status.status) {
        case InstallStatus.DOWNLOADING:
          setInstallStatus('Downloading update…');
          break;

        case InstallStatus.DOWNLOADED:
          setDownloadProgress(100);
          setInstallStatus('Download complete. Installing…');

          if (!hasInstalled.current) {
            hasInstalled.current = true;
            // Let the 100% frame paint before Play takes over the screen.
            setTimeout(() => {
              try {
                inAppUpdates.installUpdate();
              } catch (error) {
                console.warn('In-app update install failed:', error);
                setIsUpdating(false);
                setInstallStatus('Install failed');
                Alert.alert(
                  'Install failed',
                  'Could not install the update. Please try again, or update Payhankey from the Play Store.',
                );
              }
            }, 500);
          }
          break;

        case InstallStatus.INSTALLING:
          setInstallStatus('Installing…');
          break;

        case InstallStatus.INSTALLED:
          // Play restarts the app itself from here.
          setInstallStatus('Update installed. Restarting…');
          setIsUpdating(false);
          break;

        case InstallStatus.FAILED:
          setIsUpdating(false);
          setInstallStatus('Update failed');
          Alert.alert('Update failed', 'The update failed to download. Please try again.');
          break;

        case InstallStatus.CANCELED:
          setIsUpdating(false);
          setDownloadProgress(0);
          setInstallStatus('');
          break;

        default:
          break;
      }
    };

    /**
     * Result of Play's own consent dialog. Without this a declined update leaves
     * the button spinning on "Starting download…" forever, because `startUpdate`
     * resolves once the dialog is *shown* — the answer only arrives here.
     * The native side sends the code as a string.
     */
    const onIntentResult = (result: InstallationResult) => {
      if (Number(result) === InstallStatus.CANCELED) {
        setIsUpdating(false);
        setDownloadProgress(0);
        setInstallStatus('');
      }
    };

    inAppUpdates.addStatusUpdateListener(onStatus);
    inAppUpdates.addIntentSelectionListener(onIntentResult);

    return () => {
      inAppUpdates.removeStatusUpdateListener(onStatus);
      inAppUpdates.removeIntentSelectionListener(onIntentResult);
    };
  }, []);

  const handleUpdate = useCallback(async () => {
    const inAppUpdates = getInAppUpdates();

    if (!inAppUpdates) {
      Alert.alert(
        'Update unavailable',
        'In-app updates need the Play Store build of Payhankey. Please update from the store.',
      );
      return;
    }

    try {
      setIsUpdating(true);
      setInstallStatus('Checking for update…');
      hasInstalled.current = false;

      const result = await inAppUpdates.checkNeedsUpdate({
        curVersion: currentVersionCode(),
      });

      if (!result.shouldUpdate) {
        setIsUpdating(false);
        setInstallStatus('');
        Alert.alert('No update', "You're already on the latest version of Payhankey.");
        return;
      }

      setInstallStatus('Starting download…');
      // FLEXIBLE: Play downloads in the background and the app stays usable
      // until installUpdate() runs above.
      await inAppUpdates.startUpdate({ updateType: UPDATE_TYPE_FLEXIBLE });
    } catch (error) {
      console.warn('In-app update failed to start:', error);
      setIsUpdating(false);
      setInstallStatus('');
      Alert.alert(
        'Update error',
        'Failed to start the update. Please try again, or update Payhankey from the Play Store.',
      );
    }
  }, []);

  return { downloadProgress, installStatus, isUpdating, handleUpdate };
}
