import { api } from './client';
import { tintFor } from './timeline';
import type {
  ApiEnvelope,
  ApiProfile,
  Currency,
  Paginated,
  ProfileViewResponse,
  SearchUser,
  ToggleFollowData,
} from './types';
import type { Member } from '../data/community';

/** GET /user/currency/list — payout currency options. */
export async function fetchCurrencies(): Promise<Currency[]> {
  const { data } = await api.get<ApiEnvelope<Currency[]>>('/user/currency/list');
  return data.data;
}

/** GET /user/channel — the "how did you hear about us?" options (plain strings). */
export async function fetchChannels(): Promise<string[]> {
  const { data } = await api.get<ApiEnvelope<string[]>>('/user/channel');
  return data.data;
}

/**
 * GET /user/profile/{username}. Note this endpoint breaks the usual envelope:
 * the member sits at the top level under `profile` and their posts come back as
 * a Laravel paginator under `data`, so we return the raw response.
 */
export async function fetchProfile(
  username: string,
  page = 1,
): Promise<ProfileViewResponse> {
  const { data } = await api.get<ProfileViewResponse>(
    `/user/profile/${encodeURIComponent(username)}`,
    { params: { page } },
  );
  return data;
}

/** GET /user/search?q= — paginated people search. */
export async function searchUsers(
  q: string,
  page = 1,
): Promise<Paginated<SearchUser>> {
  const { data } = await api.get<ApiEnvelope<Paginated<SearchUser>>>('/user/search', {
    params: { q, page },
  });
  return data.data;
}

/**
 * POST /user/toggle/follow?id= — follow/unfollow the given user. Returns the new
 * follow state and the caller's refreshed follower/following counts. A 404
 * ("User not found") surfaces as an ApiError like any other failure.
 *
 * **The verb changed from GET to POST** (confirmed live 2026-09-07: a GET now
 * answers 405 "Supported methods: POST"), which silently broke every follow
 * button in the app. The target still travels as the `?id=` **query param** —
 * sending it in a JSON body 404s with "User not found" — so the request has a
 * query string and no body, which reads oddly but is what the server accepts.
 */
export async function toggleFollow(userId: string): Promise<ToggleFollowData> {
  const { data } = await api.post<ApiEnvelope<ToggleFollowData>>(
    '/user/toggle/follow',
    undefined,
    { params: { id: userId } },
  );
  return data.data;
}

// ---------------------------------------------------------------------------
// API → view-model mapping
// ---------------------------------------------------------------------------

/** A search hit → the shared `Member` shape the list rows render. */
export function toMemberFromSearch(user: SearchUser): Member {
  return {
    id: user.id,
    name: user.name,
    handle: user.username,
    tint: tintFor(user.id),
    engagements: 0,
    followers: user.followers ?? 0,
    following: user.following ?? 0,
  };
}

/** A profile header → the shared `Member` shape. */
export function toMemberFromProfile(profile: ApiProfile): Member {
  return {
    id: profile.id,
    name: profile.name,
    handle: profile.username,
    tint: tintFor(profile.id),
    engagements: 0,
    followers: profile.followers ?? 0,
    following: profile.following ?? 0,
  };
}
