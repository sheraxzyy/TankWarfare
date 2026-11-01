import Phaser from 'phaser';
import { Tank } from './Tank.js';
import { clamp, damp } from '../core/Utils.js';
import { WEAPONS, WEAPON_ORDER, SPECIAL_ORDNANCE, getWeaponRuntime } from '../config/weapons.js';

/**
 * Player-controlled main battle tank.
 *
 * Keyboard-only control model:
 *  - W / S      accelerate forward / reverse
 *  - A / D      rotate hull (turret is locked to the hull)
 *  - SPACE      fire the selected weapon
 *  - E          three-shell HE barrage
 *  - R          manual reload
 *  - 1..4       switch weapon
 *
 * Ammunition is tracked per weapon as a clip plus a reserve. If every round is
 * spent the crew scavenges a couple of shells after a short delay so a run can
 * never soft-lock with an empty gun.
 */
export class PlayerTank extends Tank {
  constructor(scene, x, y, { save, allWeapons = false, training = false } = {}) {
    const upgrades = save?.state.upgrades || {};
    const engineBonus = 1 + (upgrades.engine || 0) * 0.07;
    const armorPlate = 70 + (upgrades.armor || 0) * 15;

    super(scene, x, y, 'hull_player', 'turret_player', {
      maxHealth: 165,
      maxArmor: armorPlate,
      armorRegen: 2.4,
      maxSpeed: 182 * engineBonus,
      reverseSpeed: 104 * engineBonus,
      accel: 280 * engineBonus,
      rotSpeed: 2.15,
      turretSpeed: 5.6,
      bodyRadius: 28,
      displayName: 'M1 ABRAMS',
      type: 'player',
    });

    this.save = save;
    this.training = training;
    this.upgrades = { ...upgrades };
    this.allWeapons = allWeapons;
    this.unlockedWeapons = allWeapons ? [...WEAPON_ORDER] : [...(save?.state.unlockedWeapons || ['standard'])];
    if (!this.unlockedWeapons.includes('standard')) this.unlockedWeapons.unshift('standard');

    this.inventory = {};
    for (const id of WEAPON_ORDER) {
      const w = getWeaponRuntime(id, this.upgrades);
      this.inventory[id] = {
        clip: w.clipSize,
        reserve: Math.round(w.reserveMax * 0.78),
      };
    }

    const savedWeapon = save?.state.selectedWeapon;
    this.selectedWeapon = this.unlockedWeapons.includes(savedWeapon) ? savedWeapon : 'standard';
    this.weaponRuntime = getWeaponRuntime(this.selectedWeapon, this.upgrades);

    this.cooldown = 0;
    this.reloadRemaining = 0;
    this.reloadTotal = 0;
    this.autoReloadDelay = 0;
    this.emergencyTimer = 0;
    this.emergencyArmed = false;

    this.specialCharges = SPECIAL_ORDNANCE.charges;
    this.specialMax = SPECIAL_ORDNANCE.charges;
    this.specialCooldown = 0;

    this.shotsFired = 0;
    this.reloadsCompleted = 0;
    this.kills = 0;
    this.distanceTravelled = 0;
    this.rotationAccum = 0;
    this.lastX = x;
    this.lastY = y;

    this.turretAngle = this.rotation;
    this.speed = 0;
    this.isDead = false;
    this.runOver = false;

    this.setScale(1.04);
    this.body.setCircle(30, this.width / 2 - 30, this.height / 2 - 30);
    this.body.setMaxVelocity(320, 320);
  }

  get ammo() {
    return this.inventory[this.selectedWeapon];
  }

  get isReloading() {
    return this.reloadRemaining > 0;
  }

  get reloadProgress() {
    if (!this.isReloading || this.reloadTotal <= 0) return 1;
    return clamp(1 - this.reloadRemaining / this.reloadTotal, 0, 1);
  }

  get speedRatio() {
    return clamp(Math.abs(this.speed) / this.maxSpeed, 0, 1);
  }

  /* ------------------------------------------------------------------ */
  /* Update                                                              */
  /* ------------------------------------------------------------------ */

  update(dt, input) {
    if (!this.alive || this.runOver) return;

    dt = Math.min(dt, 0.05);
    this.updateDamageState(dt);

    this.cooldown = Math.max(0, this.cooldown - dt);
    this.specialCooldown = Math.max(0, this.specialCooldown - dt);

    this._updateMovement(dt, input);
    this._updateReload(dt);
    this._updateEmergencyAmmo(dt);

    // Turret stays locked to the hull — no mouse aim.
    this.turretAngle = this.rotation;

    if (input.fire && this.cooldown <= 0) this.fire();
    if (input.special) this.fireSpecial();

    this.updateVisuals();
  }

  _updateMovement(dt, input) {
    const forward = (input.forward ? 1 : 0) - (input.reverse ? 1 : 0);
    const turn = (input.right ? 1 : 0) - (input.left ? 1 : 0);

    if (turn !== 0) {
      const step = turn * this.rotSpeed * dt;
      this.rotation += step;
      this.rotationAccum += Math.abs(step);
    }

    const targetSpeed = forward > 0 ? this.maxSpeed : forward < 0 ? -this.reverseSpeed : 0;
    const lambda = forward !== 0 ? 4.2 : 7.2;
    this.speed = damp(this.speed, targetSpeed, lambda, dt);
    if (Math.abs(this.speed) < 1.5 && forward === 0) this.speed = 0;

    const vx = Math.cos(this.rotation) * this.speed;
    const vy = Math.sin(this.rotation) * this.speed;
    this.body.setVelocity(vx, vy);

    const moved = Phaser.Math.Distance.Between(this.lastX, this.lastY, this.x, this.y);
    if (moved > 0.01) {
      this.distanceTravelled += moved;
      this.lastX = this.x;
      this.lastY = this.y;
    }

    // Track dust.
    if (Math.abs(this.speed) > this.maxSpeed * 0.28) {
      this.dustTimer -= dt;
      if (this.dustTimer <= 0) {
        this.dustTimer = 0.1 + Math.random() * 0.08;
        const back = this.rotation + Math.PI;
        this.scene.effects.dust(this.x + Math.cos(back) * 30, this.y + Math.sin(back) * 30);
      }
    }
  }

  _updateReload(dt) {
    if (this.reloadRemaining > 0) {
      this.reloadRemaining -= dt;
      if (this.reloadRemaining <= 0) {
        this.reloadRemaining = 0;
        this._finishReload();
      }
      return;
    }

    if (this.ammo.clip <= 0) {
      if (this.ammo.reserve > 0) {
        this.autoReloadDelay -= dt;
        if (this.autoReloadDelay <= 0) this.startReload(false);
      }
    } else {
      this.autoReloadDelay = 0.45;
    }
  }

  _updateEmergencyAmmo(dt) {
    const total = this.ammo.clip + this.ammo.reserve;
    if (total > 0) {
      this.emergencyTimer = 0;
      this.emergencyArmed = false;
      return;
    }
    if (this.reloadRemaining > 0) return;

    this.emergencyTimer += dt;
    if (!this.emergencyArmed && this.emergencyTimer > 1.6) {
      this.emergencyArmed = true;
      this.scene.game.events.emit('hud:notify', {
        text: 'AMMUNITION EXHAUSTED — SCAVENGING ROUNDS',
        kind: 'danger',
      });
    }
    if (this.emergencyTimer > 4.2) {
      this.emergencyTimer = 0;
      this.emergencyArmed = false;
      this.ammo.reserve += 3;
      this.scene.game.events.emit('hud:notify', {
        text: 'CREW SCAVENGED 3 ROUNDS',
        kind: 'warn',
      });
      this.scene.audio.pickup('ammo');
    }
  }

  /* ------------------------------------------------------------------ */
  /* Weapons                                                             */
  /* ------------------------------------------------------------------ */

  fire() {
    if (!this.alive || this.isReloading || this.cooldown > 0) return false;

    if (this.ammo.clip <= 0) {
      if (this.ammo.reserve > 0) this.startReload(true);
      return false;
    }

    const weapon = this.weaponRuntime;
    const spread = (Math.random() - 0.5) * weapon.spread * 2;
    const angle = this.turretAngle + spread;
    const muzzle = this.getMuzzlePosition(angle);

    this.scene.combat.firePlayerShell(this, this.selectedWeapon, {
      x: muzzle.x,
      y: muzzle.y,
      angle,
    });

    this.ammo.clip -= 1;
    this.shotsFired += 1;
    this.cooldown = weapon.cooldown / 1000;
    this.autoReloadDelay = 0.55;

    this.scene.audio.fire(this.selectedWeapon);
    this.scene.effects.muzzleFlash(muzzle.x, muzzle.y, angle, this.selectedWeapon === 'rapid' ? 0.55 : 1);
    this.scene.effects.cameraShake(this.selectedWeapon === 'heavy' ? 0.004 : 0.0025, 90);
    if (this.save) this.save.recordShot();

    if (this.ammo.clip === 0 && this.ammo.reserve > 0) {
      this.scene.game.events.emit('hud:notify', { text: 'MAGAZINE EMPTY — RELOADING', kind: 'warn' });
    }
    return true;
  }

  fireSpecial() {
    if (!this.alive || this.specialCooldown > 0) return false;
    if (this.specialCharges <= 0) {
      this.scene.game.events.emit('hud:notify', { text: 'HE BARRAGE UNAVAILABLE', kind: 'warn' });
      return false;
    }

    this.specialCharges -= 1;
    this.specialCooldown = SPECIAL_ORDNANCE.cooldown / 1000;

    const spread = SPECIAL_ORDNANCE.spread;
    const angles = [this.turretAngle - spread, this.turretAngle, this.turretAngle + spread];
    angles.forEach((angle, index) => {
      this.scene.time.delayedCall(index * 75, () => {
        if (!this.alive) return;
        const muzzle = this.getMuzzlePosition(angle);
        this.scene.combat.fireSpecialShell(this, {
          x: muzzle.x,
          y: muzzle.y,
          angle,
        });
        this.scene.effects.muzzleFlash(muzzle.x, muzzle.y, angle, 1.15);
      });
    });

    this.scene.audio.fire('heavy');
    this.scene.effects.cameraShake(0.006, 180);
    this.scene.game.events.emit('hud:notify', {
      text: `HE BARRAGE FIRED — ${this.specialCharges} CHARGE${this.specialCharges === 1 ? '' : 'S'} LEFT`,
      kind: 'good',
    });
    return true;
  }

  startReload(manual = false) {
    if (!this.alive || this.isReloading) return false;
    if (this.ammo.clip >= this.weaponRuntime.clipSize) return false;
    if (this.ammo.reserve <= 0) {
      if (manual) this.scene.game.events.emit('hud:notify', { text: 'NO RESERVE AMMUNITION', kind: 'danger' });
      return false;
    }

    this.reloadTotal = this.weaponRuntime.reloadTime / 1000;
    this.reloadRemaining = this.reloadTotal;
    this.scene.audio.reload(this.selectedWeapon === 'heavy' || this.selectedWeapon === 'rocket');
    if (manual) this.scene.game.events.emit('hud:notify', { text: 'RELOADING', kind: 'warn' });
    return true;
  }

  _finishReload() {
    const need = this.weaponRuntime.clipSize - this.ammo.clip;
    const take = Math.min(need, this.ammo.reserve);
    this.ammo.clip += take;
    this.ammo.reserve -= take;
    this.reloadsCompleted += 1;
    this.scene.audio.reload(this.selectedWeapon === 'heavy' || this.selectedWeapon === 'rocket');
  }

  switchWeapon(id) {
    if (!this.alive) return false;
    if (!WEAPONS[id]) return false;
    if (!this.unlockedWeapons.includes(id)) {
      this.scene.game.events.emit('hud:notify', {
        text: `${WEAPONS[id].name} IS LOCKED`,
        kind: 'warn',
      });
      return false;
    }
    if (id === this.selectedWeapon) return false;

    this.selectedWeapon = id;
    this.weaponRuntime = getWeaponRuntime(id, this.upgrades);
    this.reloadRemaining = 0;
    this.reloadTotal = 0;
    this.cooldown = Math.max(this.cooldown, 0.25);
    this.autoReloadDelay = 0.45;
    this.scene.audio.ui('click');
    this.scene.game.events.emit('hud:notify', {
      text: `WEAPON SELECTED — ${this.weaponRuntime.name}`,
      kind: 'good',
    });
    return true;
  }

  cycleWeapon(direction = 1) {
    const available = WEAPON_ORDER.filter((id) => this.unlockedWeapons.includes(id));
    if (available.length <= 1) return false;
    const index = available.indexOf(this.selectedWeapon);
    const next = available[(index + direction + available.length) % available.length];
    return this.switchWeapon(next);
  }

  /* ------------------------------------------------------------------ */
  /* Damage / pickups                                                    */
  /* ------------------------------------------------------------------ */

  takeDamage(rawDamage, source = null) {
    if (!this.alive || this.runOver) return { absorbed: 0, hullDamage: 0 };
    const result = this.applyIncomingDamage(rawDamage);
    this.flashDamage();
    this.scene.audio.impact('metal');
    this.scene.game.events.emit('hud:damage', { amount: result.hullDamage, source });
    this.scene.effects.impact(this.x + Phaser.Math.Between(-14, 14), this.y + Phaser.Math.Between(-10, 10), 0, 'metal');
    this.scene.effects.cameraShake(0.004, 120);

    if (this.health <= 0) this.die();
    return result;
  }

  heal(amount) {
    const before = this.health;
    this.health = Math.min(this.maxHealth, this.health + amount);
    return this.health - before;
  }

  addAmmo(fraction = 0.35) {
    const w = this.weaponRuntime;
    const add = Math.max(2, Math.round(w.reserveMax * fraction));
    const before = this.ammo.reserve;
    this.ammo.reserve = Math.min(w.reserveMax, this.ammo.reserve + add);
    return this.ammo.reserve - before;
  }

  addSpecial() {
    const before = this.specialCharges;
    this.specialCharges = Math.min(this.specialMax, this.specialCharges + 1);
    return this.specialCharges > before;
  }

  addArmor(amount) {
    const before = this.armor;
    this.armor = Math.min(this.maxArmor, this.armor + amount);
    return this.armor - before;
  }

  die() {
    if (this.isDead) return;
    this.isDead = true;
    this.alive = false;
    this.speed = 0;
    this.body.stop();
    this.body.enable = false;

    this.scene.effects.tankDestroyed(this.x, this.y, true);
    this.scene.effects.cameraShake(0.014, 750);
    this.scene.audio.explosion(2.1);
    this.scene.audio.setEngine(false, 0);

    this.scene.add
      .image(this.x, this.y, 'wreck')
      .setRotation(this.rotation)
      .setDepth(this.y - 2)
      .setScale(1.25)
      .setAlpha(0.96);

    this.setVisible(false);
    this.turret.setVisible(false);
    this.shadow.setVisible(false);
    this.body.enable = false;

    this.scene.game.events.emit('player:destroyed', {
      x: this.x,
      y: this.y,
    });
  }

  /* ------------------------------------------------------------------ */
  /* HUD snapshot                                                        */
  /* ------------------------------------------------------------------ */

  getHudState() {
    const w = this.weaponRuntime;
    return {
      health: this.health,
      maxHealth: this.maxHealth,
      armor: this.armor,
      maxArmor: this.maxArmor,
      weapon: {
        id: this.selectedWeapon,
        name: w.name,
        short: w.short,
        code: w.code,
        clip: this.ammo.clip,
        clipSize: this.ammo.clipSize,
        reserve: this.ammo.reserve,
        reserveMax: w.reserveMax,
        reloading: this.isReloading,
        reloadProgress: this.reloadProgress,
      },
      special: {
        charges: this.specialCharges,
        max: this.specialMax,
        cooldown: this.specialCooldown,
      },
      weapons: WEAPON_ORDER.map((id) => ({
        id,
        short: WEAPONS[id].short,
        name: WEAPONS[id].name,
        unlocked: this.unlockedWeapons.includes(id),
      })),
      speed: Math.abs(this.speed),
      speedRatio: this.speedRatio,
    };
  }
}
