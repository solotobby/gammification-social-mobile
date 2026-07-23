import { api } from './client';
import { tintFor } from './timeline';
import type {
  ApiEnvelope,
  Paginated,
  TimelinePost,
  TrendingData,
  TrendingHashtag,
  TrendingMember,
} from './types';
import type { Member, Topic } from '../data/community';

/** GET /explore/trending — the top few trending hashtags and members together. */
export async function fetchTrending(): Promise<TrendingData> {
  const { data } = await api.get<ApiEnvelope<TrendingData>>('/explore/trending');
  return data.data;
}

/** GET /explore/trending/hashtags — the full paginated hashtag leaderboard. */
export async function fetchTrendingHashtags(page = 1): Promise<Paginated<TrendingHashtag>> {
  const { data } = await api.get<ApiEnvelope<Paginated<TrendingHashtag>>>(
    '/explore/trending/hashtags',
    { params: { page } },
  );
  return data.data;
}

/** GET /explore/trending/members — the full paginated engagement leaderboard. */
export async function fetchTrendingMembers(page = 1): Promise<Paginated<TrendingMember>> {
  const { data } = await api.get<ApiEnvelope<Paginated<TrendingMember>>>(
    '/explore/trending/members',
    { params: { page } },
  );
  return data.data;
}

/** GET /explore/trending/hashtag/post?hashtag= — posts carrying a hashtag. */
export async function fetchHashtagPosts(
  hashtag: string,
  page = 1,
): Promise<Paginated<TimelinePost>> {
  const { data } = await api.get<ApiEnvelope<Paginated<TimelinePost>>>(
    '/explore/trending/hashtag/post',
    { params: { hashtag, page } },
  );
  return data.data;
}

// ---------------------------------------------------------------------------
// API → view-model mapping
// ---------------------------------------------------------------------------

/** A trending hashtag → the `Topic` chip/row shape. */
export function toTopic(tag: TrendingHashtag): Topic {
  return { id: tag.id, tag: tag.name, posts: tag.posts_count };
}

/** A trending member → the shared `Member` shape (`engagements` = total engagement). */
export function toTrendingMember(member: TrendingMember): Member {
  return {
    id: member.id,
    name: member.name,
    handle: member.username,
    tint: tintFor(member.id),
    engagements: member.total_engagement,
    followers: 0,
    following: 0,
  };
}
