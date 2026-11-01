import { SAVE_KEY, GAME_VERSION } from '../config/constants.js';
import { UPGRADES, getUpgradeCost } from '../config/upgrades.js';
import { WEAPONS, WEAPON_ORDER } from '../config/weapons.js';

const DEFAULT_SETTINGS = {
  master: 0.85,
  music: 0.38,
  sfx: 0.8,
  quality: 'high',
  shake: true,
  fullscreen: false,
  muted: false,
};

function defaultSave() {
  return {
    version: 1,
    campaign: { unlocked: 1, completed: {} },
    survival: { highScore: 0, highWave: 0, totalKills: 0, longestTime: 0, runs: 0 },
    stats: { kills: 0, shots: 0, hits: 0, damageDealt: 0, deaths: 0, missions: 0 },
    settings: { ...DEFAULT_SETTINGS },
    credits: 0,
    upgrades: { armor: 0, engine: 0, reload: 0, damage: 0 },
    selectedWeapon: 'standard',
    unlockedWeapons: ['standard'],
    training: { completed: [] },
    lastMode: 'campaign',
    lastMap: 'desert',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function safeNumber(value, fallback, min = -Infinity, max = Infinity) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function safeBool(value, fallback) {
  return typeof value === 'boolean' ? value : fallback;
}

function sanitize(input) {
  const base = defaultSave();
  if (!input || typeof input !== 'object') return base;

  const out = base;

  // Campaign
  if (input.campaign && typeof input.campaign === 'object') {
    out.campaign.unlocked = Math.round(safeNumber(input.campaign.unlocked, 1, 1, 10));
    if (input.campaign.completed && typeof input.campaign.completed === 'object') {
      for (const [key, value] of Object.entries(input.campaign.completed)) {
        const id = Number(key);
        if (!Number.isInteger(id) || id < 1 || id > 10) continue;
        if (!value || typeof value !== 'object') continue;
        out.campaign.completed[id] = {
          stars: Math.round(safeNumber(value.stars, 1, 1, 3)),
          score: Math.round(safeNumber(value.score, 0, 0, 99999999)),
          kills: Math.round(safeNumber(value.kills, 0, 0, 999999)),
          time: Math.round(safeNumber(value.time, 0, 0, 999999)),
          date: typeof value.date === 'number' ? value.date : Date.now(),
        };
      }
    }
  }

  // Survival records
  if (input.survival && typeof input.survival === 'object') {
    out.survival.highScore = Math.round(safeNumber(input.survival.highScore, 0, 0, 999999999));
    out.survival.highWave = Math.round(safeNumber(input.survival.highWave, 0, 0, 9999));
    out.survival.totalKills = Math.round(safeNumber(input.survival.totalKills, 0, 0, 99999999));
    out.survival.longestTime = Math.round(safeNumber(input.survival.longestTime, 0, 0, 9999999));
    out.survival.runs = Math.round(safeNumber(input.survival.runs, 0, 0, 999999));
  }

  // Stats
  if (input.stats && typeof input.stats === 'object') {
    out.stats.kills = Math.round(safeNumber(input.stats.kills, 0, 0, 99999999));
    out.stats.shots = Math.round(safeNumber(input.stats.shots, 0, 0, 99999999));
    out.stats.hits = Math.round(safeNumber(input.stats.hits, 0, 0, 99999999));
    out.stats.damageDealt = Math.round(safeNumber(input.stats.damageDealt, 0, 0, 999999999));
    out.stats.deaths = Math.round(safeNumber(input.stats.deaths, 0, 0, 999999));
    out.stats.missions = Math.round(safeNumber(input.stats.missions, 0, 0, 9999));
  }

  // Settings
  if (input.settings && typeof input.settings === 'object') {
    out.settings.master = safeNumber(input.settings.master, DEFAULT_SETTINGS.master, 0, 1);
    out.settings.music = safeNumber(input.settings.music, DEFAULT_SETTINGS.music, 0, 1);
    out.settings.sfx = safeNumber(input.settings.sfx, DEFAULT_SETTINGS.sfx, 0, 1);
    out.settings.quality = ['low', 'medium', 'high'].includes(input.settings.quality)
      ? input.settings.quality
      : DEFAULT_SETTINGS.quality;
    out.settings.shake = safeBool(input.settings.shake, DEFAULT_SETTINGS.shake);
    out.settings.fullscreen = safeBool(input.settings.fullscreen, false);
    out.settings.muted = safeBool(input.settings.muted, DEFAULT_SETTINGS.muted);
  }

  out.credits = Math.round(safeNumber(input.credits, 0, 0, 99999999));

  if (input.upgrades && typeof input.upgrades === 'object') {
    for (const id of Object.keys(UPGRADES)) {
      out.upgrades[id] = Math.round(safeNumber(input.upgrades[id], 0, 0, UPGRADES[id].maxLevel));
    }
  }

  if (Array.isArray(input.unlockedWeapons)) {
    const valid = input.unlockedWeapons.filter((id) => WEAPON_ORDER.includes(id));
    out.unlockedWeapons = Array.from(new Set(['standard', ...valid]));
  }
  if (WEAPONS[input.selectedWeapon] && out.unlockedWeapons.includes(input.selectedWeapon)) {
    out.selectedWeapon = input.selectedWeapon;
  }

  if (input.training && Array.isArray(input.training.completed)) {
    out.training.completed = Array.from(new Set(input.training.completed.filter((v) => typeof v === 'string'))).slice(0, 20);
  }

  if (input.lastMode === 'campaign' || input.lastMode === 'survival' || input.lastMode === 'training') {
    out.lastMode = input.lastMode;
  }
  if (['desert', 'forest', 'industrial', 'city'].includes(input.lastMap)) {
    out.lastMap = input.lastMap;
  }

  out.createdAt = typeof input.createdAt === 'number' ? input.createdAt : Date.now();
  out.updatedAt = typeof input.updatedAt === 'number' ? input.updatedAt : Date.now();

  return out;
}

export class SaveManager {
  constructor(storage = window.localStorage) {
    this.storage = storage;
    this.state = this.load();
  }

  load() {
    try {
      const raw = this.storage.getItem(SAVE_KEY);
      if (!raw) return defaultSave();
      const parsed = JSON.parse(raw);
      return sanitize(parsed);
    } catch (error) {
      console.warn('[SaveManager] Corrupted save data ignored:', error);
      try {
        this.storage.setItem(`${SAVE_KEY}_corrupt`, String(Date.now()));
      } catch {
        /* storage may be unavailable */
      }
      return defaultSave();
    }
  }

  persist() {
    this.state.updatedAt = Date.now();
    try {
      this.storage.setItem(SAVE_KEY, JSON.stringify(this.state));
    } catch (error) {
      console.warn('[SaveManager] Could not persist save data:', error);
    }
  }

  save() {
    this.persist();
  }

  reset() {
    this.state = defaultSave();
    try {
      this.storage.removeItem(SAVE_KEY);
    } catch {
      /* ignore */
    }
    this.persist();
  }

  get settings() {
    return this.state.settings;
  }

  updateSettings(partial) {
    this.state.settings = { ...this.state.settings, ...partial };
    this.persist();
  }

  addCredits(amount) {
    this.state.credits = Math.max(0, Math.round(this.state.credits + amount));
    this.persist();
  }

  spendCredits(amount) {
    if (this.state.credits < amount) return false;
    this.state.credits -= amount;
    this.persist();
    return true;
  }

  getUpgradeLevel(id) {
    return this.state.upgrades[id] || 0;
  }

  buyUpgrade(id) {
    const upgrade = UPGRADES[id];
    if (!upgrade) return { ok: false, reason: 'Unknown upgrade' };
    const level = this.getUpgradeLevel(id);
    const cost = getUpgradeCost(id, level);
    if (cost == null) return { ok: false, reason: 'MAX LEVEL' };
    if (this.state.credits < cost) return { ok: false, reason: 'INSUFFICIENT CREDITS' };
    this.state.credits -= cost;
    this.state.upgrades[id] = level + 1;
    this.persist();
    return { ok: true, level: level + 1, cost };
  }

  isWeaponUnlocked(id) {
    return this.state.unlockedWeapons.includes(id);
  }

  unlockWeapon(id) {
    if (!WEAPONS[id]) return false;
    if (this.state.unlockedWeapons.includes(id)) return false;
    this.state.unlockedWeapons.push(id);
    this.persist();
    return true;
  }

  selectWeapon(id) {
    if (!this.isWeaponUnlocked(id)) return false;
    this.state.selectedWeapon = id;
    this.persist();
    return true;
  }

  recordShot() {
    this.state.stats.shots += 1;
  }

  recordHit(damage = 0) {
    this.state.stats.hits += 1;
    this.state.stats.damageDealt += Math.round(damage);
  }

  recordKill() {
    this.state.stats.kills += 1;
  }

  recordDeath() {
    this.state.stats.deaths += 1;
  }

  completeMission(missionId, { stars, score, kills, time }) {
    const previous = this.state.campaign.completed[missionId];
    const best = previous
      ? {
          stars: Math.max(previous.stars, stars),
          score: Math.max(previous.score, score),
          kills: Math.max(previous.kills, kills),
          time: previous.time || time,
          date: previous.date,
        }
      : { stars, score, kills, time, date: Date.now() };

    this.state.campaign.completed[missionId] = best;
    this.state.campaign.unlocked = Math.min(10, Math.max(this.state.campaign.unlocked, missionId + 1));
    this.state.stats.missions += 1;
    this.persist();
    return best;
  }

  recordSurvival({ score, wave, kills, time }) {
    const s = this.state.survival;
    const newHighScore = score > s.highScore;
    const newHighWave = wave > s.highWave;
    if (newHighScore) s.highScore = Math.round(score);
    if (newHighWave) s.highWave = Math.round(wave);
    s.totalKills += Math.round(kills);
    s.longestTime = Math.max(s.longestTime, Math.round(time));
    s.runs += 1;
    this.persist();
    return { newHighScore, newHighWave };
  }

  markTraining(id) {
    if (!this.state.training.completed.includes(id)) {
      this.state.training.completed.push(id);
      this.persist();
    }
  }

  resetTraining() {
    this.state.training.completed = [];
    this.persist();
  }

  getMissionRecord(id) {
    return this.state.campaign.completed[id] || null;
  }

  get campaignUnlocked() {
    return this.state.campaign.unlocked;
  }

  get isFresh() {
    return this.state.stats.kills === 0 && this.state.stats.missions === 0 && this.state.stats.shots === 0;
  }

  exportSnapshot() {
    return {
      version: this.state.version,
      gameVersion: GAME_VERSION,
      campaign: this.state.campaign,
      survival: this.state.survival,
      stats: this.state.stats,
      credits: this.state.credits,
      upgrades: this.state.upgrades,
      unlockedWeapons: this.state.unlockedWeapons,
    };
  }
}
