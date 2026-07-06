/**
 * Dummy media pool for posts and stories. Images come from picsum.photos
 * (seeded so they stay stable) and videos from Google's public sample bucket,
 * which also hosts a poster frame for each clip.
 */

export type MediaItem = {
  id: string;
  type: 'image' | 'video';
  uri: string;
  /** Poster frame rendered in grids/rails before the video plays. */
  poster?: string;
};

/** Stable dummy image URL for a seed word. */
export function sampleImage(seed: string, w = 900, h = 675): string {
  return `https://picsum.photos/seed/${seed}/${w}/${h}`;
}

const VIDEO_BUCKET = 'https://storage.googleapis.com/gtv-videos-bucket/sample';

/**
 * Public sample clips. Posters come from picsum — the bucket's own poster
 * JPGs are served with a content type browsers refuse to render (ORB).
 */
export const sampleVideos = [
  'ForBiggerBlazes',
  'ForBiggerFun',
  'ForBiggerEscapes',
  'ForBiggerJoyrides',
  'ForBiggerMeltdowns',
].map((name, index) => ({
  id: `sv${index + 1}`,
  type: 'video' as const,
  uri: `${VIDEO_BUCKET}/${name}.mp4`,
  poster: sampleImage(`poster-${name}`),
}));

let mediaId = 0;

/** Build an image MediaItem from a seed word. */
export function image(seed: string): MediaItem {
  return { id: `mi${++mediaId}`, type: 'image', uri: sampleImage(seed) };
}

/** Pick a sample video (cycled) as a fresh MediaItem. */
export function video(index: number): MediaItem {
  const clip = sampleVideos[index % sampleVideos.length];
  return { ...clip, id: `mv${++mediaId}` };
}
