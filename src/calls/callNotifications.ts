import { Platform } from 'react-native';

import type { CallType } from '../api/calls';

/**
 * Android call notifications, on `react-native-notify-kit` (the maintained
 * Notifee fork — Notifee itself was archived 2026-04-07; `expo-notifications`
 * can't do full-screen intents or foreground services).
 *
 * - **Incoming call** — a full-screen-intent notification (`category: call`),
 *   ringing on a loop with the bundled ringtone, with Decline / Answer, that
 *   times out with the call (45s). On a locked phone the full-screen intent
 *   opens the app over the lock screen (see `setShowOverLockScreen`).
 * - **Missed call** — an ordinary notification once a call stops ringing
 *   unanswered while the app was in the background.
 * - **Ongoing call** — a foreground service (types microphone + camera) while
 *   a call is live, so Android keeps the microphone open when the user leaves
 *   the app, with a Hang up action.
 *
 * Everything is a no-op on iOS / web and on an Android binary built before
 * notify-kit was added: it's required lazily and every call is guarded.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NotifyKit = any;

let kit: NotifyKit | null | undefined;

/** The notify-kit module, or null where it isn't available. */
export function loadNotifyKit(): NotifyKit | null {
  if (kit !== undefined) return kit;
  if (Platform.OS !== 'android') return (kit = null);
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    kit = require('react-native-notify-kit');
    // A binary without the native half throws on first use rather than on
    // require, so probe it once.
    void kit.default.getNotificationSettings().catch(() => {
      kit = null;
    });
  } catch {
    kit = null;
  }
  return kit;
}

/** Channel ids are versioned: a channel's sound can't change once created. */
export const INCOMING_CHANNEL = 'payhankey-incoming-calls-v1';
const ONGOING_CHANNEL = 'payhankey-ongoing-calls-v1';
const MISSED_CHANNEL = 'payhankey-missed-calls-v1';

/**
 * How long an incoming call rings before the notification takes itself down.
 * A little past the backend's own 60s expiry of a ringing call (since
 * 2026-10-16), so it's normally the server's `call_cancelled` that takes it
 * down — and leaves a missed-call notice.
 */
export const RING_NOTIFICATION_MS = 65_000;

const ONGOING_ID = 'payhankey-ongoing-call';
export const incomingNotificationId = (callId: string) => `call-${callId}`;
const incomingGroupId = (callId: string) => `payhankey-call-${callId}`;
/** Not `call-…`, so `callIdFromNotificationId` never mistakes it for the ringing one. */
const incomingSummaryId = (callId: string) => `callgroup-${callId}`;
const missedNotificationId = (callId: string) => `missed-${callId}`;

/** Pull the call id back out of one of our notification ids. */
export function callIdFromNotificationId(id: string | undefined | null): string | null {
  return id && id.startsWith('call-') ? id.slice('call-'.length) : null;
}

let channelsReady: Promise<void> | null = null;

function ensureChannels(n: NotifyKit): Promise<void> {
  channelsReady ??= (async () => {
    const { AndroidImportance, AndroidVisibility } = n;
    await n.default.createChannels([
      {
        id: INCOMING_CHANNEL,
        name: 'Incoming calls',
        description: 'Rings when someone calls you on Payhankey.',
        importance: AndroidImportance.HIGH,
        visibility: AndroidVisibility.PUBLIC,
        sound: 'ringtone',
        vibration: true,
        vibrationPattern: [300, 700, 300, 700],
      },
      {
        id: ONGOING_CHANNEL,
        name: 'Ongoing calls',
        description: 'Shown while you’re on a call.',
        importance: AndroidImportance.LOW,
        visibility: AndroidVisibility.PUBLIC,
      },
      {
        id: MISSED_CHANNEL,
        name: 'Missed calls',
        importance: AndroidImportance.DEFAULT,
        visibility: AndroidVisibility.PRIVATE,
      },
    ]);
  })().catch((error) => {
    channelsReady = null;
    throw error;
  });
  return channelsReady;
}

export type IncomingCallInfo = {
  callId: string;
  callerName: string;
  callerAvatar?: string | null;
  callType: CallType;
};

/**
 * Whether each call's notification should be up. Posting is slow — notify-kit
 * downloads the caller's avatar first — so a cancel can overtake a post that
 * started before it, and the post then lands after it and rings on alongside
 * the call screen. A post re-checks this once it's done.
 */
const wanted = new Map<string, boolean>();

/** Ring: show the incoming-call notification. Idempotent per call id. */
export async function showIncomingCallNotification(info: IncomingCallInfo): Promise<void> {
  const n = loadNotifyKit();
  if (!n) return;
  wanted.set(info.callId, true);
  try {
    await ensureChannels(n);
    const { AndroidCategory, AndroidGroupAlertBehavior, AndroidImportance, AndroidVisibility } = n;
    // The call sits in a group of its own, *with* a summary. Android 16
    // force-groups an app's notifications into one bundle — ungrouped ones as
    // soon as there are two, a group without a summary straight away — and
    // everything in that bundle is posted silent: no sound, no heads-up, no
    // full-screen intent. So any other Payhankey notification in the shade (a
    // message, a missed call) silenced the next call. A summary-backed group
    // is only bundled once an app has three such groups. (Verified on the
    // Android 16 emulator; GroupHelper exempts real CallStyle notifications,
    // which notify-kit can't post.) The summary never alerts and renders as
    // the call itself, since it has one child.
    const group = {
      groupId: incomingGroupId(info.callId),
      groupAlertBehavior: AndroidGroupAlertBehavior.CHILDREN,
    };
    await n.default.displayNotification({
      id: incomingSummaryId(info.callId),
      title: info.callerName,
      android: {
        channelId: INCOMING_CHANNEL,
        smallIcon: 'notification_icon',
        color: '#5A4FDC',
        groupSummary: true,
        ongoing: true,
        autoCancel: false,
        timeoutAfter: RING_NOTIFICATION_MS,
        ...group,
      },
    });
    await n.default.displayNotification({
      id: incomingNotificationId(info.callId),
      title: info.callerName,
      body: info.callType === 'video' ? 'Incoming Payhankey video call' : 'Incoming Payhankey voice call',
      data: { callId: info.callId, callType: info.callType, callerName: info.callerName },
      android: {
        channelId: INCOMING_CHANNEL,
        category: AndroidCategory.CALL,
        importance: AndroidImportance.HIGH,
        visibility: AndroidVisibility.PUBLIC,
        smallIcon: 'notification_icon',
        color: '#5A4FDC',
        ongoing: true,
        autoCancel: false,
        loopSound: true,
        // Re-posting the same call (the engine and the push can both ring it)
        // must not restart the ringtone.
        onlyAlertOnce: true,
        lightUpScreen: true,
        timeoutAfter: RING_NOTIFICATION_MS,
        showTimestamp: true,
        ...group,
        ...(info.callerAvatar ? { largeIcon: info.callerAvatar, circularLargeIcon: true } : {}),
        // Tapping the body or the full-screen takeover opens the ringing call
        // screen; Answer opens the app straight into the call.
        pressAction: { id: 'default', launchActivity: 'default' },
        // `mainComponent` (the app's registered component) is only here
        // because it makes notify-kit put this notification on the launch
        // intent, which is how the activity knows to show itself over the
        // lock screen before any JS runs — see CallLockScreenPackage.kt.
        fullScreenAction: { id: 'default', launchActivity: 'default', mainComponent: 'main' },
        actions: [
          { title: 'Decline', pressAction: { id: 'decline' } },
          { title: 'Answer', pressAction: { id: 'answer', launchActivity: 'default' } },
        ],
      },
    });
    if (!wanted.get(info.callId)) await cancelIncomingCallNotification(info.callId);
  } catch (error) {
    if (__DEV__) console.warn('[call] incoming notification failed', String(error));
  }
}

/** Stop ringing: take the incoming-call notification down. */
export async function cancelIncomingCallNotification(callId: string): Promise<void> {
  const n = loadNotifyKit();
  if (!n) return;
  wanted.set(callId, false);
  try {
    await n.default.cancelNotification(incomingNotificationId(callId));
    await n.default.cancelNotification(incomingSummaryId(callId));
  } catch {
    // Already gone.
  }
}

/** The incoming-call notification for this call (or any), if it's still up. */
export async function findIncomingCallNotification(
  callId?: string,
): Promise<{ callId: string; callerName: string; callType: CallType } | null> {
  const n = loadNotifyKit();
  if (!n) return null;
  try {
    const shown: {
      id?: string;
      notification?: { id?: string; title?: string; data?: Record<string, unknown> };
    }[] = await n.default.getDisplayedNotifications();
    for (const entry of shown) {
      const id = callIdFromNotificationId(entry.notification?.id ?? entry.id);
      if (id && (!callId || id === callId)) {
        return {
          callId: id,
          callerName: entry.notification?.title ?? '',
          callType: entry.notification?.data?.callType === 'video' ? 'video' : 'audio',
        };
      }
    }
  } catch {
    // Nothing readable.
  }
  return null;
}

/** "Missed call from …" — after a call stopped ringing unanswered in the background. */
export async function showMissedCallNotification(callId: string, callerName: string, callType: CallType) {
  const n = loadNotifyKit();
  if (!n) return;
  try {
    await ensureChannels(n);
    await n.default.displayNotification({
      id: missedNotificationId(callId),
      title: callerName ? `Missed call from ${callerName}` : 'Missed call',
      body: callType === 'video' ? 'Missed video call' : 'Missed voice call',
      data: { missedCallId: callId },
      android: {
        channelId: MISSED_CHANNEL,
        smallIcon: 'notification_icon',
        color: '#5A4FDC',
        autoCancel: true,
        showTimestamp: true,
        pressAction: { id: 'missed', launchActivity: 'default' },
      },
    });
  } catch {
    // Best-effort.
  }
}

let ongoingShown = false;

/**
 * Keep the call alive in the background: a foreground service of type
 * microphone (+ camera for video). Android silences the microphone of an app
 * that leaves the screen unless one is running. Start it only while the app is
 * in the foreground — Android refuses to start these types from the background.
 */
export async function startOngoingCallService(peerName: string, withCamera: boolean): Promise<void> {
  const n = loadNotifyKit();
  if (!n || ongoingShown) return;
  try {
    await ensureChannels(n);
    const { AndroidForegroundServiceType } = n;
    ongoingShown = true;
    await n.default.displayNotification({
      id: ONGOING_ID,
      title: `On a call with ${peerName}`,
      body: 'Tap to return to the call',
      android: {
        channelId: ONGOING_CHANNEL,
        smallIcon: 'notification_icon',
        color: '#5A4FDC',
        // Colorized foreground-service notifications are exempt from Android
        // 16's force-grouping, so a live call is never folded into a bundle.
        colorized: true,
        asForegroundService: true,
        foregroundServiceTypes: [
          AndroidForegroundServiceType.FOREGROUND_SERVICE_TYPE_MICROPHONE,
          ...(withCamera ? [AndroidForegroundServiceType.FOREGROUND_SERVICE_TYPE_CAMERA] : []),
        ],
        ongoing: true,
        showChronometer: true,
        pressAction: { id: 'default', launchActivity: 'default' },
        actions: [{ title: 'Hang up', pressAction: { id: 'hangup' } }],
      },
    });
  } catch (error) {
    ongoingShown = false;
    if (__DEV__) console.warn('[call] ongoing service failed', String(error));
  }
}

export async function stopOngoingCallService(): Promise<void> {
  const n = loadNotifyKit();
  if (!n || !ongoingShown) return;
  ongoingShown = false;
  try {
    await n.default.stopForegroundService();
    await n.default.cancelNotification(ONGOING_ID);
  } catch {
    // Already stopped.
  }
}

/**
 * The foreground service's task. notify-kit keeps the service up until the
 * promise settles; `stopForegroundService()` ends it. Registered once, at
 * startup, by src/calls/backgroundCalls.ts.
 */
export function registerOngoingCallService(): void {
  const n = loadNotifyKit();
  if (!n) return;
  try {
    n.default.registerForegroundService(() => new Promise<void>(() => {}));
  } catch {
    // Already registered.
  }
}

/** Is full-screen-intent access available (Android 14+ can withhold it)? */
export async function fullScreenIntentEnabled(): Promise<boolean> {
  const n = loadNotifyKit();
  if (!n) return true;
  try {
    const settings = await n.default.getNotificationSettings();
    return settings?.android?.fullScreenIntent !== n.AndroidNotificationSetting.DISABLED;
  } catch {
    return true;
  }
}
