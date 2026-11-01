import Phaser from 'phaser';
import { DEPTH } from '../config/constants.js';

/**
 * Pooled projectile used by both the player and the enemy AI.
 * Instances are recycled through a physics group, never created per shot after warm-up.
 */
export class Projectile extends Phaser.Physics.Arcade.Image {
  constructor(scene, x, y, texture = 'projectile_shell') {
    super(scene, x, y, texture);
    this.scene = scene;
    this.setDepth(DEPTH.projectile);
    this.setActive(false);
    this.setVisible(false);
    scene.add.existing(this);
  }

  fire({ x, y, angle, speed, damage, owner = 'player', weaponId = 'standard', splashRadius = 0, life = 2.6, texture, tint = null, boss = false }) {
    this.enableBody(true, x, y, true, true);
    this.setActive(true);
    this.setVisible(true);
    this.setTexture(texture || (owner === 'player' ? 'projectile_shell' : 'projectile_enemy_shell'));
    this.setDepth(DEPTH.projectile);
    this.setRotation(angle);
    this.setScale(boss ? 1.2 : 1);
    if (tint) this.setTint(tint);
    else this.clearTint();

    this.damage = damage;
    this.owner = owner;
    this.weaponId = weaponId;
    this.splashRadius = splashRadius;
    this.life = life;
    this.maxLife = life;
    this.boss = boss;
    this.trailTimer = 0;
    this.hit = false;

    this.body.setSize(10, 10, true);
    this.body.setAllowGravity(false);
    this.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    const deg = Phaser.Math.RadToDeg(angle);
    this.setAngle(deg);

    return this;
  }

  deactivate() {
    if (!this.active) return;
    this.setActive(false);
    this.setVisible(false);
    this.clearTint();
    if (this.body) {
      this.body.stop();
      this.body.enable = false;
    }
  }

  update(time, delta) {
    if (!this.active) return;
    const dt = delta / 1000;
    this.life -= dt;

    if (this.life <= 0) {
      this.deactivate();
      return;
    }

    // Smoke trail for rockets.
    if ((this.weaponId === 'rocket' || this.weaponId === 'boss_rocket') && this.scene.effects && this.scene.quality.smokeTrails) {
      this.trailTimer -= dt;
      if (this.trailTimer <= 0) {
        this.trailTimer = 0.035;
        this.scene.effects.rocketTrail(this.x, this.y);
      }
    }

    const { width, height } = this.scene.physics.world.bounds;
    if (this.x < -40 || this.y < -40 || this.x > width + 40 || this.y > height + 40) {
      this.deactivate();
    }
  }
}
