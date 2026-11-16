/**
 * User Profile & DiceBear Gaze Avatar System
 * Style: https://www.dicebear.com/styles/gaze/
 * HTTP API: https://api.dicebear.com/10.x/gaze/svg?seed=...
 */

export const AVATAR_SEEDS = [
  'Ace',
  'Birdie',
  'Eagle',
  'Albatross',
  'Bogey',
  'Putter',
  'Fairway',
  'Bunker',
  'Chippy',
  'Sandy',
  'Breeze',
  'Sunny',
  'Caddy',
  'Willow',
  'Zen',
  'Lucky',
  'Nova',
  'Spark',
  'Pixel',
  'Cosmo',
  'Frosty',
  'Blaze',
  'Echo',
  'Flash',
  'Shadow',
  'Comet',
  'Rocket',
  'Turbo',
];

const AVATAR_KEY = 'minigolf_user_avatar_seed';

export function getGazeAvatarUrl(seed: string): string {
  const cleanSeed = encodeURIComponent(seed.trim() || 'Golfer');
  return `https://api.dicebear.com/10.x/gaze/svg?seed=${cleanSeed}&radius=50`;
}

export function generateRandomAvatarSeed(): string {
  const idx = Math.floor(Math.random() * AVATAR_SEEDS.length);
  const num = Math.floor(10 + Math.random() * 90);
  return `${AVATAR_SEEDS[idx]}${num}`;
}

export function getSavedAvatarSeed(): string {
  try {
    const saved = localStorage.getItem(AVATAR_KEY);
    if (saved && saved.trim()) return saved.trim();
  } catch {}
  const fresh = generateRandomAvatarSeed();
  saveAvatarSeed(fresh);
  return fresh;
}

export function saveAvatarSeed(seed: string): void {
  try {
    localStorage.setItem(AVATAR_KEY, seed.trim());
  } catch {}
}
