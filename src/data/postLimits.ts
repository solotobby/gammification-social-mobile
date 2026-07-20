/**
 * Per-level create-post limits. The account level comes from GET /user/me
 * (`data.level`: "Basic" | "Creator" | "Influencer"). The backend enforces
 * these too — a Basic account's `images[]` is rejected, and every account is
 * limited to "either images or a video, not both" — so the compose screen
 * mirrors them client-side to keep the rules clear and fail before the request.
 */

export type UserLevel = 'Basic' | 'Creator' | 'Influencer';

export type PostLimits = {
  level: UserLevel;
  /** Max characters in the body; `Infinity` for unlimited tiers. */
  maxChars: number;
  /** Max images per post (0 = images not allowed on this tier). */
  maxImages: number;
  /** Max videos per post (0 = video not allowed on this tier). */
  maxVideos: number;
  /** One-line summary of what this tier can attach, for the compose banner. */
  mediaSummary: string;
};

const LIMITS: Record<UserLevel, PostLimits> = {
  Basic: {
    level: 'Basic',
    maxChars: 160,
    maxImages: 0,
    maxVideos: 0,
    mediaSummary: 'Text only, up to 160 characters',
  },
  Creator: {
    level: 'Creator',
    maxChars: Infinity,
    maxImages: 1,
    maxVideos: 0,
    mediaSummary: 'Unlimited text and up to 1 photo',
  },
  Influencer: {
    level: 'Influencer',
    maxChars: Infinity,
    maxImages: 4,
    maxVideos: 1,
    mediaSummary: 'Unlimited text and up to 4 photos or 1 video',
  },
};

/** Resolve the post limits for a level string; unknown/missing → Basic (safest). */
export function limitsFor(level: string | undefined | null): PostLimits {
  if (level && level in LIMITS) return LIMITS[level as UserLevel];
  return LIMITS.Basic;
}
