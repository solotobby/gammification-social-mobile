import { Ionicons } from '@expo/vector-icons';

/**
 * Onboarding carousel content.
 *
 * Each slide is a full-bleed hero illustration with the copy laid over its
 * left side — the layout the design team delivered as
 * `assets/images/Payhankey_Screen_*_Hero.png`.
 *
 * Those source files are crops of a *full* screen mock, so they still carry a
 * strip of the original headline bleeding in from the left. The app renders its
 * own copy, so the strip is cropped off by `scripts/crop-onboarding-heroes.py`
 * into `assets/onboarding/hero-{n}.png` — always point `image` at the cropped
 * asset, never at the raw one.
 *
 * The mock has five slides; only four heroes were delivered (the fifth is the
 * sign-up card, which is `/sign-up` here), so the carousel is four long.
 */

type IoniconName = keyof typeof Ionicons.glyphMap;

/**
 * One run of headline text. `accent` paints it in the brand violet — the
 * design highlights the pay-off word or the closing line of every title
 * ("give you *more* than likes?", "*Get rewarded.*").
 */
export type TitleSegment = {
  text: string;
  accent?: boolean;
};

/**
 * The sample post card under each slide's copy, echoing the post cards the mock
 * composites into its artwork. Each slide's card highlights that slide's
 * feature through its `badge`.
 *
 * Deliberately carries **no money figures**. Onboarding runs pre-auth, so there
 * is no account `baseCurrency` to format against yet, and hardcoding the mock's
 * naira would mislabel the app for a dollar account — the same trap
 * `useCurrency` exists to avoid. Engagement counts and Koin are currency-neutral.
 */
export type SlideCard = {
  name: string;
  /** Picks the avatar gradient; see `Avatar`'s `MemberTint`. */
  tint: 'violet' | 'mint' | 'gold' | 'pink';
  handle: string;
  time: string;
  body: string;
  /** Engagement row — icon + count, left to right. */
  stats: { icon: IoniconName; label: string }[];
  /** The feature this slide is selling. */
  badge: { icon: IoniconName; label: string; tone: 'brand' | 'mint' | 'gold' | 'pink' };
};

export type OnboardingSlide = {
  key: string;
  /** Small letterspaced label above the title. */
  overline: string;
  /** Headline, split so individual runs can take the brand accent. */
  title: TitleSegment[];
  description: string;
  /** Per-slide CTA wording, as in the design. */
  cta: string;
  /** Cropped hero artwork (`assets/onboarding/`). */
  image: number;
  /**
   * Native aspect ratio (w/h) of `image`. The hero is right-anchored and sized
   * from the screen width, so its height is derived from this rather than
   * measured at runtime — one less layout pass per swipe.
   */
  aspect: number;
  /** Sample post card shown under the copy. */
  card: SlideCard;
};

export const onboardingSlides: OnboardingSlide[] = [
  {
    key: 'upgrade',
    overline: 'Your social life just got an upgrade',
    title: [
      { text: 'What if your\nposts could\ngive you ' },
      { text: 'more', accent: true },
      { text: '\nthan likes?' },
    ],
    description:
      'Post your vibes. Share your thoughts. Drop your videos. Then watch what happens when people start engaging.',
    card: {
      name: 'Ada Sunshine',
      tint: 'violet',
      handle: '@adasunshine',
      time: '2h',
      body: 'Good content. Better energy. ✨ Grateful for this community! 💜',
      stats: [
        { icon: 'heart', label: '2.4K' },
        { icon: 'chatbubble', label: '412' },
        { icon: 'repeat', label: '186' },
      ],
      badge: { icon: 'trending-up', label: 'Reward unlocked', tone: 'brand' },
    },
    cta: "Let's Go",
    image: require('../../assets/onboarding/hero-1.png'),
    aspect: 423 / 1185,
  },
  {
    key: 'earn',
    overline: 'Create. Engage. Earn.',
    title: [
      { text: 'Post it.\nLet them vibe.\n' },
      { text: 'Get rewarded.', accent: true },
    ],
    description:
      'Share posts, videos, facts, quizzes and more — and unlock opportunities to earn from eligible engagement, viral content, referrals and other Payhankey rewards.',
    card: {
      name: 'Tobi Creates',
      tint: 'mint',
      handle: '@tobicreates',
      time: '4h',
      body: 'Discipline today, freedom tomorrow! 💪 Small steps, big results.',
      stats: [
        { icon: 'heart', label: '2.4K' },
        { icon: 'chatbubble', label: '412' },
        { icon: 'eye', label: '18.6K' },
      ],
      badge: { icon: 'bar-chart', label: 'Engagement +320%', tone: 'mint' },
    },
    cta: 'Show Me My Earnings',
    image: require('../../assets/onboarding/hero-2.png'),
    aspect: 383 / 1130,
  },
  {
    key: 'koin',
    overline: "Oh… and there's Koins",
    title: [
      { text: 'Meet\nPayhankey\n' },
      { text: 'Koin.', accent: true },
    ],
    description:
      'Earn, collect and use Koin as you explore the Payhankey experience. The more you participate, the more interesting it gets.',
    card: {
      name: 'Zara Bello',
      tint: 'gold',
      handle: '@zarabello',
      time: '12m',
      body: 'Cashed in my Koin today and unlocked a new drop. This app is different ✨',
      stats: [
        { icon: 'heart', label: '980' },
        { icon: 'chatbubble', label: '124' },
      ],
      badge: { icon: 'ellipse', label: '+120 Koin', tone: 'gold' },
    },
    cta: 'Discover Koin',
    image: require('../../assets/onboarding/hero-3.png'),
    aspect: 443 / 1150,
  },
  {
    key: 'connect',
    overline: 'More than a feed',
    title: [
      { text: 'Meet people.\nChat.\nSend love.\n' },
      { text: 'Get gifts.', accent: true },
    ],
    description:
      "Like something? Say it. Found your people? Chat with them. Love someone's content? Send them a gift.",
    card: {
      name: 'Michael Eze',
      tint: 'pink',
      handle: '@michaeleze',
      time: '5m',
      body: 'This is amazing! Keep going 💜 Just sent you something.',
      stats: [
        { icon: 'heart', label: '1.2K' },
        { icon: 'chatbubble', label: '208' },
      ],
      badge: { icon: 'gift', label: 'Gift received', tone: 'pink' },
    },
    cta: "Let's Connect",
    image: require('../../assets/onboarding/hero-4.png'),
    aspect: 419 / 1140,
  },
];
