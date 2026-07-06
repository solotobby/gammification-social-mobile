/**
 * Fake feed pagination for the home timeline. Pages are generated on demand
 * from template content, cached so scroll positions stay stable, and pushed
 * into `loadedPosts` so the post-detail screen can resolve them by id.
 */

import { loadedPosts, members, type Post } from './community';
import { image, video, type MediaItem } from './media';

export const FEED_PAGE_SIZE = 6;
/** Pages beyond the seed feed; after this the list shows "you're all caught up". */
export const FEED_MAX_PAGES = 4;

const BODIES = [
  'Consistency check-in: posted every day this week and the engagement graph keeps climbing. Small steps, real money. 📈',
  'Hot take — replying to every comment doubles your validated engagement. Tried it for a week and the numbers do not lie.',
  'Lagos traffic gave me two hours to think, so here is a thread of everything I wish I knew before my first payout…',
  "New here! A friend referred me last week and I already earned my first ₦. This community is something else 💜",
  'Sunday reset: clean desk, content calendar for the week, and a big cup of zobo. What does your prep look like?',
  'Your reminder that views are money here. Stop overthinking the perfect post and just share what you know.',
  'Question for the timeline: what niche is earning best for you right now? Fashion? Food? Tech? Drop it below 👇',
  'Three months on Payhankey and my referral circle just crossed ten people. The bonuses stack up faster than you think.',
];

const TAGS = [
  ['GrowthMindset'],
  ['SideHustle', 'PayhankeyWins'],
  undefined,
  ['NaijaCreators'],
  undefined,
  ['MondayMotivation'],
];

const IMAGE_SEEDS = [
  'street-style', 'food-jollof', 'studio-lights', 'beach-lagos', 'skyline',
  'sneakers', 'coffee-shop', 'concert', 'art-mural', 'okada', 'textiles', 'sunset-bridge',
];

/** Media pattern cycled across generated posts — mixes counts and video placement. */
function mediaFor(index: number): MediaItem[] | undefined {
  switch (index % 6) {
    case 0: return [image(IMAGE_SEEDS[index % IMAGE_SEEDS.length])];
    case 2: return [
      image(IMAGE_SEEDS[(index + 1) % IMAGE_SEEDS.length]),
      image(IMAGE_SEEDS[(index + 2) % IMAGE_SEEDS.length]),
    ];
    case 3: return [video(index)];
    case 5: return [
      image(IMAGE_SEEDS[(index + 3) % IMAGE_SEEDS.length]),
      video(index + 1),
      image(IMAGE_SEEDS[(index + 4) % IMAGE_SEEDS.length]),
      image(IMAGE_SEEDS[(index + 5) % IMAGE_SEEDS.length]),
    ];
    default: return undefined;
  }
}

const pageCache = new Map<number, Post[]>();

function buildPage(page: number): Post[] {
  return Array.from({ length: FEED_PAGE_SIZE }, (_, i) => {
    const index = (page - 1) * FEED_PAGE_SIZE + i;
    const author = members[index % members.length];
    const post: Post = {
      id: `gen-${page}-${i}`,
      author,
      timeAgo: `${page * 4 + i}h`,
      body: BODIES[index % BODIES.length],
      earned: Number((0.02 + (index % 9) * 0.03).toFixed(2)),
      likes: (index * 7) % 23,
      views: 20 + ((index * 31) % 140),
      hashtags: TAGS[index % TAGS.length],
      media: mediaFor(index),
      comments: [],
    };
    return post;
  });
}

/** Fetch a feed page (1-based) with a fake network delay. */
export function fetchFeedPage(page: number): Promise<Post[]> {
  return new Promise((resolve) => {
    setTimeout(() => {
      let posts = pageCache.get(page);
      if (!posts) {
        posts = buildPage(page);
        pageCache.set(page, posts);
        loadedPosts.push(...posts);
      }
      resolve(posts);
    }, 650);
  });
}
