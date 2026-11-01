import Phaser from 'phaser';
import './styles/main.css';
import { SAVE_KEY } from './config/constants.js';
import { SaveManager } from './core/SaveManager.js';
import { AudioManager } from './core/AudioManager.js';
import { UIManager } from './ui/UIManager.js';
import { BootScene } from './scenes/BootScene.js';
import { MenuScene } from './scenes/MenuScene.js';
import { GameScene } from './scenes/GameScene.js';

/**
 * TANK WARFARE bootstrap.
 *
 * The save file and audio engine are created before Phaser boots, then handed
 * to every scene through the game registry. The HTML interface is initialised
 * inside `preBoot` so its `boot:ready` listener is registered before the boot
 * scene has a chance to emit it.
 */

const bootScreen = document.getElementById('boot-screen');
const bootHint = document.getElementById('boot-hint');

function showBootError(message) {
  if (!bootScreen) return;
  bootScreen.classList.remove('is-hidden');
  if (bootHint) {
    bootHint.textContent = message;
    bootHint.style.color = '#d94a3b';
  }
}

function hideBootScreen() {
  if (!bootScreen) return;
  bootScreen.classList.add('is-hidden');
  bootScreen.setAttribute('aria-hidden', 'true');
  window.setTimeout(() => bootScreen.remove(), 700);
}

/* ------------------------------------------------------------------ */
/* Persistent state + procedural audio                                 */
/* ------------------------------------------------------------------ */

let save;
try {
  save = new SaveManager(window.localStorage);
} catch (error) {
  console.warn('[Bootstrap] Persistent storage unavailable, running in memory:', error);
  save = new SaveManager(
    (() => {
      const store = new Map();
      return {
        getItem: (key) => (store.has(key) ? store.get(key) : null),
        setItem: (key, value) => store.set(key, String(value)),
        removeItem: (key) => store.delete(key),
      };
    })()
  );
}

// Make sure a freshly created profile exists on disk from the first visit.
try {
  if (!window.localStorage.getItem(SAVE_KEY)) save.persist();
} catch {
  /* storage may be blocked */
}

const audio = new AudioManager(save.settings);

/* ------------------------------------------------------------------ */
/* Phaser configuration                                                */
/* ------------------------------------------------------------------ */

let ui = null;

const config = {
  type: Phaser.AUTO,
  parent: 'game-root',
  backgroundColor: '#0b0d0a',
  width: window.innerWidth,
  height: window.innerHeight,
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.NO_CENTER,
    width: '100%',
    height: '100%',
  },
  render: {
    antialias: true,
    pixelArt: false,
    roundPixels: false,
    powerPreference: 'high-performance',
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
      fps: 60,
      fixedStep: true,
    },
  },
  input: {
    activePointers: 3,
    keyboard: {
      capture: [32, 37, 38, 39, 40, 65, 68, 69, 82, 83, 87],
    },
  },
  disableContextMenu: true,
  scene: [BootScene, MenuScene, GameScene],
  callbacks: {
    preBoot: (game) => {
      game.registry.set('save', save);
      game.registry.set('audio', audio);
      game.registry.set('version', '1.0.0');

      ui = new UIManager(game, save, audio);
      ui.init();

      game.events.once('boot:ready', hideBootScreen);
      game.events.once('boot:error', () => showBootError('ASSET INITIALIZATION FAILED — RELOAD THE PAGE'));
    },
  },
};

/* ------------------------------------------------------------------ */
/* First-gesture audio unlock                                          */
/* ------------------------------------------------------------------ */

function unlockAudio() {
  audio.unlock();
  window.removeEventListener('pointerdown', unlockAudio, true);
  window.removeEventListener('keydown', unlockAudio, true);
  window.removeEventListener('touchstart', unlockAudio, true);
}
window.addEventListener('pointerdown', unlockAudio, true);
window.addEventListener('keydown', unlockAudio, true);
window.addEventListener('touchstart', unlockAudio, true);

/* ------------------------------------------------------------------ */
/* Launch                                                              */
/* ------------------------------------------------------------------ */

let game;
try {
  game = new Phaser.Game(config);
} catch (error) {
  console.error('[Bootstrap] Phaser failed to start:', error);
  showBootError('GAME ENGINE FAILED TO START — CHECK THE CONSOLE');
  throw error;
}

/* ------------------------------------------------------------------ */
/* Housekeeping                                                        */
/* ------------------------------------------------------------------ */

// Keep the simulation honest when the player switches tabs: audio is suspended
// and an active battle is paused so the crew is not destroyed off-screen.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    audio.suspend();
    const scene = game.scene.getScene('GameScene');
    if (scene && game.scene.isActive('GameScene') && scene.player?.alive && !scene.paused && !scene.runEnded) {
      scene.pauseGame();
    }
  } else {
    audio.resume();
  }
});

// A reload while a battle is live should never strand the player in a half
// started run. The save file is written on every meaningful result event, so
// showing the title screen is always a safe recovery.
window.addEventListener('beforeunload', () => {
  try {
    save.persist();
  } catch {
    /* ignore */
  }
});

window.addEventListener('error', (event) => {
  console.error('[Bootstrap] Uncaught error:', event.error || event.message);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('[Bootstrap] Unhandled promise rejection:', event.reason);
});

// Expose a small read-only-ish handle for QA and debugging. Not used by the
// game itself, so removing it has no gameplay effect.
if (import.meta.env?.DEV) {
  window.TANK_WARFARE = { game, save, audio, get ui() { return ui; } };
}

export { game, save, audio, ui };
