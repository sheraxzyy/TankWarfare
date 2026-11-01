import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => pathToFileURL(path.join(root, 'src', p)).href;

// Minimal browser-ish globals for the client modules.
const store = new Map();
globalThis.window = {
  localStorage: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  },
};
globalThis.localStorage = globalThis.window.localStorage;

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error('FAIL:', msg);
  } else {
    console.log('ok  :', msg);
  }
}

const { SaveManager } = await import(src('core/SaveManager.js'));
const { MISSIONS, TRAINING_DRILLS, SURVIVAL_CONFIG } = await import(src('config/missions.js'));
const { BATTLEFIELD_ORDER, BATTLEFIELDS } = await import(src('config/battlefields.js'));
const { WEAPON_ORDER, WEAPONS } = await import(src('config/weapons.js'));
const { UPGRADES } = await import(src('config/upgrades.js'));
const { ENEMY_TYPES } = await import(src('config/enemies.js'));
const { GAME_VERSION, SAVE_KEY } = await import(src('config/constants.js'));

// Config sanity.
assert(Array.isArray(MISSIONS) && MISSIONS.length === 10, '10 campaign missions');
assert(Array.isArray(BATTLEFIELD_ORDER) && BATTLEFIELD_ORDER.length === 4, '4 battlefields');
assert(Array.isArray(WEAPON_ORDER) && WEAPON_ORDER.length === 4, '4 weapons');
assert(Object.keys(UPGRADES).length === 4, '4 upgrade tracks');
assert(Array.isArray(TRAINING_DRILLS) && TRAINING_DRILLS.length === 6, '6 training drills');
assert(Object.keys(BATTLEFIELDS).length === 4, 'battlefield definitions');
assert(Object.keys(WEAPONS).length === 4, 'weapon definitions');

const enemyKeys = Object.keys(ENEMY_TYPES);
for (const type of ['scout', 'assault', 'heavy', 'elite', 'boss']) {
  assert(enemyKeys.includes(type), `enemy type ${type} defined`);
}

// SaveManager behaviour.
const save = new SaveManager();
assert(save.state.version === 1, 'default save version');
assert(save.state.campaign.unlocked === 1, 'campaign starts locked to mission 1');
assert(save.state.credits === 0, 'zero starting credits');

save.addCredits(100);
assert(save.state.credits === 100, 'addCredits');
assert(save.spendCredits(40) === true && save.state.credits === 60, 'spendCredits success');
assert(save.spendCredits(1000) === false && save.state.credits === 60, 'spendCredits failure preserves balance');

save.addCredits(300);
const buy = save.buyUpgrade('armor');
assert(buy.ok === true, 'buyUpgrade succeeds with credits');
assert(save.getUpgradeLevel('armor') === 1, 'upgrade level increments');

assert(save.unlockWeapon('heavy') === true, 'unlockWeapon new');
assert(save.unlockWeapon('heavy') === false, 'unlockWeapon duplicate returns false');
assert(save.isWeaponUnlocked('heavy') === true, 'isWeaponUnlocked');
assert(save.selectWeapon('heavy') === true, 'selectWeapon unlocked');
assert(save.selectWeapon('rocket') === false, 'selectWeapon locked fails');

save.completeMission(1, { stars: 3, score: 1200, kills: 4, time: 90 });
assert(save.state.campaign.unlocked === 2, 'mission completion unlocks next');
assert(save.getMissionRecord(1)?.stars === 3, 'mission record stored');

save.recordSurvival({ score: 500, wave: 3, kills: 12, time: 120 });
assert(save.state.survival.highScore === 500, 'survival high score');
assert(save.state.survival.highWave === 3, 'survival high wave');

save.markTraining('move');
save.markTraining('move');
assert(save.state.training.completed.length === 1, 'training dedupes');

// Sanitization / migration.
const corrupt = new SaveManager({
  getItem: () => '{not json',
  setItem: () => {},
  removeItem: () => {},
});
assert(corrupt.state.version === 1, 'corrupt save falls back to defaults');

const migrated = new SaveManager({
  getItem: () => JSON.stringify({ version: 99, credits: 50, upgrades: { armor: 99 }, unlockedWeapons: ['standard', 'nope'] }),
  setItem: () => {},
  removeItem: () => {},
});
assert(migrated.state.credits === 50, 'migrated credits');
assert(migrated.state.upgrades.armor <= 5, 'upgrade level clamped to max');
assert(!migrated.isWeaponUnlocked('nope'), 'unknown weapon rejected');

save.reset();
assert(save.state.credits === 0 && save.state.campaign.unlocked === 1, 'reset clears progress');

console.log(`\nSmoke test complete — ${failed} failure(s).`);
process.exit(failed ? 1 : 0);
