import Phaser from 'phaser';
import { DEPTH } from '../config/constants.js';
import { pointInRect, segmentIntersectsRect } from '../core/Utils.js';

/**
 * Builds a battlefield from data: ground, roads, decor, solid obstacles and boundary trim.
 * Also owns the collision/LOS geometry used by the AI.
 */
export class MapBuilder {
  constructor(scene, def, quality) {
    this.scene = scene;
    this.def = def;
    this.quality = quality;
    this.obstacles = [];
    this.objectiveObjects = {};
    this.obstacleGroup = scene.physics.add.staticGroup();
    this.ground = null;
    this.roadGraphics = null;
    this.ambientDust = null;
    this.shadowRects = [];
  }

  build() {
    const { scene, def } = this;
    const { width, height } = def;

    scene.physics.world.setBounds(0, 0, width, height);
    scene.cameras.main.setBounds(0, 0, width, height);
    scene.cameras.main.setBackgroundColor(def.groundColor);

    // Tiled ground.
    this.ground = scene.add
      .tileSprite(0, 0, width, height, def.ground)
      .setOrigin(0)
      .setDepth(DEPTH.ground);

    this.drawRoads();

    // Non-colliding ground detail.
    const decalFactor = this.quality.decals ?? 1;
    const decor = def.decor || [];
    for (let i = 0; i < decor.length; i++) {
      if (decalFactor < 1 && i % 3 !== 0) continue;
      const d = decor[i];
      scene.add
        .image(d.x, d.y, d.texture)
        .setScale(d.scale || 1)
        .setRotation(d.rotation || 0)
        .setAlpha(d.alpha ?? 1)
        .setDepth(DEPTH.decal);
    }

    // Obstacles.
    for (const data of def.obstacles || []) {
      this.addObstacle(data);
    }

    this.drawBoundary();
    this.createAmbientDust();

    return this;
  }

  drawRoads() {
    const { scene, def } = this;
    const { width, height } = def;
    const g = scene.add.graphics();
    g.setDepth(DEPTH.road);

    for (const road of def.roads || []) {
      g.fillStyle(def.roadColor, 1);
      g.fillRect(road.x, road.y, road.w, road.h);

      // Edge dust / shoulder.
      g.fillStyle(0x000000, 0.12);
      if (road.w > road.h) {
        g.fillRect(road.x, road.y, road.w, 4);
        g.fillRect(road.x, road.y + road.h - 4, road.w, 4);
      } else {
        g.fillRect(road.x, road.y, 4, road.h);
        g.fillRect(road.x + road.w - 4, road.y, 4, road.h);
      }

      if (road.type === 'dirt') {
        // Wheel ruts on dirt tracks.
        g.lineStyle(2, 0x3f3524, 0.28);
        if (road.w > road.h) {
          for (const off of [-22, 22]) {
            g.beginPath();
            g.moveTo(road.x + 10, road.y + road.h / 2 + off);
            g.lineTo(road.x + road.w - 10, road.y + road.h / 2 + off);
            g.strokePath();
          }
        } else {
          for (const off of [-22, 22]) {
            g.beginPath();
            g.moveTo(road.x + road.w / 2 + off, road.y + 10);
            g.lineTo(road.x + road.w / 2 + off, road.y + road.h - 10);
            g.strokePath();
          }
        }
      } else {
        // Dashed lane marking.
        g.lineStyle(2, 0xd8c69a, 0.22);
        if (road.w > road.h) {
          const y = road.y + road.h / 2;
          for (let x = road.x + 30; x < road.x + road.w - 30; x += 70) {
            g.beginPath();
            g.moveTo(x, y);
            g.lineTo(x + 32, y);
            g.strokePath();
          }
        } else {
          const x = road.x + road.w / 2;
          for (let y = road.y + 30; y < road.y + road.h - 30; y += 70) {
            g.beginPath();
            g.moveTo(x, y);
            g.lineTo(x, y + 32);
            g.strokePath();
          }
        }
        // Pothole / wear patches.
        for (let i = 0; i < 22; i++) {
          const px = road.x + Math.random() * road.w;
          const py = road.y + Math.random() * road.h;
          g.fillStyle(0x000000, 0.14);
          g.fillEllipse(px, py, 10 + Math.random() * 26, 6 + Math.random() * 12);
        }
      }
    }

    // Crosswalk hints for city maps.
    if (def.id === 'city') {
      g.lineStyle(5, 0xc8b48a, 0.15);
      for (const y of [520, 1800]) {
        for (let x = 740; x < 1500; x += 48) {
          g.beginPath();
          g.moveTo(x, y + 12);
          g.lineTo(x, y + 100);
          g.strokePath();
        }
      }
    }

    this.roadGraphics = g;

    // Subtle dust haze over the whole battlefield.
    const haze = scene.add.rectangle(width / 2, height / 2, width, height, def.groundColor, 0.06);
    haze.setDepth(DEPTH.decal + 1);
  }

  drawBoundary() {
    const { scene, def } = this;
    const { width, height } = def;
    const g = scene.add.graphics();
    g.setDepth(7000);

    g.fillStyle(def.edgeColor, 1);
    g.fillRect(0, 0, width, 26);
    g.fillRect(0, height - 26, width, 26);
    g.fillRect(0, 0, 26, height);
    g.fillRect(width - 26, 0, 26, height);

    // Hazard ticks.
    g.lineStyle(2, 0xc8b48a, 0.18);
    for (let x = 60; x < width; x += 80) {
      g.beginPath();
      g.moveTo(x, 4);
      g.lineTo(x + 24, 20);
      g.moveTo(x + 24, 4);
      g.lineTo(x, 20);
      g.strokePath();
      g.beginPath();
      g.moveTo(x, height - 20);
      g.lineTo(x + 24, height - 4);
      g.moveTo(x + 24, height - 20);
      g.lineTo(x, height - 4);
      g.strokePath();
    }
    for (let y = 60; y < height; y += 80) {
      g.beginPath();
      g.moveTo(4, y);
      g.lineTo(20, y + 24);
      g.moveTo(20, y);
      g.lineTo(4, y + 24);
      g.strokePath();
      g.beginPath();
      g.moveTo(width - 20, y);
      g.lineTo(width - 4, y + 24);
      g.moveTo(width - 20, y + 24);
      g.lineTo(width - 4, y);
      g.strokePath();
    }
  }

  createAmbientDust() {
    const { scene, def } = this;
    const count = Math.round((this.quality.particles ?? 1) * 5);
    if (count <= 0) return;
    for (let i = 0; i < count; i++) {
      const dust = scene.add
        .image(Math.random() * def.width, Math.random() * def.height, 'fx_menu_dust')
        .setDepth(6500)
        .setAlpha(0)
        .setScale(3 + Math.random() * 4);
      scene.tweens.add({
        targets: dust,
        alpha: { from: 0, to: 0.12 + Math.random() * 0.12 },
        x: dust.x + 300 + Math.random() * 400,
        duration: 9000 + Math.random() * 9000,
        repeat: -1,
        delay: Math.random() * 8000,
        yoyo: false,
        onRepeat: () => {
          dust.x = -80;
          dust.y = Math.random() * def.height;
          dust.alpha = 0;
        },
      });
    }
  }

  addObstacle(data) {
    const { scene } = this;
    const texture = data.type;
    if (!scene.textures.exists(texture)) {
      console.warn(`[MapBuilder] Missing texture for obstacle "${texture}"`);
      return null;
    }

    const image = this.obstacleGroup.create(data.x, data.y, texture);
    image.setDisplaySize(data.w, data.h);
    image.refreshBody();
    image.setDepth(data.y);
    if (data.rotation) image.setAngle(Phaser.Math.RadToDeg(data.rotation));

    image.setData('type', data.type);
    image.setData('solid', data.solid !== false);
    image.setData('destructible', Boolean(data.destructible));
    image.setData('explosive', Boolean(data.explosive));
    image.setData('hp', data.hp || 0);
    image.setData('maxHp', data.hp || 0);
    image.setData('objTag', data.objTag || null);
    image.setData('baseWidth', data.w);
    image.setData('baseHeight', data.h);

    // Large structures get a soft cast shadow.
    if (/building|warehouse|ruin|bunker|base|outpost|tent/.test(data.type)) {
      const shadow = scene.add
        .rectangle(data.x + 10, data.y + 12, data.w * 0.98, data.h * 0.98, 0x000000, 0.16)
        .setDepth(data.y - 0.5);
      this.shadowRects.push(shadow);
      image.setData('shadowObj', shadow);
    }

    if (data.objTag) {
      if (!this.objectiveObjects[data.objTag]) this.objectiveObjects[data.objTag] = [];
      this.objectiveObjects[data.objTag].push(image);
    }

    const record = {
      obj: image,
      type: data.type,
      x: data.x,
      y: data.y,
      w: data.w,
      h: data.h,
      solid: data.solid !== false,
      destructible: Boolean(data.destructible),
      explosive: Boolean(data.explosive),
      hp: data.hp || 0,
      maxHp: data.hp || 0,
      objTag: data.objTag || null,
      alive: true,
    };
    this.obstacles.push(record);

    // Slightly flash destructible structures when damaged.
    return image;
  }

  removeObstacle(image) {
    const record = this.obstacles.find((o) => o.obj === image);
    if (record) record.alive = false;

    for (const tag of Object.keys(this.objectiveObjects)) {
      this.objectiveObjects[tag] = this.objectiveObjects[tag].filter((o) => o !== image && o.active);
    }

    const shadow = image.getData('shadowObj');
    if (shadow) shadow.destroy();

    if (image.body) image.body.enable = false;
    image.destroy();
  }

  getObjectives(tag) {
    return (this.objectiveObjects[tag] || []).filter((o) => o.active);
  }

  hasLineOfSight(x1, y1, x2, y2) {
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);

    for (const o of this.obstacles) {
      if (!o.alive || !o.solid) continue;
      // Cheap broad phase.
      if (o.x + o.w / 2 < minX || o.x - o.w / 2 > maxX || o.y + o.h / 2 < minY || o.y - o.h / 2 > maxY) {
        continue;
      }
      if (segmentIntersectsRect(x1, y1, x2, y2, o.x, o.y, o.w, o.h)) return false;
    }
    return true;
  }

  isPointBlocked(x, y, pad = 0) {
    if (x < 30 + pad || y < 30 + pad || x > this.def.width - 30 - pad || y > this.def.height - 30 - pad) return true;
    for (const o of this.obstacles) {
      if (!o.alive || !o.solid) continue;
      if (pointInRect(x, y, o.x, o.y, o.w + pad * 2, o.h + pad * 2)) return true;
    }
    return false;
  }

  /** Samples a point that is not inside an obstacle. */
  findOpenPoint(px, py, radius = 500, pad = 40, tries = 40) {
    for (let i = 0; i < tries; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * radius;
      const x = Phaser.Math.Clamp(px + Math.cos(angle) * dist, 80, this.def.width - 80);
      const y = Phaser.Math.Clamp(py + Math.sin(angle) * dist, 80, this.def.height - 80);
      if (!this.isPointBlocked(x, y, pad)) return { x, y };
    }
    // Deterministic fallback scan.
    for (let y = 120; y < this.def.height - 120; y += 80) {
      for (let x = 120; x < this.def.width - 120; x += 80) {
        if (!this.isPointBlocked(x, y, pad)) return { x, y };
      }
    }
    return { x: this.def.width / 2, y: this.def.height / 2 };
  }

  /** Picks an enemy spawn far enough from the player. */
  findEnemySpawn(playerX, playerY, minDistance = 700) {
    const candidates = (this.def.enemySpawns || [])
      .filter((p) => Math.hypot(p.x - playerX, p.y - playerY) > minDistance)
      .sort(() => Math.random() - 0.5);
    for (const c of candidates) {
      if (!this.isPointBlocked(c.x, c.y, 45)) return { x: c.x, y: c.y };
    }
    // Random valid point.
    for (let i = 0; i < 60; i++) {
      const x = 120 + Math.random() * (this.def.width - 240);
      const y = 120 + Math.random() * (this.def.height - 240);
      if (Math.hypot(x - playerX, y - playerY) < minDistance) continue;
      if (!this.isPointBlocked(x, y, 45)) return { x, y };
    }
    return this.findOpenPoint(this.def.width / 2, this.def.height / 2, 300, 60);
  }

  findSpawnNear(x, y, radius = 160) {
    for (let i = 0; i < 30; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * radius;
      const px = Phaser.Math.Clamp(x + Math.cos(angle) * dist, 80, this.def.width - 80);
      const py = Phaser.Math.Clamp(y + Math.sin(angle) * dist, 80, this.def.height - 80);
      if (!this.isPointBlocked(px, py, 35)) return { x: px, y: py };
    }
    return this.findOpenPoint(x, y, 220, 40);
  }

  /** Returns a small, cheap minimap obstacle list (large structures only). */
  getMinimapObstacles() {
    return this.obstacles
      .filter((o) => o.alive && (o.w > 70 || o.h > 70) && !/tree|survivor/.test(o.type))
      .map((o) => ({ x: o.x, y: o.y, w: o.w, h: o.h, type: o.type }));
  }
}
