import { getMission } from '../config/missions.js';
import { formatTime, shuffle } from '../core/Utils.js';

/**
 * Drives one of the ten campaign operations: spawns the garrison, handles
 * reinforcements and wave-based missions, tracks objectives and computes the
 * final rating/rewards.
 */
export class MissionManager {
  constructor(scene) {
    this.scene = scene;
    this.mission = getMission(scene.startData.missionId || 1);
    this.map = scene.mapDef;
    this.finished = false;
    this.time = 0;
    this.waveTimer = 0;
    this.waveCount = 0;
    this.spawnedInitial = false;
    this.reinforcements = (this.mission.reinforcements || []).map((r) => ({ ...r, triggered: false }));
    this.objectiveDestroyed = 0;
    this.bossSpawned = false;
    this.bossKilled = false;
    this.siegeBase = null;

    this.objectiveTotal = this._countObjectives();
    this.base = this.map.objectiveSites ? this.scene.mapBuilder.getObjectives('base')[0] : null;
    if (this.base) {
      this.siegeBase = this.base;
      this.baseMaxHp = this.base.getData('maxHp') || 1;
    }

    scene.events.on('objective:destroyed', this._onObjectiveDestroyed, this);
    scene.events.on('enemy:killed', this._onEnemyKilled, this);
    scene.events.once('shutdown', () => {
      scene.events.off('objective:destroyed', this._onObjectiveDestroyed, this);
      scene.events.off('enemy:killed', this._onEnemyKilled, this);
    });

    this._spawnInitial();
    if (this.mission.type === 'defend') {
      scene.game.events.emit('hud:notify', { text: 'DEFEND THE COMMAND BUNKER', kind: 'warn' });
    }
  }

  _countObjectives() {
    const type = this.mission.type;
    if (type === 'convoy') return this.scene.mapBuilder.getObjectives('convoy').length;
    if (type === 'structures') return this.scene.mapBuilder.getObjectives('structure').length;
    return 0;
  }

  _spawnInitial() {
    if (this.spawnedInitial) return;
    this.spawnedInitial = true;
    const type = this.mission.type;

    if (type === 'survive' || type === 'defend') {
      this.waveTimer = 2.5;
      return;
    }

    const queue = [];
    for (const group of this.mission.enemies || []) {
      for (let i = 0; i < (group.count || 0); i++) queue.push(group.type);
    }
    this._deployQueue(shuffle(queue));

    if (this.mission.boss) {
      this.bossSpawned = true;
      this.scene.time.delayedCall(1800, () => {
        if (this.finished || !this.scene.player?.alive) return;
        const spawn = this.scene.mapBuilder.findEnemySpawn(this.scene.player.x, this.scene.player.y, 950);
        this.scene.combat.spawnEnemy(this.mission.boss, spawn.x, spawn.y, {
          scale: this.mission.scale,
        });
        this.scene.enemyScale = this.mission.scale;
      });
    }
  }

  _deployQueue(queue) {
    const spawnPoints = shuffle(this.map.enemySpawns || []);
    let index = 0;
    for (const type of queue) {
      let spot = spawnPoints[index % Math.max(1, spawnPoints.length)];
      index += 1;
      if (!spot || this.scene.mapBuilder.isPointBlocked(spot.x, spot.y, 40)) {
        spot = this.scene.mapBuilder.findEnemySpawn(this.scene.player.x, this.scene.player.y, 600);
      }
      const open = this.scene.mapBuilder.findSpawnNear(spot.x, spot.y, 140);
      this.scene.combat.spawnEnemy(type, open.x, open.y, { scale: this.mission.scale });
    }
  }

  _onObjectiveDestroyed({ tag }) {
    if (tag === 'convoy' || tag === 'structure') this.objectiveDestroyed += 1;
  }

  _onEnemyKilled(payload) {
    // The boss emits its kill event only after the full death sequence, so
    // victory is not declared while the wreck is still detonating.
    if (payload?.isBoss) this.bossKilled = true;
  }

  update(dt) {
    if (this.finished) return;
    this.time += dt;
    const type = this.mission.type;

    // Reinforcements.
    for (const group of this.reinforcements) {
      if (group.triggered || this.time < group.delay) continue;
      group.triggered = true;
      const queue = [];
      for (const entry of group.enemies || []) {
        for (let i = 0; i < entry.count; i++) queue.push(entry.type);
      }
      this._deployQueue(queue);
      this.scene.game.events.emit('hud:notify', {
        text: 'ENEMY REINFORCEMENTS INBOUND',
        kind: 'warn',
      });
      this.scene.audio.alarm();
    }

    // Continuous wave missions.
    if (type === 'survive' || type === 'defend') {
      this.waveTimer -= dt;
      const alive = this.scene.combat.getAliveEnemies().length;
      if (this.waveTimer <= 0 && alive < this.mission.maxAlive) {
        this._spawnTacticalWave();
        this.waveTimer = this.mission.waveInterval;
      }
    }

    if (this._isComplete()) {
      this.finished = true;
      this.scene.time.delayedCall(650, () => {
        this.scene.finishRun(true, this.buildResults(true));
      });
      return;
    }

    if (type === 'defend' && this.base && !this.base.active) {
      this.finished = true;
      this.scene.game.events.emit('hud:notify', { text: 'COMMAND BUNKER DESTROYED', kind: 'danger' });
      this.scene.time.delayedCall(900, () => this.scene.finishRun(false, this.buildResults(false, 'COMMAND BUNKER DESTROYED')));
    }
  }

  _spawnTacticalWave() {
    const mission = this.mission;
    const alive = this.scene.combat.getAliveEnemies().length;
    const slots = Math.max(1, Math.min(4, (mission.maxAlive || 8) - alive));
    const pool = mission.wavePool || ['scout', 'assault'];
    for (let i = 0; i < slots; i++) {
      const type = pool[Math.floor(Math.random() * pool.length)];
      const spawn = this.scene.mapBuilder.findEnemySpawn(this.scene.player.x, this.scene.player.y, 700);
      this.scene.combat.spawnEnemy(type, spawn.x, spawn.y, { scale: mission.scale });
    }
    this.waveCount += 1;
    this.scene.game.events.emit('hud:notify', {
      text: `HOSTILE WAVE ${this.waveCount} — ${slots} VEHICLES`,
      kind: 'warn',
    });
    this.scene.audio.waveStart();
  }

  _isComplete() {
    const type = this.mission.type;
    const alive = this.scene.combat.getAliveEnemies().length;
    const objectives = (tag) => this.scene.mapBuilder.getObjectives(tag).length;

    if (type === 'eliminate') {
      return this.spawnedInitial && alive === 0;
    }
    if (type === 'convoy') {
      return objectives('convoy') === 0 && alive === 0;
    }
    if (type === 'structures') {
      return objectives('structure') === 0 && alive === 0;
    }
    if (type === 'boss') {
      return this.bossSpawned && this.bossKilled;
    }
    if (type === 'survive') {
      return this.time >= (this.mission.surviveTime || 120);
    }
    if (type === 'defend') {
      return this.time >= (this.mission.defendTime || 150) && Boolean(this.base?.active);
    }
    return false;
  }

  onPlayerDeath() {
    if (this.finished) return;
    this.finished = true;
    this.scene.finishRun(false, this.buildResults(false, 'TANK DESTROYED IN ACTION'));
  }

  buildResults(victory, reason = '') {
    const stats = this.scene.getRunStats();
    const mission = this.mission;
    const parTime = mission.parTime || 240;
    let stars = 0;
    if (victory) {
      stars = 1;
      if (stats.time <= parTime * 1.2) stars = 2;
      if (stats.time <= parTime * 0.82 && this.scene.player.health / this.scene.player.maxHealth > 0.5) stars = 3;
    }

    const speedBonus = victory ? Math.max(0, Math.round((parTime - stats.time) * 2)) : 0;
    const hullBonus = victory ? Math.round((this.scene.player.health / this.scene.player.maxHealth) * 90) : 0;
    const baseCredits = victory ? mission.rewards?.credits || 0 : Math.round(stats.score * 0.08);
    const credits = Math.max(0, baseCredits + speedBonus + hullBonus);

    const objectives = [];
    if (mission.type === 'convoy') {
      const remaining = this.scene.mapBuilder.getObjectives('convoy').length;
      objectives.push(`CONVOY TRUCKS DESTROYED ${Math.max(0, 3 - remaining)}/3`);
    }
    if (mission.type === 'structures') {
      objectives.push(`HARDPOINTS DESTROYED ${this.objectiveDestroyed}/${this.objectiveTotal || 4}`);
    }
    if (mission.type === 'survive') objectives.push(`SURVIVED ${formatTime(Math.min(stats.time, mission.surviveTime || 120))}`);
    if (mission.type === 'defend') {
      objectives.push(`BUNKER INTEGRITY ${Math.round(this._baseHealthRatio() * 100)}%`);
    }
    objectives.push(`HOSTILES DESTROYED ${stats.kills}`);

    return {
      victory,
      mode: 'campaign',
      missionId: mission.id,
      title: mission.name,
      subtitle: `OPERATION ${String(mission.id).padStart(2, '0')} // ${mission.codeName}`,
      reason,
      mapId: mission.map,
      night: Boolean(mission.night),
      mapName: this.map.name,
      stats: {
        ...stats,
        stars,
        wave: 0,
      },
      objectives,
      credits,
      weaponReward: victory ? mission.rewards?.weapon || null : null,
      nextMissionId: mission.id < 10 ? mission.id + 1 : null,
      totalMissions: 10,
      isCampaignEnd: victory && mission.id === 10,
    };
  }

  _baseHealthRatio() {
    if (!this.base || !this.base.active) return 0;
    const hp = this.base.getData('hp') ?? this.baseMaxHp;
    return Math.max(0, Math.min(1, hp / this.baseMaxHp));
  }

  getHudState() {
    const mission = this.mission;
    const alive = this.scene.combat.getAliveEnemies().length;
    let name = '';
    let progress = '';

    switch (mission.type) {
      case 'convoy': {
        const remaining = this.scene.mapBuilder.getObjectives('convoy').length;
        name = 'DESTROY THE SUPPLY CONVOY';
        progress = `${3 - remaining}/3 TRUCKS • ${alive} ESCORTS REMAINING`;
        break;
      }
      case 'structures': {
        const remaining = this.scene.mapBuilder.getObjectives('structure').length;
        name = 'DEMOLISH THE HARDPOINTS';
        progress = `${this.objectiveTotal - remaining}/${this.objectiveTotal || 4} HARDPOINTS • ${alive} HOSTILES`;
        break;
      }
      case 'survive': {
        const remaining = Math.max(0, (mission.surviveTime || 120) - this.time);
        name = 'SURVIVE THE ENCIRCLEMENT';
        progress = `${formatTime(remaining)} REMAINING • WAVE ${this.waveCount + 1} • ${alive} HOSTILES`;
        break;
      }
      case 'defend': {
        const remaining = Math.max(0, (mission.defendTime || 150) - this.time);
        name = 'DEFEND THE COMMAND BUNKER';
        progress = `${formatTime(remaining)} REMAINING • BUNKER ${Math.round(this._baseHealthRatio() * 100)}% • ${alive} HOSTILES`;
        break;
      }
      case 'boss':
        name = 'DESTROY THE WARLORD PROTOTYPE';
        progress = this.scene.combat.getBoss()
          ? 'THREAT LEVEL CRITICAL • ESCORT SCREEN ACTIVE'
          : 'WARLORD NEUTRALIZED';
        break;
      default:
        name = 'ELIMINATE HOSTILE ARMOR';
        progress = `${alive} HOSTILES REMAINING • ${this.scene.getRunStats().kills} DESTROYED`;
    }

    return {
      label: `OBJECTIVE // ${mission.threat} THREAT`,
      name,
      progress,
    };
  }
}
