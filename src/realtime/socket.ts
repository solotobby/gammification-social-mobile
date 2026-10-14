import { onlineManager } from '@tanstack/react-query';
import axios from 'axios';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { create } from 'zustand';

import { useAuthStore } from '../stores/authStore';
import { PusherSocket, type EventHandler, type SocketState } from './PusherSocket';

/**
 * The app's one realtime connection — Laravel Reverb at
 * `wss://pky.e-portal.com.ng/app/<key>`, Pusher protocol 7.
 *
 * Mounted by `useRealtimeConnection()` while signed in. Screens never open
 * their own socket; they hold channels on this one through `useChannel`.
 *
 * Verified live 2026-10-14:
 * - **Channel auth is `POST /v1/broadcasting/auth`** — on the bare `/v1`
 *   prefix, *not* the REST API's `/api/v1` (that path 404s). Bearer token,
 *   JSON or form body; answers `{auth}` (plus `channel_data` on presence).
 *   Someone else's `private-user.*` is a 403.
 * - The key, host and path match the mobile integration guide.
 */

const REVERB_HOST = 'pky.e-portal.com.ng';
const REVERB_KEY = 'doddcvycupo6fnqil402';
const AUTH_URL = `https://${REVERB_HOST}/v1/broadcasting/auth`;

/** How long a backgrounded app keeps its socket before letting it go. */
const BACKGROUND_GRACE_MS = 60_000;

type RealtimeState = { state: SocketState };

/** Connection state for the UI — e.g. to slow polling down while the socket is live. */
export const useRealtimeStore = create<RealtimeState>(() => ({ state: 'idle' }));

const log = __DEV__ ? (...args: unknown[]) => console.log('[realtime]', ...args) : undefined;

export const realtime = new PusherSocket({
  url: `wss://${REVERB_HOST}/app/${REVERB_KEY}?protocol=7&client=js&version=8.4.0&flash=false`,
  authorize: async (channel, socketId) => {
    const token = useAuthStore.getState().token;
    if (!token) throw new Error('signed out');
    const { data } = await axios.post(
      AUTH_URL,
      { socket_id: socketId, channel_name: channel },
      {
        timeout: 15_000,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      },
    );
    if (!data?.auth) throw new Error('no signature');
    return data;
  },
  onStateChange: (state) => {
    log?.('state', state);
    useRealtimeStore.setState({ state });
  },
  log,
});

/** The live socket's id, for `X-Socket-ID` — lets the backend skip echoing our own writes. */
export function realtimeSocketId(): string | null {
  return realtime.state === 'connected' ? realtime.socketId : null;
}

/** True while the socket is connected — the cue for polling to back off. */
export function useRealtimeConnected(): boolean {
  return useRealtimeStore((s) => s.state === 'connected');
}

/**
 * Keep things that must not drop mid-way alive in the background — an active
 * call registers here so the socket carrying its signalling isn't closed under
 * it by the background grace period.
 */
const holds = new Set<string>();
export function holdRealtime(reason: string): () => void {
  holds.add(reason);
  realtime.start();
  return () => {
    holds.delete(reason);
  };
}

/**
 * Owns the connection's lifecycle. Mounted once, app-wide, while signed in:
 * connects, follows the network (via the same `onlineManager` React Query
 * uses), reconnects the instant the app is foregrounded, and lets the socket
 * go a minute after the app is backgrounded — iOS suspends it anyway, and on
 * Android an idle socket in a pocket is a battery cost nobody asked for.
 * Signing out drops every channel so the next account starts clean.
 */
export function useRealtimeConnection() {
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    if (!token) return;
    if (onlineManager.isOnline()) realtime.start();

    let backgroundTimer: ReturnType<typeof setTimeout> | null = null;
    const clearBackgroundTimer = () => {
      if (backgroundTimer) clearTimeout(backgroundTimer);
      backgroundTimer = null;
    };

    const unsubscribeOnline = onlineManager.subscribe((online) => {
      if (online) {
        realtime.start();
        realtime.reconnectNow();
      } else if (holds.size === 0) {
        realtime.stop();
      }
    });

    const appState = AppState.addEventListener('change', (status) => {
      if (status === 'active') {
        clearBackgroundTimer();
        if (onlineManager.isOnline()) {
          realtime.start();
          realtime.reconnectNow();
        }
      } else if (status === 'background') {
        clearBackgroundTimer();
        backgroundTimer = setTimeout(() => {
          if (holds.size === 0 && AppState.currentState !== 'active') realtime.stop();
        }, BACKGROUND_GRACE_MS);
      }
    });

    return () => {
      clearBackgroundTimer();
      unsubscribeOnline();
      appState.remove();
      // Sign-out or a different account: nothing subscribed under the old
      // token may carry over.
      realtime.reset();
    };
  }, [token]);
}

/**
 * Hold `channel` open while mounted and route its events to `handlers`.
 * Pass `null` to hold nothing (e.g. until an id is known). Handlers are read
 * through a ref, so passing a fresh object each render costs no resubscribe.
 */
export function useChannel(
  channel: string | null | undefined,
  handlers: Record<string, EventHandler>,
) {
  const latest = useRef(handlers);
  latest.current = handlers;
  const events = Object.keys(handlers).sort().join('|');

  useEffect(() => {
    if (!channel) return;
    const unbinds = events
      .split('|')
      .filter(Boolean)
      .map((event) =>
        realtime.bind(channel, event, (data, name) => latest.current[event]?.(data, name)),
      );
    const release = realtime.subscribe(channel);
    return () => {
      release();
      unbinds.forEach((unbind) => unbind());
    };
  }, [channel, events]);
}
