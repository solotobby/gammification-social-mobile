import { api, UPLOAD_TIMEOUT } from './client';
import type {
  ApiEnvelope,
  BookmarkToggleData,
  CreatePostData,
  Paginated,
  PostAnalyticsData,
  TimelineComment,
  TimelineMedia,
  TimelineMediaItem,
  TimelinePost,
  TimelinePostDetail,
  TimelinePostDetailResponse,
  TimelineUser,
  UpdatePostData,
} from './types';
import type { Comment, Member, MemberTint, Post } from '../data/community';
import type { MediaItem } from '../data/media';

export async function fetchFeed(page: number): Promise<Paginated<TimelinePost>> {
  const { data } = await api.get<ApiEnvelope<Paginated<TimelinePost>>>('/timeline/feed', {
    params: { page },
  });
  return data.data;
}

/** A picked file ready for the multipart body (React Native file part). */
export type NewPostImage = {
  uri: string;
  name: string;
  type: string;
};

export type NewPostVideo = NewPostImage;

/**
 * POST /timeline/post — multipart `content` plus optional media. The backend
 * accepts `images[]` (many) OR a single `video`, but not both in one post; the
 * compose screen enforces that per the account level before calling this.
 */
export async function createPost(
  content: string,
  images: NewPostImage[],
  video?: NewPostVideo | null,
): Promise<CreatePostData> {
  const form = new FormData();
  form.append('content', content);
  for (const image of images) {
    // React Native's FormData takes {uri, name, type} file descriptors.
    form.append('images[]', image as unknown as Blob);
  }
  if (video) {
    form.append('video', video as unknown as Blob);
  }
  const { data } = await api.post<ApiEnvelope<CreatePostData>>('/timeline/post', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: UPLOAD_TIMEOUT,
  });
  return data.data;
}

/** What an edit can change. Everything is optional — only what's set is sent. */
export type PostEdit = {
  content?: string;
  /** **Appended** to the post's existing images, not a replacement set. */
  images?: NewPostImage[];
  /** Replaces the post's video. */
  video?: NewPostVideo | null;
  removeVideo?: boolean;
};

/**
 * Edit a post. Two transports, and the choice is not cosmetic:
 *
 * - **Caption only → JSON `PUT`.** Verified live 2026-08-26.
 * - **Anything with media → `POST` with a `_method=PUT` part.** A real multipart
 *   `PUT` comes back 422 "Nothing to update" because PHP doesn't parse
 *   multipart bodies on PUT — every field arrives empty. The method override is
 *   the only way to send files to this route.
 *
 * Backend rules worth knowing before calling (all confirmed by probing, none of
 * them documented): `images[]` **appends** to what the post already has and the
 * account's tier cap counts existing + new ("Image count exceeds your account
 * limit"); and media can't be touched at all while `media_status` is
 * "processing" ("Media cannot be changed while processing is in progress").
 *
 * There is deliberately no per-image removal: no endpoint returns image ids any
 * more (`media.items[]` carries URLs only, and the detail response's old
 * `images[]` array is now null), so `remove_image_ids[]` cannot be populated.
 */
export async function updatePost(postId: string, edit: PostEdit): Promise<UpdatePostData> {
  const hasMedia = !!edit.images?.length || !!edit.video || !!edit.removeVideo;

  if (!hasMedia) {
    const { data } = await api.put<ApiEnvelope<UpdatePostData>>(`/timeline/post/${postId}`, {
      content: edit.content,
    });
    return data.data;
  }

  const form = new FormData();
  form.append('_method', 'PUT');
  if (edit.content != null) form.append('content', edit.content);
  for (const image of edit.images ?? []) {
    form.append('images[]', image as unknown as Blob);
  }
  if (edit.video) form.append('video', edit.video as unknown as Blob);
  if (edit.removeVideo) form.append('remove_video', '1');

  const { data } = await api.post<ApiEnvelope<UpdatePostData>>(
    `/timeline/post/${postId}`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' }, timeout: UPLOAD_TIMEOUT },
  );
  return data.data;
}

/** Fire-and-forget toggle — the backend queues it (202) and settles counts async. */
export async function toggleLike(postId: string): Promise<void> {
  await api.post('/timeline/like/toggle', { post_id: postId });
}

/**
 * POST /timeline/bookmark/toggle — returns the resulting state. Bookmarking your
 * own post is rejected with a 422 ("You cannot bookmark your own post"), so the
 * action isn't offered there.
 */
export async function toggleBookmark(postId: string): Promise<BookmarkToggleData> {
  const { data } = await api.post<ApiEnvelope<BookmarkToggleData>>(
    '/timeline/bookmark/toggle',
    { post_id: postId },
  );
  return data.data;
}

/** GET /timeline/bookmarks — full post objects, newest save first. */
export async function fetchBookmarks(page: number): Promise<Paginated<TimelinePost>> {
  const { data } = await api.get<ApiEnvelope<Paginated<TimelinePost>>>('/timeline/bookmarks', {
    params: { page },
  });
  return data.data;
}

/** GET /timeline/post/{id}/analytics — the author's per-post breakdown. */
export async function fetchPostAnalytics(postId: string): Promise<PostAnalyticsData> {
  const { data } = await api.get<ApiEnvelope<PostAnalyticsData>>(
    `/timeline/post/${postId}/analytics`,
  );
  return data.data;
}

export async function postComment(postId: string, comment: string): Promise<void> {
  await api.post('/timeline/comment', { post_id: postId, comment });
}

/** DELETE /timeline/delete/post/{id} — removes the caller's own post. */
export async function deletePost(postId: string): Promise<void> {
  await api.delete(`/timeline/delete/post/${postId}`);
}

/**
 * The "View" endpoint — fetching it is also what counts a view server-side.
 * Returns the post plus its comment thread as a separate paginator.
 */
export async function fetchPost(postId: string): Promise<TimelinePostDetailResponse> {
  const { data } = await api.get<ApiEnvelope<TimelinePostDetailResponse>>(
    `/timeline/post/${postId}`,
  );
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

/**
 * A video post's `media` block → one MediaItem. The backend transcodes an
 * upload into an SD and an HD rendition plus a poster frame and hands them back
 * on `media` itself (no `items` array, unlike images). The feed plays SD and
 * the full-screen viewer prefers HD.
 */
function videoMediaItem(media: TimelineMedia, postId: string): MediaItem | null {
  const uri = media.sd_url ?? media.hd_url ?? media.url;
  if (!uri) return null;
  return {
    id: `${postId}-video`,
    type: 'video',
    uri,
    hdUri: media.hd_url ?? undefined,
    // The live payload names the poster `thumbnail_url` (as the rolls media
    // block always did); `poster_url` is the older name.
    poster: media.thumbnail_url ?? media.poster_url ?? undefined,
    width: media.width ?? undefined,
    height: media.height ?? undefined,
    duration: media.duration ?? undefined,
  };
}

function mediaOf(post: TimelinePost | TimelinePostDetail): MediaItem[] | undefined {
  const items: MediaItem[] = [];
  if (post.media?.type === 'video') {
    const clip = videoMediaItem(post.media, post.id);
    if (clip) items.push(clip);
  } else if (post.media?.items?.length) {
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
  // Legacy detail shape — only if `media` didn't already describe the video.
  if (!items.some((item) => item.type === 'video') && 'video' in post && post.video?.full_path) {
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
  const body = raw.message ?? raw.comment ?? raw.body ?? raw.content;
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
 * Normalize a feed post into the app's `Post` view model. `comments` is the
 * total count; the latest few comment objects ride along in `comments_preview`
 * (with `latest_comments` / an embedded-array `comments` kept as fallbacks).
 */
/**
 * Per-post earnings. The backend ships them as `estimatedEarnings` (live since
 * 2026-08-26 on every post endpoint — feed, detail, profile and hashtag posts);
 * the other key names are kept as cheap insurance against a rename.
 *
 * Returns **undefined** when no figure came back, and the card then shows no
 * earned pill. Do not substitute a derived estimate here: an invented number on
 * a money surface is worse than no badge.
 */
function earnedOf(apiPost: Record<string, unknown>): number | undefined {
  for (const key of [
    'estimatedEarnings',
    'estimated_earnings',
    'earned',
    'earning',
    'earnings',
    'estimated_earning',
    'amount_earned',
  ]) {
    const raw = apiPost[key];
    const n = typeof raw === 'string' ? Number(raw) : typeof raw === 'number' ? raw : NaN;
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

export function toPost(apiPost: TimelinePost | TimelinePostDetail): Post {
  const rawComments = Array.isArray(apiPost.comments)
    ? apiPost.comments
    : (apiPost.comments_preview ?? apiPost.latest_comments ?? []);
  const comments = rawComments
    .map((raw, i) => toComment(raw, apiPost.id, i))
    .filter((c): c is Comment => c !== null);
  const commentCount =
    typeof apiPost.comments === 'number' ? apiPost.comments : comments.length;
  const media = mediaOf(apiPost);

  return {
    id: apiPost.id,
    author: toMember(apiPost.user),
    // The author's user id — compare against the signed-in user's id to tell
    // whether the post is theirs (there is no dedicated "is mine" API flag).
    ownerId: apiPost.user_id ?? apiPost.user.id,
    timeAgo: timeAgo(apiPost.created_at),
    body: apiPost.content,
    // Profile-view posts omit the like count; default to 0 (or the preview
    // length as a floor) so the card never renders NaN.
    likes: apiPost.likes ?? apiPost.likers_preview?.length ?? 0,
    // Only forward the flag when the endpoint actually sent it, so the heart
    // falls back to the session engagement store for responses that don't.
    likedByViewer: apiPost.is_liked_by_viewer,
    likedBy: apiPost.likers_preview?.map((liker) => ({
      id: liker.id,
      name: liker.name,
      handle: liker.username,
      tint: tintFor(liker.id),
    })),
    views: apiPost.views,
    earned: earnedOf(apiPost as unknown as Record<string, unknown>),
    earnedSymbol: apiPost.currencySymbol,
    // Seeds the bookmark icon the way `likedByViewer` seeds the heart.
    bookmarkedByViewer: apiPost.is_bookmarked,
    comments,
    commentCount,
    media,
    // While the backend transcodes an upload it sends `media: null` and hasn't
    // set `has_video`/`has_images` yet — `media_status` is the only signal, and
    // without it a just-posted video is an empty card.
    mediaPending: isMediaPending(apiPost),
    remote: true,
  };
}

/**
 * Is this post still waiting on its media? The feed doesn't poll for it — the
 * card shows a "processing" placeholder until a manual refresh returns the
 * finished media.
 */
function isMediaPending(post: TimelinePost | TimelinePostDetail): boolean {
  return post.media_status === 'processing' && !post.media;
}

/**
 * Normalize the GET /timeline/post/{id} response — the post merged with its
 * full (paginated) comment thread, which the detail screen renders in place of
 * the feed's short preview.
 */
export function toPostDetail(res: TimelinePostDetailResponse): Post {
  const comments = res.comments.data
    .map((raw, i) => toComment(raw, res.post.id, i))
    .filter((c): c is Comment => c !== null);

  return {
    ...toPost(res.post),
    comments,
    commentCount: res.comments.total,
  };
}

/**
 * Merge server comments with the comments the user wrote this session, dropping
 * any session entry the server already reflects (matched by author + body) so a
 * comment isn't shown twice once the backend has settled it.
 */
export function mergeComments(server: Comment[], mine: Comment[]): Comment[] {
  if (!mine.length) return server;
  const seen = new Set(server.map((c) => `${c.author.id}|${c.body}`));
  return [...server, ...mine.filter((c) => !seen.has(`${c.author.id}|${c.body}`))];
}
