/**
 * Dummy community/earnings data backing the dashboard screens. No API yet —
 * everything here is static seed content, with a tiny mutable feed store so
 * composing a post / adding a comment feels real during the UI-only phase.
 */

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
  timeAgo: string;
  body: string;
  /** What this post has earned so far, in ₦. */
  earned: number;
  likes: number;
  views: number;
  comments: Comment[];
  hashtags?: string[];
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
    comments: [
      { id: 'c1', author: members[0], body: 'Well said! Style really is a language.', timeAgo: '20m' },
    ],
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
    comments: [
      { id: 'c4', author: members[3], body: 'Congrats! What time do you usually post?', timeAgo: '5h' },
    ],
  },
];

let nextId = 100;

/** Prepend a new post from the current user (dummy, in-memory only). */
export function addPost(body: string): Post {
  const post: Post = {
    id: `p${nextId++}`,
    author: currentUser,
    timeAgo: 'now',
    body,
    earned: 0,
    likes: 0,
    views: 0,
    comments: [],
  };
  feedPosts.unshift(post);
  return post;
}

/** Append a comment from the current user to a post (dummy, in-memory only). */
export function addComment(postId: string, body: string): Comment | undefined {
  const post = feedPosts.find((p) => p.id === postId);
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

export const referral = {
  code: 'KPGEU8SD1U',
  link: 'https://payhankey.com/reg?referral_code=KPGEU8SD1U',
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
