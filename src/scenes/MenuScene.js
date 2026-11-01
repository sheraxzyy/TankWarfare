import Phaser from 'phaser';
import { clamp } from '../core/Utils.js';

/**
 * Animated menu backdrop. A quiet desert staging area drifts behind the HTML
 * title screens. It is deliberately cheap: one tiled ground, a few props and
 * a slow camera pan.
 */
export class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
  }

  create() {
    this.cameras.main.setBackgroundColor('#0b0d0a');
    this.cameras.main.setBounds(0, 0, 3200, 2200);

    this.add.tileSprite(0, 0, 3200, 2200, 'ground_desert').setOrigin(0).setAlpha(0.92);

    const g = this.add.graphics();
    g.fillStyle(0x6a6049, 0.9);
    g.fillRect(0, 980, 3200, 190);
    g.fillStyle(0x000000, 0.14);
    g.fillRect(0, 980, 3200, 5);
    g.fillRect(0, 1165, 3200, 5);
    g.lineStyle(3, 0xd8c69a, 0.16);
    for (let x = 40; x < 3200; x += 90) {
      g.beginPath();
      g.moveTo(x, 1074);
      g.lineTo(x + 42, 1074);
      g.strokePath();
    }

    // Distant compound.
    const props = [
      ['building_1', 2190, 540, 330, 230],
      ['building_2', 2570, 760, 230, 175],
      ['tower', 2720, 350, 100, 100],
      ['tent', 1900, 400, 160, 115],
      ['radar', 2920, 690, 115, 115],
      ['outpost', 2360, 880, 145, 145],
      ['truck', 1250, 1030, 160, 82],
      ['truck', 860, 1050, 160, 82],
      ['crate', 2780, 1080, 90, 90],
      ['barrel', 2870, 1040, 60, 60],
    ];
    for (const [key, x, y, w, h] of props) {
      if (!this.textures.exists(key)) continue;
      this.add.image(x, y, key).setDisplaySize(w, h).setDepth(y).setAlpha(0.9);
    }

    for (let i = 0; i < 18; i++) {
      const key = `rock_${(i % 3) + 1}`;
      if (!this.textures.exists(key)) continue;
      const x = 220 + Math.random() * 2800;
      const y = 180 + Math.random() * 1900;
      if (Math.abs(y - 1080) < 150) continue;
      this.add
        .image(x, y, key)
        .setDisplaySize(90 + Math.random() * 90, 70 + Math.random() * 70)
        .setRotation(Math.random() * Math.PI)
        .setDepth(y)
        .setAlpha(0.82);
    }

    // Hero tank, parked and facing the viewer's left flank.
    const tankX = 1540;
    const tankY = 1090;
    const tankRot = -0.24;
    this.add.image(tankX + 9, tankY + 15, 'shadow_tank').setScale(2.2).setAlpha(0.55);
    this.add.image(tankX, tankY, 'hull_player').setScale(1.9).setRotation(tankRot).setDepth(tankY);
    this.turret = this.add
      .image(tankX, tankY, 'turret_player')
      .setScale(1.9)
      .setRotation(tankRot + 0.06)
      .setDepth(tankY + 2);
    this.add.image(tankX + 120, tankY + 124, 'wreck').setScale(1.2).setAlpha(0.5).setRotation(0.4).setDepth(tankY + 100);

    // Ambient haze.
    for (let i = 0; i < 10; i++) {
      const dust = this.add
        .image(Math.random() * 3200, Math.random() * 2200, 'fx_menu_dust')
        .setScale(4 + Math.random() * 6)
        .setAlpha(0)
        .setDepth(6100);
      this.tweens.add({
        targets: dust,
        alpha: { from: 0, to: 0.14 },
        x: dust.x + 500 + Math.random() * 400,
        duration: 14000 + Math.random() * 10000,
        repeat: -1,
        delay: Math.random() * 8000,
        onRepeat: () => {
          dust.x = -100;
          dust.y = Math.random() * 2200;
        },
      });
    }

    this.cameras.main.centerOn(1580, 980);
    this.cameras.main.scrollX -= 150;
    this.tweens.add({
      targets: this.cameras.main,
      scrollX: 340,
      scrollY: 420,
      duration: 48000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.tweens.add({
      targets: this.turret,
      rotation: tankRot + 0.16,
      duration: 9000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.handleResize();
    this.scale.on('resize', this.handleResize, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.handleResize, this));
  }

  handleResize() {
    const zoom = clamp(Math.max(this.scale.width / 1700, this.scale.height / 1050), 0.85, 1.6);
    this.cameras.main.setZoom(zoom);
  }
}

export default MenuScene;
