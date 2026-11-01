import Phaser from 'phaser';
import { Tank } from './Tank.js';
import { angleTo, clamp, damp, distance, rotateToward, shortestAngle } from '../core/Utils.js';
import { getEnemyRuntime } from '../config/enemies.js';

/**
 * Hostile armored vehicle.
 *
 * AI is a compact state machine: idle → patrol → alert → attack, with pursue,
 * reposition, retreat and unstick fallbacks. Line of sight is sampled against
 * the map obstacle list; obstacles also block movement and trigger steering.
 * Boss armor adds a three-phase attack pattern with escorts and rocket volleys.
 */
export class EnemyTank extends Tank {
  constructor(scene, x, y, type, options = {}) {
    const cfg = getEnemyRuntime(type, options.scale || 1);
    const isBoss = type === 'boss';
    super(scene, x, y, cfg.hull, cfg.turret, {
      maxHealth: options.hp ?? cfg.hp,
      maxArmor: cfg.armor,
      maxSpeed: cfg.speed,
      reverseSpeed: cfg.reverseSpeed,
      accel: cfg.accel,
      rotSpeed: cfg.rotSpeed,
      turretSpeed: isBoss ? 1.5 : cfg.id === 'heavy' ? 1.7 : cfg.id === 'scout' ? 2.4 : 2.0,
      bodyRadius: cfg.bodyRadius,
      displayName: cfg.name,
      type,
      isBoss,
    });

    this.cfg = cfg;
    this.enemyType = type;
    this.callSign = cfg.callSign;
    this.scoreValue = cfg.score;
    this.options = options;
    this.trainingTarget = Boolean(options.trainingTarget);
    this.passive = Boolean(options.passive) || this.trainingTarget;
    this.noDrops = Boolean(options.noDrops);

    if (this.trainingTarget) {
      this.maxHealth = options.hp || 45;
      this.health = this.maxHealth;
      this.setTint(0xd9a46a);
    }

    this.state = this.passive ? 'passive' : 'idle';
    this.stateTime = 0.8 + Math.random() * 0.9;
    this.hasLOS = false;
    this.losTimer = Math.random() * 0.18;
    this.lastSeenAt = -99;
    this.lastKnown = { x, y };
    this.alerted = false;

    this.fireCooldown = 1.1 + Math.random() * (cfg.fireDelay / 1000);
    this.burstLeft = 0;
    this.burstTimer = 0;
    this.strafeSign = Math.random() < 0.5 ? -1 : 1;
    this.strafeTimer = 0;
    this.repositionTimer = 0;
    this.repositionPoint = null;
    this.retreatTimer = 0;
    this.avoidTimer = 0;

    this.patrolAnchor = { x, y };
    this.patrolPoint = null;
    this.patrolWait = 0;

    this.lastStuckPos = new Phaser.Math.Vector2(x, y);
    this.stuckTimer = 0;
    this.unstuckTimer = 0;
    this.unstuckDir = 1;
    this.moveIntent = false;

    this.bossPhase = 1;
    this.bossSummonTimer = 6;
    this.bossVolleyTimer = 2;
    this.bossChargeTimer = 12;
    this.bossCharge = 0;
    this.deathStarted = false;

    this.speed = 0;
    this.setAlpha(0);
    scene.tweens.add({ targets: this, alpha: 1, duration: 280, ease: 'Quad.easeOut' });
    for (let i = 0; i < 3; i++) {
      scene.time.delayedCall(i * 90, () => {
        if (scene.effects) scene.effects.dust(this.x + Phaser.Math.Between(-30, 30), this.y + Phaser.Math.Between(-24, 24));
      });
    }

    if (isBoss) {
      scene.game.events.emit('hud:notify', { text: 'WARNING — WARLORD PROTOTYPE DETECTED', kind: 'danger' });
      scene.audio.bossWarning();
    }
  }

  /* ------------------------------------------------------------------ */
  /* Main update                                                         */
  /* ------------------------------------------------------------------ */

  update(dt) {
    if (!this.alive || this.deathStarted) return;
    dt = Math.min(dt, 0.05);

    this.updateDamageState(dt);
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    this.burstTimer = Math.max(0, this.burstTimer - dt);
    this.avoidTimer = Math.max(0, this.avoidTimer - dt);
    if (this.isBoss) this._updateBossPhase(dt);

    if (this.passive) {
      this.updateVisuals();
      return;
    }

    const player = this.scene.player;
    if (!player || !player.alive) {
      this._idleOrPatrol(dt);
      this.updateVisuals();
      return;
    }

    if (this.isBoss) this._updateBossAbilities(dt, player);

    this._sampleAwareness(dt, player);
    this._updateState(dt, player);

    if (this.burstLeft > 0 && this.burstTimer <= 0 && this.hasLOS) {
      const aligned = this._aimAt(player, dt, false);
      if (aligned) {
        this._shoot();
        this.burstLeft -= 1;
        this.burstTimer = 0.15;
      }
    }

    this.updateVisuals();
  }

  _sampleAwareness(dt, player) {
    this.losTimer -= dt;
    if (this.losTimer > 0) return;
    this.losTimer = 0.2 + Math.random() * 0.08;

    const dist = distance(this.x, this.y, player.x, player.y);
    const canSee = dist <= this.cfg.detectRange && this.scene.mapBuilder.hasLineOfSight(this.x, this.y, player.x, player.y);
    this.hasLOS = canSee;
    if (canSee) {
      this.lastKnown.x = player.x;
      this.lastKnown.y = player.y;
      this.lastSeenAt = this.scene.time.now / 1000;
      if (!this.alerted) {
        this.alerted = true;
        if (this.state === 'idle' || this.state === 'patrol') {
          this._setState('alert', 0.28 + Math.random() * 0.25);
          this.setTint(0xe3c08a);
          this.scene.time.delayedCall(160, () => {
            if (this.alive) this.clearTint();
          });
        }
      }
    }
  }

  _setState(next, time = 0) {
    this.state = next;
    this.stateTime = time;
    if (next === 'attack') this.alerted = true;
  }

  _updateState(dt, player) {
    const dist = distance(this.x, this.y, player.x, player.y);
    this.stateTime -= dt;

    switch (this.state) {
      case 'idle':
        this.speed = damp(this.speed, 0, 5, dt);
        this.body.setVelocity(0, 0);
        this.updateTurretAim(angleTo(this.x, this.y, player.x, player.y), dt * 0.5);
        if (this.stateTime <= 0) this._setState('patrol');
        if (this.hasLOS) this._setState('alert', 0.3);
        break;

      case 'patrol':
        this._patrol(dt);
        if (dist < this.cfg.detectRange * 0.82 && this.hasLOS) this._setState('alert', 0.3);
        break;

      case 'alert':
        this.body.setVelocity(0, 0);
        this.speed = damp(this.speed, 0, 8, dt);
        this._aimAt(player, dt);
        if (this.stateTime <= 0) this._setState(this.hasLOS ? 'attack' : 'pursue', 5);
        break;

      case 'attack':
        this._attack(dt, player, dist);
        break;

      case 'pursue':
        this._moveTo(this.lastKnown.x, this.lastKnown.y, dt, 0.9);
        this._aimAt(player, dt);
        if (this.hasLOS) this._setState('attack');
        else if (distance(this.x, this.y, this.lastKnown.x, this.lastKnown.y) < 80) {
          this._beginReposition(player);
        } else if (this.stateTime <= 0) {
          this.lastKnown.x = player.x;
          this.lastKnown.y = player.y;
          this._setState('patrol');
        }
        break;

      case 'reposition':
        this._repositionTimer -= dt;
        this.repositionTimer -= dt;
        if (this.repositionPoint) this._moveTo(this.repositionPoint.x, this.repositionPoint.y, dt, 0.72);
        else this._moveTo(player.x, player.y, dt, 0.6);
        this._aimAt(player, dt);
        if (this.hasLOS && this.stateTime <= 0) this._setState('attack');
        else if (this.repositionTimer <= 0) this._setState(this.hasLOS ? 'attack' : 'patrol');
        break;

      case 'retreat':
        this.retreatTimer -= dt;
        {
          const away = angleTo(player.x, player.y, this.x, this.y);
          this._moveTo(this.x + Math.cos(away) * 320, this.y + Math.sin(away) * 320, dt, 1);
        }
        this._aimAt(player, dt);
        if (this.retreatTimer <= 0) this._setState(this.hasLOS ? 'attack' : 'pursue', 3.5);
        break;

      default:
        this._setState('patrol');
    }
  }

  _attack(dt, player, dist) {
    const preferred = this.cfg.preferredRange;
    const range = this.cfg.range;

    if (!this.hasLOS) {
      if (dist < 240) {
        this._beginRetreat(player, 1.6);
      } else {
        this._setState('pursue', 5);
      }
      return;
    }

    this.lastKnown.x = player.x;
    this.lastKnown.y = player.y;

    if (this.cfg.id !== 'boss' && this.health / this.maxHealth < 0.26 && Math.random() < 0.012) {
      this._beginRetreat(player, 2.6);
      return;
    }

    if (dist > range * 0.94) {
      this._moveTo(player.x, player.y, dt, 1);
    } else if (dist < preferred * 0.56) {
      const away = angleTo(player.x, player.y, this.x, this.y);
      this._moveTo(this.x + Math.cos(away) * 200, this.y + Math.sin(away) * 200, dt, 0.95);
    } else {
      this.strafeTimer -= dt;
      if (this.strafeTimer <= 0) {
        this.strafeTimer = 1.8 + Math.random() * 1.6;
        this.strafeSign *= Math.random() < 0.32 ? -1 : 1;
      }
      const perp = angleTo(player.x, player.y, this.x, this.y) + (Math.PI / 2) * this.strafeSign;
      const sx = this.x + Math.cos(perp) * 180;
      const sy = this.y + Math.sin(perp) * 180;
      if (!this.scene.mapBuilder.isPointBlocked(sx, sy, 34)) this._moveTo(sx, sy, dt, 0.58);
      else this.body.setVelocity(0, 0);
    }

    const aligned = this._aimAt(player, dt);
    this._tryFire(aligned, player, dist);
  }

  _patrol(dt) {
    if (this.patrolWait > 0) {
      this.patrolWait -= dt;
      this.speed = damp(this.speed, 0, 5, dt);
      this.body.setVelocity(0, 0);
      return;
    }

    if (!this.patrolPoint) {
      const radius = this.cfg.id === 'heavy' || this.cfg.id === 'boss' ? 220 : 380;
      const point = this.scene.mapBuilder.findOpenPoint(
        this.patrolAnchor.x,
        this.patrolAnchor.y,
        radius,
        38,
        24
      );
      this.patrolPoint = point;
    }

    const reached = distance(this.x, this.y, this.patrolPoint.x, this.patrolPoint.y) < 70;
    if (reached) {
      this.patrolPoint = null;
      this.patrolWait = 1.5 + Math.random() * 3.2;
      return;
    }
    this._moveTo(this.patrolPoint.x, this.patrolPoint.y, dt, 0.5);
    this.updateTurretAim(this.rotation, dt);
  }

  _idleOrPatrol(dt) {
    if (this.state !== 'patrol') this._setState('patrol');
    this._patrol(dt);
  }

  _beginRetreat(player, seconds) {
    this.retreatTimer = seconds;
    this._setState('retreat', seconds);
    const away = angleTo(player.x, player.y, this.x, this.y);
    this.patrolPoint = {
      x: clamp(this.x + Math.cos(away) * 330, 80, this.scene.mapDef.width - 80),
      y: clamp(this.y + Math.sin(away) * 330, 80, this.scene.mapDef.height - 80),
    };
  }

  _beginReposition(player) {
    const side = Math.random() < 0.5 ? -1 : 1;
    const base = angleTo(player.x, player.y, this.x, this.y);
    const angle = base + side * (0.7 + Math.random() * 0.7);
    const radius = this.cfg.preferredRange * (0.85 + Math.random() * 0.3);
    const point = this.scene.mapBuilder.findOpenPoint(
      player.x + Math.cos(angle) * radius,
      player.y + Math.sin(angle) * radius,
      250,
      38,
      18
    );
    this.repositionPoint = point;
    this.repositionTimer = 3.2;
    this._repositionTimer = 3.2;
    this._setState('reposition', 1.2 + Math.random() * 1.5);
  }

  /* ------------------------------------------------------------------ */
  /* Movement                                                            */
  /* ------------------------------------------------------------------ */

  _moveTo(tx, ty, dt, speedMult = 1) {
    this.moveIntent = true;

    if (this.unstuckTimer > 0) {
      this._unstick(dt);
      return;
    }

    const desired = angleTo(this.x, this.y, tx, ty);
    let steer = desired;
    const look = 48 + Math.abs(this.speed) * 0.16;

    const aheadBlocked = this.scene.mapBuilder.isPointBlocked(
      this.x + Math.cos(desired) * look,
      this.y + Math.sin(desired) * look,
      this.cfg.bodyRadius * 0.8
    );

    if (aheadBlocked) {
      let found = false;
      for (const offset of [0.5, -0.5, 0.95, -0.95, 1.45, -1.45, 2.0, -2.0]) {
        const a = desired + offset;
        if (!this.scene.mapBuilder.isPointBlocked(
          this.x + Math.cos(a) * look,
          this.y + Math.sin(a) * look,
          this.cfg.bodyRadius * 0.8
        )) {
          steer = a;
          found = true;
          break;
        }
      }
      if (!found) {
        this._reverseTurn(dt);
        return;
      }
    }

    const diff = shortestAngle(this.rotation, steer);
    this.rotation = rotateToward(this.rotation, steer, this.rotSpeed * dt, 0.01);
    const aligned = Math.abs(shortestAngle(this.rotation, steer)) < 0.85;
    const throttle = aligned ? 1 : 0.18;
    const targetSpeed = this.maxSpeed * speedMult * throttle;
    this.speed = damp(this.speed, targetSpeed, 3.2, dt);

    this.body.setVelocity(Math.cos(this.rotation) * this.speed, Math.sin(this.rotation) * this.speed);
    this._checkStuck(dt);
  }

  _reverseTurn(dt) {
    this.speed = damp(this.speed, -this.reverseSpeed * 0.7, 5, dt);
    this.rotation += this.unstuckDir * this.rotSpeed * 1.1 * dt;
    this.body.setVelocity(Math.cos(this.rotation) * this.speed, Math.sin(this.rotation) * this.speed);
    this._checkStuck(dt);
  }

  _unstick(dt) {
    this.unstuckTimer -= dt;
    this.speed = damp(this.speed, -this.reverseSpeed * 0.95, 6, dt);
    this.rotation += this.unstuckDir * this.rotSpeed * 1.35 * dt;
    this.body.setVelocity(Math.cos(this.rotation) * this.speed, Math.sin(this.rotation) * this.speed);
    if (this.unstuckTimer <= 0) {
      this.lastStuckPos.set(this.x, this.y);
      this.stuckTimer = 0;
    }
  }

  _checkStuck(dt) {
    this.stuckTimer += dt;
    if (this.stuckTimer < 1.1) return;
    const moved = distance(this.lastStuckPos.x, this.lastStuckPos.y, this.x, this.y);
    if (this.moveIntent && moved < 14 && Math.abs(this.speed) > 18) {
      this.unstuckTimer = 0.8 + Math.random() * 0.5;
      this.unstuckDir = Math.random() < 0.5 ? -1 : 1;
    }
    this.lastStuckPos.set(this.x, this.y);
    this.stuckTimer = 0;
  }

  /* ------------------------------------------------------------------ */
  /* Aim / fire                                                          */
  /* ------------------------------------------------------------------ */

  _aimAt(player, dt, lead = true) {
    let tx = player.x;
    let ty = player.y;

    if (lead && this.cfg.id !== 'heavy' && player.speed > 24) {
      const dist = distance(this.x, this.y, player.x, player.y);
      const flight = dist / this.cfg.projectileSpeed;
      tx += Math.cos(player.rotation) * player.speed * flight * (this.cfg.id === 'elite' ? 0.85 : 0.45);
      ty += Math.sin(player.rotation) * player.speed * flight * (this.cfg.id === 'elite' ? 0.85 : 0.45);
    }

    const aim = angleTo(this.x, this.y, tx, ty);
    this.updateTurretAim(aim, dt);
    return Math.abs(shortestAngle(this.turretAngle, aim)) < 0.1;
  }

  _tryFire(aligned, player, dist) {
    if (!aligned || !this.hasLOS || dist > this.cfg.range * 1.12) return;
    if (this.fireCooldown > 0) return;

    // Boss rocket saturation in the final phase.
    if (this.isBoss && this.bossPhase >= 3 && this.bossVolleyTimer <= 0) {
      this.scene.combat.fireBossVolley(this);
      this.bossVolleyTimer = 2.9;
      this.fireCooldown = 1.35;
      return;
    }

    this._shoot();
    this.fireCooldown = (this.cfg.fireDelay / 1000) * (0.82 + Math.random() * 0.36);
    if (this.cfg.burst > 1 && this.cfg.id !== 'boss') {
      this.burstLeft = this.cfg.burst - 1;
      this.burstTimer = 0.16;
    }
  }

  _shoot() {
    if (!this.alive) return;
    this.scene.combat.fireEnemyShell(this);
    const muzzle = this.getMuzzlePosition(this.turretAngle);
    this.scene.effects.muzzleFlash(muzzle.x, muzzle.y, this.turretAngle, this.isBoss ? 1.3 : 0.82);
    const sound = this.cfg.id === 'heavy' || this.cfg.id === 'boss' ? 'heavy' : this.cfg.id === 'elite' ? 'rapid' : 'standard';
    this.scene.audio.fire(sound, true);
  }

  /* ------------------------------------------------------------------ */
  /* Boss phases                                                         */
  /* ------------------------------------------------------------------ */

  _updateBossPhase(dt) {
    const ratio = this.health / this.maxHealth;
    const targetPhase = ratio > 0.66 ? 1 : ratio > 0.33 ? 2 : 3;
    if (targetPhase <= this.bossPhase) return;

    this.bossPhase = targetPhase;
    this.scene.effects.explosion(this.x + Phaser.Math.Between(-30, 30), this.y + Phaser.Math.Between(-20, 20), 1.5);
    this.scene.audio.bossWarning();
    this.scene.game.events.emit('hud:notify', {
      text: `WARLORD PHASE ${targetPhase} — ARMOR FAILING`,
      kind: 'danger',
    });

    if (targetPhase === 2) {
      this.bossSummonTimer = 2.5;
      this.bossChargeTimer = 5;
      this.bossVolleyTimer = 4;
    }
    if (targetPhase === 3) {
      this.bossVolleyTimer = 1.4;
      this.fireCooldown = 1.2;
      this.scene.game.events.emit('hud:notify', {
        text: 'WARLORD LAUNCHING ROCKET SATURATION',
        kind: 'danger',
      });
    }
  }

  _updateBossAbilities(dt, player) {
    this.bossVolleyTimer -= dt;

    if (this.bossPhase >= 2) {
      this.bossSummonTimer -= dt;
      if (this.bossSummonTimer <= 0) {
        this.bossSummonTimer = 15;
        this.scene.combat.spawnBossEscorts(this);
        this.scene.game.events.emit('hud:notify', {
          text: 'WARLORD DEPLOYED SCOUT DRONES',
          kind: 'warn',
        });
      }

      this.bossChargeTimer -= dt;
      if (this.bossChargeTimer <= 0) {
        this.bossChargeTimer = 16;
        this.bossCharge = 2.2;
      }
      this.bossCharge = Math.max(0, this.bossCharge - dt);
    }

    if (this.bossCharge > 0) {
      this._moveTo(player.x, player.y, dt, 1.55);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Damage / death                                                      */
  /* ------------------------------------------------------------------ */

  takeDamage(rawDamage) {
    if (!this.alive || this.deathStarted) return { absorbed: 0, hullDamage: 0 };
    const result = this.applyIncomingDamage(rawDamage);
    this.flashDamage();

    if (this.state === 'idle' || this.state === 'patrol') {
      this._setState('alert', 0.2);
      this.lastKnown.x = this.scene.player?.x ?? this.x;
      this.lastKnown.y = this.scene.player?.y ?? this.y;
    }

    return result;
  }

  kill() {
    if (this.deathStarted) return;
    this.deathStarted = true;
    this.alive = false;
    this.body.stop();
    this.body.enable = false;

    const isBoss = this.isBoss;
    const x = this.x;
    const y = this.y;
    const angle = this.rotation;

    if (isBoss) {
      this.scene.effects.bossDeathSequence(x, y, () => {
        this.scene.add.image(x, y, 'wreck').setRotation(angle).setDepth(y - 2).setScale(2.1).setAlpha(0.9);
        this.disposeVisuals();
        this.setVisible(false);
        this.scene.events.emit('enemy:killed', this._killPayload());
      });
      this.turret.setVisible(false);
      this.setVisible(false);
      this.shadow.setVisible(false);
      return;
    }

    this.scene.effects.tankDestroyed(x, y, false);
    this.scene.add
      .image(x, y, 'wreck')
      .setRotation(angle)
      .setDepth(y - 2)
      .setScale(this.cfg.scale || 1)
      .setAlpha(0.88);
    this.disposeVisuals();
    this.setVisible(false);
    this.scene.events.emit('enemy:killed', this._killPayload());
  }

  _killPayload() {
    return {
      type: this.enemyType,
      callSign: this.callSign,
      score: this.scoreValue,
      isBoss: this.isBoss,
      trainingTarget: this.trainingTarget,
      x: this.x,
      y: this.y,
    };
  }

  getBossHudState() {
    return {
      name: this.cfg.name,
      phase: this.bossPhase,
      health: this.health,
      maxHealth: this.maxHealth,
    };
  }
}
