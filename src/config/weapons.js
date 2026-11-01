/**
 * Weapon definitions. Every weapon is functional and uses the same combat pipeline:
 * clip + reserve ammunition, manual/auto reload, projectile speed, splash and spread.
 */
export const WEAPONS = {
  standard: {
    id: 'standard',
    name: 'M68 CANNON',
    short: 'M68',
    code: '105MM AP',
    description: 'Reliable 105 mm cannon. Balanced damage, good velocity and a deep ammunition reserve.',
    damage: 34,
    speed: 950,
    cooldown: 620,
    clipSize: 8,
    reserveMax: 64,
    reloadTime: 1650,
    spread: 0.006,
    splashRadius: 0,
    projectile: 'shell',
    muzzle: 54,
    unlock: { type: 'default', label: 'STANDARD ISSUE' },
    stats: { damage: 0.48, rate: 0.55, reload: 0.75 },
  },
  heavy: {
    id: 'heavy',
    name: 'RHEINMETALL 120',
    short: '120MM',
    code: '120MM HEAT',
    description: 'Heavy anti-armor cannon. Devastating per shell, but slow to load and limited reserve.',
    damage: 88,
    speed: 720,
    cooldown: 1450,
    clipSize: 4,
    reserveMax: 24,
    reloadTime: 2900,
    spread: 0.008,
    splashRadius: 0,
    projectile: 'heavy_shell',
    muzzle: 58,
    unlock: { type: 'mission', missionId: 2, label: 'COMPLETE MISSION 02' },
    stats: { damage: 0.95, rate: 0.25, reload: 0.35 },
  },
  rapid: {
    id: 'rapid',
    name: 'M242 BUSHMASTER',
    short: 'M242',
    code: '25MM AUTO',
    description: 'Rapid-fire autocannon. Trades damage per round for relentless suppression.',
    damage: 15,
    speed: 1080,
    cooldown: 125,
    clipSize: 30,
    reserveMax: 210,
    reloadTime: 2400,
    spread: 0.05,
    splashRadius: 0,
    projectile: 'tracer',
    muzzle: 50,
    unlock: { type: 'mission', missionId: 4, label: 'COMPLETE MISSION 04' },
    stats: { damage: 0.22, rate: 0.98, reload: 0.5 },
  },
  rocket: {
    id: 'rocket',
    name: 'M270 MLRS',
    short: 'MLRS',
    code: 'HE ROCKET',
    description: 'Rocket launcher with explosive splash damage. Excellent against groups and structures.',
    damage: 62,
    speed: 560,
    cooldown: 1150,
    clipSize: 3,
    reserveMax: 15,
    reloadTime: 3300,
    spread: 0.03,
    splashRadius: 112,
    projectile: 'rocket',
    muzzle: 56,
    unlock: { type: 'mission', missionId: 6, label: 'COMPLETE MISSION 06' },
    stats: { damage: 0.72, rate: 0.4, reload: 0.28 },
  },
};

export const WEAPON_ORDER = ['standard', 'heavy', 'rapid', 'rocket'];

/** Special ordnance fired with E. Three heavy shells in a forward fan. */
export const SPECIAL_ORDNANCE = {
  id: 'barrage',
  name: 'HE BARRAGE',
  description: 'Three high-explosive shells in a forward fan.',
  charges: 3,
  cooldown: 600,
  damage: 48,
  speed: 700,
  spread: 0.13,
  splashRadius: 78,
  projectile: 'heavy_shell',
  muzzle: 50,
};

/** Applies the damage upgrade and returns a copy safe to mutate locally. */
export function getWeaponRuntime(weaponId, upgrades = {}) {
  const base = WEAPONS[weaponId] || WEAPONS.standard;
  const damageBonus = 1 + (upgrades.damage || 0) * 0.07;
  const reloadBonus = 1 - (upgrades.reload || 0) * 0.07;
  return {
    ...base,
    damage: Math.round(base.damage * damageBonus),
    reloadTime: Math.round(base.reloadTime * Math.max(0.55, reloadBonus)),
  };
}

export function getWeaponUnlockLabel(weapon) {
  return weapon.unlock?.label || 'FIELD ISSUE';
}
