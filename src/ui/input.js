// Input: keyboard + mouse + gamepad now; the two-thumb touch system lands in
// Phase 6 against the same getMove/getAim contract (Boon Moots index.html:445-548).
import { state } from '../state.js';
import { norm, dist } from '../rng.js';
import { screenToWorld } from '../render/camera.js';
import { tryDash, tryPulse } from '../systems/player.js';

const keys = Object.create(null);
const mouse = { x: 0, y: 0, down: false, seen: false };
let actions = null;
let suppressUntil = 0;
let padDashLatch = false, padPulseLatch = false;

export function suppressInput(ms) {
  suppressUntil = (typeof performance !== 'undefined' ? performance.now() : 0) + ms;
}
const suppressed = () => (typeof performance !== 'undefined' ? performance.now() : 0) < suppressUntil;

export function initInput(canvas, a) {
  actions = a;
  addEventListener('keydown', onKeyDown, { passive: false });
  addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; }, { passive: true });
  canvas.addEventListener('pointermove', (e) => {
    mouse.x = e.clientX; mouse.y = e.clientY; mouse.seen = true;
  }, { passive: true });
  canvas.addEventListener('pointerdown', (e) => {
    if (state.mode === 'title' || state.mode === 'dead') return; // overlay buttons handle these
    if (state.mode !== 'play') return;
    actions.firstInteract?.();
    if (e.button === 2) { tryPulse(); return; }
    mouse.down = true;
    mouse.x = e.clientX; mouse.y = e.clientY; mouse.seen = true;
  }, { passive: false });
  addEventListener('pointerup', (e) => { if (e.button === 0) mouse.down = false; }, { passive: true });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}

function onKeyDown(e) {
  const k = e.key.toLowerCase();
  keys[k] = true;
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'tab'].includes(k)) e.preventDefault();
  if (e.repeat) return;
  actions?.firstInteract?.();
  if (k === 'enter' && (state.mode === 'title' || state.mode === 'dead')) actions?.start?.();
  if (state.mode === 'play' && !suppressed()) {
    if (k === 'shift') tryDash(null, null, getMove());
    if (k === 'e' || k === 'x') tryPulse();
  }
  if (k === 'escape' || k === 'p') actions?.pause?.();
  if (k === 'm') actions?.toggleSfx?.();
}

export function getMove() {
  let x = 0, y = 0;
  if (keys.w || keys.arrowup) y -= 1;
  if (keys.s || keys.arrowdown) y += 1;
  if (keys.a || keys.arrowleft) x -= 1;
  if (keys.d || keys.arrowright) x += 1;
  const gp = (typeof navigator !== 'undefined' && navigator.getGamepads) ? navigator.getGamepads()[0] : null;
  if (gp) {
    const gx = Math.abs(gp.axes[0]) > 0.16 ? gp.axes[0] : 0;
    const gy = Math.abs(gp.axes[1]) > 0.16 ? gp.axes[1] : 0;
    x += gx; y += gy;
    if (gp.buttons[1]?.pressed || gp.buttons[0]?.pressed) {
      if (!padDashLatch) { padDashLatch = true; if (state.mode === 'play' && !suppressed()) tryDash(null, null, getMoveRaw(x, y)); }
    } else padDashLatch = false;
    if (gp.buttons[3]?.pressed) {
      if (!padPulseLatch) { padPulseLatch = true; if (state.mode === 'play') tryPulse(); }
    } else padPulseLatch = false;
  }
  if (suppressed()) return { x: 0, y: 0, active: false, l: 0 };
  return getMoveRaw(x, y);
}

function getMoveRaw(x, y) {
  const l = Math.hypot(x, y);
  if (l > 1) { x /= l; y /= l; }
  return { x, y, active: l > 0.06, l: Math.min(1, l) };
}

export function getAim() {
  const p = state.run?.player;
  if (!p) return { x: 1, y: 0, active: false, aiming: false };
  let ax = p.aimX, ay = p.aimY, firing = false, aiming = false;

  if (mouse.seen) {
    const w = screenToWorld(mouse.x, mouse.y);
    const n = norm(w.x - p.x, w.y - p.y);
    if (n.m > 8) { ax = n.x; ay = n.y; aiming = true; }
    firing = mouse.down;
  }
  const gp = (typeof navigator !== 'undefined' && navigator.getGamepads) ? navigator.getGamepads()[0] : null;
  if (gp) {
    const rx = Math.abs(gp.axes[2] || 0) > 0.2 ? gp.axes[2] : 0;
    const ry = Math.abs(gp.axes[3] || 0) > 0.2 ? gp.axes[3] : 0;
    if (rx || ry) {
      const n = norm(rx, ry);
      ax = n.x; ay = n.y; aiming = true; firing = true;
    }
  }
  if (keys[' '] || keys.z) {
    firing = true;
    if (!aiming) {
      const n = nearestEnemyDir(p);
      ax = n.x; ay = n.y; aiming = n.hit;
    }
  }
  if (suppressed()) firing = false;
  return { x: ax, y: ay, active: firing, aiming };
}

function nearestEnemyDir(p) {
  let best = null, bd = Infinity;
  if (state.room) {
    for (const e of state.room.enemies) {
      const d = dist(p.x, p.y, e.x, e.y);
      if (e.hp > 0 && d < bd && d < 620) { best = e; bd = d; }
    }
  }
  if (best) {
    const n = norm(best.x - p.x, best.y - p.y);
    return { x: n.x, y: n.y, hit: true };
  }
  return { x: p.aimX, y: p.aimY, hit: false };
}
