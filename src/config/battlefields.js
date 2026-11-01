/**
 * Battlefield definitions. Layouts are hand-authored with deterministic scatter helpers so the
 * maps are varied, repeatable and free of external art dependencies.
 *
 * Solid obstacle types map to procedurally generated textures in core/TextureFactory.js.
 */

function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(0x7a4c2e11);
const rr = (min, max) => min + rand() * (max - min);

function obstacle(type, x, y, w, h, extra = {}) {
  return {
    type,
    x: Math.round(x),
    y: Math.round(y),
    w: Math.round(w),
    h: Math.round(h),
    solid: true,
    destructible: false,
    explosive: false,
    hp: 0,
    rotation: 0,
    objTag: null,
    ...extra,
  };
}

function decor(texture, x, y, extra = {}) {
  return {
    texture,
    x: Math.round(x),
    y: Math.round(y),
    scale: 1,
    rotation: 0,
    alpha: 1,
    ...extra,
  };
}

function rockCluster(list, cx, cy, count, spread = 150, avoid = []) {
  for (let i = 0; i < count; i++) {
    const x = cx + rr(-spread, spread);
    const y = cy + rr(-spread, spread);
    if (avoid.some((a) => Math.abs(x - a.x) < a.r && Math.abs(y - a.y) < a.r)) continue;
    const size = rr(60, 130);
    list.push(
      obstacle(`rock_${Math.floor(rand() * 3) + 1}`, x, y, size, size * rr(0.72, 0.98), {
        destructible: false,
      })
    );
  }
}

function sandbagLine(list, x1, y1, x2, y2, count) {
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    list.push(
      obstacle('sandbag', x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, 74, 44, {
        destructible: true,
        hp: 55,
      })
    );
  }
}

/* ------------------------------------------------------------------ */
/* DESERT OUTPOST                                                      */
/* ------------------------------------------------------------------ */

function buildDesert() {
  const obstacles = [];
  const deco = [];
  const width = 3200;
  const height = 2400;

  // Rock outcrops in the open desert.
  rockCluster(obstacles, 380, 360, 5, 180);
  rockCluster(obstacles, 2860, 330, 4, 150);
  rockCluster(obstacles, 2820, 2040, 5, 170);
  rockCluster(obstacles, 430, 2070, 4, 150);
  rockCluster(obstacles, 1080, 480, 3, 120);
  rockCluster(obstacles, 2730, 1720, 3, 110);
  rockCluster(obstacles, 900, 1750, 2, 90);

  // Forward operating base (north-east compound).
  obstacles.push(obstacle('building_1', 2200, 620, 300, 210));
  obstacles.push(obstacle('building_2', 2540, 820, 220, 170));
  obstacles.push(obstacle('tower', 2600, 360, 92, 92));
  obstacles.push(obstacle('tent', 1980, 420, 150, 110));
  obstacles.push(obstacle('tent', 1830, 760, 140, 100));
  obstacles.push(obstacle('radar', 2860, 700, 110, 110));

  // Objective outpost hardpoints.
  obstacles.push(obstacle('outpost', 2020, 900, 130, 130, { destructible: true, hp: 240, objTag: 'structure' }));
  obstacles.push(obstacle('outpost', 2420, 1030, 130, 130, { destructible: true, hp: 240, objTag: 'structure' }));
  obstacles.push(obstacle('outpost', 2720, 500, 130, 130, { destructible: true, hp: 240, objTag: 'structure' }));
  obstacles.push(obstacle('outpost', 1760, 560, 130, 130, { destructible: true, hp: 240, objTag: 'structure' }));

  // Convoy objective trucks on the east-west highway.
  obstacles.push(obstacle('truck', 2180, 1120, 150, 76, { destructible: true, hp: 180, objTag: 'convoy', rotation: 0 }));
  obstacles.push(obstacle('truck', 2460, 1260, 150, 76, { destructible: true, hp: 180, objTag: 'convoy', rotation: 0 }));
  obstacles.push(obstacle('truck', 2720, 1120, 150, 76, { destructible: true, hp: 180, objTag: 'convoy', rotation: 0 }));

  // Command bunker used by the defense mission.
  obstacles.push(obstacle('base', 1540, 760, 190, 160, { destructible: true, hp: 1600, objTag: 'base' }));

  // Perimeter works around the compound.
  sandbagLine(obstacles, 1850, 980, 2200, 980, 5);
  sandbagLine(obstacles, 2740, 880, 2740, 1160, 3);
  sandbagLine(obstacles, 2000, 1120, 2000, 1000, 2);

  // Scattered supply crates and fuel barrels.
  for (let i = 0; i < 5; i++) {
    obstacles.push(obstacle('crate', 2320 + rr(-160, 160), 740 + rr(-60, 60), 58, 58, { destructible: true, hp: 30 }));
  }
  for (let i = 0; i < 4; i++) {
    obstacles.push(
      obstacle('barrel', 2040 + rr(-40, 40), 760 + rr(-30, 30), 40, 40, {
        destructible: true,
        hp: 18,
        explosive: true,
      })
    );
  }

  // Ruined field walls.
  obstacles.push(obstacle('wall', 820, 1120, 210, 34));
  obstacles.push(obstacle('wall', 2800, 1500, 34, 220));
  obstacles.push(obstacle('wall', 610, 1520, 180, 34));
  obstacles.push(obstacle('wreck', 1180, 980, 96, 58, { rotation: 0.4 }));
  obstacles.push(obstacle('wreck', 1900, 1610, 96, 58, { rotation: -0.2 }));

  // Non-colliding ground detail.
  for (let i = 0; i < 34; i++) {
    const x = rr(80, width - 80);
    const y = rr(80, height - 80);
    if (Math.abs(y - 1200) < 150) continue;
    deco.push(decor('decor_sand', x, y, { scale: rr(0.8, 2.2), rotation: rr(0, 6.28), alpha: rr(0.3, 0.65) }));
  }
  for (let i = 0; i < 18; i++) {
    deco.push(decor('decor_grass', rr(80, width - 80), rr(100, height - 100), { scale: rr(0.5, 1.1), alpha: rr(0.35, 0.7) }));
  }
  for (let i = 0; i < 14; i++) {
    deco.push(decor('decor_crater', rr(150, width - 150), rr(150, height - 150), { scale: rr(0.7, 1.5), alpha: rr(0.35, 0.6) }));
  }
  for (let i = 0; i < 12; i++) {
    deco.push(decor('decor_tracks', rr(300, width - 300), 1130 + rr(-60, 60), { scale: rr(0.7, 1.2), alpha: 0.35 }));
  }
  deco.push(decor('decor_wire', 1560, 1030, { scale: 1.3, alpha: 0.8 }));
  deco.push(decor('decor_wire', 2600, 1480, { scale: 1.2, alpha: 0.8, rotation: 1.57 }));

  return {
    id: 'desert',
    index: 1,
    name: 'DESERT OUTPOST',
    region: 'SECTOR 7 · AL-HAZIR BASIN',
    terrain: 'ARID / OPEN',
    description:
      'Cracked salt flats, a fortified supply compound and long sight lines. Armor can flank wide, but cover is scarce.',
    width,
    height,
    ground: 'ground_desert',
    groundColor: '#a89062',
    roadColor: 0x8f7a52,
    edgeColor: 0x6e5b3c,
    dust: 0xd8c49a,
    night: false,
    playerSpawn: { x: 360, y: 1200, rotation: 0 },
    enemySpawns: [
      { x: 2940, y: 340 },
      { x: 2940, y: 1280 },
      { x: 2820, y: 2060 },
      { x: 1720, y: 300 },
      { x: 760, y: 2100 },
      { x: 2220, y: 1200 },
      { x: 1980, y: 1720 },
    ],
    roads: [
      { x: 0, y: 1120, w: width, h: 170, type: 'highway' },
      { x: 1520, y: 0, w: 160, h: height, type: 'dirt' },
    ],
    obstacles,
    decor: deco,
    objectiveSites: {
      base: { x: 1540, y: 760 },
      structures: [
        { x: 2020, y: 900 },
        { x: 2420, y: 1030 },
        { x: 2720, y: 500 },
        { x: 1760, y: 560 },
      ],
    },
  };
}

/* ------------------------------------------------------------------ */
/* BLACKWOOD FOREST                                                    */
/* ------------------------------------------------------------------ */

function buildForest() {
  const obstacles = [];
  const deco = [];
  const width = 3200;
  const height = 2400;

  const roads = [
    { x: 0, y: 1470, w: width, h: 150, type: 'dirt' },
    { x: 1620, y: 0, w: 140, h: height, type: 'dirt' },
  ];

  // Hand-placed bunkers and logging structures.
  obstacles.push(obstacle('bunker', 1120, 690, 160, 130));
  obstacles.push(obstacle('bunker', 2320, 620, 160, 130));
  obstacles.push(obstacle('outpost', 720, 680, 120, 120, { destructible: true, hp: 220, objTag: 'structure' }));
  obstacles.push(obstacle('outpost', 2420, 520, 120, 120, { destructible: true, hp: 220, objTag: 'structure' }));
  obstacles.push(obstacle('outpost', 2360, 1930, 120, 120, { destructible: true, hp: 220, objTag: 'structure' }));
  obstacles.push(obstacle('outpost', 880, 2080, 120, 120, { destructible: true, hp: 220, objTag: 'structure' }));

  obstacles.push(obstacle('warehouse', 2600, 1080, 260, 180));
  obstacles.push(obstacle('warehouse', 540, 1080, 240, 170));
  obstacles.push(obstacle('tent', 1350, 650, 140, 100));
  obstacles.push(obstacle('tent', 1850, 1750, 140, 100));
  obstacles.push(obstacle('tower', 1720, 1120, 90, 90));
  obstacles.push(obstacle('wreck', 1250, 1680, 96, 58, { rotation: 0.9 }));
  obstacles.push(obstacle('wreck', 2050, 720, 96, 58, { rotation: -0.3 }));
  obstacles.push(obstacle('base', 1640, 2070, 190, 160, { destructible: true, hp: 1600, objTag: 'base' }));

  // Scattered crates / barrels around the bunkers.
  const supplyPoints = [
    { x: 860, y: 760 },
    { x: 2520, y: 620 },
    { x: 2260, y: 1830 },
    { x: 980, y: 1980 },
  ];
  for (const p of supplyPoints) {
    for (let i = 0; i < 3; i++) {
      obstacles.push(
        obstacle('crate', p.x + rr(-55, 55), p.y + rr(-45, 45), 54, 54, { destructible: true, hp: 30 })
      );
    }
    obstacles.push(
      obstacle('barrel', p.x + rr(-30, 30), p.y + rr(-30, 30), 40, 40, {
        destructible: true,
        hp: 18,
        explosive: true,
      })
    );
  }

  // Tree clusters with deliberate clearings. Keep roads, spawns and objectives passable.
  const avoid = [
    { x: 360, y: 2000, r: 260 },
    { x: 2940, y: 340, r: 220 },
    { x: 2940, y: 1280, r: 220 },
    { x: 2820, y: 2060, r: 220 },
    { x: 1720, y: 300, r: 220 },
    { x: 760, y: 2100, r: 220 },
    { x: 1640, y: 900, r: 240 },
    { x: 1640, y: 2070, r: 240 },
    { x: 720, y: 680, r: 260 },
    { x: 2420, y: 520, r: 260 },
    { x: 2360, y: 1930, r: 260 },
    { x: 880, y: 2080, r: 260 },
  ];
  const treeCenters = [
    [420, 420, 240, 12],
    [1020, 560, 250, 13],
    [1600, 380, 220, 8],
    [2080, 980, 260, 12],
    [2720, 900, 230, 10],
    [2780, 1580, 240, 12],
    [2080, 2180, 230, 10],
    [1400, 2120, 260, 12],
    [560, 1700, 200, 8],
    [1180, 1120, 190, 7],
    [2520, 1680, 190, 7],
    [1980, 1480, 170, 6],
  ];
  const placed = [];
  for (const [cx, cy, radius, count] of treeCenters) {
    let made = 0;
    let guard = 0;
    while (made < count && guard < count * 12) {
      guard++;
      const x = cx + rr(-radius, radius);
      const y = cy + rr(-radius * 0.8, radius * 0.8);
      if (Math.abs(y - 1470) < 170 || Math.abs(x - 1690) < 150) continue;
      if (avoid.some((a) => Math.hypot(x - a.x, y - a.y) < a.r)) continue;
      if (placed.some((p) => Math.hypot(x - p.x, y - p.y) < 92)) continue;
      placed.push({ x, y });
      obstacles.push(
        obstacle(`tree_${Math.floor(rand() * 3) + 1}`, x, y, rr(82, 108), rr(82, 108), {
          destructible: true,
          hp: 40,
        })
      );
      made++;
    }
  }

  // Ground cover.
  for (let i = 0; i < 46; i++) {
    deco.push(
      decor('decor_leaves', rr(80, width - 80), rr(80, height - 80), {
        scale: rr(0.7, 1.7),
        rotation: rr(0, 6.28),
        alpha: rr(0.25, 0.6),
      })
    );
  }
  for (let i = 0; i < 40; i++) {
    deco.push(
      decor('bush_' + (Math.floor(rand() * 2) + 1), rr(100, width - 100), rr(100, height - 100), {
        scale: rr(0.5, 1.1),
        rotation: rr(0, 6.28),
        alpha: rr(0.5, 0.9),
      })
    );
  }
  for (let i = 0; i < 16; i++) {
    deco.push(decor('decor_crater', rr(150, width - 150), rr(150, height - 150), { scale: rr(0.7, 1.3), alpha: 0.35 }));
  }
  for (let i = 0; i < 18; i++) {
    deco.push(decor('decor_tracks', rr(200, width - 200), 1430 + rr(-90, 90), { scale: rr(0.7, 1.1), alpha: 0.4 }));
  }
  deco.push(decor('decor_sign', 1750, 1380, { scale: 1, alpha: 0.9 }));
  deco.push(decor('decor_wire', 1380, 1900, { scale: 1.2, alpha: 0.75 }));

  return {
    id: 'forest',
    index: 2,
    name: 'BLACKWOOD FOREST',
    region: 'SECTOR 12 · BLACKWOOD BELT',
    terrain: 'FOREST / CLOSE',
    description:
      'Dense pine and broken logging trails. Ambushes are close, sight lines are short, and every trunk is cover.',
    width,
    height,
    ground: 'ground_forest',
    groundColor: '#4b5b3a',
    roadColor: 0x6a5c42,
    edgeColor: 0x2f3a26,
    dust: 0x9ca77a,
    night: false,
    playerSpawn: { x: 360, y: 2000, rotation: -0.35 },
    enemySpawns: [
      { x: 2940, y: 360 },
      { x: 2860, y: 1280 },
      { x: 2820, y: 2060 },
      { x: 1720, y: 300 },
      { x: 760, y: 2100 },
      { x: 1220, y: 1300 },
      { x: 2040, y: 1120 },
    ],
    roads,
    obstacles,
    decor: deco,
    objectiveSites: {
      base: { x: 1640, y: 2070 },
      structures: [
        { x: 720, y: 680 },
        { x: 2420, y: 520 },
        { x: 2360, y: 1930 },
        { x: 880, y: 2080 },
      ],
    },
  };
}

/* ------------------------------------------------------------------ */
/* INDUSTRIAL ZONE                                                     */
/* ------------------------------------------------------------------ */

function buildIndustrial() {
  const obstacles = [];
  const deco = [];
  const width = 3200;
  const height = 2400;

  // Warehouses and factory halls.
  obstacles.push(obstacle('warehouse', 1500, 640, 440, 260));
  obstacles.push(obstacle('warehouse', 2620, 520, 330, 230));
  obstacles.push(obstacle('warehouse', 720, 1650, 360, 240));
  obstacles.push(obstacle('warehouse', 2480, 1780, 380, 250));
  obstacles.push(obstacle('building_3', 1020, 520, 220, 180));
  obstacles.push(obstacle('building_2', 1900, 2050, 210, 160));

  // Objective hardpoints (fuel depots / command posts).
  obstacles.push(obstacle('outpost', 1080, 1120, 130, 130, { destructible: true, hp: 250, objTag: 'structure' }));
  obstacles.push(obstacle('outpost', 2140, 1120, 130, 130, { destructible: true, hp: 250, objTag: 'structure' }));
  obstacles.push(obstacle('outpost', 2660, 1350, 130, 130, { destructible: true, hp: 250, objTag: 'structure' }));
  obstacles.push(obstacle('outpost', 1450, 1900, 130, 130, { destructible: true, hp: 250, objTag: 'structure' }));

  // Container rows.
  const rows = [
    { x: 1850, y: 1320, dir: 'v', count: 4 },
    { x: 640, y: 1000, dir: 'v', count: 3 },
    { x: 2200, y: 760, dir: 'h', count: 3 },
    { x: 900, y: 2020, dir: 'h', count: 4 },
    { x: 2780, y: 2100, dir: 'h', count: 3 },
  ];
  const containerTextures = ['container_1', 'container_2', 'container_3'];
  for (const row of rows) {
    for (let i = 0; i < row.count; i++) {
      const x = row.dir === 'h' ? row.x + i * 108 : row.x;
      const y = row.dir === 'v' ? row.y + i * 108 : row.y;
      obstacles.push(
        obstacle(containerTextures[Math.floor(rand() * containerTextures.length)], x, y, row.dir === 'h' ? 100 : 66, row.dir === 'h' ? 66 : 100)
      );
    }
  }

  // Industrial pipe runs and concrete walls.
  obstacles.push(obstacle('pipe', 1600, 1020, 300, 44));
  obstacles.push(obstacle('pipe', 1980, 1640, 44, 280));
  obstacles.push(obstacle('wall', 420, 1200, 34, 260));
  obstacles.push(obstacle('wall', 2760, 950, 34, 220));
  obstacles.push(obstacle('wall', 1280, 2150, 260, 34));
  obstacles.push(obstacle('wall', 2300, 1080, 180, 34));

  // Fuel storage, crates and barrels.
  for (let i = 0; i < 8; i++) {
    obstacles.push(
      obstacle('barrel', 860 + rr(-90, 90), 1400 + rr(-70, 70), 40, 40, {
        destructible: true,
        hp: 18,
        explosive: true,
      })
    );
  }
  for (let i = 0; i < 10; i++) {
    obstacles.push(
      obstacle('crate', 2250 + rr(-100, 100), 1550 + rr(-90, 90), 56, 56, { destructible: true, hp: 32 })
    );
  }
  for (let i = 0; i < 4; i++) {
    obstacles.push(obstacle('tank_silo', 1750 + i * 150, 1600, 120, 120));
  }

  obstacles.push(obstacle('base', 1520, 1270, 190, 160, { destructible: true, hp: 1600, objTag: 'base' }));
  obstacles.push(obstacle('tower', 2900, 1520, 92, 92));
  obstacles.push(obstacle('tower', 480, 700, 92, 92));
  obstacles.push(obstacle('wreck', 1100, 1720, 96, 58, { rotation: 0.7 }));
  obstacles.push(obstacle('wreck', 2350, 1400, 96, 58, { rotation: -0.5 }));

  // Ground detail.
  for (let i = 0; i < 26; i++) {
    deco.push(
      decor('decor_oil', rr(150, width - 150), rr(150, height - 150), {
        scale: rr(0.7, 1.8),
        rotation: rr(0, 6.28),
        alpha: rr(0.2, 0.5),
      })
    );
  }
  for (let i = 0; i < 30; i++) {
    deco.push(
      decor('decor_rubble', rr(100, width - 100), rr(100, height - 100), {
        scale: rr(0.6, 1.4),
        rotation: rr(0, 6.28),
        alpha: rr(0.35, 0.7),
      })
    );
  }
  for (let i = 0; i < 10; i++) {
    deco.push(decor('decor_crater', rr(200, width - 200), rr(200, height - 200), { scale: rr(0.8, 1.4), alpha: 0.3 }));
  }
  deco.push(decor('decor_wire', 2300, 1200, { scale: 1.4, alpha: 0.8 }));

  return {
    id: 'industrial',
    index: 3,
    name: 'INDUSTRIAL ZONE',
    region: 'SECTOR 3 · KARST FOUNDRY',
    terrain: 'URBAN / HEAVY COVER',
    description:
      'A dead foundry of warehouses, container stacks and fuel lines. Close-quarters brawling with plenty of hard cover.',
    width,
    height,
    ground: 'ground_industrial',
    groundColor: '#5c5f55',
    roadColor: 0x44463f,
    edgeColor: 0x2b2d28,
    dust: 0xa9a99a,
    night: false,
    playerSpawn: { x: 320, y: 2050, rotation: -0.45 },
    enemySpawns: [
      { x: 2960, y: 340 },
      { x: 2920, y: 1300 },
      { x: 2860, y: 2100 },
      { x: 1720, y: 300 },
      { x: 640, y: 2100 },
      { x: 2100, y: 1150 },
      { x: 1200, y: 1550 },
    ],
    roads: [
      { x: 0, y: 950, w: width, h: 150, type: 'asphalt' },
      { x: 0, y: 1900, w: width, h: 150, type: 'asphalt' },
      { x: 780, y: 0, w: 140, h: height, type: 'asphalt' },
      { x: 2320, y: 0, w: 150, h: height, type: 'asphalt' },
    ],
    obstacles,
    decor: deco,
    objectiveSites: {
      base: { x: 1520, y: 1270 },
      structures: [
        { x: 1080, y: 1120 },
        { x: 2140, y: 1120 },
        { x: 2660, y: 1350 },
        { x: 1450, y: 1900 },
      ],
    },
  };
}

/* ------------------------------------------------------------------ */
/* RUINED CITY                                                         */
/* ------------------------------------------------------------------ */

function buildCity() {
  const obstacles = [];
  const deco = [];
  const width = 3000;
  const height = 2400;

  const buildingRows = [
    // [x, y, w, h, texture]
    [420, 320, 300, 220, 'ruin_1'],
    [900, 300, 240, 180, 'building_2'],
    [1260, 380, 260, 200, 'ruin_2'],
    [1880, 300, 300, 230, 'building_1'],
    [2450, 330, 260, 200, 'ruin_1'],
    [380, 760, 240, 180, 'ruin_2'],
    [1050, 780, 260, 200, 'building_3'],
    [1850, 720, 260, 220, 'ruin_2'],
    [2530, 760, 330, 230, 'building_2'],
    [350, 1370, 280, 200, 'building_2'],
    [920, 1380, 300, 220, 'ruin_1'],
    [1720, 1360, 260, 210, 'building_3'],
    [2360, 1400, 280, 210, 'ruin_2'],
    [2700, 1380, 240, 170, 'ruin_1'],
    [420, 2020, 300, 220, 'ruin_2'],
    [1150, 2080, 280, 200, 'building_1'],
    [1880, 2070, 300, 220, 'ruin_1'],
    [2520, 2050, 260, 190, 'building_2'],
  ];
  for (const [x, y, w, h, tex] of buildingRows) {
    obstacles.push(obstacle(tex, x, y, w, h));
  }

  // Outpost objectives in ruined strongpoints.
  obstacles.push(obstacle('outpost', 1050, 610, 130, 130, { destructible: true, hp: 240, objTag: 'structure' }));
  obstacles.push(obstacle('outpost', 2150, 620, 130, 130, { destructible: true, hp: 240, objTag: 'structure' }));
  obstacles.push(obstacle('outpost', 2100, 1700, 130, 130, { destructible: true, hp: 240, objTag: 'structure' }));
  obstacles.push(obstacle('outpost', 1080, 1760, 130, 130, { destructible: true, hp: 240, objTag: 'structure' }));

  obstacles.push(obstacle('base', 1510, 1000, 190, 160, { destructible: true, hp: 1600, objTag: 'base' }));

  // Blocked streets: sandbags, wrecks and rubble.
  const defenses = [
    [650, 1180, 0, 3],
    [1550, 920, 90, 3],
    [2200, 1110, 0, 3],
    [820, 1760, 0, 3],
    [1650, 1820, 90, 3],
    [2680, 1780, 0, 3],
  ];
  for (const [x, y, angle, count] of defenses) {
    const dx = Math.cos(angle) * 70;
    const dy = Math.sin(angle) * 70;
    sandbagLine(obstacles, x - dx, y - dy, x + dx, y + dy, count);
  }
  obstacles.push(obstacle('wreck', 760, 1100, 96, 58, { rotation: 0.4 }));
  obstacles.push(obstacle('wreck', 1780, 1120, 96, 58, { rotation: -0.2 }));
  obstacles.push(obstacle('wreck', 1400, 1500, 96, 58, { rotation: 1.2 }));
  obstacles.push(obstacle('wreck', 2440, 1720, 96, 58, { rotation: 0.2 }));
  obstacles.push(obstacle('wreck', 620, 1900, 96, 58, { rotation: -0.8 }));

  for (const [x, y] of [
    [1500, 640],
    [1400, 1320],
    [2250, 1650],
    [900, 1200],
  ]) {
    for (let i = 0; i < 3; i++) {
      obstacles.push(obstacle('crate', x + rr(-70, 70), y + rr(-50, 50), 54, 54, { destructible: true, hp: 30 }));
    }
    obstacles.push(obstacle('barrel', x + rr(-30, 30), y + rr(-30, 30), 40, 40, { destructible: true, hp: 18, explosive: true }));
  }

  obstacles.push(obstacle('tower', 2800, 180, 92, 92));
  obstacles.push(obstacle('tower', 200, 180, 92, 92));

  // Rubble and destruction.
  for (let i = 0; i < 42; i++) {
    deco.push(
      decor('decor_rubble', rr(120, width - 120), rr(120, height - 120), {
        scale: rr(0.7, 1.8),
        rotation: rr(0, 6.28),
        alpha: rr(0.4, 0.85),
      })
    );
  }
  for (let i = 0; i < 16; i++) {
    deco.push(
      decor('decor_crater', rr(150, width - 150), rr(150, height - 150), {
        scale: rr(0.8, 1.7),
        rotation: rr(0, 6.28),
        alpha: rr(0.35, 0.7),
      })
    );
  }
  for (let i = 0; i < 18; i++) {
    deco.push(
      decor('decor_grass', rr(100, width - 100), rr(100, height - 100), { scale: rr(0.4, 0.8), alpha: 0.4 })
    );
  }
  for (let i = 0; i < 10; i++) {
    deco.push(decor('decor_oil', rr(200, width - 200), rr(200, height - 200), { scale: rr(0.6, 1.2), alpha: 0.3 }));
  }
  deco.push(decor('decor_sign', 1500, 1140, { scale: 1.1, alpha: 0.8 }));
  deco.push(decor('decor_wire', 980, 1580, { scale: 1.2, alpha: 0.7 }));

  return {
    id: 'city',
    index: 4,
    name: 'RUINED CITY',
    region: 'SECTOR 9 · VARENHOLM',
    terrain: 'URBAN / RUBBLE',
    description:
      'A shattered city grid. Boulevard sight lines cross collapsed districts and every pile of rubble can hide an enemy.',
    width,
    height,
    ground: 'ground_city',
    groundColor: '#6d6a62',
    roadColor: 0x4a4a45,
    edgeColor: 0x34352f,
    dust: 0xb4ad9e,
    night: false,
    playerSpawn: { x: 350, y: 1750, rotation: -0.3 },
    enemySpawns: [
      { x: 2820, y: 200 },
      { x: 2800, y: 1200 },
      { x: 2780, y: 2250 },
      { x: 1600, y: 150 },
      { x: 220, y: 2250 },
      { x: 1500, y: 1000 },
      { x: 2250, y: 1050 },
      { x: 800, y: 600 },
    ],
    roads: [
      { x: 0, y: 520, w: width, h: 110, type: 'asphalt' },
      { x: 0, y: 1120, w: width, h: 160, type: 'asphalt' },
      { x: 0, y: 1800, w: width, h: 120, type: 'asphalt' },
      { x: 700, y: 0, w: 130, h: height, type: 'asphalt' },
      { x: 1530, y: 0, w: 150, h: height, type: 'asphalt' },
      { x: 2300, y: 0, w: 120, h: height, type: 'asphalt' },
    ],
    obstacles,
    decor: deco,
    objectiveSites: {
      base: { x: 1510, y: 1180 },
      structures: [
        { x: 1050, y: 610 },
        { x: 2150, y: 620 },
        { x: 2100, y: 1700 },
        { x: 1080, y: 1760 },
      ],
    },
  };
}

export const BATTLEFIELDS = {
  desert: buildDesert(),
  forest: buildForest(),
  industrial: buildIndustrial(),
  city: buildCity(),
};

export const BATTLEFIELD_ORDER = ['desert', 'forest', 'industrial', 'city'];

export function getBattlefield(id) {
  return BATTLEFIELDS[id] || BATTLEFIELDS.desert;
}

/** Renders a small tactical map preview to a data URL for the menus. */
export function renderBattlefieldThumb(id, width = 480, height = 300) {
  const map = getBattlefield(id);
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const sx = width / map.width;
  const sy = height / map.height;

  ctx.fillStyle = map.groundColor;
  ctx.fillRect(0, 0, width, height);

  // Ground texture noise.
  for (let i = 0; i < 800; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.035)';
    ctx.fillRect(x, y, 3 + Math.random() * 6, 2 + Math.random() * 5);
  }

  // Roads.
  for (const road of map.roads) {
    ctx.fillStyle = `#${map.roadColor.toString(16).padStart(6, '0')}`;
    ctx.fillRect(road.x * sx, road.y * sy, road.w * sx, road.h * sy);
    ctx.strokeStyle = 'rgba(230,220,190,0.28)';
    ctx.lineWidth = 1;
    if (road.w > road.h) {
      const my = (road.y + road.h / 2) * sy;
      ctx.setLineDash([6, 8]);
      ctx.beginPath();
      ctx.moveTo(road.x * sx, my);
      ctx.lineTo((road.x + road.w) * sx, my);
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      const mx = (road.x + road.w / 2) * sx;
      ctx.setLineDash([6, 8]);
      ctx.beginPath();
      ctx.moveTo(mx, road.y * sy);
      ctx.lineTo(mx, (road.y + road.h) * sy);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // Obstacles by type family.
  for (const o of map.obstacles) {
    const x = (o.x - o.w / 2) * sx;
    const y = (o.y - o.h / 2) * sy;
    const w = Math.max(2, o.w * sx);
    const h = Math.max(2, o.h * sy);
    if (o.type.startsWith('tree')) ctx.fillStyle = 'rgba(38,58,30,0.9)';
    else if (o.type.startsWith('rock')) ctx.fillStyle = 'rgba(100,92,78,0.85)';
    else if (o.type.includes('building') || o.type.includes('warehouse') || o.type.includes('ruin')) ctx.fillStyle = 'rgba(130,122,108,0.92)';
    else if (o.type === 'outpost' || o.type === 'base' || o.type === 'bunker') ctx.fillStyle = 'rgba(178,58,47,0.85)';
    else if (o.type === 'truck') ctx.fillStyle = 'rgba(229,134,59,0.9)';
    else ctx.fillStyle = 'rgba(80,78,68,0.8)';
    ctx.fillRect(x, y, w, h);

    if (o.type.includes('building') || o.type.includes('warehouse') || o.type.includes('ruin')) {
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.strokeRect(x + 1, y + 1, Math.max(1, w - 2), Math.max(1, h - 2));
    }
  }

  // Objective markers.
  const sites = map.objectiveSites;
  if (sites?.base) {
    ctx.strokeStyle = 'rgba(229,134,59,0.9)';
    ctx.lineWidth = 2;
    ctx.strokeRect((sites.base.x - 30) * sx, (sites.base.y - 30) * sy, 60 * sx, 60 * sy);
  }

  // Edge vignette.
  const grad = ctx.createRadialGradient(width / 2, height / 2, height * 0.2, width / 2, height / 2, width * 0.7);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Grid.
  ctx.strokeStyle = 'rgba(200,180,138,0.08)';
  ctx.lineWidth = 1;
  for (let gx = 0; gx < width; gx += 40) {
    ctx.beginPath();
    ctx.moveTo(gx, 0);
    ctx.lineTo(gx, height);
    ctx.stroke();
  }
  for (let gy = 0; gy < height; gy += 40) {
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.lineTo(width, gy);
    ctx.stroke();
  }

  return canvas.toDataURL('image/png');
}
