import { rejectCall } from '../api/calls';
import { useAuthStore } from '../stores/authStore';
import { declineIfRinging, hangUp, resumeIncomingCall } from './callEngine';
import {
  callIdFromNotificationId,
  cancelIncomingCallNotification,
  loadNotifyKit,
  stopOngoingCallService,
} from './callNotifications';

/**
 * The running app's hand-off for a call push, set while the signed-in UI is
 * mounted (`useCallNotifications`). A push can land in a process whose UI is
 * up but backgrounded, its socket already let go — and then the full-screen
 * intent brings the activity up *behind* the lock screen, where it never
 * becomes active and nothing would present the call. Handing the call to the
 * engine presents the call screen, which is what shows it over the lock
 * screen. In a headless process nothing is set, and the notification is all.
 */
let inAppCallHandler: ((callId: string) => void) | null = null;

export function setInAppCallHandler(handler: ((callId: string) => void) | null): void {
  inAppCallHandler = handler;
}

export function handOffCallToApp(callId: string): void {
  inAppCallHandler?.(callId);
}

/**
 * What a tap on one of our call notifications does — shared by the in-app
 * listener (`onForegroundEvent`, `getInitialNotification`) and the headless
 * one (`onBackgroundEvent`, registered at startup in backgroundCalls.ts).
 *
 * - **Decline** never needs the app on screen: if this process is already
 *   ringing for the call, the engine declines it; otherwise (the app was
 *   killed) it's a straight `POST /calls/{id}/reject` with the stored session.
 * - **Answer** opens the app (the action's `launchActivity`) and picks the
 *   call up as soon as the socket is ready.
 * - **Tapping the notification** (or the full-screen takeover) opens the app
 *   on the ringing call, without answering.
 * - **Hang up** on the ongoing-call notification ends the call.
 */
export async function handleCallNotificationEvent(event: {
  type: number;
  detail?: { notification?: { id?: string } | null; pressAction?: { id?: string } | null };
}): Promise<void> {
  const n = loadNotifyKit();
  if (!n) return;
  const { EventType } = n;
  const action = event.detail?.pressAction?.id;
  const callId = callIdFromNotificationId(event.detail?.notification?.id);

  if (event.type === EventType.ACTION_PRESS && action === 'hangup') {
    hangUp();
    await stopOngoingCallService();
    return;
  }
  if (!callId) return;

  if (event.type === EventType.ACTION_PRESS && action === 'decline') {
    await cancelIncomingCallNotification(callId);
    if (declineIfRinging(callId)) return;
    await ensureSession();
    try {
      await rejectCall(callId, 'user_declined');
    } catch {
      // Already over — nothing to decline.
    }
    return;
  }

  if (event.type === EventType.ACTION_PRESS && action === 'answer') {
    await ensureSession();
    await resumeIncomingCall(callId, { autoAccept: true });
    return;
  }

  if (event.type === EventType.PRESS) {
    await ensureSession();
    await resumeIncomingCall(callId);
  }
}

/**
 * A headless start (the app was killed) runs before the root layout has read
 * the session back from the keychain, so the API client would have no token.
 */
export async function ensureSession(): Promise<void> {
  const auth = useAuthStore.getState();
  if (auth.status === 'hydrating') await auth.hydrate();
}
