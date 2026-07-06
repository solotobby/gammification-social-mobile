/**
 * Dummy reels — short-form vertical video feed (TikTok/IG Reels style).
 * Clips come from the shared sample video pool; engagement numbers are fake.
 */

import { members, type Member } from './community';
import { sampleVideos } from './media';

export type Reel = {
  id: string;
  author: Member;
  uri: string;
  poster?: string;
  caption: string;
  hashtags: string[];
  /** "Original audio" line shown under the caption. */
  audio: string;
  likes: number;
  comments: number;
  shares: number;
};

const CAPTIONS: [string, string[], string][] = [
  ['POV: your first payout just landed 🎉 The grind is real but so is the money.', ['PayhankeyWins', 'FirstPayout'], 'Original audio — Prosper Eze'],
  ['Day 12 of posting every single day. Watch the engagement curve do its thing 📈', ['GrowthMindset'], 'Trending sound — Steady Rise'],
  ['Behind the scenes of the shoot — wait for the last frame 😂', ['NaijaCreators', 'BTS'], 'Original audio — Champion Miracle'],
  ['Lagos at golden hour never misses. Sound ON for this one 🔊', ['LagosLife'], 'Original audio — Deborah Ade'],
  ['Three tips that doubled my validated engagement — save this one 📌', ['SideHustle', 'CreatorTips'], 'Voiceover — UTU Okon'],
  ['Weekend recap in 10 seconds. We move! 💜', ['PayhankeyWins'], 'Trending sound — We Move'],
];

export const reels: Reel[] = CAPTIONS.map(([caption, hashtags, audio], i) => {
  const clip = sampleVideos[i % sampleVideos.length];
  return {
    id: `reel-${i + 1}`,
    author: members[(i * 2 + 1) % members.length],
    uri: clip.uri,
    poster: clip.poster,
    caption,
    hashtags,
    audio,
    likes: 120 + ((i * 97) % 900),
    comments: 8 + ((i * 31) % 60),
    shares: 3 + ((i * 13) % 40),
  };
});
