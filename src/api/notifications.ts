import { api } from './client';
import { timeAgo, tintFor } from './timeline';
import type {
  ApiEnvelope,
  ApiNotification,
  NotificationListResponse,
  Paginated,
} from './types';
import type { Member } from '../data/community';

/**
 * Notifications — `GET /notifications` and friends (added to the collection
 * 2026-09-07).
 *
 * **The list is empty on staging and the row shape is therefore inference.**
 * All five routes answer 200, and the queue worker is demonstrably alive (a
 * queued like and comment both landed during probing), but no engagement —
 * like, comment, follow, or profile view — ever writes a notification row on
 * the staging database. The production web app *does* show them ("EZE liked
 * your post", "OLUWATOBI viewed your profile"), so the feature exists; it just
 * doesn't produce rows on the environment this app talks to.
 *
 * So `toAppNotification` reads several aliases per field, exactly like
 * `toBlogPost` does for the equally-empty blog list. Narrow it to what the
 * backend actually sends once rows exist.
 */

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
// API → view model
// ---------------------------------------------------------------------------

/**
 * The kinds the app renders an icon for. Anything the backend sends that isn't
 * in this list falls back to `generic` rather than crashing on a missing icon —
 * the row still shows its text, which is the part that matters.
 */
export type NotificationKind =
  | 'like'
  | 'comment'
  | 'follow'
  | 'mention'
  | 'profile_view'
  | 'community'
  | 'payout'
  | 'referral'
  | 'gift'
  | 'system'
  | 'generic';

const KIND_ALIASES: Record<string, NotificationKind> = {
  like: 'like',
  liked: 'like',
  post_like: 'like',
  post_liked: 'like',
  comment: 'comment',
  commented: 'comment',
  post_comment: 'comment',
  reply: 'comment',
  follow: 'follow',
  followed: 'follow',
  new_follower: 'follow',
  mention: 'mention',
  mentioned: 'mention',
  profile_view: 'profile_view',
  profile_viewed: 'profile_view',
  view: 'profile_view',
  community: 'community',
  community_join: 'community',
  community_post: 'community',
  community_invite: 'community',
  join_request: 'community',
  payout: 'payout',
  withdrawal: 'payout',
  earning: 'payout',
  earnings: 'payout',
  referral: 'referral',
  gift: 'gift',
  paykoin_gift: 'gift',
  system: 'system',
  announcement: 'system',
};

/**
 * Laravel notification classes arrive as fully-qualified names
 * (`App\Notifications\PostLiked`), so the class basename is snake-cased before
 * it's looked up. A plain `"like"` passes through the same path unharmed.
 */
export function toNotificationKind(raw: string | null | undefined): NotificationKind {
  if (!raw) return 'generic';
  const basename = raw.split('\\').pop() ?? raw;
  const snake = basename
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toLowerCase();
  return KIND_ALIASES[snake] ?? KIND_ALIASES[snake.replace(/_notification$/, '')] ?? 'generic';
}

export type AppNotificationItem = {
  id: string;
  kind: NotificationKind;
  /** The sentence the row shows. */
  text: string;
  timeAgo: string;
  createdAt: string | null;
  unread: boolean;
  /** Who caused it, when the payload names them — drives the avatar. */
  actor: Member | null;
  /** Where tapping the row should go, when the payload carries a target. */
  postId: string | null;
  communityId: string | null;
  username: string | null;
  /** Money amount, for payout/referral/gift rows. */
  amount: number | null;
  currencySymbol: string | null;
};

/** First non-empty string among the candidates. */
function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function firstNumber(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
      return Number(value);
    }
  }
  return null;
}

/**
 * One API row into the shape the screen renders.
 *
 * Laravel's own notifications table nests everything under `data`, but an API
 * resource usually flattens it — so every field is read from the row *and* from
 * a nested `data`/`payload` object. See the caveat at the top of this file.
 */
export function toAppNotification(raw: ApiNotification, index: number): AppNotificationItem {
  const payload = (raw.data ?? raw.payload ?? {}) as Record<string, unknown>;
  const pick = (...keys: string[]) =>
    firstString(...keys.flatMap((key) => [(raw as Record<string, unknown>)[key], payload[key]]));
  const pickNumber = (...keys: string[]) =>
    firstNumber(...keys.flatMap((key) => [(raw as Record<string, unknown>)[key], payload[key]]));

  const actorRaw = (raw.actor ?? raw.user ?? raw.sender ?? raw.from ?? payload.actor ?? payload.user) as
    | { id?: string; name?: string; username?: string; avatar?: string | null }
    | undefined;

  const actor: Member | null = actorRaw?.id
    ? {
        id: actorRaw.id,
        name: actorRaw.name || actorRaw.username || 'Someone',
        handle: actorRaw.username ?? 'someone',
        tint: tintFor(actorRaw.id),
        engagements: 0,
        followers: 0,
        following: 0,
      }
    : null;

  const createdAt = pick('created_at', 'createdAt', 'date');
  // `read_at` is Laravel's own column; `is_read`/`read` are what a hand-rolled
  // resource tends to send. Absent all three, treat it as unread — a row that
  // shows up in the list is new until something says otherwise.
  const readAt = pick('read_at', 'readAt');
  const readFlag = (raw as Record<string, unknown>).is_read ?? (raw as Record<string, unknown>).read;
  const unread = readAt ? false : typeof readFlag === 'boolean' ? !readFlag : true;

  const text =
    pick('message', 'text', 'body', 'title', 'description', 'content') ??
    'You have a new notification';

  return {
    id: raw.id ?? `notification-${index}`,
    kind: toNotificationKind(pick('type', 'kind', 'event', 'category')),
    text,
    timeAgo: createdAt ? timeAgo(createdAt) : '',
    createdAt,
    unread,
    actor,
    postId: pick('post_id', 'postId'),
    communityId: pick('community_id', 'communityId'),
    username: pick('username') ?? actor?.handle ?? null,
    amount: pickNumber('amount', 'value'),
    currencySymbol: pick('currency_symbol', 'currencySymbol'),
  };
}
