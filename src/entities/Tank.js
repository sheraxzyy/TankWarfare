import Phaser from 'phaser';
import { rotateToward, shortestAngle } from '../core/Utils.js';

/**
 * Shared tank base: hull physics body, separately rotating turret, shadow,
 * health/armor model and destruction scaffolding.
 */
export class Tank extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, hullTexture, turretTexture, config = {}) {
    super(scene, x, y, hullTexture);
    this.scene = scene;

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.hullTexture = hullTexture;
    this.turretTexture = turretTexture;
    this.isBoss = Boolean(config.isBoss);
    this.displayName = config.displayName || 'TANK';
    this.type = config.type || 'tank';

    this.maxHealth = config.maxHealth || 100;
    this.health = this.maxHealth;
    this.maxArmor = config.maxArmor || 0;
    this.armor = this.maxArmor;
    this.alive = true;
    this.armorRegen = config.armorRegen ?? 0;
    this.lastDamageAt = -99;

    this.turretAngle = this.rotation;
    this.turretSpeed = config.turretSpeed || 2.6;
    this.flashTimer = 0;
    this.smokeTimer = 0;
    this.dustTimer = 0;
    this.trackDistance = 0;
    this.rotationAccum = 0;
    this.speed = 0;
    this.maxSpeed = config.maxSpeed || 160;
    this.reverseSpeed = config.reverseSpeed || 90;
    this.accel = config.accel || 220;
    this.rotSpeed = config.rotSpeed || 1.8;

    this.setOrigin(0.5, 0.5);
    this.setDepth(y);
    this.body.setCircle(
      config.bodyRadius || 27,
      this.width / 2 - (config.bodyRadius || 27),
      this.height / 2 - (config.bodyRadius || 27)
    );
    this.body.setCollideWorldBounds(true);
    this.body.setBounce(0.05, 0.05);
    this.body.setMaxVelocity(400, 400);

    const shadowScale = this.width / 150;
    this.shadow = scene.add
      .image(x + 5, y + 9, 'shadow_tank')
      .setDepth(y - 3)
      .setAlpha(0.65)
      .setScale(shadowScale, shadowScale);
    this.shadow.setRotation(this.rotation);

    this.turret = scene.add
      .image(x, y, turretTexture)
      .setOrigin(0.5, 0.5)
      .setDepth(y + 0.6);
    this.turret.setRotation(this.turretAngle);
    this.turretWidth = this.turret.width;
    this.muzzleDistance = this.turretWidth * 0.46;
  }

  get reloading() {
    return this.reloadRemaining > 0;
  }

  getMuzzlePosition(angle = this.turretAngle) {
    const dist = this.muzzleDistance;
    return {
      x: this.x + Math.cos(angle) * dist,
      y: this.y + Math.sin(angle) * dist,
    };
  }

  /** Returns raw damage split into armor absorption and hull damage. */
  applyIncomingDamage(rawDamage) {
    let remaining = rawDamage;
    let absorbed = 0;
    if (this.armor > 0) {
      absorbed = Math.min(this.armor, rawDamage * 0.65);
      this.armor = Math.max(0, this.armor - absorbed);
      remaining = rawDamage - absorbed;
    }
    this.health = Math.max(0, this.health - remaining);
    this.lastDamageAt = this.scene.time.now / 1000;
    return { absorbed, hullDamage: remaining };
  }

  updateVisuals() {
    this.setDepth(this.y);
    this.shadow.setPosition(this.x + 5, this.y + 9);
    this.shadow.setRotation(this.rotation);
    this.shadow.setDepth(this.y - 3);
    this.turret.setPosition(this.x, this.y);
    this.turret.setRotation(this.turretAngle);
    this.turret.setDepth(this.y + 0.6);
  }

  updateTurretAim(targetAngle, dt) {
    this.turretAngle = rotateToward(this.turretAngle, targetAngle, this.turretSpeed * dt, 0.005);
  }

  updateDamageState(dt) {
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) this.clearTint();
    }

    if (this.armorRegen > 0 && this.alive) {
      const idle = this.scene.time.now / 1000 - this.lastDamageAt;
      if (idle > 6 && this.armor < this.maxArmor) {
        this.armor = Math.min(this.maxArmor, this.armor + this.armorRegen * dt);
      }
    }

    // Damage smoke when badly hurt.
    if (this.alive && this.health / this.maxHealth < 0.42) {
      this.smokeTimer -= dt;
      if (this.smokeTimer <= 0) {
        this.smokeTimer = 0.16 + Math.random() * 0.2;
        this.scene.effects.tankDamageSmoke(this.x + Phaser.Math.Between(-10, 10), this.y - 4);
      }
    }
  }

  flashDamage() {
    this.setTint(0xff8a72);
    this.flashTimer = 0.1;
  }

  disposeVisuals() {
    if (this.shadow) this.shadow.destroy();
    if (this.turret) this.turret.destroy();
    this.shadow = null;
    this.turret = null;
  }
}
