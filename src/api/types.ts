/**
 * Payhankey API contract types.
 *
 * Mirrors the Postman collection ("Payhankey - Live"). Every endpoint wraps its
 * payload in `{ success, message, data }` — `ApiEnvelope<T>` models that.
 * Validation failures (422) come back Laravel-style as
 * `{ message, errors: { field: string[] } }`.
 */

export type ApiEnvelope<T> = {
  success?: boolean;
  message: string;
  data: T;
};

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export type RegisterPayload = {
  name: string;
  username: string;
  email: string;
  password: string;
  referral_code?: string;
};

/** POST /register — the OTP is emailed; `id` is needed to verify/resend. */
export type RegisterData = {
  id: string;
  otp?: number;
};

export type VerifyOtpPayload = {
  id: string;
  otp: string;
};

/** POST /verify/otp — verifying the email also signs the user in. */
export type VerifyOtpData = {
  user_id: string;
  token: string;
};

export type ResendOtpPayload = {
  id: string;
};

export type LoginPayload = {
  email: string;
  password: string;
};

/** POST /login — flat user fields plus the bearer token. */
export type LoginData = {
  id: string;
  name: string;
  username: string;
  email: string;
  access_token: string;
};

// ---------------------------------------------------------------------------
// User
// ---------------------------------------------------------------------------

export type ApiUser = {
  id: string;
  name: string;
  username: string;
  email: string;
  referral_code?: string;
  is_onboarded?: 0 | 1;
  status?: string;
  email_verified_at?: string | null;
  created_at?: string;
};

/** GET /user/me */
export type MeData = {
  user: ApiUser;
  level: string;
};

export type OnboardPayload = {
  heard: string;
  currency: string;
};

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

/** Laravel paginator envelope (GET /timeline/feed wraps posts in one). */
export type Paginated<T> = {
  current_page: number;
  data: T[];
  last_page: number;
  next_page_url: string | null;
  per_page: number;
  total: number;
};

export type TimelineUser = {
  id: string;
  username: string;
  name: string;
};

/** One entry of a feed post's `media.items` (CDN URLs, may be null while processing). */
export type TimelineMediaItem = {
  thumb_url: string | null;
  medium_url: string | null;
  full_url: string | null;
  width: number | null;
  height: number | null;
};

export type TimelineMedia = {
  type: string;
  items: TimelineMediaItem[];
};

/**
 * A comment as the backend may embed it on a post. The live API currently
 * returns only comment COUNTS (no comment objects anywhere), but the backend
 * dev plans to attach the latest comments per feed post — the optional field
 * names here cover the likely shapes so they render as soon as they ship.
 */
export type TimelineComment = {
  id?: string;
  comment?: string;
  body?: string;
  content?: string;
  created_at?: string;
  user?: TimelineUser;
};

/** A post as returned by GET /timeline/feed. */
export type TimelinePost = {
  id: string;
  user_id: string;
  content: string;
  views: number;
  likes: number;
  /** Count today; tolerate the backend switching this to embedded objects. */
  comments: number | TimelineComment[];
  /** Where the backend is expected to attach the latest comments per post. */
  latest_comments?: TimelineComment[];
  has_video: 0 | 1;
  has_images: 0 | 1;
  media_status?: string;
  media?: TimelineMedia | null;
  created_at: string;
  user: TimelineUser;
};

/** GET /timeline/post/{id} — the detail ("View") shape adds raw image rows. */
export type TimelinePostDetail = TimelinePost & {
  status?: string;
  updated_at?: string;
  video?: { full_path?: string | null; thumbnail_path?: string | null } | null;
  images?: {
    id: string;
    full_path: string | null;
    thumbnail_path: string | null;
    width: number | null;
    height: number | null;
  }[];
};

/** POST /timeline/post */
export type CreatePostData = {
  post_id: string;
  status: string;
  /** "processing" when images/video were attached and are still being encoded. */
  media_status?: string;
};
