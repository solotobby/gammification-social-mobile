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
