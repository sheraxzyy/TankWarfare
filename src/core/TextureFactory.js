/**
 * TextureFactory
 * Procedurally generates every visual in the game with the Canvas 2D API.
 * No external image files, no hotlinks, no third-party art licensing concerns.
 */

const TAU = Math.PI * 2;

function rr(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function poly(ctx, points) {
  ctx.beginPath();
  points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
}

function makeCanvas(scene, key, w, h, draw) {
  if (scene.textures.exists(key)) return;
  const texture = scene.textures.createCanvas(key, w, h);
  if (!texture) return;
  const ctx = texture.getContext();
  ctx.save();
  draw(ctx, w, h);
  ctx.restore();
  texture.refresh();
}

/* ---------------- shared drawing helpers ---------------- */

function noise(ctx, w, h, count, colors, size = 2) {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
    const s = size * (0.4 + Math.random() * 1.2);
    ctx.fillRect(Math.random() * w, Math.random() * h, s, s);
  }
}

function softCircle(ctx, x, y, radius, colorStops) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
  for (const [stop, color] of colorStops) g.addColorStop(stop, color);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, TAU);
  ctx.fill();
}

function shadowEllipse(ctx, cx, cy, rx, ry, alpha = 0.4) {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry));
  g.addColorStop(0, `rgba(0,0,0,${alpha})`);
  g.addColorStop(0.75, `rgba(0,0,0,${alpha * 0.6})`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, ry / rx);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/* ---------------- ground ---------------- */

function createGround(scene, key, palette, details) {
  makeCanvas(scene, key, 512, 512, (ctx, w, h) => {
    ctx.fillStyle = palette.base;
    ctx.fillRect(0, 0, w, h);

    // Large tonal patches.
    for (let i = 0; i < 26; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const r = 30 + Math.random() * 90;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, palette.patch);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }

    // Fine grain.
    noise(ctx, w, h, 2200, palette.grain, 1.6);
    noise(ctx, w, h, 700, palette.grain2, 2.2);

    if (details) details(ctx, w, h, palette);
  });
}

function drawDesertGround(ctx, w, h) {
  // Wind ripples.
  ctx.strokeStyle = 'rgba(120, 100, 66, 0.2)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 24; i++) {
    const y = Math.random() * h;
    ctx.beginPath();
    for (let x = 0; x <= w; x += 12) {
      const yy = y + Math.sin(x * 0.035 + i) * 2.2;
      if (x === 0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  // Small stones.
  for (let i = 0; i < 90; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(105,92,70,0.55)' : 'rgba(190,175,140,0.4)';
    ctx.beginPath();
    ctx.ellipse(x, y, 1 + Math.random() * 3, 1 + Math.random() * 2, Math.random() * 3, 0, TAU);
    ctx.fill();
  }
}

function drawForestGround(ctx, w, h) {
  for (let i = 0; i < 220; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.random() * TAU);
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(78,64,40,0.45)' : 'rgba(110,92,54,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 2 + Math.random() * 4, 1 + Math.random() * 2, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  for (let i = 0; i < 120; i++) {
    ctx.strokeStyle = 'rgba(94,112,64,0.4)';
    ctx.lineWidth = 1;
    const x = Math.random() * w;
    const y = Math.random() * h;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random() - 0.5) * 6, y - 4 - Math.random() * 6);
    ctx.stroke();
  }
}

function drawIndustrialGround(ctx, w, h) {
  // Concrete slabs and cracks.
  ctx.strokeStyle = 'rgba(40,42,38,0.35)';
  ctx.lineWidth = 2;
  for (let ix = 0; ix <= w; ix += 128) {
    ctx.beginPath();
    ctx.moveTo(ix, 0);
    ctx.lineTo(ix, h);
    ctx.stroke();
  }
  for (let iy = 0; iy <= h; iy += 128) {
    ctx.beginPath();
    ctx.moveTo(0, iy);
    ctx.lineTo(w, iy);
    ctx.stroke();
  }
  for (let i = 0; i < 30; i++) {
    let x = Math.random() * w;
    let y = Math.random() * h;
    ctx.strokeStyle = 'rgba(35,36,32,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let j = 0; j < 4; j++) {
      x += (Math.random() - 0.5) * 40;
      y += Math.random() * 25;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(30,32,28,0.35)' : 'rgba(120,118,104,0.2)';
    ctx.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 5, 2 + Math.random() * 4);
  }
}

function drawCityGround(ctx, w, h) {
  // Broken asphalt patches.
  for (let i = 0; i < 22; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const rw = 20 + Math.random() * 70;
    const rh = 12 + Math.random() * 40;
    ctx.fillStyle = 'rgba(52,50,45,0.4)';
    ctx.beginPath();
    ctx.ellipse(x, y, rw, rh, Math.random() * 3, 0, TAU);
    ctx.fill();
  }
  for (let i = 0; i < 340; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(160,154,140,0.35)' : 'rgba(45,45,41,0.4)';
    ctx.beginPath();
    ctx.arc(Math.random() * w, Math.random() * h, 1 + Math.random() * 5, 0, TAU);
    ctx.fill();
  }
  for (let i = 0; i < 18; i++) {
    ctx.strokeStyle = 'rgba(30,30,27,0.35)';
    ctx.lineWidth = 1.4;
    const x = Math.random() * w;
    const y = Math.random() * h;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random() - 0.5) * 70, y + (Math.random() - 0.5) * 70);
    ctx.stroke();
  }
}

/* ---------------- tanks ---------------- */

const TANK_PALETTES = {
  player: {
    base: '#4e5938',
    light: '#68764b',
    dark: '#333a27',
    tread: '#1d2019',
    treadLight: '#3a3f32',
    accent: '#c8b48a',
    glass: '#9fb08a',
  },
  scout: {
    base: '#8b7956',
    light: '#a89670',
    dark: '#5c513a',
    tread: '#2b2820',
    treadLight: '#484334',
    accent: '#b23a2f',
    glass: '#d8c9a0',
  },
  assault: {
    base: '#5b6349',
    light: '#747d5c',
    dark: '#3b4130',
    tread: '#22251d',
    treadLight: '#414637',
    accent: '#b23a2f',
    glass: '#a9b798',
  },
  heavy: {
    base: '#414738',
    light: '#5a604d',
    dark: '#292d22',
    tread: '#171a14',
    treadLight: '#33382c',
    accent: '#c4762f',
    glass: '#8e9a7c',
  },
  elite: {
    base: '#3a4040',
    light: '#535b5b',
    dark: '#232828',
    tread: '#141818',
    treadLight: '#303636',
    accent: '#c03a2c',
    glass: '#7f9595',
  },
  boss: {
    base: '#413730',
    light: '#5c4e44',
    dark: '#241f1b',
    tread: '#131110',
    treadLight: '#2c2724',
    accent: '#c0392b',
    glass: '#8c7a68',
  },
};

function drawTreads(ctx, w, h, palette, heavy = false) {
  const treadH = h * (heavy ? 0.24 : 0.2);
  const inset = w * 0.035;
  const treadW = w - inset * 2;
  for (const y of [h * 0.04, h - h * 0.04 - treadH]) {
    rr(ctx, inset, y, treadW, treadH, treadH * 0.35);
    ctx.fillStyle = palette.tread;
    ctx.fill();
    ctx.strokeStyle = palette.treadLight;
    ctx.lineWidth = 1;
    ctx.stroke();

    const segments = heavy ? 12 : 10;
    for (let i = 1; i < segments; i++) {
      const sx = inset + (treadW / segments) * i;
      ctx.strokeStyle = 'rgba(255,255,255,0.055)';
      ctx.beginPath();
      ctx.moveTo(sx, y + 2);
      ctx.lineTo(sx, y + treadH - 2);
      ctx.stroke();
    }
    // Track highlight.
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath();
    ctx.moveTo(inset + 3, y + 2);
    ctx.lineTo(inset + treadW - 3, y + 2);
    ctx.stroke();
  }
}

function drawTankHull(ctx, w, h, palette, variant = 'player') {
  const heavy = variant === 'heavy' || variant === 'boss';
  const boss = variant === 'boss';
  drawTreads(ctx, w, h, palette, heavy);

  const bodyTop = h * (heavy ? 0.3 : 0.29);
  const bodyBottom = h * (heavy ? 0.7 : 0.71);
  const nose = w * 0.94;
  const tail = w * 0.1;

  // Hull silhouette with sloped glacis.
  poly(ctx, [
    [tail, bodyTop + 3],
    [w * 0.74, bodyTop],
    [nose, bodyTop + h * 0.1],
    [nose, bodyBottom - h * 0.1],
    [w * 0.74, bodyBottom],
    [tail, bodyBottom - 3],
    [tail + w * 0.03, (bodyTop + bodyBottom) / 2],
  ]);
  ctx.fillStyle = palette.base;
  ctx.fill();
  ctx.strokeStyle = palette.dark;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Upper plating highlight.
  ctx.save();
  ctx.globalAlpha = 0.34;
  poly(ctx, [
    [w * 0.14, bodyTop + 5],
    [w * 0.72, bodyTop + 2],
    [w * 0.9, bodyTop + h * 0.1],
    [w * 0.9, bodyTop + h * 0.17],
    [w * 0.2, bodyTop + h * 0.16],
  ]);
  ctx.fillStyle = palette.light;
  ctx.fill();
  ctx.restore();

  // Panel lines.
  ctx.strokeStyle = 'rgba(0,0,0,0.28)';
  ctx.lineWidth = 1;
  for (const px of [0.3, 0.46, 0.62]) {
    ctx.beginPath();
    ctx.moveTo(w * px, bodyTop + h * 0.08);
    ctx.lineTo(w * px, bodyBottom - h * 0.08);
    ctx.stroke();
  }

  // Engine deck grille at the rear.
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  rr(ctx, w * 0.13, bodyTop + h * 0.11, w * 0.13, (bodyBottom - bodyTop) * 0.62, 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  for (let i = 0; i < 5; i++) {
    const gy = bodyTop + h * 0.13 + i * ((bodyBottom - bodyTop) * 0.62) / 5;
    ctx.beginPath();
    ctx.moveTo(w * 0.14, gy);
    ctx.lineTo(w * 0.25, gy);
    ctx.stroke();
  }

  // Side stowage boxes.
  ctx.fillStyle = palette.dark;
  rr(ctx, w * 0.34, bodyTop - 2, w * 0.16, 7, 2);
  ctx.fill();
  rr(ctx, w * 0.34, bodyBottom - 5, w * 0.16, 7, 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  ctx.fillRect(w * 0.35, bodyTop - 1, w * 0.14, 1);
  ctx.fillRect(w * 0.35, bodyBottom - 4, w * 0.14, 1);

  // Headlights and glacis details.
  ctx.fillStyle = palette.glass;
  ctx.beginPath();
  ctx.arc(w * 0.86, h * 0.4, 2.6, 0, TAU);
  ctx.arc(w * 0.86, h * 0.6, 2.6, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.beginPath();
  ctx.moveTo(w * 0.68, bodyTop + 3);
  ctx.lineTo(w * 0.88, bodyTop + h * 0.12);
  ctx.stroke();

  // Faction / unit marking.
  ctx.save();
  ctx.translate(w * 0.5, h * 0.5);
  if (boss) {
    ctx.strokeStyle = palette.accent;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(-10, -7);
    ctx.lineTo(10, -7);
    ctx.lineTo(0, 9);
    ctx.closePath();
    ctx.stroke();
  } else {
    ctx.globalAlpha = 0.8;
    ctx.strokeStyle = palette.accent;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -5);
    ctx.lineTo(4, 3);
    ctx.lineTo(-4, 3);
    ctx.closePath();
    ctx.stroke();
  }
  ctx.restore();

  // Rivets.
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.arc(w * (0.28 + i * 0.09), bodyTop + 4, 1.1, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(w * (0.28 + i * 0.09), bodyBottom - 4, 1.1, 0, TAU);
    ctx.fill();
  }

  if (heavy) {
    // Additional armor blocks.
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.strokeRect(w * 0.22, bodyTop + 5, w * 0.09, bodyBottom - bodyTop - 10);
    ctx.strokeRect(w * 0.74, bodyTop + 6, w * 0.08, bodyBottom - bodyTop - 12);
  }
}

function drawTankTurret(ctx, w, h, palette, variant = 'player') {
  const cx = w * 0.5;
  const cy = h * 0.5;
  const boss = variant === 'boss';
  const radius = h * (boss ? 0.46 : 0.43);

  // Barrel first so the turret body overlaps it.
  const barrelW = h * (boss ? 0.2 : 0.16);
  const barrelLen = w * 0.44;
  ctx.fillStyle = palette.dark;
  ctx.fillRect(cx + radius * 0.3, cy - barrelW / 2, barrelLen, barrelW);
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = 1;
  ctx.strokeRect(cx + radius * 0.3, cy - barrelW / 2, barrelLen, barrelW);
  // Barrel highlight.
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(cx + radius * 0.3, cy - barrelW / 2 + 1, barrelLen, 1.4);

  // Muzzle brake.
  ctx.fillStyle = palette.base;
  rr(ctx, w - barrelW * 2.4, cy - barrelW * 0.78, barrelW * 1.7, barrelW * 1.56, 1.5);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  for (let i = 0; i < 2; i++) {
    ctx.beginPath();
    ctx.moveTo(w - barrelW * 2 + i * barrelW * 0.75, cy - barrelW * 0.78);
    ctx.lineTo(w - barrelW * 2 + i * barrelW * 0.75, cy + barrelW * 0.78);
    ctx.stroke();
  }

  // Turret body.
  ctx.fillStyle = palette.base;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = palette.dark;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Plating highlight arc.
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.72, Math.PI * 1.05, Math.PI * 1.68);
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = radius * 0.22;
  ctx.stroke();

  // Mantlet.
  ctx.fillStyle = palette.dark;
  rr(ctx, cx + radius * 0.45, cy - radius * 0.34, radius * 0.7, radius * 0.68, 3);
  ctx.fill();

  // Hatch and optics.
  ctx.fillStyle = palette.light;
  ctx.beginPath();
  ctx.arc(cx - radius * 0.18, cy - radius * 0.22, radius * 0.29, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.stroke();
  ctx.fillStyle = palette.dark;
  ctx.beginPath();
  ctx.arc(cx - radius * 0.18, cy - radius * 0.22, radius * 0.13, 0, TAU);
  ctx.fill();

  ctx.fillStyle = palette.glass;
  ctx.beginPath();
  ctx.arc(cx + radius * 0.18, cy + radius * 0.28, radius * 0.11, 0, TAU);
  ctx.fill();

  if (boss) {
    ctx.strokeStyle = palette.accent;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.62, -0.85, 0.85);
    ctx.stroke();
    // Secondary barrel.
    ctx.fillStyle = palette.dark;
    ctx.fillRect(cx + radius * 0.2, cy + radius * 0.28, w * 0.3, h * 0.1);
  } else if (variant === 'elite') {
    ctx.strokeStyle = palette.accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.56, -0.7, 0.7);
    ctx.stroke();
  }
}

/* ---------------- projectiles / effects ---------------- */

function createShell(scene, key, w, h, bodyColor, tipColor) {
  makeCanvas(scene, key, w, h, (ctx) => {
    const cy = h / 2;
    ctx.fillStyle = 'rgba(255,240,200,0.18)';
    ctx.beginPath();
    ctx.ellipse(w * 0.38, cy, w * 0.48, h * 0.42, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = bodyColor;
    rr(ctx, 1, cy - h * 0.22, w * 0.78, h * 0.44, h * 0.2);
    ctx.fill();
    ctx.fillStyle = tipColor;
    poly(ctx, [
      [w * 0.74, cy - h * 0.28],
      [w - 1, cy],
      [w * 0.74, cy + h * 0.28],
    ]);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillRect(w * 0.16, cy - h * 0.08, w * 0.5, 1);
  });
}

function createRocket(scene, key, w, h, tip) {
  makeCanvas(scene, key, w, h, (ctx) => {
    const cy = h / 2;
    softCircle(ctx, w * 0.32, cy, w * 0.4, [
      [0, 'rgba(255,190,110,0.5)'],
      [1, 'rgba(255,120,40,0)'],
    ]);
    // Fins.
    ctx.fillStyle = '#3d3f36';
    poly(ctx, [
      [w * 0.08, cy - h * 0.4],
      [w * 0.28, cy - h * 0.18],
      [w * 0.2, cy - h * 0.1],
      [w * 0.02, cy - h * 0.22],
    ]);
    ctx.fill();
    poly(ctx, [
      [w * 0.08, cy + h * 0.4],
      [w * 0.28, cy + h * 0.18],
      [w * 0.2, cy + h * 0.1],
      [w * 0.02, cy + h * 0.22],
    ]);
    ctx.fill();
    // Body.
    ctx.fillStyle = '#5a5e4c';
    rr(ctx, w * 0.18, cy - h * 0.2, w * 0.5, h * 0.4, h * 0.18);
    ctx.fill();
    // Warhead.
    ctx.fillStyle = tip;
    poly(ctx, [
      [w * 0.66, cy - h * 0.24],
      [w * 0.98, cy],
      [w * 0.66, cy + h * 0.24],
    ]);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillRect(w * 0.25, cy - h * 0.06, w * 0.36, 1.4);
  });
}

function createFx(scene) {
  makeCanvas(scene, 'fx_glow', 64, 64, (ctx) => {
    softCircle(ctx, 32, 32, 32, [
      [0, 'rgba(255,255,235,1)'],
      [0.25, 'rgba(255,205,120,0.95)'],
      [0.6, 'rgba(235,110,35,0.5)'],
      [1, 'rgba(180,40,0,0)'],
    ]);
  });

  makeCanvas(scene, 'fx_fire', 64, 64, (ctx) => {
    softCircle(ctx, 32, 32, 31, [
      [0, 'rgba(255,246,200,1)'],
      [0.3, 'rgba(255,170,60,0.9)'],
      [0.72, 'rgba(210,70,20,0.4)'],
      [1, 'rgba(120,20,0,0)'],
    ]);
  });

  makeCanvas(scene, 'fx_smoke', 96, 96, (ctx) => {
    // Layered soft blobs create a volumetric puff.
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * TAU;
      const r = Math.random() * 16;
      softCircle(ctx, 48 + Math.cos(a) * r, 48 + Math.sin(a) * r, 26 + Math.random() * 12, [
        [0, 'rgba(150,148,140,0.34)'],
        [0.6, 'rgba(110,108,102,0.2)'],
        [1, 'rgba(90,88,82,0)'],
      ]);
    }
  });

  makeCanvas(scene, 'fx_dust', 80, 80, (ctx) => {
    softCircle(ctx, 40, 40, 40, [
      [0, 'rgba(214,196,152,0.5)'],
      [0.55, 'rgba(190,170,130,0.24)'],
      [1, 'rgba(170,150,110,0)'],
    ]);
  });

  makeCanvas(scene, 'fx_spark', 16, 16, (ctx) => {
    ctx.fillStyle = 'rgba(255,225,150,1)';
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(11, 6);
    ctx.lineTo(16, 8);
    ctx.lineTo(11, 10);
    ctx.lineTo(8, 16);
    ctx.lineTo(5, 10);
    ctx.lineTo(0, 8);
    ctx.lineTo(5, 6);
    ctx.closePath();
    ctx.fill();
  });

  makeCanvas(scene, 'fx_debris', 12, 12, (ctx) => {
    ctx.fillStyle = '#2d2e27';
    poly(ctx, [
      [2, 1],
      [11, 3],
      [9, 11],
      [1, 9],
    ]);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(3, 3, 4, 1);
  });

  makeCanvas(scene, 'fx_ring', 160, 160, (ctx) => {
    ctx.strokeStyle = 'rgba(255,205,140,0.9)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(80, 80, 68, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(80, 80, 62, 0, TAU);
    ctx.stroke();
  });

  makeCanvas(scene, 'fx_flash', 160, 96, (ctx) => {
    const cx = 24;
    const cy = 48;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 70);
    g.addColorStop(0, 'rgba(255,255,240,1)');
    g.addColorStop(0.2, 'rgba(255,220,140,0.95)');
    g.addColorStop(0.55, 'rgba(255,140,50,0.5)');
    g.addColorStop(1, 'rgba(255,90,20,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(158, 24);
    ctx.lineTo(120, 48);
    ctx.lineTo(158, 72);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, 26, 0, TAU);
    ctx.fill();
  });

  makeCanvas(scene, 'fx_light', 512, 512, (ctx) => {
    softCircle(ctx, 256, 256, 256, [
      [0, 'rgba(255,240,205,0.5)'],
      [0.35, 'rgba(255,230,180,0.22)'],
      [0.7, 'rgba(200,200,160,0.06)'],
      [1, 'rgba(120,130,100,0)'],
    ]);
  });

  makeCanvas(scene, 'shadow_tank', 160, 110, (ctx) => {
    shadowEllipse(ctx, 80, 55, 62, 38, 0.55);
  });

  makeCanvas(scene, 'fx_glow_soft', 128, 128, (ctx) => {
    softCircle(ctx, 64, 64, 64, [
      [0, 'rgba(255,255,240,0.9)'],
      [0.25, 'rgba(255,210,130,0.45)'],
      [1, 'rgba(255,160,60,0)'],
    ]);
  });
}

/* ---------------- projectiles ---------------- */

function createProjectiles(scene) {
  createShell(scene, 'projectile_shell', 30, 10, '#c8b48a', '#fff3c0');
  createShell(scene, 'projectile_heavy_shell', 42, 14, '#b29561', '#ffd98a');
  createShell(scene, 'projectile_tracer', 22, 6, '#f0d080', '#fffbe0');
  createShell(scene, 'projectile_enemy_shell', 28, 9, '#b06a4a', '#ff9d5c');
  createRocket(scene, 'projectile_rocket', 56, 20, '#d8c08a');
  createRocket(scene, 'projectile_boss_rocket', 68, 24, '#d04a34');
}

/* ---------------- pickups ---------------- */

function createPickups(scene) {
  makeCanvas(scene, 'pickup_health', 56, 56, (ctx) => {
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    rr(ctx, 9, 11, 40, 40, 6);
    ctx.fill();
    ctx.fillStyle = '#3e4a32';
    rr(ctx, 7, 7, 42, 42, 6);
    ctx.fill();
    ctx.strokeStyle = '#97a36a';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#d8e0c4';
    ctx.fillRect(23, 15, 10, 26);
    ctx.fillRect(15, 23, 26, 10);
    ctx.strokeStyle = '#1b2416';
    ctx.lineWidth = 1;
    ctx.strokeRect(23, 15, 10, 26);
  });

  makeCanvas(scene, 'pickup_ammo', 56, 56, (ctx) => {
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    rr(ctx, 9, 11, 40, 40, 5);
    ctx.fill();
    ctx.fillStyle = '#5a5138';
    rr(ctx, 7, 7, 42, 42, 5);
    ctx.fill();
    ctx.strokeStyle = '#c8b48a';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#c8b48a';
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(15 + i * 9, 17, 5, 18);
      ctx.beginPath();
      ctx.moveTo(15 + i * 9, 17);
      ctx.lineTo(17.5 + i * 9, 12);
      ctx.lineTo(20 + i * 9, 17);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = '#2b2719';
    ctx.fillRect(13, 36, 30, 4);
  });

  makeCanvas(scene, 'pickup_special', 56, 56, (ctx) => {
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    rr(ctx, 9, 11, 40, 40, 5);
    ctx.fill();
    ctx.fillStyle = '#4a3a26';
    rr(ctx, 7, 7, 42, 42, 5);
    ctx.fill();
    ctx.strokeStyle = '#e5863b';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#e5863b';
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      const r = i % 2 === 0 ? 13 : 5;
      const x = 28 + Math.cos(a) * r;
      const y = 28 + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  });
}

/* ---------------- nature ---------------- */

function createNature(scene) {
  // Rocks
  for (let v = 1; v <= 3; v++) {
    makeCanvas(scene, `rock_${v}`, 180, 160, (ctx, w, h) => {
      shadowEllipse(ctx, 92, 92, 74, 52, 0.45);
      const points = [];
      const n = 8 + v;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU;
        const r = 52 + Math.sin(i * 2.1 + v) * 14 + (Math.random() - 0.5) * 12;
        points.push([w / 2 + Math.cos(a) * r, h / 2 - 5 + Math.sin(a) * r * 0.78]);
      }
      poly(ctx, points);
      ctx.fillStyle = v === 1 ? '#6e675a' : v === 2 ? '#7a6c58' : '#5e5c52';
      ctx.fill();
      ctx.strokeStyle = 'rgba(30,28,24,0.55)';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Light face.
      ctx.save();
      ctx.globalAlpha = 0.35;
      poly(ctx, points.slice(0, Math.floor(n / 2)).concat([[w * 0.5, h * 0.5]]));
      ctx.fillStyle = '#a39a88';
      ctx.fill();
      ctx.restore();

      // Cracks.
      ctx.strokeStyle = 'rgba(25,24,20,0.45)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        let x = w * (0.4 + Math.random() * 0.2);
        let y = h * (0.35 + Math.random() * 0.25);
        ctx.moveTo(x, y);
        ctx.lineTo(x + 10 + Math.random() * 18, y + 6 + Math.random() * 14);
        ctx.lineTo(x + 22 + Math.random() * 14, y + 4 + Math.random() * 20);
        ctx.stroke();
      }
      noise(ctx, w, h, 100, ['rgba(255,255,255,0.06)', 'rgba(0,0,0,0.08)'], 2);
    });
  }

  // Pine canopies
  for (let v = 1; v <= 3; v++) {
    makeCanvas(scene, `tree_${v}`, 180, 180, (ctx, w, h) => {
      shadowEllipse(ctx, 96, 104, 66, 54, 0.5);
      const cx = 86;
      const cy = 80;
      const layers = 4;
      const greens = v === 1 ? ['#32472d', '#3f5736', '#4c663f'] : v === 2 ? ['#2b3c28', '#374c31', '#435a39'] : ['#37462c', '#475a37', '#55683f'];
      for (let l = 0; l < layers; l++) {
        const r = 58 - l * 9;
        const offset = l * 3;
        ctx.fillStyle = greens[l % greens.length];
        ctx.beginPath();
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * TAU;
          const rad = r * (i % 2 === 0 ? 1 : 0.72);
          const x = cx + Math.cos(a) * rad;
          const y = cy + Math.sin(a) * rad * 0.9 - offset;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(15,25,12,0.35)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      // Trunk hint.
      ctx.fillStyle = 'rgba(55,42,28,0.8)';
      ctx.fillRect(cx - 4, h - 36, 8, 30);
      // Highlights.
      for (let i = 0; i < 30; i++) {
        const a = Math.random() * TAU;
        const r = Math.random() * 44;
        ctx.fillStyle = 'rgba(150,175,110,0.16)';
        ctx.fillRect(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 2, 2);
      }
    });
  }

  for (let v = 1; v <= 2; v++) {
    makeCanvas(scene, `bush_${v}`, 100, 90, (ctx, w, h) => {
      shadowEllipse(ctx, 52, 58, 34, 24, 0.35);
      for (let i = 0; i < 9; i++) {
        const x = 50 + (Math.random() - 0.5) * 44;
        const y = 44 + (Math.random() - 0.5) * 32;
        ctx.fillStyle = v === 1 ? (i % 2 ? 'rgba(62,84,48,0.9)' : 'rgba(74,96,56,0.9)') : 'rgba(80,92,54,0.9)';
        ctx.beginPath();
        ctx.arc(x, y, 8 + Math.random() * 9, 0, TAU);
        ctx.fill();
      }
    });
  }
}

/* ---------------- structures ---------------- */

function roofBase(ctx, w, h, base, edge, roof, variant = 0) {
  // Roof top.
  ctx.fillStyle = roof;
  ctx.fillRect(6, 6, w - 12, h - 12);
  // Parapet.
  ctx.strokeStyle = edge;
  ctx.lineWidth = 7;
  ctx.strokeRect(6, 6, w - 12, h - 12);
  ctx.strokeStyle = 'rgba(255,255,255,0.13)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(11, 11, w - 22, h - 22);
  // Corner towers.
  ctx.fillStyle = base;
  for (const [x, y] of [
    [4, 4],
    [w - 22, 4],
    [4, h - 22],
    [w - 22, h - 22],
  ]) {
    ctx.fillRect(x, y, 18, 18);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.strokeRect(x, y, 18, 18);
  }
  // Panel seams.
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 1;
  if (variant === 0) {
    for (let x = 40; x < w - 20; x += 52) {
      ctx.beginPath();
      ctx.moveTo(x, 12);
      ctx.lineTo(x, h - 12);
      ctx.stroke();
    }
  } else {
    for (let y = 30; y < h - 20; y += 38) {
      ctx.beginPath();
      ctx.moveTo(12, y);
      ctx.lineTo(w - 12, y);
      ctx.stroke();
    }
  }
}

function acUnit(ctx, x, y) {
  ctx.fillStyle = '#767b6d';
  rr(ctx, x, y, 26, 20, 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.stroke();
  ctx.fillStyle = '#3c4138';
  ctx.beginPath();
  ctx.arc(x + 13, y + 10, 6, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(x + 4, y + 4 + i * 5);
    ctx.lineTo(x + 22, y + 4 + i * 5);
    ctx.stroke();
  }
}

function createStructures(scene) {
  // Buildings
  const buildingStyles = [
    { base: '#807762', edge: '#5e5747', roof: '#9a8f73', variant: 0 },
    { base: '#6e7264', edge: '#484c41', roof: '#828878', variant: 1 },
    { base: '#7a6b52', edge: '#54493a', roof: '#91805f', variant: 0 },
  ];
  buildingStyles.forEach((style, i) => {
    makeCanvas(scene, `building_${i + 1}`, 300, 220, (ctx, w, h) => {
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(10, 12, w - 10, h - 10);
      roofBase(ctx, w, h, style.base, style.edge, style.roof, style.variant);
      // Rooftop clutter.
      acUnit(ctx, 38, 48);
      acUnit(ctx, w - 74, h - 70);
      // Skylight / vent.
      ctx.fillStyle = 'rgba(45,52,46,0.8)';
      rr(ctx, w * 0.42, h * 0.3, 62, 40, 3);
      ctx.fill();
      ctx.strokeStyle = 'rgba(180,190,170,0.25)';
      ctx.stroke();
      for (let x = w * 0.42 + 8; x < w * 0.42 + 60; x += 9) {
        ctx.beginPath();
        ctx.moveTo(x, h * 0.31);
        ctx.lineTo(x, h * 0.3 + 36);
        ctx.stroke();
      }
      // Water tank.
      ctx.fillStyle = '#4d5147';
      ctx.beginPath();
      ctx.arc(w * 0.8, h * 0.28, 18, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.stroke();
      // Pigeon / AC cables.
      ctx.strokeStyle = 'rgba(0,0,0,0.22)';
      ctx.beginPath();
      ctx.moveTo(20, h - 34);
      ctx.bezierCurveTo(w * 0.3, h - 50, w * 0.6, h - 22, w - 24, h - 46);
      ctx.stroke();
      noise(ctx, w, h, 250, ['rgba(0,0,0,0.05)', 'rgba(255,255,255,0.04)'], 2);
    });
  });

  makeCanvas(scene, 'warehouse', 340, 250, (ctx, w, h) => {
    ctx.fillStyle = 'rgba(0,0,0,0.24)';
    ctx.fillRect(12, 14, w - 12, h - 12);
    roofBase(ctx, w, h, '#5f6255', '#41443a', '#76796a', 1);
    // Corrugated roof.
    ctx.strokeStyle = 'rgba(0,0,0,0.16)';
    ctx.lineWidth = 2;
    for (let x = 20; x < w - 20; x += 12) {
      ctx.beginPath();
      ctx.moveTo(x, 12);
      ctx.lineTo(x, h - 12);
      ctx.stroke();
    }
    // Skylights.
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = 'rgba(140,160,150,0.35)';
      ctx.fillRect(52 + i * 62, 52, 42, 16);
      ctx.strokeStyle = 'rgba(30,36,32,0.6)';
      ctx.strokeRect(52 + i * 62, 52, 42, 16);
    }
    // Loading dock markings.
    ctx.strokeStyle = 'rgba(210,190,120,0.4)';
    ctx.lineWidth = 3;
    ctx.strokeRect(30, h - 74, 90, 50);
    ctx.strokeRect(w - 130, h - 74, 90, 50);
    // Vents.
    acUnit(ctx, w - 74, 34);
    acUnit(ctx, 34, h - 84);
    noise(ctx, w, h, 300, ['rgba(0,0,0,0.05)', 'rgba(255,255,255,0.035)'], 2);
  });

  const ruinStyle = (v) => {
    makeCanvas(scene, `ruin_${v}`, 300, 220, (ctx, w, h) => {
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(10, 14, w - 10, h - 10);
      // Broken footprint.
      const points = [
        [8, 20],
        [w * 0.42, 8],
        [w * 0.5, 26],
        [w - 24, 14],
        [w - 8, h * 0.55],
        [w - 30, h - 18],
        [w * 0.6, h - 8],
        [w * 0.52, h - 28],
        [24, h - 12],
        [14, h * 0.5],
      ];
      poly(ctx, points);
      ctx.fillStyle = v === 1 ? '#6d6759' : '#6a6b5f';
      ctx.fill();
      ctx.strokeStyle = '#3c3a32';
      ctx.lineWidth = 5;
      ctx.stroke();
      // Exposed floor / rubble hole.
      ctx.fillStyle = '#33322c';
      ctx.beginPath();
      ctx.ellipse(w * 0.58, h * 0.52, 46, 32, 0.4, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#5a5142';
      for (let i = 0; i < 16; i++) {
        const x = w * 0.5 + (Math.random() - 0.5) * 100;
        const y = h * 0.5 + (Math.random() - 0.5) * 70;
        ctx.fillRect(x, y, 4 + Math.random() * 10, 3 + Math.random() * 6);
      }
      // Broken beams.
      ctx.strokeStyle = 'rgba(40,35,28,0.8)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(w * 0.24, h * 0.28);
      ctx.lineTo(w * 0.66, h * 0.6);
      ctx.stroke();
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(w * 0.46, h * 0.18);
      ctx.lineTo(w * 0.36, h * 0.7);
      ctx.stroke();
      // Remaining parapet.
      ctx.strokeStyle = 'rgba(180,172,150,0.35)';
      ctx.lineWidth = 2;
      ctx.strokeRect(18, 18, w * 0.3, 6);
      // Scorch marks.
      ctx.fillStyle = 'rgba(30,26,22,0.35)';
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.ellipse(Math.random() * w, Math.random() * h, 12 + Math.random() * 24, 8 + Math.random() * 16, Math.random() * 3, 0, TAU);
        ctx.fill();
      }
      noise(ctx, w, h, 180, ['rgba(0,0,0,0.06)', 'rgba(255,255,255,0.04)'], 2);
    });
  };
  ruinStyle(1);
  ruinStyle(2);

  makeCanvas(scene, 'bunker', 200, 160, (ctx, w, h) => {
    shadowEllipse(ctx, w * 0.52, h * 0.62, 88, 56, 0.4);
    ctx.fillStyle = '#6b6a5c';
    rr(ctx, 16, 20, w - 32, h - 40, 12);
    ctx.fill();
    ctx.strokeStyle = '#3d3d34';
    ctx.lineWidth = 5;
    ctx.stroke();
    // Sloped armor ring.
    ctx.fillStyle = '#7b7969';
    rr(ctx, 28, 32, w - 56, h - 64, 8);
    ctx.fill();
    // Firing slit.
    ctx.fillStyle = '#191c17';
    rr(ctx, 40, h * 0.42, w - 80, 16, 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.stroke();
    // Hatch.
    ctx.fillStyle = '#4f5043';
    ctx.beginPath();
    ctx.arc(w * 0.5, h * 0.68, 18, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(w * 0.3, h * 0.72, 8, 14);
    noise(ctx, w, h, 160, ['rgba(0,0,0,0.06)', 'rgba(255,255,255,0.05)'], 2);
  });

  makeCanvas(scene, 'outpost', 160, 160, (ctx, w, h) => {
    shadowEllipse(ctx, w * 0.52, h * 0.56, 70, 56, 0.4);
    // Hardpoint base.
    ctx.fillStyle = '#55584a';
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + Math.PI / 8;
      const x = w / 2 + Math.cos(a) * 64;
      const y = h / 2 + Math.sin(a) * 58;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#2e3028';
    ctx.lineWidth = 4;
    ctx.stroke();
    // Concrete roof + hazard stripe.
    ctx.fillStyle = '#6c6e5d';
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 42, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#34362d';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.strokeStyle = '#a63a2c';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 34, -0.9, 0.9);
    ctx.stroke();
    // Antenna.
    ctx.strokeStyle = '#22241d';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(w * 0.58, h * 0.46);
    ctx.lineTo(w * 0.78, h * 0.2);
    ctx.stroke();
    ctx.fillStyle = '#d04a34';
    ctx.beginPath();
    ctx.arc(w * 0.78, h * 0.2, 4, 0, TAU);
    ctx.fill();
    // Sandbag ring.
    ctx.fillStyle = '#8a7b58';
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU;
      const x = w / 2 + Math.cos(a) * 56;
      const y = h / 2 + Math.sin(a) * 52;
      ctx.beginPath();
      ctx.ellipse(x, y, 12, 7, a, 0, TAU);
      ctx.fill();
    }
    noise(ctx, w, h, 150, ['rgba(0,0,0,0.07)', 'rgba(255,255,255,0.06)'], 2);
  });

  makeCanvas(scene, 'base', 240, 200, (ctx, w, h) => {
    shadowEllipse(ctx, w * 0.52, h * 0.6, 104, 72, 0.45);
    // Foundation.
    ctx.fillStyle = '#4d5143';
    rr(ctx, 18, 26, w - 36, h - 52, 8);
    ctx.fill();
    ctx.strokeStyle = '#2b2e25';
    ctx.lineWidth = 5;
    ctx.stroke();
    // Main roof.
    ctx.fillStyle = '#727566';
    rr(ctx, 32, 40, w - 64, h - 80, 6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Comms dish.
    ctx.strokeStyle = '#3a3d33';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(w * 0.68, h * 0.34, 22, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = '#9aa08d';
    ctx.beginPath();
    ctx.ellipse(w * 0.68, h * 0.34, 17, 11, -0.5, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#2b2e26';
    ctx.beginPath();
    ctx.arc(w * 0.68, h * 0.34, 4, 0, TAU);
    ctx.fill();
    // Antenna mast.
    ctx.strokeStyle = '#262820';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(w * 0.29, h * 0.55);
    ctx.lineTo(w * 0.29, h * 0.16);
    ctx.stroke();
    // Flag.
    ctx.fillStyle = '#b23a2f';
    poly(ctx, [
      [w * 0.29, h * 0.18],
      [w * 0.29 + 30, h * 0.22],
      [w * 0.29, h * 0.29],
    ]);
    ctx.fill();
    // HESCO barriers.
    ctx.fillStyle = '#95845f';
    for (let i = 0; i < 5; i++) {
      rr(ctx, 44 + i * 30, h - 60, 26, 24, 3);
      ctx.fill();
      ctx.strokeStyle = 'rgba(60,50,30,0.5)';
      ctx.stroke();
    }
    // Stripe.
    ctx.strokeStyle = '#d8c69a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(52, 52);
    ctx.lineTo(52, 62);
    ctx.stroke();
    noise(ctx, w, h, 200, ['rgba(0,0,0,0.06)', 'rgba(255,255,255,0.05)'], 2);
  });

  makeCanvas(scene, 'tent', 180, 130, (ctx, w, h) => {
    shadowEllipse(ctx, w * 0.52, h * 0.62, 80, 46, 0.35);
    ctx.fillStyle = '#7f785c';
    poly(ctx, [
      [12, h - 30],
      [w / 2, 16],
      [w - 12, h - 30],
      [w - 12, h - 18],
      [w / 2, h - 6],
      [12, h - 18],
    ]);
    ctx.fill();
    ctx.strokeStyle = '#4a4634';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.beginPath();
    ctx.moveTo(w / 2, 18);
    ctx.lineTo(w / 2, h - 8);
    ctx.stroke();
    // Ridge rope and pegs.
    ctx.strokeStyle = 'rgba(40,38,28,0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(w / 2, 18);
    ctx.lineTo(8, 4);
    ctx.moveTo(w / 2, 18);
    ctx.lineTo(w - 8, 4);
    ctx.stroke();
    // Entrance.
    ctx.fillStyle = 'rgba(35,34,26,0.65)';
    poly(ctx, [
      [w / 2 - 14, h - 14],
      [w / 2, h - 40],
      [w / 2 + 14, h - 14],
    ]);
    ctx.fill();
  });

  makeCanvas(scene, 'tower', 140, 140, (ctx, w, h) => {
    shadowEllipse(ctx, w * 0.54, h * 0.6, 58, 42, 0.4);
    // Legs.
    ctx.strokeStyle = '#3a382c';
    ctx.lineWidth = 5;
    for (const [x, y] of [
      [26, 26],
      [w - 26, 26],
      [26, h - 26],
      [w - 26, h - 26],
    ]) {
      ctx.beginPath();
      ctx.moveTo(w / 2, h / 2);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
    // Platform.
    ctx.fillStyle = '#6b644f';
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 40, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#3c382b';
    ctx.lineWidth = 4;
    ctx.stroke();
    // Railing.
    ctx.strokeStyle = 'rgba(210,195,155,0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 48, 0, TAU);
    ctx.stroke();
    // Roof.
    ctx.fillStyle = '#55513f';
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 24, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#8c8264';
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 12, 0, TAU);
    ctx.fill();
  });

  makeCanvas(scene, 'radar', 150, 150, (ctx, w, h) => {
    shadowEllipse(ctx, w * 0.52, h * 0.6, 50, 38, 0.35);
    ctx.fillStyle = '#4e5144';
    rr(ctx, w / 2 - 26, h / 2 - 20, 52, 44, 4);
    ctx.fill();
    ctx.strokeStyle = '#2c2e26';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Dish.
    ctx.save();
    ctx.translate(w / 2, h / 2 - 6);
    ctx.rotate(-0.4);
    ctx.fillStyle = '#a5a794';
    ctx.beginPath();
    ctx.ellipse(0, 0, 42, 18, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#4e5144';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.strokeStyle = '#6e7160';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-20, 0);
    ctx.lineTo(20, 0);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#d04a34';
    ctx.beginPath();
    ctx.arc(w / 2 + 30, h / 2 - 36, 4, 0, TAU);
    ctx.fill();
  });

  // Containers.
  const containerColors = [
    ['#7a4a38', '#5a3528'],
    ['#3f5560', '#2c3d45'],
    ['#56603d', '#3d452b'],
  ];
  containerColors.forEach(([c1, c2], i) => {
    makeCanvas(scene, `container_${i + 1}`, 120, 110, (ctx, w, h) => {
      ctx.fillStyle = 'rgba(0,0,0,0.24)';
      ctx.fillRect(6, 7, w - 4, h - 4);
      ctx.fillStyle = c1;
      rr(ctx, 4, 4, w - 8, h - 8, 2);
      ctx.fill();
      ctx.strokeStyle = c2;
      ctx.lineWidth = 3;
      ctx.stroke();
      // Corrugation.
      ctx.strokeStyle = 'rgba(0,0,0,0.22)';
      ctx.lineWidth = 1.5;
      for (let x = 12; x < w - 10; x += 8) {
        ctx.beginPath();
        ctx.moveTo(x, 8);
        ctx.lineTo(x, h - 8);
        ctx.stroke();
      }
      // Doors.
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 2;
      ctx.strokeRect(w * 0.32, 12, w * 0.36, h - 24);
      ctx.beginPath();
      ctx.moveTo(w / 2, 12);
      ctx.lineTo(w / 2, h - 12);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.fillRect(w * 0.25, h * 0.35, 4, 18);
      ctx.fillRect(w * 0.69, h * 0.35, 4, 18);
    });
  });

  makeCanvas(scene, 'crate', 90, 90, (ctx, w, h) => {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(6, 8, w - 8, h - 8);
    ctx.fillStyle = '#7c6843';
    rr(ctx, 5, 5, w - 10, h - 10, 2);
    ctx.fill();
    ctx.strokeStyle = '#4b3d24';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(12, 12);
    ctx.lineTo(w - 12, h - 12);
    ctx.moveTo(w - 12, 12);
    ctx.lineTo(12, h - 12);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(200,180,138,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(w * 0.2, h * 0.2, w * 0.6, h * 0.6);
    ctx.fillStyle = 'rgba(30,25,16,0.55)';
    ctx.fillRect(w * 0.36, h * 0.44, w * 0.28, 10);
  });

  makeCanvas(scene, 'barrel', 70, 70, (ctx, w, h) => {
    ctx.fillStyle = 'rgba(0,0,0,0.32)';
    ctx.beginPath();
    ctx.arc(w / 2 + 3, h / 2 + 3, 28, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#7a5a32';
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 27, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#47311b';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,220,160,0.25)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 19, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 10, 0, TAU);
    ctx.stroke();
    // Hazard mark.
    ctx.fillStyle = '#b23a2f';
    ctx.beginPath();
    ctx.moveTo(w / 2 - 5, h / 2 - 8);
    ctx.lineTo(w / 2 + 6, h / 2);
    ctx.lineTo(w / 2 - 5, h / 2 + 8);
    ctx.closePath();
    ctx.fill();
  });

  makeCanvas(scene, 'sandbag', 110, 64, (ctx, w, h) => {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(w / 2 + 2, h / 2 + 10, 46, 18, 0, 0, TAU);
    ctx.fill();
    const positions = [
      [26, 36],
      [55, 38],
      [84, 36],
      [40, 22],
      [70, 22],
    ];
    for (const [x, y] of positions) {
      ctx.fillStyle = x % 2 === 0 ? '#8f8059' : '#9b8b63';
      ctx.beginPath();
      ctx.ellipse(x, y, 19, 12, 0.1, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(65,55,35,0.6)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.beginPath();
      ctx.ellipse(x - 3, y - 4, 9, 3, 0.1, 0, TAU);
      ctx.stroke();
    }
  });

  makeCanvas(scene, 'wreck', 130, 84, (ctx, w, h) => {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(w / 2 + 3, h / 2 + 6, 54, 28, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#3d3b32';
    rr(ctx, 18, 20, w - 40, h - 40, 12);
    ctx.fill();
    ctx.fillStyle = '#2a2923';
    rr(ctx, 46, 12, 40, h - 24, 8);
    ctx.fill();
    ctx.strokeStyle = '#5d5647';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = 'rgba(90,80,62,0.5)';
    ctx.fillRect(64, 26, 20, 12);
    ctx.fillStyle = 'rgba(10,10,8,0.7)';
    ctx.beginPath();
    ctx.arc(34, h / 2, 10, 0, TAU);
    ctx.arc(w - 32, h / 2, 10, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(20,18,15,0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(24, 30);
    ctx.lineTo(78, 52);
    ctx.stroke();
  });

  makeCanvas(scene, 'pipe', 300, 60, (ctx, w, h) => {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(4, 14, w - 6, h - 12);
    ctx.fillStyle = '#666b5d';
    rr(ctx, 2, 8, w - 4, h - 24, 8);
    ctx.fill();
    ctx.strokeStyle = '#3a3e33';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(8, 18);
    ctx.lineTo(w - 8, 18);
    ctx.stroke();
    for (let x = 30; x < w - 20; x += 70) {
      ctx.fillStyle = '#4b4f42';
      rr(ctx, x, 4, 14, h - 16, 2);
      ctx.fill();
      ctx.strokeStyle = '#2e3128';
      ctx.stroke();
    }
  });

  makeCanvas(scene, 'wall', 180, 50, (ctx, w, h) => {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(3, 8, w - 4, h - 4);
    ctx.fillStyle = '#7d7a68';
    rr(ctx, 2, 2, w - 4, h - 12, 2);
    ctx.fill();
    ctx.strokeStyle = '#4a483c';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    for (let x = 36; x < w - 10; x += 44) {
      ctx.beginPath();
      ctx.moveTo(x, 4);
      ctx.lineTo(x, h - 12);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(4, 4, w - 8, 4);
  });

  makeCanvas(scene, 'truck', 200, 100, (ctx, w, h) => {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(w / 2 + 2, h / 2 + 8, 84, 30, 0, 0, TAU);
    ctx.fill();
    // Wheels.
    ctx.fillStyle = '#1b1c17';
    for (const [x, y] of [
      [38, 20],
      [84, 20],
      [152, 20],
      [38, h - 20],
      [84, h - 20],
      [152, h - 20],
    ]) {
      rr(ctx, x - 14, y - 6, 28, 12, 4);
      ctx.fill();
    }
    // Chassis.
    ctx.fillStyle = '#3f422f';
    rr(ctx, 16, 28, w - 34, h - 56, 4);
    ctx.fill();
    // Cab.
    ctx.fillStyle = '#5a5f3f';
    rr(ctx, w - 78, 24, 62, h - 48, 5);
    ctx.fill();
    ctx.strokeStyle = '#2c2f20';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Windshield.
    ctx.fillStyle = 'rgba(130,155,140,0.55)';
    rr(ctx, w - 68, 32, 14, h - 64, 2);
    ctx.fill();
    // Cargo canvas.
    ctx.fillStyle = '#8e8563';
    rr(ctx, 22, 24, w - 108, h - 48, 6);
    ctx.fill();
    ctx.strokeStyle = '#56503a';
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.22)';
    for (let x = 34; x < w - 96; x += 14) {
      ctx.beginPath();
      ctx.moveTo(x, 26);
      ctx.lineTo(x, h - 26);
      ctx.stroke();
    }
    // Objective chevron.
    ctx.fillStyle = 'rgba(216,96,60,0.8)';
    ctx.beginPath();
    ctx.moveTo(48, h / 2 - 9);
    ctx.lineTo(62, h / 2);
    ctx.lineTo(48, h / 2 + 9);
    ctx.lineTo(54, h / 2);
    ctx.closePath();
    ctx.fill();
  });

  makeCanvas(scene, 'tank_silo', 160, 160, (ctx, w, h) => {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.arc(w / 2 + 4, h / 2 + 5, 68, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#7d8171';
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 66, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#44483c';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 2;
    for (const r of [54, 38, 20]) {
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, r, 0, TAU);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.moveTo(w / 2 - 60, h / 2);
    ctx.lineTo(w / 2 + 60, h / 2);
    ctx.stroke();
    ctx.fillStyle = '#b23a2f';
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 10, 0, TAU);
    ctx.fill();
  });

  makeCanvas(scene, 'target', 120, 120, (ctx, w, h) => {
    // A plywood tank silhouette with a red bullseye.
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(w / 2 + 3, h / 2 + 8, 48, 24, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#8b7448';
    rr(ctx, 16, 34, 88, 52, 6);
    ctx.fill();
    ctx.strokeStyle = '#4c3c22';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#6d5a36';
    rr(ctx, 38, 20, 44, 40, 4);
    ctx.fill();
    ctx.fillRect(78, 44, 42, 9);
    ctx.strokeStyle = 'rgba(60,45,25,0.6)';
    ctx.lineWidth = 2;
    ctx.strokeRect(20, 38, 80, 44);
    ctx.strokeStyle = '#b23a2f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2 + 6, 16, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(w / 2, h / 2 + 6, 7, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = '#b23a2f';
    ctx.beginPath();
    ctx.arc(w / 2, h / 2 + 6, 2.5, 0, TAU);
    ctx.fill();
  });

  makeCanvas(scene, 'checkpoint', 180, 180, (ctx, w, h) => {
    ctx.strokeStyle = 'rgba(229,134,59,0.9)';
    ctx.lineWidth = 6;
    ctx.setLineDash([18, 12]);
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 70, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(229,134,59,0.25)';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 70, 0, TAU);
    ctx.stroke();
    // Chevrons.
    ctx.fillStyle = 'rgba(229,134,59,0.8)';
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + Math.PI / 4;
      const x = w / 2 + Math.cos(a) * 70;
      const y = h / 2 + Math.sin(a) * 70;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a + Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(-8, -6);
      ctx.lineTo(0, 6);
      ctx.lineTo(8, -6);
      ctx.strokeStyle = 'rgba(229,134,59,0.9)';
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.restore();
    }
  });
}

/* ---------------- decor ---------------- */

function createDecor(scene) {
  makeCanvas(scene, 'decor_sand', 180, 140, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(200,180,140,0.35)');
    g.addColorStop(0.7, 'rgba(190,170,130,0.12)');
    g.addColorStop(1, 'rgba(180,160,120,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, TAU);
    ctx.fill();
  });

  makeCanvas(scene, 'decor_grass', 80, 80, (ctx, w, h) => {
    ctx.strokeStyle = 'rgba(110,125,76,0.7)';
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 16; i++) {
      const x = w / 2 + (Math.random() - 0.5) * 40;
      const y = h / 2 + (Math.random() - 0.5) * 30;
      ctx.beginPath();
      ctx.moveTo(x, y + 8);
      ctx.quadraticCurveTo(x + (Math.random() - 0.5) * 8, y, x + (Math.random() - 0.5) * 12, y - 8 - Math.random() * 8);
      ctx.stroke();
    }
  });

  makeCanvas(scene, 'decor_crater', 150, 120, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 8, w / 2, h / 2, 62);
    g.addColorStop(0, 'rgba(25,22,18,0.85)');
    g.addColorStop(0.6, 'rgba(50,42,32,0.45)');
    g.addColorStop(1, 'rgba(80,68,50,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(w / 2, h / 2, 64, 48, 0, 0, TAU);
    ctx.fill();
    for (let i = 0; i < 20; i++) {
      const a = Math.random() * TAU;
      const r = 26 + Math.random() * 40;
      ctx.fillStyle = 'rgba(40,34,26,0.6)';
      ctx.fillRect(w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r * 0.75, 2 + Math.random() * 5, 2 + Math.random() * 3);
    }
    ctx.strokeStyle = 'rgba(35,30,22,0.35)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * TAU;
      ctx.beginPath();
      ctx.moveTo(w / 2 + Math.cos(a) * 20, h / 2 + Math.sin(a) * 16);
      ctx.lineTo(w / 2 + Math.cos(a) * 60, h / 2 + Math.sin(a) * 44);
      ctx.stroke();
    }
  });

  makeCanvas(scene, 'decor_tracks', 220, 90, (ctx, w, h) => {
    for (const offset of [-16, 16]) {
      ctx.fillStyle = 'rgba(52,46,34,0.28)';
      for (let x = 8; x < w - 8; x += 18) {
        ctx.fillRect(x, h / 2 + offset - 5, 10, 10);
      }
      ctx.fillStyle = 'rgba(45,40,30,0.14)';
      ctx.fillRect(8, h / 2 + offset - 8, w - 16, 16);
    }
  });

  makeCanvas(scene, 'decor_rubble', 140, 110, (ctx, w, h) => {
    for (let i = 0; i < 40; i++) {
      const x = 20 + Math.random() * (w - 40);
      const y = 20 + Math.random() * (h - 40);
      const s = 2 + Math.random() * 9;
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(112,106,94,0.85)' : 'rgba(75,70,60,0.9)';
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.random() * TAU);
      ctx.fillRect(-s / 2, -s / 3, s, s * 0.66);
      ctx.restore();
    }
    ctx.fillStyle = 'rgba(45,42,36,0.25)';
    ctx.beginPath();
    ctx.ellipse(w / 2, h / 2, w * 0.34, h * 0.24, 0, 0, TAU);
    ctx.fill();
  });

  makeCanvas(scene, 'decor_oil', 130, 100, (ctx, w, h) => {
    ctx.fillStyle = 'rgba(22,22,18,0.5)';
    ctx.beginPath();
    ctx.ellipse(w / 2, h / 2, 48, 32, 0.3, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(70,72,64,0.18)';
    ctx.beginPath();
    ctx.ellipse(w / 2 - 8, h / 2 - 6, 20, 10, 0.3, 0, TAU);
    ctx.fill();
  });

  makeCanvas(scene, 'decor_leaves', 120, 100, (ctx, w, h) => {
    for (let i = 0; i < 40; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.random() * TAU);
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(108,88,48,0.55)' : 'rgba(76,88,52,0.5)';
      ctx.beginPath();
      ctx.ellipse(0, 0, 3 + Math.random() * 4, 1 + Math.random() * 2, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  });

  makeCanvas(scene, 'decor_wire', 200, 50, (ctx, w, h) => {
    ctx.strokeStyle = 'rgba(58,56,46,0.8)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(4, 14 + i * 9);
      for (let x = 4; x < w - 4; x += 20) {
        ctx.quadraticCurveTo(x + 10, 4 + i * 9, x + 20, 14 + i * 9);
      }
      ctx.stroke();
    }
    // Barbs.
    for (let x = 16; x < w - 10; x += 24) {
      ctx.strokeStyle = 'rgba(70,68,56,0.9)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x - 4, 8);
      ctx.lineTo(x + 4, 22);
      ctx.moveTo(x + 4, 8);
      ctx.lineTo(x - 4, 22);
      ctx.stroke();
    }
    // Posts.
    ctx.fillStyle = 'rgba(80,72,54,0.9)';
    ctx.fillRect(2, 8, 4, 34);
    ctx.fillRect(w - 6, 8, 4, 34);
  });

  makeCanvas(scene, 'decor_sign', 90, 90, (ctx, w, h) => {
    ctx.strokeStyle = '#4a4434';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(w / 2, h - 8);
    ctx.lineTo(w / 2, 30);
    ctx.stroke();
    ctx.fillStyle = '#b09a6a';
    rr(ctx, 12, 8, w - 24, 34, 2);
    ctx.fill();
    ctx.strokeStyle = '#5a4c32';
    ctx.stroke();
    ctx.fillStyle = '#2c2a22';
    ctx.beginPath();
    ctx.moveTo(w / 2 - 9, 16);
    ctx.lineTo(w / 2 + 2, 26);
    ctx.lineTo(w / 2 - 9, 36);
    ctx.closePath();
    ctx.fill();
    ctx.font = 'bold 14px monospace';
    ctx.fillStyle = '#3b3425';
    ctx.fillText('!', w / 2 + 7, 32);
  });
}

/* ---------------- boot ---------------- */

export function generateTextures(scene) {
  createGround(scene, 'ground_desert', {
    base: '#a89062',
    patch: 'rgba(190,168,124,0.28)',
    grain: ['rgba(90,76,52,0.2)', 'rgba(210,194,158,0.24)', 'rgba(150,130,96,0.2)'],
    grain2: ['rgba(80,68,46,0.2)', 'rgba(225,210,176,0.16)'],
  }, drawDesertGround);

  createGround(scene, 'ground_forest', {
    base: '#4b5b3a',
    patch: 'rgba(58,72,42,0.35)',
    grain: ['rgba(36,50,28,0.28)', 'rgba(96,112,70,0.2)', 'rgba(70,58,36,0.22)'],
    grain2: ['rgba(30,42,24,0.25)', 'rgba(120,136,88,0.14)'],
  }, drawForestGround);

  createGround(scene, 'ground_industrial', {
    base: '#5c5f55',
    patch: 'rgba(70,72,66,0.3)',
    grain: ['rgba(40,42,38,0.25)', 'rgba(130,130,118,0.18)', 'rgba(84,78,66,0.2)'],
    grain2: ['rgba(32,34,30,0.3)', 'rgba(150,150,136,0.1)'],
  }, drawIndustrialGround);

  createGround(scene, 'ground_city', {
    base: '#6d6a62',
    patch: 'rgba(78,76,70,0.32)',
    grain: ['rgba(46,46,42,0.26)', 'rgba(142,138,126,0.18)', 'rgba(90,84,72,0.2)'],
    grain2: ['rgba(36,36,32,0.26)', 'rgba(160,156,142,0.1)'],
  }, drawCityGround);

  // Tank hulls and turrets.
  const variants = ['player', 'scout', 'assault', 'heavy', 'elite', 'boss'];
  for (const variant of variants) {
    const palette = TANK_PALETTES[variant];
    const isBoss = variant === 'boss';
    const w = isBoss ? 200 : 136;
    const h = isBoss ? 128 : 88;
    makeCanvas(scene, `hull_${variant}`, w, h, (ctx) => {
      drawTankHull(ctx, w, h, palette, variant);
    });
    makeCanvas(scene, `turret_${variant}`, isBoss ? 220 : 150, isBoss ? 72 : 54, (ctx) => {
      drawTankTurret(ctx, isBoss ? 220 : 150, isBoss ? 72 : 54, palette, variant);
    });
  }

  createNature(scene);
  createStructures(scene);
  createDecor(scene);
  createProjectiles(scene);
  createPickups(scene);
  createFx(scene);

  // Generic bullet impact decal.
  makeCanvas(scene, 'decor_impact', 48, 48, (ctx, w, h) => {
    ctx.fillStyle = 'rgba(20,18,14,0.55)';
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 10, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(70,64,52,0.5)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 7; i++) {
      const a = Math.random() * TAU;
      ctx.beginPath();
      ctx.moveTo(w / 2, h / 2);
      ctx.lineTo(w / 2 + Math.cos(a) * 18, h / 2 + Math.sin(a) * 18);
      ctx.stroke();
    }
  });

  // Soft menu smoke / dust.
  makeCanvas(scene, 'fx_menu_dust', 32, 32, (ctx) => {
    softCircle(ctx, 16, 16, 16, [
      [0, 'rgba(220,205,170,0.5)'],
      [1, 'rgba(220,205,170,0)'],
    ]);
  });
}
