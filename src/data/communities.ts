/**
 * Dummy communities — the mobile port of the web `/community` surface.
 *
 * Mirrors the web's model: a community has a status (public / private / paid /
 * approval), a category, an owner + members with roles, and its own post feed.
 * Like the rest of `src/data/`, this is a module-level mutable store with
 * `add*` helpers; screens re-snapshot on focus. It swaps for real endpoints
 * when the communities API lands.
 */

import { currentUser, members, type Member, type MemberTint } from './community';

export type CommunityStatus = 'public' | 'private' | 'paid' | 'approval';

export const COMMUNITY_CATEGORIES = [
  'Finance',
  'Entertainment',
  'Education',
  'Lifestyle',
  'Tech',
  'Business',
  'Faith & Religion',
  'Nonprofits & Volunteering',
] as const;

export type CommunityCategory = (typeof COMMUNITY_CATEGORIES)[number];

/** Copy for each status — shared by the create form's radio cards and the badges. */
export const STATUS_META: Record<
  CommunityStatus,
  { label: string; short: string; icon: string; blurb: string }
> = {
  public: {
    label: 'Public',
    short: 'Public',
    icon: 'globe-outline',
    blurb: 'Anyone can find and join instantly.',
  },
  private: {
    label: 'Private (invite only)',
    short: 'Private',
    icon: 'lock-closed-outline',
    blurb: 'Hidden from search — only people you invite can join.',
  },
  paid: {
    label: 'Paid',
    short: 'Paid',
    icon: 'cash-outline',
    blurb:
      'Members pay to join — either a one-time payment, or a recurring subscription.',
  },
  approval: {
    label: 'Approval required',
    short: 'Approval',
    icon: 'time-outline',
    blurb: 'Visible to everyone, but joining needs admin acceptance.',
  },
};

export type CommunityRole = 'owner' | 'admin' | 'member';

export type CommunityMember = {
  member: Member;
  role: CommunityRole;
};

export type CommunityPost = {
  id: string;
  author: Member;
  body: string;
  timeAgo: string;
  likes: number;
  comments: number;
  views: number;
};

export type Community = {
  id: string;
  /** URL segment — matches the web's payhankey.com/c/<slug>. */
  slug: string;
  name: string;
  tint: MemberTint;
  category: CommunityCategory;
  status: CommunityStatus;
  description: string;
  createdAt: string;
  /** Monthly price in naira — paid communities only. */
  price?: number;
  people: CommunityMember[];
  posts: CommunityPost[];
};

/** payhankey.com/c/<slug> — the shareable public link shown on the About tab. */
export function communityLink(slug: string): string {
  return `https://payhankey.com/c/${slug}`;
}

export function communityOwner(community: Community): Member {
  return (community.people.find((p) => p.role === 'owner') ?? community.people[0])?.member;
}

function peopleFrom(indexes: number[], roles: CommunityRole[] = []): CommunityMember[] {
  return indexes.map((index, i) => ({
    member: members[index % members.length],
    role: roles[i] ?? 'member',
  }));
}

export const communities: Community[] = [
  {
    id: 'c1',
    slug: 'graphic-design-class',
    name: 'Graphic Design Class',
    tint: 'pink',
    category: 'Education',
    status: 'public',
    description: 'Learn Graphic Design with your Mobile Phone. Sign up is Free',
    createdAt: 'August 2026',
    people: peopleFrom([3, 0, 1, 2, 4, 5], ['owner', 'admin']),
    posts: [
      { id: 'cp1', author: members[0], body: 'Who Dey here?', timeAgo: '4d', likes: 0, comments: 0, views: 4 },
      { id: 'cp2', author: members[0], body: 'What is going on here', timeAgo: '4d', likes: 0, comments: 1, views: 4 },
      {
        id: 'cp3',
        author: members[3],
        body: 'Drop your latest design in the comments — I will review the first five today. 🎨',
        timeAgo: '1d',
        likes: 6,
        comments: 2,
        views: 41,
      },
    ],
  },
  {
    id: 'c2',
    slug: 'paylikey',
    name: 'Paylikey',
    tint: 'violet',
    category: 'Finance',
    status: 'public',
    description:
      "We all engage together ✌️. Like each other's posts 👍, follow back, comment 💬 and build each other's reach.",
    createdAt: 'July 2026',
    people: peopleFrom([1, 0, 2, 3, 4, 5, 6, 7], ['owner', 'admin']),
    posts: [
      {
        id: 'cp4',
        author: members[1],
        body: 'Engagement round for today is open — drop your post link below. #PayhankeyWins',
        timeAgo: '3h',
        likes: 24,
        comments: 11,
        views: 190,
      },
      {
        id: 'cp5',
        author: members[4],
        body: 'Reminder: only monetized engagement pays. Quality over spam, always.',
        timeAgo: '2d',
        likes: 15,
        comments: 4,
        views: 132,
      },
    ],
  },
  {
    id: 'c3',
    slug: 'money-maker',
    name: 'Money maker',
    tint: 'gold',
    category: 'Finance',
    status: 'approval',
    description: 'Money making',
    createdAt: 'August 2026',
    people: peopleFrom([6], ['owner']),
    posts: [
      {
        id: 'cp6',
        author: members[6],
        body: 'Starting a weekly thread on side income that actually works in Naija.',
        timeAgo: '5d',
        likes: 3,
        comments: 0,
        views: 22,
      },
    ],
  },
  {
    id: 'c4',
    slug: 'jobs-and-opportunities',
    name: 'Jobs and Opportunities',
    tint: 'mint',
    category: 'Business',
    status: 'public',
    description: 'Verified roles, gigs and creator opportunities — posted daily.',
    createdAt: 'June 2026',
    people: peopleFrom([2, 0, 1, 3, 4, 5, 6, 7], ['owner', 'admin']),
    posts: [
      {
        id: 'cp7',
        author: members[2],
        body: 'Remote social media manager, ₦250k/month. Details and how to apply in the comments.',
        timeAgo: '6h',
        likes: 31,
        comments: 9,
        views: 412,
      },
    ],
  },
  {
    id: 'c5',
    slug: 'mindset-of-growth',
    name: 'Mindset of growth',
    tint: 'violet',
    category: 'Lifestyle',
    status: 'public',
    description: 'Daily reminders, accountability check-ins, and the occasional hard truth.',
    createdAt: 'July 2026',
    people: peopleFrom([4, 1, 2, 5, 7], ['owner']),
    posts: [
      {
        id: 'cp8',
        author: members[4],
        body: 'Week 3 check-in — what is the one thing you shipped this week? #GrowthMindset',
        timeAgo: '1d',
        likes: 12,
        comments: 6,
        views: 98,
      },
    ],
  },
  {
    id: 'c6',
    slug: 'cruze',
    name: 'Cruze 😂',
    tint: 'pink',
    category: 'Entertainment',
    status: 'approval',
    description: 'Life is too short to be unhappy',
    createdAt: 'August 2026',
    people: peopleFrom([5], ['owner']),
    posts: [],
  },
  {
    id: 'c7',
    slug: 'motivational-quotes',
    name: 'Motivational quotes',
    tint: 'gold',
    category: 'Lifestyle',
    status: 'public',
    description: 'Life lessons',
    createdAt: 'August 2026',
    people: peopleFrom([7, 3], ['owner']),
    posts: [],
  },
  {
    id: 'c8',
    slug: 'creator-inner-circle',
    name: 'Creator Inner Circle',
    tint: 'mint',
    category: 'Business',
    status: 'paid',
    price: 2500,
    description:
      'Monthly teardowns of what is working on Payhankey right now, plus a private Q&A with top earners.',
    createdAt: 'May 2026',
    people: peopleFrom([0, 1, 2, 4], ['owner', 'admin']),
    posts: [
      {
        id: 'cp9',
        author: members[0],
        body: 'August teardown is up: the three post formats earning the most validated engagement.',
        timeAgo: '2d',
        likes: 48,
        comments: 14,
        views: 620,
      },
    ],
  },
];

/** Ranked by member count — the "Trending communities" rail. */
export const trendingCommunities = [...communities]
  .sort((a, b) => b.people.length - a.people.length)
  .slice(0, 3);

// ---------------------------------------------------------------------------
// Membership — session-local, shared so every screen's Join button agrees
// ---------------------------------------------------------------------------

const joinedIds = new Set<string>(['c1']);
const requestedIds = new Set<string>();

export function isJoined(id: string): boolean {
  return joinedIds.has(id);
}

export function isRequested(id: string): boolean {
  return requestedIds.has(id);
}

/**
 * Join / request to join / leave, depending on the community's status.
 * Returns the resulting membership state so callers can re-render without
 * re-reading the sets.
 */
export function toggleMembership(community: Community): 'joined' | 'requested' | 'none' {
  if (joinedIds.has(community.id)) {
    joinedIds.delete(community.id);
    return 'none';
  }
  if (requestedIds.has(community.id)) {
    requestedIds.delete(community.id);
    return 'none';
  }
  if (community.status === 'approval' || community.status === 'private') {
    requestedIds.add(community.id);
    return 'requested';
  }
  joinedIds.add(community.id);
  return 'joined';
}

export function membershipOf(community: Community): 'joined' | 'requested' | 'none' {
  if (joinedIds.has(community.id)) return 'joined';
  if (requestedIds.has(community.id)) return 'requested';
  return 'none';
}

export function findCommunity(slug: string): Community | undefined {
  return communities.find((c) => c.slug === slug);
}

/** Communities the signed-in user owns or has joined — the "My communities" filter. */
export function myCommunities(): Community[] {
  return communities.filter(
    (c) => joinedIds.has(c.id) || c.people.some((p) => p.member.id === currentUser.id),
  );
}

let communitySeq = communities.length;
let communityPostSeq = 100;

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 48) || `community-${communitySeq + 1}`
  );
}

const TINTS: MemberTint[] = ['violet', 'mint', 'gold', 'pink'];

/** Create a community with the signed-in user as owner; returns it (already joined). */
export function addCommunity(input: {
  name: string;
  description: string;
  category: CommunityCategory;
  status: CommunityStatus;
  price?: number;
}): Community {
  communitySeq += 1;
  const community: Community = {
    id: `c-local-${communitySeq}`,
    slug: slugify(input.name),
    name: input.name.trim(),
    tint: TINTS[communitySeq % TINTS.length],
    category: input.category,
    status: input.status,
    description: input.description.trim(),
    createdAt: new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
    price: input.status === 'paid' ? input.price : undefined,
    people: [{ member: currentUser, role: 'owner' }],
    posts: [],
  };
  communities.unshift(community);
  joinedIds.add(community.id);
  return community;
}

/** Post into a community you've joined — prepends so it lands at the top of the feed. */
export function addCommunityPost(community: Community, body: string): CommunityPost {
  communityPostSeq += 1;
  const post: CommunityPost = {
    id: `cp-local-${communityPostSeq}`,
    author: currentUser,
    body: body.trim(),
    timeAgo: 'now',
    likes: 0,
    comments: 0,
    views: 0,
  };
  community.posts.unshift(post);
  return post;
}
