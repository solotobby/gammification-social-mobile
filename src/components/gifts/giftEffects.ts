/**
 * The per-gift choreography for `GiftSplash`.
 *
 * Every artifact in `GET /gifts` gets its own effect, keyed by its catalog id
 * ("rose", "rocket", …). Each one is a recipe for the same engine: how the gift
 * itself arrives (`entrance`), what it throws around (`particles` +
 * `motion`), and which set pieces fire on impact (rays, shockwave rings, a
 * white flash, a screen shake). Unknown ids fall back by tier, so a gift the
 * backend adds tomorrow still celebrates instead of crashing.
 *
 * The bigger the gift, the bigger the show: the premium tier runs longest and
 * is the only one that slams, flashes and shakes.
 */

/** How the gift emoji itself enters and holds the stage. */
export type HeroEntrance =
  /** Springs up from nothing with a wobble. */
  | 'pop'
  /** Falls in from above and bounces — for things worn on top (crowns, chains). */
  | 'drop'
  /** Crashes in from huge and settles — heavy, premium weight. */
  | 'slam'
  /** Rises from the bottom, hovers shaking, then blasts off the top. */
  | 'launch'
  /** Sails in from the right, bobs, and sails off left (🛥️ faces left). */
  | 'sail';

/** What the particles do. */
export type ParticleMotion =
  /** Petals drifting down, swaying. */
  | 'fall'
  /** Straight, fast, heavy — coins. */
  | 'rain'
  /** Floating up from the bottom — hearts, balloons. */
  | 'rise'
  /** Exploding outward from the gift, with a touch of gravity. */
  | 'burst'
  /** Several bursts across the sky, staggered. */
  | 'fireworks'
  /** Spiralling out from the centre. */
  | 'swirl'
  /** Exhaust emitted along the launch path. */
  | 'trail'
  /** Spray thrown up behind a boat. */
  | 'wave';

export type GiftEffect = {
  /** [primary glow, secondary glow]. */
  colors: [string, string];
  particles: string[];
  motion: ParticleMotion;
  count: number;
  entrance: HeroEntrance;
  /** Rotating light rays behind the gift. */
  rays?: boolean;
  /** Shockwave rings on impact. */
  rings?: number;
  /** A white flash on impact. */
  flash?: boolean;
  /** The whole screen jolts on impact. */
  shake?: boolean;
  /** The short line above the gift's name on the caption card. */
  tagline: string;
};

const EFFECTS: Record<string, GiftEffect> = {
  // --- Classic -------------------------------------------------------------
  rose: {
    colors: ['#FF4D7E', '#FF9EB5'],
    particles: ['🌸', '🌹', '🌸', '🌺'],
    motion: 'fall',
    count: 28,
    entrance: 'pop',
    rings: 1,
    tagline: 'A rose for you',
  },
  heart: {
    colors: ['#FF3B5C', '#FF8FA3'],
    particles: ['❤️', '💖', '💕', '💗'],
    motion: 'rise',
    count: 26,
    entrance: 'pop',
    rings: 2,
    tagline: 'Sent with love',
  },
  balloon: {
    colors: ['#FF6B6B', '#FFD93D'],
    particles: ['🎈', '🎈', '🎉', '🎊'],
    motion: 'rise',
    count: 20,
    entrance: 'pop',
    rings: 1,
    tagline: 'Up, up and away',
  },
  star: {
    colors: ['#FFC933', '#FFF1A8'],
    particles: ['⭐', '✨', '🌟', '💫'],
    motion: 'burst',
    count: 28,
    entrance: 'pop',
    rays: true,
    rings: 1,
    tagline: "You're a star",
  },
  trophy: {
    colors: ['#FFB800', '#FFE08A'],
    particles: ['🎊', '✨', '🎉', '⭐'],
    motion: 'burst',
    count: 32,
    entrance: 'drop',
    rays: true,
    rings: 2,
    tagline: 'Champion move',
  },

  // --- Fashion -------------------------------------------------------------
  clutch: {
    colors: ['#E85D9A', '#FFC2DC'],
    particles: ['✨', '💖', '💄', '👠'],
    motion: 'burst',
    count: 26,
    entrance: 'pop',
    rings: 1,
    tagline: 'Serving style',
  },
  chain: {
    colors: ['#E0A526', '#FFE7A3'],
    particles: ['✨', '💛', '⭐', '✨'],
    motion: 'burst',
    count: 28,
    entrance: 'drop',
    rays: true,
    rings: 1,
    tagline: 'Dripping in gold',
  },
  ring: {
    colors: ['#7DD3FC', '#E0F2FE'],
    particles: ['💎', '✨', '🤍', '✨'],
    motion: 'burst',
    count: 30,
    entrance: 'pop',
    rays: true,
    rings: 2,
    tagline: 'Put a ring on it',
  },
  gem: {
    colors: ['#22D3EE', '#A5F3FC'],
    particles: ['💎', '✨', '🔷', '💠'],
    motion: 'burst',
    count: 32,
    entrance: 'pop',
    rays: true,
    rings: 2,
    tagline: 'A rare find',
  },
  crown: {
    colors: ['#FACC15', '#FEF08A'],
    particles: ['✨', '💛', '⭐', '🌟'],
    motion: 'burst',
    count: 36,
    entrance: 'drop',
    rays: true,
    rings: 2,
    tagline: 'All hail',
  },

  // --- Payhankey -----------------------------------------------------------
  pkcoin: {
    colors: ['#F5B400', '#FFE27A'],
    particles: ['🪙'],
    motion: 'rain',
    count: 34,
    entrance: 'pop',
    rings: 1,
    tagline: 'Coins incoming',
  },
  pkheart: {
    colors: ['#8B5CF6', '#C4B5FD'],
    particles: ['💜', '💜', '✨', '💟'],
    motion: 'rise',
    count: 28,
    entrance: 'pop',
    rings: 2,
    tagline: 'Payhankey love',
  },
  pkbadge: {
    colors: ['#7C3AED', '#FCD34D'],
    particles: ['⭐', '✨', '🎖️', '🌟'],
    motion: 'burst',
    count: 28,
    entrance: 'slam',
    rays: true,
    rings: 2,
    tagline: 'Badge of honour',
  },
  pkshield: {
    colors: ['#6366F1', '#A5B4FC'],
    particles: ['⚡', '✨', '💠', '✨'],
    motion: 'burst',
    count: 30,
    entrance: 'slam',
    rings: 3,
    flash: true,
    tagline: 'Creator protected',
  },
  pkbolt: {
    colors: ['#FACC15', '#A78BFA'],
    particles: ['⚡', '⚡', '✨', '💥'],
    motion: 'burst',
    count: 34,
    entrance: 'slam',
    rings: 3,
    flash: true,
    shake: true,
    tagline: 'Fully charged',
  },

  // --- Premium -------------------------------------------------------------
  rocket: {
    colors: ['#FB923C', '#FDE68A'],
    particles: ['🔥', '💨', '✨', '🔥'],
    motion: 'trail',
    count: 44,
    entrance: 'launch',
    rings: 1,
    shake: true,
    tagline: 'To the moon',
  },
  castle: {
    colors: ['#A855F7', '#F9A8D4'],
    particles: ['🎆', '🎇', '✨', '🎉'],
    motion: 'fireworks',
    count: 48,
    entrance: 'slam',
    rays: true,
    rings: 2,
    shake: true,
    tagline: 'Kingdom unlocked',
  },
  yacht: {
    colors: ['#0EA5E9', '#7DD3FC'],
    particles: ['🌊', '💦', '💦', '✨'],
    motion: 'wave',
    count: 36,
    entrance: 'sail',
    tagline: 'Living large',
  },
  dragon: {
    colors: ['#EF4444', '#F97316'],
    particles: ['🔥', '🔥', '💥', '✨'],
    motion: 'burst',
    count: 46,
    entrance: 'slam',
    rays: true,
    rings: 3,
    flash: true,
    shake: true,
    tagline: 'Legendary',
  },
  galaxy: {
    colors: ['#6D28D9', '#22D3EE'],
    particles: ['✨', '⭐', '🪐', '💫', '🌟'],
    motion: 'swirl',
    count: 48,
    entrance: 'pop',
    rays: true,
    rings: 2,
    flash: true,
    tagline: 'Out of this world',
  },
};

/** For an artifact the app doesn't know yet — something that still feels right for its tier. */
const TIER_FALLBACK: Record<string, string> = {
  classic: 'star',
  fashion: 'gem',
  payhankey: 'pkheart',
  premium: 'castle',
};

export function effectFor(giftId: string, tier?: string | null): GiftEffect {
  return EFFECTS[giftId] ?? EFFECTS[TIER_FALLBACK[tier ?? ''] ?? 'star'];
}

/** How long the whole show runs — bigger gifts get more stage time. */
export function durationFor(tier?: string | null): number {
  if (tier === 'premium') return 3800;
  if (tier === 'fashion' || tier === 'payhankey') return 3200;
  return 2800;
}
