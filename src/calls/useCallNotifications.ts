import { useEffect } from 'react';
import { AppState } from 'react-native';

import { setShowOverLockScreen } from '../../modules/call-lock-screen';
import { resumeIncomingCall } from './callEngine';
import { handleCallNotificationEvent, setInAppCallHandler } from './callNotificationEvents';
import { findIncomingCallNotification, loadNotifyKit } from './callNotifications';
import { useCallStore } from './callStore';

/**
 * The in-app half of the call notifications (Android), mounted while signed
 * in. The headless half is src/calls/backgroundCalls.ts.
 *
 * - On launch, `getInitialNotification()` says whether the app was opened from
 *   a call notification, and how (Answer, or a tap / the full-screen takeover).
 * - Any time the app comes to the front while a call notification is still
 *   ringing — opened from the launcher, say — that call is picked up on screen,
 *   because its socket `incoming_call` went out before anyone was listening.
 * - While the app runs, taps arrive as foreground events, and a call push
 *   that reaches this process is handed to the engine (see
 *   `setInAppCallHandler`).
 */
export function useCallNotifications() {
  useEffect(() => {
    const kit = loadNotifyKit();
    if (!kit) return;
    let cancelled = false;
    setInAppCallHandler((callId) => void resumeIncomingCall(callId));

    const pickUpRinging = async () => {
      const ringing = await findIncomingCallNotification();
      if (ringing && !cancelled) await resumeIncomingCall(ringing.callId);
    };

    void (async () => {
      let initial: { notification?: { id?: string } | null; pressAction?: { id?: string } | null } | null = null;
      try {
        initial = await kit.default.getInitialNotification();
      } catch {
        // No launch notification.
      }
      if (cancelled) return;
      if (initial?.notification) {
        const action = initial.pressAction?.id;
        await handleCallNotificationEvent({
          type: action && action !== 'default' ? kit.EventType.ACTION_PRESS : kit.EventType.PRESS,
          detail: { notification: initial.notification, pressAction: initial.pressAction },
        });
      } else {
        await pickUpRinging();
      }
      // A full-screen launch put the activity over the lock screen before any
      // JS ran (CallLockScreenPackage.kt). If it didn't end in a call on
      // screen — the call stopped ringing meanwhile, say — take that back.
      if (!cancelled && !useCallStore.getState().call) setShowOverLockScreen(false);
    })();

    let unsubscribe = () => {};
    try {
      unsubscribe = kit.default.onForegroundEvent((event: Parameters<typeof handleCallNotificationEvent>[0]) => {
        void handleCallNotificationEvent(event);
      });
    } catch {
      // notify-kit missing on this binary.
    }

    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') void pickUpRinging();
    });

    return () => {
      cancelled = true;
      setInAppCallHandler(null);
      unsubscribe();
      appState.remove();
    };
  }, []);
}
