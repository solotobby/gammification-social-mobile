/**
 * A Pusher-protocol (v7) client over React Native's built-in WebSocket.
 *
 * The backend is Laravel Reverb, which speaks the Pusher protocol. `pusher-js`
 * would do the job on the web, but its React Native build pulls in
 * `@react-native-community/netinfo` — a native module, so a new binary — for
 * the one thing it uses it for: noticing the network came back. The app
 * already tracks connectivity (`onlineManager`, src/api/network.ts), so the
 * socket takes its cues from there and this file stays plain JS.
 *
 * What it handles, all verified against wss://pky.e-portal.com.ng on
 * 2026-10-14:
 *
 * - `pusher:connection_established` hands over the `socket_id` that channel
 *   auth signs, plus the `activity_timeout` (30s) the ping cadence follows.
 * - **Private and presence channels authorise per connection**: the signature
 *   covers the socket id, so every reconnect re-authorises every channel.
 * - Channels are **reference counted**. Two screens can hold the same channel;
 *   it unsubscribes when the last one lets go, and survives reconnects
 *   meanwhile.
 * - Presence membership (`pusher_internal:member_added|removed`) is tracked
 *   here and re-emitted as `pusher:member_added|removed`, the names Pusher's
 *   own clients use.
 * - Close/error codes follow the protocol: 4000–4099 are fatal (don't retry),
 *   4100–4199 back off, 4200–4299 reconnect at once.
 */

export type SocketState = 'idle' | 'connecting' | 'connected' | 'waiting' | 'failed';

export type ChannelAuth = { auth: string; channel_data?: string };

/** Signs a private/presence subscription. Throw to refuse it. */
export type Authorizer = (channel: string, socketId: string) => Promise<ChannelAuth>;

export type PresenceMember = { id: string; info: Record<string, unknown> };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type EventHandler = (data: any, channel: string) => void;

type Channel = {
  name: string;
  refs: number;
  /** Subscribed on the current connection. */
  subscribed: boolean;
  /** Bumped per subscribe attempt, so a slow auth for a dead connection is dropped. */
  attempt: number;
  handlers: Map<string, Set<EventHandler>>;
  members: Map<string, PresenceMember>;
};

type Options = {
  url: string;
  authorize: Authorizer;
  onStateChange?: (state: SocketState) => void;
  log?: (...args: unknown[]) => void;
};

/** Retry delays after an unexpected drop. Reset by every successful connect. */
const BACKOFF_MS = [1_000, 2_000, 4_000, 8_000, 15_000, 30_000];
/** How long to wait for a pong before calling the connection dead. */
const PONG_TIMEOUT_MS = 30_000;
/** A handshake that hasn't produced `connection_established` by now is retried. */
const CONNECT_TIMEOUT_MS = 15_000;

const isPrivate = (name: string) => name.startsWith('private-') || name.startsWith('presence-');
const isPresence = (name: string) => name.startsWith('presence-');

function parse(data: unknown): unknown {
  if (typeof data !== 'string') return data;
  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
}

export class PusherSocket {
  private ws: WebSocket | null = null;
  private channels = new Map<string, Channel>();
  private wanted = false;
  private attempt = 0;
  private activityTimeoutMs = 30_000;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private activityTimer: ReturnType<typeof setTimeout> | null = null;
  private pongTimer: ReturnType<typeof setTimeout> | null = null;
  private connectTimer: ReturnType<typeof setTimeout> | null = null;
  private stateListeners = new Set<(state: SocketState) => void>();

  state: SocketState = 'idle';
  socketId: string | null = null;

  constructor(private readonly options: Options) {}

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  /** Connect, and keep reconnecting until `stop()`. Safe to call repeatedly. */
  start() {
    this.wanted = true;
    if (this.state === 'failed') this.attempt = 0;
    if (!this.ws) this.open();
  }

  /** Close and stay closed. Channel registrations are kept for the next `start()`. */
  stop() {
    this.wanted = false;
    this.clearTimers();
    this.teardown();
    this.setState('idle');
  }

  /**
   * Skip any back-off and connect now — the network came back, or the app
   * returned to the foreground. A live connection is left alone.
   */
  reconnectNow() {
    if (!this.wanted) return;
    if (this.state === 'connected' || this.state === 'connecting') return;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    this.attempt = 0;
    this.open();
  }

  /** Forget every channel and handler — for sign-out, before the next account connects. */
  reset() {
    this.stop();
    this.channels.clear();
  }

  onStateChange(listener: (state: SocketState) => void): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  // -------------------------------------------------------------------------
  // Channels
  // -------------------------------------------------------------------------

  /** Hold a channel open. Returns its release. */
  subscribe(name: string): () => void {
    let channel = this.channels.get(name);
    if (!channel) {
      channel = {
        name,
        refs: 0,
        subscribed: false,
        attempt: 0,
        handlers: new Map(),
        members: new Map(),
      };
      this.channels.set(name, channel);
    }
    channel.refs += 1;
    if (channel.refs === 1 && this.state === 'connected') void this.sendSubscribe(channel);

    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.release(name);
    };
  }

  /**
   * Listen for one event on a channel (`'*'` for all of them). Binding doesn't
   * subscribe — pair it with `subscribe()`; the two are separate so a screen
   * can swap handlers without bouncing the subscription.
   */
  bind(channelName: string, event: string, handler: EventHandler): () => void {
    let channel = this.channels.get(channelName);
    if (!channel) {
      channel = {
        name: channelName,
        refs: 0,
        subscribed: false,
        attempt: 0,
        handlers: new Map(),
        members: new Map(),
      };
      this.channels.set(channelName, channel);
    }
    let set = channel.handlers.get(event);
    if (!set) {
      set = new Set();
      channel.handlers.set(event, set);
    }
    set.add(handler);
    return () => {
      set!.delete(handler);
      const entry = this.channels.get(channelName);
      if (entry && entry.refs === 0 && [...entry.handlers.values()].every((s) => s.size === 0)) {
        this.channels.delete(channelName);
      }
    };
  }

  /** Current members of a presence channel (empty until subscribed). */
  members(channelName: string): PresenceMember[] {
    return [...(this.channels.get(channelName)?.members.values() ?? [])];
  }

  isSubscribed(channelName: string): boolean {
    return !!this.channels.get(channelName)?.subscribed;
  }

  private release(name: string) {
    const channel = this.channels.get(name);
    if (!channel) return;
    channel.refs = Math.max(0, channel.refs - 1);
    if (channel.refs > 0) return;
    if (channel.subscribed) this.send('pusher:unsubscribe', { channel: name });
    channel.subscribed = false;
    channel.attempt += 1;
    channel.members.clear();
    // Keep the entry while something is still bound to it, so a quick
    // re-subscribe (a screen remounting) doesn't lose its handlers.
    const bound = [...channel.handlers.values()].some((set) => set.size > 0);
    if (!bound) this.channels.delete(name);
  }

  private async sendSubscribe(channel: Channel) {
    const attempt = ++channel.attempt;
    const socketId = this.socketId;
    if (!socketId) return;
    const data: Record<string, string> = { channel: channel.name };
    if (isPrivate(channel.name)) {
      try {
        const signed = await this.options.authorize(channel.name, socketId);
        data.auth = signed.auth;
        if (signed.channel_data) data.channel_data = signed.channel_data;
      } catch (error) {
        if (attempt !== channel.attempt || socketId !== this.socketId) return;
        this.options.log?.('auth refused', channel.name, String(error));
        this.dispatch(channel, 'pusher:subscription_error', { error: String(error) });
        return;
      }
      // The connection moved on (or the channel was released) while we waited.
      if (attempt !== channel.attempt || socketId !== this.socketId || channel.refs === 0) return;
    }
    this.send('pusher:subscribe', data);
  }

  // -------------------------------------------------------------------------
  // Connection
  // -------------------------------------------------------------------------

  private open() {
    this.teardown();
    this.markUnsubscribed();
    this.setState('connecting');
    let ws: WebSocket;
    try {
      ws = new WebSocket(this.options.url);
    } catch (error) {
      this.options.log?.('socket constructor failed', String(error));
      this.scheduleRetry();
      return;
    }
    this.ws = ws;
    this.connectTimer = setTimeout(() => {
      if (this.ws === ws && this.state === 'connecting') {
        this.options.log?.('handshake timed out');
        this.teardown();
        this.scheduleRetry();
      }
    }, CONNECT_TIMEOUT_MS);

    ws.onmessage = (event) => {
      if (this.ws !== ws) return;
      this.onMessage(String(event.data));
    };
    ws.onerror = () => {
      // onclose always follows; the retry decision lives there.
    };
    ws.onclose = (event) => {
      if (this.ws !== ws) return;
      this.options.log?.('closed', event.code, event.reason);
      this.ws = null;
      this.markUnsubscribed();
      this.clearTimers();
      this.afterClose(event.code);
    };
  }

  private afterClose(code: number | undefined) {
    if (!this.wanted) {
      this.setState('idle');
      return;
    }
    if (code !== undefined && code >= 4000 && code < 4100) {
      // Fatal by protocol: wrong app key, over quota, SSL-only, etc.
      this.setState('failed');
      return;
    }
    if (code !== undefined && code >= 4200 && code < 4300) {
      this.attempt = 0;
      this.open();
      return;
    }
    this.scheduleRetry();
  }

  private scheduleRetry() {
    if (!this.wanted) return;
    this.setState('waiting');
    const base = BACKOFF_MS[Math.min(this.attempt, BACKOFF_MS.length - 1)]!;
    this.attempt += 1;
    // Jitter, so a backend restart isn't met by every client in the same beat.
    const delay = base * (0.75 + Math.random() * 0.5);
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      if (this.wanted) this.open();
    }, delay);
  }

  private onMessage(raw: string) {
    this.armActivityTimer();
    let message: { event?: string; channel?: string; data?: unknown };
    try {
      message = JSON.parse(raw);
    } catch {
      return;
    }
    const event = message.event ?? '';
    const data = parse(message.data);

    switch (event) {
      case 'pusher:connection_established': {
        const info = data as { socket_id?: string; activity_timeout?: number };
        this.socketId = info.socket_id ?? null;
        if (info.activity_timeout) {
          this.activityTimeoutMs = Math.min(info.activity_timeout, 120) * 1000;
        }
        if (this.connectTimer) clearTimeout(this.connectTimer);
        this.connectTimer = null;
        this.attempt = 0;
        this.setState('connected');
        this.armActivityTimer();
        for (const channel of this.channels.values()) {
          if (channel.refs > 0) void this.sendSubscribe(channel);
        }
        return;
      }
      case 'pusher:ping':
        this.send('pusher:pong', {});
        return;
      case 'pusher:pong':
        if (this.pongTimer) clearTimeout(this.pongTimer);
        this.pongTimer = null;
        return;
      case 'pusher:error': {
        const info = data as { code?: number; message?: string } | null;
        this.options.log?.('server error', info?.code, info?.message);
        // A coded error is followed by the server closing with the same code;
        // an uncoded one is informational.
        return;
      }
    }

    const channel = message.channel ? this.channels.get(message.channel) : undefined;
    if (!channel) return;

    switch (event) {
      case 'pusher_internal:subscription_succeeded': {
        channel.subscribed = true;
        if (isPresence(channel.name)) {
          channel.members.clear();
          const presence = (data as { presence?: { hash?: Record<string, Record<string, unknown>> } })
            ?.presence;
          for (const [id, info] of Object.entries(presence?.hash ?? {})) {
            channel.members.set(id, { id, info: info ?? {} });
          }
          this.dispatch(channel, 'pusher:subscription_succeeded', [...channel.members.values()]);
        } else {
          this.dispatch(channel, 'pusher:subscription_succeeded', {});
        }
        return;
      }
      case 'pusher_internal:member_added': {
        const info = data as { user_id?: string; user_info?: Record<string, unknown> };
        if (!info?.user_id) return;
        const member = { id: String(info.user_id), info: info.user_info ?? {} };
        channel.members.set(member.id, member);
        this.dispatch(channel, 'pusher:member_added', member);
        return;
      }
      case 'pusher_internal:member_removed': {
        const info = data as { user_id?: string };
        if (!info?.user_id) return;
        const member = channel.members.get(String(info.user_id));
        channel.members.delete(String(info.user_id));
        this.dispatch(channel, 'pusher:member_removed', member ?? { id: String(info.user_id), info: {} });
        return;
      }
      case 'pusher:subscription_error':
        this.dispatch(channel, event, data);
        return;
    }

    this.dispatch(channel, event, data);
  }

  private dispatch(channel: Channel, event: string, data: unknown) {
    this.options.log?.('event', channel.name, event, JSON.stringify(data ?? null).slice(0, 300));
    for (const key of [event, '*']) {
      const handlers = channel.handlers.get(key);
      if (!handlers) continue;
      for (const handler of [...handlers]) {
        try {
          handler(key === '*' ? { event, data } : data, channel.name);
        } catch (error) {
          // One broken listener must not starve the others of the event.
          this.options.log?.('handler threw', event, String(error));
        }
      }
    }
  }

  private send(event: string, data: unknown) {
    const ws = this.ws;
    if (!ws || ws.readyState !== 1) return;
    try {
      ws.send(JSON.stringify({ event, data }));
    } catch {
      // A send racing a close — onclose handles the reconnect.
    }
  }

  /**
   * The protocol's keep-alive: after `activity_timeout` of silence, ping; no
   * pong within the grace period means the connection is dead even though
   * the OS hasn't noticed (a phone that changed networks often doesn't).
   */
  private armActivityTimer() {
    if (this.activityTimer) clearTimeout(this.activityTimer);
    if (this.state !== 'connected') return;
    this.activityTimer = setTimeout(() => {
      this.send('pusher:ping', {});
      if (this.pongTimer) clearTimeout(this.pongTimer);
      this.pongTimer = setTimeout(() => {
        this.options.log?.('no pong — reconnecting');
        const ws = this.ws;
        this.teardown();
        this.markUnsubscribed();
        if (ws) this.afterClose(undefined);
      }, PONG_TIMEOUT_MS);
    }, this.activityTimeoutMs);
  }

  private markUnsubscribed() {
    this.socketId = null;
    for (const channel of this.channels.values()) {
      channel.subscribed = false;
      channel.attempt += 1;
      channel.members.clear();
    }
  }

  private teardown() {
    const ws = this.ws;
    this.ws = null;
    if (this.activityTimer) clearTimeout(this.activityTimer);
    if (this.pongTimer) clearTimeout(this.pongTimer);
    if (this.connectTimer) clearTimeout(this.connectTimer);
    this.activityTimer = this.pongTimer = this.connectTimer = null;
    if (ws) {
      ws.onmessage = null;
      ws.onclose = null;
      ws.onerror = null;
      try {
        ws.close();
      } catch {
        // Already closing.
      }
    }
  }

  private clearTimers() {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    if (this.activityTimer) clearTimeout(this.activityTimer);
    if (this.pongTimer) clearTimeout(this.pongTimer);
    if (this.connectTimer) clearTimeout(this.connectTimer);
    this.activityTimer = this.pongTimer = this.connectTimer = null;
  }

  private setState(state: SocketState) {
    if (this.state === state) return;
    this.state = state;
    this.options.onStateChange?.(state);
    for (const listener of this.stateListeners) listener(state);
  }
}
