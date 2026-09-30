import { api } from './client';
import { toUserLevel } from './levels';
import { timeAgo, tintFor } from './timeline';
import type {
  ApiEnvelope,
  ApiNotification,
  DeviceTokenPayload,
  DeviceTokenRecord,
  NotificationListResponse,
  Paginated,
} from './types';
import type { Member } from '../data/community';

/**
 * Notifications — `GET /notifications` and friends (added to the collection
 * 2026-09-07).
 *
 * **The rows are structured now** (landed 2026-09-29, verified live
 * 2026-09-30 against a real account with 36 rows). Each carries a `type` (the
 * event), a `target` (`{type, id, parent_id}` — what it's about), an `actor`,
 * and the web's own `icon` class and `url`. See `ApiNotification`.
 *
 * Two generations of row share the list:
 *
 * - **Structured** — `post_liked`, `followed`, `message_received`,
 *   `gift_received`, … with a real `target` and `actor`.
 * - **Legacy** — everything written before the change, backfilled as
 *   `type: "system"`, `target: {type: "system", id: ""}`, `actor: null`. The
 *   only things that tell these apart are the web's `icon`
 *   (`fa-heart`, `fa-eye`, `fa-rocket`, …) and the web `url` they link to — so
 *   both are read as fallbacks, in that order.
 */

/**
 * `POST /notifications/device-token` — register this device for Expo push.
 *
 * Idempotent in practice: re-posting the same token updates the row rather
 * than duplicating it, so this is safe to call on every launch.
 *
 * **What the app can and cannot fill in**, all established by probing the live
 * endpoint on 2026-09-17:
 *
 * - `ip_address` — **not sent, on purpose.** The backend already stamps it from
 *   the request (a body without one still came back with the caller's real
 *   public IP), and the only address a phone can read is its own LAN one.
 * - `location` — **never sent.** A place name needs the OS location permission
 *   plus reverse geocoding, and asking for someone's location in order to
 *   register a *push token* is not a trade worth making. The backend is the
 *   right place to derive it, from the IP it is already recording.
 *
 * Everything else the documented body asks for is supplied.
 */
export async function registerDeviceToken(
  payload: DeviceTokenPayload,
): Promise<DeviceTokenRecord> {
  const { data } = await api.post<ApiEnvelope<DeviceTokenRecord>>(
    '/notifications/device-token',
    payload,
  );
  return data.data;
}

/** The envelope carries `unread_count` *beside* `data`, not inside it. */
export async function fetchNotifications(
  page: number,
): Promise<{ page: Paginated<ApiNotification>; unreadCount: number }> {
  const { data } = await api.get<NotificationListResponse>('/notifications', {
    params: { page },
  });
  return { page: data.data, unreadCount: data.unread_count ?? 0 };
}

/** `GET /notifications/unread-count` — `{data:{unread_count}}`. */
export async function fetchUnreadCount(): Promise<number> {
  const { data } = await api.get<ApiEnvelope<{ unread_count: number }>>(
    '/notifications/unread-count',
  );
  return data.data?.unread_count ?? 0;
}

/**
 * `POST /notifications/read-all`. Like the list, the new count comes back at
 * the envelope root rather than under `data`.
 */
export async function markAllNotificationsRead(): Promise<number> {
  const { data } = await api.post<{ message: string; unread_count?: number }>(
    '/notifications/read-all',
  );
  return data.unread_count ?? 0;
}

/** `POST /notifications/{id}/read` — 404s on an id that isn't the caller's. */
export async function markNotificationRead(id: string): Promise<void> {
  await api.post(`/notifications/${id}/read`);
}

/** `DELETE /notifications/{id}`. */
export async function deleteNotification(id: string): Promise<void> {
  await api.delete(`/notifications/${id}`);
}

// ---------------------------------------------------------------------------
// What happened
// ---------------------------------------------------------------------------

/**
 * The kinds the app draws a distinct icon for. Anything unrecognised falls
 * back to `generic` rather than crashing on a missing icon — the row still
 * shows its text, which is the part that matters.
 */
export type NotificationKind =
  | 'like'
  | 'comment'
  | 'reply'
  | 'mention'
  | 'follow'
  | 'message'
  | 'gift'
  | 'profile_view'
  | 'boost'
  | 'community'
  | 'payout'
  | 'referral'
  | 'level'
  | 'system'
  | 'generic';

/**
 * Event `type` → kind. The first five are the types seen live; the rest are
 * the obvious names for events the web already notifies about, so a new type
 * lands on the right icon without a release. Unknown types go through
 * `kindFromWords` next.
 */
const TYPE_KINDS: Record<string, NotificationKind> = {
  post_liked: 'like',
  followed: 'follow',
  message_received: 'message',
  gift_received: 'gift',
  system: 'system',
  post_commented: 'comment',
  comment_replied: 'reply',
  comment_reply: 'reply',
  mentioned: 'mention',
  profile_viewed: 'profile_view',
  boost_activated: 'boost',
  boost_completed: 'boost',
  post_boosted: 'boost',
  announcement: 'system',
};

/** Loose word match for event types that aren't in the table above. Order
 *  matters: "comment_liked" is a like, "reply" beats "comment". */
function kindFromWords(snake: string): NotificationKind | null {
  if (/like/.test(snake)) return 'like';
  if (/repl/.test(snake)) return 'reply';
  if (/comment/.test(snake)) return 'comment';
  if (/mention/.test(snake)) return 'mention';
  if (/follow/.test(snake)) return 'follow';
  if (/message|conversation|chat/.test(snake)) return 'message';
  if (/gift|paykoin/.test(snake)) return 'gift';
  if (/view/.test(snake)) return 'profile_view';
  if (/boost|campaign|promot/.test(snake)) return 'boost';
  if (/communit|join/.test(snake)) return 'community';
  if (/payout|withdraw|earning|payment/.test(snake)) return 'payout';
  if (/referr/.test(snake)) return 'referral';
  if (/level|upgrade|subscri/.test(snake)) return 'level';
  return null;
}

/**
 * The web's Font Awesome class → kind. Legacy `system` rows carry nothing
 * else to go on (`fa-heart text-danger`, `fa-eye text-primary`,
 * `fa-rocket text-primary`, `fa-comment text-primary` are the ones seen).
 */
function kindFromIcon(icon: string | null | undefined): NotificationKind | null {
  if (!icon) return null;
  const name = icon.split(/\s+/).find((part) => part.startsWith('fa-') && !part.startsWith('fa-fw'))
    ?? icon.trim();
  const bare = name.replace(/^fa-/, '');
  if (bare === 'heart' || bare === 'thumbs-up') return 'like';
  if (bare === 'reply') return 'reply';
  if (bare === 'comment' || bare === 'comments' || bare === 'comment-dots') return 'comment';
  if (bare === 'at') return 'mention';
  if (bare === 'user-plus' || bare === 'user-check') return 'follow';
  if (bare === 'envelope' || bare === 'paper-plane') return 'message';
  if (bare === 'gift') return 'gift';
  if (bare === 'eye') return 'profile_view';
  if (bare === 'rocket' || bare === 'bullhorn') return 'boost';
  if (bare === 'users' || bare === 'people-group') return 'community';
  if (/^(money|wallet|coins|naira|dollar|cash|credit-card)/.test(bare)) return 'payout';
  if (bare === 'user-friends' || bare === 'handshake') return 'referral';
  if (bare === 'crown' || bare === 'star' || bare === 'medal') return 'level';
  if (bare === 'bell' || bare === 'info-circle' || bare === 'megaphone') return 'system';
  return null;
}

/**
 * Laravel notification classes can arrive fully-qualified
 * (`App\Notifications\PostLiked`), so the basename is snake-cased first. A plain
 * `"post_liked"` passes through unharmed.
 */
function snakeType(raw: string): string {
  const basename = raw.split('\\').pop() ?? raw;
  return basename
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toLowerCase()
    .replace(/_notification$/, '');
}

/**
 * What kind of row this is. The event type wins when it's specific; a legacy
 * `system` row (or an unknown type) falls back to the web's icon, then to the
 * shape of its web link, and only then to `system`.
 */
export function toNotificationKind(
  type: string | null | undefined,
  icon?: string | null,
  url?: string | null,
): NotificationKind {
  const snake = type ? snakeType(type) : '';
  const fromType = snake ? (TYPE_KINDS[snake] ?? kindFromWords(snake)) : null;
  if (fromType && fromType !== 'system') return fromType;
  const fromIcon = kindFromIcon(icon);
  if (fromIcon) return fromIcon;
  const path = url ? webPath(url)?.path : null;
  if (path && /^\/profile\//.test(path)) return 'profile_view';
  if (path && /\/analytics/.test(path)) return 'boost';
  return fromType ?? 'generic';
}

// ---------------------------------------------------------------------------
// Where it goes
// ---------------------------------------------------------------------------

/** Hosts whose links are Payhankey pages the app has a screen for. The follow
 *  row links through the API host (`pky.e-portal.com.ng/profile/…`). */
const WEB_HOSTS = /(^|\.)payhankey\.com$|^pky\.e-portal\.com\.ng$|^localhost$|^127\.0\.0\.1$/i;

/** `{path, query}` of a Payhankey web link, or null for anything else. Also
 *  accepts the app's own `payhankey://` scheme. */
function webPath(url: string): { path: string; query: string } | null {
  const scheme = /^payhankey:\/\/([^?#]*)(\?[^#]*)?/i.exec(url.trim());
  if (scheme) return { path: `/${scheme[1].replace(/^\/+/, '')}`, query: scheme[2] ?? '' };
  const web = /^https?:\/\/([^/?#:]+)(?::\d+)?(\/[^?#]*)?(\?[^#]*)?/i.exec(url.trim());
  if (!web || !WEB_HOSTS.test(web[1])) return null;
  return { path: (web[2] ?? '/').replace(/\/+$/, '') || '/', query: web[3] ?? '' };
}

/**
 * A Payhankey **web** link → the app route that shows the same thing, or null
 * when the app has no equivalent. This is what legacy rows route through,
 * since their `url` is all they carry.
 */
export function routeFromWebUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const parsed = webPath(url);
  if (!parsed) return null;
  const { path, query } = parsed;
  const seg = (pattern: RegExp) => pattern.exec(path)?.[1];

  // `/post/timeline/{id}/analytics?tab=boost` — the "Post Boost Activated" row.
  const analytics = seg(/^\/post\/timeline\/([^/]+)\/analytics$/);
  if (analytics) {
    return `/post/${analytics}/analytics${/[?&]tab=boost\b/.test(query) ? '?tab=boost' : ''}`;
  }
  const post = seg(/^\/(?:post\/timeline|timeline|post)\/([^/]+)$/);
  if (post) return `/post/${post}`;
  const profile = seg(/^\/(?:profile|member|u)\/([^/]+)$/);
  if (profile) return `/member/${decodeURIComponent(profile)}`;
  const community = seg(/^\/(?:c|communities|community)\/([^/]+)$/);
  if (community) return `/community/${community}`;
  const thread = seg(/^\/(?:user\/)?messages\/([^/]+)$/);
  if (thread) return `/messages/${thread}`;
  const blog = seg(/^\/blogs?\/([^/]+)$/);
  if (blog) return `/blog/${blog}`;

  const direct: Record<string, string> = {
    '/wallet': '/wallet',
    '/wallets': '/paykoin',
    '/paykoin': '/paykoin',
    '/messages': '/messages',
    '/user/messages': '/messages',
    '/boosts': '/boosts',
    '/referrals': '/referrals',
    '/upgrade': '/upgrade',
    '/payouts': '/payouts',
    '/transactions': '/transactions',
    '/bookmarks': '/bookmarks',
    '/notifications': '/notifications',
    '/rolls': '/rolls',
    '/communities': '/communities',
    '/blog': '/blog',
  };
  return direct[path] ?? null;
}

/** A plain-object `meta` (an empty one arrives as `[]`). */
function metaOf(raw: { meta?: unknown }): Record<string, unknown> {
  return raw.meta && typeof raw.meta === 'object' && !Array.isArray(raw.meta)
    ? (raw.meta as Record<string, unknown>)
    : {};
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/**
 * Where tapping a notification (a row *or* a push) takes you.
 *
 * The structured `target` is the authority; `meta` ids are the next best
 * thing; the web `url` is the last resort, and the only one a legacy row has.
 * Null means "nowhere specific" — the caller just marks it read, which beats
 * navigating somewhere arbitrary.
 */
export function notificationRoute(raw: Pick<ApiNotification, 'target' | 'meta' | 'url' | 'actor'>, kind: NotificationKind): string | null {
  const meta = metaOf(raw);
  const targetType = str(raw.target?.type)?.toLowerCase() ?? null;
  const targetId = str(raw.target?.id);

  if (targetId) {
    switch (targetType) {
      case 'conversation':
      case 'message':
        return `/messages/${targetId}`;
      case 'post':
      case 'timeline':
      case 'timeline_post':
        return kind === 'boost' ? `/post/${targetId}/analytics?tab=boost` : `/post/${targetId}`;
      case 'profile':
      case 'user':
        // `profile` targets carry the **username** — `/member/[handle]` wants
        // exactly that.
        return `/member/${targetId}`;
      case 'community':
        return `/community/${targetId}`;
      case 'roll':
      case 'video':
        return `/rolls?start=${targetId}`;
      case 'boost':
      case 'campaign': {
        const postId = str(meta.post_id);
        return postId ? `/post/${postId}/analytics?tab=boost` : '/boosts';
      }
    }
  }

  // No usable target: the per-type extras, then the web link.
  const conversationId = str(meta.conversation_id);
  if (conversationId) return `/messages/${conversationId}`;
  const postId = str(meta.post_id) ?? (meta.giftable_type === 'timeline' ? str(meta.giftable_id) : null);
  if (postId) return kind === 'boost' ? `/post/${postId}/analytics?tab=boost` : `/post/${postId}`;
  const communityId = str(meta.community_id);
  if (communityId) return `/community/${communityId}`;
  const username = str(meta.follower_username) ?? str(meta.username);
  if (username && (kind === 'follow' || kind === 'profile_view')) return `/member/${username}`;

  return routeFromWebUrl(raw.url);
}

// ---------------------------------------------------------------------------
// API → view model
// ---------------------------------------------------------------------------

export type AppNotificationItem = {
  id: string;
  kind: NotificationKind;
  /** The headline ("OLUWATOBI liked your post"). */
  title: string;
  /**
   * A second line, when the row has more to say than its headline — the
   * message text on a DM, the gift sentence on a gift. Null when `body` just
   * repeats the title, which is every like/follow/view row.
   */
  body: string | null;
  /** A thumbnail of what the row is about, when the backend sends one. */
  previewImage: string | null;
  timeAgo: string;
  createdAt: string | null;
  unread: boolean;
  /** Who caused it — drives the avatar. Null on legacy rows. */
  actor: Member | null;
  /** App route for a tap; null means just mark it read. */
  route: string | null;
  /** A money line the backend already formatted ("+₦1,200"), when there is one. */
  amountLabel: string | null;
  /** A raw amount to format client-side when no formatted string came. */
  amount: number | null;
  currency: string | null;
  /** Coins on a gift row ("5 PK"). */
  coins: number | null;
};

/**
 * The actor's display name, read out of the title ("New message from Kwame
 * Adew", "OLUWATOBI sent you a Rose") for the avatar's initials.
 * `message_received` and `gift_received` send the actor with **empty**
 * `name`/`username`, and `post_liked` sends a `name` that is just the
 * username — so the title is the only name that matches what the row says.
 */
function nameFromTitle(title: string): string | null {
  const from = /^(?:new message from|message from)\s+(.+)$/i.exec(title);
  if (from) return from[1].trim();
  const subject =
    /^(.+?)\s+(?:liked|commented|replied|mentioned|started|sent|gifted|viewed|followed|joined|requested|accepted|invited|shared)\b/i.exec(
      title,
    );
  return subject ? subject[1].trim() : null;
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

/** One API row into the shape the screen renders. */
export function toAppNotification(raw: ApiNotification, index: number): AppNotificationItem {
  const meta = metaOf(raw);
  const title =
    str(raw.title) ?? str(raw.message) ?? str(raw.body) ?? 'You have a new notification';
  const bodyText = str(raw.body) ?? str(raw.message);
  const body =
    bodyText && bodyText.toLowerCase() !== title.toLowerCase() ? bodyText : str(raw.preview?.text);

  const kind = toNotificationKind(raw.type, raw.icon, raw.url);

  const actorRaw = raw.actor;
  const actor: Member | null = actorRaw?.id
    ? {
        id: actorRaw.id,
        // The title's name first: it's the one the row prints, and `actor.name`
        // is often a generated handle ("user5191248") when it's there at all.
        name: nameFromTitle(title) ?? str(actorRaw.name) ?? str(actorRaw.username) ?? 'Someone',
        handle: str(actorRaw.username) ?? str(meta.username) ?? '',
        tint: tintFor(actorRaw.id),
        avatar: str(actorRaw.avatar) ?? str(meta.follower_avatar),
        level: toUserLevel(actorRaw.level),
        engagements: 0,
        followers: 0,
        following: 0,
      }
    : null;

  const createdAt = str(raw.created_at);
  // `read_at` is authoritative; `is_read` covers a row read on another device
  // before its timestamp was sent.
  const unread = raw.read_at ? false : raw.is_read === true ? false : true;

  const coins =
    kind === 'gift' ? (toNumber(raw.gift?.price) ?? toNumber(meta.pk_amount)) : null;

  return {
    id: raw.id ?? `notification-${index}`,
    kind,
    title,
    body,
    previewImage: str(raw.preview?.image_url),
    timeAgo: createdAt ? timeAgo(createdAt) : '',
    createdAt,
    unread,
    actor,
    route: notificationRoute(raw, kind),
    amountLabel: str(raw.formatted_amount) ?? str(raw.formatted),
    amount: toNumber(raw.amount),
    currency: str(raw.currency),
    coins,
  };
}

// ---------------------------------------------------------------------------
// Push payloads
// ---------------------------------------------------------------------------

/**
 * Read a push's `data` into the notification it stands for.
 *
 * **The push payload is not documented, and no push can be received yet** (no
 * FCM/APNs credentials — see AGENTS.md "Push notifications"). So this accepts
 * the obvious shapes rather than one guessed field:
 *
 * - the notification row itself as `data` (`{id, type, target, meta, url}`) —
 *   the most likely, since the list already has that resource;
 * - the row nested under `notification`;
 * - a flat `target_type`/`target_id` pair;
 * - a `notification_id` beside any of the above.
 *
 * Every variant then goes through the same `notificationRoute` the list uses,
 * so a push and its row always open the same screen. Anything unreadable
 * returns `route: null`, and the caller falls back to the notifications list.
 */
export function readPushData(data: unknown): { id: string | null; route: string | null } {
  if (!data || typeof data !== 'object') return { id: null, route: null };
  const outer = data as Record<string, unknown>;
  const inner =
    outer.notification && typeof outer.notification === 'object'
      ? (outer.notification as Record<string, unknown>)
      : outer;

  const target =
    inner.target && typeof inner.target === 'object'
      ? (inner.target as ApiNotification['target'])
      : { type: str(inner.target_type), id: str(inner.target_id), parent_id: null };

  const row = {
    target,
    meta: inner.meta as ApiNotification['meta'],
    url: str(inner.url) ?? str(inner.link) ?? str(inner.deep_link),
    actor: null,
  };
  const kind = toNotificationKind(str(inner.type), str(inner.icon), row.url);
  return {
    id: str(outer.notification_id) ?? str(inner.notification_id) ?? str(inner.id),
    route: notificationRoute(row, kind),
  };
}
