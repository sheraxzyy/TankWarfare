import Phaser from 'phaser';

/**
 * EffectsSystem
 * Reusable particle emitters, muzzle flashes, impact decals, screen shake and
 * destruction sequences. Emitters are created once and reused for the whole battle.
 */
export class EffectsSystem {
  constructor(scene, quality, settings) {
    this.scene = scene;
    this.quality = quality;
    this.settings = settings;
    this.impactDecals = [];
    this.maxDecals = quality.decals < 1 ? 18 : 36;

    this.fireEmitter = scene.add
      .particles(0, 0, 'fx_fire', {
        speed: { min: 40, max: 280 },
        angle: { min: 0, max: 360 },
        scale: { start: 0.85, end: 0 },
        alpha: { start: 1, end: 0 },
        lifespan: { min: 260, max: 720 },
        blendMode: 'ADD',
        emitting: false,
      })
      .setDepth(6100);

    this.smokeEmitter = scene.add
      .particles(0, 0, 'fx_smoke', {
        speed: { min: 10, max: 70 },
        angle: { min: 0, max: 360 },
        scale: { start: 0.5, end: 1.35 },
        alpha: { start: 0.55, end: 0 },
        lifespan: { min: 900, max: 2200 },
        tint: [0x7c7a70, 0x969488, 0x5c5a52],
        emitting: false,
      })
      .setDepth(6050);

    this.sparkEmitter = scene.add
      .particles(0, 0, 'fx_spark', {
        speed: { min: 60, max: 340 },
        angle: { min: 0, max: 360 },
        scale: { start: 0.9, end: 0 },
        alpha: { start: 1, end: 0 },
        lifespan: { min: 160, max: 480 },
        blendMode: 'ADD',
        rotate: { min: 0, max: 360 },
        emitting: false,
      })
      .setDepth(6150);

    this.debrisEmitter = scene.add
      .particles(0, 0, 'fx_debris', {
        speed: { min: 80, max: 360 },
        angle: { min: 0, max: 360 },
        scale: { start: 0.8, end: 0.25 },
        alpha: { start: 1, end: 0.2 },
        lifespan: { min: 500, max: 1250 },
        rotate: { min: -220, max: 220 },
        emitting: false,
      })
      .setDepth(6080);

    this.dustEmitter = scene.add
      .particles(0, 0, 'fx_dust', {
        speed: { min: 6, max: 40 },
        angle: { min: 0, max: 360 },
        scale: { start: 0.32, end: 0.95 },
        alpha: { start: 0.45, end: 0 },
        lifespan: { min: 500, max: 1100 },
        tint: scene.mapDef?.dust || 0xd8c49a,
        emitting: false,
      })
      .setDepth(6040);

    this.trailEmitter = scene.add
      .particles(0, 0, 'fx_smoke', {
        speed: { min: 4, max: 22 },
        scale: { start: 0.16, end: 0.5 },
        alpha: { start: 0.38, end: 0 },
        lifespan: { min: 300, max: 650 },
        tint: 0xaaa89c,
        emitting: false,
      })
      .setDepth(6120);
  }

  get count() {
    return this.quality.particles ?? 1;
  }

  cameraShake(intensity = 0.004, duration = 130) {
    if (!this.settings.shake) return;
    this.scene.cameras.main.shake(duration, intensity);
  }

  muzzleFlash(x, y, angle, scale = 1) {
    const flash = this.scene.add
      .image(x, y, 'fx_flash')
      .setOrigin(0.16, 0.5)
      .setRotation(angle)
      .setScale(scale * 0.7)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(6200);
    this.scene.tweens.add({
      targets: flash,
      scaleX: scale * 1.15,
      scaleY: scale * 1.0,
      alpha: { from: 1, to: 0 },
      duration: 95,
      ease: 'Quad.easeOut',
      onComplete: () => flash.destroy(),
    });
    this.smokeEmitter.explode(Math.round(2 * this.count), x, y);
    this.sparkEmitter.explode(Math.round(3 * this.count), x, y);
  }

  dust(x, y) {
    if (this.count <= 0.4) return;
    this.dustEmitter.explode(1, x, y);
  }

  rocketTrail(x, y) {
    this.trailEmitter.explode(1, x, y);
  }

  tankDamageSmoke(x, y) {
    this.smokeEmitter.explode(1, x, y);
  }

  impact(x, y, angle = 0, surface = 'metal') {
    const n = Math.round(6 * this.count);
    if (surface === 'metal') {
      this.sparkEmitter.explode(n, x, y);
      this.dustEmitter.explode(Math.round(2 * this.count), x, y);
    } else {
      this.dustEmitter.explode(Math.round(6 * this.count), x, y);
      this.debrisEmitter.explode(Math.round(3 * this.count), x, y);
    }
    this.addImpactDecal(x, y, surface === 'metal' ? 0.35 : 0.55);
  }

  addImpactDecal(x, y, alpha = 0.35) {
    const decal = this.scene.add
      .image(x, y, 'decor_impact')
      .setDepth(y - 6)
      .setRotation(Math.random() * Math.PI * 2)
      .setScale(0.5 + Math.random() * 0.6)
      .setAlpha(alpha);
    this.impactDecals.push(decal);
    if (this.impactDecals.length > this.maxDecals) {
      const oldest = this.impactDecals.shift();
      if (oldest) oldest.destroy();
    }
  }

  shockwave(x, y, scale = 1) {
    const ring = this.scene.add
      .image(x, y, 'fx_ring')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(6210)
      .setScale(0.2 * scale)
      .setAlpha(0.8);
    this.scene.tweens.add({
      targets: ring,
      scaleX: 1.05 * scale,
      scaleY: 0.75 * scale,
      alpha: 0,
      duration: 360,
      ease: 'Cubic.easeOut',
      onComplete: () => ring.destroy(),
    });
  }

  explosion(x, y, scale = 1) {
    const n = Math.round(10 * scale * this.count) + 3;
    this.fireEmitter.explode(n, x, y);
    this.smokeEmitter.explode(Math.round(4 * scale * this.count) + 2, x, y);
    this.sparkEmitter.explode(Math.round(8 * scale * this.count), x, y);
    this.debrisEmitter.explode(Math.round(5 * scale * this.count) + 2, x, y);
    this.shockwave(x, y, scale);

    const glow = this.scene.add
      .image(x, y, 'fx_glow')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(6190)
      .setScale(scale * 0.9)
      .setAlpha(0.95);
    this.scene.tweens.add({
      targets: glow,
      scale: scale * 2.2,
      alpha: 0,
      duration: 300,
      ease: 'Quad.easeOut',
      onComplete: () => glow.destroy(),
    });

    const cam = this.scene.cameras.main;
    const dist = Phaser.Math.Distance.Between(cam.midPoint.x, cam.midPoint.y, x, y);
    const falloff = Phaser.Math.Clamp(1 - dist / 900, 0, 1);
    if (falloff > 0.1) this.cameraShake(0.0035 * scale * falloff, 150 + 80 * scale);
  }

  tankDestroyed(x, y, isPlayer = false) {
    this.explosion(x, y, isPlayer ? 1.9 : 1.35);
    this.scene.time.delayedCall(160, () => {
      this.explosion(x + Phaser.Math.Between(-22, 22), y + Phaser.Math.Between(-18, 18), 0.8);
    });
    this.scene.time.delayedCall(360, () => {
      this.smokeEmitter.explode(Math.round(8 * this.count), x, y);
    });
    if (isPlayer) {
      this.scene.cameras.main.flash(220, 120, 40, 20);
    }
  }

  bossDeathSequence(x, y, onComplete) {
    this.cameraShake(0.012, 1200);
    this.scene.cameras.main.flash(200, 255, 210, 160);
    const bursts = 9;
    for (let i = 0; i < bursts; i++) {
      this.scene.time.delayedCall(180 + i * 260, () => {
        const ox = x + Phaser.Math.Between(-70, 70);
        const oy = y + Phaser.Math.Between(-55, 55);
        this.explosion(ox, oy, 1.4);
        this.scene.cameras.main.shake(120, 0.006);
      });
    }
    this.scene.time.delayedCall(180 + bursts * 260 + 320, () => {
      this.explosion(x, y, 3.2);
      this.scene.cameras.main.flash(450, 255, 235, 200);
      this.cameraShake(0.02, 700);
      if (onComplete) onComplete();
    });
  }

  clearDecals() {
    for (const d of this.impactDecals) d.destroy();
    this.impactDecals = [];
  }
}
