import { formatNumber, formatTime, escapeHtml } from '../core/Utils.js';

/**
 * DOM HUD. Receives immutable snapshots from GameScene roughly 20 times a
 * second and only touches the nodes that actually changed.
 */
export class HUD {
  constructor(game) {
    this.game = game;
    this.root = document.getElementById('hud-root');
    this.el = null;
    this.refs = {};
    this.map = null;
    this.obstacles = [];
    this.feedItems = [];
    this.lastMinimap = 0;
    this.lastWeaponKey = '';
    this.hideTimer = null;
  }

  mount() {
    if (this.el) return;
    this.root.innerHTML = `
      <div class="hud" aria-live="off">
        <div class="hud-damage" data-damage></div>
        <div class="hud-vignette" data-vignette></div>
        <div class="hud-lowhp" data-lowhp></div>

        <div class="hud__row">
          <div class="hud-panel hud-status">
            <div class="hud-vehicle">
              <span class="hud-vehicle__name">M1 ABRAMS</span>
              <span class="hud-vehicle__class">MBT // CREW 4</span>
            </div>
            <div class="hud-bar">
              <span class="hud-bar__label">HULL</span>
              <div class="hud-bar__track"><div class="hud-bar__fill" data-fill="hull"></div></div>
              <span class="hud-bar__value" data-value="hull">165</span>
            </div>
            <div class="hud-bar">
              <span class="hud-bar__label">ARMOR</span>
              <div class="hud-bar__track"><div class="hud-bar__fill hud-bar__fill--armor" data-fill="armor"></div></div>
              <span class="hud-bar__value" data-value="armor">70</span>
            </div>
          </div>

          <div class="hud-panel hud-objective">
            <span class="hud-objective__label" data-objective-label>OBJECTIVE</span>
            <div class="hud-objective__name" data-objective-name>ELIMINATE HOSTILE ARMOR</div>
            <div class="hud-objective__progress" data-objective-progress>0 HOSTILES REMAINING</div>
          </div>

          <div class="hud-top-right">
            <div class="hud-panel hud-stat">
              <div class="hud-stat__label">SCORE</div>
              <div class="hud-stat__value" data-stat="score">0</div>
            </div>
            <div class="hud-panel hud-stat">
              <div class="hud-stat__label">TIME</div>
              <div class="hud-stat__value" data-stat="time">00:00</div>
            </div>
            <div class="hud-panel hud-stat">
              <div class="hud-stat__label">KILLS</div>
              <div class="hud-stat__value" data-stat="kills">0</div>
            </div>
          </div>
        </div>

        <div class="hud-boss" data-boss>
          <div class="hud-boss__row">
            <span class="hud-boss__name" data-boss-name>WARLORD PROTOTYPE</span>
            <span class="hud-boss__phase" data-boss-phase>PHASE 1</span>
          </div>
          <div class="hud-boss__track"><div class="hud-boss__fill" data-boss-fill></div></div>
        </div>

        <div class="hud-wave-banner" data-banner>
          <div class="hud-wave-banner__label" data-banner-label>WAVE 01</div>
          <div class="hud-wave-banner__title" data-banner-title>HOSTILE ARMOR</div>
        </div>

        <div class="hud__row hud-bottom">
          <div class="hud-panel hud-weapon">
            <div class="hud-weapon__head">
              <span class="hud-weapon__name" data-weapon-name>M68 CANNON</span>
              <span class="hud-weapon__mode" data-weapon-code>105MM AP</span>
            </div>
            <div class="hud-ammo">
              <span class="hud-ammo__clip" data-ammo-clip>8</span>
              <span class="hud-ammo__reserve">RESERVE <b data-ammo-reserve>50</b></span>
            </div>
            <div class="hud-reload">
              <div class="hud-reload__row">
                <span data-reload-label>READY</span>
                <span data-reload-pct>100%</span>
              </div>
              <div class="hud-reload__track"><div class="hud-reload__fill" data-reload-fill></div></div>
            </div>
            <div class="hud-slots" data-slots></div>
            <div class="hud-special">
              <span class="hud-special__label">HE BARRAGE</span>
              <span class="hud-special__charges" data-charges></span>
              <span class="hud-special__key">[E]</span>
            </div>
          </div>

          <div class="hud-feed" data-feed></div>

          <div class="hud-panel hud-minimap">
            <div class="hud-minimap__head">
              <span>FIELD MAP // <b data-map-name>TACTICAL</b></span>
              <span data-coords>0000 / 0000</span>
            </div>
            <canvas width="240" height="180" data-minimap></canvas>
            <div class="hud-minimap__legend">
              <span style="color: #97a36a">ALLIED</span>
              <span style="color: #d94a3b">HOSTILE</span>
              <span style="color: #e5863b">OBJECTIVE</span>
            </div>
          </div>
        </div>
      </div>`;

    this.el = this.root.querySelector('.hud');
    this.refs = {
      damage: this.root.querySelector('[data-damage]'),
      vignette: this.root.querySelector('[data-vignette]'),
      lowhp: this.root.querySelector('[data-lowhp]'),
      hullFill: this.root.querySelector('[data-fill="hull"]'),
      hullValue: this.root.querySelector('[data-value="hull"]'),
      armorFill: this.root.querySelector('[data-fill="armor"]'),
      armorValue: this.root.querySelector('[data-value="armor"]'),
      objectiveLabel: this.root.querySelector('[data-objective-label]'),
      objectiveName: this.root.querySelector('[data-objective-name]'),
      objectiveProgress: this.root.querySelector('[data-objective-progress]'),
      score: this.root.querySelector('[data-stat="score"]'),
      time: this.root.querySelector('[data-stat="time"]'),
      kills: this.root.querySelector('[data-stat="kills"]'),
      boss: this.root.querySelector('[data-boss]'),
      bossName: this.root.querySelector('[data-boss-name]'),
      bossPhase: this.root.querySelector('[data-boss-phase]'),
      bossFill: this.root.querySelector('[data-boss-fill]'),
      banner: this.root.querySelector('[data-banner]'),
      bannerLabel: this.root.querySelector('[data-banner-label]'),
      bannerTitle: this.root.querySelector('[data-banner-title]'),
      weaponName: this.root.querySelector('[data-weapon-name]'),
      weaponCode: this.root.querySelector('[data-weapon-code]'),
      ammoClip: this.root.querySelector('[data-ammo-clip]'),
      ammoReserve: this.root.querySelector('[data-ammo-reserve]'),
      reloadLabel: this.root.querySelector('[data-reload-label]'),
      reloadPct: this.root.querySelector('[data-reload-pct]'),
      reloadFill: this.root.querySelector('[data-reload-fill]'),
      slots: this.root.querySelector('[data-slots]'),
      charges: this.root.querySelector('[data-charges]'),
      feed: this.root.querySelector('[data-feed]'),
      minimap: this.root.querySelector('[data-minimap]'),
      mapName: this.root.querySelector('[data-map-name]'),
      coords: this.root.querySelector('[data-coords]'),
    };
  }

  init(payload) {
    this.mount();
    this.map = payload.map;
    this.obstacles = payload.obstacles || [];
    this.refs.mapName.textContent = this.map?.name || 'TACTICAL';
    this.refs.vignette.classList.toggle('is-night', Boolean(payload.night));
    this.refs.feed.innerHTML = '';
    this.feedItems = [];
    this.lastWeaponKey = '';
    this.drawMinimap(null);
    this.show();
  }

  show() {
    this.mount();
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
    this.root.hidden = false;
    requestAnimationFrame(() => this.el?.classList.add('is-visible'));
  }

  hide() {
    this.el?.classList.remove('is-visible');
    this.hideTimer = setTimeout(() => {
      if (this.root) this.root.hidden = true;
    }, 380);
  }

  update(payload) {
    if (!this.el) this.mount();
    const p = payload.player;
    if (!p) return;

    const healthRatio = p.maxHealth > 0 ? p.health / p.maxHealth : 0;
    const armorRatio = p.maxArmor > 0 ? p.armor / p.maxArmor : 0;

    this.refs.hullFill.style.transform = `scaleX(${Math.max(0, Math.min(1, healthRatio))})`;
    this.refs.armorFill.style.transform = `scaleX(${Math.max(0, Math.min(1, armorRatio))})`;
    this.refs.hullValue.textContent = `${Math.round(p.health)}`;
    this.refs.armorValue.textContent = `${Math.round(p.armor)}`;
    this.refs.hullFill.classList.toggle('is-low', healthRatio <= 0.3);
    this.refs.lowhp.classList.toggle('is-visible', healthRatio <= 0.28);
    this.refs.vignette.classList.toggle('is-night', Boolean(payload.night));

    if (payload.objective) {
      this.refs.objectiveLabel.textContent = payload.objective.label || 'OBJECTIVE';
      this.refs.objectiveName.textContent = payload.objective.name || '';
      this.refs.objectiveProgress.textContent = payload.objective.progress || '';
    }

    this.refs.score.textContent = formatNumber(payload.stats?.score || 0);
    this.refs.time.textContent = formatTime(payload.stats?.time || 0);
    this.refs.kills.textContent = String(payload.stats?.kills || 0);

    const w = p.weapon;
    if (w) {
      this.refs.weaponName.textContent = w.name;
      this.refs.weaponCode.textContent = w.code;
      this.refs.ammoClip.textContent = String(w.clip);
      this.refs.ammoClip.classList.toggle('is-empty', w.clip <= 0);
      this.refs.ammoReserve.textContent = String(w.reserve);

      const reloadPct = w.reloading ? Math.round(w.reloadProgress * 100) : 100;
      this.refs.reloadFill.style.transform = `scaleX(${Math.max(0.01, reloadPct / 100)})`;
      this.refs.reloadPct.textContent = `${reloadPct}%`;
      this.refs.reloadLabel.textContent = w.reloading ? 'RELOADING' : w.reserve <= 0 && w.clip <= 0 ? 'AMMO EXHAUSTED' : 'READY';

      const weaponKey = `${w.id}|${p.weapons.map((x) => `${x.id}:${x.unlocked ? 1 : 0}`).join(',')}`;
      if (weaponKey !== this.lastWeaponKey) {
        this.lastWeaponKey = weaponKey;
        this.refs.slots.innerHTML = p.weapons
          .map(
            (weapon, index) =>
              `<div class="hud-slot ${weapon.id === w.id ? 'is-active' : ''} ${weapon.unlocked ? '' : 'is-locked'}"><b>${index + 1}</b>${escapeHtml(weapon.short)}</div>`
          )
          .join('');
      }

      const charges = p.special?.charges ?? 0;
      const max = p.special?.max ?? 3;
      if (this.refs.charges.childElementCount !== max) {
        this.refs.charges.innerHTML = Array.from({ length: max }, () => '<i></i>').join('');
      }
      [...this.refs.charges.children].forEach((node, index) => node.classList.toggle('on', index < charges));
    }

    if (payload.boss) {
      this.refs.boss.classList.add('is-visible');
      this.refs.bossName.textContent = payload.boss.name;
      this.refs.bossPhase.textContent = `PHASE ${payload.boss.phase} // ARMOR FAILING`;
      this.refs.bossFill.style.transform = `scaleX(${Math.max(0, payload.boss.health / payload.boss.maxHealth)})`;
    } else {
      this.refs.boss.classList.remove('is-visible');
    }

    if (payload.minimap) {
      const now = performance.now();
      if (now - this.lastMinimap > 80) {
        this.lastMinimap = now;
        this.drawMinimap(payload.minimap);
        this.refs.coords.textContent = `${String(Math.round(payload.minimap.player.x)).padStart(4, '0')} / ${String(
          Math.round(payload.minimap.player.y)
        ).padStart(4, '0')}`;
      }
    }
  }

  drawMinimap(state) {
    if (!this.map || !this.refs.minimap) return;
    const canvas = this.refs.minimap;
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;
    const sx = width / this.map.width;
    const sy = height / this.map.height;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#10140e';
    ctx.fillRect(0, 0, width, height);

    // Ground tint.
    ctx.fillStyle = this.map.groundColor || '#2a2f24';
    ctx.globalAlpha = 0.35;
    ctx.fillRect(0, 0, width, height);
    ctx.globalAlpha = 1;

    // Roads.
    ctx.fillStyle = 'rgba(200, 180, 138, 0.18)';
    for (const road of this.map.roads || []) {
      ctx.fillRect(road.x * sx, road.y * sy, Math.max(1, road.w * sx), Math.max(1, road.h * sy));
    }

    // Structures.
    for (const o of this.obstacles) {
      const x = (o.x - o.w / 2) * sx;
      const y = (o.y - o.h / 2) * sy;
      const w = Math.max(1, o.w * sx);
      const h = Math.max(1, o.h * sy);
      if (/tree/.test(o.type)) ctx.fillStyle = 'rgba(74, 96, 54, 0.7)';
      else if (/rock/.test(o.type)) ctx.fillStyle = 'rgba(122, 114, 96, 0.6)';
      else ctx.fillStyle = 'rgba(160, 152, 132, 0.45)';
      ctx.fillRect(x, y, w, h);
    }

    if (!state) {
      // Grid frame.
      ctx.strokeStyle = 'rgba(200, 180, 138, 0.25)';
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, width - 1, height - 1);
      return;
    }

    // Objectives.
    for (const obj of state.objectives || []) {
      ctx.fillStyle = '#e5863b';
      const x = obj.x * sx;
      const y = obj.y * sy;
      ctx.fillRect(x - 3, y - 3, 6, 6);
      ctx.strokeStyle = 'rgba(229,134,59,0.45)';
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Enemies.
    for (const enemy of state.enemies || []) {
      const x = enemy.x * sx;
      const y = enemy.y * sy;
      ctx.fillStyle = enemy.boss ? '#ff6a52' : '#d94a3b';
      ctx.beginPath();
      ctx.arc(x, y, enemy.boss ? 4.5 : 2.3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Player wedge.
    const px = state.player.x * sx;
    const py = state.player.y * sy;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(state.player.rotation);
    ctx.fillStyle = '#c8e08a';
    ctx.beginPath();
    ctx.moveTo(7, 0);
    ctx.lineTo(-5, 4.5);
    ctx.lineTo(-5, -4.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Frame.
    ctx.strokeStyle = 'rgba(200, 180, 138, 0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, width - 1, height - 1);
  }

  feed(text, kind = '') {
    this.mount();
    if (!text) return;
    const item = document.createElement('div');
    item.className = `hud-feed__item${kind ? ` is-${kind}` : ''}`;
    item.textContent = text;
    this.refs.feed.appendChild(item);
    this.feedItems.push(item);
    while (this.feedItems.length > 5) {
      const oldest = this.feedItems.shift();
      oldest?.remove();
    }
    setTimeout(() => {
      item.remove();
      this.feedItems = this.feedItems.filter((entry) => entry !== item);
    }, 3400);
  }

  wave({ label, title }) {
    this.mount();
    this.refs.bannerLabel.textContent = label || '';
    this.refs.bannerTitle.textContent = title || '';
    this.refs.banner.classList.remove('is-visible');
    void this.refs.banner.offsetWidth;
    this.refs.banner.classList.add('is-visible');
  }

  damage() {
    this.mount();
    this.refs.damage.classList.remove('is-flashing');
    void this.refs.damage.offsetWidth;
    this.refs.damage.classList.add('is-flashing');
  }

  score(score) {
    if (this.refs.score) this.refs.score.textContent = formatNumber(score || 0);
  }

  clear() {
    if (this.refs.feed) this.refs.feed.innerHTML = '';
    this.feedItems = [];
    if (this.refs.boss) this.refs.boss.classList.remove('is-visible');
    if (this.refs.lowhp) this.refs.lowhp.classList.remove('is-visible');
    if (this.refs.vignette) this.refs.vignette.classList.remove('is-night');
  }
}
