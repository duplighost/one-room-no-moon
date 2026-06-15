// 12-round auto-play stress: drive the real loop, kill rooms, walk portals.
const noopCtx = () => new Proxy({}, {
  get(t, prop) {
    if (prop === 'canvas') return fakeCanvas();
    if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => ({ addColorStop() {} });
    if (typeof prop === 'string') return () => {};
    return undefined;
  },
  set() { return true; },
});
function fakeCanvas() {
  return { width: 1280, height: 720, style: {}, getContext: () => noopCtx(), addEventListener() {}, getBoundingClientRect: () => ({ width: 1280, height: 720 }) };
}
const els = new Map();
const fakeEl = (id) => {
  if (id === 'game') return fakeCanvas();
  if (!els.has(id)) els.set(id, { id, textContent: '', innerHTML: '', style: {}, classList: { add() {}, remove() {}, toggle() {} }, appendChild() {}, addEventListener() {}, getBoundingClientRect: () => ({ width: 100, height: 48 }) });
  return els.get(id);
};
globalThis.window = globalThis;
globalThis.document = { getElementById: fakeEl, createElement: (t) => t === 'canvas' ? fakeCanvas() : fakeEl('e' + Math.random()), querySelectorAll: () => [], documentElement: { scrollWidth: 1280 } };
globalThis.innerWidth = 1280; globalThis.innerHeight = 720; globalThis.devicePixelRatio = 1;
globalThis.location = { search: '' };
Object.defineProperty(globalThis, 'navigator', { value: { getGamepads: () => [] }, configurable: true });
globalThis.matchMedia = () => ({ matches: false });
globalThis.addEventListener = () => {}; globalThis.requestAnimationFrame = () => 0;
globalThis.localStorage = { _m: new Map(), getItem(k) { return this._m.get(k) ?? null; }, setItem(k, v) { this._m.set(k, String(v)); }, removeItem(k) { this._m.delete(k); } };
globalThis.Image = class { set src(_) { setTimeout(() => this.onload?.(), 0); } };

const { boot, step } = await import('../src/main.js');
const { state } = await import('../src/state.js');
const { startRun } = await import('../src/systems/rooms.js');
const { decayFx } = await import('../src/systems/juice.js');
const { tryDash } = await import('../src/systems/player.js');
const tick = (dt) => { decayFx(dt); step(dt); };

boot();
startRun('stress-12');
const p = state.run.player;
p.maxHp = 99999; p.hp = 99999;
let frames = 0, errors = 0;
const seen = { biomes: new Set(), hazardKits: new Set(), enemyTypes: new Set(), captains: 0 };
try {
  for (let round = 1; round <= 16; round++) {
    seen.biomes.add(state.room.biome.id);
    seen.hazardKits.add(state.room.biome.hazard);
    // let the room run a while (waves spawn, AI executes, hazards tick)
    for (let i = 0; i < 600; i++) {
      tick(1 / 60); frames++;
      for (const e of state.room.enemies) { seen.enemyTypes.add(e.type); if (e.captain) seen.captains++; }
      // jiggle the player so spatial code paths run
      p.x += Math.sin(frames * 0.05) * 3; p.y += Math.cos(frames * 0.04) * 3;
      // CHAOS: hammer the rail + vent paths so any exception there surfaces (caught below)
      const room = state.room;
      if (i % 80 === 0) {
        p.dashCd = 0; p.railing = false; p.railCd = 0;
        const side = (frames >> 4) % 4;
        if (side === 0) { p.x = room.wall + 30; p.y = room.h / 2; tryDash(-1, 0.2, null); }
        else if (side === 1) { p.x = room.w - room.wall - 30; p.y = room.h / 2; tryDash(1, -0.2, null); }
        else if (side === 2) { p.x = room.w / 2; p.y = room.wall + 30; tryDash(0.2, -1, null); }
        else { p.x = room.w / 2; p.y = room.h - room.wall - 30; tryDash(-0.2, 1, null); }
      }
      if (i % 80 === 40 && p.railing) tryDash(0, 0, { active: true, x: Math.random() - 0.5, y: Math.random() - 0.5 }); // leap off
      if (i % 110 === 0 && (room.vents || []).length) { const v = room.vents[Math.floor(Math.random() * room.vents.length)]; p.x = v.x; p.y = v.y; p.ventCd = 0; p.level = 0; }
    }
    for (let attempt = 0; attempt < 6 && !state.room.portal; attempt++) {
      window.oneRoomDebug.killAll();
      for (let i = 0; i < 120 && !state.room.portal; i++) { tick(1 / 60); frames++; }
    }
    if (!state.room.portal) { console.log('NO PORTAL round', round); errors++; break; }
    for (let i = 0; i < 60; i++) tick(1 / 60);
    p.railing = false; p.launchT = 0; p.dashT = 0; p.ventCd = 0; // drop any chaos rail/vent before walking the portal
    p.x = state.room.portal.x; p.y = state.room.portal.y; p.vx = p.vy = 0;
    for (let i = 0; i < 60 && state.mode !== 'portalDraft'; i++) { tick(1 / 60); frames++; }
    if (state.mode === 'portalDraft') window.oneRoomDebug.pick(Math.floor(Math.random() * 3));
    for (let i = 0; i < 200 && state.run.round === round; i++) { tick(1 / 60); frames++; }
    if (state.run.round !== round + 1) { console.log('STUCK at round', round, 'mode', state.mode); errors++; break; }
    // re-immortalize (transition repositions but keeps player object)
    p.maxHp = 99999; p.hp = 99999; p.dead = false;
  }
} catch (e) { errors++; console.log('EXCEPTION:', e.stack.split('\n').slice(0, 3).join(' | ')); }
console.log('rounds reached:', state.run.round, 'frames:', frames);
console.log('biomes seen:', [...seen.biomes].join(','));
console.log('hazard kits seen:', [...seen.hazardKits].join(','));
console.log('enemy types seen:', [...seen.enemyTypes].join(','));
console.log('captain sightings:', seen.captains > 0);
console.log(errors === 0 ? 'STRESS OK' : 'STRESS FAILURES: ' + errors);
process.exit(errors ? 1 : 0);
