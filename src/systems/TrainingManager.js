import Phaser from 'phaser';
import { TRAINING_DRILLS } from '../config/missions.js';
import { TAU } from '../core/Utils.js';

/**
 * Guided live-fire range. Six sequential drills teach movement, rotation,
 * gunnery, reloading, target destruction and obstacle navigation.
 */
export class TrainingManager {
  constructor(scene) {
    this.scene = scene;
    this.map = scene.mapBuilder;
    this.finished = false;
    this.time = 0;
    this.index = 0;
    this.completed = [];
    this.checkpointsVisited = 0;
    this.checkpointsTotal = 3;
    this.targets = [];
    this.checkpoints = [];
    this.supplyTimer = 18;
    this.auditTimer = 0;

    scene.events.once('shutdown', () => {
      this.targets = [];
      this.checkpoints = [];
    });

    this._spawnRange();
    this._announceDrill();
  }

  _spawnRange() {
    const p = this.scene.player;
    const spots = [
      this.map.findOpenPoint(p.x + 620, p.y - 220, 180, 60, 30),
      this.map.findOpenPoint(p.x + 760, p.y + 120, 180, 60, 30),
      this.map.findOpenPoint(p.x + 880, p.y - 60, 180, 60, 30),
    ];
    for (const spot of spots) {
      const target = this.scene.combat.spawnTrainingTarget(spot.x, spot.y);
      this.targets.push(target);
    }

    const checkpointAngles = [0.25, 1.25, 2.35];
    for (const angle of checkpointAngles) {
      const cx = p.x + Math.cos(angle) * 520;
      const cy = p.y + Math.sin(angle) * 520;
      const spot = this.map.findOpenPoint(cx, cy, 150, 60, 30);
      this.checkpoints.push(this.scene.combat.addCheckpoint(spot.x, spot.y));
    }
  }

  _announceDrill() {
    const drill = TRAINING_DRILLS[this.index];
    if (!drill) return;
    this.scene.game.events.emit('hud:notify', {
      text: `DRILL ${this.index + 1}/${TRAINING_DRILLS.length} — ${drill.name}`,
      kind: 'good',
    });
  }

  onCheckpoint(checkpoint) {
    if (!checkpoint?.active || checkpoint.getData('visited')) return;
    checkpoint.setData('visited', true);
    this.checkpointsVisited += 1;
    checkpoint.setAlpha(0.25);
    checkpoint.setTint(0x7c9a5c);
    this.scene.effects.dust(checkpoint.x, checkpoint.y);
    this.scene.audio.pickup('ammo');
    this.scene.game.events.emit('hud:notify', {
      text: `CHECKPOINT ${this.checkpointsVisited}/${this.checkpointsTotal} CLEARED`,
      kind: 'good',
    });
  }

  update(dt) {
    if (this.finished) return;
    this.time += dt;
    this.auditTimer -= dt;
    this.supplyTimer -= dt;

    if (this.supplyTimer <= 0) {
      this.supplyTimer = 22;
      const p = this.scene.player;
      if (p && p.alive) {
        const spot = this.map.findOpenPoint(p.x + Phaser.Math.Between(-160, 160), p.y + Phaser.Math.Between(-160, 160), 120, 40, 20);
        this.scene.combat.spawnPickup(spot.x, spot.y, p.health / p.maxHealth < 0.7 ? 'health' : 'ammo');
      }
    }

    if (this.auditTimer > 0) return;
    this.auditTimer = 0.15;

    const drill = TRAINING_DRILLS[this.index];
    if (!drill) return;

    if (this._drillComplete(drill.id)) {
      this.completed.push(drill.id);
      this.scene.game.events.emit('hud:notify', {
        text: `DRILL COMPLETE — ${drill.name}`,
        kind: 'good',
      });
      this.scene.audio.ui('click');
      this.index += 1;
      this.auditTimer = 1.1;

      if (this.index >= TRAINING_DRILLS.length) {
        this.finished = true;
        this.scene.time.delayedCall(1200, () => {
          this.scene.finishRun(true, this.buildResults());
        });
      } else {
        this._announceDrill();
      }
    }
  }

  _drillComplete(id) {
    const p = this.scene.player;
    if (!p) return false;
    switch (id) {
      case 'drive':
        return p.distanceTravelled >= 250;
      case 'rotate':
        return p.rotationAccum >= TAU;
      case 'fire':
        return p.shotsFired >= 5;
      case 'reload':
        return p.reloadsCompleted >= 1;
      case 'destroy':
        return p.kills >= 3;
      case 'navigate':
        return this.checkpointsVisited >= this.checkpointsTotal;
      default:
        return false;
    }
  }

  _drillProgress(id) {
    const p = this.scene.player;
    if (!p) return '';
    switch (id) {
      case 'drive':
        return `${Math.min(250, Math.round(p.distanceTravelled))}/250 M`;
      case 'rotate':
        return `${Math.min(360, Math.round((p.rotationAccum / TAU) * 360))}/360 DEG`;
      case 'fire':
        return `${Math.min(5, p.shotsFired)}/5 SHELLS`;
      case 'reload':
        return `${Math.min(1, p.reloadsCompleted)}/1 RELOAD`;
      case 'destroy':
        return `${Math.min(3, p.kills)}/3 TARGETS`;
      case 'navigate':
        return `${this.checkpointsVisited}/${this.checkpointsTotal} CHECKPOINTS`;
      default:
        return '';
    }
  }

  onPlayerDeath() {
    if (this.finished) return;
    this.finished = true;
    this.scene.finishRun(false, this.buildResults(false, 'TANK DESTROYED ON RANGE'));
  }

  buildResults(victory = true, reason = '') {
    const stats = this.scene.getRunStats();
    return {
      victory,
      mode: 'training',
      title: victory ? 'CREW CERTIFIED' : 'RANGE FAILED',
      subtitle: victory ? 'LIVE-FIRE RANGE // ALL DRILLS COMPLETE' : 'LIVE-FIRE RANGE // DRILL ABORTED',
      reason,
      mapId: this.map.def.id,
      mapName: this.map.def.name,
      stats: { ...stats, stars: victory ? 3 : 0 },
      objectives: victory
        ? TRAINING_DRILLS.map((d) => `${d.name} — COMPLETE`)
        : [
            `${this.completed.length}/${TRAINING_DRILLS.length} DRILLS COMPLETE`,
            ...TRAINING_DRILLS.slice(0, this.completed.length).map((d) => `${d.name} — COMPLETE`),
          ],
      credits: victory ? 80 + this.completed.length * 30 : this.completed.length * 15,
      weaponReward: null,
      nextMissionId: null,
      drills: [...this.completed],
    };
  }

  getHudState() {
    const drill = TRAINING_DRILLS[this.index];
    if (!drill) {
      return { label: 'TRAINING // COMPLETE', name: 'RANGE QUALIFIED', progress: 'RETURNING TO DIVISION' };
    }
    return {
      label: `TRAINING DRILL ${this.index + 1}/${TRAINING_DRILLS.length}`,
      name: drill.name,
      progress: `${drill.hint} • ${this._drillProgress(drill.id)}`,
    };
  }
}
