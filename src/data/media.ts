/**
 * Dummy media pool for posts, stories, and reels. Images come from
 * picsum.photos (seeded so they stay stable) and videos from public sample
 * hosts that serve plain MP4 with range + CORS support.
 */

export type MediaItem = {
  id: string;
  type: 'image' | 'video';
  uri: string;
  /** Poster frame rendered in grids/rails before the video plays. */
  poster?: string;
  /**
   * Higher-quality rendition of the same video, when the backend transcoded
   * one. The feed plays `uri` (SD) and the full-screen viewer prefers this.
   */
  hdUri?: string;
  /** Intrinsic pixel size, used to give an inline video its true aspect ratio. */
  width?: number;
  height?: number;
  /** Video length in seconds, shown as a badge on the poster. */
  duration?: number;
};

/** Stable dummy image URL for a seed word. */
export function sampleImage(seed: string, w = 900, h = 675): string {
  return `https://picsum.photos/seed/${seed}/${w}/${h}`;
}

/**
 * Public sample clips — short MP4s that reliably stream (Google's old
 * gtv-videos-bucket now 403s). Posters come from picsum.
 */
export const sampleVideos = [
  'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_5MB.mp4',
  'https://test-videos.co.uk/vids/jellyfish/mp4/h264/720/Jellyfish_720_10s_5MB.mp4',
  'https://test-videos.co.uk/vids/sintel/mp4/h264/720/Sintel_720_10s_5MB.mp4',
  'https://media.w3.org/2010/05/sintel/trailer.mp4',
  'https://media.w3.org/2010/05/bunny/trailer.mp4',
].map((uri, index) => ({
  id: `sv${index + 1}`,
  type: 'video' as const,
  uri,
  poster: sampleImage(`poster-clip-${index + 1}`),
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
