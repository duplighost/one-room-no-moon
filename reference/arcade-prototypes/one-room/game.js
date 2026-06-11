(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });

  const $ = (id) => document.getElementById(id);
  const els = {
    title: $('titleOverlay'),
    start: $('startButton'),
    restart: $('restartButton'),
    home: $('homeButton'),
    gameOver: $('gameOverOverlay'),
    gameOverStats: $('gameOverStats'),
    roomKicker: $('roomKicker'),
    roomTitle: $('roomTitle'),
    roomMeta: $('roomMeta'),
    scoreText: $('scoreText'),
    comboText: $('comboText'),
    bestText: $('bestText'),
    hpBar: $('hpBar'),
    boonText: $('boonText'),
    statText: $('statText'),
    graftText: $('graftText'),
    draftUI: $('draftUI'),
    draftKicker: $('draftKicker'),
    draftTitle: $('draftTitle'),
    draftHint: $('draftHint'),
    draftCards: $('draftCards'),
    boonButton: $('boonButton'),
    sfxButton: $('sfxButton'),
    titleSfxButton: $('titleSfxButton'),
    messageStack: $('messageStack')
  };

  const TAU = Math.PI * 2;
  const SAVE_KEY = 'noMoonArcadeSave_v1';
  const SFX_KEY = 'noMoonArcadeSfxMute_v1';
  const DPR_MAX = 2;
  const BASE_W = 1080;
  const BASE_H = 760;
  const WALL = 58;
  const PLAYER_BULLET_CAP = 220;
  const ENEMY_BULLET_CAP_DESKTOP = 170;
  const ENEMY_BULLET_CAP_MOBILE = 115;
  const PARTICLE_CAP_DESKTOP = 280;
  const PARTICLE_CAP_MOBILE = 165;

  let nextEnemyId = 1;
  let nextBulletId = 1;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a = 1, b = 0) => Math.random() * (a - b) + b;
  const randi = (a, b = 0) => Math.floor(rand(a, b));
  const dist2 = (a, b, c, d) => {
    const dx = a - c;
    const dy = b - d;
    return dx * dx + dy * dy;
  };
  const len = (x, y) => Math.hypot(x, y);
  const norm = (x, y) => {
    const l = Math.hypot(x, y) || 1;
    return { x: x / l, y: y / l, l };
  };
  const angleLerp = (a, b, t) => {
    let d = ((b - a + Math.PI) % TAU) - Math.PI;
    return a + d * t;
  };
  const fmt = (n) => Math.round(n).toLocaleString('en-US');
  const cssAlpha = (hex, a) => {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map(x => x + x).join('') : h, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  };

  function hashString(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i += 1) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function rng() {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pick(arr, rng = Math.random) {
    return arr[Math.floor(rng() * arr.length)];
  }

  function weightedPick(arr, getWeight, rng = Math.random) {
    let total = 0;
    for (const it of arr) total += Math.max(0, getWeight(it));
    if (total <= 0) return pick(arr, rng);
    let roll = rng() * total;
    for (const it of arr) {
      roll -= Math.max(0, getWeight(it));
      if (roll <= 0) return it;
    }
    return arr[arr.length - 1];
  }

  function roundRectPath(c, x, y, w, h, r) {
    const rr = Math.min(r, w * 0.5, h * 0.5);
    c.beginPath();
    c.moveTo(x + rr, y);
    c.arcTo(x + w, y, x + w, y + h, rr);
    c.arcTo(x + w, y + h, x, y + h, rr);
    c.arcTo(x, y + h, x, y, rr);
    c.arcTo(x, y, x + w, y, rr);
    c.closePath();
  }

  const MOOTS = Object.freeze({
    id: 'moots',
    name: 'Moots',
    title: 'Boon-Moots Errant',
    accent: '#f3dcff',
    accent2: '#fff0b8',
    maxHp: 6,
    speed: 264,
    damage: 0.88,
    fireDelay: 0.20,
    weapon: 'twin'
  });

  const BIOMES = Object.freeze([
    { id: 'verdigris', tier: 'early', name: 'Verdigris Court', top: '#173024', bottom: '#08110b', accent: '#8cf0b7', accent2: '#dbffe5', shot: '#a8ffd2', mechanic: 'rootwork', mood: 'cloistered vines and polite murder' },
    { id: 'fen', tier: 'early', name: 'Drownlight Fen', top: '#10252e', bottom: '#071116', accent: '#79dcff', accent2: '#b7f6ff', shot: '#a8f3ff', mechanic: 'fog', mood: 'blue mud, soft reeds, mean water' },
    { id: 'mirror', tier: 'early', name: 'Mirror Orchard', top: '#171f33', bottom: '#080f18', accent: '#84d0ff', accent2: '#f0b8ff', shot: '#d7c0ff', mechanic: 'shards', mood: 'glass fruit and reflective grudges' },
    { id: 'rosewire', tier: 'early', name: 'Rosewire Atrium', top: '#25162a', bottom: '#0c0812', accent: '#ff93cf', accent2: '#b9ffb8', shot: '#ffd0e9', mechanic: 'thorns', mood: 'flowers with a legal department' },
    { id: 'ember', tier: 'mid', name: 'Cinder Span', top: '#271611', bottom: '#0c0706', accent: '#ff9b62', accent2: '#ffd0a1', shot: '#ffc58b', mechanic: 'heat', mood: 'furnace rhythm and ash breath' },
    { id: 'mycelium', tier: 'mid', name: 'Lumen Mycelia', top: '#181427', bottom: '#090713', accent: '#c596ff', accent2: '#9effdc', shot: '#dfbcff', mechanic: 'spores', mood: 'glowing fungal bad advice' },
    { id: 'shardreef', tier: 'mid', name: 'Shardreef Causeway', top: '#102434', bottom: '#081119', accent: '#7fe5ff', accent2: '#ffd1f9', shot: '#b8edff', mechanic: 'glass', mood: 'reef knives under dead water' },
    { id: 'coilroot', tier: 'mid', name: 'Coilroot Vault', top: '#132317', bottom: '#080f0a', accent: '#b0f28c', accent2: '#e9ffc6', shot: '#d4ffb4', mechanic: 'lanes', mood: 'old roots wired to machinery' },
    { id: 'archive', tier: 'late', name: 'Obsidian Archive', top: '#151525', bottom: '#05050b', accent: '#b9c3ff', accent2: '#fff1d0', shot: '#d7dcff', mechanic: 'snipers', mood: 'books that shoot back' },
    { id: 'basilica', tier: 'late', name: 'Null Basilica', top: '#101018', bottom: '#030306', accent: '#d8d3ff', accent2: '#9af0ff', shot: '#ebe9ff', mechanic: 'ritual', mood: 'holy silence, extremely armed' },
    { id: 'forge', tier: 'late', name: 'Sable Forge', top: '#221515', bottom: '#070406', accent: '#ff6f7a', accent2: '#ffdc9a', shot: '#ffb08c', mechanic: 'slag', mood: 'black metal and cardiac sparks' },
    { id: 'ossuary', tier: 'late', name: 'Auric Ossuary', top: '#211b0e', bottom: '#090704', accent: '#ffd46f', accent2: '#fff3c1', shot: '#ffe08d', mechanic: 'relics', mood: 'gold bones with terrible opinions' },
    { id: 'noctlith', tier: 'abyss', name: 'Noctlith Gallery', top: '#101322', bottom: '#03040a', accent: '#6f8cff', accent2: '#d4e0ff', shot: '#9fb6ff', mechanic: 'beams', mood: 'starless art and long aim-lines' },
    { id: 'frost', tier: 'abyss', name: 'Frost Reliquary', top: '#0e1d2b', bottom: '#03070b', accent: '#a6e7ff', accent2: '#f2fdff', shot: '#d7f7ff', mechanic: 'rime', mood: 'cold glass, colder saints' },
    { id: 'stormloom', tier: 'abyss', name: 'Stormloom Array', top: '#101d2d', bottom: '#04070d', accent: '#8ad8ff', accent2: '#fff3b0', shot: '#bceeff', mechanic: 'conductors', mood: 'weather built by lunatics' },
    { id: 'umbra', tier: 'abyss', name: 'Umbra Harvest', top: '#1b1021', bottom: '#040207', accent: '#d48cff', accent2: '#ffafde', shot: '#e4b7ff', mechanic: 'ambush', mood: 'purple fields where the crop is you' },
    { id: 'spire', tier: 'zenith', name: 'Auric Spire', top: '#271f10', bottom: '#080604', accent: '#ffd36a', accent2: '#d8f6ff', shot: '#ffeb9b', mechanic: 'altars', mood: 'upward gold and falling teeth' },
    { id: 'blacksun', tier: 'zenith', name: 'Blacksun Garden', top: '#251313', bottom: '#050205', accent: '#ffbd66', accent2: '#ff7ea6', shot: '#ffd198', mechanic: 'solar', mood: 'sunlight that failed a psych eval' },
    { id: 'crownworks', tier: 'zenith', name: 'Crownworks Engine', top: '#161a26', bottom: '#05070d', accent: '#b9f0ff', accent2: '#ffe59a', shot: '#d5f7ff', mechanic: 'engine', mood: 'royal machinery chewing hymnals' },
    { id: 'throne', tier: 'final', name: 'Null Throne', top: '#090912', bottom: '#010104', accent: '#f2e9ff', accent2: '#89e7ff', shot: '#ffffff', mechanic: 'everything', mood: 'the room stops pretending it is a room' }
  ]);

  const ARCHETYPES = Object.freeze([
    { id: 'killbox', name: 'Killbox', desc: 'open floor, high density' },
    { id: 'ritualRing', name: 'Ritual Ring', desc: 'central altar, edge pressure' },
    { id: 'crossfire', name: 'Crossfire Gallery', desc: 'pillars, sightlines, gunners' },
    { id: 'spine', name: 'Spine', desc: 'split lanes and ugly traffic' },
    { id: 'pockets', name: 'Pockets', desc: 'four islands, corner spawns' },
    { id: 'collapse', name: 'Collapse Cell', desc: 'tight room, rush pressure' },
    { id: 'glassCathedral', name: 'Glass Cathedral', desc: 'volatile shards and ricochets' },
    { id: 'furnace', name: 'Furnace Floor', desc: 'pulse hazards and heat rhythm' },
    { id: 'gravityWell', name: 'Gravity Well', desc: 'pull fields and weird footing' }
  ]);

  const ENEMY_TYPES = Object.freeze({
    skitter: { display: 'Pewling', cost: 1, r: 14, hp: 3.1, speed: 142, color: '#9fffd0', behavior: 'skitter', score: 105 },
    gunner: { display: 'Censer', cost: 2, r: 16, hp: 4.8, speed: 82, color: '#9fd2ff', behavior: 'gunner', score: 180 },
    charger: { display: 'Ramwraith', cost: 3, r: 18, hp: 6.6, speed: 116, color: '#ffad7d', behavior: 'charger', score: 260 },
    turret: { display: 'Lectern', cost: 3, r: 19, hp: 7.5, speed: 0, color: '#ffd98c', behavior: 'turret', score: 300 },
    brute: { display: 'Ox-Warden', cost: 4, r: 25, hp: 13.5, speed: 58, color: '#ff8f9f', behavior: 'brute', score: 430 },
    sniper: { display: 'Long Candle', cost: 4, r: 16, hp: 6.3, speed: 50, color: '#d4dcff', behavior: 'sniper', score: 410 },
    hexer: { display: 'Antiphon', cost: 5, r: 22, hp: 10.4, speed: 52, color: '#d894ff', behavior: 'hexer', score: 560 },
    myrmidon: { display: 'Crown-Sworn', cost: 5, r: 19, hp: 9.8, speed: 108, color: '#fff08c', behavior: 'myrmidon', score: 600 },
    snapper: { display: 'Snapper', cost: 3, r: 15, hp: 5.9, speed: 168, color: '#b9ff8a', behavior: 'snapper', score: 330 },
    lantern: { display: 'Drift Lantern', cost: 3, r: 17, hp: 5.2, speed: 78, color: '#a9f2ff', behavior: 'lantern', score: 340 },
    manta: { display: 'Eclipse Manta', cost: 5, r: 27, hp: 12.4, speed: 70, color: '#b8b2ff', behavior: 'manta', score: 650 },
    gravityStone: { display: 'Gravity Stone', cost: 5, r: 24, hp: 16.0, speed: 24, color: '#90a8ff', behavior: 'gravityStone', score: 680 },
    starThief: { display: 'Star Thief', cost: 4, r: 15, hp: 7.4, speed: 142, color: '#f3dcff', behavior: 'starThief', score: 520 },
    sunTouched: { display: 'Sun-touched', cost: 6, r: 20, hp: 13.8, speed: 92, color: '#ffe28a', behavior: 'sunTouched', score: 780 },
    falseMoon: { display: 'False Moon', boss: true, cost: 99, r: 52, hp: 58, speed: 70, color: '#d7c0ff', behavior: 'falseMoon', score: 2600 },
    spiggot: { display: 'Spiggot', boss: true, cost: 99, r: 44, hp: 54, speed: 128, color: '#ffb3dd', behavior: 'spiggot', score: 2700 },
    moonBear: { display: 'Moon Bear', boss: true, cost: 99, r: 62, hp: 92, speed: 78, color: '#dce4ff', behavior: 'moonBear', score: 4200 },
    warden: { display: 'Graven Warden', boss: true, cost: 99, r: 64, hp: 118, speed: 54, color: '#ffcf8a', behavior: 'warden', score: 5200 },
    archon: { display: 'Null Archon', boss: true, cost: 99, r: 74, hp: 170, speed: 48, color: '#ede7ff', behavior: 'archon', score: 7600 },
    drownedSun: { display: 'Drowned Sun', boss: true, cost: 99, r: 82, hp: 195, speed: 42, color: '#b8f2ff', behavior: 'drownedSun', score: 9000 },
    firstWalker: { display: 'First Walker', boss: true, cost: 99, r: 84, hp: 215, speed: 56, color: '#d7e1ff', behavior: 'firstWalker', score: 10300 },
    sunCore: { display: 'The Sun Core', boss: true, cost: 99, r: 92, hp: 260, speed: 38, color: '#fff6b8', behavior: 'sunCore', score: 12500 }
  });

  const ITEM_POOL = Object.freeze([
    { id: 'ricochet', name: 'Prism Teeth', short: 'Prism', color: '#8dd6ff', type: 'projectile', weight: 4, tags: ['Bounce', 'Projectile'], desc: 'Shots ricochet off walls and stone. Stacks add extra rebounds.' },
    { id: 'splitWake', name: 'Split Wake', short: 'Split', color: '#c5f1ff', type: 'projectile', weight: 4, tags: ['On kill', 'Forking'], desc: 'Killing shots split into a fan of smaller rounds. Stacks widen and thicken the fan.' },
    { id: 'orbitalHalo', name: 'Orbital Halo', short: 'Halo', color: '#fff1a8', type: 'defense', weight: 5, tags: ['Orbitals', 'Barrier'], desc: 'Adds a damaging ward that circles you, clips enemies, and shreds stray bullets.' },
    { id: 'rearArray', name: 'Rear Array', short: 'Rear', color: '#ffb48c', type: 'weapon', weight: 4, tags: ['Rear fire', 'Coverage'], desc: 'Every volley spits stingers behind you. Stacks add extra barrels.' },
    { id: 'graveCharge', name: 'Grave Charge', short: 'Grave', color: '#ff8c7d', type: 'on-kill', weight: 6, tags: ['Death blast', 'Area'], desc: 'Enemies detonate when they die, bruising whatever is nearby.' },
    { id: 'hunterMycelia', name: 'Hunter Mycelia', short: 'Hunter', color: '#9cffcb', type: 'projectile', weight: 6, tags: ['Homing', 'Tracking'], desc: 'All shots gain a homing itch. Stacks tighten the turn and keep rounds alive longer.' },
    { id: 'phaseDrill', name: 'Phase Drill', short: 'Drill', color: '#d9b8ff', type: 'projectile', weight: 6, tags: ['Pierce', 'Lane clear'], desc: 'Rounds punch through extra bodies before dying.' },
    { id: 'sidecarLances', name: 'Sidecar Lances', short: 'Sidecar', color: '#b8d7ff', type: 'weapon', weight: 3, tags: ['Side fire', 'Coverage'], desc: 'Every volley also spits lateral side-shots.' },
    { id: 'staticLink', name: 'Arc Rosary', short: 'Rosary', color: '#b0f1ff', type: 'control', weight: 5, tags: ['Chain', 'Arc'], desc: 'Hits arc damage into nearby enemies like beads on a string.' },
    { id: 'cryoRime', name: 'Gravemire Liturgy', short: 'Mire', color: '#bfeaff', type: 'control', weight: 5, tags: ['Slow', 'Control'], desc: 'Every hit drags enemy movement down. Stacks make the drag nastier.' },
    { id: 'scavengerDrone', name: 'Lantern Pup', short: 'Pup', color: '#ffd48b', type: 'companion', weight: 4, tags: ['Companion', 'Autofire'], desc: 'Adds a little pup that circles you and shoots for itself.' },
    { id: 'emberMine', name: 'Ember Mine', short: 'Mine', color: '#ffa86f', type: 'trap', weight: 4, tags: ['Mines', 'Area'], desc: 'Moving leaves armed mines behind you.' },
    { id: 'spiteCore', name: 'Spite Core', short: 'Spite', color: '#ff90ca', type: 'retaliation', weight: 4, tags: ['Retaliate', 'Burst'], desc: 'Taking a hit spits a radial burst back into the room.' },
    { id: 'shrapnelChamber', name: 'Shrapnel Chamber', short: 'Shrapnel', color: '#ffe391', type: 'projectile', weight: 3, tags: ['Fragments', 'Impact'], desc: 'Impacts burst into fragments.' },
    { id: 'echoChamber', name: 'Echo Chamber', short: 'Echo', color: '#e7f4ff', type: 'tempo', weight: 4, tags: ['Delayed volley', 'Repeat'], desc: 'Every few volleys repeat as a spectral aftershock.' },
    { id: 'cacheCompass', name: 'Hush Compass', short: 'Hush', color: '#ffe28a', type: 'utility', weight: 4, maxStacks: 3, tags: ['Rewards', 'Greed'], desc: 'Improves rare room-clear cores and bonus cache odds. Secrets are dead; greed lives.' },
    { id: 'gravityWell', name: 'Covetmark', short: 'Covet', color: '#9ec7ff', type: 'utility', weight: 4, tags: ['Magnet', 'Utility'], desc: 'Pickups and graft cores pull toward you from farther out.' },
    { id: 'hullScripture', name: 'Hull Scripture', short: 'Hull', color: '#ff9db1', type: 'survival', weight: 3, maxStacks: 3, tags: ['Max HP', 'Rare'], desc: 'Raises max integrity by 1, up to three grafted scriptures.' },
    { id: 'bloodTithe', name: 'Blood Tithe', short: 'Tithe', color: '#ff6f8f', type: 'survival', weight: 4, tags: ['Heal', 'On kill'], desc: 'Every handful of kills repairs the hull.' },
    { id: 'sutureEngine', name: 'Hull Suture', short: 'Suture', color: '#9dffc7', type: 'survival', weight: 3, maxStacks: 3, tags: ['Room clear', 'Recovery'], desc: 'Clearing rooms while wounded can stitch integrity back into the hull.' },
    { id: 'lunarCaliber', name: 'Lunar Caliber', short: 'Caliber', color: '#d8ecff', type: 'weapon', weight: 5, tags: ['Bigger shots', 'Damage'], desc: 'Player rounds hit harder and wider.' },
    { id: 'blackLotus', name: 'Black Lotus', short: 'Lotus', color: '#dcb0ff', type: 'control', weight: 4, tags: ['Room open', 'Slow field'], desc: 'New rooms start with a slowing bloom that buys breathing room.' },
    { id: 'aegisLattice', name: 'Aegis Lattice', short: 'Aegis', color: '#b6ddff', type: 'defense', weight: 3, maxStacks: 2, tags: ['Shield', 'Safety'], desc: 'Adds a regenerating guard layer. Stacks up to two extra charges.' },
    { id: 'siphonVane', name: 'Siphon Vane', short: 'Siphon', color: '#9effc2', type: 'survival', weight: 4, maxStacks: 4, tags: ['On kill', 'Repair'], desc: 'Kills can shed repair blooms.' },
    { id: 'executionBloom', name: 'Execution Bloom', short: 'Bloom', color: '#ffb27d', type: 'damage', weight: 4, maxStacks: 4, tags: ['Finisher', 'Boss bite'], desc: 'Wounded enemies take extra finishing damage.' },
    { id: 'moonShard', name: 'Moon Shard', short: 'Shard', color: '#f5e3ff', type: 'damage', weight: 4, maxStacks: 4, tags: ['Crit', 'Burst'], desc: 'Player shots can critically flare for bonus damage.' },
    { id: 'riftCapacitor', name: 'Rift Capacitor', short: 'Rift', color: '#c2f1ff', type: 'tempo', weight: 3, maxStacks: 3, tags: ['Room clear', 'Recovery'], desc: 'After enough room clears, the hull recharges one integrity.' }
  ]);
  const ITEM_BY_ID = Object.fromEntries(ITEM_POOL.map((it) => [it.id, it]));

  const view = { w: 1, h: 1, dpr: 1, scale: 1, ox: 0, oy: 0 };
  const input = {
    keys: new Set(),
    mouse: { x: BASE_W * 0.5, y: BASE_H * 0.5, down: false, active: false },
    leftTouch: null,
    rightTouch: null,
    touchMove: { x: 0, y: 0 },
    touchAim: { x: 1, y: 0, active: false, fire: false },
    usingTouch: false
  };

  const defaultSave = () => ({
    version: 1,
    highScore: 0,
    bestRoom: 0,
    lifetimeKills: 0,
    lifetimeRooms: 0,
    lifetimeRuns: 0,
    seenItems: {},
    lastRun: null
  });

  function loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return defaultSave();
      return Object.assign(defaultSave(), JSON.parse(raw));
    } catch (_) {
      return defaultSave();
    }
  }

  function saveNow() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state.save)); } catch (_) {}
  }

  const audio = {
    ctx: null,
    enabled: localStorage.getItem(SFX_KEY) !== '1',
    unlock() {
      if (!this.enabled) return;
      if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    },
    toggle() {
      this.enabled = !this.enabled;
      localStorage.setItem(SFX_KEY, this.enabled ? '0' : '1');
      updateSfxButtons();
      if (this.enabled) this.unlock();
    },
    blip(kind = 'hit', volume = 0.05) {
      if (!this.enabled) return;
      this.unlock();
      const ac = this.ctx;
      if (!ac) return;
      const now = ac.currentTime;
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      const map = {
        shot: [420, 0.035, 'triangle'],
        hit: [170, 0.045, 'square'],
        kill: [96, 0.12, 'sawtooth'],
        hurt: [62, 0.18, 'sawtooth'],
        clear: [520, 0.26, 'triangle'],
        draft: [720, 0.13, 'sine'],
        boon: [260, 0.30, 'triangle'],
        boss: [48, 0.45, 'sawtooth'],
        over: [38, 0.55, 'sawtooth']
      };
      const [freq, dur, type] = map[kind] || map.hit;
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(Math.max(24, freq * (kind === 'clear' || kind === 'draft' ? 1.8 : 0.55)), now + dur);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(volume, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      osc.connect(gain).connect(ac.destination);
      osc.start(now);
      osc.stop(now + dur + 0.02);
    }
  };

  const state = {
    mode: 'title',
    time: 0,
    runTime: 0,
    dt: 0,
    lastTs: 0,
    mobile: false,
    run: null,
    player: null,
    room: null,
    enemies: [],
    bullets: [],
    particles: [],
    pickups: [],
    hazards: [],
    drones: [],
    messages: [],
    draft: { active: false, source: 'room', cards: [], afterPick: null },
    boon: { charges: 0, progress: 0, need: 2, flash: 0 },
    camera: { shake: 0, sx: 0, sy: 0 },
    transition: { active: false, phase: 'none', timer: 0, alpha: 0, nextRoom: 1 },
    save: loadSave(),
    hudTick: 0
  };

  function itemCount(id) {
    return state.player && state.player.items ? (state.player.items[id] || 0) : 0;
  }

  function resize() {
    view.dpr = Math.min(DPR_MAX, Math.max(1, window.devicePixelRatio || 1));
    view.w = window.innerWidth;
    view.h = window.innerHeight;
    canvas.width = Math.max(1, Math.floor(view.w * view.dpr));
    canvas.height = Math.max(1, Math.floor(view.h * view.dpr));
    canvas.style.width = `${view.w}px`;
    canvas.style.height = `${view.h}px`;
    state.mobile = view.w < 820 || navigator.maxTouchPoints > 1;
    computeView();
  }

  function computeView() {
    const room = state.room || { width: BASE_W, height: BASE_H };
    const pad = state.mobile ? 0.985 : 0.955;
    view.scale = Math.min(view.w / room.width, view.h / room.height) * pad;
    view.ox = (view.w - room.width * view.scale) * 0.5;
    view.oy = (view.h - room.height * view.scale) * 0.5;
  }

  function screenToWorld(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left - view.ox) / view.scale;
    const y = (clientY - rect.top - view.oy) / view.scale;
    return { x, y };
  }

  function updateSfxButtons() {
    const text = audio.enabled ? 'SFX On' : 'SFX Off';
    els.sfxButton.textContent = text;
    els.titleSfxButton.textContent = text;
  }

  function addMessage(text, color = '#f4f7ff', ttl = 1.9) {
    state.messages.push({ text, color, ttl, max: ttl });
    const node = document.createElement('div');
    node.className = 'toast';
    node.textContent = text;
    node.style.borderColor = cssAlpha(color, 0.35);
    node.style.boxShadow = `0 12px 48px rgba(0,0,0,.34), 0 0 24px ${cssAlpha(color, 0.18)}`;
    els.messageStack.appendChild(node);
    setTimeout(() => {
      node.style.transition = 'opacity .25s ease, transform .25s ease';
      node.style.opacity = '0';
      node.style.transform = 'translateY(-8px)';
      setTimeout(() => node.remove(), 260);
    }, ttl * 1000);
  }

  function createPlayer() {
    return {
      x: BASE_W * 0.5,
      y: BASE_H * 0.5,
      vx: 0,
      vy: 0,
      r: 17,
      angle: 0,
      aimX: 1,
      aimY: 0,
      hp: MOOTS.maxHp,
      maxHp: MOOTS.maxHp,
      shield: 0,
      shieldMax: 0,
      shieldCd: 0,
      invuln: 1.25,
      speed: MOOTS.speed,
      damage: MOOTS.damage,
      fireDelay: MOOTS.fireDelay,
      fireCd: 0,
      volleyIndex: 0,
      mineCd: 0,
      hitCd: 0,
      items: {},
      perfect: true,
      killsSinceHeal: 0,
      riftRooms: 0,
      lotusTimer: 0
    };
  }

  function recomputePlayerStats() {
    const p = state.player;
    if (!p) return;
    const oldMax = p.maxHp || MOOTS.maxHp;
    p.maxHp = MOOTS.maxHp + itemCount('hullScripture');
    if (p.maxHp > oldMax) p.hp = Math.min(p.maxHp, p.hp + (p.maxHp - oldMax));
    p.speed = MOOTS.speed * (1 + itemCount('frame') * 0.08);
    p.damage = MOOTS.damage * (1 + itemCount('lunarCaliber') * 0.18);
    p.fireDelay = Math.max(0.075, MOOTS.fireDelay * (1 - itemCount('cadence') * 0.1));
    p.shieldMax = itemCount('aegisLattice');
    if (p.shield > p.shieldMax) p.shield = p.shieldMax;
  }

  function startRun() {
    audio.unlock();
    nextEnemyId = 1;
    nextBulletId = 1;
    state.mode = 'play';
    state.time = 0;
    state.runTime = 0;
    state.run = {
      seed: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
      roomNo: 1,
      score: 0,
      combo: 1,
      comboTimer: 0,
      kills: 0,
      roomsCleared: 0,
      bossesKilled: 0,
      perfectRooms: 0,
      stars: 0,
      bestScore: state.save.highScore || 0
    };
    state.player = createPlayer();
    state.enemies = [];
    state.bullets = [];
    state.particles = [];
    state.pickups = [];
    state.hazards = [];
    state.drones = [];
    state.boon = { charges: 0, progress: 0, need: 2, flash: 0 };
    state.transition = { active: false, phase: 'none', timer: 0, alpha: 0, nextRoom: 1 };
    els.title.classList.add('hidden');
    els.gameOver.classList.add('hidden');
    hideDraft();
    state.save.lifetimeRuns += 1;
    saveNow();
    loadRoom(1);
    addMessage('Moots enters the only room.', MOOTS.accent, 2.1);
  }

  function endRun() {
    if (state.mode === 'gameover') return;
    state.mode = 'gameover';
    audio.blip('over', 0.09);
    const run = state.run || { score: 0, roomNo: 0, kills: 0, roomsCleared: 0 };
    state.save.highScore = Math.max(state.save.highScore || 0, Math.floor(run.score || 0));
    state.save.bestRoom = Math.max(state.save.bestRoom || 0, run.roomNo || 0);
    state.save.lifetimeKills += run.kills || 0;
    state.save.lifetimeRooms += run.roomsCleared || 0;
    state.save.lastRun = {
      score: Math.floor(run.score || 0),
      room: run.roomNo || 0,
      kills: run.kills || 0,
      time: Math.floor(state.runTime || 0),
      endedAt: new Date().toISOString()
    };
    saveNow();
    els.gameOverStats.textContent = `Score ${fmt(run.score)}. Reached room ${run.roomNo}. Kills ${run.kills}. Cleared ${run.roomsCleared}. Best ${fmt(state.save.highScore)}.`;
    els.gameOver.classList.remove('hidden');
    updateHud(true);
  }

  function returnTitle() {
    state.mode = 'title';
    els.gameOver.classList.add('hidden');
    els.title.classList.remove('hidden');
  }

  function tierForRoom(roomNo) {
    if (roomNo <= 4) return ['early'];
    if (roomNo <= 9) return ['early', 'mid'];
    if (roomNo <= 14) return ['mid', 'late'];
    if (roomNo <= 19) return ['late', 'abyss'];
    if (roomNo <= 29) return ['abyss', 'zenith'];
    return ['zenith', 'final', 'abyss'];
  }

  function chooseBiome(roomNo, rng) {
    if (roomNo % 30 === 0) return BIOMES.find(b => b.id === 'blacksun') || BIOMES[0];
    if (roomNo % 20 === 0) return BIOMES.find(b => b.id === 'throne') || BIOMES[0];
    if (roomNo % 10 === 0) return BIOMES.find(b => b.id === 'basilica') || BIOMES[0];
    const tiers = tierForRoom(roomNo);
    const pool = BIOMES.filter((b) => tiers.includes(b.tier));
    return pick(pool.length ? pool : BIOMES, rng);
  }

  function bossForRoom(roomNo, rng) {
    if (roomNo % 30 === 0) return 'sunCore';
    if (roomNo % 25 === 0) return rng() < 0.5 ? 'drownedSun' : 'firstWalker';
    if (roomNo % 20 === 0) return 'archon';
    if (roomNo % 15 === 0) return 'moonBear';
    if (roomNo % 10 === 0) return 'warden';
    if (roomNo % 5 === 0) return rng() < 0.5 ? 'falseMoon' : 'spiggot';
    return null;
  }

  function loadRoom(roomNo) {
    const seed = hashString(`${state.run.seed}:${roomNo}:room`);
    const rng = mulberry32(seed);
    const bossType = bossForRoom(roomNo, rng);
    const biome = chooseBiome(roomNo, rng);
    const archetype = bossType ? { id: 'ritualRing', name: 'Ritual Arena', desc: 'boss ceremony' } : pick(ARCHETYPES.slice(0, Math.min(ARCHETYPES.length, 4 + Math.floor(roomNo / 3))), rng);
    const bossRoom = !!bossType;
    const width = bossRoom ? 1180 : BASE_W;
    const height = bossRoom ? 820 : BASE_H;

    const room = {
      id: `${biome.id}-${archetype.id}-${roomNo}`,
      roomNo,
      seed,
      rng,
      biome,
      archetype,
      bossType,
      bossRoom,
      width,
      height,
      wall: WALL,
      name: bossType ? ENEMY_TYPES[bossType].display : `${biome.name}: ${archetype.name}`,
      subtitle: bossType ? `Boss room / ${biome.mood}` : `${archetype.desc} / ${biome.mood}`,
      obstacles: [],
      hazards: [],
      ambient: [],
      waves: [],
      waveIndex: 0,
      waveTimer: 1.05,
      spawningDone: false,
      cleared: false,
      rewarded: false,
      clearTimer: 0,
      introTimer: 1.4,
      clearTime: 0,
      spawnedBoss: false
    };
    buildObstacles(room, rng);
    buildHazards(room, rng);
    buildWaves(room, rng);
    state.room = room;
    state.enemies = [];
    state.bullets = [];
    state.pickups = [];
    state.hazards = room.hazards;
    computeView();
    const p = state.player;
    p.x = room.width * 0.5;
    p.y = room.height * 0.5;
    p.vx = 0;
    p.vy = 0;
    p.invuln = Math.max(p.invuln || 0, bossRoom ? 1.5 : 1.05);
    p.perfect = true;
    p.lotusTimer = itemCount('blackLotus') ? 4.5 + itemCount('blackLotus') * 1.0 : 0;
    if (p.lotusTimer > 0) {
      room.hazards.push({ kind: 'lotus', x: p.x, y: p.y, r: 190 + itemCount('blackLotus') * 38, age: 0, life: p.lotusTimer, color: ITEM_BY_ID.blackLotus.color, slow: 0.45 });
    }
    syncDrones();
    audio.blip(bossRoom ? 'boss' : 'draft', bossRoom ? 0.07 : 0.035);
    addMessage(bossRoom ? `${ENEMY_TYPES[bossType].display} enters the box.` : `Room ${roomNo}: ${biome.name}`, bossRoom ? ENEMY_TYPES[bossType].color : biome.accent, bossRoom ? 2.5 : 1.7);
    updateHud(true);
  }

  function addObstacle(room, ob) {
    ob.id = ob.id || `ob-${room.obstacles.length}`;
    room.obstacles.push(ob);
  }

  function buildObstacles(room, rng) {
    const cx = room.width * 0.5;
    const cy = room.height * 0.5;
    const safeR = room.bossRoom ? 150 : 125;
    const addPillar = (x, y, r, breakable = false) => {
      if (Math.hypot(x - cx, y - cy) < safeR + r) return;
      addObstacle(room, { kind: 'circle', x, y, r, color: room.biome.accent, hp: breakable ? 3.5 : Infinity, maxHp: breakable ? 3.5 : Infinity, breakable, volatile: breakable && (room.biome.mechanic === 'glass' || room.archetype.id === 'glassCathedral') });
    };
    const addRect = (x, y, w, h, breakable = false) => {
      const nearestX = clamp(cx, x, x + w);
      const nearestY = clamp(cy, y, y + h);
      if (Math.hypot(nearestX - cx, nearestY - cy) < safeR) return;
      addObstacle(room, { kind: 'rect', x, y, w, h, r: 14, color: room.biome.accent, hp: breakable ? 4.2 : Infinity, maxHp: breakable ? 4.2 : Infinity, breakable, volatile: breakable && (room.biome.mechanic === 'glass' || room.archetype.id === 'glassCathedral') });
    };

    switch (room.archetype.id) {
      case 'ritualRing':
        for (let i = 0; i < 6; i += 1) {
          const a = i / 6 * TAU + rng() * 0.18;
          addPillar(cx + Math.cos(a) * (room.bossRoom ? 250 : 220), cy + Math.sin(a) * (room.bossRoom ? 188 : 165), 24 + rng() * 8, room.biome.mechanic === 'glass');
        }
        break;
      case 'crossfire':
        addRect(cx - 290, cy - 130, 64, 260, false);
        addRect(cx + 226, cy - 130, 64, 260, false);
        addPillar(cx, cy - 210, 28, room.biome.mechanic === 'glass');
        addPillar(cx, cy + 210, 28, room.biome.mechanic === 'glass');
        break;
      case 'spine':
        for (let i = -2; i <= 2; i += 1) addRect(cx - 44, cy + i * 112 - 38, 88, 76, i % 2 === 0 && room.biome.mechanic === 'glass');
        break;
      case 'pockets':
        for (const sx of [-1, 1]) for (const sy of [-1, 1]) addPillar(cx + sx * 255, cy + sy * 170, 44, room.biome.mechanic === 'glass');
        break;
      case 'collapse':
        addRect(cx - 360, cy - 210, 120, 90, false);
        addRect(cx + 240, cy + 120, 120, 90, false);
        addPillar(cx - 245, cy + 160, 30, true);
        addPillar(cx + 245, cy - 160, 30, true);
        break;
      case 'glassCathedral':
        for (let i = 0; i < 10; i += 1) {
          const a = rng() * TAU;
          const rr = 170 + rng() * 250;
          addPillar(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.72, 18 + rng() * 13, true);
        }
        break;
      case 'furnace':
        for (let i = 0; i < 4; i += 1) addRect(cx - 330 + i * 220, cy - 34, 70, 68, i % 2 === 0);
        break;
      case 'gravityWell':
        addPillar(cx - 280, cy, 38, false);
        addPillar(cx + 280, cy, 38, false);
        addPillar(cx, cy - 210, 32, false);
        addPillar(cx, cy + 210, 32, false);
        break;
      default:
        for (let i = 0; i < 5; i += 1) {
          addPillar(WALL + rng() * (room.width - WALL * 2), WALL + rng() * (room.height - WALL * 2), 18 + rng() * 19, room.biome.mechanic === 'glass' && rng() < 0.6);
        }
    }
  }

  function buildHazards(room, rng) {
    const mech = room.biome.mechanic;
    const cx = room.width * 0.5;
    const cy = room.height * 0.5;
    const hazards = room.hazards;

    if (room.archetype.id === 'ritualRing' || mech === 'ritual' || mech === 'altars') {
      hazards.push({ kind: 'pulse', x: cx, y: cy, r: room.bossRoom ? 142 : 112, age: rng() * 2, interval: 4.2, delay: 1.05, activeTime: 0.58, damage: 1, color: room.biome.accent });
    }
    if (room.archetype.id === 'furnace' || mech === 'heat' || mech === 'solar' || mech === 'slag') {
      for (let i = 0; i < (room.bossRoom ? 4 : 3); i += 1) {
        hazards.push({ kind: 'pulse', x: WALL + rng() * (room.width - WALL * 2), y: WALL + rng() * (room.height - WALL * 2), r: 72 + rng() * 42, age: rng() * 3, interval: 3.2 + rng() * 1.1, delay: 0.85, activeTime: 0.42, damage: 1, color: room.biome.accent });
      }
    }
    if (room.archetype.id === 'crossfire' || mech === 'lanes' || mech === 'beams' || mech === 'engine' || mech === 'conductors') {
      const count = room.bossRoom ? 4 : 2 + Math.floor(room.roomNo / 8);
      for (let i = 0; i < count; i += 1) {
        const vertical = i % 2 === 0;
        hazards.push({ kind: 'lane', x: vertical ? WALL + rng() * (room.width - WALL * 2) : cx, y: vertical ? cy : WALL + rng() * (room.height - WALL * 2), w: vertical ? 38 : room.width - WALL * 2, h: vertical ? room.height - WALL * 2 : 38, age: rng() * 3, interval: 4.5 + rng() * 1.2, delay: 1.0, activeTime: 0.48, damage: 1, color: room.biome.accent2 });
      }
    }
    if (mech === 'fog' || mech === 'spores' || mech === 'rime') {
      for (let i = 0; i < 3; i += 1) {
        hazards.push({ kind: 'fog', x: WALL + rng() * (room.width - WALL * 2), y: WALL + rng() * (room.height - WALL * 2), r: 92 + rng() * 58, age: rng() * 8, color: room.biome.accent, slow: 0.62 });
      }
    }
    if (room.archetype.id === 'gravityWell' || mech === 'everything') {
      hazards.push({ kind: 'gravity', x: cx, y: cy, r: 220, age: 0, interval: 5.2, delay: 1.0, activeTime: 1.4, force: 190, damage: 0, color: '#90a8ff' });
    }
  }

  function enemyPoolForRoom(roomNo, biome) {
    const pool = ['skitter', 'gunner'];
    if (roomNo >= 2) pool.push('charger', 'snapper');
    if (roomNo >= 3) pool.push('turret');
    if (roomNo >= 4) pool.push('sniper');
    if (roomNo >= 6) pool.push('brute', 'lantern');
    if (roomNo >= 8) pool.push('hexer', 'myrmidon');
    if (roomNo >= 12) pool.push('manta', 'starThief');
    if (roomNo >= 16) pool.push('gravityStone');
    if (roomNo >= 20) pool.push('sunTouched');
    if (biome.mechanic === 'snipers' || biome.mechanic === 'beams') pool.push('sniper', 'sniper');
    if (biome.mechanic === 'fog' || biome.mechanic === 'spores') pool.push('lantern', 'hexer');
    if (biome.mechanic === 'solar' || biome.mechanic === 'heat') pool.push('charger', 'sunTouched');
    if (biome.mechanic === 'ambush' || biome.mechanic === 'rootwork') pool.push('snapper', 'skitter');
    return pool;
  }

  function buildWaves(room, rng) {
    if (room.bossType) {
      room.waves.push({ delay: 1.0, groups: [{ type: room.bossType, count: 1, formation: 'centerBoss', elite: false }] });
      const addPool = enemyPoolForRoom(room.roomNo, room.biome).filter(id => !ENEMY_TYPES[id].boss);
      room.waves.push({ delay: 5.0, groups: [{ type: pick(addPool, rng), count: 4 + Math.floor(room.roomNo / 8), formation: 'edgeRing' }] });
      room.waves.push({ delay: 8.5, groups: [{ type: pick(addPool, rng), count: 3 + Math.floor(room.roomNo / 10), formation: 'corners' }] });
      return;
    }
    const pool = enemyPoolForRoom(room.roomNo, room.biome);
    const waveCount = clamp(1 + Math.floor(room.roomNo / 4), 1, 4);
    const budget = 5 + room.roomNo * 1.15 + Math.floor(room.roomNo / 3) * 2.0;
    let remaining = budget;
    const formations = formationsForArchetype(room.archetype.id);
    for (let w = 0; w < waveCount; w += 1) {
      const groups = [];
      const groupCount = 1 + (room.roomNo > 6 && rng() < 0.55 ? 1 : 0) + (room.roomNo > 14 && rng() < 0.35 ? 1 : 0);
      const target = Math.max(3, remaining / (waveCount - w));
      let spent = 0;
      for (let g = 0; g < groupCount; g += 1) {
        const id = weightedPick(pool, (pid) => 1 / ENEMY_TYPES[pid].cost, rng);
        const cost = ENEMY_TYPES[id].cost;
        const count = clamp(Math.round((target / groupCount) / cost + rng() * 2), 1, id === 'brute' || id === 'gravityStone' ? 2 : 7);
        spent += count * cost;
        groups.push({ type: id, count, formation: pick(formations, rng), eliteChance: clamp((room.roomNo - 8) * 0.012, 0, 0.22) });
      }
      remaining -= spent;
      room.waves.push({ delay: w === 0 ? 0.9 : 2.2 + rng() * 1.0, groups });
    }
  }

  function formationsForArchetype(id) {
    if (id === 'crossfire') return ['corners', 'gallery', 'opposites'];
    if (id === 'ritualRing') return ['edgeRing', 'diagonals', 'ritual'];
    if (id === 'spine') return ['lanes', 'opposites', 'edgeRing'];
    if (id === 'pockets') return ['corners', 'pockets', 'diagonals'];
    if (id === 'collapse') return ['rushRing', 'opposites', 'corners'];
    if (id === 'glassCathedral') return ['diagonals', 'edgeRing', 'pockets'];
    return ['rushRing', 'edgeRing', 'corners', 'diagonals', 'opposites'];
  }

  function formationPositions(room, formation, count, rng) {
    const out = [];
    const cx = room.width * 0.5;
    const cy = room.height * 0.5;
    const left = WALL + 34;
    const right = room.width - WALL - 34;
    const top = WALL + 34;
    const bottom = room.height - WALL - 34;
    const add = (x, y) => out.push({ x: clamp(x, WALL + 20, room.width - WALL - 20), y: clamp(y, WALL + 20, room.height - WALL - 20) });
    if (formation === 'centerBoss') {
      add(cx, cy - 130);
      return out;
    }
    for (let i = 0; i < count; i += 1) {
      const t = count <= 1 ? 0.5 : i / (count - 1);
      if (formation === 'rushRing' || formation === 'edgeRing' || formation === 'ritual') {
        const a = (i / Math.max(1, count)) * TAU + rng() * 0.4;
        const rx = room.width * (formation === 'ritual' ? 0.39 : 0.45);
        const ry = room.height * (formation === 'ritual' ? 0.31 : 0.40);
        add(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry);
      } else if (formation === 'corners' || formation === 'pockets') {
        const corners = [[left, top], [right, top], [left, bottom], [right, bottom]];
        const c = corners[i % corners.length];
        add(c[0] + (rng() - 0.5) * 110, c[1] + (rng() - 0.5) * 90);
      } else if (formation === 'diagonals') {
        const sx = i % 2 ? 1 : -1;
        const sy = Math.floor(i / 2) % 2 ? 1 : -1;
        add(cx + sx * (230 + rng() * 170), cy + sy * (140 + rng() * 120));
      } else if (formation === 'gallery') {
        add(lerp(left + 80, right - 80, t), i % 2 ? top + 70 : bottom - 70);
      } else if (formation === 'lanes') {
        add(i % 2 ? left + rng() * 90 : right - rng() * 90, lerp(top + 70, bottom - 70, t));
      } else if (formation === 'opposites') {
        add(i % 2 ? right : left, lerp(top + 80, bottom - 80, t));
      } else {
        const edge = i % 4;
        if (edge === 0) add(lerp(left, right, rng()), top);
        if (edge === 1) add(right, lerp(top, bottom, rng()));
        if (edge === 2) add(lerp(left, right, rng()), bottom);
        if (edge === 3) add(left, lerp(top, bottom, rng()));
      }
    }
    return out;
  }

  function spawnWave(wave) {
    const room = state.room;
    const rng = room.rng || Math.random;
    for (const group of wave.groups) {
      const positions = formationPositions(room, group.formation, group.count, rng);
      for (const pos of positions) {
        const elite = !ENEMY_TYPES[group.type].boss && rng() < (group.eliteChance || 0);
        spawnEnemy(group.type, pos.x, pos.y, elite);
      }
    }
  }

  function spawnEnemy(typeId, x, y, elite = false) {
    const type = ENEMY_TYPES[typeId] || ENEMY_TYPES.skitter;
    const roomNo = state.room ? state.room.roomNo : 1;
    const hpScale = type.boss ? (1 + roomNo * 0.045) : (1 + roomNo * 0.105);
    const e = {
      id: nextEnemyId += 1,
      typeId,
      type,
      display: type.display,
      x,
      y,
      vx: 0,
      vy: 0,
      r: type.r * (elite ? 1.12 : 1),
      hp: type.hp * hpScale * (elite ? 1.7 : 1),
      maxHp: type.hp * hpScale * (elite ? 1.7 : 1),
      speed: type.speed * (elite ? 1.08 : 1),
      color: elite ? '#ffffff' : type.color,
      behavior: type.behavior,
      boss: !!type.boss,
      elite,
      age: 0,
      shootCd: 0.7 + Math.random() * 1.4,
      specialCd: 1.5 + Math.random() * 2.2,
      windup: 0,
      dash: 0,
      dashX: 0,
      dashY: 0,
      slow: 0,
      hitFlash: 0,
      contactCd: 0,
      phase: 1,
      spawned75: false,
      spawned50: false,
      spawned25: false,
      score: type.score || 100,
      dead: false
    };
    if (e.boss) {
      e.hp *= 1.15;
      e.maxHp = e.hp;
      e.shootCd = 1.2;
      e.specialCd = 2.0;
      state.camera.shake = Math.max(state.camera.shake, 8);
    }
    state.enemies.push(e);
    for (let i = 0; i < 10; i += 1) spawnParticle(x, y, type.color, 0.45, 2.2, rand(80, 20));
    return e;
  }

  function syncDrones() {
    const count = clamp(itemCount('scavengerDrone'), 0, 5);
    while (state.drones.length < count) state.drones.push({ angle: Math.random() * TAU, fireCd: Math.random() * 0.6 });
    while (state.drones.length > count) state.drones.pop();
  }

  function update(dt) {
    state.time += dt;
    state.dt = dt;
    if (state.mode === 'play') {
      state.runTime += dt;
      updatePlay(dt);
    } else if (state.mode === 'draft') {
      updateParticles(dt);
    }
    updateTransition(dt);
    updateHud();
  }

  function updatePlay(dt) {
    const p = state.player;
    const room = state.room;
    if (!p || !room) return;

    room.clearTime += dt;
    if (room.introTimer > 0) room.introTimer -= dt;
    if (state.boon.flash > 0) state.boon.flash -= dt;
    if (p.invuln > 0) p.invuln -= dt;
    if (p.hitCd > 0) p.hitCd -= dt;
    if (p.fireCd > 0) p.fireCd -= dt;
    if (p.mineCd > 0) p.mineCd -= dt;
    if (p.shieldCd > 0) p.shieldCd -= dt;
    if (p.shieldMax > 0 && p.shield < p.shieldMax && p.shieldCd <= 0) {
      p.shield += 1;
      p.shieldCd = 8.0;
      addMessage('Aegis re-knit.', ITEM_BY_ID.aegisLattice.color, 1.1);
    }

    updateInputVectors();
    updatePlayer(dt);
    updateRoomFlow(dt);
    updateHazards(dt);
    updateEnemies(dt);
    updateDrones(dt);
    updateBullets(dt);
    updateOrbitals(dt);
    updatePickups(dt);
    updateParticles(dt);
    updateCombo(dt);
  }

  function updateInputVectors() {
    let mx = 0;
    let my = 0;
    if (input.keys.has('KeyW') || input.keys.has('ArrowUp')) my -= 1;
    if (input.keys.has('KeyS') || input.keys.has('ArrowDown')) my += 1;
    if (input.keys.has('KeyA') || input.keys.has('ArrowLeft')) mx -= 1;
    if (input.keys.has('KeyD') || input.keys.has('ArrowRight')) mx += 1;
    if (input.leftTouch) {
      mx += input.touchMove.x;
      my += input.touchMove.y;
    }
    const n = norm(mx, my);
    input.moveX = n.l > 0.01 ? n.x : 0;
    input.moveY = n.l > 0.01 ? n.y : 0;

    const p = state.player;
    if (!p) return;
    if (input.rightTouch && input.touchAim.active) {
      p.aimX = input.touchAim.x;
      p.aimY = input.touchAim.y;
    } else if (!input.usingTouch || input.mouse.active) {
      const dx = input.mouse.x - p.x;
      const dy = input.mouse.y - p.y;
      const a = norm(dx, dy);
      if (a.l > 4) {
        p.aimX = a.x;
        p.aimY = a.y;
      }
    } else {
      const nearest = nearestEnemy(p.x, p.y, 680);
      if (nearest) {
        const a = norm(nearest.x - p.x, nearest.y - p.y);
        p.aimX = a.x;
        p.aimY = a.y;
      }
    }
  }

  function updatePlayer(dt) {
    const p = state.player;
    const room = state.room;
    const slowMul = playerSlowMultiplier();
    const targetVx = input.moveX * p.speed * slowMul;
    const targetVy = input.moveY * p.speed * slowMul;
    const k = 1 - Math.exp(-dt * 12);
    p.vx = lerp(p.vx, targetVx, k);
    p.vy = lerp(p.vy, targetVy, k);
    moveCircleWithObstacles(p, p.vx * dt, p.vy * dt);
    p.x = clamp(p.x, room.wall + p.r, room.width - room.wall - p.r);
    p.y = clamp(p.y, room.wall + p.r, room.height - room.wall - p.r);
    const targetAngle = Math.atan2(p.aimY, p.aimX);
    p.angle = angleLerp(p.angle, targetAngle, 1 - Math.exp(-dt * 14));

    const wantsFire = (input.mouse.down && !input.usingTouch) || input.touchAim.fire || input.keys.has('KeyJ');
    if (wantsFire && p.fireCd <= 0 && !state.room.cleared) firePlayerWeapon();

    if ((Math.abs(p.vx) + Math.abs(p.vy)) > 80 && itemCount('emberMine')) {
      p.mineCd -= dt * itemCount('emberMine') * 0.2;
      if (p.mineCd <= 0) {
        p.mineCd = Math.max(0.34, 1.15 - itemCount('emberMine') * 0.13);
        state.hazards.push({ kind: 'mine', x: p.x - p.aimX * 20, y: p.y - p.aimY * 20, r: 28 + itemCount('emberMine') * 5, age: 0, arm: 0.34, life: 5.0, damage: 2.6 + itemCount('emberMine') * 0.75, color: ITEM_BY_ID.emberMine.color });
      }
    }
  }

  function playerSlowMultiplier() {
    const p = state.player;
    let mul = 1;
    for (const h of state.hazards) {
      if ((h.kind === 'fog' || h.kind === 'lotus') && dist2(p.x, p.y, h.x, h.y) < h.r * h.r) mul = Math.min(mul, h.slow || 0.6);
    }
    return mul;
  }

  function updateRoomFlow(dt) {
    const room = state.room;
    if (room.cleared) {
      room.clearTimer += dt;
      if (!room.rewarded && room.clearTimer > 0.7) {
        room.rewarded = true;
        rewardRoomClear();
      }
      return;
    }

    if (room.waveIndex < room.waves.length) {
      room.waveTimer -= dt;
      if (room.waveTimer <= 0) {
        const wave = room.waves[room.waveIndex];
        spawnWave(wave);
        room.waveIndex += 1;
        const next = room.waves[room.waveIndex];
        room.waveTimer = next ? next.delay : 0;
      }
    } else {
      room.spawningDone = true;
    }

    if (room.spawningDone && state.enemies.length === 0 && state.bullets.filter(b => b.owner === 'enemy').length < 3) {
      clearRoom();
    }
  }

  function clearRoom() {
    const room = state.room;
    if (!room || room.cleared) return;
    room.cleared = true;
    room.clearTimer = 0;
    state.run.roomsCleared += 1;
    if (state.player.perfect) state.run.perfectRooms += 1;
    state.camera.shake = Math.max(state.camera.shake, 7);
    state.boon.progress += 1;
    if (room.bossRoom) state.boon.progress = state.boon.need;
    if (state.boon.progress >= state.boon.need) {
      state.boon.charges = Math.min(1, state.boon.charges + 1);
      state.boon.progress = 0;
      state.boon.flash = 1.2;
      addMessage('Boon Moots ready.', MOOTS.accent, 1.5);
    }

    const roomBonus = 500 + room.roomNo * 75;
    const speedBonus = Math.max(0, 1000 - room.clearTime * 18);
    const perfectBonus = state.player.perfect ? 1000 + room.roomNo * 50 : 0;
    addScore(roomBonus + speedBonus + perfectBonus, false);
    if (state.player.perfect) addMessage('Perfect room. Filthy little miracle.', '#fff0b8', 1.8);
    audio.blip('clear', 0.085);
    for (let i = 0; i < 70; i += 1) spawnParticle(room.width * 0.5, room.height * 0.5, room.biome.accent, 0.7, 3.5, rand(260, 60));
  }

  function rewardRoomClear() {
    const p = state.player;
    const room = state.room;
    if (itemCount('sutureEngine') && p.hp < p.maxHp && Math.random() < 0.28 + itemCount('sutureEngine') * 0.18) {
      healPlayer(1);
      addMessage('Hull Suture stitched one integrity.', ITEM_BY_ID.sutureEngine.color, 1.4);
    }
    if (itemCount('riftCapacitor')) {
      p.riftRooms += 1;
      const need = Math.max(2, 5 - itemCount('riftCapacitor'));
      if (p.riftRooms >= need) {
        p.riftRooms = 0;
        healPlayer(1);
        addMessage('Rift Capacitor discharged.', ITEM_BY_ID.riftCapacitor.color, 1.4);
      }
    }
    const compass = itemCount('cacheCompass');
    const coreChance = (room.bossRoom ? 0.55 : 0.12) + compass * 0.08 + (p.perfect ? 0.07 : 0);
    if (Math.random() < coreChance) {
      spawnItemCore(room.width * 0.5 + rand(50, -50), room.height * 0.5 + rand(38, -38));
    }
    if (p.hp < p.maxHp && Math.random() < 0.18 + itemCount('siphonVane') * 0.03) spawnPickup('repair', room.width * 0.5 - 40, room.height * 0.5 + 16);
    const draftDue = room.roomNo === 1 || room.bossRoom || state.run.roomsCleared % 2 === 0;
    if (draftDue) {
      showDraft(room.bossRoom ? 'boss' : 'room', () => startRoomTransition(room.roomNo + 1));
    } else {
      startRoomTransition(room.roomNo + 1);
    }
  }

  function startRoomTransition(nextRoom) {
    state.transition = { active: true, phase: 'out', timer: 0, alpha: 0, nextRoom };
  }

  function updateTransition(dt) {
    const tr = state.transition;
    if (!tr.active) return;
    tr.timer += dt;
    if (tr.phase === 'out') {
      tr.alpha = clamp(tr.timer / 0.45, 0, 1);
      if (tr.timer >= 0.52) {
        tr.phase = 'in';
        tr.timer = 0;
        state.run.roomNo = tr.nextRoom;
        loadRoom(tr.nextRoom);
      }
    } else if (tr.phase === 'in') {
      tr.alpha = 1 - clamp(tr.timer / 0.48, 0, 1);
      if (tr.timer >= 0.54) {
        tr.active = false;
        tr.phase = 'none';
        tr.alpha = 0;
      }
    }
  }

  function showDraft(source = 'room', afterPick = null) {
    state.mode = 'draft';
    state.draft.active = true;
    state.draft.source = source;
    state.draft.afterPick = afterPick;
    state.draft.cards = rollDraftCards(source === 'boss' ? 4 : 3);
    renderDraft();
    els.draftUI.classList.add('show');
    audio.blip('draft', 0.06);
  }

  function hideDraft() {
    state.draft.active = false;
    els.draftUI.classList.remove('show');
  }

  function rollDraftCards(count = 3) {
    const p = state.player;
    const rng = Math.random;
    const cards = [];
    const available = ITEM_POOL.filter((it) => !it.maxStacks || (p.items[it.id] || 0) < it.maxStacks);
    while (cards.length < count && available.length) {
      const item = weightedPick(available.filter((it) => !cards.some((c) => c.id === it.id)), (it) => {
        let w = it.weight || 4;
        if ((p.items[it.id] || 0) > 0) w *= 0.88;
        if (state.draft.source === 'boss' && ['damage', 'weapon', 'survival'].includes(it.type)) w *= 1.2;
        return w;
      }, rng);
      if (!item) break;
      cards.push(item);
    }
    return cards;
  }

  function renderDraft() {
    const source = state.draft.source;
    els.draftKicker.textContent = source === 'boss' ? 'Boss Trophy Draft' : source === 'core' ? 'Loose Graft Core' : 'Graft Draft';
    els.draftTitle.textContent = source === 'boss' ? 'Take something from the corpse' : 'Choose the next bad idea';
    els.draftHint.textContent = state.boon.charges > 0 ? 'Boon Moots is charged: press E, Space, or Boon to reroll this draft.' : `Boon Moots lacing ${state.boon.progress}/${state.boon.need}. Pick one and keep the room moving.`;
    els.draftCards.innerHTML = '';
    state.draft.cards.forEach((item) => {
      const card = document.createElement('button');
      card.className = 'draft-card';
      card.style.setProperty('--card-color', item.color);
      card.innerHTML = `<div class="card-type">${item.type} / stack ${(state.player.items[item.id] || 0) + 1}${item.maxStacks ? ` of ${item.maxStacks}` : ''}</div><h3>${item.name}</h3><p>${item.desc}</p><div class="tags">${item.tags.map((t) => `<span class="tag">${t}</span>`).join('')}</div>`;
      card.addEventListener('click', () => chooseDraft(item.id));
      els.draftCards.appendChild(card);
    });
  }

  function chooseDraft(id) {
    const item = ITEM_BY_ID[id];
    if (!item) return;
    grantItem(id);
    audio.blip('draft', 0.07);
    hideDraft();
    const cb = state.draft.afterPick;
    state.draft.afterPick = null;
    if (cb) {
      state.mode = 'play';
      cb();
    } else {
      state.mode = 'play';
    }
  }

  function grantItem(id) {
    const p = state.player;
    const item = ITEM_BY_ID[id];
    if (!p || !item) return;
    const cur = p.items[id] || 0;
    if (item.maxStacks && cur >= item.maxStacks) return;
    p.items[id] = cur + 1;
    state.save.seenItems[id] = true;
    recomputePlayerStats();
    syncDrones();
    if (id === 'hullScripture') healPlayer(1);
    if (id === 'aegisLattice') p.shield = Math.min(p.shieldMax, p.shield + 1);
    addMessage(`${item.name} grafted.`, item.color, 1.4);
    saveNow();
  }

  function tryUseBoon() {
    if (state.boon.charges <= 0) return;
    if (state.mode === 'draft' && state.draft.active) {
      state.boon.charges -= 1;
      state.boon.flash = 1;
      state.draft.cards = rollDraftCards(state.draft.cards.length || 3);
      renderDraft();
      audio.blip('boon', 0.09);
      addMessage('Boon Moots rerolled the draft.', MOOTS.accent, 1.45);
      return;
    }
    if (state.mode !== 'play' || !state.player) return;
    state.boon.charges -= 1;
    state.boon.flash = 1;
    const cores = state.pickups.filter((p) => p.kind === 'core');
    if (cores.length) {
      for (const core of cores) core.itemId = randomAvailableItemId();
      addMessage('Boon Moots re-laced every loose core.', MOOTS.accent, 1.5);
    } else {
      const owned = Object.keys(state.player.items).filter((id) => state.player.items[id] > 0);
      if (owned.length) {
        const lose = pick(owned);
        state.player.items[lose] -= 1;
        const gain = randomAvailableItemId([lose]);
        grantItem(gain);
        addMessage(`${ITEM_BY_ID[lose].short} mutated into ${ITEM_BY_ID[gain].short}.`, MOOTS.accent, 1.7);
      } else {
        spawnItemCore(state.player.x + 34, state.player.y - 26);
        addMessage('Boon Moots coughed up a graft core.', MOOTS.accent, 1.45);
      }
    }
    audio.blip('boon', 0.09);
  }

  function randomAvailableItemId(exclude = []) {
    const pool = ITEM_POOL.filter((it) => !exclude.includes(it.id) && (!it.maxStacks || (state.player.items[it.id] || 0) < it.maxStacks));
    return weightedPick(pool.length ? pool : ITEM_POOL, (it) => it.weight || 4).id;
  }

  function firePlayerWeapon() {
    const p = state.player;
    const baseDelay = p.fireDelay;
    p.fireCd = baseDelay;
    p.volleyIndex += 1;
    const a = Math.atan2(p.aimY, p.aimX);
    const shots = [];
    const spread = 0.105;
    shots.push(a - spread, a + spread);
    for (let i = 0; i < itemCount('rearArray'); i += 1) shots.push(a + Math.PI + (i - (itemCount('rearArray') - 1) * 0.5) * 0.11);
    for (let i = 0; i < itemCount('sidecarLances'); i += 1) {
      const off = (i - (itemCount('sidecarLances') - 1) * 0.5) * 0.08;
      shots.push(a + Math.PI * 0.5 + off, a - Math.PI * 0.5 - off);
    }
    for (const ang of shots) spawnPlayerBullet(p.x + Math.cos(ang) * 24, p.y + Math.sin(ang) * 24, ang, 1);
    if (itemCount('echoChamber')) {
      const every = Math.max(2, 5 - itemCount('echoChamber'));
      if (p.volleyIndex % every === 0) {
        setTimeout(() => {
          if (state.mode === 'play' && state.player === p && !state.room.cleared) {
            for (const ang of shots.slice(0, 4 + itemCount('echoChamber'))) spawnPlayerBullet(p.x + Math.cos(ang) * 20, p.y + Math.sin(ang) * 20, ang, 0.72, true);
          }
        }, 150);
      }
    }
    audio.blip('shot', 0.025);
  }

  function spawnPlayerBullet(x, y, angle, scale = 1, echo = false) {
    const p = state.player;
    const caliber = itemCount('lunarCaliber');
    const critStacks = itemCount('moonShard');
    const crit = critStacks && Math.random() < 0.08 + critStacks * 0.055;
    const damage = p.damage * scale * (crit ? 1.9 : 1);
    const speed = 620 + caliber * 22;
    const r = (5.2 + caliber * 0.85 + (crit ? 1.8 : 0)) * Math.sqrt(scale);
    const b = {
      id: nextBulletId += 1,
      owner: 'player',
      x,
      y,
      px: x,
      py: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r,
      damage,
      color: crit ? '#fff6c8' : (echo ? '#e7f4ff' : MOOTS.accent),
      life: 1.05 + itemCount('hunterMycelia') * 0.08,
      pierce: itemCount('phaseDrill'),
      bounces: itemCount('ricochet'),
      homing: itemCount('hunterMycelia') * 3.2,
      source: 'moots',
      hit: new Set(),
      remove: false,
      echo,
      crit
    };
    state.bullets.push(b);
    if (state.bullets.length > PLAYER_BULLET_CAP) {
      const idx = state.bullets.findIndex((bb) => bb.owner === 'player');
      if (idx >= 0) state.bullets.splice(idx, 1);
    }
  }

  function spawnEnemyBullet(x, y, angle, speed, r, damage, color, life = 4.2) {
    const cap = state.mobile ? ENEMY_BULLET_CAP_MOBILE : ENEMY_BULLET_CAP_DESKTOP;
    if (state.bullets.filter((b) => b.owner === 'enemy').length > cap) return null;
    const b = {
      id: nextBulletId += 1,
      owner: 'enemy',
      x,
      y,
      px: x,
      py: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r,
      damage,
      color,
      life,
      pierce: 0,
      bounces: 0,
      remove: false
    };
    state.bullets.push(b);
    return b;
  }

  function fireAtPlayer(e, opts = {}) {
    const p = state.player;
    if (!p) return;
    const a = Math.atan2(p.y - e.y, p.x - e.x) + (opts.spread ? rand(opts.spread, -opts.spread) : 0);
    spawnEnemyBullet(e.x + Math.cos(a) * (e.r + 6), e.y + Math.sin(a) * (e.r + 6), a, opts.speed || 245, opts.r || 5.5, opts.damage || 1, opts.color || e.color, opts.life || 4.2);
  }

  function fireSpread(e, count, baseAngle, spread, speed, radius, damage, color) {
    for (let i = 0; i < count; i += 1) {
      const t = count === 1 ? 0 : (i / (count - 1) - 0.5);
      spawnEnemyBullet(e.x, e.y, baseAngle + t * spread, speed, radius, damage, color || e.color, 4.5);
    }
  }

  function fireRing(e, count, speed, radius, damage, color, offset = 0) {
    for (let i = 0; i < count; i += 1) {
      const a = offset + i / count * TAU;
      spawnEnemyBullet(e.x + Math.cos(a) * (e.r + 4), e.y + Math.sin(a) * (e.r + 4), a, speed, radius, damage, color || e.color, 4.8);
    }
  }

  function updateEnemies(dt) {
    const p = state.player;
    const room = state.room;
    for (const e of state.enemies) {
      e.age += dt;
      if (e.hitFlash > 0) e.hitFlash -= dt;
      if (e.contactCd > 0) e.contactCd -= dt;
      if (e.slow > 0) e.slow -= dt;
      e.shootCd -= dt;
      e.specialCd -= dt;
      const slowMul = enemySlowMultiplier(e);
      const aiSpeed = e.speed * slowMul;
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      const ux = dx / d;
      const uy = dy / d;

      switch (e.behavior) {
        case 'skitter': {
          const wig = Math.sin(e.age * 7 + e.id) * 0.65;
          accelerateEnemy(e, ux + -uy * wig, uy + ux * wig, aiSpeed, dt, 8);
          break;
        }
        case 'gunner': {
          const desired = 280;
          const sign = d < desired ? -1 : 1;
          const strafe = Math.sin(e.age * 2.6 + e.id) > 0 ? 1 : -1;
          accelerateEnemy(e, ux * sign + -uy * strafe * 0.72, uy * sign + ux * strafe * 0.72, aiSpeed, dt, 6);
          if (e.shootCd <= 0) {
            e.shootCd = 1.15 + Math.random() * 0.6;
            fireSpread(e, 3, Math.atan2(dy, dx), 0.22, 250 + state.room.roomNo * 2.5, 5.2, 1, e.color);
          }
          break;
        }
        case 'charger': {
          if (e.dash > 0) {
            e.dash -= dt;
            e.vx = e.dashX * 430;
            e.vy = e.dashY * 430;
          } else if (e.windup > 0) {
            e.windup -= dt;
            e.vx *= 0.82;
            e.vy *= 0.82;
            if (e.windup <= 0) {
              e.dash = 0.38;
              e.dashX = ux;
              e.dashY = uy;
              e.specialCd = 2.1 + Math.random() * 0.8;
            }
          } else {
            accelerateEnemy(e, ux, uy, aiSpeed, dt, 7);
            if (e.specialCd <= 0 && d < 520) e.windup = 0.48;
          }
          break;
        }
        case 'turret': {
          e.vx *= 0.88;
          e.vy *= 0.88;
          if (e.shootCd <= 0) {
            e.shootCd = 1.65 + Math.random() * 0.7;
            fireRing(e, 8 + Math.floor(state.room.roomNo / 8), 178 + state.room.roomNo * 1.5, 5.2, 1, e.color, e.age * 0.45);
          }
          break;
        }
        case 'brute': {
          accelerateEnemy(e, ux, uy, aiSpeed, dt, 4.5);
          if (e.specialCd <= 0 && d < 150) {
            e.specialCd = 3.2;
            fireRing(e, 12, 160, 6, 1, e.color, Math.random() * TAU);
            state.camera.shake = Math.max(state.camera.shake, 5);
          }
          break;
        }
        case 'sniper': {
          const desired = 420;
          const sign = d < desired ? -1 : 0.35;
          accelerateEnemy(e, ux * sign, uy * sign, aiSpeed, dt, 5);
          if (e.windup > 0) {
            e.windup -= dt;
            e.aimAngle = Math.atan2(dy, dx);
            if (e.windup <= 0) {
              spawnEnemyBullet(e.x, e.y, e.aimAngle, 430 + state.room.roomNo * 3, 6, 1, '#f0f5ff', 3.4);
              e.shootCd = 2.6 + Math.random() * 0.8;
            }
          } else if (e.shootCd <= 0 && d < 780) {
            e.windup = 0.72;
            e.aimAngle = Math.atan2(dy, dx);
          }
          break;
        }
        case 'hexer': {
          const desired = 320;
          const orbit = Math.sin(e.age * 1.8 + e.id) > 0 ? 1 : -1;
          accelerateEnemy(e, ux * (d > desired ? 0.55 : -0.35) + -uy * orbit, uy * (d > desired ? 0.55 : -0.35) + ux * orbit, aiSpeed, dt, 4.6);
          if (e.shootCd <= 0) {
            e.shootCd = 1.85;
            fireRing(e, 6, 190, 5.6, 1, e.color, e.age);
            fireAtPlayer(e, { speed: 220, r: 6, color: e.color });
          }
          break;
        }
        case 'myrmidon': {
          const strafe = Math.sin(e.age * 5 + e.id) > 0 ? 1 : -1;
          accelerateEnemy(e, ux * 0.9 + -uy * strafe * 0.55, uy * 0.9 + ux * strafe * 0.55, aiSpeed, dt, 7);
          if (e.shootCd <= 0 && d < 520) {
            e.shootCd = 1.05 + Math.random() * 0.4;
            fireSpread(e, 2, Math.atan2(dy, dx), 0.18, 282, 5.4, 1, e.color);
          }
          break;
        }
        case 'snapper': {
          if (e.dash > 0) {
            e.dash -= dt;
            e.vx = e.dashX * 520;
            e.vy = e.dashY * 520;
          } else {
            accelerateEnemy(e, ux, uy, aiSpeed, dt, 8.5);
            if (e.specialCd <= 0 && d < 380) {
              e.specialCd = 1.6;
              e.dash = 0.22;
              e.dashX = ux;
              e.dashY = uy;
            }
          }
          break;
        }
        case 'lantern': {
          accelerateEnemy(e, ux + Math.sin(e.age * 2) * 0.25, uy + Math.cos(e.age * 2.1) * 0.25, aiSpeed, dt, 4.2);
          if (d < e.r + p.r + 12 && e.specialCd <= 0) {
            e.hp = 0;
            killEnemy(e, { explosive: true });
          }
          break;
        }
        case 'manta': {
          const strafe = Math.sin(e.age * 1.2 + e.id) > 0 ? 1 : -1;
          accelerateEnemy(e, -uy * strafe + ux * 0.18, ux * strafe + uy * 0.18, aiSpeed, dt, 3.8);
          if (e.shootCd <= 0) {
            e.shootCd = 1.55;
            fireSpread(e, 5, Math.atan2(dy, dx), 0.75, 230, 5.5, 1, e.color);
          }
          break;
        }
        case 'gravityStone': {
          accelerateEnemy(e, ux * 0.35, uy * 0.35, aiSpeed, dt, 2.2);
          if (e.specialCd <= 0) {
            e.specialCd = 5.5;
            state.hazards.push({ kind: 'gravity', x: e.x, y: e.y, r: 170, age: 0, interval: 999, delay: 0.3, activeTime: 2.8, force: 140, damage: 0, color: e.color, life: 3.4 });
          }
          break;
        }
        case 'starThief': {
          const flee = d < 230 ? -1 : 0.8;
          const strafe = Math.cos(e.age * 4) > 0 ? 1 : -1;
          accelerateEnemy(e, ux * flee + -uy * strafe * 0.9, uy * flee + ux * strafe * 0.9, aiSpeed, dt, 7.5);
          if (e.shootCd <= 0) {
            e.shootCd = 0.95;
            fireAtPlayer(e, { speed: 310, r: 4.8, color: e.color, spread: 0.1 });
          }
          break;
        }
        case 'sunTouched': {
          accelerateEnemy(e, ux * 0.65 + Math.sin(e.age * 2) * 0.35, uy * 0.65 + Math.cos(e.age * 2.4) * 0.35, aiSpeed, dt, 5);
          if (e.shootCd <= 0) {
            e.shootCd = 1.35;
            fireRing(e, 5, 210, 5.6, 1, e.color, e.age * 2);
          }
          break;
        }
        default:
          break;
      }

      if (ENEMY_TYPES[e.typeId].boss) updateBossAI(e, dt, dx, dy, d, ux, uy, aiSpeed);
      moveEnemy(e, dt);
      e.x = clamp(e.x, room.wall + e.r, room.width - room.wall - e.r);
      e.y = clamp(e.y, room.wall + e.r, room.height - room.wall - e.r);

      if (dist2(e.x, e.y, p.x, p.y) < (e.r + p.r) * (e.r + p.r) && e.contactCd <= 0) {
        e.contactCd = 0.55;
        damagePlayer(1, e.x, e.y);
      }
    }
    state.enemies = state.enemies.filter((e) => !e.dead);
  }

  function updateBossAI(e, dt, dx, dy, d, ux, uy, aiSpeed) {
    const room = state.room;
    const p = state.player;
    if (!e.boss) return;
    const hpPct = e.hp / Math.max(1, e.maxHp);
    if (hpPct < 0.75 && !e.spawned75) { e.spawned75 = true; bossAdds(e, 3 + Math.floor(room.roomNo / 10)); }
    if (hpPct < 0.50 && !e.spawned50) { e.spawned50 = true; bossAdds(e, 4 + Math.floor(room.roomNo / 9)); }
    if (hpPct < 0.25 && !e.spawned25) { e.spawned25 = true; bossAdds(e, 5 + Math.floor(room.roomNo / 8)); }

    if (e.behavior === 'falseMoon') {
      accelerateEnemy(e, -uy * 0.9 + ux * 0.18, ux * 0.9 + uy * 0.18, aiSpeed, dt, 3.8);
      if (e.shootCd <= 0) { e.shootCd = 1.25; fireRing(e, 10, 210, 5.6, 1, e.color, e.age * 1.7); }
      if (e.specialCd <= 0) {
        e.specialCd = 4.2;
        e.x = clamp(p.x + rand(310, -310), room.wall + e.r, room.width - room.wall - e.r);
        e.y = clamp(p.y + rand(220, -220), room.wall + e.r, room.height - room.wall - e.r);
        state.camera.shake = Math.max(state.camera.shake, 6);
      }
    } else if (e.behavior === 'spiggot') {
      if (e.dash > 0) {
        e.dash -= dt;
        e.vx = e.dashX * 560;
        e.vy = e.dashY * 560;
      } else {
        accelerateEnemy(e, ux * 0.9 + -uy * Math.sin(e.age * 5), uy * 0.9 + ux * Math.sin(e.age * 5), aiSpeed, dt, 6);
        if (e.specialCd <= 0) {
          e.specialCd = 2.2;
          e.dash = 0.35;
          e.dashX = ux;
          e.dashY = uy;
          state.hazards.push({ kind: 'lane', x: e.x, y: e.y, w: 46, h: room.height - room.wall * 2, age: 0, interval: 999, delay: 0.25, activeTime: 0.75, damage: 1, color: e.color, life: 1.2 });
        }
      }
      if (e.shootCd <= 0) { e.shootCd = 0.92; fireSpread(e, 4, Math.atan2(dy, dx), 0.45, 260, 4.8, 1, e.color); }
    } else if (e.behavior === 'moonBear') {
      accelerateEnemy(e, ux, uy, aiSpeed, dt, 4);
      if (e.specialCd <= 0) {
        e.specialCd = 2.6;
        fireRing(e, 14, 175, 6.2, 1, e.color, e.age);
        state.camera.shake = Math.max(state.camera.shake, 8);
      }
      if (e.shootCd <= 0) { e.shootCd = 3.4; bossAdds(e, 2, ['skitter', 'snapper']); }
    } else if (e.behavior === 'warden') {
      accelerateEnemy(e, ux * 0.8, uy * 0.8, aiSpeed, dt, 3.2);
      if (e.shootCd <= 0) { e.shootCd = 1.4; fireSpread(e, 5, Math.atan2(dy, dx), 0.65, 250, 6, 1, e.color); }
      if (e.specialCd <= 0) {
        e.specialCd = 4.6;
        room.hazards.push({ kind: 'pulse', x: p.x, y: p.y, r: 96, age: 0, interval: 999, delay: 0.75, activeTime: 0.5, damage: 1, color: e.color, life: 1.5 });
      }
    } else if (e.behavior === 'archon') {
      accelerateEnemy(e, -uy * 0.65 + ux * 0.25, ux * 0.65 + uy * 0.25, aiSpeed, dt, 2.8);
      if (e.shootCd <= 0) { e.shootCd = 1.15; fireRing(e, 16, 190 + (1 - hpPct) * 75, 5.7, 1, e.color, e.age); }
      if (e.specialCd <= 0) {
        e.specialCd = 3.6;
        const vertical = Math.random() < 0.5;
        room.hazards.push({ kind: 'lane', x: vertical ? p.x : room.width * 0.5, y: vertical ? room.height * 0.5 : p.y, w: vertical ? 42 : room.width - room.wall * 2, h: vertical ? room.height - room.wall * 2 : 42, age: 0, interval: 999, delay: 0.85, activeTime: 0.52, damage: 1, color: e.color, life: 1.7 });
      }
    } else if (e.behavior === 'drownedSun') {
      accelerateEnemy(e, Math.sin(e.age * 0.7), Math.cos(e.age * 0.9), aiSpeed, dt, 2.5);
      if (e.shootCd <= 0) { e.shootCd = 1.0; fireRing(e, 12, 165, 5.5, 1, e.color, e.age * 0.8); fireAtPlayer(e, { speed: 285, r: 7, color: '#e9fcff' }); }
      if (e.specialCd <= 0) {
        e.specialCd = 4.0;
        for (let i = 0; i < 3; i += 1) room.hazards.push({ kind: 'fog', x: room.wall + Math.random() * (room.width - room.wall * 2), y: room.wall + Math.random() * (room.height - room.wall * 2), r: 115, age: 0, color: e.color, slow: 0.55, life: 5.5 });
      }
    } else if (e.behavior === 'firstWalker') {
      accelerateEnemy(e, ux * 0.55 + Math.sin(e.age) * 0.55, uy * 0.55 + Math.cos(e.age * 1.2) * 0.55, aiSpeed, dt, 3.0);
      if (e.shootCd <= 0) { e.shootCd = 1.25; fireSpread(e, 7, Math.atan2(dy, dx), 0.95, 245, 5.8, 1, e.color); }
      if (e.specialCd <= 0) {
        e.specialCd = 4.4;
        room.hazards.push({ kind: 'gravity', x: p.x, y: p.y, r: 190, age: 0, interval: 999, delay: 0.4, activeTime: 2.2, force: 235, damage: 0, color: e.color, life: 2.9 });
      }
    } else if (e.behavior === 'sunCore') {
      accelerateEnemy(e, Math.sin(e.age * 0.6), Math.cos(e.age * 0.55), aiSpeed, dt, 2.2);
      if (e.shootCd <= 0) { e.shootCd = 0.82; fireRing(e, 18, 205 + (1 - hpPct) * 85, 5.4, 1, e.color, e.age * 2.2); }
      if (e.specialCd <= 0) {
        e.specialCd = 3.4;
        for (let i = 0; i < 2; i += 1) room.hazards.push({ kind: 'pulse', x: room.wall + Math.random() * (room.width - room.wall * 2), y: room.wall + Math.random() * (room.height - room.wall * 2), r: 105, age: 0, interval: 999, delay: 0.65, activeTime: 0.55, damage: 1, color: e.color, life: 1.4 });
      }
    }
  }

  function bossAdds(e, count, forcedPool = null) {
    const pool = forcedPool || enemyPoolForRoom(state.room.roomNo, state.room.biome).filter((id) => !ENEMY_TYPES[id].boss && ENEMY_TYPES[id].cost <= 5);
    const positions = formationPositions(state.room, 'edgeRing', count, Math.random);
    for (const pos of positions) spawnEnemy(pick(pool), pos.x, pos.y, false);
    addMessage(`${e.display} opens a side wound.`, e.color, 1.25);
  }

  function accelerateEnemy(e, ax, ay, speed, dt, responsiveness) {
    const n = norm(ax, ay);
    const k = 1 - Math.exp(-dt * responsiveness);
    e.vx = lerp(e.vx, n.x * speed, k);
    e.vy = lerp(e.vy, n.y * speed, k);
  }

  function enemySlowMultiplier(e) {
    let mul = e.slow > 0 ? Math.min(1, 0.62 - itemCount('cryoRime') * 0.04) : 1;
    for (const h of state.hazards) {
      if ((h.kind === 'fog' || h.kind === 'lotus') && dist2(e.x, e.y, h.x, h.y) < h.r * h.r) mul = Math.min(mul, h.slow || 0.6);
    }
    return clamp(mul, 0.25, 1);
  }

  function moveEnemy(e, dt) {
    e.vx *= Math.pow(0.985, dt * 60);
    e.vy *= Math.pow(0.985, dt * 60);
    moveCircleWithObstacles(e, e.vx * dt, e.vy * dt);
  }

  function moveCircleWithObstacles(obj, dx, dy) {
    obj.x += dx;
    resolveObstacleCollisions(obj);
    obj.y += dy;
    resolveObstacleCollisions(obj);
  }

  function resolveObstacleCollisions(obj) {
    const room = state.room;
    if (!room) return;
    for (const ob of room.obstacles) {
      if (ob.breakable && ob.hp <= 0) continue;
      if (ob.kind === 'circle') {
        const dx = obj.x - ob.x;
        const dy = obj.y - ob.y;
        const d = Math.hypot(dx, dy) || 1;
        const min = obj.r + ob.r;
        if (d < min) {
          const push = min - d;
          obj.x += dx / d * push;
          obj.y += dy / d * push;
        }
      } else if (ob.kind === 'rect') {
        const nx = clamp(obj.x, ob.x, ob.x + ob.w);
        const ny = clamp(obj.y, ob.y, ob.y + ob.h);
        const dx = obj.x - nx;
        const dy = obj.y - ny;
        const d = Math.hypot(dx, dy) || 1;
        if (d < obj.r) {
          const push = obj.r - d;
          obj.x += dx / d * push;
          obj.y += dy / d * push;
        }
      }
    }
  }

  function updateBullets(dt) {
    const room = state.room;
    if (!room) return;
    for (const b of state.bullets) {
      b.life -= dt;
      if (b.life <= 0) b.remove = true;
      if (b.remove) continue;
      b.px = b.x;
      b.py = b.y;
      if (b.owner === 'player' && b.homing > 0) {
        const target = nearestEnemy(b.x, b.y, 360 + b.homing * 25);
        if (target) {
          const desired = Math.atan2(target.y - b.y, target.x - b.x);
          const cur = Math.atan2(b.vy, b.vx);
          const next = angleLerp(cur, desired, clamp(dt * b.homing, 0, 0.22));
          const sp = Math.hypot(b.vx, b.vy);
          b.vx = Math.cos(next) * sp;
          b.vy = Math.sin(next) * sp;
        }
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      if (b.x < room.wall + b.r || b.x > room.width - room.wall - b.r) {
        if (b.owner === 'player' && b.bounces > 0) { b.vx *= -1; b.bounces -= 1; b.x = clamp(b.x, room.wall + b.r, room.width - room.wall - b.r); }
        else b.remove = true;
      }
      if (b.y < room.wall + b.r || b.y > room.height - room.wall - b.r) {
        if (b.owner === 'player' && b.bounces > 0) { b.vy *= -1; b.bounces -= 1; b.y = clamp(b.y, room.wall + b.r, room.height - room.wall - b.r); }
        else b.remove = true;
      }
      if (b.remove) continue;

      const obHit = bulletObstacleHit(b);
      if (obHit) {
        if (b.owner === 'player') handlePlayerBulletImpact(b, b.x, b.y);
        if (b.owner === 'player' && b.bounces > 0) {
          bounceBulletFromObstacle(b, obHit);
          b.bounces -= 1;
        } else {
          b.remove = true;
        }
        continue;
      }

      if (b.owner === 'player') {
        for (const e of state.enemies) {
          if (e.dead || (b.hit && b.hit.has(e.id))) continue;
          if (dist2(b.x, b.y, e.x, e.y) <= (b.r + e.r) * (b.r + e.r)) {
            if (b.hit) b.hit.add(e.id);
            damageEnemy(e, b.damage, b);
            handlePlayerBulletImpact(b, e.x, e.y, e);
            b.pierce -= 1;
            if (b.pierce < 0) b.remove = true;
            break;
          }
        }
      } else {
        const p = state.player;
        if (p && dist2(b.x, b.y, p.x, p.y) <= (b.r + p.r) * (b.r + p.r)) {
          b.remove = true;
          damagePlayer(b.damage || 1, b.x, b.y);
        }
      }
    }
    state.bullets = state.bullets.filter((b) => !b.remove);
  }

  function bulletObstacleHit(b) {
    const room = state.room;
    for (const ob of room.obstacles) {
      if (ob.breakable && ob.hp <= 0) continue;
      let hit = false;
      if (ob.kind === 'circle') hit = dist2(b.x, b.y, ob.x, ob.y) < (b.r + ob.r) * (b.r + ob.r);
      else {
        const nx = clamp(b.x, ob.x, ob.x + ob.w);
        const ny = clamp(b.y, ob.y, ob.y + ob.h);
        hit = dist2(b.x, b.y, nx, ny) < b.r * b.r;
      }
      if (hit) {
        if (b.owner === 'player' && ob.breakable) {
          ob.hp -= b.damage;
          for (let i = 0; i < 4; i += 1) spawnParticle(b.x, b.y, ob.color, 0.35, 1.8, rand(100, 35));
          if (ob.hp <= 0) explodeObstacle(ob);
        }
        return ob;
      }
    }
    return null;
  }

  function bounceBulletFromObstacle(b, ob) {
    if (ob.kind === 'circle') {
      const n = norm(b.x - ob.x, b.y - ob.y);
      const dot = b.vx * n.x + b.vy * n.y;
      b.vx -= 2 * dot * n.x;
      b.vy -= 2 * dot * n.y;
      b.x += n.x * 8;
      b.y += n.y * 8;
    } else {
      const prevInsideX = b.px >= ob.x && b.px <= ob.x + ob.w;
      const prevInsideY = b.py >= ob.y && b.py <= ob.y + ob.h;
      if (!prevInsideX) b.vx *= -1;
      if (!prevInsideY) b.vy *= -1;
      if (prevInsideX && prevInsideY) b.vx *= -1;
    }
  }

  function explodeObstacle(ob) {
    ob.hp = -999;
    state.camera.shake = Math.max(state.camera.shake, 5);
    const x = ob.kind === 'rect' ? ob.x + ob.w * 0.5 : ob.x;
    const y = ob.kind === 'rect' ? ob.y + ob.h * 0.5 : ob.y;
    const radius = ob.volatile ? 95 : 55;
    for (const e of state.enemies) {
      if (!e.dead && dist2(e.x, e.y, x, y) < radius * radius) damageEnemy(e, ob.volatile ? 4.2 : 1.5, { source: 'shard' });
    }
    if (dist2(state.player.x, state.player.y, x, y) < radius * radius) damagePlayer(ob.volatile ? 1 : 0, x, y);
    for (let i = 0; i < 28; i += 1) spawnParticle(x, y, ob.color, 0.8, 3, rand(230, 60));
  }

  function handlePlayerBulletImpact(b, x, y, enemy = null) {
    if (itemCount('shrapnelChamber') && !b.fragment) {
      const count = 3 + itemCount('shrapnelChamber') * 2;
      for (let i = 0; i < count; i += 1) {
        const a = (i / count) * TAU + Math.random() * 0.12;
        const frag = {
          id: nextBulletId += 1,
          owner: 'player',
          x, y, px: x, py: y,
          vx: Math.cos(a) * 330,
          vy: Math.sin(a) * 330,
          r: 3.2,
          damage: b.damage * 0.24,
          color: ITEM_BY_ID.shrapnelChamber.color,
          life: 0.34,
          pierce: 0,
          bounces: 0,
          homing: 0,
          hit: new Set(enemy ? [enemy.id] : []),
          fragment: true,
          remove: false
        };
        state.bullets.push(frag);
      }
    }
    if (enemy && itemCount('staticLink')) {
      chainLightning(enemy, b.damage * (0.32 + itemCount('staticLink') * 0.08), itemCount('staticLink'));
    }
    for (let i = 0; i < 3; i += 1) spawnParticle(x, y, b.color, 0.25, 1.6, rand(70, 20));
  }

  function chainLightning(sourceEnemy, damage, jumps) {
    let current = sourceEnemy;
    const hit = new Set([sourceEnemy.id]);
    for (let j = 0; j < jumps; j += 1) {
      let best = null;
      let bestD = Infinity;
      const reach = 165 + itemCount('staticLink') * 34;
      for (const e of state.enemies) {
        if (e.dead || hit.has(e.id)) continue;
        const d = dist2(current.x, current.y, e.x, e.y);
        if (d < reach * reach && d < bestD) { best = e; bestD = d; }
      }
      if (!best) break;
      hit.add(best.id);
      spawnBeam(current.x, current.y, best.x, best.y, ITEM_BY_ID.staticLink.color);
      damageEnemy(best, damage, { source: 'staticLink' });
      current = best;
    }
  }

  function damageEnemy(e, amount, source = null) {
    if (e.dead) return;
    if (itemCount('executionBloom') && e.hp / e.maxHp < 0.42 + itemCount('executionBloom') * 0.04) amount *= 1 + itemCount('executionBloom') * 0.24;
    if (itemCount('cryoRime') && source && source.owner === 'player') e.slow = Math.max(e.slow, 1.4 + itemCount('cryoRime') * 0.28);
    e.hp -= amount;
    e.hitFlash = 0.12;
    if (e.hp <= 0) killEnemy(e, source);
    else audio.blip('hit', 0.018);
  }

  function killEnemy(e, source = null) {
    if (e.dead) return;
    e.dead = true;
    const run = state.run;
    const score = (e.score || 100) * run.combo * (e.elite ? 1.6 : 1);
    addScore(score, true);
    run.kills += 1;
    if (e.boss) run.bossesKilled += 1;
    state.player.killsSinceHeal += 1;
    state.camera.shake = Math.max(state.camera.shake, e.boss ? 13 : 3);
    audio.blip('kill', e.boss ? 0.075 : 0.035);
    const color = e.color || '#ffffff';
    for (let i = 0; i < (e.boss ? 95 : 18); i += 1) spawnParticle(e.x, e.y, color, e.boss ? 1.0 : 0.5, e.boss ? 4.2 : 2.2, rand(e.boss ? 330 : 170, 50));

    if (itemCount('splitWake') && source && source.owner === 'player') {
      const count = 4 + itemCount('splitWake') * 2;
      const base = Math.atan2(source.vy || state.player.aimY, source.vx || state.player.aimX);
      for (let i = 0; i < count; i += 1) {
        const a = base + (i / Math.max(1, count - 1) - 0.5) * (0.9 + itemCount('splitWake') * 0.12);
        spawnPlayerBullet(e.x, e.y, a, 0.42, true);
      }
    }
    if (itemCount('graveCharge') || e.typeId === 'lantern' || source && source.explosive) {
      const radius = 72 + itemCount('graveCharge') * 22 + (e.typeId === 'lantern' ? 24 : 0);
      for (const other of state.enemies) {
        if (!other.dead && other !== e && dist2(other.x, other.y, e.x, e.y) < radius * radius) damageEnemy(other, 2.1 + itemCount('graveCharge') * 0.75, { source: 'graveCharge' });
      }
      for (let i = 0; i < 18; i += 1) spawnParticle(e.x, e.y, ITEM_BY_ID.graveCharge.color, 0.65, 3, rand(240, 60));
    }
    if (itemCount('bloodTithe')) {
      const need = Math.max(4, 10 - itemCount('bloodTithe') * 2);
      if (state.player.killsSinceHeal >= need) {
        state.player.killsSinceHeal = 0;
        healPlayer(1);
        addMessage('Blood Tithe paid in meat.', ITEM_BY_ID.bloodTithe.color, 1.15);
      }
    }
    if (itemCount('siphonVane') && Math.random() < 0.035 + itemCount('siphonVane') * 0.035) spawnPickup('repair', e.x, e.y);
    if (Math.random() < 0.075) spawnPickup('star', e.x + rand(18, -18), e.y + rand(18, -18));
  }

  function addScore(amount, comboBump) {
    if (!state.run) return;
    state.run.score += Math.max(0, Math.round(amount));
    if (comboBump) {
      state.run.combo = clamp(state.run.combo + 0.08, 1, 5 + itemCount('moonShard') * 0.25);
      state.run.comboTimer = 3.0;
    }
    if (state.run.score > (state.save.highScore || 0)) state.save.highScore = Math.floor(state.run.score);
  }

  function updateCombo(dt) {
    const run = state.run;
    if (!run) return;
    if (run.comboTimer > 0) run.comboTimer -= dt;
    else run.combo = lerp(run.combo, 1, 1 - Math.exp(-dt * 0.55));
  }

  function damagePlayer(amount, sx, sy) {
    const p = state.player;
    if (!p || p.invuln > 0 || amount <= 0) return;
    p.perfect = false;
    if (p.shield > 0) {
      p.shield -= 1;
      p.shieldCd = 7.5;
      amount = Math.max(0, amount - 1);
      addMessage('Aegis cracked.', '#b6ddff', 0.9);
    }
    if (amount > 0) p.hp -= amount;
    p.invuln = 0.78;
    state.run.combo = Math.max(1, state.run.combo * 0.65);
    state.run.comboTimer = 0.5;
    state.camera.shake = Math.max(state.camera.shake, 10);
    audio.blip('hurt', 0.08);
    if (sx !== undefined) {
      const n = norm(p.x - sx, p.y - sy);
      p.vx += n.x * 230;
      p.vy += n.y * 230;
    }
    for (let i = 0; i < 26; i += 1) spawnParticle(p.x, p.y, '#ff7d9f', 0.55, 2.6, rand(230, 50));
    if (itemCount('spiteCore')) {
      const count = 8 + itemCount('spiteCore') * 5;
      for (let i = 0; i < count; i += 1) spawnPlayerBullet(p.x, p.y, i / count * TAU, 0.5, true);
    }
    if (p.hp <= 0) endRun();
  }

  function healPlayer(amount) {
    const p = state.player;
    if (!p) return;
    const before = p.hp;
    p.hp = Math.min(p.maxHp, p.hp + amount);
    if (p.hp > before) for (let i = 0; i < 12; i += 1) spawnParticle(p.x, p.y, '#9dffc7', 0.5, 2, rand(140, 30));
  }

  function updateHazards(dt) {
    const p = state.player;
    const room = state.room;
    for (const h of state.hazards) {
      h.age += dt;
      if (h.life !== undefined) h.life -= dt;
      if (h.hitCd > 0) h.hitCd -= dt;
      if (h.kind === 'pulse') {
        const phase = h.age % h.interval;
        const active = phase > h.delay && phase < h.delay + h.activeTime;
        if (active && h.hitCd <= 0 && dist2(p.x, p.y, h.x, h.y) < (h.r + p.r) * (h.r + p.r)) {
          h.hitCd = 0.5;
          damagePlayer(h.damage || 1, h.x, h.y);
        }
      } else if (h.kind === 'lane') {
        const phase = h.age % h.interval;
        const active = phase > h.delay && phase < h.delay + h.activeTime;
        if (active && h.hitCd <= 0 && circleRectHit(p.x, p.y, p.r, h.x - h.w * 0.5, h.y - h.h * 0.5, h.w, h.h)) {
          h.hitCd = 0.45;
          damagePlayer(h.damage || 1, h.x, h.y);
        }
      } else if (h.kind === 'gravity') {
        const phase = h.age % h.interval;
        const active = phase > h.delay && phase < h.delay + h.activeTime;
        if (active) {
          const pull = (obj, mult = 1) => {
            const dx = h.x - obj.x;
            const dy = h.y - obj.y;
            const d = Math.hypot(dx, dy) || 1;
            if (d < h.r) {
              const f = (1 - d / h.r) * (h.force || 160) * mult;
              obj.vx += dx / d * f * dt;
              obj.vy += dy / d * f * dt;
            }
          };
          pull(p, 1);
          for (const e of state.enemies) pull(e, 0.45);
        }
      } else if (h.kind === 'mine') {
        if (h.age > h.arm) {
          for (const e of state.enemies) {
            if (!e.dead && dist2(e.x, e.y, h.x, h.y) < (h.r + e.r) * (h.r + e.r)) {
              h.life = -1;
              damageEnemy(e, h.damage || 3, { source: 'mine' });
              for (const other of state.enemies) if (!other.dead && other !== e && dist2(other.x, other.y, h.x, h.y) < (h.r * 1.8) ** 2) damageEnemy(other, (h.damage || 3) * 0.55, { source: 'mine' });
              for (let i = 0; i < 20; i += 1) spawnParticle(h.x, h.y, h.color, 0.65, 2.6, rand(210, 50));
              break;
            }
          }
        }
      }
    }
    state.hazards = state.hazards.filter((h) => h.life === undefined || h.life > 0);
    if (room) room.hazards = state.hazards;
  }

  function circleRectHit(cx, cy, cr, x, y, w, h) {
    const nx = clamp(cx, x, x + w);
    const ny = clamp(cy, y, y + h);
    return dist2(cx, cy, nx, ny) < cr * cr;
  }

  function updateDrones(dt) {
    const p = state.player;
    if (!p) return;
    for (let i = 0; i < state.drones.length; i += 1) {
      const d = state.drones[i];
      d.angle += dt * (1.35 + i * 0.12);
      d.x = p.x + Math.cos(d.angle + i * TAU / Math.max(1, state.drones.length)) * 56;
      d.y = p.y + Math.sin(d.angle + i * TAU / Math.max(1, state.drones.length)) * 56;
      d.fireCd -= dt;
      if (d.fireCd <= 0 && !state.room.cleared) {
        const target = nearestEnemy(d.x, d.y, 560);
        if (target) {
          d.fireCd = 0.72;
          const a = Math.atan2(target.y - d.y, target.x - d.x);
          spawnPlayerBullet(d.x, d.y, a, 0.48, true);
        }
      }
    }
  }

  function updateOrbitals(dt) {
    const p = state.player;
    const count = itemCount('orbitalHalo');
    if (!count) return;
    const haloCount = Math.min(7, count + 1);
    for (let i = 0; i < haloCount; i += 1) {
      const a = state.time * (2.1 + count * 0.12) + i / haloCount * TAU;
      const x = p.x + Math.cos(a) * (56 + count * 4);
      const y = p.y + Math.sin(a) * (56 + count * 4);
      const r = 9 + count;
      for (const e of state.enemies) {
        if (!e.dead && dist2(x, y, e.x, e.y) < (r + e.r) * (r + e.r)) damageEnemy(e, dt * (3.0 + count * 0.75), { source: 'orbitalHalo' });
      }
      for (const b of state.bullets) {
        if (b.owner === 'enemy' && dist2(x, y, b.x, b.y) < (r + b.r) * (r + b.r)) {
          b.remove = true;
          spawnParticle(b.x, b.y, ITEM_BY_ID.orbitalHalo.color, 0.25, 1.5, rand(90, 20));
        }
      }
    }
  }

  function spawnPickup(kind, x, y, extra = {}) {
    const pickup = Object.assign({ kind, x, y, vx: rand(90, -90), vy: rand(90, -90), r: kind === 'core' ? 15 : 10, age: 0, life: 22, color: kind === 'repair' ? '#9dffc7' : kind === 'star' ? '#ffe28a' : MOOTS.accent }, extra);
    state.pickups.push(pickup);
  }

  function spawnItemCore(x, y) {
    spawnPickup('core', x, y, { itemId: randomAvailableItemId(), life: 28 });
    addMessage('Loose graft core on the floor.', MOOTS.accent, 1.25);
  }

  function updatePickups(dt) {
    const p = state.player;
    const magnet = 90 + itemCount('gravityWell') * 95;
    for (const pk of state.pickups) {
      pk.age += dt;
      pk.life -= dt;
      pk.vx *= Math.pow(0.9, dt * 60);
      pk.vy *= Math.pow(0.9, dt * 60);
      const dx = p.x - pk.x;
      const dy = p.y - pk.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < magnet) {
        const f = (1 - d / magnet) * (360 + itemCount('gravityWell') * 100);
        pk.vx += dx / d * f * dt;
        pk.vy += dy / d * f * dt;
      }
      pk.x += pk.vx * dt;
      pk.y += pk.vy * dt;
      if (d < p.r + pk.r + 5) {
        collectPickup(pk);
        pk.life = -1;
      }
    }
    state.pickups = state.pickups.filter((pk) => pk.life > 0);
  }

  function collectPickup(pk) {
    if (pk.kind === 'repair') {
      healPlayer(1);
      audio.blip('draft', 0.04);
    } else if (pk.kind === 'star') {
      state.run.stars += 1;
      addScore(55 * state.run.combo, false);
      audio.blip('draft', 0.025);
    } else if (pk.kind === 'core') {
      grantItem(pk.itemId || randomAvailableItemId());
      audio.blip('boon', 0.06);
    }
  }

  function nearestEnemy(x, y, radius = Infinity) {
    let best = null;
    let bestD = radius * radius;
    for (const e of state.enemies) {
      if (e.dead) continue;
      const d = dist2(x, y, e.x, e.y);
      if (d < bestD) { best = e; bestD = d; }
    }
    return best;
  }

  function spawnParticle(x, y, color, life = 0.5, size = 2, speed = 80) {
    const cap = state.mobile ? PARTICLE_CAP_MOBILE : PARTICLE_CAP_DESKTOP;
    if (state.particles.length > cap) state.particles.splice(0, state.particles.length - cap + 1);
    const a = Math.random() * TAU;
    const s = Math.random() * speed;
    state.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, color, life, max: life, size: Math.random() * size + 1 });
  }

  function spawnBeam(x1, y1, x2, y2, color) {
    state.particles.push({ beam: true, x1, y1, x2, y2, color, life: 0.12, max: 0.12, size: 2 });
  }

  function updateParticles(dt) {
    for (const p of state.particles) {
      p.life -= dt;
      if (!p.beam) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= Math.pow(0.88, dt * 60);
        p.vy *= Math.pow(0.88, dt * 60);
      }
    }
    state.particles = state.particles.filter((p) => p.life > 0);
  }

  function draw() {
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    ctx.clearRect(0, 0, view.w, view.h);
    const room = state.room || { width: BASE_W, height: BASE_H, biome: BIOMES[0], obstacles: [], hazards: [] };
    computeView();
    const shake = state.camera.shake > 0 ? state.camera.shake : 0;
    if (state.camera.shake > 0) state.camera.shake *= 0.86;
    state.camera.sx = (Math.random() - 0.5) * shake;
    state.camera.sy = (Math.random() - 0.5) * shake;

    ctx.fillStyle = '#020207';
    ctx.fillRect(0, 0, view.w, view.h);
    ctx.save();
    ctx.translate(view.ox + state.camera.sx, view.oy + state.camera.sy);
    ctx.scale(view.scale, view.scale);
    drawRoom(room);
    drawHazards(room);
    drawPickups();
    drawBullets('enemy');
    drawEnemies();
    drawDrones();
    drawPlayer();
    drawBullets('player');
    drawParticles();
    drawRoomOverlay(room);
    ctx.restore();
    drawTouchSticks();
    drawTransition();
  }

  function drawRoom(room) {
    const bg = ctx.createLinearGradient(0, 0, 0, room.height);
    bg.addColorStop(0, room.biome.top);
    bg.addColorStop(1, room.biome.bottom);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, room.width, room.height);

    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = room.biome.accent;
    ctx.lineWidth = 1;
    const step = room.bossRoom ? 74 : 68;
    for (let x = room.wall; x <= room.width - room.wall; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, room.wall);
      ctx.lineTo(x, room.height - room.wall);
      ctx.stroke();
    }
    for (let y = room.wall; y <= room.height - room.wall; y += step) {
      ctx.beginPath();
      ctx.moveTo(room.wall, y);
      ctx.lineTo(room.width - room.wall, y);
      ctx.stroke();
    }
    ctx.restore();

    const glow = ctx.createRadialGradient(room.width * 0.5, room.height * 0.5, 60, room.width * 0.5, room.height * 0.5, Math.max(room.width, room.height) * 0.68);
    glow.addColorStop(0, cssAlpha(room.biome.accent, 0.14));
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, room.width, room.height);

    ctx.save();
    ctx.lineWidth = room.wall;
    ctx.strokeStyle = 'rgba(0,0,0,0.58)';
    ctx.strokeRect(room.wall * 0.5, room.wall * 0.5, room.width - room.wall, room.height - room.wall);
    ctx.lineWidth = 3;
    ctx.strokeStyle = cssAlpha(room.biome.accent2, 0.55);
    ctx.strokeRect(room.wall, room.wall, room.width - room.wall * 2, room.height - room.wall * 2);
    ctx.restore();

    for (const ob of room.obstacles) drawObstacle(ob, room.biome);
  }

  function drawObstacle(ob, biome) {
    if (ob.breakable && ob.hp <= 0) return;
    const alpha = ob.breakable ? clamp(0.35 + ob.hp / ob.maxHp * 0.45, 0.2, 0.85) : 0.72;
    ctx.save();
    ctx.shadowBlur = ob.breakable ? 18 : 10;
    ctx.shadowColor = cssAlpha(ob.color || biome.accent, 0.36);
    ctx.fillStyle = cssAlpha(ob.color || biome.accent, alpha * 0.35);
    ctx.strokeStyle = cssAlpha(biome.accent2, ob.breakable ? 0.48 : 0.28);
    ctx.lineWidth = ob.breakable ? 2 : 1.5;
    if (ob.kind === 'circle') {
      ctx.beginPath();
      ctx.arc(ob.x, ob.y, ob.r, 0, TAU);
      ctx.fill();
      ctx.stroke();
      if (ob.volatile) {
        ctx.beginPath();
        ctx.arc(ob.x, ob.y, ob.r * 0.55, 0, TAU);
        ctx.stroke();
      }
    } else {
      roundRectPath(ctx, ob.x, ob.y, ob.w, ob.h, ob.r || 12);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawHazards(room) {
    for (const h of state.hazards) {
      ctx.save();
      const color = h.color || room.biome.accent;
      if (h.kind === 'pulse') {
        const phase = h.age % h.interval;
        const telegraph = phase < h.delay;
        const active = phase >= h.delay && phase < h.delay + h.activeTime;
        const a = telegraph ? clamp(phase / h.delay, 0, 1) : active ? 1 : 0.12;
        ctx.globalAlpha = active ? 0.45 : 0.18 + a * 0.18;
        ctx.fillStyle = cssAlpha(color, active ? 0.32 : 0.13);
        ctx.strokeStyle = cssAlpha(color, active ? 0.86 : 0.45);
        ctx.lineWidth = active ? 4 : 2;
        ctx.beginPath();
        ctx.arc(h.x, h.y, h.r * (telegraph ? 0.45 + a * 0.55 : 1), 0, TAU);
        ctx.fill();
        ctx.stroke();
      } else if (h.kind === 'lane') {
        const phase = h.age % h.interval;
        const telegraph = phase < h.delay;
        const active = phase >= h.delay && phase < h.delay + h.activeTime;
        ctx.globalAlpha = active ? 0.55 : 0.16 + (telegraph ? phase / h.delay * 0.18 : 0);
        ctx.fillStyle = cssAlpha(color, active ? 0.38 : 0.16);
        roundRectPath(ctx, h.x - h.w * 0.5, h.y - h.h * 0.5, h.w, h.h, 12);
        ctx.fill();
        ctx.strokeStyle = cssAlpha(color, active ? 0.95 : 0.42);
        ctx.lineWidth = active ? 4 : 2;
        ctx.stroke();
      } else if (h.kind === 'fog' || h.kind === 'lotus') {
        const g = ctx.createRadialGradient(h.x, h.y, 0, h.x, h.y, h.r);
        g.addColorStop(0, cssAlpha(color, h.kind === 'lotus' ? 0.22 : 0.18));
        g.addColorStop(1, cssAlpha(color, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(h.x, h.y, h.r, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = cssAlpha(color, h.kind === 'lotus' ? 0.38 : 0.22);
        ctx.stroke();
      } else if (h.kind === 'gravity') {
        const phase = h.age % h.interval;
        const active = phase > h.delay && phase < h.delay + h.activeTime;
        const pulse = 0.5 + Math.sin(h.age * 6) * 0.5;
        ctx.fillStyle = cssAlpha(color, active ? 0.16 + pulse * 0.08 : 0.06);
        ctx.strokeStyle = cssAlpha(color, active ? 0.55 : 0.25);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(h.x, h.y, h.r, 0, TAU);
        ctx.fill();
        ctx.stroke();
      } else if (h.kind === 'mine') {
        ctx.globalAlpha = h.age < h.arm ? 0.35 : 0.85;
        ctx.fillStyle = cssAlpha(color, 0.34);
        ctx.strokeStyle = cssAlpha(color, 0.85);
        ctx.beginPath();
        ctx.arc(h.x, h.y, h.r * (h.age < h.arm ? 0.55 : 1), 0, TAU);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function drawPickups() {
    for (const p of state.pickups) {
      ctx.save();
      const bob = Math.sin(state.time * 5 + p.age) * 3;
      ctx.translate(p.x, p.y + bob);
      ctx.shadowBlur = 18;
      ctx.shadowColor = cssAlpha(p.color, 0.6);
      ctx.fillStyle = cssAlpha(p.color, 0.8);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      if (p.kind === 'core') {
        ctx.rotate(state.time * 1.7);
        ctx.beginPath();
        for (let i = 0; i < 6; i += 1) {
          const a = i / 6 * TAU;
          const rr = i % 2 ? p.r * 0.65 : p.r;
          const x = Math.cos(a) * rr;
          const y = Math.sin(a) * rr;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.rotate(-state.time * 1.7);
        const item = ITEM_BY_ID[p.itemId];
        if (item) {
          ctx.font = '700 10px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillStyle = '#fff';
          ctx.shadowBlur = 8;
          ctx.fillText(item.short, 0, -22);
        }
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.r, 0, TAU);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function drawEnemies() {
    for (const e of state.enemies) {
      ctx.save();
      ctx.translate(e.x, e.y);
      const pulse = e.hitFlash > 0 ? 1 : 0;
      ctx.shadowBlur = e.boss ? 34 : 18;
      ctx.shadowColor = cssAlpha(e.color, e.boss ? 0.75 : 0.45);
      ctx.fillStyle = pulse ? '#ffffff' : cssAlpha(e.color, e.boss ? 0.72 : 0.66);
      ctx.strokeStyle = e.elite ? '#ffffff' : cssAlpha('#ffffff', e.boss ? 0.65 : 0.28);
      ctx.lineWidth = e.boss ? 3 : 1.5;
      if (e.windup > 0) {
        ctx.strokeStyle = '#ffffff';
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.arc(0, 0, e.r + 10 * Math.sin(state.time * 28), 0, TAU);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      if (e.behavior === 'manta') {
        ctx.beginPath();
        ctx.ellipse(0, 0, e.r * 1.45, e.r * 0.72, Math.sin(e.age) * 0.4, 0, TAU);
      } else if (e.behavior === 'sniper') {
        ctx.beginPath();
        ctx.moveTo(0, -e.r);
        ctx.lineTo(e.r * 0.75, e.r);
        ctx.lineTo(-e.r * 0.75, e.r);
        ctx.closePath();
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, e.r, 0, TAU);
      }
      ctx.fill();
      ctx.stroke();

      if (e.boss || e.maxHp > 9) {
        const w = e.boss ? e.r * 2.1 : e.r * 1.7;
        const hp = clamp(e.hp / e.maxHp, 0, 1);
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(0,0,0,.48)';
        roundRectPath(ctx, -w * 0.5, -e.r - 18, w, 5, 3);
        ctx.fill();
        ctx.fillStyle = e.color;
        roundRectPath(ctx, -w * 0.5, -e.r - 18, w * hp, 5, 3);
        ctx.fill();
      }
      if (e.windup > 0 && e.aimAngle !== undefined) {
        ctx.rotate(e.aimAngle - Math.atan2(0, 1));
      }
      ctx.restore();

      if (e.behavior === 'sniper' && e.windup > 0 && e.aimAngle !== undefined) {
        ctx.save();
        ctx.strokeStyle = cssAlpha('#f0f5ff', 0.36 + 0.25 * (1 - e.windup / 0.72));
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        ctx.lineTo(e.x + Math.cos(e.aimAngle) * 900, e.y + Math.sin(e.aimAngle) * 900);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  function drawDrones() {
    for (const d of state.drones) {
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.shadowBlur = 14;
      ctx.shadowColor = cssAlpha(ITEM_BY_ID.scavengerDrone.color, 0.55);
      ctx.fillStyle = cssAlpha(ITEM_BY_ID.scavengerDrone.color, 0.72);
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawPlayer() {
    const p = state.player;
    if (!p) return;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    const inv = p.invuln > 0 && Math.sin(state.time * 28) > 0;
    ctx.globalAlpha = inv ? 0.55 : 1;
    ctx.shadowBlur = 24;
    ctx.shadowColor = cssAlpha(MOOTS.accent, 0.72);
    ctx.fillStyle = cssAlpha(MOOTS.accent, 0.72);
    ctx.strokeStyle = cssAlpha(MOOTS.accent2, 0.92);
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(0, 0, 16, 20, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#070812';
    ctx.beginPath();
    ctx.arc(7, -6, 4, 0, TAU);
    ctx.arc(7, 6, 4, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = cssAlpha(MOOTS.accent2, 0.65);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-10, -13);
    ctx.lineTo(9, 11);
    ctx.moveTo(-10, 13);
    ctx.lineTo(9, -11);
    ctx.stroke();
    ctx.fillStyle = cssAlpha(MOOTS.accent2, 0.95);
    ctx.beginPath();
    ctx.moveTo(15, -7);
    ctx.lineTo(29, 0);
    ctx.lineTo(15, 7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    const haloCount = itemCount('orbitalHalo') ? Math.min(7, itemCount('orbitalHalo') + 1) : 0;
    for (let i = 0; i < haloCount; i += 1) {
      const a = state.time * (2.1 + itemCount('orbitalHalo') * 0.12) + i / haloCount * TAU;
      const x = p.x + Math.cos(a) * (56 + itemCount('orbitalHalo') * 4);
      const y = p.y + Math.sin(a) * (56 + itemCount('orbitalHalo') * 4);
      ctx.save();
      ctx.shadowBlur = 16;
      ctx.shadowColor = cssAlpha(ITEM_BY_ID.orbitalHalo.color, 0.7);
      ctx.fillStyle = cssAlpha(ITEM_BY_ID.orbitalHalo.color, 0.78);
      ctx.beginPath();
      ctx.arc(x, y, 8 + itemCount('orbitalHalo'), 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawBullets(owner) {
    for (const b of state.bullets) {
      if (b.owner !== owner) continue;
      ctx.save();
      ctx.shadowBlur = owner === 'player' ? 14 : 10;
      ctx.shadowColor = cssAlpha(b.color, 0.75);
      ctx.fillStyle = cssAlpha(b.color, owner === 'player' ? 0.85 : 0.78);
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawParticles() {
    for (const p of state.particles) {
      const a = clamp(p.life / p.max, 0, 1);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.shadowBlur = p.beam ? 16 : 8;
      ctx.shadowColor = p.color;
      ctx.strokeStyle = p.color;
      ctx.fillStyle = p.color;
      if (p.beam) {
        ctx.lineWidth = p.size;
        ctx.beginPath();
        ctx.moveTo(p.x1, p.y1);
        ctx.lineTo(p.x2, p.y2);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1.2 - a * 0.2), 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawRoomOverlay(room) {
    if (room.introTimer > 0) {
      ctx.save();
      const a = clamp(room.introTimer / 1.4, 0, 1);
      ctx.globalAlpha = Math.min(1, a * 1.2);
      ctx.fillStyle = 'rgba(0,0,0,.35)';
      roundRectPath(ctx, room.width * 0.5 - 250, 82, 500, 68, 22);
      ctx.fill();
      ctx.strokeStyle = cssAlpha(room.biome.accent, 0.55);
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 24px system-ui, sans-serif';
      ctx.fillText(room.bossRoom ? room.name : `Room ${room.roomNo}`, room.width * 0.5, 110);
      ctx.fillStyle = cssAlpha(room.biome.accent2, 0.9);
      ctx.font = '700 13px system-ui, sans-serif';
      ctx.fillText(room.bossRoom ? room.biome.name : room.name, room.width * 0.5, 134);
      ctx.restore();
    }
    if (room.cleared && room.clearTimer < 1.0) {
      ctx.save();
      ctx.globalAlpha = 1 - room.clearTimer;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      ctx.shadowBlur = 22;
      ctx.shadowColor = room.biome.accent;
      ctx.font = '900 54px system-ui, sans-serif';
      ctx.fillText('ROOM CLEAR', room.width * 0.5, room.height * 0.5 - 12);
      ctx.font = '700 16px system-ui, sans-serif';
      ctx.fillStyle = cssAlpha(room.biome.accent2, 0.92);
      ctx.fillText(state.player.perfect ? 'Perfect, somehow. Disgusting.' : 'The rectangle accepts your violence.', room.width * 0.5, room.height * 0.5 + 28);
      ctx.restore();
    }
  }

  function drawTransition() {
    const tr = state.transition;
    if (!tr.active && tr.alpha <= 0) return;
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    ctx.fillStyle = `rgba(2,2,7,${clamp(tr.alpha, 0, 1)})`;
    ctx.fillRect(0, 0, view.w, view.h);
  }

  function drawTouchSticks() {
    if (!input.usingTouch) return;
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    const drawStick = (touch, vx, vy, color) => {
      if (!touch) return;
      ctx.save();
      ctx.globalAlpha = 0.38;
      ctx.strokeStyle = color;
      ctx.fillStyle = cssAlpha(color, 0.12);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(touch.sx, touch.sy, 58, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.globalAlpha = 0.64;
      ctx.beginPath();
      ctx.arc(touch.sx + vx * 42, touch.sy + vy * 42, 20, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    };
    drawStick(input.leftTouch, input.touchMove.x, input.touchMove.y, '#89e7ff');
    drawStick(input.rightTouch, input.touchAim.x, input.touchAim.y, '#f3dcff');
  }

  function updateHud(force = false) {
    state.hudTick -= state.dt || 0;
    if (!force && state.hudTick > 0) return;
    state.hudTick = 0.08;
    const p = state.player;
    const run = state.run;
    const room = state.room;
    if (!p || !run || !room) {
      els.bestText.textContent = `Best ${fmt(state.save.highScore || 0)}`;
      return;
    }
    els.roomKicker.textContent = `Room ${room.roomNo}${room.bossRoom ? ' / Boss' : ''}`;
    els.roomTitle.textContent = room.bossRoom ? room.name : room.biome.name;
    els.roomMeta.innerHTML = `<span class="pill">${room.archetype.name}</span><span class="pill">${room.biome.mechanic}</span><span class="pill">${state.enemies.length} hostiles</span>`;
    els.scoreText.textContent = fmt(run.score);
    els.comboText.textContent = `x${run.combo.toFixed(2)} combo`;
    els.bestText.textContent = `Best ${fmt(Math.max(state.save.highScore || 0, run.score || 0))}`;
    els.hpBar.innerHTML = '';
    for (let i = 0; i < p.maxHp; i += 1) {
      const node = document.createElement('span');
      node.className = `hp ${i < Math.ceil(p.hp) ? 'full' : ''}`;
      els.hpBar.appendChild(node);
    }
    for (let i = 0; i < p.shieldMax; i += 1) {
      const node = document.createElement('span');
      node.className = `hp shield ${i < p.shield ? 'full' : ''}`;
      els.hpBar.appendChild(node);
    }
    els.boonText.textContent = state.boon.charges > 0 ? 'READY' : `Lacing ${state.boon.progress}/${state.boon.need}`;
    els.boonText.style.color = state.boon.charges > 0 || state.boon.flash > 0 ? MOOTS.accent : '';
    els.boonButton.disabled = state.boon.charges <= 0 || (state.mode !== 'play' && state.mode !== 'draft');
    els.boonButton.textContent = state.boon.charges > 0 ? 'Boon READY' : `Boon ${state.boon.progress}/${state.boon.need}`;
    els.statText.innerHTML = `<span class="pill">Kills ${run.kills}</span><span class="pill">Stars ${run.stars}</span><span class="pill">Cleared ${run.roomsCleared}</span>`;
    const items = Object.entries(p.items).filter(([, n]) => n > 0).sort((a, b) => ITEM_BY_ID[a[0]].short.localeCompare(ITEM_BY_ID[b[0]].short));
    els.graftText.innerHTML = items.length ? items.slice(0, 11).map(([id, n]) => `<span class="graft" style="border-color:${cssAlpha(ITEM_BY_ID[id].color, .45)}">${ITEM_BY_ID[id].short}${n > 1 ? `×${n}` : ''}</span>`).join('') : '<span class="graft">no grafts yet</span>';
  }

  function bindEvents() {
    window.addEventListener('resize', resize);
    window.addEventListener('keydown', (ev) => {
      input.keys.add(ev.code);
      if (['Space', 'KeyE'].includes(ev.code)) {
        ev.preventDefault();
        tryUseBoon();
      }
      if (ev.code === 'KeyM') audio.toggle();
      if (state.mode === 'title' && (ev.code === 'Enter' || ev.code === 'Space')) startRun();
    });
    window.addEventListener('keyup', (ev) => input.keys.delete(ev.code));
    window.addEventListener('blur', () => {
      input.keys.clear();
      input.mouse.down = false;
      input.leftTouch = null;
      input.rightTouch = null;
    });
    canvas.addEventListener('pointerdown', onPointerDown, { passive: false });
    canvas.addEventListener('pointermove', onPointerMove, { passive: false });
    canvas.addEventListener('pointerup', onPointerUp, { passive: false });
    canvas.addEventListener('pointercancel', onPointerUp, { passive: false });
    canvas.addEventListener('contextmenu', (ev) => ev.preventDefault());
    els.start.addEventListener('click', startRun);
    els.restart.addEventListener('click', startRun);
    els.home.addEventListener('click', returnTitle);
    els.boonButton.addEventListener('click', tryUseBoon);
    els.sfxButton.addEventListener('click', () => audio.toggle());
    els.titleSfxButton.addEventListener('click', () => audio.toggle());
  }

  function onPointerDown(ev) {
    ev.preventDefault();
    canvas.setPointerCapture?.(ev.pointerId);
    audio.unlock();
    if (ev.pointerType === 'mouse') {
      input.usingTouch = false;
      input.mouse.down = true;
      input.mouse.active = true;
      const w = screenToWorld(ev.clientX, ev.clientY);
      input.mouse.x = w.x;
      input.mouse.y = w.y;
      return;
    }
    input.usingTouch = true;
    const touch = { id: ev.pointerId, sx: ev.clientX, sy: ev.clientY, x: ev.clientX, y: ev.clientY };
    if (ev.clientX < view.w * 0.5 && !input.leftTouch) input.leftTouch = touch;
    else input.rightTouch = touch;
    updateTouchVectors();
  }

  function onPointerMove(ev) {
    ev.preventDefault();
    if (ev.pointerType === 'mouse') {
      const w = screenToWorld(ev.clientX, ev.clientY);
      input.mouse.x = w.x;
      input.mouse.y = w.y;
      input.mouse.active = true;
      return;
    }
    const update = (t) => { if (t && t.id === ev.pointerId) { t.x = ev.clientX; t.y = ev.clientY; } };
    update(input.leftTouch);
    update(input.rightTouch);
    updateTouchVectors();
  }

  function onPointerUp(ev) {
    ev.preventDefault();
    if (ev.pointerType === 'mouse') {
      input.mouse.down = false;
      return;
    }
    if (input.leftTouch && input.leftTouch.id === ev.pointerId) input.leftTouch = null;
    if (input.rightTouch && input.rightTouch.id === ev.pointerId) input.rightTouch = null;
    updateTouchVectors();
  }

  function updateTouchVectors() {
    if (input.leftTouch) {
      const dx = input.leftTouch.x - input.leftTouch.sx;
      const dy = input.leftTouch.y - input.leftTouch.sy;
      const n = norm(dx, dy);
      const mag = clamp(n.l / 58, 0, 1);
      input.touchMove.x = n.l > 7 ? n.x * mag : 0;
      input.touchMove.y = n.l > 7 ? n.y * mag : 0;
    } else {
      input.touchMove.x = 0;
      input.touchMove.y = 0;
    }
    if (input.rightTouch) {
      const dx = input.rightTouch.x - input.rightTouch.sx;
      const dy = input.rightTouch.y - input.rightTouch.sy;
      const n = norm(dx, dy);
      const mag = clamp(n.l / 55, 0, 1);
      const active = n.l > 13;
      const smooth = 0.24;
      if (active) {
        input.touchAim.x = lerp(input.touchAim.x, n.x, smooth);
        input.touchAim.y = lerp(input.touchAim.y, n.y, smooth);
        const nn = norm(input.touchAim.x, input.touchAim.y);
        input.touchAim.x = nn.x;
        input.touchAim.y = nn.y;
      }
      input.touchAim.active = active;
      input.touchAim.fire = active && mag > 0.24;
    } else {
      input.touchAim.fire = false;
      input.touchAim.active = false;
    }
  }

  function loop(ts) {
    if (!state.lastTs) state.lastTs = ts;
    const dt = clamp((ts - state.lastTs) / 1000, 0, 0.033);
    state.lastTs = ts;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  function init() {
    bindEvents();
    resize();
    updateSfxButtons();
    updateHud(true);
    requestAnimationFrame(loop);
  }

  init();
})();
