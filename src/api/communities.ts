import { api } from './client';
import { tintFor, timeAgo } from './timeline';
import type {
  ApiCommunity,
  ApiCommunityAccess,
  ApiCommunityInvites,
  ApiCommunityJoinRequest,
  ApiCommunityCategory,
  ApiCommunityComment,
  ApiCommunityJoinData,
  ApiCommunityLikeData,
  ApiCommunityMembership,
  ApiCommunityPost,
  ApiCommunityPricing,
  ApiCommunityType,
  ApiCommunityUser,
  ApiCommunityViewData,
  ApiCommunityAnalytics,
  ApiCommunityEarnings,
  ApiCommunityFeePreview,
  ApiCommunityMemberRole,
  ApiCommunityMemberRow,
  ApiCommunitySubscribe,
  ApiCommunitySubscriptionStatus,
  UpdateCommunityPayload,
  ApiEnvelope,
  CommunityListParams,
  CommunityListResponse,
  CreateCommunityPayload,
  Paginated,
} from './types';
import type { Member } from '../data/community';

export type {
  ApiBillingInterval,
  ApiBillingType,
  ApiCommunityType,
  ApiFeePayer,
  CreateCommunityPayload,
} from './types';

/**
 * Communities — `GET|POST /communities` and friends.
 *
 * Three things here are **not** in the Postman collection and were established
 * by probing the live API on 2026-09-02; see the "Communities" section of
 * AGENTS.md before changing any of them:
 *
 * - `POST /communities/{id}/join` and `/leave` exist and are the only way to
 *   change membership. Join branches on the community type — see `joinCommunity`.
 * - Paid communities carry a `pricing` block with the platform-fee split
 *   already computed and a written `billing_label`.
 * - A community resolves by id via `/communities/{id}` **or** by slug via
 *   `/communities/c/{slug}` (the latter added 2026-09-03). `fetchCommunity`
 *   picks the route from the value it's given, so `/community/<slug>` links
 *   work alongside `/community/<uuid>`.
 */

/** Membership as the UI thinks about it, collapsed from the API's flags. */
export type MembershipState = 'owner' | 'admin' | 'member' | 'requested' | 'none';

export type CommunityPricing = {
  listPrice: number;
  feePayer: 'members' | 'creator';
  billingType: 'one_off' | 'subscription';
  billingInterval: 'monthly' | 'weekly' | 'quarterly' | null;
  /** Backend-written: "One-off payment", "Billed monthly", … */
  billingLabel: string;
  platformFeePercent: number;
  memberCharge: number;
  platformFee: number;
  creatorPayout: number;
};

export type CommunityAccess = {
  canViewFeed: boolean;
  canViewMembers: boolean;
  /** The backend's own explanation of why the feed is closed. */
  gateMessage: string | null;
};

export type Community = {
  id: string;
  slug: string;
  name: string;
  description: string;
  type: ApiCommunityType;
  currency: string;
  image: string | null;
  banner: string | null;
  members: number;
  /** Only the detail endpoint reports this. */
  posts?: number;
  categoryId: string | null;
  categoryName: string | null;
  owner: Member;
  pricing: CommunityPricing | null;
  membership: MembershipState;
  /** True only while an approval request is awaiting a decision. */
  pendingRequest: boolean;
  pendingInvite: boolean;
  subscriptionStatus: string | null;
  access: CommunityAccess;
  shareUrl: string;
  createdAt: string;
  /** "3d" — for the About tab. */
  createdAgo: string;
};

export type CommunityPost = {
  id: string;
  communityId: string;
  author: Member;
  body: string;
  createdAt: string;
  timeAgo: string;
  likes: number;
  comments: number;
  views: number;
  liked: boolean;
  media: string[];
  /** The latest few comments the list endpoint embeds, like the timeline's. */
  commentsPreview: CommunityComment[];
};

export type CommunityComment = {
  id: string;
  author: Member;
  body: string;
  timeAgo: string;
};

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

/**
 * The API's community user shape into the app's `Member`. Only id/name/handle
 * are real; the counters exist so `Member` consumers (Avatar, rows) typecheck —
 * community endpoints send no follower stats.
 */
export function toMember(user: ApiCommunityUser | null | undefined): Member {
  return {
    id: user?.id ?? 'unknown',
    name: user?.name || user?.username || 'Member',
    handle: user?.username ?? 'unknown',
    tint: tintFor(user?.id ?? 'unknown'),
    engagements: 0,
    followers: 0,
    following: 0,
  };
}

function toPricing(pricing: ApiCommunityPricing | null | undefined): CommunityPricing | null {
  if (!pricing) return null;
  return {
    listPrice: Number(pricing.list_price ?? 0),
    feePayer: pricing.fee_payer,
    billingType: pricing.billing_type,
    billingInterval: pricing.billing_interval ?? null,
    billingLabel: pricing.billing_label ?? '',
    platformFeePercent: Number(pricing.platform_fee_percent ?? 0),
    memberCharge: Number(pricing.member_charge ?? pricing.list_price ?? 0),
    platformFee: Number(pricing.platform_fee ?? 0),
    creatorPayout: Number(pricing.creator_payout ?? 0),
  };
}

/**
 * Membership, from whichever signal the endpoint provided.
 *
 * The detail endpoint sends the full `membership` block. **List rows send only
 * `is_member`** (added 2026-09-03), which is true for owners too — so it can
 * only ever resolve to `member`, and `CommunityCard` upgrades that to `owner`
 * by comparing ids. A *pending* approval request still isn't visible on a list
 * row, so those read as `none` there until the backend sends the full block.
 */
function toMembership(
  membership: ApiCommunityMembership | null | undefined,
  isMember?: boolean | null,
): MembershipState {
  if (membership) {
    if (membership.is_owner) return 'owner';
    if (membership.is_admin) return 'admin';
    if (membership.is_member) return 'member';
    if (membership.pending_join_request) return 'requested';
    return 'none';
  }
  return isMember ? 'member' : 'none';
}

/**
 * List rows carry no `access` block. They're only ever rendered as cards (which
 * never show the feed), so an absent block is treated as open — the detail
 * screen always has the real one before it decides to fetch posts.
 */
function toAccess(access: ApiCommunityAccess | null | undefined): CommunityAccess {
  return {
    canViewFeed: access?.can_view_feed ?? true,
    canViewMembers: access?.can_view_members ?? true,
    gateMessage: access?.feed_gate_message ?? null,
  };
}

/**
 * The shareable link. The API's own `share_url` currently comes back pointing at
 * `http://localhost/c/<slug>` — a backend environment bug — so it's used only
 * when it isn't a localhost URL, and otherwise rebuilt against the real domain.
 * Drop the guard once the backend sends its public URL.
 */
function shareUrlFor(community: ApiCommunity): string {
  const sent = community.share_url;
  if (sent && !/^https?:\/\/localhost(?::\d+)?\//i.test(sent)) return sent;
  return `https://payhankey.com/c/${community.share_slug ?? community.slug}`;
}

export function toCommunity(community: ApiCommunity): Community {
  return {
    id: community.id,
    slug: community.slug,
    name: community.name,
    description: community.description ?? '',
    type: community.type,
    currency: community.currency,
    image: community.image ?? null,
    banner: community.banner ?? null,
    members: community.members_count ?? 0,
    posts: community.posts_count,
    categoryId: community.category?.id ?? null,
    categoryName: community.category?.name ?? null,
    owner: toMember(community.owner),
    pricing: toPricing(community.pricing),
    membership: toMembership(community.membership, community.is_member),
    pendingRequest: community.membership?.pending_join_request ?? false,
    pendingInvite: community.membership?.pending_invite ?? false,
    subscriptionStatus: community.membership?.subscription_status ?? null,
    access: toAccess(community.access),
    shareUrl: shareUrlFor(community),
    createdAt: community.created_at,
    createdAgo: community.created_at ? timeAgo(community.created_at) : '',
  };
}

export function toCommunityComment(comment: ApiCommunityComment): CommunityComment {
  return {
    id: comment.id,
    author: toMember(comment.user),
    body: comment.content ?? '',
    timeAgo: comment.created_at ? timeAgo(comment.created_at) : '',
  };
}

export function toCommunityPost(post: ApiCommunityPost): CommunityPost {
  return {
    id: post.id,
    communityId: post.community_id,
    author: toMember(post.user),
    body: post.content ?? '',
    createdAt: post.created_at,
    timeAgo: post.created_at ? timeAgo(post.created_at) : '',
    likes: post.likes_count ?? 0,
    comments: post.comments_count ?? 0,
    views: post.views_count ?? 0,
    liked: post.is_liked ?? false,
    media: (post.media ?? [])
      .map((item) => item.full_url ?? item.url ?? null)
      .filter((uri): uri is string => !!uri),
    commentsPreview: (post.comments?.preview ?? []).map(toCommunityComment),
  };
}

// ---------------------------------------------------------------------------
// Communities
// ---------------------------------------------------------------------------

/**
 * `GET /communities`. Only `search`, `filter` and `category_id` are honoured —
 * `filter` is enum-validated (`all` | `joined` | `mine`) and 422s on anything
 * else, and `category_id` must be a UUID, so both are sent only when set.
 *
 * The envelope is non-standard: the account currency sits *beside* `data`
 * rather than inside it, like `/user/referrals`.
 */
export async function fetchCommunities(
  params: CommunityListParams,
): Promise<{ page: Paginated<ApiCommunity>; currency?: string }> {
  const { data } = await api.get<CommunityListResponse>('/communities', {
    params: {
      page: params.page,
      ...(params.search ? { search: params.search } : {}),
      ...(params.filter && params.filter !== 'all' ? { filter: params.filter } : {}),
      ...(params.category_id ? { category_id: params.category_id } : {}),
    },
  });
  return { page: data.data, currency: data.currency };
}

/** A v4 UUID — how `/communities/{id}` expects to be addressed. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isCommunityId(value: string): boolean {
  return UUID.test(value);
}

/**
 * One community, by **id or slug**.
 *
 * `GET /communities/{id}` takes a UUID and `GET /communities/c/{slug}` (added
 * 2026-09-03) takes a slug — a slug on the id route still 404s, so the two are
 * separate endpoints and the caller's value decides which is used. That makes
 * the backend's own share link (`/c/<slug>`) resolvable, which it wasn't before.
 */
export async function fetchCommunity(idOrSlug: string): Promise<Community> {
  const path = isCommunityId(idOrSlug)
    ? `/communities/${idOrSlug}`
    : `/communities/c/${encodeURIComponent(idOrSlug)}`;
  const { data } = await api.get<ApiEnvelope<ApiCommunity>>(path);
  return toCommunity(data.data);
}

/** `GET /communities/categories` — a plain array, not a paginator. */
export async function fetchCommunityCategories(): Promise<ApiCommunityCategory[]> {
  const { data } = await api.get<ApiEnvelope<ApiCommunityCategory[]>>(
    '/communities/categories',
  );
  return data.data;
}

/**
 * `POST /communities`. Paid communities need `monthly_fee`, `fee_payer` and
 * `billing_type`, plus `billing_interval` when the type is `subscription` —
 * the server rejects each omission separately with its own message, so the form
 * validates the same set client-side rather than round-tripping four times.
 */
export async function createCommunity(payload: CreateCommunityPayload): Promise<Community> {
  const { data } = await api.post<ApiEnvelope<ApiCommunity>>('/communities', payload);
  return toCommunity(data.data);
}

/**
 * `POST /communities/{id}/join` — undocumented, and its meaning depends on the
 * community type:
 *
 * - **public** → 200 `action: "joined"`, membership granted immediately.
 * - **approval** → 200 `action: "request_sent"` (or `"request_pending"` when one
 *   is already outstanding); the caller becomes `pendingRequest`, not a member.
 * - **private** → 422 "An invite token is required…" unless `inviteToken` is
 *   passed, in which case it joins outright. The token comes from
 *   `fetchCommunityInvites` (owner/admin) and travels in the share link.
 * - **paid** → 422 "Payment is required to join this community." There is no
 *   payment endpoint on this API yet (`/subscribe`, `/pay` and `/checkout` all
 *   404), so the screen surfaces the server's message rather than pretending.
 *
 * The 422s arrive as `ApiError`s and are shown to the user as-is; the backend's
 * wording is accurate and per-type, so there's nothing to improve on.
 */
export async function joinCommunity(
  id: string,
  inviteToken?: string,
): Promise<ApiCommunityJoinData> {
  const { data } = await api.post<ApiEnvelope<ApiCommunityJoinData>>(
    `/communities/${id}/join`,
    inviteToken ? { invite_token: inviteToken } : undefined,
  );
  return data.data;
}

// ---------------------------------------------------------------------------
// Admin: invites and join requests
//
// None of these are in the Postman collection; all four were found by probing
// and all four answer 200 for an owner. Together they make `private` and
// `approval` communities actually usable, so they are worth keeping even though
// they are undocumented — re-verify them if the backend reshuffles routes.
// ---------------------------------------------------------------------------

/**
 * `GET /communities/{id}/invites` — owner/admin only (403 otherwise).
 *
 * The backend issues one standing `link_invite` per community; there is no POST
 * route, so it cannot be created, rotated or revoked from here. Its `token` is
 * what makes a private community joinable.
 */
export async function fetchCommunityInvites(id: string): Promise<ApiCommunityInvites> {
  const { data } = await api.get<ApiEnvelope<ApiCommunityInvites>>(
    `/communities/${id}/invites`,
  );
  return data.data;
}

/**
 * `GET /communities/{id}/join-requests` — owner/admin only. A plain array (not
 * a paginator) of pending requests on an `approval` community.
 */
export async function fetchJoinRequests(id: string): Promise<ApiCommunityJoinRequest[]> {
  const { data } = await api.get<ApiEnvelope<ApiCommunityJoinRequest[]>>(
    `/communities/${id}/join-requests`,
  );
  return data.data ?? [];
}

/** `POST /communities/{id}/join-requests/{requestId}/approve`. */
export async function approveJoinRequest(id: string, requestId: string): Promise<void> {
  await api.post(`/communities/${id}/join-requests/${requestId}/approve`);
}

/**
 * `POST /communities/{id}/join-requests/{requestId}/deny`.
 *
 * The verb is **`deny`** — `reject`, `decline` and `dismiss` all 404.
 */
export async function denyJoinRequest(id: string, requestId: string): Promise<void> {
  await api.post(`/communities/${id}/join-requests/${requestId}/deny`);
}

/** `POST /communities/{id}/leave` — undocumented; answers `action: "left"`. */
export async function leaveCommunity(id: string): Promise<ApiCommunityJoinData> {
  const { data } = await api.post<ApiEnvelope<ApiCommunityJoinData>>(
    `/communities/${id}/leave`,
  );
  return data.data;
}

// ---------------------------------------------------------------------------
// Community posts
// ---------------------------------------------------------------------------

/**
 * `GET /communities/{id}/posts`. 422s with "You do not have access to this
 * community feed." when the viewer isn't allowed in, so callers must gate on
 * `access.canViewFeed` rather than fetching and handling the failure.
 */
export async function fetchCommunityPosts(
  id: string,
  page: number,
): Promise<Paginated<ApiCommunityPost>> {
  const { data } = await api.get<ApiEnvelope<Paginated<ApiCommunityPost>>>(
    `/communities/${id}/posts`,
    { params: { page } },
  );
  return data.data;
}

/**
 * `POST /communities/{id}/posts` — multipart `content` + `media[]`, the same
 * shape as the timeline's create-post. Non-members get 422 "Only members can
 * post in this community."
 */
export async function createCommunityPost(
  id: string,
  content: string,
  media: { uri: string; name: string; type: string }[] = [],
): Promise<CommunityPost> {
  const form = new FormData();
  form.append('content', content);
  media.forEach((item) => {
    // React Native's FormData takes this shape for a file part.
    form.append('media[]', item as unknown as Blob);
  });
  const { data } = await api.post<ApiEnvelope<ApiCommunityPost>>(
    `/communities/${id}/posts`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return toCommunityPost(data.data);
}

/** `GET /communities/{id}/posts/{postId}/comments` — paginated. */
export async function fetchCommunityPostComments(
  id: string,
  postId: string,
  page: number,
): Promise<Paginated<ApiCommunityComment>> {
  const { data } = await api.get<ApiEnvelope<Paginated<ApiCommunityComment>>>(
    `/communities/${id}/posts/${postId}/comments`,
    { params: { page } },
  );
  return data.data;
}

/** `POST /communities/{id}/posts/{postId}/comments` — body is `{content}`. */
export async function addCommunityPostComment(
  id: string,
  postId: string,
  content: string,
): Promise<CommunityComment> {
  const { data } = await api.post<ApiEnvelope<ApiCommunityComment>>(
    `/communities/${id}/posts/${postId}/comments`,
    { content },
  );
  return toCommunityComment(data.data);
}

/**
 * `POST /communities/{id}/posts/{postId}/like/toggle` — answers the *settled*
 * `{liked, likes_count}`, so unlike the timeline's queued 202 there's no need
 * for a client-side engagement store: the response is the truth.
 */
export async function toggleCommunityPostLike(
  id: string,
  postId: string,
): Promise<ApiCommunityLikeData> {
  const { data } = await api.post<ApiEnvelope<ApiCommunityLikeData>>(
    `/communities/${id}/posts/${postId}/like/toggle`,
  );
  return data.data;
}

/**
 * `POST /communities/{id}/posts/{postId}/view`. Telemetry — failures are
 * swallowed, since a dropped view is not worth an error in front of a reader.
 */
export async function recordCommunityPostView(
  id: string,
  postId: string,
): Promise<ApiCommunityViewData | null> {
  try {
    const { data } = await api.post<ApiEnvelope<ApiCommunityViewData>>(
      `/communities/${id}/posts/${postId}/view`,
    );
    return data.data;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Members and moderation
//
// Added to the collection 2026-09-07, and the answer to the "no members
// endpoint" gap the first integration had to work around — the web's Members
// tab can finally be built. All verified live against a community test2 owns.
// ---------------------------------------------------------------------------

/** How a member row is rendered and what can be done to it. */
export type CommunityMember = {
  id: string;
  member: Member;
  role: ApiCommunityMemberRole;
  status: string;
  joinedAgo: string;
  isOwner: boolean;
  isAdmin: boolean;
};

export function toCommunityMember(row: ApiCommunityMemberRow): CommunityMember {
  return {
    id: row.id,
    member: toMember(row),
    role: row.role,
    status: row.status,
    joinedAgo: row.joined_at ? timeAgo(row.joined_at) : '',
    isOwner: row.role === 'owner',
    isAdmin: row.role === 'admin',
  };
}

/** `GET /communities/{id}/members` — paginated, 15 a page, owner listed too. */
export async function fetchCommunityMembers(
  id: string,
  page: number,
): Promise<Paginated<ApiCommunityMemberRow>> {
  const { data } = await api.get<ApiEnvelope<Paginated<ApiCommunityMemberRow>>>(
    `/communities/${id}/members`,
    { params: { page } },
  );
  return data.data;
}

/** `GET /communities/{id}/members/banned` — same row shape, banned only. */
export async function fetchBannedMembers(
  id: string,
  page: number,
): Promise<Paginated<ApiCommunityMemberRow>> {
  const { data } = await api.get<ApiEnvelope<Paginated<ApiCommunityMemberRow>>>(
    `/communities/${id}/members/banned`,
    { params: { page } },
  );
  return data.data;
}

/**
 * The four moderation verbs, all `POST /communities/{id}/members/{userId}/…`
 * and all owner/admin only. The path segment is the *user's* id, which is what
 * the member row's `id` already is.
 */
export type MemberAction = 'promote' | 'demote' | 'ban' | 'unban';

export async function moderateMember(
  id: string,
  userId: string,
  action: MemberAction,
): Promise<void> {
  await api.post(`/communities/${id}/members/${userId}/${action}`);
}

/** `DELETE /communities/{id}/members/{userId}` — remove without banning. */
export async function removeMember(id: string, userId: string): Promise<void> {
  await api.delete(`/communities/${id}/members/${userId}`);
}

// ---------------------------------------------------------------------------
// Analytics and earnings
// ---------------------------------------------------------------------------

/**
 * `GET /communities/{id}/analytics` — the owner's dashboard: membership and
 * engagement totals with 7/30-day slices, the top posts, and recent joiners.
 */
export async function fetchCommunityAnalytics(id: string): Promise<ApiCommunityAnalytics> {
  const { data } = await api.get<ApiEnvelope<ApiCommunityAnalytics>>(
    `/communities/${id}/analytics`,
  );
  return data.data;
}

/**
 * `GET /communities/{id}/earnings` — subscription revenue.
 *
 * `stats` carries the split already computed (gross, platform fee, creator
 * amount, and the `platform_fee_percent` behind it), so the screen renders the
 * server's arithmetic rather than redoing it. `payments` is a paginator beside
 * it, not nested inside — the same envelope shape as `/user/referrals`.
 */
export async function fetchCommunityEarnings(
  id: string,
  page: number,
): Promise<ApiCommunityEarnings> {
  const { data } = await api.get<ApiEnvelope<ApiCommunityEarnings>>(
    `/communities/${id}/earnings`,
    { params: { page } },
  );
  return data.data;
}

// ---------------------------------------------------------------------------
// Paid communities — the join that finally exists
// ---------------------------------------------------------------------------

/**
 * `GET /communities/{id}/subscription/status` — the viewer's own subscription
 * to this community. Answers for any community, paid or not; a free one simply
 * reports `has_subscription: false`.
 */
export async function fetchCommunitySubscriptionStatus(
  id: string,
): Promise<ApiCommunitySubscriptionStatus> {
  const { data } = await api.get<ApiEnvelope<ApiCommunitySubscriptionStatus>>(
    `/communities/${id}/subscription/status`,
  );
  return data.data;
}

/**
 * `POST /communities/{id}/subscribe` — **the paid-community payment route that
 * did not exist at the first integration**, when `/subscribe`, `/pay` and
 * `/checkout` all 404'd and `POST /join` could only answer 422 "Payment is
 * required to join this community."
 *
 * It answers a hosted `checkout_url` like a level upgrade, so the same
 * `PaymentSheet` renders it; the caller confirms afterwards by re-reading
 * `fetchCommunitySubscriptionStatus`. A backend that settles without a payment
 * page (a zero-fee or already-paid case) returns no URL, which the hook treats
 * as an immediate join.
 */
export async function subscribeToCommunity(id: string): Promise<ApiCommunitySubscribe> {
  const { data } = await api.post<ApiEnvelope<ApiCommunitySubscribe>>(
    `/communities/${id}/subscribe`,
  );
  return data.data;
}

/**
 * `POST /communities/fee-preview` — the platform-fee split for a fee the user
 * is *considering*, computed server-side.
 *
 * This replaces the create form's client-side 10% guess: until this endpoint
 * existed there was nothing to read `platform_fee_percent` from before a
 * community was created, so the preview hardcoded the web's stated rate.
 */
export async function previewCommunityFee(payload: {
  monthly_fee: number;
  fee_payer?: string;
  billing_type?: string;
  billing_interval?: string;
}): Promise<ApiCommunityFeePreview> {
  const { data } = await api.post<ApiEnvelope<ApiCommunityFeePreview>>(
    '/communities/fee-preview',
    payload,
  );
  return data.data;
}

// ---------------------------------------------------------------------------
// Community settings (owner)
// ---------------------------------------------------------------------------

/** `PUT /communities/{id}` — partial update; every field is optional. */
export async function updateCommunity(
  id: string,
  payload: UpdateCommunityPayload,
): Promise<Community> {
  const { data } = await api.put<ApiEnvelope<ApiCommunity>>(`/communities/${id}`, payload);
  return toCommunity(data.data);
}

/**
 * `DELETE /communities/{id}` — **now live.** It used to answer 405 (GET/HEAD
 * only), which is why "a community created by mistake is permanent" was a
 * standing gap; it isn't any more.
 */
export async function deleteCommunity(id: string): Promise<void> {
  await api.delete(`/communities/${id}`);
}

/** `POST /communities/{id}/archive` and `/unarchive` — hide without deleting. */
export async function setCommunityArchived(id: string, archived: boolean): Promise<void> {
  await api.post(`/communities/${id}/${archived ? 'archive' : 'unarchive'}`);
}

/**
 * `POST /communities/{id}/logo` and `/banner` — multipart, one file part named
 * for the image. The matching `DELETE` on each route clears it.
 */
export async function uploadCommunityImage(
  id: string,
  kind: 'logo' | 'banner',
  file: { uri: string; name: string; type: string },
): Promise<Community> {
  const form = new FormData();
  form.append(kind, file as unknown as Blob);
  const { data } = await api.post<ApiEnvelope<ApiCommunity>>(
    `/communities/${id}/${kind}`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return toCommunity(data.data);
}

/** `DELETE /communities/{id}/logo` | `/banner`. */
export async function deleteCommunityImage(
  id: string,
  kind: 'logo' | 'banner',
): Promise<void> {
  await api.delete(`/communities/${id}/${kind}`);
}

/**
 * `DELETE /communities/{id}/posts/{postId}`.
 *
 * The collection lists "Delete Community Post" against `POST .../view` — a
 * copy-paste error in the docs (that URL is the view recorder, and its example
 * response is the delete one). The real route is the DELETE below.
 */
export async function deleteCommunityPost(id: string, postId: string): Promise<void> {
  await api.delete(`/communities/${id}/posts/${postId}`);
}
