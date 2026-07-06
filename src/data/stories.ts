/**
 * Dummy stories store — Facebook-style 24h statuses. Seeded member stories
 * plus a mutable list of the current user's own stories (with fake viewers).
 */

import { currentUser, members, type Member } from './community';
import { sampleImage, sampleVideos } from './media';

/** Gradient backdrops for text stories (keys are stable across theme modes). */
export const STORY_BACKGROUNDS = {
  violet: ['#7C3AED', '#4F46E5'],
  sunset: ['#F97316', '#DB2777'],
  ocean: ['#0EA5E9', '#6366F1'],
  forest: ['#10B981', '#047857'],
  midnight: ['#334155', '#0F172A'],
} as const;

export type StoryBackground = keyof typeof STORY_BACKGROUNDS;

export type StoryItem = {
  id: string;
  type: 'text' | 'image' | 'video';
  /** Body of a text story, or the caption overlay on a media story. */
  text?: string;
  uri?: string;
  poster?: string;
  background?: StoryBackground;
  timeAgo: string;
  /** How long the item stays on screen in the viewer. */
  durationMs: number;
  views: number;
  /** Who has seen it — only surfaced on the current user's own stories. */
  viewers: Member[];
};

export type StoryGroup = {
  member: Member;
  items: StoryItem[];
  /** Set once the viewer has been opened for this group (dims the rail ring). */
  seen?: boolean;
};

let storyId = 0;
const sid = () => `s${++storyId}`;

const IMAGE_DURATION = 5000;
const TEXT_DURATION = 6000;
const VIDEO_DURATION = 10000;

/** The current user's own stories (starts empty — the rail shows "Create story"). */
export const myStories: StoryItem[] = [];

export const memberStories: StoryGroup[] = [
  {
    member: members[0],
    items: [
      {
        id: sid(), type: 'image', uri: sampleImage('story-studio', 720, 1280),
        text: 'Studio day 🎙️', timeAgo: '2h', durationMs: IMAGE_DURATION, views: 143, viewers: [],
      },
      {
        id: sid(), type: 'text', text: 'Payout landed 🎉 Consistency pays — literally.',
        background: 'violet', timeAgo: '1h', durationMs: TEXT_DURATION, views: 121, viewers: [],
      },
    ],
  },
  {
    member: members[1],
    items: [
      {
        id: sid(), type: 'video', uri: sampleVideos[3].uri, poster: sampleVideos[3].poster,
        timeAgo: '3h', durationMs: VIDEO_DURATION, views: 89, viewers: [],
      },
      {
        id: sid(), type: 'image', uri: sampleImage('story-fitfit', 720, 1280),
        text: 'Fit check before the event ✨', timeAgo: '3h', durationMs: IMAGE_DURATION, views: 84, viewers: [],
      },
    ],
  },
  {
    member: members[2],
    items: [
      {
        id: sid(), type: 'text', text: 'Who else is grinding this weekend? Drop a 💪 in my DMs.',
        background: 'sunset', timeAgo: '5h', durationMs: TEXT_DURATION, views: 47, viewers: [],
      },
    ],
  },
  {
    member: members[4],
    items: [
      {
        id: sid(), type: 'image', uri: sampleImage('story-set-life', 720, 1280),
        timeAgo: '7h', durationMs: IMAGE_DURATION, views: 66, viewers: [],
      },
      {
        id: sid(), type: 'video', uri: sampleVideos[1].uri, poster: sampleVideos[1].poster,
        text: 'Sneak peek 👀', timeAgo: '6h', durationMs: VIDEO_DURATION, views: 58, viewers: [],
      },
      {
        id: sid(), type: 'text', text: 'Full video drops Saturday. Set a reminder!',
        background: 'midnight', timeAgo: '6h', durationMs: TEXT_DURATION, views: 51, viewers: [],
      },
    ],
  },
  {
    member: members[6],
    items: [
      {
        id: sid(), type: 'image', uri: sampleImage('story-suya-night', 720, 1280),
        text: 'Suya night, no notes. 🔥', timeAgo: '9h', durationMs: IMAGE_DURATION, views: 31, viewers: [],
      },
    ],
  },
];

/** Rail + viewer order: the current user first (when they have stories), then members. */
export function getStoryGroups(): StoryGroup[] {
  const mine: StoryGroup[] = myStories.length
    ? [{ member: currentUser, items: myStories }]
    : [];
  return [...mine, ...memberStories];
}

/** Find a group by member id ("me" resolves to the current user). */
export function findStoryGroup(memberId: string): StoryGroup | undefined {
  if (memberId === currentUser.id) {
    return myStories.length ? { member: currentUser, items: myStories } : undefined;
  }
  return memberStories.find((g) => g.member.id === memberId);
}

/** Publish a story as the current user (dummy, in-memory only). */
export function addStory(
  item: Pick<StoryItem, 'type' | 'text' | 'uri' | 'poster' | 'background'>,
): StoryItem {
  const story: StoryItem = {
    ...item,
    id: sid(),
    timeAgo: 'now',
    durationMs:
      item.type === 'video' ? VIDEO_DURATION : item.type === 'text' ? TEXT_DURATION : IMAGE_DURATION,
    // Fake a bit of instant reach so the views UI has something to show.
    views: 3,
    viewers: members.slice(0, 3),
  };
  myStories.push(story);
  return story;
}

/** Mark a member's story group as seen (dims its ring on the rail). */
export function markStoriesSeen(memberId: string): void {
  const group = memberStories.find((g) => g.member.id === memberId);
  if (group) group.seen = true;
}
