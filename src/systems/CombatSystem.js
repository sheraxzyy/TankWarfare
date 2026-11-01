import Phaser from 'phaser';
import { Projectile } from '../entities/Projectile.js';
import { Pickup } from '../entities/Pickup.js';
import { EnemyTank } from '../entities/EnemyTank.js';
import { getWeaponRuntime, SPECIAL_ORDNANCE } from '../config/weapons.js';

const PROJECTILE_TEXTURES = {
  shell: 'projectile_shell',
  heavy_shell: 'projectile_heavy_shell',
  tracer: 'projectile_tracer',
  rocket: 'projectile_rocket',
};

const METAL_RX = /building|warehouse|container|wreck|silo|pipe|truck|base|outpost|bunker|tower|radar|barrel|wall/i;

/**
 * Central combat pipeline.
 * Owns pooled projectile groups, all collision handlers, damage/splash math,
 * pickups, destructible objectives and enemy spawning.
 */
export class CombatSystem {
  constructor(scene, { mapBuilder, effects, audio, save }) {
    this.scene = scene;
    this.map = mapBuilder;
    this.effects = effects;
    this.audio = audio;
    this.save = save;
    this.player = null;
    this.boss = null;
    this.killCount = 0;
    this.damageDealt = 0;
    this.ramCooldown = 0;

    this.enemies = scene.physics.add.group();
    this.playerShots = scene.physics.add.group({ classType: Projectile, maxSize: 140, runChildUpdate: true });
    this.enemyShots = scene.physics.add.group({ classType: Projectile, maxSize: 220, runChildUpdate: true });
    this.pickups = scene.physics.add.group({ classType: Pickup, maxSize: 30, runChildUpdate: true });
    this.checkpoints = scene.physics.add.staticGroup();

    scene.physics.add.collider(this.enemies, this.map.obstacleGroup);
    scene.physics.add.collider(this.enemies, this.enemies);

    scene.physics.add.collider(this.playerShots, this.map.obstacleGroup, (shot, obstacle) => {
      this._onProjectileObstacle(shot, obstacle);
    });
    scene.physics.add.collider(this.enemyShots, this.map.obstacleGroup, (shot, obstacle) => {
      this._onProjectileObstacle(shot, obstacle);
    });

    scene.physics.add.overlap(this.playerShots, this.enemies, (shot, enemy) => {
      this._onProjectileEnemy(shot, enemy);
    });
  }

  attachPlayer(player) {
    this.player = player;
    this.scene.physics.add.collider(player, this.map.obstacleGroup);
    this.scene.physics.add.collider(player, this.enemies, () => this._onRam());
    this.scene.physics.add.overlap(player, this.enemyShots, (p, shot) => {
      this._onProjectilePlayer(shot);
    });
    this.scene.physics.add.overlap(player, this.pickups, (p, pickup) => {
      this.collectPickup(pickup);
    });
    this.scene.physics.add.overlap(player, this.checkpoints, (p, checkpoint) => {
      this.scene.manager?.onCheckpoint?.(checkpoint);
    });
  }

  /* ------------------------------------------------------------------ */
  /* Spawning                                                            */
  /* ------------------------------------------------------------------ */

  spawnEnemy(type, x, y, options = {}) {
    const spot = this.map.isPointBlocked(x, y, 32) ? this.map.findSpawnNear(x, y, 180) : { x, y };
    const enemy = new EnemyTank(this.scene, spot.x, spot.y, type, options);
    enemy.rotation = Math.random() * Math.PI * 2;
    enemy.turretAngle = enemy.rotation;
    this.enemies.add(enemy);
    if (enemy.isBoss) this.boss = enemy;
    return enemy;
  }

  spawnBossEscorts(boss) {
    const count = boss.bossPhase >= 3 ? 2 : 1;
    for (let i = 0; i < count; i++) {
      const spot = this.map.findSpawnNear(
        boss.x + Phaser.Math.Between(-260, 260),
        boss.y + Phaser.Math.Between(-220, 220),
        220
      );
      this.spawnEnemy('scout', spot.x, spot.y, {
        scale: this.scene.enemyScale || 1,
        noDrops: false,
      });
      this.effects.explosion(spot.x, spot.y, 0.45);
    }
  }

  spawnTrainingTarget(x, y) {
    return this.spawnEnemy('scout', x, y, {
      trainingTarget: true,
      hp: 46,
      passive: true,
      noDrops: true,
    });
  }

  spawnPickup(x, y, type = 'ammo') {
    if (this.pickups.countActive(true) >= 24) return null;
    const pickup = this.pickups.get(x, y, 'pickup_ammo');
    if (!pickup) return null;
    pickup.spawn(x, y, type);
    return pickup;
  }

  addCheckpoint(x, y) {
    const checkpoint = this.checkpoints.create(x, y, 'checkpoint');
    checkpoint.setDepth(y - 5).setAlpha(0.8).setScale(0.72);
    checkpoint.refreshBody();
    checkpoint.setData('visited', false);
    checkpoint.setData('baseScale', 0.72);
    this.scene.tweens.add({
      targets: checkpoint,
      alpha: { from: 0.8, to: 0.42 },
      duration: 850,
      yoyo: true,
      repeat: -1,
    });
    return checkpoint;
  }

  /* ------------------------------------------------------------------ */
  /* Player weapons                                                      */
  /* ------------------------------------------------------------------ */

  firePlayerShell(player, weaponId, { x, y, angle }) {
    const weapon = getWeaponRuntime(weaponId, player.upgrades);
    const projectile = this.playerShots.get(x, y);
    if (!projectile) return null;
    return projectile.fire({
      x,
      y,
      angle,
      speed: weapon.speed,
      damage: weapon.damage,
      owner: 'player',
      weaponId,
      splashRadius: weapon.splashRadius,
      life: 2.7,
      texture: PROJECTILE_TEXTURES[weapon.projectile] || 'projectile_shell',
    });
  }

  fireSpecialShell(player, { x, y, angle }) {
    const projectile = this.playerShots.get(x, y);
    if (!projectile) return null;
    return projectile.fire({
      x,
      y,
      angle,
      speed: SPECIAL_ORDNANCE.speed,
      damage: SPECIAL_ORDNANCE.damage,
      owner: 'player',
      weaponId: 'barrage',
      splashRadius: SPECIAL_ORDNANCE.splashRadius,
      life: 2.6,
      texture: 'projectile_heavy_shell',
      tint: 0xffd08a,
    });
  }

  fireEnemyShell(enemy) {
    const cfg = enemy.cfg;
    const texture = enemy.isBoss ? 'projectile_boss_rocket' : 'projectile_enemy_shell';
    const spread = enemy.isBoss ? 0.012 : enemy.cfg.id === 'scout' ? 0.035 : 0.02;
    const angle = enemy.turretAngle + (Math.random() - 0.5) * spread * 2;
    const muzzle = enemy.getMuzzlePosition(enemy.turretAngle);
    const projectile = this.enemyShots.get(muzzle.x, muzzle.y);
    if (!projectile) return null;

    let damage = cfg.damage;
    let splash = 0;
    let tint = null;
    if (enemy.isBoss) {
      damage = Math.round(cfg.damage * (enemy.bossPhase >= 2 ? 1.15 : 1));
      splash = 46;
      tint = 0xff9a6a;
    }

    return projectile.fire({
      x: muzzle.x,
      y: muzzle.y,
      angle,
      speed: cfg.projectileSpeed,
      damage,
      owner: 'enemy',
      weaponId: enemy.isBoss ? 'boss_rocket' : cfg.id,
      splashRadius: splash,
      life: 3.4,
      texture,
      tint,
      boss: enemy.isBoss,
    });
  }

  fireBossVolley(boss) {
    const count = 5;
    for (let i = 0; i < count; i++) {
      const spread = (i - (count - 1) / 2) * 0.135;
      const angle = boss.turretAngle + spread;
      const muzzle = boss.getMuzzlePosition(angle);
      const projectile = this.enemyShots.get(muzzle.x, muzzle.y);
      if (!projectile) continue;
      projectile.fire({
        x: muzzle.x,
        y: muzzle.y,
        angle,
        speed: 430 + Math.random() * 40,
        damage: 26,
        owner: 'enemy',
        weaponId: 'boss_rocket',
        splashRadius: 88,
        life: 4.2,
        texture: 'projectile_boss_rocket',
        boss: true,
      });
    }
    this.audio.fire('rocket', true);
    this.effects.muzzleFlash(boss.x, boss.y, boss.turretAngle, 1.5);
    this.effects.cameraShake(0.004, 180);
    this.scene.game.events.emit('hud:notify', { text: 'INCOMING ROCKET SATURATION', kind: 'danger' });
  }

  /* ------------------------------------------------------------------ */
  /* Projectile collisions                                               */
  /* ------------------------------------------------------------------ */

  _onProjectileObstacle(shot, obstacle) {
    if (!shot?.active || !obstacle?.active) return;
    const record = this.map.obstacles.find((o) => o.obj === obstacle);
    const surface = METAL_RX.test(record?.type || '') ? 'metal' : 'ground';
    const x = shot.x;
    const y = shot.y;
    const splash = shot.splashRadius;
    const damage = shot.damage;
    const owner = shot.owner;
    const weaponId = shot.weaponId;
    shot.deactivate();

    this.effects.impact(x, y, shot.rotation, surface);
    this.audio.impact(surface);

    if (splash > 0) {
      this.effects.explosion(x, y, 0.7);
      this.audio.explosion(0.55);
      this.applySplash(x, y, splash, damage, owner, new Set(), weaponId);
    }

    if (record && record.alive && record.destructible) {
      const chip = splash > 0 ? damage : damage * 0.72;
      this.damageObstacle(record, chip, owner);
    }
  }

  _onProjectileEnemy(shot, enemy) {
    if (!shot?.active || !enemy?.alive) return;
    const x = shot.x;
    const y = shot.y;
    const splash = shot.splashRadius;
    const damage = shot.damage;
    const weaponId = shot.weaponId;
    shot.deactivate();

    const result = enemy.takeDamage(damage);
    this.effects.impact(x, y, 0, 'metal');
    this.audio.impact('metal');

    if (this.player) {
      this.scene.recordHit(result.absorbed + result.hullDamage);
      this.damageDealt += result.absorbed + result.hullDamage;
    }

    if (splash > 0) {
      this.effects.explosion(x, y, 0.75);
      this.audio.explosion(0.6);
      this.applySplash(x, y, splash, damage, 'player', new Set([enemy]), weaponId);
    }

    if (enemy.health <= 0) this.killEnemy(enemy);
  }

  _onProjectilePlayer(shot) {
    if (!shot?.active || !this.player?.alive) return;
    const splash = shot.splashRadius;
    const damage = shot.damage;
    const x = shot.x;
    const y = shot.y;
    shot.deactivate();

    if (splash > 0) {
      this.effects.explosion(x, y, 0.8);
      this.audio.explosion(0.7);
    } else {
      this.effects.impact(x, y, 0, 'metal');
    }

    this.player.takeDamage(damage, { x, y });

    if (splash > 0) {
      this.applySplash(x, y, splash, damage * 0.55, 'enemy', new Set([this.player]), 'enemy');
    }
  }

  _onRam() {
    if (!this.player?.alive) return;
    const now = this.scene.time.now;
    if (now < this.ramCooldown) return;
    this.ramCooldown = now + 700;
    this.player.takeDamage(7);
    this.effects.impact(this.player.x, this.player.y, 0, 'metal');
    this.audio.impact('metal');
  }

  /* ------------------------------------------------------------------ */
  /* Damage helpers                                                      */
  /* ------------------------------------------------------------------ */

  damageObstacle(record, damage, owner = 'player') {
    if (!record || !record.alive || !record.destructible) return false;
    const image = record.obj;
    if (!image || !image.active) return false;

    record.hp -= damage;
    image.setData('hp', Math.max(0, record.hp));
    image.setTint(0xffb27a);
    this.scene.time.delayedCall(90, () => {
      if (image.active) image.clearTint();
    });

    if (record.hp > 0) {
      this.effects.dust(image.x + Phaser.Math.Between(-20, 20), image.y + Phaser.Math.Between(-16, 16));
      return false;
    }

    this.destroyObstacle(record, owner);
    return true;
  }

  destroyObstacle(record, owner = 'player') {
    if (!record || !record.alive) return;
    record.alive = false;
    const { x, y, objTag, explosive } = record;

    this.effects.explosion(x, y, record.w > 150 ? 1.6 : 1.1);
    this.audio.explosion(1.1);
    this.map.removeObstacle(record.obj);

    if (objTag) {
      this.scene.recordObjective(objTag, x, y);
      this.scene.events.emit('objective:destroyed', { tag: objTag, x, y });
      if (owner === 'player' && this.player) {
        this.scene.addScore(250, 'OBJECTIVE');
        this.scene.game.events.emit('hud:notify', {
          text: `OBJECTIVE DESTROYED — ${objTag.toUpperCase()}`,
          kind: 'good',
        });
      }
    }

    if (explosive) {
      this.scene.time.delayedCall(120, () => {
        this.effects.explosion(x, y, 1.7);
        this.audio.explosion(1.25);
        this.effects.cameraShake(0.007, 250);
        this.applySplash(x, y, 130, 52, owner, new Set(), 'barrel');
        this._chainDestructibles(x, y, 150, owner);
      });
    }
  }

  _chainDestructibles(x, y, radius, owner) {
    for (const record of [...this.map.obstacles]) {
      if (!record.alive || !record.destructible) continue;
      if (Phaser.Math.Distance.Between(x, y, record.x, record.y) > radius + record.w * 0.3) continue;
      this.damageObstacle(record, 70, owner);
    }
  }

  applySplash(x, y, radius, damage, owner, exclude = new Set(), weaponId = '') {
    if (!radius || radius <= 0) return;

    for (const enemy of this.getAliveEnemies()) {
      if (exclude.has(enemy)) continue;
      const dist = Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y);
      if (dist > radius) continue;
      const falloff = 1 - (dist / radius) * 0.55;
      const dealt = enemy.takeDamage(damage * falloff);
      if (this.player) {
        this.scene.recordHit(dealt.absorbed + dealt.hullDamage);
        this.damageDealt += dealt.absorbed + dealt.hullDamage;
      }
      if (enemy.health <= 0) this.killEnemy(enemy);
    }

    if (owner === 'enemy' && this.player?.alive && !exclude.has(this.player)) {
      const dist = Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y);
      if (dist <= radius) {
        const falloff = 1 - (dist / radius) * 0.55;
        this.player.takeDamage(damage * 0.55 * falloff, { x, y, weaponId });
      }
    }

    // Splash also chips destructible structures and barrels.
    for (const record of [...this.map.obstacles]) {
      if (!record.alive || !record.destructible) continue;
      if (Phaser.Math.Distance.Between(x, y, record.x, record.y) > radius + record.w * 0.3) continue;
      this.damageObstacle(record, damage * 0.5, owner);
    }
  }

  killEnemy(enemy) {
    if (!enemy || enemy._combatKilled) return;
    enemy._combatKilled = true;
    const payload = {
      type: enemy.enemyType,
      callSign: enemy.callSign,
      score: enemy.scoreValue,
      isBoss: enemy.isBoss,
      trainingTarget: enemy.trainingTarget,
      x: enemy.x,
      y: enemy.y,
    };

    this.killCount += 1;
    if (this.player) this.player.kills += 1;
    this.scene.addScore(enemy.scoreValue, enemy.callSign);
    this.save?.recordKill();

    if (!enemy.noDrops && !enemy.trainingTarget && Math.random() < enemy.cfg.drops) {
      const type = this._rollDropType();
      this.timeoutDrop(enemy.x, enemy.y, type);
    }

    if (enemy.isBoss) {
      this.boss = null;
      this.scene.game.events.emit('hud:notify', {
        text: 'WARLORD PROTOTYPE DESTROYED',
        kind: 'good',
      });
    } else {
      this.scene.game.events.emit('hud:notify', {
        text: `${enemy.callSign} DESTROYED +${enemy.scoreValue}`,
        kind: 'good',
      });
    }

    this.enemies.remove(enemy, false, false);
    enemy.kill();
    this.scene.events.emit('enemy:downed', payload);
  }

  timeoutDrop(x, y, type) {
    this.scene.time.delayedCall(120, () => {
      this.spawnPickup(
        Phaser.Math.Clamp(x + Phaser.Math.Between(-22, 22), 60, this.scene.mapDef.width - 60),
        Phaser.Math.Clamp(y + Phaser.Math.Between(-18, 18), 60, this.scene.mapDef.height - 60),
        type
      );
    });
  }

  _rollDropType() {
    const healthRatio = this.player ? this.player.health / this.player.maxHealth : 1;
    const roll = Math.random();
    if (healthRatio < 0.55 && roll < 0.5) return 'health';
    if (roll < 0.2) return 'special';
    if (roll < 0.55) return 'health';
    return 'ammo';
  }

  collectPickup(pickup) {
    if (!pickup?.active || !this.player?.alive) return;
    const type = pickup.type;
    const x = pickup.x;
    const y = pickup.y;
    pickup.deactivate();

    let label = '';
    if (type === 'health') {
      const healed = this.player.heal(46);
      label = `REPAIR KIT +${Math.round(healed)} HULL`;
    } else if (type === 'special') {
      if (this.player.addSpecial()) label = 'HE BARRAGE CHARGE ACQUIRED';
      else {
        this.player.addArmor(14);
        label = 'ARMOR PLATING RESTORED';
      }
    } else {
      const added = this.player.addAmmo(0.42);
      label = `AMMUNITION +${Math.round(added)}`;
    }

    this.audio.pickup(type);
    this.effects.dust(x, y);
    this.scene.game.events.emit('hud:notify', { text: label, kind: 'good' });
  }

  /* ------------------------------------------------------------------ */
  /* Queries                                                             */
  /* ------------------------------------------------------------------ */

  getAliveEnemies() {
    return this.enemies.getChildren().filter((e) => e.active && e.alive && !e.deathStarted);
  }

  getBoss() {
    return this.boss && this.boss.alive ? this.boss : null;
  }

  update(dt) {
    for (const enemy of [...this.enemies.getChildren()]) {
      if (enemy.active && enemy.alive) enemy.update(dt, this.scene.time.now);
    }
  }
}
