import { Platform } from 'react-native';

import { api } from './client';
import { timeAgo, tintFor } from './timeline';
import type {
  ApiEnvelope,
  ApiRoll,
  Paginated,
  RollDetailData,
  RollMedia,
} from './types';
import type { Comment, Member } from '../data/community';

/**
 * Container formats AVFoundation cannot decode. The backend currently
 * transcodes rolls to **WebM** (VP8/VP9), which iOS has no decoder for — the
 * player logs `AVFoundationErrorDomain Code=-11828 "Cannot Open"` and shows
 * nothing. Rather than render a black rectangle, `playableUri` returns null for
 * these and the roll falls back to its poster frame.
 *
 * Android plays WebM natively, so this only gates iOS. Remove the gate once the
 * backend emits H.264/MP4 renditions.
 */
const UNPLAYABLE_ON_IOS = ['.webm'];

function isPlayable(uri: string | null | undefined): boolean {
  if (!uri) return false;
  if (Platform.OS !== 'ios') return true;
  const path = uri.split('?')[0].toLowerCase();
  return !UNPLAYABLE_ON_IOS.some((ext) => path.endsWith(ext));
}

/**
 * The best URL this platform can actually play, or null when every rendition is
 * in a format it can't decode. Prefers SD for the pager (smaller, starts fast).
 */
export function playableUri(media: RollMedia | null | undefined): string | null {
  if (!media) return null;
  for (const candidate of [media.sd_url, media.url, media.hd_url, media.low_url]) {
    if (isPlayable(candidate)) return candidate!;
  }
  return null;
}

/** GET /rolls — the randomised rolls pager. */
export async function fetchRolls(page: number): Promise<Paginated<ApiRoll>> {
  const { data } = await api.get<ApiEnvelope<Paginated<ApiRoll>>>('/rolls', {
    params: { page },
  });
  return data.data;
}

/** GET /rolls/{videoId} — one roll plus more to page through after it. */
export async function fetchRoll(videoId: string): Promise<RollDetailData> {
  const { data } = await api.get<ApiEnvelope<RollDetailData>>(`/rolls/${videoId}`);
  return data.data;
}

/** GET /rolls/{videoId}/comments — Laravel paginator of comments. */
export async function fetchRollComments(
  videoId: string,
  page: number,
): Promise<Paginated<RollComment>> {
  const { data } = await api.get<ApiEnvelope<Paginated<RollComment>>>(
    `/rolls/${videoId}/comments`,
    { params: { page } },
  );
  return data.data;
}

/**
 * A roll comment. The endpoint returns an empty list in the published example,
 * so the body is read through the same fallback chain as timeline comments.
 */
export type RollComment = {
  id?: string;
  message?: string;
  comment?: string;
  body?: string;
  content?: string;
  created_at?: string;
  user?: { id: string; name: string; username: string; avatar?: string | null };
};

/**
 * Roll comment → the same `Comment` the feed renders, so the rolls sheet and
 * the post screen show identical rows. The body field is read through the same
 * fallback chain as timeline comments — the published example is empty, so
 * which key the backend actually uses is still inference.
 */
export function toRollComment(raw: RollComment, index: number): Comment {
  const body = raw.message ?? raw.comment ?? raw.body ?? raw.content ?? '';
  const userId = raw.user?.id ?? `unknown-${index}`;
  return {
    id: raw.id ?? `roll-comment-${index}`,
    author: {
      id: userId,
      name: raw.user?.name ?? 'Someone',
      handle: raw.user?.username ?? 'someone',
      tint: tintFor(userId),
      engagements: 0,
      followers: 0,
      following: 0,
    },
    body,
    timeAgo: raw.created_at ? timeAgo(raw.created_at) : '',
  };
}

// ---------------------------------------------------------------------------
// API → view model
// ---------------------------------------------------------------------------

/** The shape the Rolls screen renders. */
export type Roll = {
  id: string;
  postId: string;
  author: Member;
  caption: string;
  /** Hashtags pulled out of the caption — the API has no separate field. */
  hashtags: string[];
  /** Null when no rendition plays on this platform (see `playableUri`). */
  uri: string | null;
  poster?: string;
  width?: number;
  height?: number;
  duration?: number;
  likes: number;
  comments: number;
  views: number;
  likedByViewer: boolean;
  following: boolean;
  /** True when media exists but this platform can't decode any rendition. */
  unplayableFormat: boolean;
};

function hashtagsIn(content: string): string[] {
  return Array.from(content.matchAll(/#([\p{L}\p{N}_]+)/gu)).map((m) => m[1]);
}

export function toRoll(api: ApiRoll): Roll {
  const uri = playableUri(api.media);
  const hasMedia = !!(api.media?.sd_url || api.media?.url || api.media?.hd_url);

  return {
    id: api.video_id,
    postId: api.post_id,
    author: {
      id: api.user.id,
      name: api.user.name,
      handle: api.user.username,
      tint: tintFor(api.user.id),
      engagements: 0,
      followers: 0,
      following: 0,
    },
    caption: api.content ?? '',
    hashtags: hashtagsIn(api.content ?? ''),
    uri,
    poster: api.media?.thumbnail_url ?? undefined,
    width: api.media?.width ?? undefined,
    height: api.media?.height ?? undefined,
    duration: api.media?.duration ?? undefined,
    likes: api.likes ?? 0,
    comments: api.comments ?? 0,
    views: api.video_views ?? api.views ?? 0,
    likedByViewer: !!api.is_liked_by_viewer,
    following: !!api.is_following,
    unplayableFormat: hasMedia && !uri,
  };
}
