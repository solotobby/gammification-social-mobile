import { Ionicons } from '@expo/vector-icons';
import { brand } from '../theme/colors';

export type OnboardingSlide = {
  key: string;
  /** Small label shown above the title. */
  overline: string;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** Gradient used for the hero illustration card. */
  gradient: [string, string];
  /** Accent used for the floating chips on the illustration. */
  accent: string;
  /**
   * Optional remote/local image for the hero. When set, the slide renders the
   * image instead of the generated illustration. Swap these for real artwork
   * later — e.g. `image: require('../../assets/onboarding/send.png')`.
   */
  image?: number | { uri: string };
};

// Dummy copy + placeholder visuals — replace with real content/artwork later.
export const onboardingSlides: OnboardingSlide[] = [
  {
    key: 'welcome',
    overline: 'WELCOME TO PAYHANKEY',
    title: 'Get paid for the\nposts you already make',
    description:
      'Payhankey turns your likes, comments and views into real money — earn from your very first post.',
    icon: 'create-outline',
    gradient: [brand.violetBright, brand.violet],
    accent: brand.gold,
  },
  {
    key: 'no-barriers',
    overline: 'NO FOLLOWERS NEEDED',
    title: 'No followers,\nno waiting around',
    description:
      'Skip the subscriber counts and watch-hour minimums. Every like, comment and view pays — starting today.',
    icon: 'rocket-outline',
    gradient: [brand.mintBright, brand.mint],
    accent: brand.violetBright,
  },
  {
    key: 'engagement',
    overline: 'HOW YOU EARN',
    title: 'Likes, comments\nand views pay you',
    description:
      'Earn per like, per comment and per view — plus bonuses for referrals and posts that go viral.',
    icon: 'heart-outline',
    gradient: [brand.gold, brand.pink],
    accent: brand.mintBright,
  },
  {
    key: 'withdraw',
    overline: 'CASH OUT ANYTIME',
    title: 'Withdraw your\nearnings, instantly',
    description:
      'Track everything in real time and cash out from as little as $1 to PayPal, USDT or your local bank.',
    icon: 'cash-outline',
    gradient: [brand.violet, brand.pink],
    accent: brand.gold,
  },
];
