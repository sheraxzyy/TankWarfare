import Phaser from 'phaser';
import { DEPTH } from '../config/constants.js';

/**
 * Battlefield pickup. Types: health, ammo, special.
 */
export class Pickup extends Phaser.Physics.Arcade.Image {
  constructor(scene, x, y, texture = 'pickup_ammo') {
    super(scene, x, y, texture);
    this.scene = scene;
    this.setDepth(DEPTH.pickup);
    this.setActive(false);
    this.setVisible(false);
    scene.add.existing(this);

    this.baseY = y;
    this.type = 'ammo';
    this.life = 25;
  }

  spawn(x, y, type = 'ammo') {
    this.type = type;
    const textureMap = {
      health: 'pickup_health',
      ammo: 'pickup_ammo',
      special: 'pickup_special',
    };
    this.enableBody(true, x, y, true, true);
    this.setTexture(textureMap[type] || 'pickup_ammo');
    this.setActive(true);
    this.setVisible(true);
    this.setDepth(DEPTH.pickup);
    this.baseY = y;
    this.life = 28;
    this.body.setAllowGravity(false);
    this.body.setSize(42, 42, true);
    this.setScale(1);
    this.setAlpha(1);

    this.bobTween = this.scene.tweens.add({
      targets: this,
      y: y - 7,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.scene.tweens.add({
      targets: this,
      alpha: { from: 1, to: 0.82 },
      duration: 620,
      yoyo: true,
      repeat: -1,
    });
    return this;
  }

  deactivate() {
    if (!this.active) return;
    if (this.bobTween) {
      this.bobTween.stop();
      this.bobTween = null;
    }
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
    this.life -= delta / 1000;
    if (this.life < 4) {
      this.setAlpha(Math.max(0.25, this.life / 4));
    }
    if (this.life <= 0) {
      this.deactivate();
    }
  }
}
