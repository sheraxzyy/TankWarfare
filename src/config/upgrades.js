/**
 * Permanent armor upgrades purchased with credits earned in combat.
 */
export const UPGRADES = {
  armor: {
    id: 'armor',
    name: 'COMPOSITE ARMOR',
    description: 'Increases maximum armor plating by 15 per level.',
    icon: 'shield',
    maxLevel: 5,
    costs: [180, 340, 620, 1000, 1550],
    effect: (level) => `+${level * 15} max armor`,
  },
  engine: {
    id: 'engine',
    name: 'ENGINE TUNING',
    description: 'Improves acceleration and top speed by 7% per level.',
    icon: 'engine',
    maxLevel: 5,
    costs: [160, 300, 560, 920, 1400],
    effect: (level) => `+${level * 7}% mobility`,
  },
  reload: {
    id: 'reload',
    name: 'AUTOLOADER',
    description: 'Reduces reload time by 7% per level.',
    icon: 'reload',
    maxLevel: 5,
    costs: [200, 380, 680, 1100, 1650],
    effect: (level) => `-${level * 7}% reload`,
  },
  damage: {
    id: 'damage',
    name: 'IMPROVED SHELLS',
    description: 'Increases all weapon damage by 7% per level.',
    icon: 'shell',
    maxLevel: 5,
    costs: [220, 420, 760, 1200, 1800],
    effect: (level) => `+${level * 7}% damage`,
  },
};

export const UPGRADE_ORDER = ['armor', 'engine', 'reload', 'damage'];

export function getUpgradeCost(upgradeId, currentLevel) {
  const upgrade = UPGRADES[upgradeId];
  if (!upgrade) return null;
  if (currentLevel >= upgrade.maxLevel) return null;
  return upgrade.costs[currentLevel];
}
