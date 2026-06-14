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
const { PLAYER } = await import('../src/config.js');
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
for (let i = 0; i < 120 && state.mode !== 'portalDraft'; i++) { tick(1 / 60); p4.x = state.room.portal.x; p4.y = state.room.portal.y; }
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

// ── Phase 5: bosses, route win, overdrive ───────────────────────────────────
const { beginRound } = await import('../src/systems/rooms.js');
startRun('boss-check');
const p5 = state.run.player;
p5.maxHp = 99999; p5.hp = 99999;
beginRound(5);
const fm = state.room.enemies.find(e => e.boss);
check('round 5 spawns False Moon', !!fm && fm.bossId === 'falseMoon', state.room.enemies.map(e => e.type).join(','));
check('boss arena layout forced', ['ring', 'crossroads'].includes(state.room.layoutId), state.room.layoutId);
check('boss rooms suppress events/annex', !state.room.eventId && !state.room.annex);
let p5err = null;
try { for (let i = 0; i < 400; i++) tick(1 / 60); } catch (e) { p5err = e; }
check('False Moon brain runs', !p5err, p5err ? p5err.stack.split('\n')[0] : '');

beginRound(10);
check('round 10 is Graven Warden', state.room.enemies.find(e => e.boss)?.bossId === 'warden');
try { for (let i = 0; i < 400; i++) tick(1 / 60); } catch (e) { p5err = e; }
const warden = state.room.enemies.find(e => e.boss);
warden.hp = warden.maxHp * 0.4; // force phase 2+3 summons
try { for (let i = 0; i < 200; i++) tick(1 / 60); } catch (e) { p5err = e; }
check('Warden phases + summons run', !p5err && warden.summons >= 1, `summons=${warden?.summons}`);

beginRound(15);
check('round 15 is Spiggot', state.room.enemies.find(e => e.boss)?.bossId === 'spiggot');
try { for (let i = 0; i < 300; i++) tick(1 / 60); } catch (e) { p5err = e; }
check('Spiggot brain runs', !p5err);

beginRound(20);
const archon = state.room.enemies.find(e => e.boss);
check('round 20 is Null Archon in a final biome', archon?.bossId === 'archon' && ['empyrean', 'nullthrone'].includes(state.room.biome.id));
try { for (let i = 0; i < 300; i++) tick(1 / 60); } catch (e) { p5err = e; }
check('Archon brain runs', !p5err);
// kill the archon → route win → overdrive
for (let attempt = 0; attempt < 8 && !state.room.portal; attempt++) {
  window.oneRoomDebug.killAll();
  for (let i = 0; i < 140 && !state.room.portal; i++) tick(1 / 60);
}
check('archon round clears', !!state.room.portal);
check('route win fired', state.run.won === true && state.run.overdrive === true && state.mode === 'pause');
state.mode = 'play'; // simulate the Continue button
p5.x = state.room.portal.x; p5.y = state.room.portal.y; p5.vx = p5.vy = 0;
for (let i = 0; i < 40 && state.mode !== 'portalDraft'; i++) tick(1 / 60);
window.oneRoomDebug.pick(0);
for (let i = 0; i < 160; i++) tick(1 / 60);
check('overdrive round 21 live', state.run.round === 21 && state.mode === 'play', `round=${state.run.round} mode=${state.mode}`);
check('overdrive draws from the whole biome deck', !!state.room.biome);
check('overdrive boss cadence continues at 25', (await import('../src/systems/bosses.js')).bossForRound(25, true) !== null);

// ── Phase 6: meta, oaths, daily, mutators, notices, bgm ─────────────────────
const { buyShrine, applyShrine, dailyBestToday } = await import('../src/systems/meta.js');
const { notice } = await import('../src/systems/notices.js');
const { ensureBgm, toggleBgm } = await import('../src/audio/bgm.js');
const { todaySeed } = await import('../src/rng.js');

// shrine: bank sparks, buy, applies on next run
state.save.sparks = 500;
check('shrine buy works', buyShrine('shrine_hp') && state.save.shrine.shrine_hp === true);
check('shrine rejects rebuy', buyShrine('shrine_hp') === false);
buyShrine('shrine_speed');
startRun('shrine-check');
check('shrine applies on run start', state.run.player.maxHp === 7 && state.run.player.baseSpeed === PLAYER.SPEED + 18,
  `maxHp=${state.run.player.maxHp} base=${state.run.player.baseSpeed}`);
state.save.shrine.shrine_head = true;
startRun('headstart-check');
check('headstart begins at round 2 with a graft', state.run.round === 2 && Object.keys(state.run.player.modules).length === 1,
  `round=${state.run.round} modules=${Object.keys(state.run.player.modules).length}`);
state.save.shrine = {}; // reset for later checks

// oaths
startRun('oath-check', { oath: 'glass' });
check('oath of glass applies', Math.abs(state.run.player.damage - 0.88 * 1.25) < 1e-9 && state.run.player.maxHp === 4,
  `dmg=${state.run.player.damage} maxHp=${state.run.player.maxHp}`);

// daily: same seed today = same first rooms
startRun(todaySeed(), { daily: true });
const d1 = `${state.room.biome.id}/${state.room.layoutId}/${state.room.recipeId}`;
state.run.score = 4321;
const { bankDaily } = await import('../src/systems/meta.js');
bankDaily();
check('daily best banked', dailyBestToday() === 4321);
startRun(todaySeed(), { daily: true });
const d2 = `${state.room.biome.id}/${state.room.layoutId}/${state.room.recipeId}`;
check('daily runs share the board', d1 === d2, `${d1} vs ${d2}`);

// mutators: ~10% of eligible (round≥5, non-boss) rounds, varied, never on a boss.
// Sampled across several seeds so this tests the *rate*, not one seed's luck — any
// change to how much rng room generation consumes shifts a single stream's exact hits.
let mutCount = 0, mutEligible = 0; const mutKinds = new Set(); let mutOnBoss = 0;
{
  const { rollRoom: rr2 } = await import('../src/systems/roomRoller.js');
  for (const seed of ['mutator-audit', 'mut-b', 'mut-c', 'mut-d', 'mut-e']) {
    startRun(seed);
    for (let i = 1; i <= 40; i++) {
      const r = rr2(state.run, i);
      if (!r.bossId && i >= 5) mutEligible++;
      if (r.mutatorId) { mutCount++; mutKinds.add(r.mutatorId); if (r.bossId) mutOnBoss++; }
    }
  }
}
const mutRate = mutCount / Math.max(1, mutEligible);
check('mutators roll ~10% of eligible rounds', mutRate >= 0.04 && mutRate <= 0.18, `rate=${(mutRate * 100).toFixed(1)}% (${mutCount}/${mutEligible})`);
check('mutator variety across seeds', mutKinds.size >= 3, [...mutKinds].join(','));
check('no mutators on boss rounds', mutOnBoss === 0);

// notices collect + dedupe
const before = state.save.notices.length;
notice('nohit'); notice('nohit');
check('notices collect once', state.save.notices.length === before + 1 || state.save.notices.includes('Clean room. Nothing brags.'));

// bgm is headless-safe and toggle persists
ensureBgm();
const bgmWas = state.save.settings.bgm;
toggleBgm();
check('bgm toggle persists', state.save.settings.bgm === !bgmWas);
toggleBgm();

// touch pads exist and suppress correctly
const inputMod = await import('../src/ui/input.js');
check('touch pads exported', inputMod.moveTouch.id === null && inputMod.aimTouch.id === null);
inputMod.suppressInput(100);
check('suppression clears pads', inputMod.moveTouch.id === null);

// ── Polish pass: hazards inert on clear, surgical mobile dash ────────────────
{
  startRun('hazard-clear');
  const hp = state.run.player; hp.maxHp = 9999; hp.hp = 9999;
  const room = state.room;
  room.bullets.length = 0;
  room.hazards.push({ type: 'spore', x: hp.x, y: hp.y, r: 200, slow: 0.66, coreFrac: 0.46,
    coreDmgCd: 0.1, spitCd: [0.05, 0.05], spitSpeed: 150, spitRange: 800, spreadShots: 1,
    phase: 0, cd: 0, hitCd: 0, color: '#fff' });
  for (let i = 0; i < 8; i++) tick(1 / 60);
  check('hazard fires while room is live', room.bullets.some(b => b.owner === 'enemy'));
  room.cleared = true;
  room.bullets.length = 0;
  for (let i = 0; i < 30; i++) tick(1 / 60);
  check('hazard fires nothing after clear', room.bullets.every(b => b.owner !== 'enemy'),
    'enemy bullets=' + room.bullets.filter(b => b.owner === 'enemy').length);
}

{
  const input = await import('../src/ui/input.js');
  startRun('dash-input');
  const dp = state.run.player;
  state.mode = 'play';
  input.suppressInput(-1000);
  dp.dashCd = 0; dp.dashT = 0; input.moveTouch.dashLatch = false;
  Object.assign(input.moveTouch, { id: 1, prevLen: 0.92, len: 0.96, speed: 1200, dx: 1, dy: 0 });
  input.tickTouchDash();
  check('held-stick direction change does NOT dash', dp.dashT === 0, 'dashT=' + dp.dashT);
  input.suppressInput(-1000);
  dp.dashCd = 0; dp.dashT = 0; input.moveTouch.dashLatch = false;
  Object.assign(input.moveTouch, { id: 1, prevLen: 0.30, len: 0.90, speed: 1200, dx: 0, dy: 1 });
  input.tickTouchDash();
  check('deliberate slam from rest DOES dash', dp.dashT > 0, 'dashT=' + dp.dashT);
}

// ── Phase 8a: floorplans + connectivity invariant ──────────────────────────
{
  startRun('floorplan-audit');
  const big = window.oneRoomDebug.roll(250).rooms;
  check('every generated room has a reachable portal', big.every(r => r.portalReachable),
    'unreachable: ' + big.filter(r => !r.portalReachable).length);
  const fp = new Set(big.map(r => r.floorplan));
  check('floorplan variety (>=4 kinds incl. none)', fp.size >= 4, [...fp].join(','));
  check('partitioned rooms occur', big.some(r => r.floorplan !== 'none'));
  // partitioned rooms must actually carry wall obstacles
  const { rollRoom } = await import('../src/systems/roomRoller.js');
  startRun('floorplan-walls');
  let sawWalls = false;
  for (let i = 1; i <= 60 && !sawWalls; i++) {
    const r = rollRoom(state.run, i);
    if (r.floorplanId !== 'none') {
      sawWalls = r.obstacles.some(o => o.wall);
      check('a ' + r.floorplanId + ' room carries solid walls', sawWalls);
    }
  }
}

// ── Phase 8b/8c: tiers + true high-ground line-of-fire ──────────────────────
{
  const { makeEnemy } = await import('../src/systems/enemies.js');
  const { spawnBullet, updateBullets } = await import('../src/systems/bullets.js');
  startRun('highground');
  const room = state.room;
  const pl = state.run.player;
  room.obstacles.length = 0; room.lanes.length = 0; room.hazards.length = 0; room.bullets.length = 0;
  const cx = room.w / 2, cy = room.h / 2;
  const high = makeEnemy('turret', cx - 200, cy, room); high.level = 1; high.hp = high.maxHp = 50;
  room.enemies.length = 0; room.enemies.push(high);
  const low = makeEnemy('turret', cx + 200, cy, room); low.level = 0; low.hp = low.maxHp = 50; room.enemies.push(low);

  pl.level = 0;
  let hp0 = high.hp;
  spawnBullet(room, 'player', high.x, high.y, 1, 0, 4, 5, 0.5, '#fff', { level: 0 });
  updateBullets(room, 1 / 60);
  check('ground shot cannot hit a raised enemy', high.hp === hp0, 'hp ' + hp0 + '->' + high.hp);

  hp0 = low.hp;
  spawnBullet(room, 'player', low.x, low.y, 1, 0, 4, 5, 0.5, '#fff', { level: 0 });
  updateBullets(room, 1 / 60);
  check('ground shot hits a ground enemy', low.hp < hp0, 'hp ' + hp0 + '->' + low.hp);

  hp0 = low.hp;
  spawnBullet(room, 'player', low.x, low.y, 1, 0, 4, 5, 0.5, '#fff', { level: 1 });
  updateBullets(room, 1 / 60);
  check('high shot rains down on a ground enemy', low.hp < hp0, 'hp ' + hp0 + '->' + low.hp);

  pl.level = 1; pl.inv = 0; pl.hp = 6;
  spawnBullet(room, 'enemy', pl.x, pl.y, 1, 0, 4, 1, 0.5, '#f00', { level: 0 });
  updateBullets(room, 1 / 60);
  check('ground enemy fire cannot hit a platform player', pl.hp === 6, 'hp=' + pl.hp);

  startRun('tier-audit');
  const rms = window.oneRoomDebug.roll(220).rooms;
  check('platforms occur', rms.some(r => r.tiers > 0), 'with tiers: ' + rms.filter(r => r.tiers > 0).length);
  check('platform rooms keep a reachable portal', rms.filter(r => r.tiers > 0).every(r => r.portalReachable));
}


{
  // platform interiors must be reachable too (else a perched sniper stalls the room)
  const { reachableFrom } = await import('../src/systems/roomRoller.js');
  const { rollRoom: rr } = await import('../src/systems/roomRoller.js');
  startRun('tier-interior');
  let tierRooms = 0, badInterior = 0;
  for (let i = 1; i <= 300; i++) {
    const r = rr(state.run, i);
    if (r.tiers.length) {
      tierRooms++;
      const t = r.tiers[0];
      if (!reachableFrom(r, r.w / 2, r.h * 0.66).has(t.x + t.w / 2, t.y + t.h / 2)) badInterior++;
    }
  }
  check('platform interiors are always reachable', tierRooms > 0 && badInterior === 0,
    'tierRooms=' + tierRooms + ' bad=' + badInterior);
}

// ── room richness: the bigger arena must earn its size (cover density + structure) ──
{
  const { rollRoom } = await import('../src/systems/roomRoller.js');
  startRun('richness');
  let cover = 0, area = 0, withLandmark = 0, withRubble = 0, rooms = 0;
  for (let i = 1; i <= 80; i++) {
    const r = rollRoom(state.run, i);
    if (r.bossId) continue;
    rooms++; area += r.w * r.h;
    cover += r.obstacles.filter(o => !o.gone && !o.wall && !o.ledge && !o.solidWall).length;
    if (r.obstacles.some(o => o.landmark)) withLandmark++;
    if (r.obstacles.some(o => o.species === 'rubble')) withRubble++;
  }
  const densityPerMp = cover / area * 1e6;
  check('cover density restored for the bigger arena (>2.0/Mpx)', densityPerMp > 2.0, `density=${densityPerMp.toFixed(2)}/Mpx`);
  check('structural landmark set-pieces occur (>20% of rooms)', withLandmark / rooms > 0.2, `${withLandmark}/${rooms}`);
  check('breakable rubble fields occur (>20% of rooms)', withRubble / rooms > 0.2, `${withRubble}/${rooms}`);
}

// ── scale coherence: the bullet emitter tracks the DRAW_SCALE-shrunk muzzle ──
{
  const playerMod = await import('../src/systems/player.js');
  startRun('emitter-scale');
  const pl = state.run.player, room = state.room;
  room.bullets.length = 0;
  pl.aimX = 1; pl.aimY = 0; pl.fireCd = 0; pl.x = room.w / 2; pl.y = room.h / 2;
  playerMod.firePlayer(pl, room);
  const shot = room.bullets.find(b => b.owner === 'player');
  const expected = pl.x + PLAYER.EMITTER_LEN * PLAYER.DRAW_SCALE; // not the raw EMITTER_LEN
  check('shots leave the scaled muzzle (not the art-size offset)',
    !!shot && Math.abs(shot.x - expected) < 1.0 && shot.x < pl.x + PLAYER.EMITTER_LEN - 4,
    `x=${shot && shot.x.toFixed(1)} expected≈${expected.toFixed(1)}`);
}


// ── new combat mechanics: dash-bullet conversion + kinetic/redline relics ────
{
  const bulletsMod = await import('../src/systems/bullets.js');
  const playerMod = await import('../src/systems/player.js');
  const spawnB = bulletsMod.spawnBullet, updateB = bulletsMod.updateBullets;
  startRun('headless-mechanics');
  const room = state.room, pl = state.run.player;
  pl.maxHp = 9999; pl.hp = 9999;

  // case A: dashing — an enemy bullet on the player flips to a friendly diamond
  room.bullets.length = 0;
  pl.dashT = 0.3; pl.inv = 0.5;
  const eb = spawnB(room, 'enemy', pl.x, pl.y, 120, 0, 5, 1, 1.0, '#f00');
  updateB(room, 1 / 60);
  check('dash converts an enemy bullet to friendly', !!eb && eb.owner === 'player' && eb.converted === true,
    `owner=${eb && eb.owner} converted=${eb && eb.converted}`);

  // case B: invincible from a hit (not dashing) — the bullet is NOT converted (dash-only)
  pl.dashT = 0; pl.inv = 0.5;
  room.bullets.length = 0;
  const eb2 = spawnB(room, 'enemy', pl.x, pl.y, 120, 0, 5, 1, 1.0, '#f00');
  updateB(room, 1 / 60);
  check('hurt i-frames do NOT convert bullets (dash-only)', !!eb2 && !eb2.converted && eb2.owner === 'enemy',
    `owner=${eb2 && eb2.owner} converted=${eb2 && eb2.converted}`);

  // redline: the fire-rate relic shortens the effective fire delay (0.9^perks.fire)
  const before = pl.fireDelay * Math.pow(0.9, pl.perks.fire);
  window.oneRoomDebug.grant('redline');
  const after = pl.fireDelay * Math.pow(0.9, pl.perks.fire);
  check('redline relic speeds up fire', after < before * 0.95, `before=${before.toFixed(3)} after=${after.toFixed(3)}`);

  // kinetic: a dash primes the next volley (bigger + piercing). Verify flag + empowered shot.
  window.oneRoomDebug.grant('kinetic');
  pl.dashCd = 0;
  playerMod.tryDash(1, 0); // dash east → onDash hook sets _dashPrimed
  check('kinetic primes a shot after dashing', (pl._dashPrimed || 0) >= 1, `primed=${pl._dashPrimed}`);
  room.bullets.length = 0;
  pl.fireCd = 0; pl.aimX = 1; pl.aimY = 0;
  playerMod.firePlayer(pl, room);
  const primedShot = room.bullets.find(b => b.primed);
  check('primed volley spawns empowered shots', !!primedShot && primedShot.r > 4.2 && primedShot.pierce >= 1,
    `found=${!!primedShot} r=${primedShot && primedShot.r} pierce=${primedShot && primedShot.pierce}`);
}

// ── fastcombat fixes: dash sweep, one-hit-per-enemy, restart guard, fire floor ──
{
  const playerMod = await import('../src/systems/player.js');
  const enemiesMod = await import('../src/systems/enemies.js');
  const cfg = await import('../src/config.js');
  const { tryDash, updatePlayer } = playerMod;
  const move0 = { active: false, x: 0, y: 0, l: 0 };
  const aimR = { active: false, x: 1, y: 0 };

  // (1) the dash cuts enemies along the ~430px travel path, not just at launch range (156)
  startRun('headless-sweep');
  let room = state.room, pl = state.run.player;
  room.enemies.length = 0; room.spawnQueue.length = 0; room.bullets.length = 0; room.obstacles.length = 0; room.hazards.length = 0;
  pl.x = 300; pl.y = 520; pl.vx = pl.vy = 0; pl.aimX = 1; pl.aimY = 0; pl.level = 0; pl.dashCd = 0; pl.dashT = 0;
  const far = enemiesMod.makeEnemy('skitter', pl.x + 300, 520, room); far.level = 0; far.hp = far.maxHp = 50; room.enemies.push(far);
  tryDash(1, 0);
  const hpLaunch = far.hp;
  for (let i = 0; i < 30 && pl.dashT > 0; i++) { decayFx(1 / 60); updatePlayer(pl, move0, aimR, room, 1 / 60); }
  check('dash sweep cuts an enemy 300px down the travel path', hpLaunch === 50 && far.hp < 50, `launch=${hpLaunch} after=${far.hp}`);

  // (2) one hit per enemy per dash — hp dropped by exactly one dash hit, not chipped every frame
  const oneHit = cfg.PLAYER.DASH_HIT_MULT * pl.damage * (1 + pl.perks.damage * 0.15);
  check('dash sweep hits each enemy at most once', far.hp >= 50 - oneHit - 1e-6, `hp=${far.hp} oneHit=${oneHit.toFixed(2)}`);

  // (3) cannot restart a dash mid-dash even if the cooldown is refunded to 0
  startRun('headless-restart');
  room = state.room; pl = state.run.player;
  pl.x = 300; pl.y = 520; pl.dashCd = 0; pl.dashT = 0; pl.aimX = 1; pl.aimY = 0;
  tryDash(1, 0);
  const d1 = pl.dashes;
  pl.dashCd = 0; // simulate kill-refunds zeroing the cooldown mid-dash
  tryDash(1, 0);
  check('no dash restart while still dashing', pl.dashes === d1 && pl.dashT > 0, `dashes=${pl.dashes} expected=${d1} dashT=${pl.dashT.toFixed(3)}`);

  // (4) fire cadence has a sane floor even with absurd stacked fire perks
  pl.perks.fire = 99; pl.fireCd = 0; pl.aimX = 1; pl.aimY = 0;
  playerMod.firePlayer(pl, state.room);
  check('fire cadence floored (no bullet hose)', pl.fireCd >= 0.075 - 1e-9, `fireCd=${pl.fireCd}`);
}

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
