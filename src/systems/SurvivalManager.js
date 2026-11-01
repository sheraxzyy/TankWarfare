import { buildSurvivalWave } from '../config/enemies.js';
import { SURVIVAL_CONFIG } from '../config/missions.js';
import { formatTime } from '../core/Utils.js';

/**
 * Endless survival mode. Waves escalate, boss armor arrives every fifth wave,
 * and the run records score, best wave and survival time when the tank dies.
 */
export class SurvivalManager {
  constructor(scene) {
    this.scene = scene;
    this.map = scene.mapBuilder;
    this.finished = false;
    this.time = 0;
    this.wave = 0;
    this.state = 'intermission';
    this.timer = 3.2;
    this.queue = [];
    this.spawnTimer = 0;
    this.waveKills = 0;
    this.isBossWave = false;
    this.waveBannerShown = false;
    this.totalSpawned = 0;

    scene.events.on('enemy:killed', this._onKill, this);
    scene.events.once('shutdown', () => {
      scene.events.off('enemy:killed', this._onKill, this);
    });

    scene.game.events.emit('hud:notify', { text: 'SURVIVAL PROTOCOL ACTIVE — WAVE 1 INBOUND', kind: 'warn' });
  }

  _onKill() {
    this.waveKills += 1;
  }

  update(dt) {
    if (this.finished) return;
    this.time += dt;

    if (this.state === 'intermission') {
      this.timer -= dt;
      if (this.timer <= 0) this._startWave();
      return;
    }

    // Stagger spawns so a wave arrives as a rolling assault.
    if (this.queue.length > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        const alive = this.scene.combat.getAliveEnemies().length;
        const cap = SURVIVAL_CONFIG.maxAliveBase + Math.min(4, Math.floor(this.wave / 2));
        if (alive < cap) {
          const type = this.queue.shift();
          const spawn = this.map.findEnemySpawn(this.scene.player.x, this.scene.player.y, 720);
          this.scene.combat.spawnEnemy(type, spawn.x, spawn.y, { scale: this.enemyScale });
          this.spawnTimer = SURVIVAL_CONFIG.spawnStagger;
          this.totalSpawned += 1;
        } else {
          this.spawnTimer = 0.5;
        }
      }
    }

    if (this.state === 'wave' && this.queue.length === 0) {
      const alive = this.scene.combat.getAliveEnemies().length;
      if (alive === 0) this._clearWave();
    }
  }

  _startWave() {
    this.wave += 1;
    const comp = buildSurvivalWave(this.wave);
    this.isBossWave = comp.isBossWave;
    this.enemyScale = comp.scale;
    this.scene.enemyScale = comp.scale;
    this.state = 'wave';
    this.queue = [];
    this.waveKills = 0;
    this.spawnTimer = 0;

    for (const group of comp.enemies) {
      for (let i = 0; i < group.count; i++) this.queue.push(group.type);
    }
    // Boss always arrives first so it anchors the wave.
    if (this.isBossWave) {
      this.queue = ['boss', ...this.queue.filter((t) => t !== 'boss')];
    }

    this.scene.game.events.emit('hud:wave', {
      label: this.isBossWave ? 'HEAVY ARMOR DETECTED' : `WAVE ${String(this.wave).padStart(2, '0')}`,
      title: this.isBossWave ? 'WARLORD INBOUND' : 'HOSTILE ARMOR',
    });
    this.scene.game.events.emit('hud:notify', {
      text: this.isBossWave ? 'WARNING — WARLORD-CLASS ARMOR' : `WAVE ${this.wave} — ${this.queue.length} HOSTILES`,
      kind: this.isBossWave ? 'danger' : 'warn',
    });
    if (this.isBossWave) this.scene.audio.bossWarning();
    else this.scene.audio.waveStart();
  }

  _clearWave() {
    const bonus = SURVIVAL_CONFIG.waveClearBonus + this.wave * 50;
    this.scene.addScore(bonus, 'WAVE CLEAR');
    this.scene.game.events.emit('hud:notify', {
      text: `WAVE ${this.wave} CLEARED +${bonus}`,
      kind: 'good',
    });

    for (let i = 0; i < SURVIVAL_CONFIG.pickupPerWave; i++) {
      const spot = this.map.findOpenPoint(this.scene.player.x, this.scene.player.y, 420, 50, 24);
      const type = i === 0 ? 'health' : Math.random() < 0.3 ? 'special' : 'ammo';
      this.scene.combat.spawnPickup(spot.x, spot.y, type);
    }

    this.state = 'intermission';
    this.timer = SURVIVAL_CONFIG.intermission;
    this.scene.game.events.emit('hud:notify', {
      text: `NEXT WAVE IN ${Math.ceil(this.timer)} SECONDS`,
      kind: 'warn',
    });
  }

  onPlayerDeath() {
    if (this.finished) return;
    this.finished = true;
    this.scene.finishRun(false, this.buildResults());
  }

  buildResults() {
    const stats = this.scene.getRunStats();
    const credits = Math.round(stats.score * 0.06) + this.wave * 30;
    return {
      victory: false,
      mode: 'survival',
      title: 'SURVIVAL RUN ENDED',
      subtitle: `${this.map.def.name} // ENDLESS ASSAULT`,
      reason: 'TANK DESTROYED',
      mapId: this.map.def.id,
      mapName: this.map.def.name,
      stats: {
        ...stats,
        wave: this.wave,
        highWave: this.scene.save.state.survival.highWave,
        stars: 0,
      },
      objectives: [
        `REACHED WAVE ${this.wave}`,
        `SURVIVED ${formatTime(stats.time)}`,
        `DESTROYED ${stats.kills} HOSTILES`,
      ],
      credits,
      weaponReward: null,
      nextMissionId: null,
    };
  }

  getHudState() {
    const alive = this.scene.combat.getAliveEnemies().length;
    const queued = this.queue.length;
    return {
      label: `SURVIVAL // WAVE ${String(this.wave).padStart(2, '0')}`,
      name: this.isBossWave ? 'WARLORD ARMOR ENGAGED' : 'HOLD THE LINE',
      progress:
        this.state === 'intermission'
          ? `NEXT WAVE IN ${Math.ceil(Math.max(0, this.timer))}s`
          : `${alive + queued} HOSTILES REMAINING${this.isBossWave ? ' • BOSS WAVE' : ''}`,
    };
  }
}
