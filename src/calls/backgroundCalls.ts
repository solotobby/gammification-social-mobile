import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { AppState, Platform } from 'react-native';

import { fetchCall } from '../api/calls';
import { useAuthStore } from '../stores/authStore';
import { ensureSession, handleCallNotificationEvent, handOffCallToApp } from './callNotificationEvents';
import {
  cancelIncomingCallNotification,
  findIncomingCallNotification,
  loadNotifyKit,
  registerOngoingCallService,
  showIncomingCallNotification,
  showMissedCallNotification,
} from './callNotifications';

/**
 * Ringing a phone whose app is closed or locked (Android). Imported first
 * thing by the app entry (`index.ts`), because all of this has to be in place
 * when Android wakes the JS bundle *without* any screen — a background push,
 * or a tap on a notification action.
 *
 * Since 2026-10-15 the backend sends incoming calls as **data-only** pushes
 * (verified on Android): `{type: "call_incoming", call_id, caller_id,
 * caller_name, caller_avatar, call_type, conversation_id, channel_name}`, and
 * `{type: "call_cancelled", call_id}` once it stops ringing — high priority,
 * `ttl: 45`. Data-only means Android shows nothing by itself; this task is what
 * turns them into a ringing, full-screen notification.
 *
 * In the foreground the socket already rang the call screen, so the push is
 * ignored there.
 */
export const CALL_PUSH_TASK = 'payhankey-call-push';

type CallPush = {
  type?: string;
  call_id?: string;
  caller_name?: string;
  caller_avatar?: string | null;
  call_type?: string;
};

/** The push's own payload, out of whatever envelope the task hands over. */
function readCallPush(payload: unknown): CallPush | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as { data?: { dataString?: string; [key: string]: unknown } };
  const raw = p.data?.dataString;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as CallPush;
    } catch {
      return null;
    }
  }
  const data = p.data as CallPush | undefined;
  return data?.type ? data : null;
}

async function onCallPush(push: CallPush): Promise<void> {
  const callId = push.call_id;
  if (!callId) return;
  // Signing out doesn't unregister the device's push token (see "Push
  // notifications" in AGENTS.md), so a signed-out phone can still be pushed
  // the last account's calls. It must never ring for them.
  await ensureSession();
  if (useAuthStore.getState().status !== 'signedIn') return;

  if (push.type === 'call_incoming') {
    if (AppState.currentState === 'active') return;
    await showIncomingCallNotification({
      callId,
      callerName: push.caller_name?.trim() || 'Someone',
      callerAvatar: push.caller_avatar ?? null,
      callType: push.call_type === 'video' ? 'video' : 'audio',
    });
    handOffCallToApp(callId);
    return;
  }

  if (push.type === 'call_cancelled') {
    const ringing = await findIncomingCallNotification(callId);
    await cancelIncomingCallNotification(callId);
    if (!ringing || AppState.currentState === 'active') return;
    // "Stopped ringing" covers answered-elsewhere as well as missed: ask.
    let missed = true;
    try {
      const call = await fetchCall(callId);
      missed = call.status !== 'ongoing' && call.status !== 'completed';
    } catch {
      // Unknown — a missed-call notice is the safer guess.
    }
    if (missed) {
      await showMissedCallNotification(callId, ringing.callerName, ringing.callType);
    }
  }
}

if (Platform.OS === 'android') {
  try {
    TaskManager.defineTask(CALL_PUSH_TASK, async ({ data, error }) => {
      if (error) return;
      const push = readCallPush(data);
      if (__DEV__) console.log('[call] push task', push?.type, push?.call_id, AppState.currentState);
      if (push) await onCallPush(push);
    });
    void Notifications.registerTaskAsync(CALL_PUSH_TASK).catch(() => {
      // A binary without expo-task-manager: calls ring only in the app.
    });
  } catch {
    // Same — nothing to register on this binary.
  }

  const kit = loadNotifyKit();
  try {
    kit?.default.onBackgroundEvent(async (event: Parameters<typeof handleCallNotificationEvent>[0]) => {
      await handleCallNotificationEvent(event);
    });
  } catch {
    // notify-kit missing on this binary.
  }
  registerOngoingCallService();
}
