// Moots. Movement/dash/pulse are Boon Moots v50 ports (docs/boon-moots-notes.md §3);
// weapon and damage scale are No Moon's Moots (twin-relay).
import { PLAYER, TAU } from '../config.js';
import { state } from '../state.js';
import { clamp, damp, dist, norm } from '../rng.js';
import { particle, burst, addFloat, ripple } from '../render/particles.js';
import { addShake, addFlash, slowMo, hitPause, haptic, reduced } from './juice.js';
import { sfx } from '../audio/sfx.js';
import { spawnBullet } from './bullets.js';
import { damageEnemy } from './combat.js';
import { damageObstacle } from './breakables.js';
import { hooks } from './items.js';
import { view } from '../render/camera.js';
import { levelAt } from './levels.js';

const VENT_DUR = 0.32; // vent launch arc duration

// ── Perimeter grind rail (Sonic-style): the map edge is a rail loop. Dash into the edge
// to latch on and grind around the corners; dash again to leap off. ──
const RAIL_INSET = 26;     // the rail hugs the edge, this far inside the wall frame
export const RAIL_SPEED = 1520; // grind speed along the rail (light-speed boulevard feel)

export function railGeom(room) {
  const L = room.wall + RAIL_INSET, T = room.wall + RAIL_INSET;
  const R = room.w - room.wall - RAIL_INSET, B = room.h - room.wall - RAIL_INSET;
  const W = R - L, H = B - T;
  return { L, T, R, B, W, H, perim: 2 * (W + H) };
}
// point + unit tangent on the loop at arc-position pos (clockwise from the top-left corner)
export function railPoint(g, pos) {
  pos = ((pos % g.perim) + g.perim) % g.perim;
  if (pos < g.W) return { x: g.L + pos, y: g.T, tx: 1, ty: 0 };
  pos -= g.W;
  if (pos < g.H) return { x: g.R, y: g.T + pos, tx: 0, ty: 1 };
  pos -= g.H;
  if (pos < g.W) return { x: g.R - pos, y: g.B, tx: -1, ty: 0 };
  pos -= g.W;
  return { x: g.L, y: g.B - pos, tx: 0, ty: -1 };
}
// arc-position of the nearest loop point to (x,y)
function nearestRailPos(g, x, y) {
  const cands = [
    { px: clamp(x, g.L, g.R), py: g.T, pos: clamp(x, g.L, g.R) - g.L },
    { px: g.R, py: clamp(y, g.T, g.B), pos: g.W + (clamp(y, g.T, g.B) - g.T) },
    { px: clamp(x, g.L, g.R), py: g.B, pos: g.W + g.H + (g.R - clamp(x, g.L, g.R)) },
    { px: g.L, py: clamp(y, g.T, g.B), pos: 2 * g.W + g.H + (g.B - clamp(y, g.T, g.B)) },
  ];
  let best = cands[0], bd = Infinity;
  for (const c of cands) { const d = Math.hypot(x - c.px, y - c.py); if (d < bd) { bd = d; best = c; } }
  return best.pos;
}

function releaseRail(p, room, move) {
  p.railing = false; p.railCd = 0.28;
  // leap off, steered by your move/aim, forced inward so you don't immediately re-grab the wall
  let dx = move && move.active ? move.x : p.aimX, dy = move && move.active ? move.y : p.aimY;
  const inward = norm(room.w / 2 - p.x, room.h / 2 - p.y);
  if ((dx * inward.x + dy * inward.y) < 0.15) { dx = inward.x; dy = inward.y; }
  const n = norm(dx, dy);
  p.vx = n.x * PLAYER.DASH_IMPULSE; p.vy = n.y * PLAYER.DASH_IMPULSE;
  p.dashT = p.dashDur; p.inv = Math.max(p.inv, PLAYER.DASH_IFRAMES);
  p.lastDashAngle = Math.atan2(n.y, n.x); p.dashSpinDir = 1;
  p._dashHitIds = new Set(); p._dashCutPrimed = false;
  sfx('dash'); haptic(12); addShake(0.18);
}

// Dashing through a breakable WALL/door smashes it along the swept path (adopted from
// ChatGPT's verticality build): no more silently tunnelling over a thin sealed door at
// dash speed. Walls/doors only — regular cover still needs a real (shot) hit.
function dashSmashWalls(p, room, x0, y0) {
  const dx = p.x - x0, dy = p.y - y0;
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 10));
  const pad = p.r + 6;
  for (const o of room.obstacles) {
    if (o.gone || !o.breakable || (o.species !== 'wallSegment' && o.species !== 'annexDoor')) continue;
    for (let i = 0; i <= steps; i++) {
      const sx = x0 + dx * (i / steps), sy = y0 + dy * (i / steps);
      const cx = clamp(sx, o.x, o.x + o.w), cy = clamp(sy, o.y, o.y + o.h);
      if (Math.hypot(sx - cx, sy - cy) < pad) { damageObstacle(room, o, 999); break; }
    }
  }
}

export function makePlayer() {
  return {
    x: 750, y: 700, vx: 0, vy: 0, r: PLAYER.R, aimX: 1, aimY: 0, face: 0, level: 0,
    hp: PLAYER.MAX_HP, maxHp: PLAYER.MAX_HP, shield: 0, shieldMax: 0, shieldTimer: 0,
    inv: 0, hurt: 0, dead: false, roomHit: false,
    speed: PLAYER.SPEED, baseSpeed: PLAYER.SPEED,
    accel: PLAYER.ACCEL, stop: PLAYER.STOP, turn: PLAYER.TURN, lateral: PLAYER.LATERAL,
    fireDelay: PLAYER.FIRE_DELAY, fireCd: 0, damage: PLAYER.DAMAGE, crit: PLAYER.CRIT,
    dashCdBase: PLAYER.DASH_CD, dashCd: 0, dashT: 0, dashDur: PLAYER.DASH_DUR,
    dashSpinDir: 1, lastDashAngle: null, after: [], faceDir: 1, walkPhase: 0,
    launchT: 0, launchHop: 0, launchFrom: null, launchTo: null, // vent launch arc
    railing: false, railPos: 0, railDir: 1, railCd: 0, // perimeter grind rail
    pickup: PLAYER.PICKUP_RANGE,
    perks: { damage: 0, fire: 0, speed: 0, maxHp: 0 },
    modules: {},
    boon: { charges: 0, progress: 0, need: 2 },
    shots: 0, dashes: 0, stillT: 0, wasMoving: false, brakeT: 0, flowT: 0,
  };
}

export function dashSpinPhase(p) {
  if (!p || p.dashT <= 0) return 0;
  return (1 - clamp(p.dashT / (p.dashDur || 0.001), 0, 1)) * TAU * (p.dashSpinDir || 1);
}

export function updatePlayer(p, move, aim, room, dt) {
  p.inv = Math.max(0, p.inv - dt);
  p.hurt = Math.max(0, p.hurt - dt);
  p.fireCd = Math.max(0, p.fireCd - dt);
  p.dashCd = Math.max(0, p.dashCd - dt);
  // VENT LAUNCH: arc up onto a platform, flying over the ledge walls. Overrides normal
  // movement/collision while airborne (p.launchHop lifts the body), then lands on the deck.
  if (p.launchT > 0) {
    p.launchT -= dt;
    const k = clamp(1 - p.launchT / VENT_DUR, 0, 1);
    p.x = p.launchFrom.x + (p.launchTo.x - p.launchFrom.x) * k;
    p.y = p.launchFrom.y + (p.launchTo.y - p.launchFrom.y) * k;
    p.launchHop = Math.sin(k * Math.PI) * 80;
    p.vx = p.vy = 0; p.inv = Math.max(p.inv, 0.12);
    p.level = levelAt(room, p.x, p.y);
    p.face = Math.atan2(p.aimY, p.aimX);
    if (p.launchT <= 0) { p.launchHop = 0; burst(room, p.x, p.y, room.biome.pal.accent3, 16, 220, 0.4, 3); addShake(0.3); sfx('care'); }
    return;
  }
  // GRIND RAIL: ride the perimeter loop. Auto-follows corners; auto-fires + cuts enemies
  // you grind past; dash (tryDash) leaps you off. Overrides normal movement entirely.
  if (p.railing) {
    p.dashT = Math.max(0, p.dashT - dt);
    p.railCd = Math.max(0, p.railCd - dt);
    const g = railGeom(room);
    p.railPos += RAIL_SPEED * p.railDir * dt;
    const pt = railPoint(g, p.railPos);
    p.x = pt.x; p.y = pt.y;
    p.vx = pt.tx * RAIL_SPEED * p.railDir; p.vy = pt.ty * RAIL_SPEED * p.railDir;
    p.level = 0; p.walkPhase += RAIL_SPEED * dt * 0.05;
    const tgt = nearestEnemy(room, p);                          // keep shooting while grinding
    if (tgt) { const nn = norm(tgt.x - p.x, tgt.y - p.y); p.aimX = nn.x; p.aimY = nn.y; p.face = Math.atan2(nn.y, nn.x); if (p.fireCd <= 0) firePlayer(p, room); }
    if (Math.abs(p.vx) > Math.abs(p.vy)) p.faceDir = p.vx < 0 ? -1 : 1;
    performDashCut(p, room, (PLAYER.DASH_SWEEP_RANGE || PLAYER.DASH_HIT_RANGE) + 18); // side-slice nearby enemies
    if (!reduced() && Math.random() < 0.7) particle(room, p.x, p.y, room.biome.pal.accent3, -p.vx * 0.04, -p.vy * 0.04, 0.2, 3);
    return;
  }
  const wasDashing = p.dashT > 0;
  p.dashT = Math.max(0, p.dashT - dt);
  if (wasDashing && p.dashT <= 0) { // landing punctuation — reads as the dash "slam" stop
    p._dashHitIds = null;
    ripple(room, p.x, p.y, room.biome.pal.accent2, 92);
    ripple(room, p.x, p.y, '#ffffff', 46, 0.32);
    burst(room, p.x, p.y, room.biome.pal.accent3, 10, 150, 0.3, 2.6);
  }
  p.brakeT = Math.max(0, p.brakeT - dt);
  p.flowT = Math.max(0, (p.flowT || 0) - dt);
  if (p.shieldMax > 0 && p.shield < p.shieldMax) {
    p.shieldTimer += dt;
    if (p.shieldTimer >= 10) { p.shield++; p.shieldTimer = 0; }
  }

  // aim + auto-fire: the gun never stops. Manual aim wins; with no manual aim, lock
  // onto the nearest enemy so you keep shooting without aiming (constant flow state).
  let firing = false;
  if (aim.active) {
    p.aimX = aim.x; p.aimY = aim.y; firing = true;
  } else if (!room.cleared) {
    const tgt = nearestEnemy(room, p);
    if (tgt) { const n = norm(tgt.x - p.x, tgt.y - p.y); p.aimX = n.x; p.aimY = n.y; firing = true; }
  }
  p.face = Math.atan2(p.aimY, p.aimX);
  if (Math.abs(p.aimX) > 0.12) p.faceDir = p.aimX < 0 ? -1 : 1; // persistent horizontal facing (no flicker)
  p.walkPhase += Math.hypot(p.vx, p.vy) * dt * 0.05;            // stride synced to distance moved
  if (firing && p.fireCd <= 0) firePlayer(p, room);

  // Boon Moots movement model (index.html:612-643)
  const beforeSpeed = Math.hypot(p.vx, p.vy);
  const analog = clamp(move.l, 0, 1);
  const desiredX = move.x * p.speed * (0.58 + 0.42 * analog);
  const desiredY = move.y * p.speed * (0.58 + 0.42 * analog);
  if (p.dashT > 0) {
    // committed dash glide — ride the impulse, ignore steering, ease out gently
    p.vx = damp(p.vx, 0, PLAYER.DASH_GLIDE, dt);
    p.vy = damp(p.vy, 0, PLAYER.DASH_GLIDE, dt);
    p.stillT = 0;
  } else if (move.active) {
    const inLen = Math.hypot(move.x, move.y) || 1, ix = move.x / inLen, iy = move.y / inLen;
    const alignment = beforeSpeed > 1 ? (p.vx * ix + p.vy * iy) / beforeSpeed : 1;
    const reverse = clamp(-alignment, 0, 1);
    const turnPressure = clamp((1 - alignment) * 0.55, 0, 1);
    const response = p.accel + p.turn * turnPressure + 7.5 * reverse;
    p.vx = damp(p.vx, desiredX, response, dt);
    p.vy = damp(p.vy, desiredY, response, dt);
    const px = -iy, py = ix;
    const lateral = p.vx * px + p.vy * py;
    const lf = 1 - Math.exp(-p.lateral * (0.42 + turnPressure * 0.7) * dt);
    p.vx -= px * lateral * lf; p.vy -= py * lateral * lf;
    p.stillT = 0;
  } else {
    if (p.wasMoving && beforeSpeed > 118 && p.brakeT <= 0 && !reduced()) {
      p.brakeT = 0.12;
      const back = norm(-p.vx, -p.vy);
      for (let i = 0; i < 8; i++) {
        particle(room, p.x - back.x * 8, p.y - back.y * 8, room.biome.pal.accent3,
          back.x * (80 + Math.random() * 110) + (Math.random() * 80 - 40),
          back.y * (80 + Math.random() * 110) + (Math.random() * 80 - 40), 0.20, 2 + Math.random() * 2.5);
      }
    }
    const brake = p.stop + Math.min(13, beforeSpeed / 65);
    p.vx = damp(p.vx, 0, brake, dt); p.vy = damp(p.vy, 0, brake, dt);
    if (Math.hypot(p.vx, p.vy) < 7) { p.vx = 0; p.vy = 0; }
    if (room.enemies.length > 0) p.stillT += dt;
  }
  // flow lanes: neon boost boulevards push you along them — momentum highways across
  // the sprawl. Riding one lifts the speed cap so the lane actually feels light-speed.
  applyFlowLanes(p, room, move, dt);
  const flowing = (p.flowT || 0) > 0;
  const maxV = p.speed * (p.dashT > 0 ? PLAYER.DASH_SPEED_MULT * (flowing ? 1.22 : 1)
    : flowing ? PLAYER.MAX_SPEED_MULT * 1.5 : PLAYER.MAX_SPEED_MULT);
  let sp = Math.hypot(p.vx, p.vy);
  if (sp > maxV) { p.vx = p.vx / sp * maxV; p.vy = p.vy / sp * maxV; sp = maxV; }
  const dashOldX = p.x, dashOldY = p.y;
  p.x += p.vx * dt; p.y += p.vy * dt;
  if (p.dashT > 0) dashSmashWalls(p, room, dashOldX, dashOldY); // dash through breakable WALLS smashes them (no silent tunnel-over)
  const w = room.wall - 18;
  p.x = clamp(p.x, w + p.r, room.w - w - p.r);
  p.y = clamp(p.y, w + p.r, room.h - w - p.r);
  for (const o of room.obstacles) if (!o.gone) resolveCircleObstacle(p, o);
  // Entering an unopened vault smashes its door open — so a fast dash can never silently
  // tunnel past the thin sealed door; getting inside ALWAYS releases the contents.
  const ax = room.annex;
  if (ax && !ax.opened && p.x > ax.rect.x && p.x < ax.rect.x + ax.rect.w && p.y > ax.rect.y && p.y < ax.rect.y + ax.rect.h) {
    const door = room.obstacles.find(o => o.species === 'annexDoor' && !o.gone);
    if (door) damageObstacle(room, door, door.hp + 999);
  }
  p.level = levelAt(room, p.x, p.y); // ground=0, raised platform=1 (set by ramps)
  // LATCH onto the perimeter grind rail: dash INTO the edge (jam a wall while dashing) and
  // you grab the rail and start grinding along it. Snaps to the rail, keeps your direction.
  if (!p.railing && p.dashT > 0 && p.railCd <= 0 && p.level === 0) {
    const dL = p.x - room.wall, dR = room.w - room.wall - p.x, dT = p.y - room.wall, dB = room.h - room.wall - p.y;
    // only grab the rail when you dash INTO the edge (jammed a wall, moving into it) — not
    // just whenever a dash ends near a wall.
    if ((dL < 42 && p.vx < -40) || (dR < 42 && p.vx > 40) || (dT < 42 && p.vy < -40) || (dB < 42 && p.vy > 40)) {
      const g = railGeom(room);
      const pos = nearestRailPos(g, p.x, p.y);
      const pt = railPoint(g, pos);
      const along = p.vx * pt.tx + p.vy * pt.ty;
      const aimAlong = p.aimX * pt.tx + p.aimY * pt.ty;
      p.railing = true; p.railPos = pos;
      p.railDir = (Math.abs(along) > 1 ? along : aimAlong) >= 0 ? 1 : -1;
      p.railCd = 0.2; p._dashHitIds = new Set();
      sfx('dash'); addShake(0.22); ripple(room, pt.x, pt.y, room.biome.pal.accent3, 84, 0.45);
    }
  }
  // step/dash onto a launch vent (from the ground) → fling up onto its platform deck
  if (!p.railing && p.level === 0) {
    for (const v of room.vents || []) {
      if (dist(p.x, p.y, v.x, v.y) < v.r + p.r) {
        p.launchT = VENT_DUR; p.launchFrom = { x: p.x, y: p.y }; p.launchTo = { x: v.tx, y: v.ty };
        sfx('dash'); ripple(room, v.x, v.y, room.biome.pal.accent3, 90, 0.5); addShake(0.22);
        break;
      }
    }
  }
  if (p.dashT > 0) performDashCut(p, room, PLAYER.DASH_SWEEP_RANGE || PLAYER.DASH_HIT_RANGE); // cut enemies along the travel, not just at launch

  // trail + afterimages — small motes spawned BEHIND the body (particles draw on
  // top of entities, so a big one here reads as a blob stuck to him; keep it small
  // and offset back so it's a wake, not a smear on his chest)
  if (sp > 60 && !reduced()) {
    const bx = -p.vx / sp, by = -p.vy / sp;
    particle(room, p.x + bx * 26, p.y - 10 + by * 26, p.dashT > 0 ? room.biome.pal.accent3 : room.biome.pal.accent,
      bx * 55, by * 55, p.dashT > 0 ? 0.18 : 0.14, p.dashT > 0 ? 6 : 3.5, 'dot');
  }
  // afterimages — longer-lived and more numerous during a dash so it leaves a clear ghost-streak
  p.after.unshift({ x: p.x, y: p.y, face: p.face, spin: dashSpinPhase(p), life: p.dashT > 0 ? 0.22 : 0.16, dash: p.dashT > 0 });
  const afterCap = p.dashT > 0 ? (view.mobile ? 9 : 13) : (view.mobile ? 6 : 9);
  if (p.after.length > afterCap) p.after.pop();
  for (let i = p.after.length - 1; i >= 0; i--) {
    p.after[i].life -= dt;
    if (p.after[i].life <= 0) p.after.splice(i, 1);
  }
  p.wasMoving = move.active;
  hooks.run('tick', dt);
}

export function resolveCircleObstacle(ent, o) {
  if (o.type === 'circle') {
    const n = norm(ent.x - o.x, ent.y - o.y), min = ent.r + o.rad;
    if (n.m < min) {
      const push = min - n.m;
      ent.x += n.x * push; ent.y += n.y * push;
      ent.vx += n.x * push * 5; ent.vy += n.y * push * 5;
    }
    return;
  }
  const nx = clamp(ent.x, o.x, o.x + o.w), ny = clamp(ent.y, o.y, o.y + o.h);
  const n = norm(ent.x - nx, ent.y - ny);
  if (n.m < ent.r) {
    const push = ent.r - n.m;
    ent.x += n.x * push; ent.y += n.y * push;
    ent.vx += n.x * push * 5; ent.vy += n.y * push * 5;
  }
}

// Flow lanes: while you're within a lane, get pushed along it (sign follows your
// intent), with a soft lateral pull toward the lane so you carve rather than snap.
// Ported from ChatGPT's "neon districts" build. (No gun-kick recoil ported.)
function applyFlowLanes(p, room, move, dt) {
  const lanes = room.flowLanes || [];
  if (!lanes.length) return false;
  // Ride only the single best-aligned lane. Applying every overlapping lane's boost
  // + lateral steer makes crossing lanes fight each other → a net slowdown at junctions.
  const dirX = move.active ? move.x : p.vx, dirY = move.active ? move.y : p.vy;
  const dirLen = Math.hypot(dirX, dirY) || 1;
  let best = null, bestS = null, bestScore = -Infinity;
  for (const l of lanes) {
    const s = pointSegmentInfo(p.x, p.y, l.x1, l.y1, l.x2, l.y2);
    const width = (l.width || 78) + p.r;
    if (s.d > width) continue;
    const falloff = clamp(1 - s.d / width, 0, 1);
    const align = Math.abs((dirX / dirLen) * s.lx + (dirY / dirLen) * s.ly); // parallel-ness
    const score = falloff * (0.45 + align);
    if (score > bestScore) { bestScore = score; best = l; bestS = s; }
  }
  if (!best) return false;
  const l = best, s = bestS;
  const falloff = clamp(1 - s.d / ((l.width || 78) + p.r), 0, 1);
  const intent = move.active ? (move.x * s.lx + move.y * s.ly) : (p.vx * s.lx + p.vy * s.ly);
  const sign = intent < -8 ? -1 : 1;
  const boost = (l.boost || 210) * (0.48 + falloff * 0.72) * (p.dashT > 0 ? 1.55 : 1);
  p.vx += s.lx * sign * boost * dt;
  p.vy += s.ly * sign * boost * dt;
  // soft lateral pull toward the lane so you carve along it without snapping
  const lateral = p.vx * s.nx + p.vy * s.ny;
  const steer = (0.05 + falloff * 0.10) * (p.dashT > 0 ? 0.55 : 1);
  p.vx -= s.nx * lateral * steer;
  p.vy -= s.ny * lateral * steer;
  p.flowT = 0.16;
  if (Math.random() < (p.dashT > 0 ? 0.42 : 0.18)) {
    particle(room, p.x - s.lx * sign * 18, p.y - s.ly * sign * 18, l.color || room.biome.pal.accent3,
      -s.lx * sign * 80 + (Math.random() * 80 - 40), -s.ly * sign * 80 + (Math.random() * 80 - 40), 0.18, 2.5 + falloff * 2.5);
  }
  return true;
}

function pointSegmentInfo(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy || 1;
  const t = clamp(((px - x1) * dx + (py - y1) * dy) / len2, 0, 1);
  const cx = x1 + dx * t, cy = y1 + dy * t;
  const len = Math.sqrt(len2) || 1;
  const lx = dx / len, ly = dy / len;
  return { d: dist(px, py, cx, cy), lx, ly, nx: -ly, ny: lx, t };
}

// nearest live enemy on the player's level — the auto-aim target when not aiming manually.
function nearestEnemy(room, p) {
  let best = null, bd = Infinity;
  const lv = p.level || 0;
  for (const e of room.enemies) {
    if (e.hp <= 0 || (e.level || 0) !== lv) continue;
    const dx = e.x - p.x, dy = e.y - p.y, d = dx * dx + dy * dy;
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

export function firePlayer(p, room) {
  // floor the cadence so stacked fire perks (Redline + 'rapid' pickups both bump perks.fire) can't
  // collapse the cooldown into a bullet/particle hose
  p.fireCd = Math.max(0.075, p.fireDelay * Math.pow(0.9, p.perks.fire));
  p.shots++;
  sfx('shot');
  const ax = p.aimX, ay = p.aimY;
  // Shots leave the visually shrunken muzzle. EMITTER_* are art-space constants;
  // DRAW_SCALE converts them to world-space so the bullets don't float ahead of the gun.
  const S = PLAYER.DRAW_SCALE || 1;
  const elen = PLAYER.EMITTER_LEN * S, eoy = PLAYER.EMITTER_Y * S, toff = PLAYER.TWIN_OFFSET * S;
  const ex = p.x + ax * elen, ey = p.y + eoy + ay * elen;
  // louder muzzle: a bright pop + a wider spray of sparks at the barrel tips
  particle(room, ex, ey, '#ffffff', ax * 70, ay * 70, 0.07, 5.5);
  for (let i = 0; i < 5; i++) {
    particle(room, ex, ey, room.biome.pal.accent,
      ax * (110 + Math.random() * 120) + (Math.random() * 70 - 35),
      ay * (110 + Math.random() * 120) + (Math.random() * 70 - 35), 0.17, 2.0 + Math.random() * 1.8);
  }
  const primed = (p._dashPrimed || 0) > 0;   // "dash primes next shot" relic empowers this volley
  if (primed) p._dashPrimed--;
  const dmgBase = p.damage * (1 + p.perks.damage * 0.15);
  const crit = Math.random() < p.crit;
  let dmg = dmgBase * PLAYER.SHOT_MULT * (crit ? PLAYER.CRIT_MULT : 1);
  if (primed) dmg *= PLAYER.DASH_PRIME_MULT;
  // twin-relay: two shots offset perpendicular (No Moon twin weapon)
  const px = -ay, py = ax;
  const r = primed ? PLAYER.SHOT_R * 1.5 : PLAYER.SHOT_R;
  const col = primed ? '#eaffff' : (crit ? '#ffffff' : room.biome.pal.accent);
  for (let side = -1; side <= 1; side += 2) {
    spawnBullet(room, 'player',
      ex + px * toff * side, ey + py * toff * side,
      ax * PLAYER.SHOT_SPEED + px * 28 * side, ay * PLAYER.SHOT_SPEED + py * 28 * side,
      r, dmg, PLAYER.SHOT_LIFE, col,
      { level: p.level, pierce: primed ? PLAYER.DASH_PRIME_PIERCE : 0, primed });
  }
  hooks.run('onFire', p, { x: ax, y: ay, oy: eoy });
}

// The dash is a continuous sweep: called at launch (big bite) and every frame while
// dashing (sweep range), so it cuts everything along the ~430px travel — not just
// whoever stood next to the launch pad. A per-dash Set caps each enemy to one hit.
function performDashCut(p, room, range) {
  if (!(p._dashHitIds instanceof Set)) p._dashHitIds = new Set();
  const dmg = p.damage * (1 + p.perks.damage * 0.15) * PLAYER.DASH_HIT_MULT;
  let hits = 0;
  for (const e of room.enemies) {
    if (e.hp <= 0 || e.level !== p.level) continue; // dash only cuts your own level
    const key = e.id ?? e;
    if (p._dashHitIds.has(key)) continue;           // one hit per enemy per dash
    if (dist(p.x, p.y, e.x, e.y) < range + e.r) {
      p._dashHitIds.add(key);
      const k = norm(e.x - p.x, e.y - p.y);
      damageEnemy(e, dmg, k.x * PLAYER.DASH_KNOCK, k.y * PLAYER.DASH_KNOCK, 'dash');
      // make it obvious the dash cut through: bright spark + a slash mark
      burst(room, e.x, e.y, '#ffffff', 9, 240, 0.28, 3);
      addFloat(room, e.x, e.y - e.r - 8, '✦', '#ffffff', false, 0.34);
      hits++;
    }
  }
  if (hits) {
    addFlash(0.14); addShake(0.26);
    // prime the next shot ONCE per dash (not once per enemy cut), so blender-dashing a
    // crowd doesn't turn into a frame-rate fire hose
    if (!p._dashCutPrimed) { p._dashCutPrimed = true; p.fireCd = 0; }
  }
  return hits;
}

export function tryDash(dx = null, dy = null, move = null) {
  if (state.mode !== 'play' || !state.run) return;
  const p = state.run.player, room = state.room;
  if (p.railing) { releaseRail(p, room, move); return; } // dash while grinding = leap off the rail
  if (p.dashCd > 0 || p.dashT > 0) return; // can't restart a dash mid-dash (refunds could otherwise chain it)
  if (dx == null) {
    if (move && move.active) { dx = move.x; dy = move.y; }
    else { dx = p.aimX; dy = p.aimY; }
  }
  const n = norm(dx, dy);
  if (n.m < 0.08) return;
  p.lastDashAngle = Math.atan2(n.y, n.x);
  p.vx = n.x * PLAYER.DASH_IMPULSE; p.vy = n.y * PLAYER.DASH_IMPULSE;
  p.dashT = p.dashDur;
  p._dashHitIds = new Set(); p._dashCutPrimed = false; // fresh per-dash hit-set + prime gate
  p.dashSpinDir = (n.x * p.aimY - n.y * p.aimX) >= 0 ? 1 : -1;
  p.inv = Math.max(p.inv, PLAYER.DASH_IFRAMES);
  p.dashCd = p.dashCdBase;
  p.dashes++;
  sfx('dash'); haptic(14); hitPause('shot'); addShake(0.16);
  ripple(room, p.x, p.y, room.biome.pal.accent3, 76); // launch punctuation
  for (let i = 0; i < 28; i++) {
    particle(room, p.x - n.x * 10, p.y - n.y * 10, room.biome.pal.accent3,
      -n.x * (150 + Math.random() * 270) + (Math.random() * 180 - 90),
      -n.y * (150 + Math.random() * 270) + (Math.random() * 180 - 90), 0.32, 2 + Math.random() * 3.8);
  }
  const hits = performDashCut(p, room, PLAYER.DASH_HIT_RANGE); // launch bite; the per-frame sweep continues it along the travel
  hooks.run('onDash', p, hits);   // relics (e.g. dash-primes-shot) listen here
  // bigger dash = bigger feedback
  slowMo(0.06);
}
