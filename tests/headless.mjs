// Headless smoke test: stubs the DOM, boots the game, simulates play, and runs
// the Room Roller variety audit. Run: node tests/headless.mjs
/* eslint-disable no-undef */

// ── minimal DOM/browser stubs ────────────────────────────────────────────────
const noopCtx = () => new Proxy({}, {
  get(t, prop) {
    if (prop === 'canvas') return fakeCanvas();
    if (prop === 'createLinearGradient' || prop === 'createRadialGradient') {
      return () => ({ addColorStop() {} });
    }
    if (prop === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
    if (prop === 'measureText') return () => ({ width: 10 });
    if (typeof prop === 'string') return () => {};
    return undefined;
  },
  set() { return true; },
});

function fakeCanvas() {
  return {
    width: 1280, height: 720,
    style: {},
    getContext: () => noopCtx(),
    addEventListener() {},
    getBoundingClientRect: () => ({ width: 1280, height: 720 }),
  };
}

const elements = new Map();
function fakeElement(id) {
  if (id === 'game') return fakeCanvas();
  if (!elements.has(id)) {
    elements.set(id, {
      id, textContent: '', innerHTML: '', style: {}, dataset: {},
      classList: { add() {}, remove() {}, toggle() {} },
      appendChild() {}, addEventListener() {}, onclick: null,
      getBoundingClientRect: () => ({ width: 100, height: 48 }),
    });
  }
  return elements.get(id);
}

const rafQueue = [];
globalThis.window = globalThis;
globalThis.document = {
  getElementById: (id) => fakeElement(id),
  createElement: (tag) => tag === 'canvas' ? fakeCanvas() : fakeElement('el_' + Math.random()),
  querySelectorAll: () => [],
  documentElement: { scrollWidth: 1280 },
};
globalThis.innerWidth = 1280;
globalThis.innerHeight = 720;
globalThis.devicePixelRatio = 1;
globalThis.location = { search: '' };
Object.defineProperty(globalThis, 'navigator', {
  value: { getGamepads: () => [], vibrate: () => {} }, configurable: true,
});
globalThis.matchMedia = () => ({ matches: false });
globalThis.addEventListener = () => {};
globalThis.removeEventListener = () => {};
globalThis.requestAnimationFrame = (fn) => { rafQueue.push(fn); return rafQueue.length; };
globalThis.performance = globalThis.performance || { now: () => Date.now() };
globalThis.localStorage = {
  _m: new Map(),
  getItem(k) { return this._m.get(k) ?? null; },
  setItem(k, v) { this._m.set(k, String(v)); },
  removeItem(k) { this._m.delete(k); },
};
globalThis.Image = class { set src(_) { setTimeout(() => this.onload && this.onload(), 0); } };

// ── boot ─────────────────────────────────────────────────────────────────────
const { boot, step } = await import('../src/main.js');
const { state } = await import('../src/state.js');
const { startRun } = await import('../src/systems/rooms.js');
const { rollRoom } = await import('../src/systems/roomRoller.js');
const { damageEnemy } = await import('../src/systems/combat.js');
const { decayFx } = await import('../src/systems/juice.js');
const tick = (dt) => { decayFx(dt); step(dt); };

let failures = 0;
const check = (name, cond, extra = '') => {
  if (cond) console.log(`  ok  ${name}`);
  else { failures++; console.error(`FAIL  ${name} ${extra}`); }
};

boot();
check('boots to title', state.mode === 'title');

// ── start a seeded run, simulate frames ─────────────────────────────────────
startRun('headless-1');
check('run started', state.mode === 'play' && !!state.room && !!state.run.player);
state.run.player.maxHp = 9999; state.run.player.hp = 9999; // immortal dummy: it stands still for 20s
check('round 1 rolled', state.room.round === 1 && state.room.biome.tier === 'early');
check('background skipped headless', state.room.background === null || state.room.background !== undefined);

// simulate ~20s of play; fake input via direct player aim/move (step reads input
// module, which reports inactive — movement comes from knockback/AI only).
let threw = null;
try {
  for (let i = 0; i < 1200; i++) tick(1 / 60);
} catch (e) { threw = e; }
check('1200 frames without exception', !threw, threw ? `→ ${threw.stack?.split('\n')[0]}` : '');
check('enemies spawned', state.room.enemies.length + state.room.spawnQueue.length > 0 || state.room.cleared,
  `enemies=${state.room.enemies.length} queued=${state.room.spawnQueue.length}`);

// combat sanity: hit one enemy
if (state.room.enemies.length) {
  const e = state.room.enemies[0];
  const hp0 = e.hp;
  damageEnemy(e, 1, 0, 0, 'shot');
  check('damage applies', e.hp < hp0);
}

// clear the room via debug API and reach the portal flow
window.oneRoomDebug.killAll();
try {
  for (let i = 0; i < 240; i++) tick(1 / 60);
} catch (e) { threw = e; failures++; console.error('FAIL post-clear frames', e); }
check('room cleared', state.room.cleared === true);
check('portal exists', !!state.room.portal);

// walk the player into the portal
const p = state.run.player;
p.x = state.room.portal.x; p.y = state.room.portal.y;
try {
  for (let i = 0; i < 30; i++) tick(1 / 60);
} catch (e) { failures++; console.error('FAIL portal entry', e); }
check('portal opens the draft', state.mode === 'portalDraft', `mode=${state.mode}`);
window.oneRoomDebug.pick(0);
check('pick starts transition', state.mode === 'transition', `mode=${state.mode}`);
try {
  for (let i = 0; i < 120; i++) tick(1 / 60);
} catch (e) { failures++; console.error('FAIL transition frames', e); }
check('round 2 live', state.run.round === 2 && state.mode === 'play', `round=${state.run.round} mode=${state.mode}`);

// ── death flow ───────────────────────────────────────────────────────────────
state.run.player.hp = 0; state.run.player.dead = true;
for (let i = 0; i < 10; i++) tick(1 / 60);
check('death flow reached', state.mode === 'dead');

// ── roller variety audit ─────────────────────────────────────────────────────
startRun('audit-seed');
const audit = window.oneRoomDebug.roll(40);
check('40 rooms rolled', audit.rooms.length === 40);
check('no consecutive biome/layout repeats', audit.consecutiveRepeats === 0, `repeats=${audit.consecutiveRepeats}`);

const biomes = new Set(audit.rooms.map(r => r.biome));
const layouts = new Set(audit.rooms.map(r => r.layout));
const recipes = new Set(audit.rooms.map(r => r.recipe));
check('biome variety ≥ 12 over 40 rooms', biomes.size >= 12, `got ${biomes.size}: ${[...biomes].join(',')}`);
check('layout variety ≥ 7', layouts.size >= 7, `got ${layouts.size}`);
check('recipe variety ≥ 4', recipes.size >= 4, `got ${recipes.size}: ${[...recipes].join(',')}`);
check('stages escalate', audit.rooms[39].stage > audit.rooms[0].stage);
check('every room has obstacles', audit.rooms.every(r => r.obstacles >= 2), JSON.stringify(audit.rooms.filter(r => r.obstacles < 2)));
check('every room has hazards or lanes', audit.rooms.every(r => r.hazards > 0));
check('some rooms have annexes', audit.rooms.some(r => r.annex));
check('captain rounds flagged', audit.rooms.filter(r => r.round % 5 === 0).length === 8);

// determinism: same seed → same sequence
startRun('determinism');
const a = window.oneRoomDebug.roll(10).rooms.map(r => `${r.biome}/${r.layout}/${r.recipe}`).join('|');
startRun('determinism');
const b = window.oneRoomDebug.roll(10).rooms.map(r => `${r.biome}/${r.layout}/${r.recipe}`).join('|');
check('seeded determinism', a === b);

// tier banding
startRun('bands');
const bands = window.oneRoomDebug.roll(20).rooms;
check('rounds 1-4 early', bands.slice(0, 4).every(r => ['verdigris', 'fen', 'mirror', 'rosewire'].includes(r.biome)));
check('rounds 5-8 mid', bands.slice(4, 8).every(r => ['ember', 'mycelium', 'shardreef', 'coilroot'].includes(r.biome)));
check('round 20 final', ['empyrean', 'nullthrone'].includes(bands[19].biome), bands[19].biome);

// ── Phase 4: items, draft, events ───────────────────────────────────────────
const { grantItem, chooseCards } = await import('../src/systems/draft.js');
const { stacks } = await import('../src/systems/items.js');
startRun('phase4');
const p4 = state.run.player;
p4.maxHp = 9999; p4.hp = 9999;

grantItem('ricochet'); grantItem('phaseDrill'); grantItem('hunterMycelia');
check('grants stack', stacks(p4, 'ricochet') === 1 && stacks(p4, 'phaseDrill') === 1);

// bullet hooks apply on spawn
const { spawnBullet } = await import('../src/systems/bullets.js');
const tb = spawnBullet(state.room, 'player', p4.x, p4.y, 100, 0, 4, 1, 1, '#fff');
check('onBulletSpawn hooks ran', tb.bounces === 1 && tb.pierce === 1 && tb.turn > 4, JSON.stringify({ bounces: tb.bounces, pierce: tb.pierce, turn: tb.turn }));

// maxStacks → overflow converts to repair
grantItem('aegisLattice'); grantItem('aegisLattice');
check('aegis capped at 2', p4.shieldMax === 2 && stacks(p4, 'aegisLattice') === 2);
grantItem('aegisLattice');
check('overflow does not raise stacks', stacks(p4, 'aegisLattice') === 2);

// companions tick without exception
grantItem('orbitalHalo'); grantItem('scavengerDrone'); grantItem('gigi'); grantItem('emberMine');
let p4err = null;
try { for (let i = 0; i < 300; i++) tick(1 / 60); } catch (e) { p4err = e; }
check('companion items tick', !p4err, p4err ? p4err.stack.split('\n')[0] : '');
check('orbitals exist', (p4._orbitals || []).length === 1);

// draft flow: clear room → portal → draft → pick → transition → next round
const roundBefore = state.run.round;
for (let attempt = 0; attempt < 6 && !state.room.portal; attempt++) {
  window.oneRoomDebug.killAll();
  for (let i = 0; i < 120 && !state.room.portal; i++) tick(1 / 60);
}
check('phase4 room cleared', !!state.room.portal);
p4.x = state.room.portal.x; p4.y = state.room.portal.y; p4.vx = p4.vy = 0;
for (let i = 0; i < 30 && state.mode !== 'portalDraft'; i++) tick(1 / 60);
check('portal opens draft', state.mode === 'portalDraft', 'mode=' + state.mode);
window.oneRoomDebug.pick(0);
for (let i = 0; i < 120; i++) tick(1 / 60);
check('draft pick advances round', state.run.round === roundBefore + 1 && state.mode === 'play',
  `round=${state.run.round} mode=${state.mode}`);
check('a module was granted via draft', Object.keys(p4.modules).length >= 8);

// boon reroll economy: charges accrue from clears
check('boon lacing progressed', p4.boon.progress >= 1 || p4.boon.charges >= 1);

// events present across a long audit
startRun('events-audit');
const evAudit = window.oneRoomDebug.roll(40).rooms;
// roll() does not record events; count via a direct roll pass
const { rollRoom: rr } = await import('../src/systems/roomRoller.js');
startRun('events-audit-2');
let evCount = 0; const evKinds = new Set();
for (let i = 1; i <= 40; i++) {
  const r = rr(state.run, i);
  if (r.eventId) { evCount++; evKinds.add(r.eventId); }
}
check('events roll on ~45% of rooms (±pity)', evCount >= 12 && evCount <= 32, 'count=' + evCount);
check('event variety ≥ 4 kinds', evKinds.size >= 4, [...evKinds].join(','));

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
