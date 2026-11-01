import Phaser from 'phaser';
import { generateTextures } from '../core/TextureFactory.js';

/**
 * Generates every procedural texture once, then hands off to the menu backdrop.
 * No external assets are fetched at any point.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  create() {
    const hint = document.getElementById('boot-hint');
    if (hint) hint.textContent = 'GENERATING BATTLEFIELD ASSETS';

    try {
      generateTextures(this);
    } catch (error) {
      console.error('[BootScene] Texture generation failed', error);
      if (hint) hint.textContent = 'ASSET INITIALIZATION FAILED — CHECK CONSOLE';
      this.game.events.emit('boot:error', error);
      return;
    }

    if (hint) hint.textContent = 'ARMORED DIVISION READY';
    this.game.events.emit('boot:ready');

    // Start the menu backdrop directly instead of queueing the operation. A
    // backgrounded tab may not tick its scene queue for an arbitrary amount of
    // time, and a queued "start MenuScene" could otherwise fire on top of a
    // battle the player has already begun.
    this.scene.stop();
    this.game.scene.start('MenuScene');
  }
}

export default BootScene;
