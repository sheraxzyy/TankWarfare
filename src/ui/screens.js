import { MISSIONS, TRAINING_DRILLS, MODE_INFO } from '../config/missions.js';
import {
  BATTLEFIELD_ORDER,
  getBattlefield,
  renderBattlefieldThumb,
} from '../config/battlefields.js';
import { WEAPONS, WEAPON_ORDER, SPECIAL_ORDNANCE, getWeaponUnlockLabel } from '../config/weapons.js';
import { UPGRADES, UPGRADE_ORDER, getUpgradeCost } from '../config/upgrades.js';
import { ENEMY_TYPES } from '../config/enemies.js';
import { GAME_VERSION, QUALITY, getRank } from '../config/constants.js';
import { escapeHtml, formatNumber, formatTime, starsString } from '../core/Utils.js';

/**
 * Pure HTML renderers for every non-HUD screen. UIManager owns state and the
 * event delegation; these functions receive a plain context object and return
 * a complete `.screen` element as a string.
 */

const THUMB_CACHE = new Map();

function thumb(id) {
  if (!THUMB_CACHE.has(id)) {
    let src = '';
    try {
      src = renderBattlefieldThumb(id, 520, 330);
    } catch (error) {
      console.warn('[screens] Battlefield preview unavailable:', error);
    }
    THUMB_CACHE.set(id, src);
  }
  return THUMB_CACHE.get(id) || '';
}

const MISSION_TYPE_LABEL = {
  eliminate: 'SEARCH & DESTROY',
  convoy: 'CONVOY INTERDICTION',
  structures: 'DEMOLITION',
  survive: 'HOLD THE LINE',
  defend: 'POINT DEFENSE',
  boss: 'BOSS ENGAGEMENT',
};

const ENEMY_TACTICS = {
  scout: 'Fast reconnaissance armor. Tracks wide, flanks quickly and dies to sustained cannon fire.',
  assault: 'Line armor with balanced guns and plating. Closes to medium range and trades shots.',
  heavy: 'Slow, thick-skinned brawler. Hits hard — break line of sight and hit it from cover.',
  elite: 'Hunter-killer crew. Long detection range, burst fire and aggressive repositioning.',
  boss: 'WARLORD prototype. Three escalating phases, escort screen and saturation rocket volleys.',
};

const UPGRADE_ICONS = {
  armor:
    '<path d="M12 3l7 3v6c0 4.2-3 7-7 9-4-2-7-4.8-7-9V6z"/><path d="M9 12l2 2 4-4"/>',
  engine:
    '<path d="M4 10h7l3-3h6v10h-6l-3-3H4z"/><path d="M8 7v3M11 14v3"/>',
  reload:
    '<path d="M20 12a8 8 0 1 1-2.4-5.7"/><path d="M20 4v5h-5"/><path d="M12 8v4l3 2"/>',
  shell:
    '<path d="M9 21V10l3-7 3 7v11z"/><path d="M9 14h6M9 17h6"/>',
};

function icon(name) {
  return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${UPGRADE_ICONS[name] || UPGRADE_ICONS.armor}</svg>`;
}

function screen(inner, { clear = false, overlay = false, extra = '' } = {}) {
  return `<div class="screen${clear ? ' screen--clear' : ''}${overlay ? ' screen--overlay' : ''}${extra ? ` ${extra}` : ''}">${inner}</div>`;
}

function topStrip(save, right = 'SYSTEM READY') {
  const rank = getRank(save.state.stats.kills);
  return `<div class="top-strip">
    <span><strong>TANK WARFARE</strong> // COMBAT COMMAND NETWORK</span>
    <span class="status-dot">${escapeHtml(right)} · ${escapeHtml(rank)}</span>
  </div>`;
}

function credits(save) {
  return `<span class="credits"><span>CREDITS</span><b>${formatNumber(save.state.credits)}</b></span>`;
}

function btn(action, label, options = {}) {
  const {
    variant = '',
    index = '',
    sub = '',
    data = '',
    type = 'button',
    wide = false,
    title = '',
  } = options;
  const classes = ['btn', variant, wide ? 'btn--wide' : ''].filter(Boolean).join(' ');
  return `<button type="${type}" class="${classes}" data-action="${action}"${data ? ` ${data}` : ''}${
    title ? ` title="${escapeHtml(title)}"` : ''
  }>${index ? `<span class="btn__idx">${escapeHtml(index)}</span>` : ''}<span>${label}</span>${
    sub ? `<span class="btn__sub">${sub}</span>` : ''
  }</button>`;
}

function backButton(action = 'nav:title', label = 'COMMAND') {
  return btn(action, `BACK TO ${label}`, { variant: 'btn--ghost btn--sm', index: 'ESC' });
}

function screenHead({ eyebrow, title, sub = '', actions = '' }) {
  return `<div class="screen-head">
    <div>
      <div class="screen-head__eyebrow">${eyebrow}</div>
      <h1 class="screen-title">${title}</h1>
      ${sub ? `<p class="screen-sub">${sub}</p>` : ''}
    </div>
    ${actions ? `<div class="header-actions">${actions}</div>` : ''}
  </div>`;
}

/* ------------------------------------------------------------------ */
/* State helpers                                                       */
/* ------------------------------------------------------------------ */

export function getNextPlayableMission(save) {
  const unlocked = Math.max(1, Math.min(MISSIONS.length, save.campaignUnlocked || 1));
  for (let id = 1; id <= unlocked; id++) {
    if (!save.getMissionRecord(id)) return id;
  }
  return unlocked;
}

function missionRecord(save, id) {
  return save.getMissionRecord(id);
}

function isMissionLocked(save, id) {
  return id > (save.campaignUnlocked || 1);
}

function completedMissionCount(save) {
  return Object.keys(save.state.campaign.completed || {}).length;
}

function starCount(save) {
  return MISSIONS.reduce((total, mission) => total + (save.getMissionRecord(mission.id)?.stars || 0), 0);
}

function accuracy(save) {
  const stats = save.state.stats;
  return stats.shots > 0 ? Math.min(100, Math.round((stats.hits / stats.shots) * 100)) : 0;
}

function missionEnemyCount(mission) {
  const base = (mission.enemies || []).reduce((total, group) => total + (group.count || 0), 0);
  return base + (mission.boss ? 1 : 0);
}

function missionEnemyLine(mission) {
  const parts = (mission.enemies || []).map(
    (group) => `${group.count} x ${ENEMY_TYPES[group.type]?.name || String(group.type).toUpperCase()}`
  );
  if (mission.boss) parts.unshift('1 x WARLORD PROTOTYPE');
  return parts.join(' · ') || 'GARRISON UNKNOWN';
}

function missionRewardLabel(mission) {
  const reward = mission.rewards?.weapon;
  return reward && WEAPONS[reward] ? WEAPONS[reward].name : 'NO WEAPON REWARD';
}

function survivalStats(save) {
  return save.state.survival;
}

/* ------------------------------------------------------------------ */
/* Title                                                               */
/* ------------------------------------------------------------------ */

export function titleScreen({ save }) {
  const nextId = getNextPlayableMission(save);
  const next = MISSIONS.find((mission) => mission.id === nextId) || MISSIONS[0];
  const nextMap = getBattlefield(next.map);
  const completed = completedMissionCount(save);
  const totalStars = starCount(save);
  const stats = save.state.stats;
  const survival = survivalStats(save);
  const fresh = save.isFresh;
  const progress = Math.round((completed / MISSIONS.length) * 100);
  const starProgress = Math.round((totalStars / (MISSIONS.length * 3)) * 100);

  const dossier = `<aside class="dossier" aria-label="Field dossier">
    <div class="dossier__head">
      <span class="dossier__title">FIELD DOSSIER</span>
      <span class="dossier__id">ID // TW-${String(4711 + completed * 37).slice(-4)}</span>
    </div>
    <div class="dossier__body">
      <div class="rank-row">
        <div>
          <div class="rank-row__label">COMMAND RANK</div>
          <div class="rank-row__value">${escapeHtml(getRank(stats.kills))}</div>
        </div>
        <div class="rank-row__credits">
          <span class="rank-row__label">CREDITS</span>
          <b>${formatNumber(save.state.credits)}</b>
        </div>
      </div>
      <div class="stat-grid">
        <div class="stat-cell">
          <div class="stat-cell__label">HOSTILES DESTROYED</div>
          <div class="stat-cell__value">${formatNumber(stats.kills)}</div>
        </div>
        <div class="stat-cell">
          <div class="stat-cell__label">MISSIONS COMPLETE</div>
          <div class="stat-cell__value">${completed}<small> / ${MISSIONS.length}</small></div>
        </div>
        <div class="stat-cell">
          <div class="stat-cell__label">GUNNERY ACCURACY</div>
          <div class="stat-cell__value">${accuracy(save)}<small>%</small></div>
        </div>
        <div class="stat-cell">
          <div class="stat-cell__label">SURVIVAL BEST WAVE</div>
          <div class="stat-cell__value">${String(survival.highWave).padStart(2, '0')}</div>
        </div>
      </div>
      <div class="progress-block">
        <div class="progress-block__row"><span>CAMPAIGN PROGRESS</span><span>${completed} / ${MISSIONS.length}</span></div>
        <div class="progress-track"><i style="width:${progress}%"></i></div>
      </div>
      <div class="progress-block">
        <div class="progress-block__row"><span>OPERATION RATING</span><span>${totalStars} / ${MISSIONS.length * 3} STARS</span></div>
        <div class="progress-track"><i style="width:${starProgress}%"></i></div>
      </div>
    </div>
    <div class="dossier__footer">
      <div>LAST DEPLOYMENT // <b>${escapeHtml(getBattlefield(save.state.lastMap).name)}</b></div>
      <div>SURVIVAL RECORD // <b>${formatNumber(survival.highScore)} PTS</b> · WAVE <b>${String(survival.highWave).padStart(2, '0')}</b></div>
      <div>SAVE FILE v${GAME_VERSION} // UPDATED <b>${new Date(save.state.updatedAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
      })}</b></div>
    </div>
  </aside>`;

  return screen(
    `<div class="screen-shell">
      ${topStrip(save, fresh ? 'NEW DEPLOYMENT' : 'COMBAT READY')}
      <div class="title-main">
        <div class="title-copy">
          <div class="title-kicker">ARMORED COMBAT // TOP-DOWN WARFARE</div>
          <h1 class="logo" aria-label="Tank Warfare">
            <span class="logo__line">TANK</span>
            <span class="logo__line logo__line--outline">WARFARE</span>
            <span class="logo__slash" aria-hidden="true"></span>
          </h1>
          <div class="logo__tag"><i></i> 4 THEATERS <i></i> 10 OPERATIONS <i></i> ENDLESS ARMOR <i></i> 5 HOSTILE CLASSES</div>

          <div class="title-menu">
            ${btn(fresh ? 'title:continue' : 'title:continue', fresh ? 'BEGIN CAMPAIGN' : 'CONTINUE OPERATION', {
              variant: 'btn--primary',
              wide: true,
              index: '01',
              sub: fresh ? 'OPERATION 01 // DESERT OUTPOST' : `MISSION ${String(nextId).padStart(2, '0')} // ${escapeHtml(nextMap.name)}`,
            })}
            <div class="title-menu__row">
              ${btn('nav:campaign', 'CAMPAIGN', { index: '02', sub: `${completed}/${MISSIONS.length}` })}
              ${btn('nav:survival', 'SURVIVAL', { index: '03', sub: `WAVE ${String(survival.highWave).padStart(2, '0')}` })}
            </div>
            <div class="title-menu__row">
              ${btn('nav:training', 'TRAINING', { index: '04', sub: `${save.state.training.completed.length}/6` })}
              ${btn('nav:armory', 'ARMORY', { index: '05', sub: `${formatNumber(save.state.credits)} CR` })}
            </div>
            <div class="title-menu__row">
              ${btn('nav:settings', 'SETTINGS', { index: '06' })}
              ${btn('nav:help', 'FIELD MANUAL', { index: '07' })}
            </div>
          </div>
        </div>
        ${dossier}
      </div>
      <div class="title-foot">
        <div class="title-foot__keys">
          <span><span class="key-inline">W</span><span class="key-inline">S</span> DRIVE</span>
          <span><span class="key-inline">A</span><span class="key-inline">D</span> ROTATE</span>
          <span><span class="key-inline">SPACE</span> FIRE</span>
          <span><span class="key-inline">E</span> BARRAGE</span>
          <span><span class="key-inline">R</span> RELOAD</span>
          <span><span class="key-inline">ESC</span> PAUSE</span>
        </div>
        <span>TANK WARFARE v${GAME_VERSION} // KEYBOARD REQUIRED</span>
      </div>
    </div>`,
    { clear: true, extra: 'title-screen' }
  );
}

/* ------------------------------------------------------------------ */
/* Campaign                                                            */
/* ------------------------------------------------------------------ */

export function campaignScreen({ save, selectedMissionId }) {
  const selected = MISSIONS.find((mission) => mission.id === selectedMissionId) || MISSIONS[0];
  const record = missionRecord(save, selected.id);
  const locked = isMissionLocked(save, selected.id);
  const map = getBattlefield(selected.map);
  const completed = completedMissionCount(save);

  const cards = MISSIONS.map((mission) => {
    const missionLocked = isMissionLocked(save, mission.id);
    const missionRecordData = missionRecord(save, mission.id);
    const active = mission.id === selected.id;
    const state = missionLocked
      ? '<span class="locked">LOCKED</span>'
      : missionRecordData
        ? `COMPLETE<span class="stars">${starsString(missionRecordData.stars)}</span>`
        : 'AVAILABLE';
    const classes = ['mission-card', active ? 'is-active' : '', missionLocked ? 'is-locked' : '', missionRecordData ? 'is-complete' : '']
      .filter(Boolean)
      .join(' ');
    return `<button type="button" class="${classes}" data-action="mission:select" data-mission="${mission.id}" ${
      missionLocked ? 'aria-disabled="true"' : ''
    }>
      <span class="mission-card__num">${String(mission.id).padStart(2, '0')}</span>
      <div>
        <div class="mission-card__name">${escapeHtml(mission.name)}</div>
        <div class="mission-card__meta">${escapeHtml(getBattlefield(mission.map).name)} · ${escapeHtml(
          MISSION_TYPE_LABEL[mission.type] || mission.type
        )} · ${escapeHtml(mission.threat)}</div>
      </div>
      <div class="mission-card__state">${state}</div>
    </button>`;
  }).join('');

  return screen(
    `<div class="screen-shell">
      ${topStrip(save, `OPERATION ROSTER · ${completed}/${MISSIONS.length} COMPLETE`)}
      ${screenHead({
        eyebrow: 'CAMPAIGN // ARMORED OPERATIONS',
        title: 'SELECT OPERATION',
        sub: 'Ten linked operations across four theaters. Complete the primary objective to unlock the next sector and earn credits for permanent armor upgrades.',
        actions: `${credits(save)}${backButton()}`,
      })}
      <div class="mission-layout">
        <div class="mission-list">${cards}</div>
        <aside class="mission-detail panel" aria-label="Selected operation">
          <div class="mission-detail__banner">
            <img src="${thumb(selected.map)}" alt="${escapeHtml(map.name)} tactical map" loading="lazy">
            <span class="mission-detail__banner-label">${escapeHtml(map.region)} // ${escapeHtml(map.terrain)}</span>
          </div>
          <div class="panel__body">
            <div class="row row--between" style="margin-bottom:6px">
              <span class="field-label" style="margin:0">OPERATION ${String(selected.id).padStart(2, '0')} · ${escapeHtml(
                selected.codeName
              )}</span>
              <span class="tag ${locked ? 'tag--red' : 'tag--green'}">${locked ? 'LOCKED' : selected.threat + ' THREAT'}</span>
            </div>
            <h2 class="mission-detail__title">${escapeHtml(selected.name)}</h2>
            <div class="meta-row">
              <span class="tag">${escapeHtml(map.name)}</span>
              <span class="tag">${escapeHtml(MISSION_TYPE_LABEL[selected.type] || selected.type)}</span>
              <span class="tag">${missionEnemyCount(selected)} HOSTILES</span>
              <span class="tag">PAR ${formatTime(selected.parTime)}</span>
            </div>
            <div class="mission-detail__obj">${escapeHtml(selected.objective)}</div>
            <p class="screen-sub" style="margin-top:14px">${escapeHtml(selected.briefing)}</p>
            ${
              record
                ? `<div class="note">BEST RESULT // ${formatNumber(record.score)} PTS · ${starsString(record.stars)} · ${formatTime(
                    record.time
                  )} · ${record.kills} KILLS</div>`
                : ''
            }
            ${
              locked
                ? `<div class="lock-notice" style="margin-top:16px">SECTOR ACCESS DENIED. <b>COMPLETE OPERATION ${String(
                    selected.id - 1
                  ).padStart(2, '0')}</b> TO UNLOCK THIS DEPLOYMENT.</div>`
                : `<div class="briefing__actions" style="margin-top:18px">
                    ${btn('mission:brief', record ? 'REVIEW BRIEFING' : 'OPEN BRIEFING', {
                      variant: 'btn--primary',
                      wide: true,
                      index: 'GO',
                      data: `data-mission="${selected.id}"`,
                    })}
                  </div>`
            }
          </div>
        </aside>
      </div>
    </div>`
  );
}

/* ------------------------------------------------------------------ */
/* Briefing                                                            */
/* ------------------------------------------------------------------ */

export function briefingScreen({ save, selectedMissionId }) {
  const mission = MISSIONS.find((item) => item.id === selectedMissionId) || MISSIONS[0];
  const map = getBattlefield(mission.map);
  const locked = isMissionLocked(save, mission.id);
  const record = missionRecord(save, mission.id);
  const intel = (mission.intel || []).map((line) => `<div class="briefing__line">${escapeHtml(line)}</div>`).join('');

  return screen(
    `<div class="screen-shell">
      ${topStrip(save, `MISSION BRIEFING · OPERATION ${String(mission.id).padStart(2, '0')}`)}
      <div class="briefing">
        <div>
          <div class="briefing__num">OPERATION ${String(mission.id).padStart(2, '0')} // ${escapeHtml(
            mission.codeName
          )} // ${escapeHtml(mission.threat)} THREAT</div>
          <h1 class="briefing__title">${escapeHtml(mission.name)}</h1>
          <div class="briefing__objective">
            <span class="field-label">PRIMARY OBJECTIVE</span>
            <p>${escapeHtml(mission.objective)}</p>
          </div>
          <p class="screen-sub">${escapeHtml(mission.briefing)}</p>
          <div class="briefing__intel">${intel}</div>
          ${
            record
              ? `<div class="note">PREVIOUS RESULT // ${formatNumber(record.score)} PTS · ${starsString(record.stars)} · ${formatTime(
                  record.time
                )}</div>`
              : ''
          }
          <div class="briefing__actions">
            ${
              locked
                ? `<div class="lock-notice">SECTOR LOCKED. COMPLETE THE PRIOR OPERATION FIRST.</div>`
                : btn('mission:start', 'DEPLOY TO SECTOR', {
                    variant: 'btn--primary',
                    index: 'DEPLOY',
                    data: `data-mission="${mission.id}"`,
                    sub: map.name,
                  })
            }
            ${btn('nav:campaign', 'RETURN TO ROSTER', { variant: 'btn--ghost', index: 'BACK' })}
          </div>
        </div>
        <aside>
          <div class="briefing__map">
            <img src="${thumb(mission.map)}" alt="${escapeHtml(map.name)} tactical preview" loading="lazy">
            <div class="briefing__map-foot">
              <span>${escapeHtml(map.name)}</span>
              <span>${map.width} × ${map.height} // ${escapeHtml(map.terrain)}</span>
            </div>
          </div>
          <div class="panel" style="margin-top:14px">
            <div class="panel__head"><span>OPERATION DATA</span><b>${escapeHtml(mission.threat)} THREAT</b></div>
            <div class="panel__body">
              <div class="summary-grid">
                <div class="summary-cell">
                  <div class="summary-cell__label">PAR TIME</div>
                  <div class="summary-cell__value">${formatTime(mission.parTime)}</div>
                </div>
                <div class="summary-cell">
                  <div class="summary-cell__label">CREDIT VALUE</div>
                  <div class="summary-cell__value">${formatNumber(mission.rewards?.credits || 0)}</div>
                </div>
                <div class="summary-cell">
                  <div class="summary-cell__label">HOSTILE ARMOR</div>
                  <div class="summary-cell__value">${missionEnemyCount(mission)}<small> VEHICLES</small></div>
                </div>
                <div class="summary-cell">
                  <div class="summary-cell__label">WEAPON REWARD</div>
                  <div class="summary-cell__value" style="font-size:12px;line-height:1.3;padding-top:5px">${escapeHtml(
                    missionRewardLabel(mission)
                  )}</div>
                </div>
              </div>
              <div class="divider"></div>
              <span class="field-label">ENEMY COMPOSITION</span>
              <div class="briefing__line">${escapeHtml(missionEnemyLine(mission))}</div>
              ${
                mission.reinforcements
                  ? `<div class="briefing__line" style="margin-top:7px">REINFORCEMENTS EXPECTED AFTER ${formatTime(
                      Math.min(...mission.reinforcements.map((r) => r.delay))
                    )}</div>`
                  : ''
              }
              <div class="note">PRIMARY OBJECTIVE AND ALL HOSTILE ARMOR MUST BE NEUTRALIZED. VEHICLE LOSS FAILS THE OPERATION.</div>
            </div>
          </div>
        </aside>
      </div>
    </div>`
  );
}

/* ------------------------------------------------------------------ */
/* Survival                                                            */
/* ------------------------------------------------------------------ */

export function survivalScreen({ save, selectedMapId }) {
  const selectedMap = getBattlefield(selectedMapId);
  const survival = survivalStats(save);
  const cards = BATTLEFIELD_ORDER.map((id) => {
    const map = getBattlefield(id);
    const active = id === selectedMap.id;
    return `<button type="button" class="map-card${active ? ' is-active' : ''}" data-action="survival:select" data-map="${id}">
      <div class="map-card__img">
        <img src="${thumb(id)}" alt="${escapeHtml(map.name)} tactical map" loading="lazy">
        <span class="map-card__index">ARENA ${String(map.index).padStart(2, '0')}</span>
      </div>
      <div class="map-card__body">
        <div class="map-card__name">${escapeHtml(map.name)}</div>
        <div class="map-card__desc">${escapeHtml(map.description)}</div>
        <div class="map-card__meta">
          <span>${escapeHtml(map.terrain)}</span>
          <span>BEST WAVE ${String(survival.highWave).padStart(2, '0')}</span>
        </div>
      </div>
      <span class="map-card__cta">${active ? 'SELECTED' : 'SELECT ARENA'}</span>
    </button>`;
  }).join('');

  return screen(
    `<div class="screen-shell">
      ${topStrip(save, 'SURVIVAL PROTOCOL')}
      ${screenHead({
        eyebrow: 'SURVIVAL // ENDLESS ARMORED ASSAULT',
        title: 'HOLD THE LINE',
        sub: MODE_INFO.survival.description,
        actions: `${credits(save)}${backButton()}`,
      })}
      <div class="content-grid">
        <div class="map-grid">${cards}</div>
        <div class="side-stack">
          <div class="panel">
            <div class="panel__head"><span>SURVIVAL RECORD</span><b>${survival.runs} RUNS</b></div>
            <div class="panel__body">
              <div class="summary-grid">
                <div class="summary-cell">
                  <div class="summary-cell__label">HIGH SCORE</div>
                  <div class="summary-cell__value">${formatNumber(survival.highScore)}</div>
                </div>
                <div class="summary-cell">
                  <div class="summary-cell__label">BEST WAVE</div>
                  <div class="summary-cell__value">${String(survival.highWave).padStart(2, '0')}</div>
                </div>
                <div class="summary-cell">
                  <div class="summary-cell__label">TOTAL KILLS</div>
                  <div class="summary-cell__value">${formatNumber(survival.totalKills)}</div>
                </div>
                <div class="summary-cell">
                  <div class="summary-cell__label">LONGEST RUN</div>
                  <div class="summary-cell__value">${formatTime(survival.longestTime)}</div>
                </div>
              </div>
              <div class="divider"></div>
              <ul class="tip-list">
                <li>Waves escalate every deployment. Boss armor arrives every fifth wave.</li>
                <li>Clearing a wave drops supplies and awards a score bonus.</li>
                <li>Armor plating regenerates after six seconds without taking fire.</li>
                <li>The run ends when your tank is destroyed. Score and wave are recorded.</li>
              </ul>
            </div>
          </div>
          <div class="panel">
            <div class="panel__head"><span>DEPLOYMENT</span><b>${escapeHtml(selectedMap.name)}</b></div>
            <div class="panel__body">
              <div class="note" style="margin-top:0">ARENA // ${escapeHtml(selectedMap.region)}<br>TERRAIN // ${escapeHtml(
                selectedMap.terrain
              )}<br>SIZE // ${selectedMap.width} × ${selectedMap.height}</div>
              <div class="pause__actions">
                ${btn('survival:start', 'ENTER THE GRIND', {
                  variant: 'btn--primary',
                  wide: true,
                  index: 'GO',
                  sub: selectedMap.name,
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>`
  );
}

/* ------------------------------------------------------------------ */
/* Training                                                            */
/* ------------------------------------------------------------------ */

export function trainingScreen({ save }) {
  const completed = new Set(save.state.training.completed || []);
  const rows = TRAINING_DRILLS.map((drill, index) => {
    const done = completed.has(drill.id);
    return `<button type="button" class="mission-card${done ? ' is-complete' : ''}" data-action="training:start">
      <span class="mission-card__num">${String(index + 1).padStart(2, '0')}</span>
      <div>
        <div class="mission-card__name">${escapeHtml(drill.name)}</div>
        <div class="mission-card__meta">${escapeHtml(drill.hint)}</div>
      </div>
      <div class="mission-card__state">${done ? 'COMPLETE<span class="stars">CERTIFIED</span>' : 'PENDING'}</div>
    </button>`;
  }).join('');

  return screen(
    `<div class="screen-shell">
      ${topStrip(save, 'CREW CERTIFICATION')}
      ${screenHead({
        eyebrow: 'TRAINING // LIVE-FIRE RANGE',
        title: 'CREW CERTIFICATION',
        sub: MODE_INFO.training.description,
        actions: `${credits(save)}${backButton()}`,
      })}
      <div class="content-grid">
        <div class="panel">
          <div class="panel__head"><span>QUALIFICATION DRILLS</span><b>${completed.size}/6 CERTIFIED</b></div>
          <div class="panel__body">
            <div class="mission-list">${rows}</div>
            <div class="briefing__actions">
              ${btn('training:start', 'BEGIN QUALIFICATION', {
                variant: 'btn--primary',
                index: 'GO',
                sub: 'ALL WEAPONS UNLOCKED',
              })}
              ${btn('nav:campaign', 'RETURN TO CAMPAIGN', { variant: 'btn--ghost' })}
            </div>
          </div>
        </div>
        <div class="side-stack">
          <div class="panel">
            <div class="panel__head"><span>RANGE CONTROLS</span><b>KEYBOARD</b></div>
            <div class="panel__body">
              <table class="control-table">
                <tbody>
                  <tr><td><span class="key">W</span><span class="key">S</span> / <span class="key">↑</span><span class="key">↓</span></td><td>Accelerate / reverse</td></tr>
                  <tr><td><span class="key">A</span><span class="key">D</span> / <span class="key">←</span><span class="key">→</span></td><td>Rotate hull</td></tr>
                  <tr><td><span class="key">SPACE</span></td><td>Fire main gun</td></tr>
                  <tr><td><span class="key">E</span></td><td>HE barrage</td></tr>
                  <tr><td><span class="key">R</span></td><td>Reload magazine</td></tr>
                  <tr><td><span class="key">1</span>–<span class="key">4</span></td><td>Select weapon</td></tr>
                  <tr><td><span class="key">ESC</span></td><td>Pause / resume</td></tr>
                </tbody>
              </table>
            </div>
          </div>
          <div class="panel">
            <div class="panel__head"><span>RANGE SAFETY</span><b>NO SCORE PENALTY</b></div>
            <div class="panel__body">
              <ul class="tip-list">
                <li>Complete all six drills in sequence. Progress is saved automatically.</li>
                <li>All four weapons are unlocked on the range for live testing.</li>
                <li>Supply drops keep the range stocked. Training losses can be retried freely.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>`
  );
}

/* ------------------------------------------------------------------ */
/* Armory                                                              */
/* ------------------------------------------------------------------ */

export function armoryScreen({ save }) {
  const upgradeCards = UPGRADE_ORDER.map((id) => {
    const upgrade = UPGRADES[id];
    const level = save.getUpgradeLevel(id);
    const cost = getUpgradeCost(id, level);
    const maxed = cost == null;
    const pips = Array.from({ length: upgrade.maxLevel }, (_, index) => `<i class="${index < level ? 'on' : ''}"></i>`).join('');
    return `<div class="upgrade-card">
      <div class="upgrade-card__icon">${icon(upgrade.icon)}</div>
      <div>
        <div class="upgrade-card__name">${escapeHtml(upgrade.name)}</div>
        <div class="upgrade-card__desc">${escapeHtml(upgrade.description)}</div>
        <div class="pips" aria-label="Level ${level} of ${upgrade.maxLevel}">${pips}</div>
        <div class="note" style="margin-top:6px">LEVEL ${level}/${upgrade.maxLevel} // ${escapeHtml(
          upgrade.effect(level)
        )}${maxed ? '' : ` · NEXT ${escapeHtml(upgrade.effect(level + 1))}`}</div>
      </div>
      <div class="upgrade-card__action">
        <div class="upgrade-card__cost${maxed ? ' is-max' : ''}">${maxed ? 'MAX LEVEL' : `${formatNumber(cost)} CR`}</div>
        ${
          maxed
            ? '<span class="tag tag--green">INSTALLED</span>'
            : `<button type="button" class="btn btn--sm" data-action="armory:buy" data-upgrade="${id}">INSTALL</button>`
        }
      </div>
    </div>`;
  }).join('');

  const weaponCards = WEAPON_ORDER.map((id) => {
    const weapon = WEAPONS[id];
    const unlocked = save.isWeaponUnlocked(id);
    const selected = save.state.selectedWeapon === id;
    const bars = [
      ['POWER', weapon.stats.damage],
      ['RATE', weapon.stats.rate],
      ['LOAD', weapon.stats.reload],
    ]
      .map(
        ([label, value]) =>
          `<div class="stat-bar"><div class="stat-bar__label"><span>${label}</span><span>${Math.round(
            value * 100
          )}</span></div><div class="stat-bar__track"><i style="width:${Math.round(value * 100)}%"></i></div></div>`
      )
      .join('');
    return `<button type="button" class="weapon-card${selected ? ' is-active' : ''}${
      unlocked ? '' : ' is-locked'
    }" data-action="armory:weapon" data-weapon="${id}" ${unlocked ? '' : 'aria-disabled="true"'}>
      <div class="weapon-card__row">
        <span class="weapon-card__name">${escapeHtml(weapon.name)}</span>
        <span class="weapon-card__type">${escapeHtml(weapon.code)}</span>
      </div>
      <p class="weapon-card__desc">${escapeHtml(weapon.description)}</p>
      <div class="stat-bars">${bars}</div>
      ${
        unlocked
          ? `<div class="weapon-card__unlock" style="color:var(--olive-bright)">${
              selected ? 'ACTIVE LOADOUT' : 'CLICK TO EQUIP'
            }</div>`
          : `<div class="weapon-card__unlock">LOCKED // ${escapeHtml(getWeaponUnlockLabel(weapon))}</div>`
      }
    </button>`;
  }).join('');

  const selectedWeapon = WEAPONS[save.state.selectedWeapon] || WEAPONS.standard;

  return screen(
    `<div class="screen-shell">
      ${topStrip(save, 'ARMORY · PERMANENT UPGRADES')}
      ${screenHead({
        eyebrow: 'ARMORY // DIVISION WORKSHOP',
        title: 'UPGRADE DEPOT',
        sub: 'Spend combat credits on permanent vehicle upgrades. Upgrades apply to every future deployment in all modes.',
        actions: `${credits(save)}${backButton()}`,
      })}
      <div class="armory-layout">
        <div class="panel">
          <div class="panel__head"><span>VEHICLE UPGRADES</span><b>PERMANENT</b></div>
          <div class="panel__body">
            <div class="upgrade-list">${upgradeCards}</div>
            <div class="note">CREDITS ARE EARNED FROM OPERATIONS, SURVIVAL RUNS AND TRAINING. UPGRADES CANNOT BE REFUNDED.</div>
          </div>
        </div>
        <div class="side-stack">
          <div class="panel">
            <div class="panel__head"><span>WEAPON LOCKER</span><b>${escapeHtml(selectedWeapon.short)} EQUIPPED</b></div>
            <div class="panel__body">
              <div class="weapon-list">${weaponCards}</div>
            </div>
          </div>
          <div class="panel">
            <div class="panel__head"><span>SPECIAL ORDNANCE</span><b>[E] KEY</b></div>
            <div class="panel__body">
              <div class="weapon-card__name">${escapeHtml(SPECIAL_ORDNANCE.name)}</div>
              <p class="weapon-card__desc">${escapeHtml(
                SPECIAL_ORDNANCE.description
              )} ${SPECIAL_ORDNANCE.charges} charges per deployment.</p>
              <div class="note" style="margin-top:0">CHARGES DO NOT REFILL DURING A RUN — SAVE THEM FOR CLUSTERS, BUNKERS AND BOSS ARMOR.</div>
            </div>
          </div>
        </div>
      </div>
    </div>`
  );
}

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

function rangeRow(setting, label, hint, value) {
  const pct = Math.round(value * 100);
  return `<div class="setting-row">
    <div>
      <div class="setting-row__label">${label}</div>
      <div class="setting-row__hint">${hint}</div>
    </div>
    <div class="setting-row__control">
      <input type="range" min="0" max="100" step="1" value="${pct}" data-setting="${setting}" aria-label="${label}">
      <span class="range-value" data-range-value="${setting}">${pct}%</span>
    </div>
  </div>`;
}

function toggleRow(setting, label, hint, on, labels = ['OFF', 'ON']) {
  return `<div class="setting-row">
    <div>
      <div class="setting-row__label">${label}</div>
      <div class="setting-row__hint">${hint}</div>
    </div>
    <div class="setting-row__control">
      <button type="button" class="toggle" data-action="settings:toggle" data-setting="${setting}" aria-pressed="${on}">
        <span class="${on ? '' : 'is-on'}">${labels[0]}</span>
        <span class="${on ? 'is-on' : ''}">${labels[1]}</span>
      </button>
    </div>
  </div>`;
}

export function settingsScreen({ save }) {
  const settings = save.settings;
  const qualityOptions = Object.entries(QUALITY)
    .map(
      ([id, quality]) =>
        `<option value="${id}"${settings.quality === id ? ' selected' : ''}>${quality.label}</option>`
    )
    .join('');
  const stats = save.state.stats;

  return screen(
    `<div class="screen-shell">
      ${topStrip(save, 'SYSTEM CONFIGURATION')}
      ${screenHead({
        eyebrow: 'SETTINGS // FIELD CONFIGURATION',
        title: 'SYSTEM SETTINGS',
        sub: 'Audio, display and save data. All settings are stored locally in this browser.',
        actions: backButton(),
      })}
      <div class="settings-grid">
        <div class="side-stack">
          <div class="panel">
            <div class="panel__head"><span>AUDIO</span><b>PROCEDURAL SOUND</b></div>
            <div class="panel__body">
              ${rangeRow('master', 'MASTER VOLUME', 'Overall output level.', settings.master)}
              ${rangeRow('music', 'MUSIC / AMBIENCE', 'Low drone, pads and distant percussion.', settings.music)}
              ${rangeRow('sfx', 'WEAPONS & EFFECTS', 'Engines, cannon fire, impacts and UI cues.', settings.sfx)}
              ${toggleRow('muted', 'MUTE ALL AUDIO', 'Instantly silence the game without losing volume settings.', settings.muted)}
            </div>
          </div>
          <div class="panel">
            <div class="panel__head"><span>DISPLAY</span><b>DESKTOP</b></div>
            <div class="panel__body">
              <div class="setting-row">
                <div>
                  <div class="setting-row__label">GRAPHICS QUALITY</div>
                  <div class="setting-row__hint">Particles, shadows and decals. Applied on the next deployment.</div>
                </div>
                <div class="setting-row__control">
                  <select class="tw-select" data-setting="quality" aria-label="Graphics quality">${qualityOptions}</select>
                </div>
              </div>
              ${toggleRow('shake', 'SCREEN SHAKE', 'Camera impulse on cannon fire, impacts and explosions.', settings.shake)}
              ${toggleRow('fullscreen', 'FULLSCREEN', 'Expand the battlefield to the whole display.', settings.fullscreen)}
            </div>
          </div>
        </div>
        <div class="side-stack">
          <div class="panel">
            <div class="panel__head"><span>SERVICE RECORD</span><b>${escapeHtml(getRank(stats.kills))}</b></div>
            <div class="panel__body">
              <div class="summary-grid">
                <div class="summary-cell">
                  <div class="summary-cell__label">TOTAL KILLS</div>
                  <div class="summary-cell__value">${formatNumber(stats.kills)}</div>
                </div>
                <div class="summary-cell">
                  <div class="summary-cell__label">MISSIONS WON</div>
                  <div class="summary-cell__value">${formatNumber(stats.missions)}</div>
                </div>
                <div class="summary-cell">
                  <div class="summary-cell__label">SHOTS FIRED</div>
                  <div class="summary-cell__value">${formatNumber(stats.shots)}</div>
                </div>
                <div class="summary-cell">
                  <div class="summary-cell__label">TANKS LOST</div>
                  <div class="summary-cell__value">${formatNumber(stats.deaths)}</div>
                </div>
              </div>
              <div class="note">SAVE FILE // tank_warfare_save_v1 · LOCAL STORAGE<br>CREATED // ${new Date(
                save.state.createdAt
              ).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' })}</div>
            </div>
          </div>
          <div class="panel">
            <div class="panel__head"><span>FIELD MANUAL</span><b>KEYBOARD</b></div>
            <div class="panel__body">
              <div class="briefing__line">W / S or UP / DOWN — drive forward and reverse.</div>
              <div class="briefing__line">A / D or LEFT / RIGHT — rotate the hull.</div>
              <div class="briefing__line">SPACE — fire. R — reload. E — HE barrage.</div>
              <div class="briefing__line">1 / 2 / 3 / 4 — switch weapon. ESC — pause.</div>
              <div class="pause__actions">
                ${btn('nav:help', 'OPEN FIELD MANUAL', { variant: 'btn--ghost', wide: true })}
              </div>
            </div>
          </div>
          <div class="reset-block">
            <div class="reset-block__title">RESET PROGRESS</div>
            <p>Erase campaign progress, survival records, credits, upgrades, weapon unlocks and training certifications. This cannot be undone.</p>
            ${btn('settings:reset', 'RESET ALL SAVE DATA', { variant: 'btn--danger btn--sm', index: '!' })}
          </div>
        </div>
      </div>
    </div>`
  );
}

/* ------------------------------------------------------------------ */
/* Field manual                                                        */
/* ------------------------------------------------------------------ */

export function howToScreen({ save }) {
  const weaponRows = WEAPON_ORDER.map((id) => {
    const weapon = WEAPONS[id];
    const unlocked = save.isWeaponUnlocked(id);
    return `<div class="weapon-mini">
      <div class="weapon-mini__name">${escapeHtml(weapon.name)}</div>
      <div class="weapon-mini__desc">${escapeHtml(weapon.description)} <span class="${
        unlocked ? 'accent' : 'danger'
      }">${unlocked ? 'IN ARSENAL' : escapeHtml(getWeaponUnlockLabel(weapon))}</span></div>
    </div>`;
  }).join('');

  const enemyRows = Object.values(ENEMY_TYPES)
    .map(
      (enemy) => `<div class="weapon-mini">
        <div class="weapon-mini__name">${escapeHtml(enemy.name)}</div>
        <div class="weapon-mini__desc">${escapeHtml(ENEMY_TACTICS[enemy.id] || '')} <span class="orange">${enemy.score} PTS</span></div>
      </div>`
    )
    .join('');

  return screen(
    `<div class="screen-shell">
      ${topStrip(save, 'FIELD MANUAL · ARMORED COMBAT')}
      ${screenHead({
        eyebrow: 'FIELD MANUAL // CREW REFERENCE',
        title: 'HOW TO FIGHT',
        sub: 'Everything a tank commander needs before rolling out. The battlefield is keyboard-controlled; the interface handles everything else.',
        actions: backButton(),
      })}
      <div class="howto-grid">
        <div class="side-stack">
          <div class="panel">
            <div class="panel__head"><span>CONTROLS</span><b>KEYBOARD ONLY</b></div>
            <div class="panel__body">
              <table class="control-table">
                <tbody>
                  <tr><td><span class="key">W</span><span class="key">S</span> / <span class="key">↑</span><span class="key">↓</span></td><td>Drive forward and reverse</td></tr>
                  <tr><td><span class="key">A</span><span class="key">D</span> / <span class="key">←</span><span class="key">→</span></td><td>Rotate the hull</td></tr>
                  <tr><td><span class="key">SPACE</span></td><td>Fire the selected weapon</td></tr>
                  <tr><td><span class="key">E</span></td><td>Fire a three-shell HE barrage</td></tr>
                  <tr><td><span class="key">R</span></td><td>Reload the magazine manually</td></tr>
                  <tr><td><span class="key">1</span><span class="key">2</span><span class="key">3</span><span class="key">4</span></td><td>Switch weapon slot</td></tr>
                  <tr><td><span class="key">ESC</span></td><td>Pause or resume the battle</td></tr>
                </tbody>
              </table>
              <div class="note">THE TURRET IS LOCKED TO THE HULL. ROTATE THE TANK TO AIM — DRIVE WITH PURPOSE, NOT IN CIRCLES.</div>
            </div>
          </div>
          <div class="panel">
            <div class="panel__head"><span>WEAPON SYSTEMS</span><b>4 PLATFORMS</b></div>
            <div class="panel__body">${weaponRows}</div>
          </div>
          <div class="panel">
            <div class="panel__head"><span>COMBAT SYSTEMS</span><b>FIELD NOTES</b></div>
            <div class="panel__body">
              <ul class="tip-list">
                <li><b>Armor</b> absorbs 65% of incoming damage until it fails. It regenerates after six seconds without hits.</li>
                <li><b>Ammunition</b> is split into magazine and reserve. Reload manually when safe, or let the autoloader cycle.</li>
                <li><b>Supply crates</b> restore health, ammunition or a barrage charge. Drive over them to collect.</li>
                <li><b>Fuel barrels</b> and supply trucks explode, damaging everything nearby. Use them.</li>
                <li><b>Special ordnance</b> is limited to three HE barrages per deployment. Spend them on clustered armor.</li>
              </ul>
            </div>
          </div>
        </div>
        <div class="side-stack">
          <div class="panel">
            <div class="panel__head"><span>HOSTILE ARMOR</span><b>5 CLASSES</b></div>
            <div class="panel__body">${enemyRows}</div>
          </div>
          <div class="panel">
            <div class="panel__head"><span>FIELD TACTICS</span><b>RECOMMENDED</b></div>
            <div class="panel__body">
              <ul class="tip-list">
                <li>Keep hard cover between you and heavy armor while your gun cycles.</li>
                <li>Move after every shot. Static tanks are pre-registered artillery targets.</li>
                <li>Destroy convoy trucks and objective hardpoints first; escorts can wait.</li>
                <li>In survival, leave yourself an escape lane before the next wave closes in.</li>
                <li>Upgrade armor and autoloader early; mobility pays off on dense maps.</li>
              </ul>
            </div>
          </div>
          <div class="panel">
            <div class="panel__head"><span>PROGRESSION</span><b>PERMANENT</b></div>
            <div class="panel__body">
              <ul class="tip-list">
                <li>Operations award credits, stars and weapon unlocks. Better times and hull condition earn more.</li>
                <li>Mission 02 unlocks the heavy cannon, Mission 04 the autocannon and Mission 06 the rocket launcher.</li>
                <li>Survival records high score, best wave and total kills. Training certifies each drill.</li>
                <li>All progression is saved in this browser and survives page reloads.</li>
              </ul>
              <div class="pause__actions">
                ${btn('nav:armory', 'OPEN ARMORY', { variant: 'btn--primary', wide: true })}
                ${btn('nav:title', 'RETURN TO COMMAND', { variant: 'btn--ghost', wide: true })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>`
  );
}

/* ------------------------------------------------------------------ */
/* Pause                                                               */
/* ------------------------------------------------------------------ */

export function pauseScreen({ save, pause = {} }) {
  return screen(
    `<div class="pause">
      <div class="pause__title">PAUSED</div>
      <div class="pause__meta">${escapeHtml(pause.title || 'FIELD OPERATION')} // ${escapeHtml(
        pause.mapName || 'ACTIVE SECTOR'
      )} // ${escapeHtml((pause.mode || 'campaign').toUpperCase())}</div>
      <div class="pause__actions">
        ${btn('pause:resume', 'RESUME OPERATION', { variant: 'btn--primary', wide: true, index: 'ESC' })}
        ${btn('pause:restart', 'RESTART DEPLOYMENT', { variant: 'btn--ghost', wide: true, index: 'R' })}
        ${btn('pause:abort', 'ABORT TO COMMAND', { variant: 'btn--danger', wide: true, index: '!' })}
      </div>
      <div class="pause__keys">
        <span>W / S — DRIVE</span>
        <span>A / D — ROTATE</span>
        <span>SPACE — FIRE</span>
        <span>E — BARRAGE</span>
        <span>R — RELOAD</span>
        <span>1–4 — WEAPON</span>
        <span>ESC — RESUME</span>
        <span>${escapeHtml(getRank(save.state.stats.kills))} // ${formatNumber(save.state.credits)} CR</span>
      </div>
    </div>`,
    { overlay: true, extra: 'pause-screen' }
  );
}

/* ------------------------------------------------------------------ */
/* Results                                                             */
/* ------------------------------------------------------------------ */

export function resultsScreen({ save, results }) {
  const data = results || {};
  const stats = data.stats || {};
  const mode = data.mode || 'campaign';
  const victory = Boolean(data.victory);
  const mapName = data.mapName || getBattlefield(data.mapId || save.state.lastMap).name;
  const title = getResultTitle(mode, victory);
  const kicker = `${mode.toUpperCase()} // ${String(mapName).toUpperCase()} // ${
    victory ? 'OBJECTIVES COMPLETE' : 'OPERATION CLOSED'
  }`;

  const statCells =
    mode === 'survival'
      ? [
          ['FINAL SCORE', formatNumber(stats.score || 0)],
          ['WAVE REACHED', String(stats.wave || 0).padStart(2, '0')],
          ['HOSTILES DESTROYED', formatNumber(stats.kills || 0)],
          ['SURVIVAL TIME', formatTime(stats.time || 0)],
        ]
      : [
          ['FINAL SCORE', formatNumber(stats.score || 0)],
          ['HOSTILES DESTROYED', formatNumber(stats.kills || 0)],
          ['GUNNERY ACCURACY', `${stats.accuracy || 0}%`],
          ['MISSION TIME', formatTime(stats.time || 0)],
        ];

  const objectives = (data.objectives || [])
    .map((line) => `<div class="briefing__line">${escapeHtml(line)}</div>`)
    .join('');

  const rewards = [];
  if ((data.credits || 0) > 0) {
    rewards.push(`<span class="reward">+${formatNumber(data.credits)} CREDITS</span>`);
  }
  if (mode === 'campaign' && victory) {
    rewards.push(`<span class="reward">RATING ${starsString(stats.stars || 0)}</span>`);
  }
  if (data.weaponReward && WEAPONS[data.weaponReward]) {
    rewards.push(
      `<span class="reward reward--weapon">${
        data.weaponUnlocked ? 'NEW WEAPON' : 'WEAPON REWARD'
      } // ${escapeHtml(WEAPONS[data.weaponReward].name)}${
        data.weaponUnlocked ? '' : ' (ALREADY UNLOCKED)'
      }</span>`
    );
  }
  if (mode === 'survival') {
    if (data.newHighScore) rewards.push('<span class="reward">NEW HIGH SCORE</span>');
    if (data.newHighWave) rewards.push('<span class="reward">NEW BEST WAVE</span>');
    if (stats.highScore != null) {
      rewards.push(`<span class="reward">RECORD // ${formatNumber(stats.highScore)} PTS · WAVE ${stats.highWave || 0}</span>`);
    }
  }
  if (data.isCampaignEnd) {
    rewards.push('<span class="reward reward--weapon">CAMPAIGN COMPLETE // WARLORD DESTROYED</span>');
  }

  const actions = [];
  if (mode === 'campaign') {
    if (victory && data.nextMissionId) {
      actions.push(
        btn('results:next', 'NEXT OPERATION', {
          variant: 'btn--primary',
          data: `data-mission="${data.nextMissionId}"`,
          sub: String(data.nextMissionId).padStart(2, '0'),
        })
      );
    } else if (!victory) {
      actions.push(btn('results:replay', 'RETRY OPERATION', { variant: 'btn--primary' }));
    }
    actions.push(btn('results:armory', 'ARMORY', { variant: 'btn--ghost' }));
    actions.push(btn('results:command', 'COMMAND', { variant: 'btn--ghost' }));
  } else if (mode === 'survival') {
    actions.push(btn('results:replay', 'REDEPLOY', { variant: 'btn--primary' }));
    actions.push(btn('results:armory', 'ARMORY', { variant: 'btn--ghost' }));
    actions.push(btn('results:command', 'COMMAND', { variant: 'btn--ghost' }));
  } else {
    if (!victory) actions.push(btn('results:replay', 'RETRY RANGE', { variant: 'btn--primary' }));
    actions.push(btn('results:armory', 'ARMORY', { variant: 'btn--ghost' }));
    actions.push(btn('results:command', victory ? 'RETURN TO COMMAND' : 'COMMAND', { variant: 'btn--ghost' }));
  }

  return screen(
    `<div class="results ${victory ? 'results--victory' : 'results--defeat'}" role="dialog" aria-modal="true" aria-label="Operation results">
      <div class="results__head">
        <div class="results__kicker">${escapeHtml(kicker)}</div>
        <h1 class="results__title">${title}</h1>
        <div class="results__sub">${escapeHtml(
          data.reason || (victory ? 'All primary objectives have been secured.' : 'The operation has been terminated.')
        )}</div>
      </div>
      <div class="results__body">
        <div class="results__stats">
          ${statCells
            .map(
              ([label, value]) =>
                `<div class="results__stat"><span>${label}</span><b>${value}</b></div>`
            )
            .join('')}
        </div>
        ${objectives ? `<div class="divider"></div><div class="briefing__intel">${objectives}</div>` : ''}
        ${rewards.length ? `<div class="results__rewards">${rewards.join('')}</div>` : ''}
        <div class="results__actions">${actions.join('')}</div>
        <div class="note">PROGRESS SAVED AUTOMATICALLY // ${formatNumber(save.state.credits)} CREDIT BALANCE</div>
      </div>
    </div>`,
    { overlay: true, extra: 'results-screen' }
  );
}

function getResultTitle(mode, victory) {
  if (mode === 'campaign') {
    return victory ? 'MISSION <span>ACCOMPLISHED</span>' : 'MISSION <span>FAILED</span>';
  }
  if (mode === 'survival') {
    return 'RUN <span>TERMINATED</span>';
  }
  return victory ? 'CREW <span>CERTIFIED</span>' : 'RANGE <span>FAILED</span>';
}
