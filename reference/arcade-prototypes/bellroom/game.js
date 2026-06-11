(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: false });
  const overlay = document.getElementById('overlay');
  const overlayCopy = document.getElementById('overlayCopy');
  const startBtn = document.getElementById('startBtn');
  const draft = document.getElementById('draft');
  const draftCardsEl = document.getElementById('draftCards');
  const draftTitle = document.getElementById('draftTitle');
  const draftSub = document.getElementById('draftSub');
  const rerollBtn = document.getElementById('rerollBtn');
  const roomNameEl = document.getElementById('roomName');
  const roomMetaEl = document.getElementById('roomMeta');
  const subLineEl = document.getElementById('subLine');
  const barsEl = document.getElementById('bars');
  const scoreEl = document.getElementById('score');
  const comboEl = document.getElementById('combo');
  const buildEl = document.getElementById('build');
  const toastEl = document.getElementById('toast');

  const TAU = Math.PI * 2;
  const SAVE_KEY = 'noMoonBellroomArcade_v1';
  const EPS = 0.00001;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a = 1, b) => {
    if (b === undefined) { b = a; a = 0; }
    return Math.random() * (b - a) + a;
  };
  const randi = (a, b) => Math.floor(rand(a, b + 1));
  const chance = (p) => Math.random() < p;
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const len = (x, y) => Math.hypot(x, y);
  const angleTo = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
  const norm = (x, y) => {
    const l = Math.hypot(x, y) || 1;
    return { x: x / l, y: y / l, l };
  };
  const damp = (cur, target, lambda, dt) => lerp(cur, target, 1 - Math.exp(-lambda * dt));

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function seeded(seed, offset = 0) {
    const x = Math.sin(seed * 12.9898 + offset * 78.233) * 43758.5453123;
    return x - Math.floor(x);
  }

  function hexParts(hex) {
    let h = String(hex || '#ffffff').replace('#', '').trim();
    if (h.length === 3) h = h.split('').map(ch => ch + ch).join('');
    const n = parseInt(h, 16) || 0xffffff;
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function rgba(hex, a = 1) {
    const c = hexParts(hex);
    return `rgba(${c.r}, ${c.g}, ${c.b}, ${a})`;
  }

  function mixColor(a, b, t, alpha = 1) {
    const ca = hexParts(a);
    const cb = hexParts(b);
    const r = Math.round(lerp(ca.r, cb.r, t));
    const g = Math.round(lerp(ca.g, cb.g, t));
    const bb = Math.round(lerp(ca.b, cb.b, t));
    return `rgba(${r}, ${g}, ${bb}, ${alpha})`;
  }

  function roundRectPath(g, x, y, w, h, r) {
    const rr = Math.min(r, w * 0.5, h * 0.5);
    g.beginPath();
    g.moveTo(x + rr, y);
    g.arcTo(x + w, y, x + w, y + h, rr);
    g.arcTo(x + w, y + h, x, y + h, rr);
    g.arcTo(x, y + h, x, y, rr);
    g.arcTo(x, y, x + w, y, rr);
    g.closePath();
  }

  function drawSoftGlow(g, x, y, r, color, a = 0.18) {
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, rgba(color, a));
    grad.addColorStop(0.48, rgba(color, a * 0.35));
    grad.addColorStop(1, rgba(color, 0));
    g.fillStyle = grad;
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.fill();
  }

  const BIOMES = [
    { id: 'verdigris', tier: 'early', name: 'Verdigris Court', top: '#173024', bottom: '#08110b', accent: '#8cf0b7', accent2: '#dbffe5', deep: '#254536', dim: '#122117', shot: '#a8ffd2', layouts: ['courtyard', 'lanesV', 'scatter'] },
    { id: 'fen', tier: 'early', name: 'Drownlight Fen', top: '#10252e', bottom: '#071116', accent: '#79dcff', accent2: '#b7f6ff', deep: '#1d3943', dim: '#102028', shot: '#a8f3ff', layouts: ['edges', 'scatter', 'lanesH'] },
    { id: 'mirror', tier: 'early', name: 'Mirror Orchard', top: '#171f33', bottom: '#080f18', accent: '#84d0ff', accent2: '#f0b8ff', deep: '#22324c', dim: '#111929', shot: '#d7c0ff', layouts: ['scatter', 'lanesV', 'ring'] },
    { id: 'rosewire', tier: 'early', name: 'Rosewire Atrium', top: '#25162a', bottom: '#0c0812', accent: '#ff93cf', accent2: '#b9ffb8', deep: '#3a1f3d', dim: '#17101d', shot: '#ffd0e9', layouts: ['courtyard', 'spine', 'scatter'] },
    { id: 'ember', tier: 'mid', name: 'Cinder Span', top: '#271611', bottom: '#0c0706', accent: '#ff9b62', accent2: '#ffd0a1', deep: '#502218', dim: '#22100c', shot: '#ffc58b', layouts: ['ring', 'spine', 'scatter'] },
    { id: 'mycelium', tier: 'mid', name: 'Lumen Mycelia', top: '#181427', bottom: '#090713', accent: '#c596ff', accent2: '#9effdc', deep: '#32204a', dim: '#150d23', shot: '#dfbcff', layouts: ['ring', 'scatter', 'pockets'] },
    { id: 'shardreef', tier: 'mid', name: 'Shardreef Causeway', top: '#102434', bottom: '#081119', accent: '#7ce8ff', accent2: '#c6adff', deep: '#1b3446', dim: '#0e1824', shot: '#bdfdff', layouts: ['lanesH', 'spine', 'scatter'] },
    { id: 'coilroot', tier: 'mid', name: 'Coilroot Vault', top: '#161a10', bottom: '#090b08', accent: '#d8c979', accent2: '#94ffbf', deep: '#31351d', dim: '#12140b', shot: '#fff0a1', layouts: ['crossroads', 'lanesV', 'scatter'] },
    { id: 'archive', tier: 'late', name: 'Obsidian Archive', top: '#151822', bottom: '#06070c', accent: '#ffd46f', accent2: '#fff0ac', deep: '#303549', dim: '#0d0f16', shot: '#fff2b0', layouts: ['crossroads', 'ring', 'scatter'] },
    { id: 'basilica', tier: 'late', name: 'Null Basilica', top: '#151223', bottom: '#07060d', accent: '#d9c8ff', accent2: '#ffd88c', deep: '#26213c', dim: '#0b0a13', shot: '#f2dcff', layouts: ['courtyard', 'ring', 'pockets'] },
    { id: 'forge', tier: 'late', name: 'Sable Forge', top: '#24120f', bottom: '#090505', accent: '#ff8864', accent2: '#ffc682', deep: '#381914', dim: '#120807', shot: '#ffd0a0', layouts: ['spine', 'lanesH', 'ring'] },
    { id: 'ossuary', tier: 'late', name: 'Auric Ossuary', top: '#17161a', bottom: '#08070a', accent: '#f5d16c', accent2: '#a9e8ff', deep: '#2f2b26', dim: '#0d0c10', shot: '#fff0aa', layouts: ['edges', 'crossroads', 'scatter'] },
    { id: 'noctlith', tier: 'abyss', name: 'Noctlith Gallery', top: '#11152a', bottom: '#05060d', accent: '#9fd2ff', accent2: '#ffd37c', deep: '#202844', dim: '#0b0d17', shot: '#d9ecff', layouts: ['crossroads', 'ring', 'pockets'] },
    { id: 'frostreliquary', tier: 'abyss', name: 'Frost Reliquary', top: '#0f1f2f', bottom: '#050b10', accent: '#a7ecff', accent2: '#fff0bd', deep: '#1c3340', dim: '#0b1418', shot: '#dff7ff', layouts: ['edges', 'ring', 'scatter'] },
    { id: 'stormloom', tier: 'abyss', name: 'Stormloom Array', top: '#121827', bottom: '#05070d', accent: '#8cf3d9', accent2: '#d2b6ff', deep: '#1b2a38', dim: '#0a0f17', shot: '#d9fff3', layouts: ['spine', 'crossroads', 'lanesV'] },
    { id: 'umbraharvest', tier: 'abyss', name: 'Umbra Harvest', top: '#1a1020', bottom: '#070509', accent: '#ffadcf', accent2: '#f9e59f', deep: '#2c1830', dim: '#100910', shot: '#ffd9eb', layouts: ['courtyard', 'pockets', 'scatter'] },
    { id: 'auricspire', tier: 'zenith', name: 'Auric Spire', top: '#171827', bottom: '#06070c', accent: '#ffe07c', accent2: '#e4d2ff', deep: '#2e2a2e', dim: '#0e0e13', shot: '#fff2b5', layouts: ['crossroads', 'ring', 'courtyard'] },
    { id: 'blacksungarden', tier: 'zenith', name: 'Blacksun Garden', top: '#16121e', bottom: '#05050a', accent: '#dcb0ff', accent2: '#ffe69b', deep: '#251f2f', dim: '#0b0910', shot: '#edd7ff', layouts: ['courtyard', 'ring', 'spine'] },
    { id: 'solarium', tier: 'zenith', name: 'Sable Solarium', top: '#20160f', bottom: '#080606', accent: '#ffcb7b', accent2: '#b8ecff', deep: '#2d1f18', dim: '#100b09', shot: '#ffe1ac', layouts: ['lanesH', 'ring', 'edges'] },
    { id: 'crownworks', tier: 'zenith', name: 'Crownworks Engine', top: '#141a23', bottom: '#05070b', accent: '#9ec6ff', accent2: '#ffe79a', deep: '#1d2633', dim: '#0b1015', shot: '#deecff', layouts: ['crossroads', 'spine', 'lanesV'] },
    { id: 'empyrean', tier: 'final', name: 'Empyrean Vestibule', top: '#17131f', bottom: '#05050a', accent: '#ffe391', accent2: '#f3d7ff', deep: '#261f2d', dim: '#0b0910', shot: '#fff1b8', layouts: ['ring', 'courtyard', 'crossroads'] },
    { id: 'nullthrone', tier: 'final', name: 'Null Throne', top: '#110f19', bottom: '#040408', accent: '#ffd0ff', accent2: '#fff0b0', deep: '#201a2b', dim: '#09070f', shot: '#ffe2ff', layouts: ['crossroads', 'ring', 'courtyard'] }
  ];

  const ENEMY_TYPES = {
    skitter: { display: 'Pewling', cost: 1, r: 13, hp: 2.0, speed: 118, color: '#ff7b72', behavior: 'skitter', unlock: 1, weight: 9, score: 90 },
    gunner: { display: 'Censer', cost: 2, r: 15, hp: 3.4, speed: 82, color: '#ffba73', behavior: 'gunner', unlock: 1, weight: 7, score: 145 },
    charger: { display: 'Ramwraith', cost: 2, r: 17, hp: 4.2, speed: 96, color: '#ff5c91', behavior: 'charger', unlock: 2, weight: 6, score: 165 },
    turret: { display: 'Lectern', cost: 2, r: 18, hp: 4.8, speed: 20, color: '#c494ff', behavior: 'turret', unlock: 3, weight: 5, score: 160 },
    brute: { display: 'Ox-Warden', cost: 3, r: 23, hp: 8.0, speed: 62, color: '#ffa06a', behavior: 'brute', unlock: 4, weight: 4, score: 250 },
    sniper: { display: 'Long Candle', cost: 3, r: 16, hp: 4.5, speed: 72, color: '#9cd7ff', behavior: 'sniper', unlock: 5, weight: 4, score: 260 },
    hexer: { display: 'Antiphon', cost: 3, r: 17, hp: 5.2, speed: 76, color: '#a8ffd8', behavior: 'hexer', unlock: 6, weight: 4, score: 285 },
    myrmidon: { display: 'Crown-Sworn', cost: 4, r: 20, hp: 7.2, speed: 92, color: '#ffd39a', behavior: 'myrmidon', unlock: 8, weight: 3, score: 375 },
    lien: { display: 'Lien Apostle', cost: 6, r: 25, hp: 16, speed: 76, color: '#ffadcf', behavior: 'lien', unlock: 9, weight: 1, score: 820, miniboss: true },
    falseMoon: { display: 'False Moon', cost: 9, r: 32, hp: 32, speed: 82, color: '#f6d6ff', behavior: 'falseMoon', unlock: 11, weight: 1, score: 1500, miniboss: true },
    spiggot: { display: 'Spiggot', cost: 9, r: 30, hp: 28, speed: 116, color: '#ffe28a', behavior: 'spiggot', unlock: 13, weight: 1, score: 1500, miniboss: true },
    warden: { display: 'Graven Warden', cost: 999, r: 42, hp: 72, speed: 72, color: '#ffe27d', behavior: 'warden', unlock: 5, score: 3200, boss: true },
    archon: { display: 'Null Archon', cost: 999, r: 52, hp: 142, speed: 78, color: '#f5d9ff', behavior: 'archon', unlock: 15, score: 7000, boss: true }
  };

  const UPGRADE_DEFS = [
    { id: 'repair', name: 'Repair Bloom', short: 'Repair', type: 'survival', color: '#7efab7', weight: 4, tags: ['Heal', 'Immediate'], transient: true, desc: 'Repair 2 integrity right now. Not sexy. Very alive.', apply: p => healPlayer(2) },
    { id: 'hullScripture', name: 'Hull Scripture', short: 'Hull', type: 'survival', color: '#ff9db1', weight: 3, max: 5, tags: ['Max HP', 'Rare'], desc: '+1 max integrity and +1 repair. The room signs your bones in wet cursive.', apply: p => { p.upgrades.hullScripture = (p.upgrades.hullScripture || 0) + 1; p.maxHp += 1; healPlayer(1); } },
    { id: 'lunarCaliber', name: 'Lunar Caliber', short: 'Caliber', type: 'weapon', color: '#d8ecff', weight: 6, max: 7, tags: ['Damage', 'Bigger shots'], desc: 'Shots hit harder and widen slightly. Basic, brutal, correct.', apply: p => incUpgrade('lunarCaliber') },
    { id: 'rapid', name: 'Cadence Coil', short: 'Cadence', type: 'tempo', color: '#9fd2ff', weight: 6, max: 7, tags: ['Fire rate', 'Tempo'], desc: 'Twin emitters cycle faster. Moots develops even worse impulse control.', apply: p => incUpgrade('rapid') },
    { id: 'frame', name: 'Lope Lattice', short: 'Lope', type: 'movement', color: '#b6f69d', weight: 5, max: 5, tags: ['Speed', 'Dodge'], desc: 'Move faster and keep your ankles out of the cathedral blender.', apply: p => incUpgrade('frame') },
    { id: 'ricochet', name: 'Prism Teeth', short: 'Prism', type: 'projectile', color: '#8dd6ff', weight: 5, max: 4, tags: ['Bounce', 'Walls'], desc: 'Shots ricochet off walls and stones. The room learns to fear geometry.', apply: p => incUpgrade('ricochet') },
    { id: 'phaseDrill', name: 'Phase Drill', short: 'Drill', type: 'projectile', color: '#d9b8ff', weight: 5, max: 5, tags: ['Pierce', 'Lane clear'], desc: 'Rounds punch through extra bodies. Hallway logic, one-room violence.', apply: p => incUpgrade('phaseDrill') },
    { id: 'hunterMycelia', name: 'Hunter Mycelia', short: 'Hunter', type: 'projectile', color: '#9cffcb', weight: 5, max: 5, tags: ['Homing', 'Tracking'], desc: 'Shots gain a homing itch. They do not forgive. They do not attend therapy.', apply: p => incUpgrade('hunterMycelia') },
    { id: 'splitWake', name: 'Split Wake', short: 'Split', type: 'on-kill', color: '#c5f1ff', weight: 4, max: 4, tags: ['On kill', 'Forking'], desc: 'Killing shots split into a little fan of spite. Excellent room hygiene.', apply: p => incUpgrade('splitWake') },
    { id: 'graveCharge', name: 'Grave Charge', short: 'Grave', type: 'on-kill', color: '#ff8c7d', weight: 5, max: 5, tags: ['Death blast', 'Area'], desc: 'Enemies detonate when they die. Their final opinion becomes shrapnel.', apply: p => incUpgrade('graveCharge') },
    { id: 'staticLink', name: 'Arc Rosary', short: 'Rosary', type: 'control', color: '#b0f1ff', weight: 4, max: 4, tags: ['Chain', 'Arc'], desc: 'Hits arc damage into nearby bodies like beads on a very rude string.', apply: p => incUpgrade('staticLink') },
    { id: 'cryoRime', name: 'Gravemire Liturgy', short: 'Mire', type: 'control', color: '#bfeaff', weight: 4, max: 4, tags: ['Slow', 'Control'], desc: 'Hits drag enemy movement down. The sermon is cold and legally actionable.', apply: p => incUpgrade('cryoRime') },
    { id: 'orbitalHalo', name: 'Orbital Halo', short: 'Halo', type: 'defense', color: '#fff1a8', weight: 4, max: 5, tags: ['Orbitals', 'Barrier'], desc: 'Adds a damaging ward that circles you and clips bullets. Pretty little restraining order.', apply: p => incUpgrade('orbitalHalo') },
    { id: 'rearArray', name: 'Rear Array', short: 'Rear', type: 'weapon', color: '#ffb48c', weight: 4, max: 4, tags: ['Rear fire', 'Coverage'], desc: 'Every volley spits stingers behind you. Paranoia, but productive.', apply: p => incUpgrade('rearArray') },
    { id: 'sidecarLances', name: 'Sidecar Lances', short: 'Sidecar', type: 'weapon', color: '#b8d7ff', weight: 4, max: 4, tags: ['Side fire', 'Coverage'], desc: 'Every volley adds lateral shots. The room gets cross-examined.', apply: p => incUpgrade('sidecarLances') },
    { id: 'shrapnelChamber', name: 'Shrapnel Chamber', short: 'Shrapnel', type: 'projectile', color: '#ffe391', weight: 3, max: 4, tags: ['Fragments', 'Impact'], desc: 'Impacts burst into fragments. Finally, a gun with commitment issues.', apply: p => incUpgrade('shrapnelChamber') },
    { id: 'echoChamber', name: 'Echo Chamber', short: 'Echo', type: 'tempo', color: '#e7f4ff', weight: 4, max: 4, tags: ['Repeat', 'Aftershock'], desc: 'Every few volleys repeat as a spectral aftershock. The bullet has a podcast.', apply: p => incUpgrade('echoChamber') },
    { id: 'scavengerDrone', name: 'Lantern Pup', short: 'Pup', type: 'companion', color: '#ffd48b', weight: 4, max: 4, tags: ['Companion', 'Autofire'], desc: 'Adds a tiny orbiting bastard that shoots for itself. Loyal, annoying, effective.', apply: p => incUpgrade('scavengerDrone') },
    { id: 'emberMine', name: 'Ember Mine', short: 'Mine', type: 'trap', color: '#ffa86f', weight: 4, max: 4, tags: ['Mines', 'Area'], desc: 'Moving leaves armed mines behind you. Your retreat becomes a lawsuit.', apply: p => incUpgrade('emberMine') },
    { id: 'spiteCore', name: 'Spite Core', short: 'Spite', type: 'retaliation', color: '#ff90ca', weight: 3, max: 4, tags: ['Retaliate', 'Burst'], desc: 'Taking a hit spits a radial burst back into the room. Emotional regulation failed successfully.', apply: p => incUpgrade('spiteCore') },
    { id: 'aegisLattice', name: 'Aegis Lattice', short: 'Aegis', type: 'defense', color: '#b6ddff', weight: 3, max: 3, tags: ['Shield', 'Safety'], desc: 'Adds a regenerating guard layer. It buys time, not forgiveness.', apply: p => { incUpgrade('aegisLattice'); p.shieldMax = Math.max(p.shieldMax, p.upgrades.aegisLattice || 0); p.shield = Math.min(p.shieldMax, p.shield + 1); } },
    { id: 'siphonVane', name: 'Siphon Vane', short: 'Siphon', type: 'survival', color: '#9effc2', weight: 4, max: 4, tags: ['On kill', 'Repair'], desc: 'Kills can shed repair blooms. Violence with a benefits package.', apply: p => incUpgrade('siphonVane') },
    { id: 'bloodTithe', name: 'Blood Tithe', short: 'Tithe', type: 'survival', color: '#ff6f8f', weight: 4, max: 4, tags: ['On kill', 'Heal'], desc: 'Every handful of kills repairs the hull. The tax code finally helps.', apply: p => incUpgrade('bloodTithe') },
    { id: 'executionBloom', name: 'Execution Bloom', short: 'Bloom', type: 'damage', color: '#ffb27d', weight: 4, max: 4, tags: ['Finisher', 'Boss bite'], desc: 'Wounded enemies take extra finishing damage. Mercy has left the building.', apply: p => incUpgrade('executionBloom') },
    { id: 'moonShard', name: 'Moon Shard', short: 'Shard', type: 'damage', color: '#f5e3ff', weight: 4, max: 4, tags: ['Crit', 'Burst'], desc: 'Shots can critically flare for bonus damage. The moon headbutts probability.', apply: p => incUpgrade('moonShard') },
    { id: 'gravityWell', name: 'Covetmark', short: 'Covet', type: 'utility', color: '#9ec7ff', weight: 3, max: 4, tags: ['Magnet', 'Greed'], desc: 'Pickups pull toward you from farther out. Greed, but with tasteful lighting.', apply: p => incUpgrade('gravityWell') },
    { id: 'riftCapacitor', name: 'Rift Capacitor', short: 'Rift', type: 'tempo', color: '#c2f1ff', weight: 3, max: 4, tags: ['Room clear', 'Recovery'], desc: 'After enough room clears, recover integrity. The arcade machine coughs up pity.', apply: p => incUpgrade('riftCapacitor') },
    { id: 'blackLotus', name: 'Black Lotus', short: 'Lotus', type: 'control', color: '#dcb0ff', weight: 3, max: 4, tags: ['Room clear', 'Slow field'], desc: 'Clearing a room leaves a brief slowing bloom for the next load-in.', apply: p => incUpgrade('blackLotus') }
  ];
  const UPGRADE_BY_ID = Object.fromEntries(UPGRADE_DEFS.map(u => [u.id, u]));

  let W = 1;
  let H = 1;
  let DPR = 1;
  const arena = { x: 40, y: 86, w: 800, h: 520 };

  const input = {
    keys: Object.create(null),
    mouse: { x: 0, y: 0, seen: false, down: false },
    moveTouch: { id: null, startX: 0, startY: 0, x: 0, y: 0, dx: 0, dy: 0 },
    aimTouch: { id: null, startX: 0, startY: 0, x: 0, y: 0, dx: 0, dy: 0 },
    gamepad: { last: 0 }
  };

  const meta = loadMeta();

  const state = {
    mode: 'title',
    time: 0,
    roomNumber: 0,
    routeOffset: 0,
    score: 0,
    combo: 0,
    comboTimer: 0,
    kills: 0,
    roomsCleared: 0,
    runTime: 0,
    player: null,
    room: null,
    enemies: [],
    bullets: [],
    enemyBullets: [],
    particles: [],
    pickups: [],
    mines: [],
    hazards: [],
    drones: [],
    echoes: [],
    waves: [],
    messages: [],
    roomIntro: 0,
    clearTimer: -1,
    shake: 0,
    flash: 0,
    draftCards: [],
    rerolls: 0,
    lastHudKey: '',
    audio: { ctx: null, master: null, muted: false },
    stars: Array.from({ length: 130 }, (_, i) => ({ sx: seeded(i, 1), sy: seeded(i, 2), r: 0.35 + seeded(i, 3) * 1.45, p: seeded(i, 4) * TAU }))
  };

  function loadMeta() {
    try {
      return Object.assign({ bestScore: 0, bestRoom: 0, bestKills: 0, runs: 0 }, JSON.parse(localStorage.getItem(SAVE_KEY) || '{}'));
    } catch (_) {
      return { bestScore: 0, bestRoom: 0, bestKills: 0, runs: 0 };
    }
  }

  function saveMeta() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(meta)); } catch (_) {}
  }

  function resize() {
    W = window.innerWidth || 1;
    H = window.innerHeight || 1;
    DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    canvas.width = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.imageSmoothingEnabled = true;

    const side = clamp(Math.min(W, H) * 0.045, 18, 58);
    const hudTop = W < 720 ? 94 : 86;
    const bottom = W < 720 ? 28 : 72;
    arena.x = side;
    arena.y = Math.max(hudTop, side + 34);
    arena.w = Math.max(320, W - side * 2);
    arena.h = Math.max(270, H - arena.y - bottom);
    if (arena.h > arena.w * 0.76) {
      const extra = arena.h - arena.w * 0.76;
      arena.y += extra * 0.45;
      arena.h -= extra * 0.6;
    }
    if (state.player) {
      state.player.x = clamp(state.player.x, arena.x + state.player.r, arena.x + arena.w - state.player.r);
      state.player.y = clamp(state.player.y, arena.y + state.player.r, arena.y + arena.h - state.player.r);
    }
  }
  window.addEventListener('resize', resize, { passive: true });
  resize();

  function showToast(text, color = '#f3dcff') {
    toastEl.textContent = text;
    toastEl.style.borderColor = rgba(color, 0.35);
    toastEl.style.boxShadow = `0 0 28px ${rgba(color, 0.12)}`;
    toastEl.classList.add('show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toastEl.classList.remove('show'), 1450);
  }

  function ensureAudio() {
    if (state.audio.ctx) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ac = new AudioContext();
      const master = ac.createGain();
      master.gain.value = 0.13;
      master.connect(ac.destination);
      state.audio.ctx = ac;
      state.audio.master = master;
    } catch (_) {}
  }

  function tone(freq = 220, dur = 0.06, type = 'triangle', gain = 0.035, slide = 0) {
    const ac = state.audio.ctx;
    if (!ac || !state.audio.master || state.audio.muted) return;
    const t = ac.currentTime;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, freq), t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(state.audio.master);
    osc.start(t);
    osc.stop(t + dur + 0.03);
  }

  function noise(dur = 0.09, gain = 0.03, filter = 1600) {
    const ac = state.audio.ctx;
    if (!ac || !state.audio.master || state.audio.muted) return;
    const lenSamples = Math.max(1, Math.floor(ac.sampleRate * dur));
    const buffer = ac.createBuffer(1, lenSamples, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < lenSamples; i++) data[i] = rand(-1, 1) * (1 - i / lenSamples);
    const src = ac.createBufferSource();
    const filt = ac.createBiquadFilter();
    const g = ac.createGain();
    filt.type = 'bandpass';
    filt.frequency.value = filter;
    filt.Q.value = 0.7;
    g.gain.value = gain;
    src.buffer = buffer;
    src.connect(filt);
    filt.connect(g);
    g.connect(state.audio.master);
    src.start();
  }

  function incUpgrade(id) {
    const p = state.player;
    if (!p) return;
    p.upgrades[id] = (p.upgrades[id] || 0) + 1;
    recomputePlayerStats();
  }

  function createPlayer() {
    const p = {
      x: arena.x + arena.w * 0.5,
      y: arena.y + arena.h * 0.56,
      r: 16,
      baseSpeed: 264,
      speed: 264,
      maxHp: 6,
      hp: 6,
      shield: 0,
      shieldMax: 0,
      shieldRegen: 0,
      damage: 0.88,
      fireDelay: 0.19,
      shotSpeed: 640,
      bulletRadius: 5.2,
      cooldown: 0,
      aim: -Math.PI / 2,
      invuln: 1.2,
      dashCooldown: 0,
      dashTimer: 0,
      dashAngle: 0,
      volleyCount: 0,
      mineTimer: 0,
      bloodCounter: 0,
      riftCounter: 0,
      upgrades: Object.create(null),
      color: '#f3dcff',
      color2: '#fff0b8'
    };
    return p;
  }

  function recomputePlayerStats() {
    const p = state.player;
    if (!p) return;
    const up = p.upgrades;
    p.speed = p.baseSpeed * (1 + (up.frame || 0) * 0.08);
    p.damage = 0.88 * (1 + (up.lunarCaliber || 0) * 0.16);
    p.fireDelay = Math.max(0.055, 0.19 * Math.pow(0.90, up.rapid || 0));
    p.bulletRadius = 5.2 + (up.lunarCaliber || 0) * 0.45;
    p.shotSpeed = 640 + (up.lunarCaliber || 0) * 10;
    p.shieldMax = Math.max(p.shieldMax, up.aegisLattice || 0);
    p.shield = clamp(p.shield, 0, p.shieldMax);
  }

  function healPlayer(amount) {
    const p = state.player;
    if (!p) return false;
    const before = p.hp;
    p.hp = Math.min(p.maxHp, p.hp + amount);
    if (p.hp > before) {
      spawnText(p.x, p.y - 28, `+${p.hp - before}`, '#7efab7');
      tone(440, 0.07, 'sine', 0.035, 1.35);
      return true;
    }
    return false;
  }

  function currentBiome() {
    if (state.room && state.room.biome) return state.room.biome;
    return BIOMES[0];
  }

  function startRun() {
    ensureAudio();
    if (state.audio.ctx && state.audio.ctx.state === 'suspended') state.audio.ctx.resume().catch(() => {});
    overlay.classList.add('hidden');
    draft.classList.add('hidden');
    Object.assign(state, {
      mode: 'play',
      time: 0,
      roomNumber: 0,
      routeOffset: randi(0, BIOMES.length - 1),
      score: 0,
      combo: 0,
      comboTimer: 0,
      kills: 0,
      roomsCleared: 0,
      runTime: 0,
      enemies: [],
      bullets: [],
      enemyBullets: [],
      particles: [],
      pickups: [],
      mines: [],
      hazards: [],
      drones: [],
      echoes: [],
      waves: [],
      messages: [],
      roomIntro: 0,
      clearTimer: -1,
      shake: 0,
      flash: 0,
      draftCards: [],
      rerolls: 0,
      lastHudKey: ''
    });
    state.player = createPlayer();
    meta.runs += 1;
    saveMeta();
    startRoom(1);
    showToast('Bellroom sealed. Survive the damn room.', '#f3dcff');
    tone(165, 0.12, 'sawtooth', 0.028, 1.7);
  }

  function gameOver() {
    const p = state.player;
    state.mode = 'gameover';
    meta.bestScore = Math.max(meta.bestScore || 0, Math.floor(state.score));
    meta.bestRoom = Math.max(meta.bestRoom || 0, state.roomsCleared);
    meta.bestKills = Math.max(meta.bestKills || 0, state.kills);
    saveMeta();
    overlayCopy.innerHTML = `Moots got folded in <strong>${currentBiome().name}</strong> after clearing <strong>${state.roomsCleared}</strong> room${state.roomsCleared === 1 ? '' : 's'}, killing <strong>${state.kills}</strong> hostile little problems, and banking <strong>${Math.floor(state.score).toLocaleString()}</strong> points. Best room: ${meta.bestRoom}. Best score: ${Math.floor(meta.bestScore).toLocaleString()}.`;
    startBtn.textContent = 'Run It Back';
    overlay.classList.remove('hidden');
    draft.classList.add('hidden');
    state.flash = 0.6;
    state.shake = Math.max(state.shake, 16);
    noise(0.22, 0.06, 420);
    tone(98, 0.28, 'sawtooth', 0.045, 0.45);
    if (p) burst(p.x, p.y, 42, '#ff6e92', 1.4);
  }

  function startRoom(n) {
    state.mode = 'play';
    state.roomNumber = n;
    state.room = generateRoom(n);
    state.enemies.length = 0;
    state.bullets.length = 0;
    state.enemyBullets.length = 0;
    state.pickups.length = 0;
    state.mines.length = 0;
    state.hazards.length = 0;
    state.echoes.length = 0;
    state.waves.length = 0;
    state.clearTimer = -1;
    state.roomIntro = n === 1 ? 1.25 : 0.95;
    const p = state.player;
    p.x = arena.x + arena.w * 0.5;
    p.y = arena.y + arena.h * 0.56;
    p.cooldown = Math.min(p.cooldown, 0.08);
    p.invuln = Math.max(p.invuln, 1.05);
    p.dashTimer = 0;
    p.mineTimer = 0.5;
    if ((p.upgrades.blackLotus || 0) > 0) {
      state.hazards.push({ x: p.x, y: p.y, r: 155 + p.upgrades.blackLotus * 24, life: 4.3, maxLife: 4.3, color: '#dcb0ff', slow: 0.45, damage: 0, friendly: true, pulse: rand(TAU) });
    }
    buildRoomWaves(n);
    pushMessage(`${state.room.biome.name}`, state.room.biome.accent, 1.35, 44);
    pushMessage(`${state.room.layoutLabel}`, state.room.biome.accent2, 1.1, 21, 0.25);
    updateHUD(true);
  }

  function generateRoom(n) {
    const biome = BIOMES[(state.routeOffset + n - 1) % BIOMES.length];
    const layout = pick(biome.layouts || ['scatter']);
    const room = {
      index: n,
      seed: Math.floor(rand(1, 999999)),
      biome,
      layout,
      layoutLabel: layoutLabel(layout),
      obstacles: [],
      staticHazards: [],
      walls: [],
      bossRoom: n % 5 === 0,
      captainRoom: n > 7 && n % 4 === 0 && n % 5 !== 0
    };
    populateObstacles(room);
    populateStaticHazards(room);
    return room;
  }

  function layoutLabel(layout) {
    return ({
      courtyard: 'Courtyard Compression',
      lanesV: 'Vertical Bell Lanes',
      lanesH: 'Horizontal Bell Lanes',
      scatter: 'Shattered Stone Pattern',
      ring: 'Ring of Bad Ideas',
      spine: 'Central Spine',
      pockets: 'Corner Pockets',
      crossroads: 'Crossroads Cage',
      edges: 'Edge Pressure'
    })[layout] || 'Wrong Room';
  }

  function safePoint(x, y, r = 22, roomArg = state.room) {
    const cx = arena.x + arena.w * 0.5;
    const cy = arena.y + arena.h * 0.56;
    if (Math.hypot(x - cx, y - cy) < 130 + r) return false;
    for (const o of (roomArg?.obstacles || [])) {
      if (shapeCircleCollide(o, x, y, r + 12)) return false;
    }
    return true;
  }

  function addObstacle(room, shape) {
    const cx = arena.x + arena.w * 0.5;
    const cy = arena.y + arena.h * 0.56;
    if (shape.type === 'circle') {
      if (Math.hypot(shape.x - cx, shape.y - cy) < shape.r + 105) return;
    } else {
      const px = clamp(cx, shape.x, shape.x + shape.w);
      const py = clamp(cy, shape.y, shape.y + shape.h);
      if (Math.hypot(px - cx, py - cy) < 110) return;
    }
    room.obstacles.push(shape);
  }

  function populateObstacles(room) {
    const b = room.biome;
    const cx = arena.x + arena.w * 0.5;
    const cy = arena.y + arena.h * 0.52;
    const aw = arena.w;
    const ah = arena.h;
    const ocol = mixColor(b.deep, b.accent, 0.16, 1);
    const line = rgba(b.accent, 0.25);
    const circ = (x, y, r, kind = 'pillar') => addObstacle(room, { type: 'circle', x, y, r, color: ocol, line, kind, rot: rand(TAU) });
    const rect = (x, y, w, h, kind = 'stone') => addObstacle(room, { type: 'rect', x, y, w, h, r: Math.min(22, w * 0.22, h * 0.22), color: ocol, line, kind, rot: 0 });

    if (room.layout === 'courtyard') {
      circ(cx - aw * 0.24, cy - ah * 0.21, clamp(aw * 0.035, 18, 34));
      circ(cx + aw * 0.24, cy - ah * 0.21, clamp(aw * 0.035, 18, 34));
      circ(cx - aw * 0.24, cy + ah * 0.22, clamp(aw * 0.035, 18, 34));
      circ(cx + aw * 0.24, cy + ah * 0.22, clamp(aw * 0.035, 18, 34));
      if (aw > 700) rect(cx - 44, arena.y + 42, 88, 34, 'altar');
    } else if (room.layout === 'ring') {
      const count = aw < 600 ? 5 : 7;
      const rr = Math.min(aw, ah) * 0.28;
      for (let i = 0; i < count; i++) {
        const a = (i / count) * TAU + rand(-0.12, 0.12);
        if (Math.abs(Math.sin(a)) > 0.92 && i % 2 === 0) continue;
        circ(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, clamp(aw * 0.026, 16, 29), 'ringstone');
      }
    } else if (room.layout === 'lanesV') {
      const ww = clamp(aw * 0.055, 30, 58);
      rect(cx - aw * 0.22 - ww * 0.5, arena.y + ah * 0.16, ww, ah * 0.26, 'lane');
      rect(cx - aw * 0.22 - ww * 0.5, arena.y + ah * 0.62, ww, ah * 0.24, 'lane');
      rect(cx + aw * 0.22 - ww * 0.5, arena.y + ah * 0.16, ww, ah * 0.26, 'lane');
      rect(cx + aw * 0.22 - ww * 0.5, arena.y + ah * 0.62, ww, ah * 0.24, 'lane');
    } else if (room.layout === 'lanesH') {
      const hh = clamp(ah * 0.065, 28, 52);
      rect(arena.x + aw * 0.12, cy - ah * 0.21 - hh * 0.5, aw * 0.29, hh, 'lane');
      rect(arena.x + aw * 0.60, cy - ah * 0.21 - hh * 0.5, aw * 0.28, hh, 'lane');
      rect(arena.x + aw * 0.12, cy + ah * 0.22 - hh * 0.5, aw * 0.29, hh, 'lane');
      rect(arena.x + aw * 0.60, cy + ah * 0.22 - hh * 0.5, aw * 0.28, hh, 'lane');
    } else if (room.layout === 'crossroads') {
      rect(cx - aw * 0.035, arena.y + ah * 0.12, aw * 0.07, ah * 0.25, 'spine');
      rect(cx - aw * 0.035, arena.y + ah * 0.66, aw * 0.07, ah * 0.22, 'spine');
      rect(arena.x + aw * 0.13, cy - ah * 0.04, aw * 0.24, ah * 0.08, 'spine');
      rect(arena.x + aw * 0.63, cy - ah * 0.04, aw * 0.24, ah * 0.08, 'spine');
    } else if (room.layout === 'spine') {
      const vertical = chance(0.55);
      const pieces = aw < 620 ? 3 : 4;
      for (let i = 0; i < pieces; i++) {
        if (vertical) {
          const y = arena.y + ah * (0.16 + i * 0.20);
          rect(cx - 26, y, 52, clamp(ah * 0.11, 42, 70), 'spine');
        } else {
          const x = arena.x + aw * (0.14 + i * 0.20);
          rect(x, cy - 24, clamp(aw * 0.11, 50, 88), 48, 'spine');
        }
      }
    } else if (room.layout === 'pockets') {
      for (const sx of [0.18, 0.82]) for (const sy of [0.18, 0.82]) {
        circ(arena.x + aw * sx, arena.y + ah * sy, clamp(aw * 0.035, 18, 33), 'pocket');
        if (aw > 700) circ(arena.x + aw * (sx + rand(-0.045, 0.045)), arena.y + ah * (sy + rand(-0.055, 0.055)), clamp(aw * 0.024, 14, 24), 'pocketSmall');
      }
    } else if (room.layout === 'edges') {
      for (let i = 0; i < 8; i++) {
        const edge = i % 4;
        let x = rand(arena.x + 60, arena.x + aw - 60);
        let y = rand(arena.y + 60, arena.y + ah - 60);
        if (edge === 0) y = arena.y + 50;
        if (edge === 1) x = arena.x + aw - 50;
        if (edge === 2) y = arena.y + ah - 50;
        if (edge === 3) x = arena.x + 50;
        circ(x, y, clamp(rand(16, 30), 16, aw * 0.045), 'edge');
      }
    } else {
      const count = aw < 600 ? 5 : 8;
      for (let i = 0; i < count; i++) {
        const x = rand(arena.x + 70, arena.x + aw - 70);
        const y = rand(arena.y + 70, arena.y + ah - 70);
        if (!safePoint(x, y, 32, room)) continue;
        if (chance(0.56)) circ(x, y, rand(16, 34), 'scatter');
        else rect(x - rand(18, 42), y - rand(14, 34), rand(42, 86), rand(30, 66), 'scatter');
      }
    }
  }

  function populateStaticHazards(room) {
    if (room.index < 3) return;
    const b = room.biome;
    const count = Math.min(5, Math.floor(room.index / 4));
    for (let i = 0; i < count; i++) {
      if (!chance(0.42)) continue;
      const x = rand(arena.x + 75, arena.x + arena.w - 75);
      const y = rand(arena.y + 75, arena.y + arena.h - 75);
      if (!safePoint(x, y, 34, room)) continue;
      room.staticHazards.push({ x, y, r: rand(26, 48), color: b.accent, slow: 0.78, damage: room.index > 10 ? 0.24 : 0.12, phase: rand(TAU) });
    }
  }

  function buildRoomWaves(n) {
    const bossRoom = n % 5 === 0;
    if (bossRoom) {
      const bossType = n % 15 === 0 ? 'archon' : 'warden';
      const x = arena.x + arena.w * 0.5;
      const y = arena.y + arena.h * 0.27;
      spawnEnemy(bossType, x, y, { bossScale: 1 + Math.floor(n / 15) * 0.28 });
      state.waves.push({ timer: 4.0, budget: 3 + Math.floor(n / 4), label: 'bell-adds' });
      state.waves.push({ timer: 10.0, budget: 4 + Math.floor(n / 3), label: 'bell-adds' });
      return;
    }

    const difficulty = 1 + n * 0.13;
    let budget = Math.floor(5 + n * 1.35 + Math.min(16, n * 0.35));
    if (state.room.captainRoom) budget += 8;
    spawnWave(Math.ceil(budget * 0.72), n, state.room.captainRoom);
    state.waves.push({ timer: 5.2, budget: Math.ceil(budget * (0.38 + Math.min(0.25, n * 0.015))), label: 'reinforcements' });
    if (n > 6) state.waves.push({ timer: 10.3, budget: Math.ceil(budget * 0.28 * difficulty), label: 'late teeth' });
    if (state.room.captainRoom) {
      const mini = n % 12 === 0 ? 'spiggot' : (n % 8 === 0 ? 'falseMoon' : 'lien');
      const pos = findSpawnPoint(240);
      spawnEnemy(mini, pos.x, pos.y, { miniScale: 0.8 + n * 0.02 });
      pushMessage('CAPTAIN IN THE ROOM', ENEMY_TYPES[mini].color, 1.3, 32, 0.4);
    }
  }

  function availableEnemyIds(roomNumber, includeMini = false) {
    return Object.keys(ENEMY_TYPES).filter(id => {
      const e = ENEMY_TYPES[id];
      if (e.boss) return false;
      if (e.miniboss && !includeMini) return false;
      return roomNumber >= (e.unlock || 1);
    });
  }

  function weightedEnemyPick(ids, budget) {
    const candidates = ids.filter(id => ENEMY_TYPES[id].cost <= budget);
    if (!candidates.length) return 'skitter';
    const total = candidates.reduce((s, id) => s + (ENEMY_TYPES[id].weight || 1), 0);
    let roll = rand(total);
    for (const id of candidates) {
      roll -= ENEMY_TYPES[id].weight || 1;
      if (roll <= 0) return id;
    }
    return candidates[candidates.length - 1];
  }

  function spawnWave(budget, roomNumber, forceElite = false) {
    const ids = availableEnemyIds(roomNumber, roomNumber > 12 && chance(0.18));
    let remaining = budget;
    let guard = 0;
    const formation = pick(['edges', 'ring', 'corners', 'spill']);
    const planned = [];
    while (remaining > 0 && guard++ < 44) {
      const id = weightedEnemyPick(ids, remaining);
      remaining -= ENEMY_TYPES[id].cost;
      planned.push(id);
    }
    planned.forEach((id, i) => {
      const pos = formationPoint(formation, i, planned.length);
      const elite = forceElite || (roomNumber > 8 && chance(0.04 + roomNumber * 0.004));
      spawnEnemy(id, pos.x, pos.y, { elite });
    });
  }

  function formationPoint(formation, i, total) {
    const pad = 50;
    if (formation === 'ring') {
      const a = (i / Math.max(1, total)) * TAU + rand(-0.16, 0.16);
      const rx = arena.w * 0.42;
      const ry = arena.h * 0.42;
      return findSpawnPoint(160, arena.x + arena.w * 0.5 + Math.cos(a) * rx, arena.y + arena.h * 0.52 + Math.sin(a) * ry);
    }
    if (formation === 'corners') {
      const spots = [
        { x: arena.x + pad, y: arena.y + pad },
        { x: arena.x + arena.w - pad, y: arena.y + pad },
        { x: arena.x + pad, y: arena.y + arena.h - pad },
        { x: arena.x + arena.w - pad, y: arena.y + arena.h - pad }
      ];
      const s = spots[i % spots.length];
      return findSpawnPoint(145, s.x + rand(-24, 24), s.y + rand(-24, 24));
    }
    if (formation === 'edges') {
      const edge = i % 4;
      let x = rand(arena.x + pad, arena.x + arena.w - pad);
      let y = rand(arena.y + pad, arena.y + arena.h - pad);
      if (edge === 0) y = arena.y + pad;
      if (edge === 1) x = arena.x + arena.w - pad;
      if (edge === 2) y = arena.y + arena.h - pad;
      if (edge === 3) x = arena.x + pad;
      return findSpawnPoint(145, x, y);
    }
    return findSpawnPoint(160);
  }

  function findSpawnPoint(avoid = 150, preferX = null, preferY = null) {
    const p = state.player || { x: arena.x + arena.w * 0.5, y: arena.y + arena.h * 0.5 };
    for (let i = 0; i < 80; i++) {
      const x = preferX == null ? rand(arena.x + 46, arena.x + arena.w - 46) : clamp(preferX + rand(-70, 70), arena.x + 42, arena.x + arena.w - 42);
      const y = preferY == null ? rand(arena.y + 46, arena.y + arena.h - 46) : clamp(preferY + rand(-70, 70), arena.y + 42, arena.y + arena.h - 42);
      if (Math.hypot(x - p.x, y - p.y) < avoid) continue;
      if (blockedAt(x, y, 24)) continue;
      return { x, y };
    }
    const a = rand(TAU);
    return {
      x: clamp(arena.x + arena.w * 0.5 + Math.cos(a) * arena.w * 0.42, arena.x + 48, arena.x + arena.w - 48),
      y: clamp(arena.y + arena.h * 0.5 + Math.sin(a) * arena.h * 0.42, arena.y + 48, arena.y + arena.h - 48)
    };
  }

  function spawnEnemy(id, x, y, opts = {}) {
    const base = ENEMY_TYPES[id] || ENEMY_TYPES.skitter;
    const roomScale = 1 + Math.max(0, state.roomNumber - 1) * 0.055;
    const eliteScale = opts.elite ? 1.45 : 1;
    const bossScale = opts.bossScale || opts.miniScale || 1;
    const hpScale = base.boss ? bossScale * (1 + state.roomNumber * 0.045) : base.miniboss ? bossScale * roomScale : roomScale * eliteScale;
    const e = {
      type: id,
      display: base.display,
      behavior: base.behavior,
      x,
      y,
      vx: 0,
      vy: 0,
      r: base.r * (opts.elite ? 1.12 : 1) * (base.boss ? bossScale * 0.95 : 1),
      hp: base.hp * hpScale,
      maxHp: base.hp * hpScale,
      speed: base.speed * (1 + Math.min(0.75, state.roomNumber * 0.018)) * (opts.elite ? 1.08 : 1),
      color: opts.elite ? mixColor(base.color, '#ffffff', 0.28, 1) : base.color,
      cooldown: rand(0.4, 1.6),
      subcool: rand(0.3, 1.1),
      state: 'idle',
      timer: 0,
      t: rand(10),
      angle: rand(TAU),
      hitFlash: 0,
      slow: 0,
      elite: !!opts.elite,
      boss: !!base.boss,
      miniboss: !!base.miniboss,
      score: base.score || 100,
      dead: false,
      contactTimer: 0
    };
    state.enemies.push(e);
    for (let i = 0; i < 10; i++) particle(x, y, rand(-60, 60), rand(-60, 60), e.color, rand(0.22, 0.5), rand(2, 5));
    return e;
  }

  function pushMessage(text, color = '#ffffff', life = 1.4, size = 28, delay = 0) {
    state.messages.push({ text, color, life, maxLife: life, size, delay, y: rand(-4, 4) });
  }

  function spawnText(x, y, text, color = '#fff') {
    state.particles.push({ x, y, vx: rand(-12, 12), vy: rand(-42, -28), color, life: 0.78, maxLife: 0.78, r: 1, text });
  }

  function particle(x, y, vx, vy, color, life = 0.5, r = 3) {
    if (state.particles.length > 420) state.particles.splice(0, state.particles.length - 420);
    state.particles.push({ x, y, vx, vy, color, life, maxLife: life, r });
  }

  function burst(x, y, count, color, force = 1) {
    for (let i = 0; i < count; i++) {
      const a = rand(TAU);
      const s = rand(40, 260) * force;
      particle(x, y, Math.cos(a) * s, Math.sin(a) * s, color, rand(0.28, 0.86), rand(2, 6));
    }
  }

  function blockedAt(x, y, r) {
    if (x - r < arena.x || y - r < arena.y || x + r > arena.x + arena.w || y + r > arena.y + arena.h) return true;
    const room = state.room;
    if (!room) return false;
    for (const o of room.obstacles) {
      if (shapeCircleCollide(o, x, y, r)) return true;
    }
    return false;
  }

  function shapeCircleCollide(o, x, y, r) {
    if (o.type === 'circle') return Math.hypot(x - o.x, y - o.y) < r + o.r;
    const px = clamp(x, o.x, o.x + o.w);
    const py = clamp(y, o.y, o.y + o.h);
    return Math.hypot(x - px, y - py) < r;
  }

  function moveCircle(obj, dx, dy) {
    if (!dx && !dy) return;
    const tryX = clamp(obj.x + dx, arena.x + obj.r, arena.x + arena.w - obj.r);
    if (!blockedAt(tryX, obj.y, obj.r)) obj.x = tryX;
    const tryY = clamp(obj.y + dy, arena.y + obj.r, arena.y + arena.h - obj.r);
    if (!blockedAt(obj.x, tryY, obj.r)) obj.y = tryY;
    if (blockedAt(obj.x, obj.y, obj.r)) pushOutOfObstacles(obj);
  }

  function pushOutOfObstacles(obj) {
    obj.x = clamp(obj.x, arena.x + obj.r, arena.x + arena.w - obj.r);
    obj.y = clamp(obj.y, arena.y + obj.r, arena.y + arena.h - obj.r);
    const room = state.room;
    if (!room) return;
    for (const o of room.obstacles) {
      if (!shapeCircleCollide(o, obj.x, obj.y, obj.r)) continue;
      let nx = 0;
      let ny = -1;
      let overlap = 0;
      if (o.type === 'circle') {
        const n = norm(obj.x - o.x, obj.y - o.y);
        nx = n.x; ny = n.y;
        overlap = obj.r + o.r - n.l + 0.5;
      } else {
        const px = clamp(obj.x, o.x, o.x + o.w);
        const py = clamp(obj.y, o.y, o.y + o.h);
        const n = norm(obj.x - px, obj.y - py);
        nx = n.x; ny = n.y;
        overlap = obj.r - n.l + 0.5;
        if (n.l < 0.001) {
          const dl = Math.abs(obj.x - o.x);
          const dr = Math.abs(obj.x - (o.x + o.w));
          const dt = Math.abs(obj.y - o.y);
          const db = Math.abs(obj.y - (o.y + o.h));
          const m = Math.min(dl, dr, dt, db);
          if (m === dl) { nx = -1; ny = 0; overlap = obj.r + dl; }
          else if (m === dr) { nx = 1; ny = 0; overlap = obj.r + dr; }
          else if (m === dt) { nx = 0; ny = -1; overlap = obj.r + dt; }
          else { nx = 0; ny = 1; overlap = obj.r + db; }
        }
      }
      obj.x += nx * Math.max(0, overlap);
      obj.y += ny * Math.max(0, overlap);
      obj.x = clamp(obj.x, arena.x + obj.r, arena.x + arena.w - obj.r);
      obj.y = clamp(obj.y, arena.y + obj.r, arena.y + arena.h - obj.r);
    }
  }

  function takePlayerDamage(amount, sourceColor = '#ff6e92', knock = null) {
    const p = state.player;
    if (!p || p.invuln > 0 || state.mode !== 'play') return false;
    if (p.shield > 0) {
      p.shield -= 1;
      p.invuln = 0.78;
      p.shieldRegen = 3.2;
      state.shake = Math.max(state.shake, 7);
      burst(p.x, p.y, 18, '#79dcff', 0.8);
      tone(330, 0.08, 'sine', 0.035, 0.6);
      return false;
    }
    p.hp -= amount;
    p.invuln = 1.0;
    p.shieldRegen = 4.2;
    state.shake = Math.max(state.shake, 12);
    state.flash = Math.max(state.flash, 0.18);
    burst(p.x, p.y, 24, sourceColor, 1);
    noise(0.13, 0.045, 620);
    if (knock) moveCircle(p, knock.x, knock.y);
    const spite = p.upgrades.spiteCore || 0;
    if (spite > 0) {
      const teeth = 10 + spite * 5;
      for (let i = 0; i < teeth; i++) spawnPlayerBullet(p.x, p.y, (i / teeth) * TAU, { damage: p.damage * (0.55 + 0.12 * spite), speed: 520, life: 0.62, color: '#ff90ca', radius: 4.6 });
    }
    if (p.hp <= 0) gameOver();
    return true;
  }

  function roomHasLivingBoss() {
    return state.enemies.some(e => !e.dead && (e.boss || e.miniboss));
  }

  function update(dt) {
    state.time += dt;
    if (state.mode === 'play') state.runTime += dt;
    state.shake = Math.max(0, state.shake - dt * 18);
    state.flash = Math.max(0, state.flash - dt * 2.4);
    updateParticles(dt);
    updateMessages(dt);

    if (state.mode !== 'play') {
      updateHUD();
      return;
    }

    if (state.roomIntro > 0) state.roomIntro = Math.max(0, state.roomIntro - dt);
    updatePlayer(dt);
    updateDrones(dt);
    updateMines(dt);
    updateHazards(dt);
    updateWaves(dt);
    updateEnemies(dt);
    updateBullets(dt);
    updatePickups(dt);
    checkRoomClear(dt);
    updateHUD();
  }

  function updateParticles(dt) {
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.pow(0.04, dt);
      p.vy *= Math.pow(0.04, dt);
      if (p.text) p.vy -= 8 * dt;
      if (p.life <= 0) state.particles.splice(i, 1);
    }
  }

  function updateMessages(dt) {
    for (let i = state.messages.length - 1; i >= 0; i--) {
      const m = state.messages[i];
      if (m.delay > 0) { m.delay -= dt; continue; }
      m.life -= dt;
      if (m.life <= 0) state.messages.splice(i, 1);
    }
  }

  function movementVector() {
    let mx = 0;
    let my = 0;
    if (input.keys.KeyA || input.keys.ArrowLeft) mx -= 1;
    if (input.keys.KeyD || input.keys.ArrowRight) mx += 1;
    if (input.keys.KeyW || input.keys.ArrowUp) my -= 1;
    if (input.keys.KeyS || input.keys.ArrowDown) my += 1;
    if (input.moveTouch.id != null) {
      mx += clamp(input.moveTouch.dx / 46, -1, 1);
      my += clamp(input.moveTouch.dy / 46, -1, 1);
    }
    const gp = navigator.getGamepads ? navigator.getGamepads()[0] : null;
    if (gp) {
      mx += Math.abs(gp.axes[0] || 0) > 0.18 ? gp.axes[0] : 0;
      my += Math.abs(gp.axes[1] || 0) > 0.18 ? gp.axes[1] : 0;
    }
    const n = norm(mx, my);
    return n.l > 0.12 ? { x: n.x, y: n.y, active: true } : { x: 0, y: 0, active: false };
  }

  function aimAngle() {
    const p = state.player;
    if (!p) return -Math.PI / 2;
    const gp = navigator.getGamepads ? navigator.getGamepads()[0] : null;
    if (gp) {
      const ax = gp.axes[2] || 0;
      const ay = gp.axes[3] || 0;
      if (Math.hypot(ax, ay) > 0.25) return Math.atan2(ay, ax);
    }
    if (input.aimTouch.id != null && Math.hypot(input.aimTouch.dx, input.aimTouch.dy) > 12) return Math.atan2(input.aimTouch.dy, input.aimTouch.dx);
    if (input.mouse.seen) return Math.atan2(input.mouse.y - p.y, input.mouse.x - p.x);
    const target = nearestEnemy(p.x, p.y, 9999);
    if (target) return Math.atan2(target.y - p.y, target.x - p.x);
    return p.aim;
  }

  function updatePlayer(dt) {
    const p = state.player;
    if (!p) return;
    p.invuln = Math.max(0, p.invuln - dt);
    p.cooldown = Math.max(0, p.cooldown - dt);
    p.dashCooldown = Math.max(0, p.dashCooldown - dt);
    p.shieldRegen = Math.max(0, p.shieldRegen - dt);
    if (p.shieldMax > 0 && p.shield < p.shieldMax && p.shieldRegen <= 0) {
      p.shield = Math.min(p.shieldMax, p.shield + 1);
      p.shieldRegen = 4.8;
      burst(p.x, p.y, 10, '#79dcff', 0.45);
    }
    p.aim = dampAngle(p.aim, aimAngle(), 22, dt);

    const mv = movementVector();
    let slow = 1;
    for (const h of [...(state.room?.staticHazards || []), ...state.hazards]) {
      if (h.friendly) continue;
      if (Math.hypot(p.x - h.x, p.y - h.y) < p.r + h.r) {
        slow *= h.slow || 0.8;
        if (h.damage && state.time - (h.lastPlayerHit || 0) > 0.72) {
          h.lastPlayerHit = state.time;
          takePlayerDamage(h.damage, h.color, norm(p.x - h.x, p.y - h.y));
        }
      }
    }

    if (p.dashTimer > 0) {
      p.dashTimer -= dt;
      p.invuln = Math.max(p.invuln, 0.12);
      moveCircle(p, Math.cos(p.dashAngle) * 720 * dt, Math.sin(p.dashAngle) * 720 * dt);
      for (const e of state.enemies) {
        if (!e.dead && Math.hypot(e.x - p.x, e.y - p.y) < e.r + p.r + 4) {
          damageEnemy(e, p.damage * 0.8, { kind: 'dash', color: '#f3dcff' });
        }
      }
    } else if (mv.active) {
      moveCircle(p, mv.x * p.speed * slow * dt, mv.y * p.speed * slow * dt);
    }

    const ember = p.upgrades.emberMine || 0;
    if (ember > 0 && mv.active && state.roomIntro <= 0) {
      p.mineTimer -= dt;
      if (p.mineTimer <= 0) {
        p.mineTimer = Math.max(0.28, 1.08 - ember * 0.15);
        state.mines.push({ x: p.x - mv.x * 12, y: p.y - mv.y * 12, r: 8 + ember * 0.8, arm: 0.32, life: 5.2, color: '#ffa86f', damage: p.damage * (2.1 + ember * 0.45), radius: 68 + ember * 8 });
      }
    }

    if (state.roomIntro <= 0 && state.enemies.length > 0 && p.cooldown <= 0) {
      shootPlayer(p.aim);
      p.cooldown = p.fireDelay;
    }
  }

  function dampAngle(cur, target, lambda, dt) {
    let d = ((target - cur + Math.PI * 3) % TAU) - Math.PI;
    return cur + d * (1 - Math.exp(-lambda * dt));
  }

  function triggerDash() {
    const p = state.player;
    if (!p || state.mode !== 'play' || p.dashCooldown > 0 || p.dashTimer > 0) return;
    const mv = movementVector();
    p.dashAngle = mv.active ? Math.atan2(mv.y, mv.x) : p.aim;
    p.dashTimer = 0.16;
    p.dashCooldown = 1.08;
    p.invuln = Math.max(p.invuln, 0.18);
    burst(p.x, p.y, 12, '#f3dcff', 0.6);
    tone(260, 0.055, 'triangle', 0.025, 1.8);
  }

  function shootPlayer(angle, opts = {}) {
    const p = state.player;
    if (!p) return;
    p.volleyCount += 1;
    const px = -Math.sin(angle);
    const py = Math.cos(angle);
    const spread = opts.spread || 0.035;
    const originBack = opts.originBack || 0;
    const x = p.x - Math.cos(angle) * originBack;
    const y = p.y - Math.sin(angle) * originBack;
    const base = { color: opts.color || p.color, radius: p.bulletRadius, damage: p.damage * (opts.damageMul || 1), speed: p.shotSpeed, life: 0.92 + (p.upgrades.phaseDrill || 0) * 0.035 };
    spawnPlayerBullet(x + px * 8, y + py * 8, angle - spread, base);
    spawnPlayerBullet(x - px * 8, y - py * 8, angle + spread, base);

    const rear = p.upgrades.rearArray || 0;
    if (rear > 0) {
      for (let i = 0; i < rear; i++) spawnPlayerBullet(x, y, angle + Math.PI + rand(-0.14, 0.14), Object.assign({}, base, { damage: base.damage * 0.62, radius: base.radius * 0.86, color: '#ffb48c' }));
    }
    const side = p.upgrades.sidecarLances || 0;
    if (side > 0) {
      for (let i = 0; i < side; i++) {
        const wiggle = (i - (side - 1) / 2) * 0.055;
        spawnPlayerBullet(x, y, angle + Math.PI * 0.5 + wiggle, Object.assign({}, base, { damage: base.damage * 0.55, radius: base.radius * 0.82, color: '#b8d7ff' }));
        spawnPlayerBullet(x, y, angle - Math.PI * 0.5 - wiggle, Object.assign({}, base, { damage: base.damage * 0.55, radius: base.radius * 0.82, color: '#b8d7ff' }));
      }
    }
    const echo = p.upgrades.echoChamber || 0;
    if (echo > 0) {
      const every = Math.max(2, 6 - echo);
      if (p.volleyCount % every === 0 && !opts.echo) {
        state.echoes.push({ timer: 0.17, angle, x: p.x, y: p.y, damageMul: 0.66 + echo * 0.08 });
      }
    }
    tone(520 + rand(-20, 25), 0.035, 'triangle', 0.018, 1.08);
  }

  function spawnPlayerBullet(x, y, angle, opts = {}) {
    const p = state.player;
    const critChance = (p?.upgrades.moonShard || 0) * 0.055;
    const crit = chance(critChance);
    const speed = opts.speed || p?.shotSpeed || 620;
    const b = {
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: opts.radius || 5,
      damage: (opts.damage || 1) * (crit ? 2.05 : 1),
      life: opts.life || 0.9,
      maxLife: opts.life || 0.9,
      color: crit ? '#ffffff' : (opts.color || '#f3dcff'),
      pierce: opts.pierce ?? (p?.upgrades.phaseDrill || 0),
      bounces: opts.bounces ?? (p?.upgrades.ricochet || 0),
      homing: opts.homing ?? (p?.upgrades.hunterMycelia || 0),
      shrapnel: opts.shrapnel ?? (p?.upgrades.shrapnelChamber || 0),
      split: opts.split ?? (p?.upgrades.splitWake || 0),
      crit,
      hitIds: new Set()
    };
    if (state.bullets.length > 240) state.bullets.splice(0, state.bullets.length - 240);
    state.bullets.push(b);
  }

  function updateDrones(dt) {
    const p = state.player;
    if (!p) return;
    const count = Math.min(6, p.upgrades.scavengerDrone || 0);
    for (let i = state.drones.length; i < count; i++) state.drones.push({ a: rand(TAU), cooldown: rand(0.1, 0.6) });
    state.drones.length = count;
    for (let i = 0; i < state.drones.length; i++) {
      const d = state.drones[i];
      d.a += dt * (1.2 + i * 0.09);
      d.x = p.x + Math.cos(d.a + i * TAU / Math.max(1, count)) * (34 + i * 4);
      d.y = p.y + Math.sin(d.a + i * TAU / Math.max(1, count)) * (34 + i * 4);
      d.cooldown -= dt;
      if (d.cooldown <= 0 && state.roomIntro <= 0) {
        const target = nearestEnemy(d.x, d.y, 520);
        if (target) {
          d.cooldown = Math.max(0.26, 0.72 - count * 0.045);
          spawnPlayerBullet(d.x, d.y, Math.atan2(target.y - d.y, target.x - d.x), { damage: p.damage * 0.42, speed: 560, radius: 3.8, life: 0.78, color: '#ffd48b', homing: 1 });
        }
      }
    }

    for (let i = state.echoes.length - 1; i >= 0; i--) {
      const e = state.echoes[i];
      e.timer -= dt;
      if (e.timer <= 0) {
        shootPlayer(e.angle, { echo: true, damageMul: e.damageMul, color: '#e7f4ff', spread: 0.018 });
        state.echoes.splice(i, 1);
      }
    }

    const halo = p.upgrades.orbitalHalo || 0;
    if (halo > 0) {
      const wards = Math.min(8, halo);
      for (let i = 0; i < wards; i++) {
        const a = state.time * (1.9 + halo * 0.06) + i * TAU / wards;
        const hx = p.x + Math.cos(a) * (44 + halo * 3.5);
        const hy = p.y + Math.sin(a) * (44 + halo * 3.5);
        for (const enemy of state.enemies) {
          if (!enemy.dead && Math.hypot(enemy.x - hx, enemy.y - hy) < enemy.r + 10) {
            damageEnemy(enemy, dt * (3.2 + halo * 0.75), { kind: 'halo', color: '#fff1a8' });
          }
        }
        for (let j = state.enemyBullets.length - 1; j >= 0; j--) {
          const b = state.enemyBullets[j];
          if (Math.hypot(b.x - hx, b.y - hy) < b.r + 12) {
            particle(b.x, b.y, rand(-40, 40), rand(-40, 40), '#fff1a8', 0.3, 3);
            state.enemyBullets.splice(j, 1);
            state.score += 2;
          }
        }
      }
    }
  }

  function updateMines(dt) {
    for (let i = state.mines.length - 1; i >= 0; i--) {
      const m = state.mines[i];
      m.life -= dt;
      m.arm -= dt;
      let boom = m.life <= 0;
      if (!boom && m.arm <= 0) {
        for (const e of state.enemies) {
          if (!e.dead && Math.hypot(e.x - m.x, e.y - m.y) < e.r + m.r + 5) { boom = true; break; }
        }
      }
      if (boom) {
        explode(m.x, m.y, m.radius, m.damage, m.color);
        state.mines.splice(i, 1);
      }
    }
  }

  function updateHazards(dt) {
    for (let i = state.hazards.length - 1; i >= 0; i--) {
      const h = state.hazards[i];
      h.life -= dt;
      h.pulse = (h.pulse || 0) + dt * 4;
      if (h.friendly && h.slow) {
        for (const e of state.enemies) {
          if (!e.dead && Math.hypot(e.x - h.x, e.y - h.y) < e.r + h.r) e.slow = Math.max(e.slow, 0.4);
        }
      } else if (h.damage) {
        for (const e of state.enemies) {
          if (!e.dead && !h.friendly && Math.hypot(e.x - h.x, e.y - h.y) < e.r + h.r) {
            // Hostile room hazards are not friendly fire; keep enemy reads clean.
          }
        }
      }
      if (h.life <= 0) state.hazards.splice(i, 1);
    }
  }

  function updateWaves(dt) {
    if (state.roomIntro > 0) return;
    for (let i = state.waves.length - 1; i >= 0; i--) {
      const w = state.waves[i];
      w.timer -= dt;
      if (w.timer <= 0) {
        spawnWave(w.budget, state.roomNumber, false);
        pushMessage('MORE TEETH', currentBiome().accent2, 0.95, 30);
        tone(110, 0.08, 'sawtooth', 0.028, 1.55);
        state.waves.splice(i, 1);
      }
    }
  }

  function updateEnemies(dt) {
    const p = state.player;
    if (!p) return;
    for (let i = state.enemies.length - 1; i >= 0; i--) {
      const e = state.enemies[i];
      if (e.dead || e.hp <= 0) {
        state.enemies.splice(i, 1);
        continue;
      }
      e.t += dt;
      e.hitFlash = Math.max(0, e.hitFlash - dt * 6);
      e.cooldown -= dt;
      e.subcool -= dt;
      e.slow = Math.max(0, e.slow - dt);
      e.contactTimer = Math.max(0, e.contactTimer - dt);
      const slowScale = e.slow > 0 ? 0.48 : 1;
      const a = Math.atan2(p.y - e.y, p.x - e.x);
      const d = Math.hypot(p.x - e.x, p.y - e.y);
      let mx = 0;
      let my = 0;

      if (state.roomIntro > 0) {
        // Let them breathe menacingly before the bell drops.
      } else if (e.behavior === 'skitter') {
        mx = Math.cos(a) * e.speed * slowScale;
        my = Math.sin(a) * e.speed * slowScale;
      } else if (e.behavior === 'brute') {
        mx = Math.cos(a) * e.speed * slowScale;
        my = Math.sin(a) * e.speed * slowScale;
        if (e.cooldown <= 0 && d < 270) {
          e.cooldown = rand(2.0, 3.2);
          enemyFan(e, a, 3, 0.34, 190, '#ffa06a', 0.8);
        }
      } else if (e.behavior === 'gunner') {
        const desired = 250;
        const strafe = a + Math.PI * 0.5 * (Math.sin(e.t * 1.7) > 0 ? 1 : -1);
        const pull = clamp((d - desired) / 130, -1, 1);
        mx = (Math.cos(a) * pull * 0.85 + Math.cos(strafe) * 0.55) * e.speed * slowScale;
        my = (Math.sin(a) * pull * 0.85 + Math.sin(strafe) * 0.55) * e.speed * slowScale;
        if (e.cooldown <= 0) {
          e.cooldown = rand(1.25, 1.9) * (e.elite ? 0.75 : 1);
          shootEnemy(e, a, 250 + state.roomNumber * 4, { color: e.color, r: 5, damage: 1 });
        }
      } else if (e.behavior === 'turret') {
        mx = Math.cos(e.t * 0.8) * 12 * slowScale;
        my = Math.sin(e.t * 0.7) * 12 * slowScale;
        if (e.cooldown <= 0) {
          e.cooldown = rand(1.6, 2.4) * (e.elite ? 0.74 : 1);
          if (chance(0.5)) enemyFan(e, a, e.elite ? 5 : 3, 0.36, 225, e.color, 1);
          else enemyRadial(e, e.elite ? 10 : 8, 170, e.color, 0.75, e.t * 0.3);
        }
      } else if (e.behavior === 'charger') {
        updateCharger(e, dt, a, d, slowScale);
        continue;
      } else if (e.behavior === 'sniper') {
        updateSniper(e, dt, a, d, slowScale);
        continue;
      } else if (e.behavior === 'hexer') {
        const desired = 310;
        const pull = clamp((d - desired) / 160, -1, 1);
        const orbit = a + Math.PI * 0.5;
        mx = (Math.cos(a) * pull * 0.7 + Math.cos(orbit) * 0.85) * e.speed * slowScale;
        my = (Math.sin(a) * pull * 0.7 + Math.sin(orbit) * 0.85) * e.speed * slowScale;
        if (e.cooldown <= 0) {
          e.cooldown = rand(2.1, 3.0) * (e.elite ? 0.78 : 1);
          enemyRadial(e, e.elite ? 9 : 7, 150, e.color, 0.55, e.t);
          const hx = clamp(p.x + rand(-60, 60), arena.x + 50, arena.x + arena.w - 50);
          const hy = clamp(p.y + rand(-60, 60), arena.y + 50, arena.y + arena.h - 50);
          state.hazards.push({ x: hx, y: hy, r: 34 + state.roomNumber * 0.8, life: 3.4, maxLife: 3.4, color: e.color, slow: 0.7, damage: 0.35, pulse: 0 });
        }
      } else if (e.behavior === 'myrmidon') {
        const orbit = a + Math.PI * 0.5 * (Math.sin(e.t * 2.2) > 0 ? 1 : -1);
        mx = (Math.cos(a) * 0.55 + Math.cos(orbit) * 0.55) * e.speed * slowScale;
        my = (Math.sin(a) * 0.55 + Math.sin(orbit) * 0.55) * e.speed * slowScale;
        if (e.cooldown <= 0) {
          e.cooldown = rand(1.15, 1.8);
          enemyFan(e, a, 3, 0.18, 290, e.color, 1);
        }
      } else if (e.behavior === 'lien') {
        updateLien(e, dt, a, d, slowScale);
        continue;
      } else if (e.behavior === 'falseMoon') {
        updateFalseMoon(e, dt, a, d, slowScale);
        continue;
      } else if (e.behavior === 'spiggot') {
        updateSpiggot(e, dt, a, d, slowScale);
        continue;
      } else if (e.behavior === 'warden' || e.behavior === 'archon') {
        updateBoss(e, dt, a, d, slowScale);
        continue;
      }

      moveCircle(e, mx * dt, my * dt);
      enemyContact(e, p, a);
    }
  }

  function enemyContact(e, p, a) {
    if (Math.hypot(e.x - p.x, e.y - p.y) < e.r + p.r && e.contactTimer <= 0) {
      e.contactTimer = 0.58;
      takePlayerDamage(e.boss ? 1.25 : e.miniboss ? 1 : 0.75, e.color, { x: -Math.cos(a) * 28, y: -Math.sin(a) * 28 });
    }
  }

  function updateCharger(e, dt, a, d, slowScale) {
    const p = state.player;
    if (e.state === 'windup') {
      e.timer -= dt;
      e.angle = dampAngle(e.angle, a, 18, dt);
      if (e.timer <= 0) { e.state = 'dash'; e.timer = 0.43; }
    } else if (e.state === 'dash') {
      e.timer -= dt;
      moveCircle(e, Math.cos(e.angle) * 420 * slowScale * dt, Math.sin(e.angle) * 420 * slowScale * dt);
      if (e.timer <= 0) { e.state = 'idle'; e.cooldown = rand(1.5, 2.35); }
    } else {
      if (e.cooldown <= 0 && d < 420) { e.state = 'windup'; e.timer = 0.52; e.angle = a; }
      else moveCircle(e, Math.cos(a) * e.speed * 0.72 * slowScale * dt, Math.sin(a) * e.speed * 0.72 * slowScale * dt);
    }
    enemyContact(e, p, a);
  }

  function updateSniper(e, dt, a, d, slowScale) {
    const p = state.player;
    const desired = 410;
    if (e.state === 'aim') {
      e.timer -= dt;
      e.angle = dampAngle(e.angle, a, 10, dt);
      if (e.timer <= 0) {
        shootEnemy(e, e.angle, 610, { color: e.color, r: 5.5, damage: 1.1, life: 1.15 });
        e.state = 'idle';
        e.cooldown = rand(2.0, 2.7) * (e.elite ? 0.72 : 1);
      }
    } else {
      const pull = clamp((d - desired) / 150, -1, 1);
      const orbit = a + Math.PI * 0.5;
      moveCircle(e, (Math.cos(a) * pull * 0.8 + Math.cos(orbit) * 0.35) * e.speed * slowScale * dt, (Math.sin(a) * pull * 0.8 + Math.sin(orbit) * 0.35) * e.speed * slowScale * dt);
      if (e.cooldown <= 0) { e.state = 'aim'; e.timer = e.elite ? 0.55 : 0.78; e.angle = a; }
    }
    enemyContact(e, p, a);
  }

  function updateLien(e, dt, a, d, slowScale) {
    const p = state.player;
    const desired = 280;
    const pull = clamp((d - desired) / 150, -1, 1);
    const orbit = a + Math.PI * 0.5 * (Math.sin(e.t) > 0 ? 1 : -1);
    moveCircle(e, (Math.cos(a) * pull + Math.cos(orbit) * 0.72) * e.speed * slowScale * dt, (Math.sin(a) * pull + Math.sin(orbit) * 0.72) * e.speed * slowScale * dt);
    if (e.cooldown <= 0) {
      e.cooldown = 1.15;
      shootEnemy(e, a + rand(-0.08, 0.08), 320, { color: e.color, r: 5.4, homing: 0.55, damage: 1 });
    }
    if (e.subcool <= 0) {
      e.subcool = 3.1;
      state.hazards.push({ x: p.x, y: p.y, r: 48, life: 2.8, maxLife: 2.8, color: e.color, slow: 0.66, damage: 0.42, pulse: 0 });
    }
    enemyContact(e, p, a);
  }

  function updateFalseMoon(e, dt, a, d, slowScale) {
    const p = state.player;
    const orbit = a + Math.PI * 0.5;
    const pull = clamp((d - 330) / 160, -1, 1);
    moveCircle(e, (Math.cos(a) * pull * 0.5 + Math.cos(orbit) * 0.85) * e.speed * slowScale * dt, (Math.sin(a) * pull * 0.5 + Math.sin(orbit) * 0.85) * e.speed * slowScale * dt);
    if (e.cooldown <= 0) {
      e.cooldown = rand(1.35, 1.9);
      enemyFan(e, a, 7, 0.62, 245, e.color, 0.9);
    }
    if (e.subcool <= 0) {
      e.subcool = 4.5;
      for (let i = 0; i < 2; i++) {
        const pos = findSpawnPoint(130, e.x + rand(-120, 120), e.y + rand(-80, 80));
        spawnEnemy(chance(0.5) ? 'skitter' : 'gunner', pos.x, pos.y, {});
      }
    }
    enemyContact(e, p, a);
  }

  function updateSpiggot(e, dt, a, d, slowScale) {
    const p = state.player;
    e.angle = dampAngle(e.angle, a + Math.sin(e.t * 4) * 0.28, 12, dt);
    const rush = e.cooldown < 0.55 ? 1.55 : 1.0;
    moveCircle(e, Math.cos(e.angle) * e.speed * rush * slowScale * dt, Math.sin(e.angle) * e.speed * rush * slowScale * dt);
    if (e.cooldown <= 0) {
      e.cooldown = rand(0.9, 1.35);
      enemyFan(e, a, 5, 0.42, 255, e.color, 0.85);
      state.hazards.push({ x: e.x, y: e.y, r: 38, life: 2.2, maxLife: 2.2, color: e.color, slow: 0.8, damage: 0.28, pulse: 0 });
    }
    enemyContact(e, p, a);
  }

  function updateBoss(e, dt, a, d, slowScale) {
    const p = state.player;
    const archon = e.behavior === 'archon';
    const desired = archon ? 300 : 260;
    const pull = clamp((d - desired) / 200, -1, 1);
    const orbit = a + Math.PI * 0.5 * (Math.sin(e.t * 0.7) > 0 ? 1 : -1);
    moveCircle(e, (Math.cos(a) * pull * 0.48 + Math.cos(orbit) * 0.55) * e.speed * slowScale * dt, (Math.sin(a) * pull * 0.48 + Math.sin(orbit) * 0.55) * e.speed * slowScale * dt);
    if (e.cooldown <= 0 && state.roomIntro <= 0) {
      const phase = 1 - e.hp / e.maxHp;
      const pattern = e.pattern = ((e.pattern || 0) + 1) % (archon ? 5 : 4);
      e.cooldown = archon ? Math.max(0.9, 1.7 - phase * 0.45) : Math.max(1.05, 2.05 - phase * 0.35);
      if (pattern === 0) enemyRadial(e, archon ? 20 : 14, archon ? 210 : 185, e.color, 0.9, e.t);
      else if (pattern === 1) enemyFan(e, a, archon ? 9 : 7, archon ? 0.82 : 0.58, archon ? 300 : 270, e.color, 1);
      else if (pattern === 2) {
        for (let k = 0; k < (archon ? 4 : 3); k++) {
          const pos = findSpawnPoint(150, e.x + rand(-180, 180), e.y + rand(-120, 120));
          spawnEnemy(pick(availableEnemyIds(state.roomNumber, false)), pos.x, pos.y, {});
        }
        pushMessage('THE ROOM BIRTHS WITNESSES', e.color, 0.95, 25);
      } else if (pattern === 3) {
        for (let k = 0; k < (archon ? 5 : 3); k++) {
          const hx = clamp(p.x + rand(-140, 140), arena.x + 55, arena.x + arena.w - 55);
          const hy = clamp(p.y + rand(-120, 120), arena.y + 55, arena.y + arena.h - 55);
          state.hazards.push({ x: hx, y: hy, r: archon ? 48 : 40, life: 3.0, maxLife: 3.0, color: e.color, slow: 0.72, damage: archon ? 0.5 : 0.36, pulse: 0 });
        }
      } else {
        for (let k = 0; k < 3; k++) setTimeoutSafe(() => { if (!e.dead) enemyRadial(e, 14, 240, e.color, 0.8, e.t + k * 0.18); }, k * 160);
      }
    }
    enemyContact(e, p, a);
  }

  function setTimeoutSafe(fn, ms) {
    window.setTimeout(() => {
      if (state.mode === 'play') fn();
    }, ms);
  }

  function shootEnemy(e, angle, speed = 240, opts = {}) {
    if (state.enemyBullets.length > 260) state.enemyBullets.splice(0, state.enemyBullets.length - 260);
    state.enemyBullets.push({
      x: e.x + Math.cos(angle) * (e.r + 5),
      y: e.y + Math.sin(angle) * (e.r + 5),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: opts.r || 5,
      damage: opts.damage || 1,
      life: opts.life || 3.4,
      maxLife: opts.life || 3.4,
      color: opts.color || e.color,
      homing: opts.homing || 0
    });
  }

  function enemyFan(e, angle, count, spread, speed, color, damage = 1) {
    const start = angle - spread * 0.5;
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0.5 : i / (count - 1);
      shootEnemy(e, start + spread * t, speed, { color, damage, r: 5 });
    }
    tone(150, 0.045, 'sawtooth', 0.014, 0.72);
  }

  function enemyRadial(e, count, speed, color, damage = 0.8, offset = 0) {
    for (let i = 0; i < count; i++) shootEnemy(e, offset + (i / count) * TAU, speed, { color, damage, r: 4.8 });
    tone(120, 0.055, 'sawtooth', 0.018, 0.82);
  }

  function updateBullets(dt) {
    const p = state.player;
    for (let i = state.bullets.length - 1; i >= 0; i--) {
      const b = state.bullets[i];
      b.life -= dt;
      if (b.homing > 0) {
        const target = nearestEnemy(b.x, b.y, 280 + b.homing * 75);
        if (target) {
          const desired = Math.atan2(target.y - b.y, target.x - b.x);
          const cur = Math.atan2(b.vy, b.vx);
          const next = dampAngle(cur, desired, 4 + b.homing * 2.4, dt);
          const spd = Math.hypot(b.vx, b.vy);
          b.vx = Math.cos(next) * spd;
          b.vy = Math.sin(next) * spd;
        }
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      let killBullet = b.life <= 0;
      if (!killBullet) {
        if (b.x - b.r < arena.x || b.x + b.r > arena.x + arena.w) {
          if (b.bounces > 0) { b.vx *= -1; b.bounces -= 1; b.x = clamp(b.x, arena.x + b.r, arena.x + arena.w - b.r); }
          else killBullet = true;
        }
        if (b.y - b.r < arena.y || b.y + b.r > arena.y + arena.h) {
          if (b.bounces > 0) { b.vy *= -1; b.bounces -= 1; b.y = clamp(b.y, arena.y + b.r, arena.y + arena.h - b.r); }
          else killBullet = true;
        }
      }
      if (!killBullet && state.room) {
        for (const o of state.room.obstacles) {
          if (!shapeCircleCollide(o, b.x, b.y, b.r)) continue;
          if (b.bounces > 0) {
            b.bounces -= 1;
            const n = obstacleNormal(o, b.x, b.y);
            const dot = b.vx * n.x + b.vy * n.y;
            b.vx -= 2 * dot * n.x;
            b.vy -= 2 * dot * n.y;
            b.x += n.x * 5;
            b.y += n.y * 5;
            particle(b.x, b.y, n.x * 50, n.y * 50, b.color, 0.25, 3);
          } else {
            impactFragments(b, null);
            killBullet = true;
          }
          break;
        }
      }
      if (!killBullet) {
        for (const e of state.enemies) {
          if (e.dead || b.hitIds.has(e)) continue;
          if (Math.hypot(e.x - b.x, e.y - b.y) < e.r + b.r) {
            b.hitIds.add(e);
            const died = damageEnemy(e, b.damage, { kind: 'bullet', bullet: b, color: b.color });
            impactFragments(b, e);
            if (died && b.split > 0) splitWake(b, e);
            if (b.pierce > 0) b.pierce -= 1;
            else killBullet = true;
            break;
          }
        }
      }
      if (killBullet) state.bullets.splice(i, 1);
    }

    for (let i = state.enemyBullets.length - 1; i >= 0; i--) {
      const b = state.enemyBullets[i];
      b.life -= dt;
      if (b.homing > 0 && p) {
        const desired = Math.atan2(p.y - b.y, p.x - b.x);
        const cur = Math.atan2(b.vy, b.vx);
        const next = dampAngle(cur, desired, b.homing * 1.8, dt);
        const spd = Math.hypot(b.vx, b.vy);
        b.vx = Math.cos(next) * spd;
        b.vy = Math.sin(next) * spd;
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      let kill = b.life <= 0 || b.x < arena.x - 40 || b.x > arena.x + arena.w + 40 || b.y < arena.y - 40 || b.y > arena.y + arena.h + 40;
      if (!kill && state.room) {
        for (const o of state.room.obstacles) {
          if (shapeCircleCollide(o, b.x, b.y, b.r)) { kill = true; break; }
        }
      }
      if (!kill && p && Math.hypot(p.x - b.x, p.y - b.y) < p.r + b.r) {
        const n = norm(p.x - b.x, p.y - b.y);
        takePlayerDamage(b.damage || 1, b.color, { x: n.x * 24, y: n.y * 24 });
        kill = true;
      }
      if (kill) state.enemyBullets.splice(i, 1);
    }
  }

  function obstacleNormal(o, x, y) {
    if (o.type === 'circle') return norm(x - o.x, y - o.y);
    const px = clamp(x, o.x, o.x + o.w);
    const py = clamp(y, o.y, o.y + o.h);
    const n = norm(x - px, y - py);
    if (n.l > 0.001) return n;
    const left = Math.abs(x - o.x);
    const right = Math.abs(x - (o.x + o.w));
    const top = Math.abs(y - o.y);
    const bottom = Math.abs(y - (o.y + o.h));
    const m = Math.min(left, right, top, bottom);
    if (m === left) return { x: -1, y: 0, l: 1 };
    if (m === right) return { x: 1, y: 0, l: 1 };
    if (m === top) return { x: 0, y: -1, l: 1 };
    return { x: 0, y: 1, l: 1 };
  }

  function nearestEnemy(x, y, maxDist = Infinity) {
    let best = null;
    let bd = maxDist;
    for (const e of state.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  function damageEnemy(e, amount, source = {}) {
    if (!e || e.dead) return false;
    const p = state.player;
    let dmg = amount;
    const exec = p?.upgrades.executionBloom || 0;
    if (exec > 0 && e.hp / e.maxHp < 0.38 + exec * 0.03) dmg *= 1 + exec * 0.18;
    e.hp -= dmg;
    e.hitFlash = 1;
    e.slow = Math.max(e.slow, (p?.upgrades.cryoRime || 0) * 0.18);
    if (chance(0.35)) particle(e.x, e.y, rand(-35, 35), rand(-35, 35), source.color || e.color, 0.25, rand(2, 4));
    const arc = p?.upgrades.staticLink || 0;
    if (arc > 0 && source.kind === 'bullet' && chance(0.34)) arcDamage(e, dmg * (0.28 + arc * 0.04), arc, source.color || '#b0f1ff');
    if (e.hp <= 0) {
      killEnemy(e, source);
      return true;
    }
    return false;
  }

  function arcDamage(origin, amount, stacks, color) {
    const range = 115 + stacks * 25;
    const jumps = Math.min(4, stacks + 1);
    let from = origin;
    const hit = new Set([origin]);
    for (let j = 0; j < jumps; j++) {
      let best = null;
      let bd = range;
      for (const e of state.enemies) {
        if (e.dead || hit.has(e)) continue;
        const d = Math.hypot(e.x - from.x, e.y - from.y);
        if (d < bd) { bd = d; best = e; }
      }
      if (!best) break;
      hit.add(best);
      for (let k = 0; k < 6; k++) {
        const t = k / 5;
        particle(lerp(from.x, best.x, t), lerp(from.y, best.y, t), rand(-18, 18), rand(-18, 18), color, 0.22, 2.4);
      }
      best.hp -= amount;
      best.hitFlash = 1;
      if (best.hp <= 0) killEnemy(best, { kind: 'arc', color });
      from = best;
    }
  }

  function killEnemy(e, source = {}) {
    if (e.dead) return;
    e.dead = true;
    const p = state.player;
    state.kills += 1;
    state.combo += 1;
    state.comboTimer = 3.2;
    const comboMul = 1 + Math.min(2.5, state.combo * 0.055);
    state.score += Math.floor((e.score || 100) * comboMul * (e.elite ? 1.35 : 1));
    burst(e.x, e.y, e.boss ? 70 : e.miniboss ? 45 : 18, e.color, e.boss ? 1.6 : e.miniboss ? 1.25 : 0.78);
    spawnPickup(e.x, e.y, e.boss || e.miniboss ? 'repair' : chance(0.75) ? 'star' : 'dust', e.color);
    if (e.elite || e.miniboss || e.boss) spawnPickup(e.x + rand(-16, 16), e.y + rand(-16, 16), 'repair', '#7efab7');
    const grave = p?.upgrades.graveCharge || 0;
    if (grave > 0) explode(e.x, e.y, 62 + grave * 11, p.damage * (1.4 + grave * 0.28), '#ff8c7d');
    const siphon = p?.upgrades.siphonVane || 0;
    if (siphon > 0 && chance(0.04 + siphon * 0.04)) spawnPickup(e.x + rand(-18, 18), e.y + rand(-18, 18), 'repair', '#9effc2');
    const tithe = p?.upgrades.bloodTithe || 0;
    if (tithe > 0) {
      p.bloodCounter += 1;
      const need = Math.max(4, 11 - tithe * 2);
      if (p.bloodCounter >= need) { p.bloodCounter = 0; healPlayer(1); }
    }
    tone(e.boss ? 82 : e.miniboss ? 110 : 180 + rand(-40, 40), e.boss ? 0.18 : 0.07, 'sawtooth', e.boss ? 0.045 : 0.022, e.boss ? 0.45 : 0.75);
  }

  function impactFragments(b, enemy) {
    const p = state.player;
    const shrap = b.shrapnel || 0;
    if (shrap <= 0) return;
    const count = 3 + shrap * 2;
    const base = Math.atan2(b.vy, b.vx);
    for (let i = 0; i < count; i++) {
      const a = base + Math.PI + rand(-1.2, 1.2);
      spawnPlayerBullet(b.x, b.y, a, { damage: (p?.damage || 1) * (0.18 + shrap * 0.025), speed: rand(300, 440), radius: 2.6, life: 0.34, color: '#ffe391', pierce: 0, bounces: 0, homing: 0, shrapnel: 0, split: 0 });
    }
  }

  function splitWake(b, enemy) {
    const p = state.player;
    const stacks = b.split || 0;
    const count = 2 + stacks;
    const base = Math.atan2(b.vy, b.vx);
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0.5 : i / (count - 1);
      const a = base - 0.72 + t * 1.44;
      spawnPlayerBullet(enemy.x, enemy.y, a, { damage: (p?.damage || 1) * (0.34 + stacks * 0.035), speed: 480, radius: 3.2, life: 0.45, color: '#c5f1ff', pierce: 0, bounces: 0, homing: Math.min(2, stacks), shrapnel: 0, split: 0 });
    }
  }

  function explode(x, y, radius, damage, color) {
    burst(x, y, 28, color, 0.9);
    drawExplosionRing(x, y, radius, color);
    for (const e of state.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < radius + e.r) damageEnemy(e, damage * (1 - clamp(d / (radius + e.r), 0, 0.82)), { kind: 'explosion', color });
    }
    state.shake = Math.max(state.shake, 5);
    noise(0.08, 0.03, 720);
  }

  function drawExplosionRing(x, y, radius, color) {
    state.particles.push({ x, y, vx: 0, vy: 0, color, life: 0.32, maxLife: 0.32, r: radius, ring: true });
  }

  function spawnPickup(x, y, type, color) {
    if (state.pickups.length > 80) state.pickups.shift();
    const value = type === 'repair' ? 1 : type === 'star' ? 35 : 12;
    state.pickups.push({ x, y, vx: rand(-28, 28), vy: rand(-34, 18), r: type === 'repair' ? 8 : 5, type, color: type === 'repair' ? '#7efab7' : (color || currentBiome().accent), value, life: 10 });
  }

  function updatePickups(dt) {
    const p = state.player;
    if (!p) return;
    const magnet = 74 + (p.upgrades.gravityWell || 0) * 80;
    for (let i = state.pickups.length - 1; i >= 0; i--) {
      const it = state.pickups[i];
      it.life -= dt;
      const dx = p.x - it.x;
      const dy = p.y - it.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < magnet) {
        const pull = (1 - d / magnet) * (360 + (p.upgrades.gravityWell || 0) * 80);
        it.vx += dx / d * pull * dt;
        it.vy += dy / d * pull * dt;
      }
      it.vx *= Math.pow(0.1, dt);
      it.vy *= Math.pow(0.1, dt);
      it.x += it.vx * dt;
      it.y += it.vy * dt;
      if (d < p.r + it.r + 5) {
        if (it.type === 'repair') healPlayer(1);
        else state.score += it.value;
        particle(it.x, it.y, rand(-20, 20), rand(-35, -12), it.color, 0.3, 4);
        state.pickups.splice(i, 1);
      } else if (it.life <= 0) state.pickups.splice(i, 1);
    }
    if (state.comboTimer > 0) state.comboTimer -= dt;
    else state.combo = Math.max(0, Math.floor(state.combo * Math.pow(0.45, dt)));
  }

  function checkRoomClear(dt) {
    if (state.roomIntro > 0 || state.clearTimer === -2) return;
    if (state.enemies.length === 0 && state.waves.length === 0) {
      if (state.clearTimer < 0) {
        state.clearTimer = 0.72;
        pushMessage('ROOM CLEAR', currentBiome().accent2, 1.0, 42);
        tone(330, 0.1, 'triangle', 0.026, 1.7);
      } else {
        state.clearTimer -= dt;
        if (state.clearTimer <= 0) {
          state.clearTimer = -2;
          state.roomsCleared += 1;
          state.score += 500 + state.roomNumber * 42;
          const p = state.player;
          const rift = p.upgrades.riftCapacitor || 0;
          if (rift > 0) {
            p.riftCounter += 1;
            const need = Math.max(2, 6 - rift);
            if (p.riftCounter >= need) { p.riftCounter = 0; healPlayer(1); }
          }
          enterDraft();
        }
      }
    }
  }

  function enterDraft() {
    state.mode = 'draft';
    state.rerolls = 1;
    state.draftCards = generateDraft();
    renderDraft();
    draft.classList.remove('hidden');
    tone(247, 0.12, 'triangle', 0.03, 1.4);
  }

  function generateDraft() {
    const p = state.player;
    const cards = [];
    const bossBonus = state.roomNumber % 5 === 0;
    let pool = UPGRADE_DEFS.filter(u => {
      if (u.id === 'repair') return p.hp < p.maxHp || bossBonus;
      const stacks = p.upgrades[u.id] || 0;
      return !u.max || stacks < u.max;
    });
    if (!pool.length) pool = UPGRADE_DEFS.filter(u => u.id === 'repair');
    while (cards.length < 3 && pool.length) {
      const total = pool.reduce((s, u) => s + (u.weight || 1) * (bossBonus && !u.transient ? 1.15 : 1), 0);
      let roll = rand(total);
      let chosen = pool[0];
      for (const u of pool) {
        roll -= (u.weight || 1) * (bossBonus && !u.transient ? 1.15 : 1);
        if (roll <= 0) { chosen = u; break; }
      }
      cards.push(chosen);
      pool = pool.filter(u => u.id !== chosen.id);
    }
    return cards;
  }

  function renderDraft() {
    draftTitle.textContent = state.roomNumber % 5 === 0 ? 'Boss bell cracked. Choose harder.' : 'Choose a graft';
    draftSub.textContent = state.rerolls > 0 ? 'Moots can reroll this draft once. Press R or hit the button.' : 'Reroll spent. The boots have spoken, the little bastards.';
    rerollBtn.disabled = state.rerolls <= 0;
    rerollBtn.textContent = state.rerolls > 0 ? 'Reroll draft' : 'Reroll spent';
    draftCardsEl.innerHTML = state.draftCards.map((u, i) => {
      const stacks = state.player.upgrades[u.id] || 0;
      const stackLine = u.transient ? 'instant' : `stack ${stacks + 1}${u.max ? `/${u.max}` : ''}`;
      return `<button class="draft-card" type="button" data-index="${i}" style="--card-color:${u.color}">
        <div class="top"><div><h3>${escapeHtml(u.name)}</h3><div class="type">${escapeHtml(u.type)} • ${stackLine}</div></div><span class="swatch"></span></div>
        <p>${escapeHtml(u.desc)}</p>
        <div class="tags">${u.tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>
      </button>`;
    }).join('');
  }

  function chooseDraft(index) {
    if (state.mode !== 'draft') return;
    const u = state.draftCards[index];
    if (!u) return;
    u.apply(state.player);
    state.score += 220 + state.roomNumber * 15;
    spawnText(state.player.x, state.player.y - 36, u.short, u.color);
    showToast(`${u.name} grafted`, u.color);
    draft.classList.add('hidden');
    state.mode = 'play';
    startRoom(state.roomNumber + 1);
  }

  function rerollDraft() {
    if (state.mode !== 'draft' || state.rerolls <= 0) return;
    state.rerolls -= 1;
    state.draftCards = generateDraft();
    renderDraft();
    showToast('Boon Moots rerolled fate', '#f3dcff');
    tone(392, 0.07, 'triangle', 0.03, 0.72);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
  }

  function updateHUD(force = false) {
    const p = state.player;
    const room = state.room;
    const key = JSON.stringify({
      mode: state.mode,
      room: state.roomNumber,
      hp: p ? p.hp : 0,
      mhp: p ? p.maxHp : 0,
      shield: p ? p.shield : 0,
      smax: p ? p.shieldMax : 0,
      score: Math.floor(state.score / 10),
      combo: state.combo,
      kills: state.kills,
      biome: room?.biome?.id,
      enemies: state.enemies.length,
      waves: state.waves.length,
      upgrades: p ? Object.entries(p.upgrades).map(([a, b]) => `${a}:${b}`).join('|') : ''
    });
    if (!force && key === state.lastHudKey) return;
    state.lastHudKey = key;
    roomNameEl.textContent = room ? `Room ${state.roomNumber}: ${room.biome.name}` : 'Bellroom';
    roomMetaEl.textContent = room ? `${room.layoutLabel} • ${state.enemies.length} hostile${state.enemies.length === 1 ? '' : 's'}${state.waves.length ? ` • ${state.waves.length} wave${state.waves.length === 1 ? '' : 's'} pending` : ''}` : 'one room arcade';
    subLineEl.textContent = state.mode === 'draft' ? 'Choose a graft • 1/2/3 select • R rerolls' : 'WASD moves • mouse/right touch aims • auto-fire • Space dashes • R rerolls drafts';
    scoreEl.textContent = Math.floor(state.score).toLocaleString();
    comboEl.textContent = state.combo > 1 ? `x${state.combo} combo • ${Math.max(0, state.comboTimer).toFixed(1)}s` : `best ${Math.floor(meta.bestScore || 0).toLocaleString()} • room ${meta.bestRoom || 0}`;
    if (p) {
      let html = '';
      for (let i = 0; i < p.maxHp; i++) html += `<span class="pip ${i < Math.ceil(p.hp) ? 'full' : ''}"></span>`;
      for (let i = 0; i < p.shieldMax; i++) html += `<span class="pip ${i < p.shield ? 'shield' : ''}"></span>`;
      barsEl.innerHTML = html;
      const chips = ['Moots', `Dash ${p.dashCooldown <= 0 ? 'ready' : p.dashCooldown.toFixed(1)}`];
      const upChips = Object.entries(p.upgrades).filter(([id, n]) => n > 0 && UPGRADE_BY_ID[id] && !UPGRADE_BY_ID[id].transient).sort((a, b) => a[0].localeCompare(b[0]));
      buildEl.innerHTML = `<span class="build-chip ready">Boon Moots reroll</span>` + chips.map(c => `<span class="build-chip">${escapeHtml(c)}</span>`).join('') + upChips.map(([id, n]) => `<span class="build-chip" style="border-color:${rgba(UPGRADE_BY_ID[id].color, 0.35)}">${escapeHtml(UPGRADE_BY_ID[id].short)} ×${n}</span>`).join('');
    } else {
      barsEl.innerHTML = '';
      buildEl.innerHTML = '<span class="build-chip ready">prototype loaded</span>';
    }
  }

  function draw() {
    const shakeX = state.shake > 0 ? rand(-state.shake, state.shake) : 0;
    const shakeY = state.shake > 0 ? rand(-state.shake, state.shake) : 0;
    ctx.save();
    ctx.translate(shakeX, shakeY);
    const b = currentBiome();
    drawBackground(b);
    drawArena(b);
    drawRoomGeometry(b);
    drawStaticHazards();
    drawDynamicHazards();
    drawPickups();
    drawMines();
    drawBullets();
    drawTelegraphs();
    drawEnemies();
    drawDrones();
    drawPlayer();
    drawBossBar();
    drawTouchControls();
    ctx.restore();
    drawOverlayFX(b);
    drawMessages();
  }

  function drawBackground(b) {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, b.top);
    grad.addColorStop(1, b.bottom);
    ctx.fillStyle = grad;
    ctx.fillRect(-20, -20, W + 40, H + 40);
    drawSoftGlow(ctx, W * 0.5, H * 0.36, Math.max(W, H) * 0.55, b.accent, 0.09);
    drawSoftGlow(ctx, W * 0.18, H * 0.78, Math.max(W, H) * 0.28, b.accent2, 0.055);
    for (let i = 0; i < state.stars.length; i++) {
      const s = state.stars[i];
      const tw = 0.35 + 0.65 * Math.sin(state.time * (0.6 + s.r * 0.2) + s.p) ** 2;
      ctx.fillStyle = rgba(i % 5 === 0 ? b.accent2 : '#ffffff', 0.12 * tw);
      ctx.beginPath();
      ctx.arc(s.sx * W, s.sy * H, s.r, 0, TAU);
      ctx.fill();
    }
  }

  function drawArena(b) {
    ctx.save();
    roundRectPath(ctx, arena.x, arena.y, arena.w, arena.h, 28);
    ctx.fillStyle = rgba('#03040a', 0.24);
    ctx.fill();
    ctx.clip();
    const step = 42;
    ctx.lineWidth = 1;
    ctx.strokeStyle = rgba(b.accent, 0.07);
    ctx.beginPath();
    for (let x = arena.x + ((state.time * 8) % step); x < arena.x + arena.w; x += step) { ctx.moveTo(x, arena.y); ctx.lineTo(x, arena.y + arena.h); }
    for (let y = arena.y + ((state.time * 5) % step); y < arena.y + arena.h; y += step) { ctx.moveTo(arena.x, y); ctx.lineTo(arena.x + arena.w, y); }
    ctx.stroke();
    ctx.restore();
    roundRectPath(ctx, arena.x, arena.y, arena.w, arena.h, 28);
    ctx.lineWidth = 2;
    ctx.strokeStyle = rgba(b.accent, 0.34);
    ctx.stroke();
    roundRectPath(ctx, arena.x + 5, arena.y + 5, arena.w - 10, arena.h - 10, 23);
    ctx.lineWidth = 1;
    ctx.strokeStyle = rgba('#ffffff', 0.06);
    ctx.stroke();
  }

  function drawRoomGeometry(b) {
    const room = state.room;
    if (!room) return;
    for (const o of room.obstacles) {
      ctx.save();
      ctx.shadowColor = rgba(b.accent, 0.25);
      ctx.shadowBlur = 14;
      ctx.fillStyle = o.color;
      ctx.strokeStyle = o.line;
      ctx.lineWidth = 1.5;
      if (o.type === 'circle') {
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.r, 0, TAU);
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = rgba('#ffffff', 0.05);
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.arc(o.x, o.y, o.r * (0.35 + i * 0.2), 0, TAU);
          ctx.stroke();
        }
      } else {
        roundRectPath(ctx, o.x, o.y, o.w, o.h, o.r || 16);
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = rgba('#ffffff', 0.05);
        ctx.beginPath();
        ctx.moveTo(o.x + 10, o.y + 10);
        ctx.lineTo(o.x + o.w - 10, o.y + o.h - 10);
        ctx.moveTo(o.x + o.w - 10, o.y + 10);
        ctx.lineTo(o.x + 10, o.y + o.h - 10);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function drawStaticHazards() {
    const room = state.room;
    if (!room) return;
    for (const h of room.staticHazards) drawHazard(h, 0.38 + 0.12 * Math.sin(state.time * 2 + h.phase));
  }

  function drawDynamicHazards() {
    for (const h of state.hazards) {
      const a = clamp(h.life / (h.maxLife || h.life || 1), 0, 1);
      drawHazard(h, a * 0.65);
    }
    for (const p of state.particles) {
      if (!p.ring) continue;
      const a = clamp(p.life / p.maxLife, 0, 1);
      ctx.strokeStyle = rgba(p.color, a * 0.8);
      ctx.lineWidth = 2 + (1 - a) * 8;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * (1.12 - a * 0.12), 0, TAU);
      ctx.stroke();
    }
  }

  function drawHazard(h, alpha) {
    drawSoftGlow(ctx, h.x, h.y, h.r * 1.7, h.color, alpha * 0.22);
    ctx.save();
    ctx.strokeStyle = rgba(h.color, alpha * 0.7);
    ctx.fillStyle = rgba(h.color, alpha * 0.11);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(h.x, h.y, h.r * (0.92 + 0.05 * Math.sin((h.pulse || 0) + state.time * 3)), 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawPickups() {
    for (const it of state.pickups) {
      drawSoftGlow(ctx, it.x, it.y, it.r * 5, it.color, 0.16);
      ctx.fillStyle = it.color;
      if (it.type === 'repair') {
        ctx.beginPath();
        ctx.arc(it.x, it.y, it.r, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#07100b';
        ctx.fillRect(it.x - 1.5, it.y - it.r * 0.55, 3, it.r * 1.1);
        ctx.fillRect(it.x - it.r * 0.55, it.y - 1.5, it.r * 1.1, 3);
      } else {
        starPath(ctx, it.x, it.y, it.r * 0.45, it.r * 1.35, 4, state.time * 2);
        ctx.fill();
      }
    }
  }

  function starPath(g, x, y, inner, outer, points, rot = 0) {
    g.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const a = rot + i / (points * 2) * TAU;
      const r = i % 2 ? inner : outer;
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
    }
    g.closePath();
  }

  function drawMines() {
    for (const m of state.mines) {
      const armed = m.arm <= 0;
      drawSoftGlow(ctx, m.x, m.y, armed ? 42 : 24, m.color, armed ? 0.14 : 0.08);
      ctx.fillStyle = armed ? m.color : rgba(m.color, 0.45);
      ctx.strokeStyle = rgba('#ffffff', 0.28);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r, 0, TAU);
      ctx.fill();
      ctx.stroke();
      if (armed) {
        ctx.strokeStyle = rgba(m.color, 0.3 + 0.2 * Math.sin(state.time * 7));
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.radius, 0, TAU);
        ctx.stroke();
      }
    }
  }

  function drawBullets() {
    for (const b of state.enemyBullets) {
      drawSoftGlow(ctx, b.x, b.y, b.r * 5, b.color, 0.17);
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, TAU);
      ctx.fill();
    }
    for (const b of state.bullets) {
      drawSoftGlow(ctx, b.x, b.y, b.r * 4.8, b.color, b.crit ? 0.26 : 0.16);
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, TAU);
      ctx.fill();
      if (b.bounces > 0) {
        ctx.strokeStyle = rgba('#ffffff', 0.36);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r + 2, 0, TAU);
        ctx.stroke();
      }
    }
    for (const p of state.particles) {
      if (p.text || p.ring) continue;
      const a = clamp(p.life / p.maxLife, 0, 1);
      ctx.fillStyle = rgba(p.color, a);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * (0.6 + a * 0.8), 0, TAU);
      ctx.fill();
    }
  }

  function drawTelegraphs() {
    for (const e of state.enemies) {
      if (e.dead) continue;
      if (e.behavior === 'sniper' && e.state === 'aim') {
        ctx.save();
        ctx.strokeStyle = rgba(e.color, 0.28 + 0.28 * Math.sin(state.time * 18));
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        ctx.lineTo(e.x + Math.cos(e.angle) * 2000, e.y + Math.sin(e.angle) * 2000);
        ctx.stroke();
        ctx.restore();
      }
      if (e.behavior === 'charger' && e.state === 'windup') {
        ctx.save();
        ctx.strokeStyle = rgba(e.color, 0.38 + 0.26 * Math.sin(state.time * 22));
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        ctx.lineTo(e.x + Math.cos(e.angle) * 160, e.y + Math.sin(e.angle) * 160);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  function drawEnemies() {
    for (const e of state.enemies) {
      if (e.dead) continue;
      const color = e.hitFlash > 0 ? mixColor(e.color, '#ffffff', 0.65, 1) : e.color;
      drawSoftGlow(ctx, e.x, e.y, e.r * (e.boss ? 3.2 : 2.5), e.color, e.boss ? 0.18 : 0.12);
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(e.angle || Math.atan2((state.player?.y || e.y) - e.y, (state.player?.x || e.x) - e.x));
      ctx.fillStyle = rgba(color, 0.95);
      ctx.strokeStyle = rgba('#ffffff', e.elite || e.boss || e.miniboss ? 0.34 : 0.16);
      ctx.lineWidth = e.boss ? 3 : 1.5;
      if (e.behavior === 'skitter') {
        trianglePath(ctx, e.r * 1.12);
      } else if (e.behavior === 'charger' || e.behavior === 'spiggot') {
        diamondPath(ctx, e.r * 1.12);
      } else if (e.behavior === 'turret') {
        polygonPath(ctx, 6, e.r * 1.02, 0.1);
      } else if (e.behavior === 'sniper') {
        lensPath(ctx, e.r * 1.25);
      } else if (e.behavior === 'hexer' || e.behavior === 'lien') {
        starPath(ctx, 0, 0, e.r * 0.55, e.r * 1.1, 5, state.time * 0.7);
      } else if (e.boss || e.miniboss) {
        polygonPath(ctx, e.behavior === 'archon' ? 9 : 8, e.r, state.time * 0.15);
      } else {
        ctx.beginPath(); ctx.arc(0, 0, e.r, 0, TAU);
      }
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = rgba('#05060b', 0.62);
      ctx.beginPath();
      ctx.arc(e.r * 0.35, 0, Math.max(3, e.r * 0.18), 0, TAU);
      ctx.fill();
      if (e.elite) {
        ctx.strokeStyle = rgba('#ffffff', 0.5);
        ctx.beginPath(); ctx.arc(0, 0, e.r + 5 + Math.sin(state.time * 5) * 1.5, 0, TAU); ctx.stroke();
      }
      ctx.restore();
      if (!e.boss && e.hp < e.maxHp) {
        const w = e.r * 2.1;
        ctx.fillStyle = rgba('#000000', 0.35);
        roundRectPath(ctx, e.x - w / 2, e.y - e.r - 12, w, 4, 2); ctx.fill();
        ctx.fillStyle = e.color;
        roundRectPath(ctx, e.x - w / 2, e.y - e.r - 12, w * clamp(e.hp / e.maxHp, 0, 1), 4, 2); ctx.fill();
      }
    }
  }

  function trianglePath(g, r) {
    g.beginPath(); g.moveTo(r, 0); g.lineTo(-r * 0.72, -r * 0.7); g.lineTo(-r * 0.45, 0); g.lineTo(-r * 0.72, r * 0.7); g.closePath();
  }

  function diamondPath(g, r) {
    g.beginPath(); g.moveTo(r, 0); g.lineTo(0, -r * 0.72); g.lineTo(-r, 0); g.lineTo(0, r * 0.72); g.closePath();
  }

  function lensPath(g, r) {
    g.beginPath(); g.ellipse(0, 0, r * 1.18, r * 0.54, 0, 0, TAU); g.closePath();
  }

  function polygonPath(g, sides, r, rot = 0) {
    g.beginPath();
    for (let i = 0; i < sides; i++) {
      const a = rot + i / sides * TAU;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.closePath();
  }

  function drawDrones() {
    const p = state.player;
    if (!p) return;
    const halo = p.upgrades.orbitalHalo || 0;
    if (halo > 0) {
      const wards = Math.min(8, halo);
      for (let i = 0; i < wards; i++) {
        const a = state.time * (1.9 + halo * 0.06) + i * TAU / wards;
        const x = p.x + Math.cos(a) * (44 + halo * 3.5);
        const y = p.y + Math.sin(a) * (44 + halo * 3.5);
        drawSoftGlow(ctx, x, y, 30, '#fff1a8', 0.16);
        ctx.fillStyle = '#fff1a8';
        ctx.beginPath(); ctx.arc(x, y, 6.5, 0, TAU); ctx.fill();
      }
    }
    for (const d of state.drones) {
      drawSoftGlow(ctx, d.x, d.y, 24, '#ffd48b', 0.14);
      ctx.fillStyle = '#ffd48b';
      ctx.strokeStyle = rgba('#05060b', 0.55);
      ctx.lineWidth = 2;
      starPath(ctx, d.x, d.y, 4, 8, 4, -state.time * 2);
      ctx.fill(); ctx.stroke();
    }
  }

  function drawPlayer() {
    const p = state.player;
    if (!p) return;
    const inv = p.invuln > 0 && Math.floor(state.time * 18) % 2 === 0;
    ctx.save();
    ctx.globalAlpha = inv ? 0.55 : 1;
    drawSoftGlow(ctx, p.x, p.y, 70, p.color, 0.18);
    ctx.translate(p.x, p.y);
    ctx.rotate(p.aim);
    // Cloak body.
    ctx.fillStyle = rgba('#0d0b14', 0.92);
    ctx.strokeStyle = rgba(p.color, 0.46);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.bezierCurveTo(6, -20, -24, -18, -20, 0);
    ctx.bezierCurveTo(-24, 18, 6, 20, 18, 0);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Twin relays.
    ctx.fillStyle = p.color;
    if (typeof ctx.roundRect === 'function') { ctx.beginPath(); ctx.roundRect(4, -18, 18, 7, 4); ctx.fill(); }
    else { roundRectPath(ctx, 4, -18, 18, 7, 4); ctx.fill(); }
    if (typeof ctx.roundRect === 'function') { ctx.beginPath(); ctx.roundRect(4, 11, 18, 7, 4); ctx.fill(); }
    else { roundRectPath(ctx, 4, 11, 18, 7, 4); ctx.fill(); }
    // Wrong-foot laced Moots boots.
    ctx.rotate(-p.aim);
    ctx.fillStyle = rgba(p.color2, 0.95);
    ctx.strokeStyle = rgba('#17111f', 0.8);
    ctx.lineWidth = 1.3;
    for (const sx of [-7, 7]) {
      ctx.save();
      ctx.translate(sx, 14 + Math.sin(state.time * 9 + sx) * 1.2);
      ctx.rotate(sx * 0.018);
      ctx.beginPath(); ctx.ellipse(0, 0, 5.4, 9, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = rgba('#17111f', 0.62);
      ctx.beginPath();
      ctx.moveTo(-3, -4); ctx.lineTo(3, 0); ctx.moveTo(3, -4); ctx.lineTo(-3, 0);
      ctx.moveTo(-3, 1.5); ctx.lineTo(3, 5.5); ctx.moveTo(3, 1.5); ctx.lineTo(-3, 5.5);
      ctx.stroke();
      ctx.restore();
    }
    // Broken moon head.
    ctx.fillStyle = '#f6f0ff';
    ctx.strokeStyle = rgba(p.color, 0.7);
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, -5, 12.5, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = rgba('#1b1424', 0.62);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-5, -15); ctx.lineTo(-1, -8); ctx.lineTo(-6, -2); ctx.lineTo(0, 3);
    ctx.stroke();
    if (p.dashCooldown <= 0) {
      ctx.strokeStyle = rgba('#ffe18c', 0.6 + 0.24 * Math.sin(state.time * 7));
      ctx.beginPath(); ctx.arc(0, -5, 17, 0, TAU); ctx.stroke();
    }
    ctx.restore();
  }

  function drawBossBar() {
    const boss = state.enemies.find(e => !e.dead && (e.boss || e.miniboss));
    if (!boss) return;
    const w = Math.min(520, arena.w * 0.72);
    const x = arena.x + arena.w * 0.5 - w * 0.5;
    const y = arena.y + 12;
    ctx.save();
    roundRectPath(ctx, x, y, w, 22, 11);
    ctx.fillStyle = rgba('#000000', 0.45);
    ctx.fill();
    roundRectPath(ctx, x + 3, y + 3, (w - 6) * clamp(boss.hp / boss.maxHp, 0, 1), 16, 8);
    ctx.fillStyle = boss.color;
    ctx.fill();
    ctx.fillStyle = rgba('#07070d', 0.8);
    ctx.font = '800 11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(boss.display.toUpperCase(), x + w * 0.5, y + 11.5);
    ctx.restore();
  }

  function drawTouchControls() {
    if (input.moveTouch.id != null) drawStick(input.moveTouch, '#79dcff');
    if (input.aimTouch.id != null) drawStick(input.aimTouch, '#f3dcff');
  }

  function drawStick(t, color) {
    ctx.save();
    ctx.strokeStyle = rgba(color, 0.32);
    ctx.fillStyle = rgba(color, 0.08);
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(t.startX, t.startY, 46, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = rgba(color, 0.48);
    ctx.beginPath(); ctx.arc(t.startX + clamp(t.dx, -46, 46), t.startY + clamp(t.dy, -46, 46), 18, 0, TAU); ctx.fill();
    ctx.restore();
  }

  function drawOverlayFX(b) {
    if (state.flash > 0) {
      ctx.fillStyle = rgba('#ff6e92', state.flash * 0.28);
      ctx.fillRect(0, 0, W, H);
    }
    const vg = ctx.createRadialGradient(W * 0.5, H * 0.5, Math.min(W, H) * 0.15, W * 0.5, H * 0.5, Math.max(W, H) * 0.74);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.42)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
  }

  function drawMessages() {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const active = state.messages.filter(m => m.delay <= 0);
    active.forEach((m, i) => {
      const a = clamp(m.life / m.maxLife, 0, 1);
      const y = arena.y + arena.h * 0.38 + i * 34 + m.y - (1 - a) * 28;
      ctx.font = `900 ${m.size}px Inter, system-ui, sans-serif`;
      ctx.lineWidth = 7;
      ctx.strokeStyle = rgba('#02030a', a * 0.8);
      ctx.strokeText(m.text, arena.x + arena.w * 0.5, y);
      ctx.fillStyle = rgba(m.color, a);
      ctx.fillText(m.text, arena.x + arena.w * 0.5, y);
    });
    for (const p of state.particles) {
      if (!p.text) continue;
      const a = clamp(p.life / p.maxLife, 0, 1);
      ctx.font = '900 16px Inter, system-ui, sans-serif';
      ctx.lineWidth = 4;
      ctx.strokeStyle = rgba('#000000', a * 0.6);
      ctx.strokeText(p.text, p.x, p.y);
      ctx.fillStyle = rgba(p.color, a);
      ctx.fillText(p.text, p.x, p.y);
    }
    if (state.mode === 'play' && state.roomIntro > 0) {
      const a = clamp(state.roomIntro, 0, 1);
      const text = state.roomNumber % 5 === 0 ? 'BOSS BELL' : 'BELL DROP';
      ctx.font = `900 ${clamp(arena.w * 0.06, 30, 64)}px Inter, system-ui, sans-serif`;
      ctx.lineWidth = 8;
      ctx.strokeStyle = rgba('#000000', a * 0.72);
      ctx.fillStyle = rgba(currentBiome().accent2, a);
      ctx.strokeText(text, arena.x + arena.w * 0.5, arena.y + arena.h * 0.5);
      ctx.fillText(text, arena.x + arena.w * 0.5, arena.y + arena.h * 0.5);
    }
    ctx.restore();
  }

  function updateStaticRoomDamage() {
    // Reserved for future environmental room logic.
  }

  function startLoop() {
    let last = performance.now();
    function frame(now) {
      const dt = clamp((now - last) / 1000, 0, 0.033);
      last = now;
      update(dt);
      draw();
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('pointerdown', e => {
    if (state.mode !== 'play') return;
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    if (e.pointerType === 'mouse') {
      input.mouse.down = true;
      input.mouse.x = e.clientX;
      input.mouse.y = e.clientY;
      input.mouse.seen = true;
      if (e.button === 2) triggerDash();
      return;
    }
    const slot = e.clientX < W * 0.48 && input.moveTouch.id == null ? input.moveTouch : input.aimTouch;
    slot.id = e.pointerId;
    slot.startX = slot.x = e.clientX;
    slot.startY = slot.y = e.clientY;
    slot.dx = 0;
    slot.dy = 0;
    e.preventDefault();
  }, { passive: false });

  canvas.addEventListener('pointermove', e => {
    if (e.pointerType === 'mouse') {
      input.mouse.x = e.clientX;
      input.mouse.y = e.clientY;
      input.mouse.seen = true;
      return;
    }
    for (const slot of [input.moveTouch, input.aimTouch]) {
      if (slot.id === e.pointerId) {
        slot.x = e.clientX;
        slot.y = e.clientY;
        slot.dx = clamp(slot.x - slot.startX, -60, 60);
        slot.dy = clamp(slot.y - slot.startY, -60, 60);
        e.preventDefault();
      }
    }
  }, { passive: false });

  function releasePointer(e) {
    if (e.pointerType === 'mouse') input.mouse.down = false;
    for (const slot of [input.moveTouch, input.aimTouch]) {
      if (slot.id === e.pointerId) {
        slot.id = null;
        slot.dx = slot.dy = 0;
      }
    }
  }
  canvas.addEventListener('pointerup', releasePointer);
  canvas.addEventListener('pointercancel', releasePointer);

  window.addEventListener('keydown', e => {
    input.keys[e.code] = true;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    if ((state.mode === 'title' || state.mode === 'gameover') && (e.code === 'Enter' || e.code === 'Space')) startRun();
    else if (state.mode === 'play') {
      if (e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') triggerDash();
    } else if (state.mode === 'draft') {
      if (e.code === 'Digit1') chooseDraft(0);
      if (e.code === 'Digit2') chooseDraft(1);
      if (e.code === 'Digit3') chooseDraft(2);
      if (e.code === 'KeyR') rerollDraft();
    }
  }, { passive: false });

  window.addEventListener('keyup', e => { input.keys[e.code] = false; });
  startBtn.addEventListener('click', startRun);
  rerollBtn.addEventListener('click', rerollDraft);
  draftCardsEl.addEventListener('click', e => {
    const btn = e.target.closest('[data-index]');
    if (btn) chooseDraft(Number(btn.dataset.index));
  });

  window.addEventListener('blur', () => {
    input.keys = Object.create(null);
    input.moveTouch.id = null;
    input.aimTouch.id = null;
  });

  startLoop();
  updateHUD(true);
})();
