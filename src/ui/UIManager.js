import { HUD } from './hud.js';
import {
  armoryScreen,
  briefingScreen,
  campaignScreen,
  getNextPlayableMission,
  howToScreen,
  pauseScreen,
  resultsScreen,
  settingsScreen,
  survivalScreen,
  titleScreen,
  trainingScreen,
} from './screens.js';
import { BATTLEFIELD_ORDER } from '../config/battlefields.js';
import { MISSIONS, getMission } from '../config/missions.js';
import { QUALITY } from '../config/constants.js';

/**
 * UIManager owns every DOM screen outside gameplay: navigation, event
 * delegation, the pause/results flow and the HUD bridge. The Phaser scenes
 * never reach into the DOM directly.
 */
export class UIManager {
  constructor(game, save, audio) {
    this.game = game;
    this.save = save;
    this.audio = audio;
    this.root = document.getElementById('ui-root');
    this.toastRoot = document.getElementById('toast-root');
    this.hud = new HUD(game);
    this.currentScreen = null;
    this.selectedMissionId = getNextPlayableMission(save);
    this.selectedMapId = BATTLEFIELD_ORDER.includes(save.state.lastMap) ? save.state.lastMap : 'desert';
    this.activeRun = null;
    this.lastResults = null;
    this.pauseData = null;
    this.modalConfirm = null;
    this.modalEl = null;
    this.hudReady = false;
    this.pendingFeed = [];
    this.runId = 0;

    this.onClick = this.onClick.bind(this);
    this.onInput = this.onInput.bind(this);
    this.onChange = this.onChange.bind(this);
    this.onFullscreenChange = this.onFullscreenChange.bind(this);
  }

  init() {
    this.root.addEventListener('click', this.onClick);
    this.root.addEventListener('input', this.onInput);
    this.root.addEventListener('change', this.onChange);
    document.addEventListener('fullscreenchange', this.onFullscreenChange);

    const events = this.game.events;
    events.once('boot:ready', () => this.showTitle());
    events.on('hud:init', (payload) => this.onHudInit(payload));
    events.on('hud:update', (payload) => this.onHudUpdate(payload));
    events.on('hud:notify', (payload) => this.onHudNotify(payload));
    events.on('hud:wave', (payload) => this.hud.wave(payload));
    events.on('hud:damage', () => this.hud.damage());
    events.on('hud:score', (payload) => this.hud.score(payload?.score));
    events.on('game:paused', (payload) => this.onPaused(payload));
    events.on('game:over', (payload) => this.onGameOver(payload));
  }

  /* ------------------------------------------------------------------ */
  /* Screen painting / navigation                                        */
  /* ------------------------------------------------------------------ */

  paint(name, html, { keepScroll = false } = {}) {
    const previousScroll = keepScroll ? this.root.querySelector('.screen')?.scrollTop || 0 : 0;
    this.closeModal();
    this.root.innerHTML = html;
    this.currentScreen = name;
    const scroller = this.root.querySelector('.screen');
    if (scroller) scroller.scrollTop = previousScroll;
  }

  clearScreen() {
    this.closeModal();
    this.root.innerHTML = '';
    this.currentScreen = null;
  }

  ensureMenuScene() {
    this.hud.hide();
    this.hud.clear();
    this.hudReady = false;
    this.pendingFeed = [];

    if (this.game.scene.isActive('BootScene')) return;
    if (this.game.scene.isActive('GameScene') || this.game.scene.isPaused('GameScene')) {
      this.game.scene.stop('GameScene');
    }
    if (!this.game.scene.isActive('MenuScene') && !this.game.scene.isSleeping('MenuScene')) {
      this.game.scene.start('MenuScene');
    }
  }

  showTitle() {
    this.ensureMenuScene();
    this.selectedMissionId = getNextPlayableMission(this.save);
    this.paint('title', titleScreen({ save: this.save, selectedMissionId: this.selectedMissionId }));
  }

  showCampaign(missionId = this.selectedMissionId, { keepScroll = false } = {}) {
    this.ensureMenuScene();
    const id = Number(missionId);
    this.selectedMissionId = MISSIONS.some((mission) => mission.id === id) ? id : 1;
    this.paint('campaign', campaignScreen({ save: this.save, selectedMissionId: this.selectedMissionId }), {
      keepScroll,
    });
  }

  showBriefing(missionId = this.selectedMissionId) {
    this.ensureMenuScene();
    const id = Number(missionId);
    this.selectedMissionId = MISSIONS.some((mission) => mission.id === id) ? id : 1;
    this.paint('briefing', briefingScreen({ save: this.save, selectedMissionId: this.selectedMissionId }));
  }

  showSurvival({ keepScroll = false } = {}) {
    this.ensureMenuScene();
    if (!BATTLEFIELD_ORDER.includes(this.selectedMapId)) this.selectedMapId = 'desert';
    this.paint('survival', survivalScreen({ save: this.save, selectedMapId: this.selectedMapId }), { keepScroll });
  }

  showTraining() {
    this.ensureMenuScene();
    this.paint('training', trainingScreen({ save: this.save }));
  }

  showArmory({ keepScroll = false } = {}) {
    this.ensureMenuScene();
    this.paint('armory', armoryScreen({ save: this.save }), { keepScroll });
  }

  showSettings({ keepScroll = false } = {}) {
    this.ensureMenuScene();
    this.paint('settings', settingsScreen({ save: this.save }), { keepScroll });
  }

  showHelp() {
    this.ensureMenuScene();
    this.paint('help', howToScreen({ save: this.save }));
  }

  /* ------------------------------------------------------------------ */
  /* Run lifecycle                                                       */
  /* ------------------------------------------------------------------ */

  startRun(data = {}) {
    const mode = ['campaign', 'survival', 'training'].includes(data.mode) ? data.mode : 'campaign';
    const missionId = Math.max(1, Math.min(10, Number(data.missionId) || this.selectedMissionId || 1));
    const mapId = BATTLEFIELD_ORDER.includes(data.mapId) ? data.mapId : this.selectedMapId;

    this.activeRun = { mode, missionId, mapId };
    this.lastResults = null;
    this.pauseData = null;
    this.clearScreen();
    this.hudReady = false;
    this.pendingFeed = [];
    this.hud.clear();
    this.hud.hide();
    this.runId += 1;

    if (mode === 'campaign') this.selectedMissionId = missionId;
    else if (mode === 'survival') this.selectedMapId = mapId;

    if (this.game.scene.isActive('MenuScene') || this.game.scene.isSleeping('MenuScene')) {
      this.game.scene.stop('MenuScene');
    }

    this.game.scene.start('GameScene', {
      mode,
      missionId,
      mapId: mode === 'campaign' ? getMission(missionId).map : mode === 'training' ? 'desert' : mapId,
    });
  }

  restartRun() {
    const run =
      this.activeRun ||
      (this.lastResults
        ? {
            mode: this.lastResults.mode,
            missionId: this.lastResults.missionId || 1,
            mapId: this.lastResults.mapId || this.selectedMapId,
          }
        : null);
    if (!run) {
      this.goMenu();
      return;
    }
    this.startRun(run);
  }

  goMenu() {
    this.activeRun = null;
    this.lastResults = null;
    this.pauseData = null;
    this.clearScreen();
    this.hudReady = false;
    this.pendingFeed = [];
    this.hud.clear();
    this.hud.hide();
    if (this.game.scene.isActive('GameScene') || this.game.scene.isPaused('GameScene')) {
      this.game.scene.stop('GameScene');
    }
    if (!this.game.scene.isActive('MenuScene')) this.game.scene.start('MenuScene');
    this.showTitle();
  }

  /* ------------------------------------------------------------------ */
  /* Game events                                                         */
  /* ------------------------------------------------------------------ */

  onHudInit(payload) {
    this.clearScreen();
    this.hud.init(payload);
    this.hudReady = true;
    const token = this.runId;
    const queued = this.pendingFeed.splice(0, this.pendingFeed.length);
    if (queued.length) {
      window.setTimeout(() => {
        if (!this.hudReady || this.runId !== token) return;
        for (const item of queued) this.hud.feed(item.text, item.kind);
      }, 850);
    }
  }

  onHudUpdate(payload) {
    if (!this.hudReady) return;
    this.hud.update(payload);
  }

  onHudNotify(payload) {
    if (!payload?.text) return;
    if (!this.hudReady) {
      this.pendingFeed.push({ text: payload.text, kind: payload.kind || '' });
      if (this.pendingFeed.length > 6) this.pendingFeed.shift();
      return;
    }
    this.hud.feed(payload.text, payload.kind || '');
  }

  onPaused(payload) {
    if (payload?.paused) {
      this.pauseData = payload;
      this.paint('pause', pauseScreen({ save: this.save, pause: payload }));
    } else if (this.currentScreen === 'pause') {
      this.clearScreen();
    }
  }

  onGameOver(payload) {
    this.hudReady = false;
    this.pendingFeed = [];
    this.hud.clear();
    this.hud.hide();
    this.lastResults = payload;
    if (payload?.mode === 'campaign') {
      this.selectedMissionId = payload.nextMissionId || payload.missionId || this.selectedMissionId;
    }
    this.paint('results', resultsScreen({ save: this.save, results: payload }));
  }

  /* ------------------------------------------------------------------ */
  /* Interaction                                                         */
  /* ------------------------------------------------------------------ */

  onClick(event) {
    const target = event.target.closest('[data-action]');
    if (!target) {
      if (this.modalEl && event.target === this.modalEl) this.closeModal();
      return;
    }
    const action = target.dataset.action;
    if (!action) return;
    event.preventDefault();
    this.audio.unlock();
    this.audio.ui('click');

    try {
      this.dispatch(action, target.dataset);
    } catch (error) {
      console.error('[UIManager] Action failed:', action, error);
      this.toast('SYSTEM FAULT — ACTION ABORTED', 'danger');
    }
  }

  dispatch(action, data) {
    switch (action) {
      case 'title:continue': {
        this.showBriefing(getNextPlayableMission(this.save));
        break;
      }
      case 'nav:title':
      case 'results:command':
        this.goMenu();
        break;
      case 'nav:campaign':
        this.showCampaign(this.selectedMissionId);
        break;
      case 'nav:survival':
        this.selectedMapId = BATTLEFIELD_ORDER.includes(this.save.state.lastMap)
          ? this.save.state.lastMap
          : this.selectedMapId;
        this.showSurvival();
        break;
      case 'nav:training':
        this.showTraining();
        break;
      case 'nav:armory':
        this.showArmory();
        break;
      case 'nav:settings':
        this.showSettings();
        break;
      case 'nav:help':
        this.showHelp();
        break;

      case 'mission:select':
        this.showCampaign(Number(data.mission), { keepScroll: true });
        break;
      case 'mission:brief':
        this.showBriefing(Number(data.mission));
        break;
      case 'mission:start':
        this.startRun({ mode: 'campaign', missionId: Number(data.mission) || this.selectedMissionId });
        break;

      case 'survival:select':
        if (BATTLEFIELD_ORDER.includes(data.map)) {
          this.selectedMapId = data.map;
          this.showSurvival({ keepScroll: true });
        }
        break;
      case 'survival:start':
        this.startRun({ mode: 'survival', mapId: this.selectedMapId });
        break;

      case 'training:start':
        this.startRun({ mode: 'training', mapId: 'desert' });
        break;

      case 'armory:buy': {
        const result = this.save.buyUpgrade(data.upgrade);
        if (result.ok) {
          this.audio.pickup('special');
          this.toast('UPGRADE INSTALLED', 'good');
        } else {
          this.toast(result.reason || 'UPGRADE UNAVAILABLE', 'warn');
        }
        this.showArmory({ keepScroll: true });
        break;
      }
      case 'armory:weapon': {
        const weaponId = data.weapon;
        if (this.save.selectWeapon(weaponId)) {
          this.toast(`LOADOUT UPDATED — ${String(weaponId).toUpperCase()}`, 'good');
        } else {
          this.toast('WEAPON LOCKED — COMPLETE CAMPAIGN OPERATIONS', 'warn');
        }
        this.showArmory({ keepScroll: true });
        break;
      }

      case 'settings:toggle':
        this.toggleSetting(data.setting);
        break;
      case 'settings:reset':
        this.openResetModal();
        break;

      case 'pause:resume':
        this.game.events.emit('game:resume');
        break;
      case 'pause:restart':
        this.restartRun();
        break;
      case 'pause:abort':
        this.goMenu();
        break;

      case 'results:next':
        if (data.mission) this.showBriefing(Number(data.mission));
        break;
      case 'results:replay':
        this.restartRun();
        break;
      case 'results:armory':
        this.showArmory();
        break;

      case 'modal:cancel':
        this.closeModal();
        break;
      case 'modal:confirm': {
        const confirm = this.modalConfirm;
        this.closeModal();
        if (confirm) confirm();
        break;
      }

      default:
        console.warn('[UIManager] Unknown action:', action);
    }
  }

  onInput(event) {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.type !== 'range') return;
    const setting = input.dataset.setting;
    if (!['master', 'music', 'sfx'].includes(setting)) return;
    const value = Math.max(0, Math.min(100, Number(input.value) || 0)) / 100;
    this.save.state.settings[setting] = value;
    this.audio.applySettings({ [setting]: value });
    const label = input.parentElement?.querySelector(`[data-range-value="${setting}"]`);
    if (label) label.textContent = `${Math.round(value * 100)}%`;
  }

  onChange(event) {
    const input = event.target;
    if (!(input instanceof HTMLInputElement || input instanceof HTMLSelectElement)) return;
    const setting = input.dataset.setting;
    if (!setting) return;

    if (setting === 'quality') {
      const quality = QUALITY[input.value] ? input.value : 'high';
      this.save.updateSettings({ quality });
      this.showSettings({ keepScroll: true });
      this.toast(`GRAPHICS QUALITY // ${quality.toUpperCase()} — APPLIES NEXT DEPLOYMENT`, 'warn');
      return;
    }

    if (input instanceof HTMLInputElement && input.type === 'range') {
      const value = Math.max(0, Math.min(100, Number(input.value) || 0)) / 100;
      this.save.updateSettings({ [setting]: value });
    }
  }

  toggleSetting(setting) {
    if (setting === 'fullscreen') {
      this.toggleFullscreen();
      return;
    }
    if (!['muted', 'shake'].includes(setting)) return;
    const value = !this.save.settings[setting];
    this.save.updateSettings({ [setting]: value });
    if (setting === 'muted') {
      this.audio.setMuted(value);
      this.toast(value ? 'AUDIO MUTED' : 'AUDIO RESTORED', value ? 'warn' : 'good');
    } else {
      this.toast(value ? 'SCREEN SHAKE ENABLED' : 'SCREEN SHAKE DISABLED', 'warn');
    }
    this.showSettings({ keepScroll: true });
  }

  async toggleFullscreen() {
    const wanted = !this.save.settings.fullscreen;
    try {
      if (wanted) {
        if (!document.documentElement.requestFullscreen) throw new Error('Fullscreen unsupported');
        await document.documentElement.requestFullscreen();
      } else if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
      this.save.updateSettings({ fullscreen: wanted });
      this.toast(wanted ? 'FULLSCREEN ENABLED' : 'FULLSCREEN DISABLED', 'good');
    } catch (error) {
      console.warn('[UIManager] Fullscreen request failed:', error);
      this.save.updateSettings({ fullscreen: Boolean(document.fullscreenElement) });
      this.toast('FULLSCREEN UNAVAILABLE IN THIS BROWSER', 'warn');
    }
    if (this.currentScreen === 'settings') this.showSettings({ keepScroll: true });
  }

  onFullscreenChange() {
    const active = Boolean(document.fullscreenElement);
    if (this.save.settings.fullscreen !== active) {
      this.save.updateSettings({ fullscreen: active });
    }
    if (this.currentScreen === 'settings') this.showSettings({ keepScroll: true });
  }

  /* ------------------------------------------------------------------ */
  /* Modal + toast                                                       */
  /* ------------------------------------------------------------------ */

  openResetModal() {
    this.openModal({
      title: 'RESET ALL PROGRESS',
      body:
        'Erase campaign progress, stars, survival records, credits, permanent upgrades, weapon unlocks and training certifications. ' +
        'This action cannot be undone. The save file will be recreated from scratch.',
      confirmLabel: 'ERASE EVERYTHING',
      onConfirm: () => {
        this.save.reset();
        this.audio.applySettings(this.save.settings);
        this.selectedMissionId = 1;
        this.selectedMapId = 'desert';
        this.activeRun = null;
        this.lastResults = null;
        this.showTitle();
        this.toast('SAVE DATA ERASED — NEW DEPLOYMENT READY', 'warn');
      },
    });
  }

  openModal({ title, body, confirmLabel = 'CONFIRM', onConfirm }) {
    this.closeModal();
    this.modalConfirm = onConfirm || null;
    this.root.insertAdjacentHTML(
      'beforeend',
      `<div class="modal-layer" data-modal-layer>
        <div class="modal" role="dialog" aria-modal="true" aria-label="${title}">
          <h2 class="modal__title">${title}</h2>
          <div class="modal__body">${body}</div>
          <div class="modal__actions">
            <button type="button" class="btn btn--ghost btn--sm" data-action="modal:cancel">CANCEL</button>
            <button type="button" class="btn btn--danger btn--sm" data-action="modal:confirm">${confirmLabel}</button>
          </div>
        </div>
      </div>`
    );
    this.modalEl = this.root.querySelector('[data-modal-layer]');
    this.modalEl?.querySelector('[data-action="modal:confirm"]')?.focus({ preventScroll: true });
  }

  closeModal() {
    if (this.modalEl) {
      this.modalEl.remove();
      this.modalEl = null;
    }
    this.modalConfirm = null;
  }

  toast(text, kind = '') {
    if (!text || !this.toastRoot) return;
    while (this.toastRoot.childElementCount >= 4) {
      this.toastRoot.firstElementChild?.remove();
    }
    const node = document.createElement('div');
    node.className = `toast${kind ? ` toast--${kind}` : ''}`;
    node.textContent = text;
    this.toastRoot.appendChild(node);
    window.setTimeout(() => {
      node.classList.add('is-out');
      window.setTimeout(() => node.remove(), 260);
    }, 3000);
  }
}

export default UIManager;
