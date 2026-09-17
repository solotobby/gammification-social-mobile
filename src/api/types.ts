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
  /**
   * Profile images. Both are CDN URLs and both are null until uploaded — set by
   * POST /user/avatar and POST /user/banner, which each answer with this whole
   * record so the cached `/user/me` can be updated without a refetch.
   */
  avatar?: string | null;
  banner?: string | null;
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
  /** Uploaded cover image (POST /user/banner); null until one is set. */
  banner?: string | null;
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

/**
 * One bank in `BankForm.banks`. `code` is what `bank_code` is POSTed as; the
 * backend resolves `bank_name` (and, via its provider, `account_name`) itself.
 */
export type BankOption = {
  name: string;
  code: string;
  slug?: string;
  country?: string;
  nibss_bank_code?: string;
};

export type BankForm = {
  currency: string;
  payment_method?: string | null;
  fields: BankFormField[];
  /**
   * The bank list for an NGN wallet. **It sits here, beside `fields` — NOT on
   * the `bank_code` field's `options`**, which is empty (verified live
   * 2026-09-17). A form that only read `field.options` rendered an empty
   * picker, which is exactly what made "select bank" look broken on naira
   * accounts. Absent on a USD wallet, which asks for PayPal / USDT instead.
   */
  banks?: BankOption[];
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
// Wallet balances  (GET /user/wallet)
// ---------------------------------------------------------------------------

/**
 * One wallet balance. `type` is the stable key ("main" | "referral" |
 * "promoter"); `label` and `description` are the backend's own copy, and
 * `formatted` already carries the currency symbol — so the screen renders those
 * rather than re-deriving them and risking a different symbol per surface.
 */
export type WalletBalance = {
  type: string;
  label: string;
  description?: string | null;
  amount: number;
  formatted: string;
};

/**
 * GET /user/wallet — verified live 2026-08-26. There is **no "total withdrawn"**
 * balance; the wallet screen used to show one from dummy data and no longer
 * does.
 */
export type WalletBalancesData = {
  currency: string;
  currency_symbol: string;
  balances: WalletBalance[];
  total: { amount: number; formatted: string };
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
  /**
   * The payment reference. Live rows send **`ref`** — `reference` is kept as an
   * alias in case the field is ever renamed to match the checkout response,
   * which calls the same value `reference`.
   */
  ref?: string;
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
  /** Counts keyed by status, e.g. `{initiated: 7}`. Confirmed live 2026-09-03. */
  stats?: Record<string, number>;
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
  /**
   * Renditions by name. **Not a consistent shape**: a WebM roll sends an empty
   * array, an MP4 one sends `{high, medium, low}` — so it is typed as either
   * and read through `sd_url`/`hd_url`/`low_url`, which both shapes provide.
   */
  quality_versions?: unknown[] | Record<string, string>;
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
  /** Plays recorded through POST /rolls/{videoId}/play. */
  play_count?: number;
  /** Mean watch seconds recorded through POST /rolls/{videoId}/watch. */
  avg_watch_time?: number | null;
  user: TimelineUser;
  media?: RollMedia | null;
  created_at: string;
};

/** GET /rolls/{videoId} — the requested roll plus the rest of the pager. */
export type RollDetailData = {
  current: ApiRoll;
  more?: Paginated<ApiRoll>;
};

/**
 * GET /rolls/top — the Discover rail. A **plain array**, not a paginator, and a
 * leaner row than `ApiRoll`: it carries the ranking and enough to render a card,
 * but no counts and no viewer flags.
 */
export type ApiTopRoll = {
  rank: number;
  post_id: string;
  video_id: string;
  user: TimelineUser;
  media?: RollMedia | null;
};

/** POST /rolls/{videoId}/play */
export type RollPlayData = {
  video_id: string;
  post_id: string;
  play_count: number;
};

/** POST /rolls/{videoId}/watch */
export type RollWatchData = RollPlayData & {
  avg_watch_time: number;
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
  url?: string | null;
  sd_url?: string | null;
  hd_url?: string | null;
  low_url?: string | null;
  /**
   * The poster frame. The live payload calls it `thumbnail_url` (same key the
   * rolls endpoints use — the two media blocks have converged); `poster_url` is
   * kept as a fallback for older responses.
   */
  thumbnail_url?: string | null;
  poster_url?: string | null;
  duration?: number | null;
  width?: number | null;
  height?: number | null;
  /** "webm" | "mp4" … — see `playableUri` in src/api/rolls.ts. */
  format?: string | null;
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
  /**
   * Threading, live since 2026-09-16. A root comment has `parent_id: null` and
   * carries its answers inline in `replies[]`; a reply carries the parent's id
   * and `is_reply: true`. The top-level list holds **roots only** — replies
   * never appear there, so a flat render would silently drop them.
   *
   * Note `reply_count` counts a root's answers, while the post's own `comments`
   * total counts roots only (verified live: 2 roots + 1 reply reported as 2).
   */
  parent_id?: string | null;
  is_reply?: boolean;
  reply_count?: number;
  replies?: TimelineComment[];
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
  /**
   * Whether the signed-in viewer has bookmarked this post. Live on every post
   * endpoint since 2026-08-26 — it's what seeds the bookmark icon.
   */
  is_bookmarked?: boolean;
  /**
   * The post's earnings so far, in the *viewer's* currency, alongside the symbol
   * to print it with. Both landed 2026-08-26; before that the app had no
   * per-post figure at all (see `earnedOf` in src/api/timeline.ts).
   */
  estimatedEarnings?: number | string;
  currencySymbol?: string;
  /** GET /timeline/bookmarks only — when the viewer saved it. */
  bookmarked_at?: string;
  /**
   * Promotion, live on every post endpoint since 2026-09-16.
   *
   * `is_boosted` is the author's own view ("this post has a campaign"), while
   * `sponsored` is the *viewer's*: non-null only when the post is being shown
   * as an ad, and it carries the call-to-action and destination to render. A
   * post can be `is_boosted: true` with `sponsored: null` — that's the author
   * seeing their own promoted post in an ordinary feed slot.
   */
  is_boosted?: boolean;
  sponsored?: ApiSponsored | null;
  /** The most recent gifts sent to this post, plus the total count. */
  gifts?: ApiPostGift[];
  gifts_count?: number;
};

/** The ad payload on a post the viewer is being shown as sponsored. */
export type ApiSponsored = {
  boost_id?: string;
  /** Button wording chosen from the config's `cta_options`. */
  cta?: string | null;
  target_url?: string | null;
  /** Some payloads label the advertiser separately from the post author. */
  advertiser?: TimelineUser | null;
  label?: string | null;
};

/** One gift shown on a post — the artifact, who sent it, and what it cost. */
export type ApiPostGift = {
  id?: string;
  artifact_id?: string;
  name?: string;
  emoji?: string;
  /** Cost in PayKoin. */
  price?: number;
  tier?: string;
  quantity?: number;
  count?: number;
  sender?: TimelineUser | null;
  user?: TimelineUser | null;
  created_at?: string;
};

/** POST /timeline/bookmark/toggle — 422s with a message when it's your own post. */
export type BookmarkToggleData = {
  bookmarked: boolean;
  post_id: string;
};

/** PUT /timeline/post/{id} */
export type UpdatePostData = {
  post_id: string;
  /** "processing" when the edit attached media that is still being encoded. */
  media_status?: string;
};

/**
 * GET /timeline/post/{id}/analytics — verified live 2026-08-26.
 *
 * Note the two spellings side by side: `summary.currencySymbol` is camelCase
 * like the feed's, while everything around it is snake_case. Read it as sent.
 */
export type PostAnalyticsMetric = {
  monetized: number;
  unmonetized: number;
  total: number;
  revenue: number;
};

export type PostAnalyticsData = {
  post: {
    id: string;
    content: string;
    created_at: string;
    /** Server-rendered relative time ("2h ago", "4w ago"). */
    posted_ago: string;
    /** "Basic" | "Creator" | "Influencer". */
    account_level?: string;
  };
  summary: {
    monetized_engagements: number;
    estimated_total_earnings: number;
    currencySymbol?: string;
    earnings_breakdown: { views: number; likes: number; comments: number };
  };
  stats: {
    total_views: number;
    monetized_likes: number;
    total_comments: number;
    monetized_engagement: number;
  };
  views: PostAnalyticsMetric;
  likes: PostAnalyticsMetric;
  comments: PostAnalyticsMetric;
  revenue_breakdown: {
    type: string;
    label: string;
    monetized_count: number;
    revenue: number;
  }[];
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

/**
 * GET /earnings/overview — the "how am I doing" signal, already worded by the
 * backend. Both halves carry a display `message`, and the money half ships a
 * pre-`formatted` string so the client never re-derives a currency symbol.
 */
export type EarningsOverview = {
  /** ISO timestamps; the server recomputes hourly (`refresh_after`). */
  generated_at: string;
  refresh_after: string;
  /** Window the reach figure covers (24 at the time of writing). */
  period_hours: number;
  reach: {
    people: number;
    hours: number;
    message: string;
  };
  monthly_earnings: {
    amount: number;
    currency: string;
    currency_symbol: string;
    formatted: string;
    message: string;
  };
  /** Both messages in display order, for surfaces that just want the copy. */
  messages: string[];
};

// ---------------------------------------------------------------------------
// Blog
// ---------------------------------------------------------------------------

/**
 * One row of GET /blogs (and the payload of GET /blogs/{slug}).
 *
 * The endpoint was empty on every environment when this was written
 * (`total: 0`), so the field names below are **inference** from the rest of the
 * API's conventions, and every one of them is optional. `toBlogPost` reads a
 * few aliases per field rather than betting on a single spelling — tighten this
 * up once real content exists to check against.
 */
export type ApiBlogPost = {
  id?: string | number;
  slug?: string;
  title?: string;
  excerpt?: string | null;
  summary?: string | null;
  description?: string | null;
  body?: string | null;
  content?: string | null;
  category?: string | { name?: string; title?: string } | null;
  image?: string | null;
  cover_image?: string | null;
  banner?: string | null;
  thumbnail?: string | null;
  featured_image?: string | null;
  read_time?: number | string | null;
  read_minutes?: number | null;
  published_at?: string | null;
  created_at?: string | null;
  date?: string | null;
  author?: string | { name?: string } | null;
};

// ---------------------------------------------------------------------------
// Communities
//
// The Postman collection documents 10 community endpoints but omits three
// things the app depends on, all established by probing the live API
// (2026-09-02) — see "Communities" in AGENTS.md:
//   1. POST /communities/{id}/join and /leave exist but are undocumented.
//   2. Paid communities carry a `pricing` block the docs never show.
//   3. `access` gates the feed, and the backend writes the gate copy.
// ---------------------------------------------------------------------------

/** The four community types, as the `type` field spells them. */
export type ApiCommunityType = 'public' | 'private' | 'paid' | 'approval';

/** Who absorbs the platform fee on a paid community. */
export type ApiFeePayer = 'members' | 'creator';

/** One-time payment vs a recurring subscription. */
export type ApiBillingType = 'one_off' | 'subscription';

/** Subscription cadence. `yearly`/`daily` are rejected by the API. */
export type ApiBillingInterval = 'monthly' | 'weekly' | 'quarterly';

export type ApiCommunityCategory = {
  id: string;
  name: string;
};

export type ApiCommunityUser = {
  id: string;
  username: string;
  name: string;
  avatar: string | null;
};

/**
 * Pricing on a paid community — **computed by the backend**, including the
 * platform-fee split and a written `billing_label`. Render these rather than
 * re-deriving them, exactly like `/user/wallet`'s `formatted` strings.
 *
 * `fee_payer: 'creator'` → the member pays `list_price` and the creator
 * receives it minus the fee. `fee_payer: 'members'` → the fee is added on top,
 * so `member_charge` exceeds `list_price` and the creator receives it whole.
 */
export type ApiCommunityPricing = {
  list_price: number;
  fee_payer: ApiFeePayer;
  billing_type: ApiBillingType;
  billing_interval: ApiBillingInterval | null;
  /** Backend-written copy: "One-off payment", "Billed monthly", … */
  billing_label: string;
  platform_fee_percent: number;
  /** What a joining member is actually charged. */
  member_charge: number;
  platform_fee: number;
  /** What the owner receives per payment. */
  creator_payout: number;
};

export type ApiCommunityMembership = {
  is_owner: boolean;
  is_admin: boolean;
  is_member: boolean;
  role: 'owner' | 'admin' | 'member' | null;
  pending_join_request: boolean;
  pending_invite: boolean;
  subscription_status: string | null;
};

/**
 * Feed/member gating. `feed_gate_message` is the backend's own explanation of
 * *why* the feed is closed and differs per type, so the screen prints it
 * verbatim instead of inventing copy per status.
 */
export type ApiCommunityAccess = {
  can_view_feed: boolean;
  can_view_members: boolean;
  feed_gate_message: string | null;
};

/** A community row. List rows omit `membership` / `access` / `posts_count`. */
export type ApiCommunity = {
  id: string;
  name: string;
  slug: string;
  description: string;
  type: ApiCommunityType;
  currency: string;
  image: string | null;
  banner: string | null;
  members_count: number;
  posts_count?: number;
  category: ApiCommunityCategory | null;
  owner: ApiCommunityUser;
  pricing?: ApiCommunityPricing | null;
  membership?: ApiCommunityMembership | null;
  /**
   * List rows only. Added by the backend 2026-09-03 so a joined community stops
   * offering a "Join" button; the detail endpoint sends the full `membership`
   * block instead and omits this. True for owners as well as plain members, so
   * it answers "am I in?" — not "what am I?".
   */
  is_member?: boolean | null;
  access?: ApiCommunityAccess | null;
  share_slug?: string | null;
  share_url?: string | null;
  created_at: string;
};

/** `GET /communities` breaks the envelope: `currency` sits beside `data`. */
export type CommunityListResponse = ApiEnvelope<Paginated<ApiCommunity>> & {
  currency?: string;
};

/** What `POST /communities/{id}/join` and `/leave` answer with. */
export type ApiCommunityJoinData = {
  /** `joined` | `left` | `request_sent` | `request_pending`. */
  action: string;
  community: ApiCommunity;
};

export type ApiCommunityPostUser = ApiCommunityUser;

export type ApiCommunityPostMedia = {
  url?: string | null;
  full_url?: string | null;
  type?: string | null;
  thumbnail_url?: string | null;
};

export type ApiCommunityComment = {
  id: string;
  content: string;
  user: ApiCommunityPostUser;
  created_at: string;
  /**
   * Threading — identical semantics to the timeline's, live since 2026-09-16:
   * roots carry their answers in `replies[]` and the top-level list holds roots
   * only. (The body field differs — `content` here, `message` on the timeline —
   * but nothing else does.)
   */
  parent_id?: string | null;
  is_reply?: boolean;
  reply_count?: number;
  replies?: ApiCommunityComment[];
};

export type ApiCommunityPost = {
  id: string;
  community_id: string;
  content: string;
  word_count: number;
  likes_count: number;
  comments_count: number;
  views_count: number;
  is_liked: boolean;
  user: ApiCommunityPostUser;
  media: ApiCommunityPostMedia[] | null;
  created_at: string;
  /** Present on the list endpoint only, like the timeline's comments_preview. */
  comments?: {
    preview: ApiCommunityComment[];
    total: number;
    has_more: boolean;
  } | null;
};

export type ApiCommunityLikeData = { liked: boolean; likes_count: number };
export type ApiCommunityViewData = { recorded: boolean; views_count: number };

/** Body for `POST /communities`. Paid types carry the four extra fields. */
export type CreateCommunityPayload = {
  name: string;
  description: string;
  community_categories_id: string;
  type: ApiCommunityType;
  monthly_fee?: number;
  fee_payer?: ApiFeePayer;
  billing_type?: ApiBillingType;
  billing_interval?: ApiBillingInterval;
};

/** Query params `GET /communities` actually validates. */
export type CommunityListParams = {
  page?: number;
  /** The search field is `search` — a `q` param is silently ignored. */
  search?: string;
  /** Enum-validated: anything but these three 422s. */
  filter?: 'all' | 'joined' | 'mine';
  category_id?: string;
};

/**
 * Invites on a private community — `GET /communities/{id}/invites` (owner or
 * admin only). Undocumented, and the only way a private community can be
 * joined: `link_invite.token` is passed back as `invite_token` on join.
 *
 * There is no POST route, so the link invite can't be created, rotated or
 * revoked from the app — the backend issues one per community and this reads it.
 */
export type ApiCommunityInvites = {
  link_invite: {
    id: string;
    type: string;
    token: string;
    status: string;
    uses_count: number;
    expires_at: string | null;
    user: ApiCommunityUser | null;
  } | null;
  direct_invites: unknown[];
};

/** One pending request on an `approval` community. */
export type ApiCommunityJoinRequest = {
  id: string;
  status: string;
  reason: string | null;
  user: ApiCommunityUser;
  reviewed_at: string | null;
  created_at: string;
};

// ---------------------------------------------------------------------------
// Subscription levels (Basic / Creator / Influencer)
//
// `GET /user/levels` + `POST /user/levels/{id}/checkout`, added 2026-09-03.
// This replaces the hardcoded tier cards on /upgrade: the backend now owns the
// prices, the copy, the per-level limits and whether a level can be paid for.
// ---------------------------------------------------------------------------

export type ApiLevelPricing = {
  list_price: number;
  /** What a subscription actually costs, after `subscription_discount_percent`. */
  subscription_price: number;
  currency: string;
  currency_symbol: string;
  interval: string;
  /** Signup bonus credited on this level. */
  reg_bonus: number;
  ref_bonus: number;
  min_withdrawal: number;
  subscription_discount_percent: number;
};

export type ApiLevelEarnings = {
  per_view: number;
  per_like: number;
  per_comment: number;
};

export type ApiLevelMedia = {
  images: { allowed: boolean; max: number };
  video: { allowed: boolean; max_seconds: number };
};

/**
 * How this level can be paid for. `available` is false for the free level and
 * for anything that isn't an upgrade from where you are, so it — not
 * `is_selectable` — is what gates the checkout button.
 */
export type ApiLevelPayment = {
  provider: string | null;
  available: boolean;
  checkout_method: string;
  /**
   * Absolute path including the `/v1` prefix, e.g.
   * `/v1/user/levels/{id}/checkout`. The client builds its own URL from the
   * axios base instead of using this, so the two can't disagree about hosts.
   */
  checkout_path: string | null;
  public_key: string | null;
};

export type ApiLevel = {
  id: string;
  name: string;
  rank: number;
  /** "Most popular", or null. Backend-written. */
  badge: string | null;
  tagline: string;
  features: string[];
  is_current: boolean;
  is_free: boolean;
  is_upgrade: boolean;
  is_downgrade: boolean;
  is_selectable: boolean;
  pricing: ApiLevelPricing;
  earnings: ApiLevelEarnings;
  media: ApiLevelMedia;
  payment: ApiLevelPayment;
};

export type ApiLevelsData = {
  current_level: string;
  currency: string;
  currency_symbol: string;
  subscription: {
    plan_name: string;
    status: string;
    start_date: string | null;
    next_payment_date: string | null;
  } | null;
  /**
   * Which billing modes the account can use. Currently `["subscription"]` only,
   * so the screen hides its mode toggle rather than offering a single choice.
   */
  billing: {
    supports_subscription_discount: boolean;
    modes: string[];
    default_mode: string;
    subscription_discount_percent: number;
  };
  levels: ApiLevel[];
};

/** What `POST /user/levels/{id}/checkout` answers with. */
export type ApiLevelCheckout = {
  provider: string;
  billing_mode: string;
  /** Hosted payment page — opened in the system browser. */
  checkout_url: string;
  reference: string;
  transaction_id: string;
  amount: number;
  currency: string;
  level: { id: string; name: string };
  public_key: string | null;
};

// ---------------------------------------------------------------------------
// Notifications
//
// Added to the collection 2026-09-07. Every route answers 200, but no
// engagement writes a row on staging, so the row fields below are inference —
// see the caveat at the top of src/api/notifications.ts.
// ---------------------------------------------------------------------------

/**
 * One notification row. Deliberately loose: the backend may flatten its payload
 * onto the row or nest it under `data`/`payload` (Laravel's own column), so
 * `toAppNotification` reads both and this type permits both.
 */
export type ApiNotification = {
  id?: string;
  type?: string;
  kind?: string;
  event?: string;
  message?: string;
  text?: string;
  title?: string;
  body?: string;
  created_at?: string;
  read_at?: string | null;
  is_read?: boolean;
  read?: boolean;
  post_id?: string;
  community_id?: string;
  amount?: number | string;
  currency_symbol?: string;
  actor?: ApiCommunityUser | null;
  user?: ApiCommunityUser | null;
  sender?: ApiCommunityUser | null;
  from?: ApiCommunityUser | null;
  /** Laravel nests the payload here; an API resource usually flattens it. */
  data?: Record<string, unknown> | null;
  payload?: Record<string, unknown> | null;
};

/** `unread_count` sits *beside* `data`, not inside it. */
export type NotificationListResponse = ApiEnvelope<Paginated<ApiNotification>> & {
  unread_count?: number;
};

// ---------------------------------------------------------------------------
// PayKoin
//
// The in-app coin used for gifting. Top-up runs through the same hosted
// checkout as a level upgrade (Korapay/Flutterwave), so `ApiPayKoinTopUp`
// deliberately mirrors `ApiLevelCheckout`'s `checkout_url`.
// ---------------------------------------------------------------------------

export type ApiPayKoinBalance = {
  /** Coins bought, and so spendable on gifts. */
  paykoin_spendable: number;
  /** Coins received as gifts — the only balance `convert` will take. */
  paykoin_earned: number;
  currency: string;
  min_top_up: number;
  /** `list` = fiat per coin when buying, `convert` = fiat per coin cashing out. */
  rates: { list: number; convert: number };
};

export type ApiPayKoinTopUp = {
  checkout_url: string;
  reference?: string;
  amount?: number;
  currency?: string;
};

export type ApiPayKoinTopUpStatus = {
  status?: string;
  reference?: string;
  amount?: number;
  paykoin?: number;
  paid?: boolean;
  created_at?: string;
};

export type ApiPayKoinTransaction = {
  id?: string;
  type?: string;
  status?: string;
  amount?: number | string;
  paykoin?: number | string;
  coins?: number | string;
  currency?: string;
  reference?: string;
  description?: string;
  narration?: string;
  created_at?: string;
  user?: ApiCommunityUser | null;
};

// ---------------------------------------------------------------------------
// Community — members, moderation, analytics, earnings, subscriptions
//
// All added to the collection 2026-09-07. Unlike the notification routes these
// return real data on staging and were each verified live.
// ---------------------------------------------------------------------------

export type ApiCommunityMemberRole = 'owner' | 'admin' | 'member';

/** A row of `GET /communities/{id}/members` (and `/members/banned`). */
export type ApiCommunityMemberRow = ApiCommunityUser & {
  role: ApiCommunityMemberRole;
  status: string;
  joined_at?: string;
  banned_at?: string;
};

/**
 * A row of `analytics.top_posts`.
 *
 * **Not `ApiCommunityPost`** — the analytics endpoint sends a different shape
 * (verified live 2026-09-07): it omits `is_liked`, `word_count` and the
 * `comments` preview that the posts list carries, and adds `gifts_count`,
 * `media_status`, `updated_at` and a flat `user_id`. Typing it separately keeps
 * the posts type honest about what the *posts* endpoint returns.
 */
export type ApiCommunityTopPost = {
  id: string;
  community_id: string;
  user_id: string;
  content: string;
  media_status?: string | null;
  views_count: number;
  likes_count: number;
  comments_count: number;
  /** Gifts received — analytics is the only place this is reported. */
  gifts_count?: number;
  created_at: string;
  updated_at?: string;
  user: ApiCommunityUser;
  media: ApiCommunityPostMedia[] | null;
};

/** `GET /communities/{id}/analytics`. */
export type ApiCommunityAnalytics = {
  community_id: string;
  community_name: string;
  stats: {
    members_total: number;
    members_7d: number;
    members_30d: number;
    posts_total: number;
    posts_7d: number;
    posts_30d: number;
    likes_total: number;
    comments_total: number;
    views_total: number;
    pending_requests: number;
    active_subscribers: number;
    invite_link_uses: number;
  };
  top_posts: ApiCommunityTopPost[];
  recent_members: (ApiCommunityUser & {
    pivot?: { role?: string; status?: string; created_at?: string };
  })[];
};

/** `GET /communities/{id}/earnings` — stats beside a paginator of payments. */
export type ApiCommunityEarnings = {
  stats: {
    period: string;
    gross: number;
    platform_fee: number;
    creator_amount: number;
    count: number;
    active_subscribers_count: number;
    platform_fee_percent: number;
    currency: string;
  };
  payments: Paginated<ApiCommunityPayment>;
};

export type ApiCommunityPayment = {
  id?: string;
  amount?: number | string;
  platform_fee?: number | string;
  creator_amount?: number | string;
  currency?: string;
  status?: string;
  created_at?: string;
  user?: ApiCommunityUser | null;
};

/** `GET /communities/{id}/subscription/status`. */
export type ApiCommunitySubscriptionStatus = {
  has_subscription: boolean;
  is_active: boolean;
  status: string | null;
  billing_type: string | null;
  billing_interval: string | null;
  amount: number;
  starts_at: string | null;
  expires_at: string | null;
};

/**
 * `POST /communities/{id}/subscribe` — the paid-community join that did not
 * exist when communities were first integrated. Answers a hosted `checkout_url`
 * exactly like a level upgrade, so `PaymentSheet` renders it unchanged.
 */
export type ApiCommunitySubscribe = {
  checkout_url?: string;
  reference?: string;
  amount?: number;
  currency?: string;
  provider?: string;
  /** Set when the backend settles the join without a payment page. */
  subscribed?: boolean;
  status?: string;
};

/**
 * `POST /communities/fee-preview` — the split, computed server-side.
 *
 * Note the **camelCase** money keys: this endpoint does not follow the
 * snake_case convention the `pricing` block on a community uses
 * (`member_charge` / `platform_fee` / `creator_payout`), so the two shapes are
 * deliberately not shared. Verified live 2026-09-07.
 */
export type ApiCommunityFeePreview = {
  memberCharge: number;
  platformCut: number;
  creatorPayout: number;
  platform_fee_percent: number;
  billing_type?: ApiBillingType;
  billing_interval?: ApiBillingInterval | null;
  /** Written by the backend: "/mo", "/wk", or "" for a one-off. */
  suffix?: string;
};

/** What `PUT /communities/{id}` accepts. Every field is optional. */
export type UpdateCommunityPayload = {
  name?: string;
  description?: string;
  community_categories_id?: string;
  type?: ApiCommunityType;
  monthly_fee?: number;
  fee_payer?: ApiFeePayer;
  billing_type?: ApiBillingType;
  billing_interval?: ApiBillingInterval;
};

/**
 * A gift artifact from `GET /gifts` — undocumented, found by probing. `price`
 * is in PayKoin, and `tier` groups the catalog ("classic", "fashion",
 * "payhankey", "premium").
 */
export type ApiGiftArtifact = {
  id: string;
  name: string;
  emoji: string;
  price: number;
  tier: string;
};

// ---------------------------------------------------------------------------
// Password reset (POST /forgot-password, POST /reset-password)
//
// One-shot reset: there is **no endpoint that verifies a reset OTP on its own**
// (`/verify/otp` takes a user id and belongs to registration). The code is
// carried from the OTP screen to `/reset-password`, which checks it and sets
// the new password in the same call — so an invalid code surfaces there, not on
// the code screen.
// ---------------------------------------------------------------------------

export type ForgotPasswordPayload = { email: string };

export type ForgotPasswordData = {
  email: string;
  /** How long the emailed code stays valid — shown on the OTP screen. */
  expires_in_minutes?: number;
};

export type ResetPasswordPayload = {
  email: string;
  otp: string;
  password: string;
  password_confirmation: string;
};

// ---------------------------------------------------------------------------
// Avatar & banner (POST /user/avatar, POST /user/banner)
//
// Both answer with the uploaded URL *and* the whole updated user record, so the
// `['me']` cache can be written straight from the response with no refetch.
// ---------------------------------------------------------------------------

/** A picked image ready for a multipart body (React Native file descriptor). */
export type UploadFile = {
  uri: string;
  name: string;
  type: string;
};

export type AvatarUploadData = {
  avatar?: string | null;
  banner?: string | null;
  user: ApiUser;
};

// ---------------------------------------------------------------------------
// Followers / following (GET /user/profile/{username}/followers | /following)
//
// A plain Laravel paginator of member rows — 20 a page. Each row carries
// `is_following` (the *viewer's* relationship to that member, so a follow
// button can render its true initial state) and `is_me`, which is what the
// profile endpoint still does not send for the member themselves.
// ---------------------------------------------------------------------------

export type ApiConnectionUser = {
  id: string;
  name: string;
  username: string;
  avatar?: string | null;
  about?: string | null;
  /** Does the *signed-in viewer* follow this member? */
  is_following?: boolean;
  /** Is this row the signed-in viewer? */
  is_me?: boolean;
  followed_at?: string;
};

// ---------------------------------------------------------------------------
// Payouts (GET /user/payouts)
//
// Breaks the envelope the same way `/user/referrals` does: the paginator sits
// under `data.payouts` with a `data.summary` aggregate beside it, rather than
// the paginator being `data` itself.
// ---------------------------------------------------------------------------

export type ApiPayoutSummary = {
  total_paid?: number;
  total_queued?: number;
  currency?: string;
};

export type ApiPayout = {
  id?: string;
  reference?: string;
  ref?: string;
  amount?: number | string;
  /** Pre-formatted money string where the backend sends one. */
  formatted?: string;
  currency?: string;
  /** "Queued" | "Paid" | "Processing" | "Failed" — capitalized by the API. */
  status?: string;
  method?: string;
  narration?: string;
  description?: string;
  created_at?: string;
  paid_at?: string;
};

export type PayoutsData = {
  summary?: ApiPayoutSummary;
  payouts?: Paginated<ApiPayout>;
};

// ---------------------------------------------------------------------------
// Gifting (GET /gifts, POST /gifts/send, GET /gifts/post/{type}/{id})
//
// **`post_type` is required on send and is what fixed the long-standing 404.**
// Before 2026-09-16 the app sent `{artifact_id, post_id}` and every call came
// back 404 "Post or creator not found" — it was never a broken endpoint, just a
// missing discriminator. Verified live: with `post_type` the same call reaches
// the balance check ("Not enough PayKoin to send this gift."), without it the
// 404 returns exactly as before.
// ---------------------------------------------------------------------------

/** Which table `post_id` points into. */
export type GiftPostType = 'timeline' | 'post' | 'community' | 'community_post';

export type GiftSendPayload = {
  artifact_id: string;
  post_id: string;
  post_type: GiftPostType;
};

/** GET /gifts/post/{post_type}/{post_id} — what a post has received so far. */
export type ApiPostGiftsData = {
  total?: number;
  recent?: ApiPostGift[];
  /** The viewer's own spendable balance, so the sheet needn't fetch it twice. */
  spendable?: number;
};

// ---------------------------------------------------------------------------
// Boosting (GET|POST /timeline/post/{id}/boost*, /boosts*)
//
// Boosts are bought with **PayKoin, not fiat** — `fiat_*` fields are there to
// price the coins in the wallet currency for display, and the charge itself is
// a coin debit that shows up in PayKoin activity as a `post_boost` row.
// ---------------------------------------------------------------------------

/** A pre-priced click bundle offered by the config. */
export type ApiBoostPackage = {
  clicks: number;
  pk_cost: number;
  fiat_cost: number;
};

export type ApiBoostConfig = {
  /** Both spellings ship; either being false means boosting is switched off. */
  boost_enabled?: boolean;
  is_boost_enabled?: boolean;
  rate_pk_per_click?: number;
  rate_per_click_paykoin?: number;
  /** Wallet-currency price of one coin, for showing what a bundle costs. */
  fiat_per_pk?: number;
  rate_fiat_per_click?: number;
  min_clicks?: number;
  /** The viewer's spendable coins — both spellings ship. */
  user_spendable_pk?: number;
  user_spendable_paykoin?: number;
  currency?: string;
  /** The only accepted button wordings. */
  cta_options?: string[];
  packages?: ApiBoostPackage[];
  post?: {
    id: string;
    content?: string;
    is_boosted?: boolean;
    media_status?: string;
    has_images?: boolean;
    has_video?: boolean;
  };
};

export type BoostPayload = {
  target_url: string;
  cta: string;
  clicks: number;
  /** Where the promoted post may appear. At least one must be true. */
  platform_payhankey: boolean;
  platform_partner: boolean;
};

export type ApiBoostCampaign = {
  id: string;
  post_id?: string;
  status?: string;
  cta?: string | null;
  target_url?: string | null;
  /** Clicks bought vs. clicks served. */
  clicks?: number;
  clicks_purchased?: number;
  clicks_delivered?: number;
  clicks_used?: number;
  impressions?: number;
  pk_cost?: number;
  platform_payhankey?: boolean;
  platform_partner?: boolean;
  created_at?: string;
  post?: TimelinePost | null;
};

// ---------------------------------------------------------------------------
// Push device tokens  (POST /notifications/device-token)
// ---------------------------------------------------------------------------

/**
 * What the app sends when it registers for push.
 *
 * Only `token` and `platform` are required — verified live 2026-09-17, a body
 * of just those two is accepted and every other column comes back null.
 *
 * **`ip_address` is deliberately absent.** The documented example includes one,
 * but the backend fills it from the request itself (a body with no
 * `ip_address` came back carrying the caller's real public IP), and a phone
 * can only see its own LAN address — `192.168.x.x` would be worse than
 * nothing. See `registerDeviceToken`.
 */
export type DeviceTokenPayload = {
  /** `ExponentPushToken[…]` from `getExpoPushTokenAsync`. */
  token: string;
  platform: 'ios' | 'android' | 'web';
  /** The user's name for the device ("Alan's iPhone"), when the OS exposes it. */
  device_name?: string;
  /** Stable per-install id: `identifierForVendor` on iOS, ANDROID_ID on Android. */
  device_id?: string;
  /** How the device is connected: `wifi` | `cellular` | `ethernet` | `unknown`. */
  location_type?: string;
  /** A place name. The app cannot supply this — see `registerDeviceToken`. */
  location?: string;
};

/** The registered row `POST /notifications/device-token` answers with. */
export type DeviceTokenRecord = {
  id: string;
  token: string;
  platform: string;
  device_name?: string | null;
  device_id?: string | null;
  ip_address?: string | null;
  location_type?: string | null;
  location?: string | null;
  is_logged_out?: boolean;
  is_active?: boolean;
  last_active_at?: string | null;
};
