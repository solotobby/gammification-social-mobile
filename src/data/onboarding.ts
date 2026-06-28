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
    title: 'Money that moves\nas fast as you do',
    description:
      'Send, spend and grow your money from one beautifully simple app built for everyday life.',
    icon: 'wallet-outline',
    gradient: [brand.violetBright, brand.violet],
    accent: brand.gold,
  },
  {
    key: 'send',
    overline: 'INSTANT TRANSFERS',
    title: 'Send money in\njust seconds',
    description:
      'Pay friends, family and businesses instantly — with zero hidden fees and bank-grade security.',
    icon: 'paper-plane-outline',
    gradient: [brand.mintBright, brand.mint],
    accent: brand.violetBright,
  },
  {
    key: 'track',
    overline: 'SMART INSIGHTS',
    title: 'Stay on top of\nevery transaction',
    description:
      'Real-time alerts and smart spending insights keep you fully in control of where your money goes.',
    icon: 'pie-chart-outline',
    gradient: [brand.gold, brand.pink],
    accent: brand.mintBright,
  },
  {
    key: 'grow',
    overline: 'GOALS & REWARDS',
    title: 'Grow your savings\non autopilot',
    description:
      'Set goals, automate your savings and earn rewards while you watch your balance climb.',
    icon: 'trending-up-outline',
    gradient: [brand.violet, brand.pink],
    accent: brand.gold,
  },
];
