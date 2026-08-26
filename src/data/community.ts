/**
 * Dummy community/earnings data backing the dashboard screens. No API yet —
 * everything here is static seed content, with a tiny mutable feed store so
 * composing a post / adding a comment feels real during the UI-only phase.
 */

import { image, video, type MediaItem } from './media';

export type { MediaItem } from './media';

export type MemberTint = 'violet' | 'mint' | 'gold' | 'pink';

export type Member = {
  id: string;
  name: string;
  handle: string;
  tint: MemberTint;
  engagements: number;
  followers: number;
  following: number;
  rank?: number;
};

export type Comment = {
  id: string;
  author: Member;
  body: string;
  timeAgo: string;
};

export type Post = {
  id: string;
  author: Member;
  /** For API posts: the author's user id, for "is this my post?" checks. */
  ownerId?: string;
  timeAgo: string;
  body: string;
  /**
   * What this post has earned so far, in the viewer's own currency. API posts
   * report it as `estimatedEarnings`; a post the backend has no figure for
   * leaves this undefined and the card simply shows no pill.
   */
  earned?: number;
  /**
   * The symbol to print `earned` with, as the post itself reported it
   * (`currencySymbol`). Preferred over the account-wide symbol so a post can
   * never be labelled in the wrong currency.
   */
  earnedSymbol?: string;
  /**
   * The server's "has the viewer bookmarked this?" flag (`is_bookmarked`).
   * Seeds the bookmark icon; a session toggle overrides it.
   */
  bookmarkedByViewer?: boolean;
  likes: number;
  views: number;
  comments: Comment[];
  /** Server-side total when `comments` only holds the embedded latest few. */
  commentCount?: number;
  hashtags?: string[];
  /** Attached images/videos, rendered as a grid + carousel viewer. */
  media?: MediaItem[];
  /** The post has media the backend is still transcoding — show a placeholder. */
  mediaPending?: boolean;
  /** True for posts that came from the timeline API — engagement calls it. */
  remote?: boolean;
  /**
   * The server's "has the viewer liked this?" flag when the endpoint sends it
   * (`is_liked_by_viewer`). Seeds the heart state; a session toggle overrides it.
   */
  likedByViewer?: boolean;
  /**
   * Preview of the people who liked this post (`likers_preview`) — the first
   * few, for the Instagram-style "liked by" avatar row. The true count is
   * `likes`; anyone beyond this preview is folded into the "and N others" text.
   */
  likedBy?: { id: string; name: string; handle: string; tint: MemberTint }[];
};

export type Topic = {
  id: string;
  tag: string;
  posts: number;
};

export type AppNotification = {
  id: string;
  kind: 'like' | 'comment' | 'follow' | 'payout' | 'referral';
  text: string;
  timeAgo: string;
  amount?: number;
  unread?: boolean;
};

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

export const currentUser: Member = {
  id: 'me',
  name: 'Alan Douglas',
  handle: 'alandouglas',
  tint: 'violet',
  engagements: 12,
  followers: 48,
  following: 21,
};

export const members: Member[] = [
  { id: 'm1', name: 'Prosper Eze', handle: 'prosper', tint: 'gold', engagements: 56, followers: 812, following: 120, rank: 1 },
  { id: 'm2', name: 'Deborah Ade', handle: 'dearebby', tint: 'pink', engagements: 32, followers: 540, following: 98, rank: 2 },
  { id: 'm3', name: 'UTU Okon', handle: 'freefate8', tint: 'mint', engagements: 16, followers: 233, following: 61, rank: 3 },
  { id: 'm4', name: 'Kehinde Suleman', handle: 'kenny22', tint: 'violet', engagements: 16, followers: 187, following: 74, rank: 4 },
  { id: 'm5', name: 'Champion Miracle', handle: 'champion', tint: 'gold', engagements: 14, followers: 402, following: 33, rank: 5 },
  { id: 'm6', name: 'Timothy Atobatele', handle: 'tmbaba', tint: 'mint', engagements: 9, followers: 92, following: 45 },
  { id: 'm7', name: 'Halim Nicholas', handle: 'joyboy', tint: 'pink', engagements: 7, followers: 61, following: 80 },
  { id: 'm8', name: 'Oluyemi Tobi', handle: 'olutobi', tint: 'violet', engagements: 5, followers: 27, following: 19 },
];

export const trendingMembers = members.slice(0, 5);

/** Resolve a member by handle ("me" or the current user's handle → self). */
export function findMember(handle: string): Member | undefined {
  if (handle === 'me' || handle === currentUser.handle) return currentUser;
  return members.find((m) => m.handle === handle);
}

// Who the current user follows — shared so follow buttons stay in sync
// across Explore rows, trending lists, and the profile screen (dummy).
const followedIds = new Set<string>();

export function isFollowing(memberId: string): boolean {
  return followedIds.has(memberId);
}

/** Toggle follow state; returns the new state. */
export function toggleFollow(memberId: string): boolean {
  if (followedIds.has(memberId)) {
    followedIds.delete(memberId);
    return false;
  }
  followedIds.add(memberId);
  return true;
}

// ---------------------------------------------------------------------------
// Topics
// ---------------------------------------------------------------------------

export const trendingTopics: Topic[] = [
  { id: 't1', tag: 'GrowthMindset', posts: 128 },
  { id: 't2', tag: 'NaijaCreators', posts: 96 },
  { id: 't3', tag: 'SideHustle', posts: 74 },
  { id: 't4', tag: 'MondayMotivation', posts: 51 },
  { id: 't5', tag: 'PayhankeyWins', posts: 33 },
];

// ---------------------------------------------------------------------------
// Feed (mutable in-memory store for the UI-only phase)
// ---------------------------------------------------------------------------

export const feedPosts: Post[] = [
  {
    id: 'p1',
    author: members[3],
    timeAgo: '35m',
    body: 'I love fashion because of its beauty — style is a language everyone speaks. 💜',
    earned: 0.03,
    likes: 1,
    views: 14,
    hashtags: ['GrowthMindset'],
    media: [image('fashion-lagos')],
    comments: [
      { id: 'c1', author: members[0], body: 'Well said! Style really is a language.', timeAgo: '20m' },
    ],
  },
  {
    id: 'p5',
    author: members[4],
    timeAgo: '1h',
    body: 'Behind the scenes of our latest shoot — the energy on set was unreal! 🎬 Full drop coming this weekend, stay locked in.',
    earned: 0.09,
    likes: 5,
    views: 63,
    hashtags: ['NaijaCreators'],
    media: [video(0)],
    comments: [
      { id: 'c5', author: members[6], body: 'That set looks amazing 🔥', timeAgo: '40m' },
    ],
  },
  {
    id: 'p6',
    author: members[5],
    timeAgo: '2h',
    body: 'Weekend market run in three frames. Which one should I print? 📸',
    earned: 0.05,
    likes: 4,
    views: 38,
    media: [image('market-one'), image('market-two'), image('market-three')],
    comments: [],
  },
  {
    id: 'p2',
    author: members[2],
    timeAgo: '3h',
    body: 'Good is the evening. Grateful for every engagement today — small drops make an ocean. 🌊',
    earned: 0.03,
    likes: 1,
    views: 9,
    comments: [],
  },
  {
    id: 'p3',
    author: members[1],
    timeAgo: '4h',
    body: "My best friend stole my fiancé. Now she's inviting me to the wedding. Should I attend? A. Yes B. No C. Attend with a plan 👀 Comment your answer!",
    earned: 0.06,
    likes: 3,
    views: 42,
    hashtags: ['NaijaCreators'],
    media: [image('wedding-asoebi'), image('wedding-hall')],
    comments: [
      { id: 'c2', author: members[4], body: 'C. Definitely C. 😂', timeAgo: '3h' },
      { id: 'c3', author: members[5], body: 'Attend with a plan and a photographer.', timeAgo: '2h' },
    ],
  },
  {
    id: 'p4',
    author: members[0],
    timeAgo: '6h',
    body: 'Hit 56 engagements this week! Consistency beats luck — post every day, reply to every comment. #SideHustle',
    earned: 0.12,
    likes: 8,
    views: 77,
    hashtags: ['SideHustle', 'PayhankeyWins'],
    media: [image('workspace-desk'), video(1), image('city-night')],
    comments: [
      { id: 'c4', author: members[3], body: 'Congrats! What time do you usually post?', timeAgo: '5h' },
    ],
  },
  {
    id: 'p7',
    author: members[6],
    timeAgo: '8h',
    body: 'Recap of the creators meetup — met so many of you in person! Swipe through, the last clips are pure chaos 😂',
    earned: 0.18,
    likes: 12,
    views: 120,
    hashtags: ['PayhankeyWins'],
    media: [
      image('meetup-crowd'),
      image('meetup-stage'),
      video(2),
      image('meetup-food'),
      image('meetup-group'),
      video(3),
    ],
    comments: [
      { id: 'c6', author: members[1], body: 'It was so good to finally meet everyone!', timeAgo: '7h' },
      { id: 'c7', author: members[2], body: 'Next one in Abuja please 🙏', timeAgo: '6h' },
    ],
  },
];

/**
 * Posts loaded after the seed page (infinite scroll). Kept in a registry so
 * `findPost` / `addComment` can resolve them when the detail screen opens.
 */
export const loadedPosts: Post[] = [];

/** Look up a post across the seed feed and any generated pages. */
export function findPost(id: string): Post | undefined {
  return feedPosts.find((p) => p.id === id) ?? loadedPosts.find((p) => p.id === id);
}

/** All of a member's posts across the seed feed and generated pages. */
export function postsByMember(memberId: string): Post[] {
  return [...feedPosts, ...loadedPosts].filter((p) => p.author.id === memberId);
}

let nextId = 100;

/** Prepend a new post from the current user (dummy, in-memory only). */
export function addPost(body: string, media?: MediaItem[]): Post {
  const post: Post = {
    id: `p${nextId++}`,
    author: currentUser,
    timeAgo: 'now',
    body,
    earned: 0,
    likes: 0,
    views: 0,
    comments: [],
    media: media?.length ? media : undefined,
  };
  feedPosts.unshift(post);
  return post;
}

/** Append a comment from the current user to a post (dummy, in-memory only). */
export function addComment(postId: string, body: string): Comment | undefined {
  const post = findPost(postId);
  if (!post) return undefined;
  const comment: Comment = {
    id: `c${nextId++}`,
    author: currentUser,
    body,
    timeAgo: 'now',
  };
  post.comments.push(comment);
  return comment;
}

// ---------------------------------------------------------------------------
// Referral + earnings
// ---------------------------------------------------------------------------

// The code and link are NOT here on purpose — they're per-account and come from
// /user/me via `useMyReferral()`. Only these counts are still dummy.
export const referral = {
  total: 1,
  thisMonth: 0,
};

export const earnings = {
  monthLabel: 'July 2026',
  estimated: 2355,
  /** ₦ paid per 1,000 validated engagements. */
  ratePerThousand: 1500,
  totals: { posts: 4, views: 142, likes: 13, comments: 4 },
  monetized: { views: 96, likes: 11, comments: 4, engagement: 111 },
  months: ['May', 'June', 'July'],
};

// ---------------------------------------------------------------------------
// Wallet + transactions
// ---------------------------------------------------------------------------

export type Transaction = {
  id: string;
  reference: string;
  description: string;
  /** Amount in ₦. */
  amount: number;
  date: string;
  kind: 'payout' | 'referral';
  status: 'paid' | 'pending';
};

// The dummy `wallet` snapshot that used to live here is gone: /wallet now reads
// GET /user/wallet, and leaving invented balances in the module invites them
// back onto a money screen.

export const transactions: Transaction[] = [
  { id: 'tx1', reference: 'PHK-2026-0630-8241', description: 'June engagement payout', amount: 1500, date: 'Jun 30, 2026', kind: 'payout', status: 'paid' },
  { id: 'tx2', reference: 'PHK-2026-0612-5527', description: 'Referral bonus — Alan Dan', amount: 855, date: 'Jun 12, 2026', kind: 'referral', status: 'paid' },
  { id: 'tx3', reference: 'PHK-2026-0531-1189', description: 'May engagement payout', amount: 1500, date: 'May 31, 2026', kind: 'payout', status: 'paid' },
];

// ---------------------------------------------------------------------------
// Top earners (web "Top Earners" — monthly leaderboard)
// ---------------------------------------------------------------------------

export type TopEarner = { member: Member; earned: number };

/** ₦ earned per member for each month in `earnings.months`. */
export const topEarners: Record<string, TopEarner[]> = {
  May: [
    { member: members[1], earned: 9450 },
    { member: members[0], earned: 8120 },
    { member: members[4], earned: 5230 },
    { member: members[2], earned: 3110 },
    { member: members[6], earned: 1980 },
  ],
  June: [
    { member: members[0], earned: 10500 },
    { member: members[4], earned: 7420 },
    { member: members[1], earned: 6800 },
    { member: members[3], earned: 4150 },
    { member: members[5], earned: 2640 },
  ],
  July: [
    { member: members[0], earned: 8400 },
    { member: members[1], earned: 7150 },
    { member: members[2], earned: 5600 },
    { member: members[4], earned: 4930 },
    { member: members[3], earned: 3210 },
  ],
};

// ---------------------------------------------------------------------------
// Referred users
// ---------------------------------------------------------------------------

export type ReferredUser = {
  id: string;
  name: string;
  handle: string;
  tint: MemberTint;
  joined: string;
  /** What this referral has earned the current user so far, in ₦. */
  earnedForYou: number;
};

export const referredUsers: ReferredUser[] = [
  { id: 'r1', name: 'Alan Dan', handle: 'alandan', tint: 'mint', joined: 'Jun 12, 2026', earnedForYou: 855 },
];

// ---------------------------------------------------------------------------
// Blog
// ---------------------------------------------------------------------------

export type BlogPost = {
  id: string;
  title: string;
  excerpt: string;
  category: string;
  readMinutes: number;
  date: string;
};

export const blogPosts: BlogPost[] = [
  {
    id: 'b1',
    title: '5 posting habits of top Payhankey earners',
    excerpt:
      'We asked the leaderboard regulars how they stay consistent. Their answers come down to timing, replies, and one underrated trick.',
    category: 'Growth',
    readMinutes: 4,
    date: 'Jun 24, 2026',
  },
  {
    id: 'b2',
    title: 'How engagement validation actually works',
    excerpt:
      'Every like, comment, and view is checked before it pays. Here is what counts, what gets filtered, and why validation runs at month end.',
    category: 'Product',
    readMinutes: 3,
    date: 'Jun 10, 2026',
  },
  {
    id: 'b3',
    title: 'From Basic to Creator: when upgrading pays for itself',
    excerpt:
      'Creator costs ₦1,800 a month and unlocks withdrawals. We did the math on the engagement level where it becomes a no-brainer.',
    category: 'Monetization',
    readMinutes: 5,
    date: 'May 28, 2026',
  },
  {
    id: 'b4',
    title: 'Referrals 101: grow your circle, grow your payout',
    excerpt:
      'Your referral link is a second income stream. How invites turn into bonuses, and how to share yours without spamming.',
    category: 'Community',
    readMinutes: 4,
    date: 'May 15, 2026',
  },
];

// ---------------------------------------------------------------------------
// Account tiers
// ---------------------------------------------------------------------------

export type Tier = {
  name: 'Basic' | 'Creator' | 'Influencer';
  /** Monthly list price in ₦ (before the subscription discount). */
  price: number;
  tagline: string;
  benefits: string[];
  /** Benefits this tier does NOT include (rendered muted). */
  locked?: string[];
  popular?: boolean;
  /** One-off ₦ credited on payment, shown as the last benefit line. */
  bonus?: number;
};

/** Direct subscription takes 10% off the list price; pay-as-you-go doesn't. */
export const SUBSCRIPTION_DISCOUNT = 0.1;

export const tiers: Tier[] = [
  {
    name: 'Basic',
    price: 0,
    tagline: 'Your starting point for creating and growing on Payhankey.',
    benefits: [
      'Unlimited posts & quizzes',
      'Payhankey Rolls (videos)',
      'Full dashboard access',
      'Discover and join communities',
    ],
    locked: ['Content monetization', 'Can make withdrawals'],
  },
  {
    name: 'Creator',
    price: 1800,
    tagline: 'For creators ready to monetize their content and grow their audience.',
    benefits: [
      'Everything in Basic',
      'Content monetization',
      'Create & monetize communities',
      'Verified creator badge',
      'Image posting',
      'Priority discovery',
      'AI Creator support tools',
    ],
    popular: true,
    bonus: 525,
  },
  {
    name: 'Influencer',
    price: 7500,
    tagline: 'For established creators ready to increase their reach and earning potential.',
    benefits: [
      'Everything in Creator',
      'Influencer verification badge',
      'Influencer profile ring',
      'Higher content limits',
      'Top-feed placement',
      'Advanced creator opportunities',
    ],
    bonus: 1500,
  },
];

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export const notifications: AppNotification[] = [
  { id: 'n1', kind: 'like', text: 'Prosper Eze liked your post "Consistency beats luck…"', timeAgo: '12m', unread: true },
  { id: 'n2', kind: 'payout', text: 'Your June engagement payout has been validated', timeAgo: '1h', amount: 1500, unread: true },
  { id: 'n3', kind: 'comment', text: 'Kehinde Suleman commented: "What time do you usually post?"', timeAgo: '5h' },
  { id: 'n4', kind: 'follow', text: 'Deborah Ade started following you', timeAgo: '8h' },
  { id: 'n5', kind: 'referral', text: 'Alan Dan joined with your referral link 🎉', timeAgo: '2d' },
  { id: 'n6', kind: 'like', text: 'UTU Okon liked your post', timeAgo: '3d' },
];
