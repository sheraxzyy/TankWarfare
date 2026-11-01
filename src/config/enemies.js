/**
 * Enemy armor catalogue. Each entry drives stats, textures, AI temperament and scoring.
 */
export const ENEMY_TYPES = {
  scout: {
    id: 'scout',
    name: 'SCOUT TANK',
    callSign: 'VIPER',
    hp: 58,
    armor: 0,
    speed: 224,
    reverseSpeed: 110,
    accel: 260,
    rotSpeed: 2.7,
    damage: 11,
    projectileSpeed: 780,
    fireDelay: 1350,
    burst: 1,
    range: 480,
    detectRange: 540,
    preferredRange: 300,
    hull: 'hull_scout',
    turret: 'turret_scout',
    scale: 0.86,
    bodyRadius: 24,
    score: 100,
    behavior: 'aggressive',
    drops: 0.16,
  },
  assault: {
    id: 'assault',
    name: 'ASSAULT TANK',
    callSign: 'HAMMER',
    hp: 118,
    armor: 14,
    speed: 158,
    reverseSpeed: 95,
    accel: 210,
    rotSpeed: 1.85,
    damage: 22,
    projectileSpeed: 700,
    fireDelay: 1850,
    burst: 1,
    range: 570,
    detectRange: 640,
    preferredRange: 380,
    hull: 'hull_assault',
    turret: 'turret_assault',
    scale: 0.95,
    bodyRadius: 27,
    score: 165,
    behavior: 'pursuit',
    drops: 0.2,
  },
  heavy: {
    id: 'heavy',
    name: 'HEAVY TANK',
    callSign: 'ANVIL',
    hp: 235,
    armor: 34,
    speed: 102,
    reverseSpeed: 70,
    accel: 150,
    rotSpeed: 1.2,
    damage: 36,
    projectileSpeed: 620,
    fireDelay: 2550,
    burst: 1,
    range: 640,
    detectRange: 580,
    preferredRange: 460,
    hull: 'hull_heavy',
    turret: 'turret_heavy',
    scale: 1.08,
    bodyRadius: 30,
    score: 280,
    behavior: 'pursuit',
    drops: 0.26,
  },
  elite: {
    id: 'elite',
    name: 'ELITE TANK',
    callSign: 'REAPER',
    hp: 168,
    armor: 22,
    speed: 190,
    reverseSpeed: 130,
    accel: 280,
    rotSpeed: 2.35,
    damage: 28,
    projectileSpeed: 820,
    fireDelay: 1250,
    burst: 2,
    range: 650,
    detectRange: 780,
    preferredRange: 330,
    hull: 'hull_elite',
    turret: 'turret_elite',
    scale: 0.94,
    bodyRadius: 26,
    score: 360,
    behavior: 'elite',
    drops: 0.3,
  },
  boss: {
    id: 'boss',
    name: 'WARLORD PROTOTYPE',
    callSign: 'WARLORD',
    hp: 2700,
    armor: 45,
    speed: 104,
    reverseSpeed: 70,
    accel: 140,
    rotSpeed: 1.05,
    damage: 42,
    projectileSpeed: 680,
    fireDelay: 1000,
    burst: 1,
    range: 860,
    detectRange: 1600,
    preferredRange: 480,
    hull: 'hull_boss',
    turret: 'turret_boss',
    scale: 1.55,
    bodyRadius: 47,
    score: 2500,
    behavior: 'boss',
    drops: 0,
  },
};

export function getEnemyRuntime(type, scale = 1) {
  const base = ENEMY_TYPES[type] || ENEMY_TYPES.assault;
  const hpScale = 1 + Math.max(0, scale - 1) * 0.85;
  const damageScale = 1 + Math.max(0, scale - 1) * 0.55;
  return {
    ...base,
    hp: Math.round(base.hp * hpScale),
    armor: Math.round(base.armor * (1 + Math.max(0, scale - 1) * 0.35)),
    damage: Math.round(base.damage * damageScale),
    score: base.score,
  };
}

/** Wave composition used by Survival and by campaign endless phases. */
export function buildSurvivalWave(wave) {
  const enemies = [];
  const isBossWave = wave > 0 && wave % 5 === 0;

  if (isBossWave) {
    enemies.push({ type: 'boss', count: 1 });
    enemies.push({ type: 'assault', count: Math.min(4, 1 + Math.floor(wave / 5)) });
    if (wave >= 15) enemies.push({ type: 'elite', count: 1 });
    return { enemies, isBossWave, scale: 1 + (wave - 1) * 0.075 };
  }

  const scouts = 2 + Math.floor(wave * 0.7);
  const assaults = wave >= 2 ? 1 + Math.floor((wave - 1) * 0.55) : 0;
  const heavies = wave >= 4 ? Math.floor((wave - 2) / 3) : 0;
  const elites = wave >= 7 ? Math.floor((wave - 5) / 3) : 0;

  enemies.push({ type: 'scout', count: Math.min(8, scouts) });
  if (assaults) enemies.push({ type: 'assault', count: Math.min(6, assaults) });
  if (heavies) enemies.push({ type: 'heavy', count: Math.min(3, heavies) });
  if (elites) enemies.push({ type: 'elite', count: Math.min(3, elites) });

  return { enemies, isBossWave, scale: 1 + (wave - 1) * 0.075 };
}
