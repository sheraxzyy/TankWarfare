/**
 * Global constants shared by the game client.
 */
export const GAME_VERSION = '1.0.0';
export const SAVE_KEY = 'tank_warfare_save_v1';

export const COLORS = {
  sand: 0xc8b48a,
  olive: 0x4a5334,
  oliveBright: 0x97a36a,
  red: 0xb23a2f,
  orange: 0xe5863b,
  green: 0x7c9a5c,
  charcoal: 0x151713,
  grey: 0x8c8f84,
};

export const DEPTH = {
  ground: -20,
  road: -18,
  decal: -12,
  shadow: 1,
  obstacle: 3,
  pickup: 7,
  tank: 10,
  turret: 12,
  projectile: 20,
  effect: 30,
  overlay: 60,
};

export const QUALITY = {
  low: { label: 'LOW', particles: 0.4, shadows: false, decals: 0.4, smokeTrails: false },
  medium: { label: 'MEDIUM', particles: 0.7, shadows: true, decals: 0.75, smokeTrails: true },
  high: { label: 'HIGH', particles: 1, shadows: true, decals: 1, smokeTrails: true },
};

export const RANKS = [
  { min: 0, name: 'RECRUIT' },
  { min: 15, name: 'CORPORAL' },
  { min: 40, name: 'SERGEANT' },
  { min: 80, name: 'LIEUTENANT' },
  { min: 140, name: 'CAPTAIN' },
  { min: 220, name: 'MAJOR' },
  { min: 320, name: 'COLONEL' },
  { min: 450, name: 'WARLORD' },
];

export function getRank(kills) {
  let rank = RANKS[0];
  for (const entry of RANKS) {
    if (kills >= entry.min) rank = entry;
  }
  return rank.name;
}

export const ENEMY_SCORE = {
  scout: 100,
  assault: 165,
  heavy: 280,
  elite: 360,
  boss: 2500,
};

export const UI = {
  hudUpdateHz: 20,
  maxFeedItems: 5,
  feedDuration: 3200,
};
