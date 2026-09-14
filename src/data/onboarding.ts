import { Ionicons } from '@expo/vector-icons';

/**
 * Onboarding carousel content.
 *
 * Four slides, each answering one question a new user actually has: what is
 * this, what do I get out of it, what is Koin, and who else is here. The copy
 * is design's own, from the web onboarding mocks.
 *
 * **The slides carry no artwork.** The heroes design delivered
 * (`assets/images/Payhankey_Screen_*_Hero.png`) are tall, narrow crops of a
 * full screen composition — fitting one onto a phone means either washing the
 * photo out under the copy or cropping a face off, and both were built and
 * rejected. So each slide illustrates itself with a *vignette* of the app's own
 * surfaces instead (`SlideVisual`): a post card, an engagement tile, the Koin
 * balance, a chat thread. It is the product explaining itself, it re-lays out
 * on any screen size, and it costs nothing to ship.
 *
 * The mock has five slides; the fifth is the sign-up card, which is `/sign-up`
 * here, so the carousel is four long.
 */

type IoniconName = keyof typeof Ionicons.glyphMap;

/**
 * One run of headline text. `accent` paints it in the brand violet — the design
 * highlights the pay-off word or the closing line of every title ("give you
 * *more* than likes?", "*Get rewarded.*").
 */
export type TitleSegment = {
  text: string;
  accent?: boolean;
};

/** Which vignette `SlideVisual` draws above the copy. */
export type SlideVisualKey = 'engagement' | 'earnings' | 'koin' | 'connect';

/**
 * A concrete thing the slide is promising, as a chip under the copy. Three at
 * most — they are there to make an abstract headline specific, not to become a
 * feature list.
 */
export type SlideHighlight = {
  icon: IoniconName;
  label: string;
  tone: 'brand' | 'mint' | 'gold' | 'pink';
};

export type OnboardingSlide = {
  key: string;
  /** Small letterspaced label above the title. */
  overline: string;
  /** Headline, split so individual runs can take the brand accent. */
  title: TitleSegment[];
  description: string;
  highlights: SlideHighlight[];
  visual: SlideVisualKey;
  /** Per-slide CTA wording, as in the design. */
  cta: string;
};

export const onboardingSlides: OnboardingSlide[] = [
  {
    key: 'upgrade',
    overline: 'Your social life just got an upgrade',
    title: [
      { text: 'What if your posts\ncould give you ' },
      { text: 'more', accent: true },
      { text: '\nthan likes?' },
    ],
    description:
      'Post your vibes. Share your thoughts. Drop your videos. Then watch what happens when people start engaging.',
    highlights: [
      { icon: 'heart', label: 'Likes', tone: 'pink' },
      { icon: 'chatbubble', label: 'Comments', tone: 'brand' },
      { icon: 'gift', label: 'Gifts', tone: 'mint' },
    ],
    visual: 'engagement',
    cta: "Let's Go",
  },
  {
    key: 'earn',
    overline: 'Create. Engage. Earn.',
    title: [
      { text: 'Post it.\nLet them vibe.\n' },
      { text: 'Get rewarded.', accent: true },
    ],
    description:
      'Share posts, videos, facts and quizzes — and unlock opportunities to earn from eligible engagement, viral content and referrals.',
    highlights: [
      { icon: 'flame', label: 'Viral content', tone: 'pink' },
      { icon: 'stats-chart', label: 'Engagement', tone: 'mint' },
      { icon: 'people', label: 'Referrals', tone: 'brand' },
    ],
    visual: 'earnings',
    cta: 'Show Me My Earnings',
  },
  {
    key: 'koin',
    overline: "Oh… and there's Koin",
    title: [{ text: 'Meet Payhankey\n' }, { text: 'Koin.', accent: true }],
    description:
      'Earn, collect and spend Koin as you explore Payhankey. The more you participate, the more it unlocks.',
    highlights: [
      { icon: 'sparkles', label: 'Earn Koin', tone: 'gold' },
      { icon: 'lock-open', label: 'Unlock more', tone: 'brand' },
      { icon: 'gift', label: 'Send gifts', tone: 'pink' },
    ],
    visual: 'koin',
    cta: 'Discover Koin',
  },
  {
    key: 'connect',
    overline: 'More than a feed',
    title: [
      { text: 'Meet people.\nChat. Send love.\n' },
      { text: 'Get gifts.', accent: true },
    ],
    description:
      "Like something? Say it. Found your people? Chat with them. Love someone's content? Send them a gift.",
    highlights: [
      { icon: 'chatbubbles', label: 'Messages', tone: 'brand' },
      { icon: 'globe', label: 'Communities', tone: 'mint' },
      { icon: 'gift', label: 'Gifts', tone: 'pink' },
    ],
    visual: 'connect',
    cta: "Let's Connect",
  },
];
