import Phaser from 'phaser';
import { getBattlefield } from '../config/battlefields.js';
import { getMission } from '../config/missions.js';
import { QUALITY } from '../config/constants.js';
import { MapBuilder } from '../maps/MapBuilder.js';
import { EffectsSystem } from '../systems/EffectsSystem.js';
import { CombatSystem } from '../systems/CombatSystem.js';
import { MissionManager } from '../systems/MissionManager.js';
import { SurvivalManager } from '../systems/SurvivalManager.js';
import { TrainingManager } from '../systems/TrainingManager.js';
import { PlayerTank } from '../entities/PlayerTank.js';
import { clamp } from '../core/Utils.js';

/**
 * GameScene
 * Owns one live battle. Mode managers drive objectives and spawning, the combat
 * system owns projectiles and damage, and the HTML UI receives HUD snapshots at
 * a fixed cadence instead of querying Phaser every frame.
 */
export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  init(data = {}) {
    this.startData = {
      mode: data.mode || 'campaign',
      missionId: Number(data.missionId) || 1,
      mapId: data.mapId || null,
    };

    if (this.startData.mode === 'campaign') {
      const mission = getMission(this.startData.missionId);
      this.startData.mapId = this.startData.mapId || mission.map;
      this.night = Boolean(mission.night);
    } else {
      this.startData.mapId = this.startData.mapId || 'desert';
      this.night = false;
    }

    this.mapDef = getBattlefield(this.startData.mapId);
    this.runEnded = false;
    this.paused = false;
    this.inputLocked = false;
    this.hudTimer = 0;
    this.enemyScale = 1;
    this.deathTimer = null;
  }

  create() {
    this.save = this.game.registry.get('save');
    this.audio = this.game.registry.get('audio');
    this.settings = this.save.settings;
    this.quality = QUALITY[this.settings.quality] || QUALITY.high;
    this.stats = {
      score: 0,
      kills: 0,
      hits: 0,
      damageDealt: 0,
      time: 0,
      objectives: 0,
    };

    this.cameras.main.setBackgroundColor(this.mapDef.groundColor);
    this.mapBuilder = new MapBuilder(this, this.mapDef, this.quality).build();
    this.effects = new EffectsSystem(this, this.quality, this.settings);
    this.combat = new CombatSystem(this, {
      mapBuilder: this.mapBuilder,
      effects: this.effects,
      audio: this.audio,
      save: this.save,
    });

    this.spawnPlayer();
    this.combat.attachPlayer(this.player);
    this.createManager();

    this.setupCamera();
    this.setupInput();
    this.setupEvents();

    this.audio.unlock();
    this.audio.resume();
    this.audio.setEngine(true, 0);

    this.game.events.emit('hud:init', {
      mode: this.startData.mode,
      map: {
        id: this.mapDef.id,
        name: this.mapDef.name,
        width: this.mapDef.width,
        height: this.mapDef.height,
        groundColor: this.mapDef.groundColor,
        roadColor: this.mapDef.roadColor,
        roads: this.mapDef.roads || [],
      },
      obstacles: this.mapBuilder.getMinimapObstacles(),
      night: this.night,
    });

    this.game.events.emit('game:started', {
      mode: this.startData.mode,
      mapId: this.mapDef.id,
      mapName: this.mapDef.name,
    });

    this.time.delayedCall(420, () => {
      if (this.runEnded) return;
      if (this.startData.mode === 'campaign' && this.manager.mission) {
        this.game.events.emit('hud:wave', {
          label: `OPERATION ${String(this.manager.mission.id).padStart(2, '0')} // ${this.manager.mission.threat} THREAT`,
          title: this.manager.mission.name,
        });
      } else if (this.startData.mode === 'training') {
        this.game.events.emit('hud:wave', {
          label: 'LIVE-FIRE QUALIFICATION',
          title: 'CREW TRAINING',
        });
      }
    });

    this.emitHud();
  }

  spawnPlayer() {
    const spawn = this.mapDef.playerSpawn || { x: 320, y: this.mapDef.height / 2, rotation: 0 };
    const spot = this.mapBuilder.findSpawnNear(spawn.x, spawn.y, 90);
    this.player = new PlayerTank(this, spot.x, spot.y, {
      save: this.save,
      training: this.startData.mode === 'training',
      allWeapons: this.startData.mode === 'training',
    });
    this.player.setRotation(spawn.rotation || 0);
    this.player.turretAngle = this.player.rotation;
    this.player.dustTimer = 0;
  }

  createManager() {
    if (this.startData.mode === 'survival') {
      this.manager = new SurvivalManager(this);
    } else if (this.startData.mode === 'training') {
      this.manager = new TrainingManager(this);
    } else {
      this.manager = new MissionManager(this);
    }
  }

  setupCamera() {
    const cam = this.cameras.main;
    cam.startFollow(this.player, true, 0.085, 0.085);
    cam.setDeadzone(70, 50);
    cam.setBounds(0, 0, this.mapDef.width, this.mapDef.height);
    this.handleResize();
    this.scale.on('resize', this.handleResize, this);
  }

  handleResize() {
    const zoom = clamp(Math.min(this.scale.width / 1280, this.scale.height / 800), 0.8, 1.35);
    this.cameras.main.setZoom(zoom);
  }

  setupInput() {
    const codes = Phaser.Input.Keyboard.KeyCodes;
    this.keys = this.input.keyboard.addKeys({
      w: codes.W,
      s: codes.S,
      a: codes.A,
      d: codes.D,
      space: codes.SPACE,
      e: codes.E,
      r: codes.R,
    });
    this.cursors = this.input.keyboard.createCursorKeys();
    this.input.keyboard.addCapture([
      codes.SPACE,
      codes.UP,
      codes.DOWN,
      codes.LEFT,
      codes.RIGHT,
      codes.W,
      codes.A,
      codes.S,
      codes.D,
    ]);

    this.input.keyboard.on('keydown-ESC', () => this.togglePause());
    this.input.keyboard.on('keydown-ONE', () => this.selectWeapon('standard'));
    this.input.keyboard.on('keydown-TWO', () => this.selectWeapon('heavy'));
    this.input.keyboard.on('keydown-THREE', () => this.selectWeapon('rapid'));
    this.input.keyboard.on('keydown-FOUR', () => this.selectWeapon('rocket'));
  }

  setupEvents() {
    this.game.events.on('game:resume', this.resumeGame, this);
    this.game.events.on('player:destroyed', this.onPlayerDestroyed, this);
    this.events.on('enemy:killed', this.onEnemyKilled, this);

    this.events.once('shutdown', () => {
      this.game.events.off('game:resume', this.resumeGame, this);
      this.game.events.off('player:destroyed', this.onPlayerDestroyed, this);
      this.scale.off('resize', this.handleResize, this);
      this.audio?.setEngine(false, 0);
      this.audio?.resume();
      if (this.manager) this.manager = null;
    });
  }

  /* ------------------------------------------------------------------ */
  /* Input actions                                                       */
  /* ------------------------------------------------------------------ */

  selectWeapon(id) {
    if (this.paused || this.runEnded || !this.player.alive) return;
    this.player.switchWeapon(id);
    this.emitHud();
  }

  useSpecial() {
    if (this.paused || this.runEnded || !this.player?.alive) return;
    this.player.fireSpecial();
    this.emitHud();
  }

  requestReload() {
    if (this.paused || this.runEnded || !this.player?.alive) return;
    this.player.startReload(true);
    this.emitHud();
  }

  getInputState() {
    if (this.paused || this.runEnded || this.inputLocked || !this.player?.alive) {
      return { forward: false, reverse: false, left: false, right: false, fire: false, special: false };
    }
    return {
      forward: this.cursors.up.isDown || this.keys.w.isDown,
      reverse: this.cursors.down.isDown || this.keys.s.isDown,
      left: this.cursors.left.isDown || this.keys.a.isDown,
      right: this.cursors.right.isDown || this.keys.d.isDown,
      fire: this.keys.space.isDown,
      special: false,
    };
  }

  /* ------------------------------------------------------------------ */
  /* Frame update                                                        */
  /* ------------------------------------------------------------------ */

  update(time, delta) {
    if (!this.player) return;
    const dt = Math.min(delta, 50) / 1000;

    if (this.paused) {
      this.audio.setEngine(false, 0);
      return;
    }

    if (!this.runEnded) {
      this.stats.time += dt;
      this.player.update(dt, this.getInputState());
      this.combat.update(dt);
      this.manager?.update(dt);

      this.audio.setEngine(this.player.alive, this.player.speedRatio);

      if (Phaser.Input.Keyboard.JustDown(this.keys.e)) this.useSpecial();
      if (Phaser.Input.Keyboard.JustDown(this.keys.r)) this.requestReload();
    }

    this.hudTimer -= dt;
    if (this.hudTimer <= 0) {
      this.hudTimer = 0.05;
      this.emitHud();
    }
  }

  emitHud() {
    if (!this.player) return;
    const boss = this.combat.getBoss();
    const enemies = this.combat.enemies
      .getChildren()
      .filter((e) => e.active && e.alive && !e.deathStarted)
      .map((e) => ({
        x: e.x,
        y: e.y,
        type: e.enemyType,
        boss: Boolean(e.isBoss),
      }));

    const objectives = [];
    for (const tag of ['base', 'convoy', 'structure']) {
      for (const obj of this.mapBuilder.getObjectives(tag)) {
        objectives.push({ x: obj.x, y: obj.y, tag });
      }
    }

    this.game.events.emit('hud:update', {
      mode: this.startData.mode,
      night: this.night,
      player: this.player.getHudState(),
      objective: this.manager ? this.manager.getHudState() : null,
      boss: boss ? boss.getBossHudState() : null,
      stats: {
        score: this.stats.score,
        kills: this.stats.kills,
        time: this.stats.time,
      },
      minimap: {
        player: { x: this.player.x, y: this.player.y, rotation: this.player.rotation },
        enemies,
        objectives,
      },
    });
  }

  /* ------------------------------------------------------------------ */
  /* Combat / manager callbacks                                          */
  /* ------------------------------------------------------------------ */

  recordHit(damage) {
    this.stats.hits += 1;
    this.stats.damageDealt += damage || 0;
    this.save.recordHit(damage || 0);
  }

  recordObjective() {
    this.stats.objectives += 1;
  }

  addScore(points) {
    if (this.runEnded) return;
    this.stats.score += Math.max(0, Math.round(points || 0));
    this.game.events.emit('hud:score', { score: this.stats.score });
  }

  getRunStats() {
    const shots = this.player?.shotsFired || 0;
    return {
      score: Math.round(this.stats.score),
      kills: this.stats.kills,
      shots,
      hits: this.stats.hits,
      damageDealt: Math.round(this.stats.damageDealt),
      time: Math.round(this.stats.time),
      objectives: this.stats.objectives,
      accuracy: shots > 0 ? Math.min(100, Math.round((this.stats.hits / shots) * 100)) : 0,
      health: this.player ? Math.round(this.player.health) : 0,
      maxHealth: this.player ? this.player.maxHealth : 0,
    };
  }

  onEnemyKilled() {
    this.stats.kills += 1;
  }

  onPlayerDestroyed() {
    if (this.runEnded || this.deathTimer) return;
    this.inputLocked = true;
    this.audio.setEngine(false, 0);
    this.game.events.emit('hud:notify', { text: 'TANK DESTROYED — CREW LOST', kind: 'danger' });
    this.deathTimer = this.time.delayedCall(1450, () => {
      if (this.runEnded || !this.manager) return;
      this.manager.onPlayerDeath?.();
    });
  }

  /* ------------------------------------------------------------------ */
  /* Pause                                                               */
  /* ------------------------------------------------------------------ */

  togglePause() {
    if (this.runEnded || !this.player?.alive) return;
    if (this.paused) this.resumeGame();
    else this.pauseGame();
  }

  pauseGame() {
    if (this.paused || this.runEnded) return;
    this.paused = true;
    this.physics.pause();
    this.tweens.pauseAll();
    this.audio.setEngine(false, 0);
    this.audio.ui('click');
    const mission = this.manager?.mission;
    this.game.events.emit('game:paused', {
      paused: true,
      mode: this.startData.mode,
      title: mission ? mission.name : this.startData.mode === 'survival' ? 'SURVIVAL RUN' : 'LIVE-FIRE RANGE',
      mapName: this.mapDef.name,
    });
  }

  resumeGame() {
    if (!this.paused || this.runEnded) return;
    this.paused = false;
    this.physics.resume();
    this.tweens.resumeAll();
    this.audio.resume();
    this.audio.ui('back');
    this.game.events.emit('game:paused', { paused: false });
  }

  /* ------------------------------------------------------------------ */
  /* Run completion / persistence                                        */
  /* ------------------------------------------------------------------ */

  finishRun(victory, results) {
    if (this.runEnded) return;
    this.runEnded = true;
    this.paused = false;
    this.inputLocked = true;

    if (this.player) {
      this.player.runOver = true;
      this.player.speed = 0;
      this.player.body.stop();
    }

    this.physics.pause();
    this.audio.setEngine(false, 0);

    const payload = { ...(results || {}) };
    payload.victory = Boolean(victory);
    payload.mode = payload.mode || this.startData.mode;
    payload.mapId = payload.mapId || this.mapDef.id;
    payload.mapName = payload.mapName || this.mapDef.name;
    payload.stats = { ...(payload.stats || this.getRunStats()) };

    const stats = payload.stats;
    const credits = Math.max(0, Math.round(payload.credits || 0));

    if (payload.mode === 'campaign') {
      const missionId = payload.missionId || this.startData.missionId;
      if (victory) {
        this.save.completeMission(missionId, {
          stars: stats.stars || 1,
          score: stats.score || 0,
          kills: stats.kills || 0,
          time: stats.time || 0,
        });
        if (payload.weaponReward) {
          const unlocked = this.save.unlockWeapon(payload.weaponReward);
          payload.weaponUnlocked = unlocked;
        }
      } else {
        this.save.recordDeath();
      }
      this.save.state.lastMode = 'campaign';
      this.save.state.lastMap = this.mapDef.id;
      this.save.persist();
    } else if (payload.mode === 'survival') {
      const record = this.save.recordSurvival({
        score: stats.score || 0,
        wave: stats.wave || 0,
        kills: stats.kills || 0,
        time: stats.time || 0,
      });
      payload.newHighScore = record.newHighScore;
      payload.newHighWave = record.newHighWave;
      payload.stats.highScore = this.save.state.survival.highScore;
      payload.stats.highWave = this.save.state.survival.highWave;
      this.save.state.lastMode = 'survival';
      this.save.state.lastMap = this.mapDef.id;
      this.save.persist();
    } else if (payload.mode === 'training') {
      const drills = Array.isArray(payload.drills) ? payload.drills : [];
      for (const id of drills) this.save.markTraining(id);
      if (victory) {
        for (const id of ['drive', 'rotate', 'fire', 'reload', 'destroy', 'navigate']) {
          this.save.markTraining(id);
        }
      }
      this.save.state.lastMode = 'training';
      this.save.state.lastMap = this.mapDef.id;
      this.save.persist();
    }

    if (credits > 0) this.save.addCredits(credits);
    payload.credits = credits;

    if (victory) this.audio.victory();
    else this.audio.defeat();

    if (this.deathTimer) {
      this.deathTimer.remove(false);
      this.deathTimer = null;
    }

    this.time.delayedCall(520, () => {
      this.game.events.emit('game:over', payload);
    });
  }
}

export default GameScene;
