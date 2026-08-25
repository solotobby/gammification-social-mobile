/**
 * Placeholder per-post earnings.
 *
 * **The API does not return a per-post figure.** Verified live 2026-08-25 by
 * logging the raw payload: `GET /timeline/feed` and `GET /timeline/post/{id}`
 * both return exactly `id, user_id, content, views, likes, comments,
 * has_video, has_images, media_status, created_at, is_liked_by_viewer, media,
 * comments_preview, likers_preview, user` — no earnings/amount/revenue key
 * under any name. Raised with the backend team.
 *
 * Until it ships, the earned pill and the post analytics screen both estimate
 * from these rates so the two surfaces can never show different numbers for
 * the same post. `earnedOf()` in src/api/timeline.ts still prefers a real
 * field if one appears, and this becomes dead the moment it does.
 *
 * The view rate matches the web's analytics page, where 1 monetized view read
 * as ₦0.03. Like and comment rates are invented.
 */
export const EARNING_RATES = { view: 0.03, like: 0.02, comment: 0.05 };

/** Estimated earnings for a post from its engagement counts. */
export function estimateEarnings(views: number, likes: number, comments: number) {
  return {
    views: views * EARNING_RATES.view,
    likes: likes * EARNING_RATES.like,
    comments: comments * EARNING_RATES.comment,
    get total() {
      return this.views + this.likes + this.comments;
    },
  };
}
