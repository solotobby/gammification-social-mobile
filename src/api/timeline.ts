import { api } from './client';
import type {
  ApiEnvelope,
  CreatePostData,
  Paginated,
  TimelineComment,
  TimelineMediaItem,
  TimelinePost,
  TimelinePostDetail,
  TimelineUser,
} from './types';
import type { Comment, Member, MemberTint, Post } from '../data/community';
import type { MediaItem } from '../data/media';

export async function fetchFeed(page: number): Promise<Paginated<TimelinePost>> {
  const { data } = await api.get<ApiEnvelope<Paginated<TimelinePost>>>('/timeline/feed', {
    params: { page },
  });
  return data.data;
}

/** A picked image ready for the multipart body (React Native file part). */
export type NewPostImage = {
  uri: string;
  name: string;
  type: string;
};

export async function createPost(content: string, images: NewPostImage[]): Promise<CreatePostData> {
  const form = new FormData();
  form.append('content', content);
  for (const image of images) {
    // React Native's FormData takes {uri, name, type} file descriptors.
    form.append('images[]', image as unknown as Blob);
  }
  const { data } = await api.post<ApiEnvelope<CreatePostData>>('/timeline/post', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.data;
}

/** Fire-and-forget toggle — the backend queues it (202) and settles counts async. */
export async function toggleLike(postId: string): Promise<void> {
  await api.post('/timeline/like/toggle', { post_id: postId });
}

export async function postComment(postId: string, comment: string): Promise<void> {
  await api.post('/timeline/comment', { post_id: postId, comment });
}

/** The "View" endpoint — fetching it is also what counts a view server-side. */
export async function fetchPost(postId: string): Promise<TimelinePostDetail> {
  const { data } = await api.get<ApiEnvelope<TimelinePostDetail>>(`/timeline/post/${postId}`);
  return data.data;
}

// ---------------------------------------------------------------------------
// API → view-model mapping
// ---------------------------------------------------------------------------

const TINTS: MemberTint[] = ['violet', 'mint', 'gold', 'pink'];

/** Stable avatar tint per user id, so a member keeps their color across screens. */
export function tintFor(id: string): MemberTint {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return TINTS[hash % TINTS.length];
}

export function toMember(user: TimelineUser): Member {
  return {
    id: user.id,
    name: user.name,
    handle: user.username,
    tint: tintFor(user.id),
    engagements: 0,
    followers: 0,
    following: 0,
  };
}

/** Compact relative timestamp ("now", "5m", "3h", "2d", "Jan 5"). */
export function timeAgo(iso: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'now';
  const minutes = seconds / 60;
  if (minutes < 60) return `${Math.floor(minutes)}m`;
  const hours = minutes / 60;
  if (hours < 24) return `${Math.floor(hours)}h`;
  const days = hours / 24;
  if (days < 7) return `${Math.floor(days)}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function toMediaItem(item: TimelineMediaItem, type: string, index: number, postId: string): MediaItem | null {
  const uri = item.full_url ?? item.medium_url ?? item.thumb_url;
  if (!uri) return null;
  const isVideo = type.startsWith('video');
  return {
    id: `${postId}-media-${index}`,
    type: isVideo ? 'video' : 'image',
    uri,
    poster: isVideo ? (item.thumb_url ?? undefined) : undefined,
  };
}

function mediaOf(post: TimelinePost | TimelinePostDetail): MediaItem[] | undefined {
  const items: MediaItem[] = [];
  if (post.media?.items?.length) {
    post.media.items.forEach((item, i) => {
      const mapped = toMediaItem(item, post.media!.type ?? 'images', i, post.id);
      if (mapped) items.push(mapped);
    });
  } else if ('images' in post && post.images?.length) {
    post.images.forEach((image, i) => {
      if (image.full_path) {
        items.push({ id: `${post.id}-media-${i}`, type: 'image', uri: image.full_path });
      }
    });
  }
  if ('video' in post && post.video?.full_path) {
    items.push({
      id: `${post.id}-video`,
      type: 'video',
      uri: post.video.full_path,
      poster: post.video.thumbnail_path ?? undefined,
    });
  }
  return items.length ? items : undefined;
}

function toComment(raw: TimelineComment, postId: string, index: number): Comment | null {
  const body = raw.comment ?? raw.body ?? raw.content;
  if (!body) return null;
  return {
    id: raw.id ?? `${postId}-comment-${index}`,
    author: raw.user
      ? toMember(raw.user)
      : { id: 'unknown', name: 'Member', handle: 'member', tint: 'violet', engagements: 0, followers: 0, following: 0 },
    body,
    timeAgo: raw.created_at ? timeAgo(raw.created_at) : '',
  };
}

/**
 * Normalize an API post into the app's `Post` view model. Handles both the
 * count-only `comments` the API returns today and embedded comment objects
 * (either in `latest_comments` or in `comments` itself) once the backend
 * starts sending them.
 */
export function toPost(apiPost: TimelinePost | TimelinePostDetail): Post {
  const rawComments = Array.isArray(apiPost.comments)
    ? apiPost.comments
    : (apiPost.latest_comments ?? []);
  const comments = rawComments
    .map((raw, i) => toComment(raw, apiPost.id, i))
    .filter((c): c is Comment => c !== null);
  const commentCount = typeof apiPost.comments === 'number' ? apiPost.comments : comments.length;

  return {
    id: apiPost.id,
    author: toMember(apiPost.user),
    timeAgo: timeAgo(apiPost.created_at),
    body: apiPost.content,
    likes: apiPost.likes,
    views: apiPost.views,
    comments,
    commentCount,
    media: mediaOf(apiPost),
    remote: true,
  };
}
