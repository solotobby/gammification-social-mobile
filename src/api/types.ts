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
  /**
   * Added by the backend after the Postman docs were written (confirmed live
   * 2026-08-24) — these are what PUT /user/profile writes, and /user/me is the
   * only endpoint that reads them back flat.
   */
  date_of_birth?: string | null;
  gender?: string | null;
  location?: string | null;
  about?: string | null;
};

/** GET /user/me */
export type MeData = {
  user: ApiUser;
  level: string;
  /**
   * The account's wallet currency ("USD", "NGN", …). Undocumented but live —
   * this is the authority for formatting money, replacing the app's hardcoded
   * naira. See `src/hooks/useCurrency.ts`.
   */
  baseCurrency?: string;
};

/** The profile record PUT /user/profile writes, as the profile view returns it. */
export type ApiProfileDetail = {
  id?: string;
  user_id?: string;
  date_of_birth?: string | null;
  gender?: string | null;
  location?: string | null;
  about?: string | null;
  username_updated_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type OnboardPayload = {
  heard: string;
  currency: string;
};

/** GET /user/currency/list — one payout currency option. */
export type Currency = {
  symbol: string;
  code: string;
  country: string;
};

/**
 * GET /user/profile/{username}. The response is NOT the usual
 * `{ data }` envelope — the member sits at the top level under `profile`, and
 * their posts come back as a Laravel paginator under `data`.
 */
export type ApiProfile = {
  id: string;
  avatar: string | null;
  name: string;
  username: string;
  followers: number;
  following: number;
  status?: string;
  /**
   * **Shape changed** (confirmed live 2026-08-24): this used to be a free-text
   * bio string; it is now the nested profile record written by
   * PUT /user/profile. Anything reading it as text will get an object.
   */
  profile?: ApiProfileDetail | null;
  /** Whether the signed-in user follows this member, when the backend sends it. */
  is_following?: boolean;
};

export type ProfileViewResponse = {
  success?: boolean;
  message: string;
  profile: ApiProfile;
  data: Paginated<TimelinePost>;
  /** Added alongside the shape change above — all three are undocumented. */
  level?: string;
  baseCurrency?: string;
  total_posts?: number;
};

/** GET /user/search — a person match (their own follower/following counts). */
export type SearchUser = {
  id: string;
  name: string;
  username: string;
  avatar: string | null;
  followers: number;
  following: number;
};

/** GET /user/toggle/follow — the new state plus the caller's refreshed counts. */
export type ToggleFollowData = {
  following: boolean;
  auth_user: {
    id: string;
    following_count: number;
    followers_count: number;
  };
};

// ---------------------------------------------------------------------------
// Bank / withdrawal method  (GET+POST /user/bank)
// ---------------------------------------------------------------------------

/**
 * One field of the server-driven payout form. The backend decides which fields
 * apply from the account's wallet currency — a USD wallet is asked for PayPal /
 * USDT, an NGN one for bank code + account number — so the screen renders this
 * list rather than hard-coding a Nigerian bank form.
 */
export type BankFormField = {
  name: string;
  /** "select" | "email" | "text" | "number" — unknown types fall back to text. */
  type: string;
  label: string;
  required?: boolean;
  /** Required only when `payment_method` currently equals this value. */
  required_if?: string;
  /** Present for `type: "select"`. */
  options?: string[];
};

export type BankForm = {
  currency: string;
  payment_method?: string | null;
  fields: BankFormField[];
};

/** The saved payout destination. Which columns are filled depends on the method. */
export type WithdrawalMethod = {
  id: string;
  currency: string;
  payment_method: string;
  bank_code?: string | null;
  bank_name?: string | null;
  account_number?: string | null;
  account_name?: string | null;
  paypal_email?: string | null;
  usdt_wallet?: string | null;
  is_active?: boolean;
};

/** GET /user/bank — the form to render plus whatever is already saved. */
export type BankData = {
  form: BankForm;
  withdrawal_method?: WithdrawalMethod | null;
};

// ---------------------------------------------------------------------------
// Referrals & transactions  (GET /user/referrals, GET /user/transactions)
// ---------------------------------------------------------------------------

/**
 * Shapes confirmed live 2026-08-24 (the Postman collection ships no examples
 * for either). Both break the usual envelope: the list is a Laravel paginator
 * under `data`, and the aggregate rides *alongside* it at the envelope root —
 * `summary` for referrals, `stats` for transactions — not nested inside `data`.
 *
 * Both lists were empty on the test account, so the per-row fields below are
 * still inferred and every one is optional.
 */
export type ApiReferralUser = {
  id?: string;
  name?: string;
  username?: string;
  email?: string;
  avatar?: string | null;
  status?: string;
  /** Naira credited by this referral, under whichever name the backend uses. */
  earned?: number | string;
  bonus?: number | string;
  amount?: number | string;
  created_at?: string;
  joined_at?: string;
};

export type ApiTransaction = {
  id?: string;
  reference?: string;
  /** Human-readable line; `narration` / `title` are accepted fallbacks. */
  description?: string;
  narration?: string;
  title?: string;
  amount?: number | string;
  /** "payout" | "referral" | "credit" | "debit" … — mapped to an icon. */
  type?: string;
  kind?: string;
  status?: string;
  created_at?: string;
  date?: string;
};

/** GET /user/referrals — paginator plus a root-level `summary`. */
export type ReferralsResponse = {
  success?: boolean;
  message: string;
  data: Paginated<ApiReferralUser>;
  summary?: {
    total?: number;
    this_month?: number;
    referral_code?: string;
  };
};

/** GET /user/transactions — paginator plus a root-level `stats`. */
export type TransactionsResponse = {
  success?: boolean;
  message: string;
  data: Paginated<ApiTransaction>;
  /** Empty array on the test account, so the entry shape is still unknown. */
  stats?: unknown[];
};

// ---------------------------------------------------------------------------
// Settings  (PUT /user/profile, GET+PUT /user/socials)
// ---------------------------------------------------------------------------

/** PUT /user/profile — only these four fields are editable through this route. */
export type UpdateProfilePayload = {
  date_of_birth?: string;
  gender?: string;
  location?: string;
  about?: string;
};

/**
 * GET/PUT /user/socials. The documented payload carries five networks —
 * note there is no `tiktok` key, so the mobile form drops that field until the
 * backend adds it (a field that silently never saves is worse than none).
 */
export type Socials = {
  facebook?: string | null;
  instagram?: string | null;
  x?: string | null;
  linkedin?: string | null;
  pinterest?: string | null;
  /** Accepted on read in case the backend adds them; not sent on write. */
  tiktok?: string | null;
  twitter?: string | null;
};

// ---------------------------------------------------------------------------
// Rolls  (GET /rolls, /rolls/{videoId}, /rolls/{videoId}/comments)
// ---------------------------------------------------------------------------

/**
 * A roll's media block. NOTE: the backend currently transcodes to **WebM**
 * (`format: "webm"`), which AVFoundation cannot decode — those URLs do not play
 * on iOS at all. `thumbnail_url` is WebP, which iOS does render, so the player
 * falls back to the poster. See `src/api/rolls.ts`.
 */
export type RollMedia = {
  type: string;
  url?: string | null;
  sd_url?: string | null;
  hd_url?: string | null;
  low_url?: string | null;
  quality_versions?: unknown[];
  thumbnail_url?: string | null;
  duration?: number | null;
  width?: number | null;
  height?: number | null;
  /** "webm" | "mp4" … — used to skip formats iOS can't play. */
  format?: string | null;
};

export type ApiRoll = {
  video_id: string;
  post_id: string;
  content: string;
  likes: number;
  comments: number;
  views: number;
  video_views?: number;
  is_liked_by_viewer?: boolean;
  is_following?: boolean;
  user: TimelineUser;
  media?: RollMedia | null;
  created_at: string;
};

/** GET /rolls/{videoId} — the requested roll plus the rest of the pager. */
export type RollDetailData = {
  current: ApiRoll;
  more?: Paginated<ApiRoll>;
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
  /** CDN avatar URL when present (initials fall back to a tinted disc). */
  avatar?: string | null;
};

/** One entry of a post's `likers_preview` — the first few people who liked it. */
export type LikerPreview = {
  id: string;
  name: string;
  username: string;
  avatar?: string | null;
};

/** One entry of a feed post's `media.items` (CDN URLs, may be null while processing). */
export type TimelineMediaItem = {
  thumb_url: string | null;
  medium_url: string | null;
  full_url: string | null;
  width: number | null;
  height: number | null;
};

/**
 * A post's `media` block. One object whose shape follows `type`: image posts
 * carry an `items[]` array, video posts carry the transcoded renditions
 * (`sd_url` / `hd_url`) and a `poster_url` frame directly — there is no
 * `items` array on a video. Every variant field is optional so the normalizer
 * can read either without narrowing.
 */
export type TimelineMedia = {
  /** "images" | "video". */
  type: string;
  /** Image posts only — one entry per attached image. */
  items?: TimelineMediaItem[];
  /** Video posts only — CDN renditions, poster frame, and intrinsic size. */
  sd_url?: string | null;
  hd_url?: string | null;
  poster_url?: string | null;
  duration?: number | null;
  width?: number | null;
  height?: number | null;
};

/**
 * A comment as the backend embeds it on a post. The body lives in `message`
 * (the older `comment`/`body`/`content` names are kept as fallbacks). Feed
 * posts carry a few of these in `comments_preview`; the detail endpoint returns
 * the full, paginated thread.
 */
export type TimelineComment = {
  id?: string;
  post_id?: string;
  user_id?: string;
  message?: string;
  comment?: string;
  body?: string;
  content?: string;
  created_at?: string;
  user?: TimelineUser;
};

/**
 * A post as returned by the post-listing endpoints. The Profile View response
 * is the canonical (richest) shape and every post endpoint is converging on it
 * — `is_liked_by_viewer`, `likers_preview`, `media`, `comments_preview`, and a
 * `user.avatar` all ride along there. Feed / hashtag responses currently send a
 * subset (they carry a `likes` count but may omit `is_liked_by_viewer` and
 * `likers_preview`), so every added field is optional and the normalizer copes
 * with either shape.
 */
export type TimelinePost = {
  id: string;
  user_id: string;
  content: string;
  views: number;
  /** Like count — present on feed/hashtag posts; absent on profile posts. */
  likes?: number;
  /** Whether the signed-in viewer has liked this post (profile view sends it). */
  is_liked_by_viewer?: boolean;
  /** The first few people who liked the post (profile view sends it). */
  likers_preview?: LikerPreview[];
  /** Total comment count for the post. */
  comments: number | TimelineComment[];
  /** The latest few comments the backend embeds on each feed post. */
  comments_preview?: TimelineComment[];
  /** Legacy field name — kept as a fallback for older responses. */
  latest_comments?: TimelineComment[];
  has_video: 0 | 1;
  has_images: 0 | 1;
  media_status?: string;
  media?: TimelineMedia | null;
  created_at: string;
  user: TimelineUser;
};

/**
 * The post object inside GET /timeline/post/{id} — same core fields as a feed
 * post plus raw image/video rows and the extra engagement columns. Ownership is
 * derived from `user_id` (there is no dedicated "is mine" flag).
 */
export type TimelinePostDetail = TimelinePost & {
  unicode?: string;
  views_external?: number;
  clicks?: number;
  likes_external?: number;
  comment_external?: string;
  status?: string;
  updated_at?: string;
  video?: { full_path?: string | null; thumbnail_path?: string | null } | null;
  images?: {
    id: string;
    post_id?: string;
    path?: string | null;
    full_path: string | null;
    thumbnail_path: string | null;
    width: number | null;
    height: number | null;
  }[];
};

/**
 * GET /timeline/post/{id} response body. The shape changed: the post now nests
 * under `post`, and its comment thread comes back as its own Laravel paginator
 * under `comments` (paged via the `?comments_page=` query param).
 */
export type TimelinePostDetailResponse = {
  post: TimelinePostDetail;
  comments: Paginated<TimelineComment>;
};

/** POST /timeline/post */
export type CreatePostData = {
  post_id: string;
  status: string;
  /** "processing" when images/video were attached and are still being encoded. */
  media_status?: string;
};

// ---------------------------------------------------------------------------
// Explore
// ---------------------------------------------------------------------------

/** A trending hashtag (GET /explore/trending + /explore/trending/hashtags). */
export type TrendingHashtag = {
  id: string;
  name: string;
  posts_count: number;
  created_at?: string;
  updated_at?: string;
  trend_score?: number;
};

/** A trending member (GET /explore/trending + /explore/trending/members). */
export type TrendingMember = {
  id: string;
  name: string;
  username: string;
  total_engagement: number;
  avatar?: string | null;
};

/** GET /explore/trending — the top few of each, side by side. */
export type TrendingData = {
  hashtags: TrendingHashtag[];
  members: TrendingMember[];
};

// ---------------------------------------------------------------------------
// Earnings
// ---------------------------------------------------------------------------

/** The monetized / unmonetized engagement split inside an analytics bucket. */
export type EngagementBreakdown = {
  views: number;
  likes: number;
  comments: number;
  total_engagement: number;
};

/** GET /earnings/analytics/monthly?year=&month= */
export type MonthlyAnalytics = {
  /** "YYYY-MM". */
  month: string;
  total_posts: number;
  monetized: EngagementBreakdown;
  unmonetized: EngagementBreakdown;
  estimated_earning: number;
};

/** GET /earnings/analytics/yearly?year= — yearly totals plus a per-month list. */
export type YearlyAnalytics = {
  year: number;
  total_posts: number;
  total_monetized_engagement: number;
  total_unmonetized_engagement: number;
  total_estimated_earning: number;
  months: MonthlyAnalytics[];
};
