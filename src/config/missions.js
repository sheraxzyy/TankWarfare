/**
 * Ten-mission campaign plus mode configuration.
 *
 * Types:
 *  - eliminate  : destroy every hostile
 *  - convoy     : destroy tagged convoy trucks, then all hostiles
 *  - structures : destroy tagged outposts, then all hostiles
 *  - survive    : stay alive for N seconds against escalating waves
 *  - defend     : keep the command base alive for N seconds
 *  - boss       : destroy the WARLORD prototype
 */
export const MISSIONS = [
  {
    id: 1,
    name: 'DESERT ENTRY',
    codeName: 'OPEN HAND',
    map: 'desert',
    type: 'eliminate',
    threat: 'LOW',
    briefing:
      'Hostile armor has crossed the Al-Hazir line and dug into the eastern approaches. Push along the highway, clear the screening force and establish a foothold for the division.',
    objective: 'Eliminate all hostile armor in the sector.',
    intel: [
      '4 hostile vehicles identified: 3 scout tanks, 1 assault tank.',
      'Open desert. Use the rock outcrops to break line of sight.',
      'Your M68 cannon is effective against light armor.',
    ],
    enemies: [
      { type: 'scout', count: 3 },
      { type: 'assault', count: 1 },
    ],
    scale: 0.9,
    parTime: 150,
    rewards: { credits: 220, weapon: null, bonus: 0 },
  },
  {
    id: 2,
    name: 'LOST CONVOY',
    codeName: 'DEAD FREIGHT',
    map: 'desert',
    type: 'convoy',
    threat: 'MODERATE',
    briefing:
      'An enemy supply convoy is moving through the eastern highway under light escort. Intercept the trucks before they reach the outpost. Every crate that gets through extends the war.',
    objective: 'Destroy all 3 convoy trucks and eliminate their escorts.',
    intel: [
      'Trucks are thin-skinned but carry volatile cargo. Expect secondary explosions.',
      'Escort: 3 scouts and 2 assault tanks.',
      'The outpost to the north-east will reinforce if the convoy stalls.',
    ],
    enemies: [
      { type: 'scout', count: 3 },
      { type: 'assault', count: 2 },
    ],
    reinforcements: [
      { delay: 45, enemies: [{ type: 'scout', count: 2 }] },
    ],
    scale: 0.95,
    parTime: 230,
    rewards: { credits: 340, weapon: 'heavy', bonus: 0 },
  },
  {
    id: 3,
    name: 'ENEMY OUTPOST',
    codeName: 'IRON GATE',
    map: 'desert',
    type: 'structures',
    threat: 'MODERATE',
    briefing:
      'The 4th Armored has been taking fire from a forward outpost on the Al-Hazir ridge. Flatten its four hardpoints and break the enemy supply line before dawn.',
    objective: 'Destroy all 4 outpost hardpoints and clear the defenders.',
    intel: [
      'Hardpoints are reinforced but vulnerable to sustained cannon fire.',
      'Defenders: 4 assault tanks and 1 heavy tank.',
      'North-east compound contains flammable fuel barrels.',
    ],
    enemies: [
      { type: 'assault', count: 4 },
      { type: 'heavy', count: 1 },
    ],
    scale: 1.0,
    parTime: 260,
    rewards: { credits: 420, weapon: null, bonus: 0 },
  },
  {
    id: 4,
    name: 'FOREST AMBUSH',
    codeName: 'BLACKWOOD',
    map: 'forest',
    type: 'eliminate',
    threat: 'HIGH',
    briefing:
      'Recon reports an elite hunter-killer group moving through Blackwood under the tree canopy. They know the logging trails. You will have to fight for every metre of sight line.',
    objective: 'Eliminate the hunter-killer group and its reinforcements.',
    intel: [
      'Elite armor is faster and will attempt to flank and avoid your fire.',
      'Dense forest: short detection ranges, strong cover, hidden bunkers.',
      'Reinforcements are expected from the southern trail.',
    ],
    enemies: [
      { type: 'scout', count: 4 },
      { type: 'assault', count: 3 },
      { type: 'elite', count: 1 },
    ],
    reinforcements: [
      { delay: 50, enemies: [{ type: 'scout', count: 2 }] },
    ],
    scale: 1.05,
    parTime: 300,
    rewards: { credits: 520, weapon: 'rapid', bonus: 0 },
  },
  {
    id: 5,
    name: 'INDUSTRIAL ASSAULT',
    codeName: 'FOUNDRY FIRE',
    map: 'industrial',
    type: 'structures',
    threat: 'HIGH',
    briefing:
      'The Karst Foundry is producing replacement armor for the enemy. Four command posts control the complex. Shut them down and the foundry goes dark.',
    objective: 'Destroy the 4 command posts and eliminate all defenders.',
    intel: [
      'Heavy armor is concentrated around the central road.',
      'Container stacks provide hard cover — use them to isolate enemies.',
      'Fuel barrels are explosive and will chain-detonate.',
    ],
    enemies: [
      { type: 'assault', count: 4 },
      { type: 'heavy', count: 2 },
    ],
    reinforcements: [
      { delay: 65, enemies: [{ type: 'scout', count: 2 }] },
    ],
    scale: 1.1,
    parTime: 330,
    rewards: { credits: 620, weapon: null, bonus: 0 },
  },
  {
    id: 6,
    name: 'THE SURROUNDED',
    codeName: 'LAST CORDON',
    map: 'industrial',
    type: 'survive',
    threat: 'SEVERE',
    briefing:
      'A mechanized cordon is closing around your position. Division cannot extract you for two minutes. Hold the foundry yard and make them pay for every metre.',
    objective: 'Survive for 120 seconds against the encirclement.',
    intel: [
      'Waves are coming from all four approach roads.',
      'Supply crates will be dropped in the yard. Watch for a green flare.',
      'Relocate between container rows to avoid being surrounded.',
    ],
    surviveTime: 120,
    waveInterval: 17,
    wavePool: ['scout', 'scout', 'assault', 'heavy', 'elite'],
    maxAlive: 8,
    scale: 1.15,
    parTime: 120,
    rewards: { credits: 700, weapon: 'rocket', bonus: 0 },
  },
  {
    id: 7,
    name: 'NIGHT RAID',
    codeName: 'BLACKOUT',
    map: 'city',
    type: 'eliminate',
    threat: 'SEVERE',
    briefing:
      'Enemy command is using Varenholm’s blackout to move a strike group through the city. Intercept them in the rubble before they reach the river crossing.',
    objective: 'Eliminate the night strike group.',
    intel: [
      'Visibility is degraded. Enemies reveal themselves when they fire.',
      'Elite crews are equipped with thermal optics and will hunt aggressively.',
      'Stay mobile — the city streets are pre-registered for artillery.',
    ],
    enemies: [
      { type: 'scout', count: 2 },
      { type: 'elite', count: 3 },
      { type: 'heavy', count: 2 },
    ],
    night: true,
    scale: 1.2,
    parTime: 320,
    rewards: { credits: 800, weapon: null, bonus: 0 },
  },
  {
    id: 8,
    name: 'FINAL DEFENSE',
    codeName: 'ANVIL',
    map: 'desert',
    type: 'defend',
    threat: 'SEVERE',
    briefing:
      'The forward command bunker is the last node linking the division to theater command. Hold the line for two and a half minutes. If the bunker falls, the sector falls with it.',
    objective: 'Defend the command bunker for 150 seconds.',
    intel: [
      'Two assault groups will probe from the east and south.',
      'The bunker can absorb damage, but not indefinitely.',
      'Intercept heavy armor before it reaches the perimeter.',
    ],
    defendTime: 150,
    waveInterval: 20,
    wavePool: ['assault', 'scout', 'heavy', 'assault', 'elite'],
    maxAlive: 7,
    scale: 1.2,
    parTime: 150,
    rewards: { credits: 900, weapon: null, bonus: 0 },
  },
  {
    id: 9,
    name: 'ENEMY STRONGHOLD',
    codeName: 'BROKEN CROWN',
    map: 'city',
    type: 'structures',
    threat: 'CRITICAL',
    briefing:
      'The enemy’s city stronghold is the staging point for the Warlord offensive. Four fortified command nodes hold the district together. Tear them out and the offensive dies.',
    objective: 'Destroy all 4 stronghold nodes and eliminate the garrison.',
    intel: [
      'Garrison includes elite and heavy armor in prepared positions.',
      'Expect overlapping fields of fire from the central boulevard.',
      'Rubble is passable; buildings are not.',
    ],
    enemies: [
      { type: 'elite', count: 5 },
      { type: 'heavy', count: 3 },
    ],
    reinforcements: [
      { delay: 80, enemies: [{ type: 'assault', count: 2 }] },
    ],
    scale: 1.3,
    parTime: 400,
    rewards: { credits: 1100, weapon: null, bonus: 0 },
  },
  {
    id: 10,
    name: 'OPERATION WARLORD',
    codeName: 'FINAL HAMMER',
    map: 'industrial',
    type: 'boss',
    threat: 'CRITICAL',
    briefing:
      'The Warlord prototype is online. It is the largest armored vehicle ever fielded by the enemy and it is moving on the foundry. Destroy it, and the war ends here.',
    objective: 'Destroy the WARLORD prototype.',
    intel: [
      'WARLORD fields three attack phases as its armor degrades.',
      'Phase two deploys scouting drones and a ramming charge.',
      'Phase three saturates the area with rockets. Keep moving.',
      'Escorts: elite and heavy armor.',
    ],
    enemies: [
      { type: 'elite', count: 2 },
      { type: 'heavy', count: 2 },
      { type: 'assault', count: 2 },
    ],
    boss: 'boss',
    scale: 1.3,
    parTime: 480,
    rewards: { credits: 2000, weapon: null, bonus: 0 },
  },
];

export function getMission(id) {
  return MISSIONS.find((m) => m.id === Number(id)) || MISSIONS[0];
}

export function getTotalMissionStars(saveState) {
  let total = 0;
  for (let i = 1; i <= MISSIONS.length; i++) {
    total += saveState.campaign.completed[i]?.stars || 0;
  }
  return total;
}

export const TRAINING_DRILLS = [
  { id: 'drive', name: 'MOVE 250 M', hint: 'W / S to drive.' },
  { id: 'rotate', name: 'FULL ROTATION', hint: 'A / D to rotate 360°.' },
  { id: 'fire', name: 'FIRE 5 SHELLS', hint: 'SPACE to fire the cannon.' },
  { id: 'reload', name: 'MANUAL RELOAD', hint: 'R to reload the magazine.' },
  { id: 'destroy', name: 'KILL 3 TARGETS', hint: 'Destroy the gunnery targets.' },
  { id: 'navigate', name: 'CLEAR THE COURSE', hint: 'Drive through all 3 checkpoints.' },
];

export const SURVIVAL_CONFIG = {
  maxAliveBase: 8,
  spawnStagger: 0.7,
  intermission: 6,
  startingScore: 0,
  waveClearBonus: 250,
  pickupPerWave: 2,
};

export const MODE_INFO = {
  campaign: {
    title: 'CAMPAIGN',
    label: '10-MISSION OPERATION',
    description: 'Fight through ten linked operations across four theaters. Complete objectives to unlock the next mission and earn credits for armor upgrades.',
  },
  survival: {
    title: 'SURVIVAL',
    label: 'ENDLESS ARMORED ASSAULT',
    description: 'Hold against escalating enemy waves. Boss armor deploys every fifth wave. Score, wave and survival time are recorded.',
  },
  training: {
    title: 'TRAINING',
    label: 'CREW CERTIFICATION',
    description: 'A safe live-fire range. Practice movement, gunnery, reloading and obstacle navigation. All weapons are unlocked here for testing.',
  },
};
