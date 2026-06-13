// Moots. Movement/dash/pulse are Boon Moots v50 ports (docs/boon-moots-notes.md §3);
// weapon and damage scale are No Moon's Moots (twin-relay).
import { PLAYER, TAU } from '../config.js';
import { state } from '../state.js';
import { clamp, damp, dist, norm } from '../rng.js';
import { particle, burst, addFloat } from '../render/particles.js';
import { addShake, addFlash, slowMo, hitPause, haptic, reduced } from './juice.js';
import { sfx } from '../audio/sfx.js';
import { spawnBullet } from './bullets.js';
import { damageEnemy } from './combat.js';
import { hooks } from './items.js';
import { view } from '../render/camera.js';
import { levelAt } from './levels.js';

export function makePlayer() {
  return {
    x: 750, y: 700, vx: 0, vy: 0, r: PLAYER.R, aimX: 1, aimY: 0, face: 0, level: 0,
    hp: PLAYER.MAX_HP, maxHp: PLAYER.MAX_HP, shield: 0, shieldMax: 0, shieldTimer: 0,
    inv: 0, hurt: 0, dead: false, roomHit: false,
    speed: PLAYER.SPEED, baseSpeed: PLAYER.SPEED,
    accel: PLAYER.ACCEL, stop: PLAYER.STOP, turn: PLAYER.TURN, lateral: PLAYER.LATERAL,
    fireDelay: PLAYER.FIRE_DELAY, fireCd: 0, damage: PLAYER.DAMAGE, crit: PLAYER.CRIT,
    dashCdBase: PLAYER.DASH_CD, dashCd: 0, dashT: 0, dashDur: PLAYER.DASH_DUR,
    dashSpinDir: 1, lastDashAngle: null, after: [],
    pickup: PLAYER.PICKUP_RANGE,
    perks: { damage: 0, fire: 0, speed: 0, maxHp: 0 },
    modules: {},
    boon: { charges: 0, progress: 0, need: 2 },
    shots: 0, dashes: 0, stillT: 0, wasMoving: false, brakeT: 0,
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
  p.dashT = Math.max(0, p.dashT - dt);
  p.brakeT = Math.max(0, p.brakeT - dt);
  if (p.shieldMax > 0 && p.shield < p.shieldMax) {
    p.shieldTimer += dt;
    if (p.shieldTimer >= 10) { p.shield++; p.shieldTimer = 0; }
  }

  p.aimX = aim.x; p.aimY = aim.y;
  p.face = Math.atan2(p.aimY, p.aimX);
  if (aim.active && p.fireCd <= 0) firePlayer(p, room);

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
  const maxV = p.speed * (p.dashT > 0 ? PLAYER.DASH_SPEED_MULT : PLAYER.MAX_SPEED_MULT);
  let sp = Math.hypot(p.vx, p.vy);
  if (sp > maxV) { p.vx = p.vx / sp * maxV; p.vy = p.vy / sp * maxV; sp = maxV; }
  p.x += p.vx * dt; p.y += p.vy * dt;
  const w = room.wall - 18;
  p.x = clamp(p.x, w + p.r, room.w - w - p.r);
  p.y = clamp(p.y, w + p.r, room.h - w - p.r);
  for (const o of room.obstacles) if (!o.gone) resolveCircleObstacle(p, o);
  p.level = levelAt(room, p.x, p.y); // ground=0, raised platform=1 (set by ramps)

  // trail + afterimages
  if (sp > 44 && !reduced()) {
    particle(room, p.x - p.vx * 0.03, p.y - p.vy * 0.03, p.dashT > 0 ? room.biome.pal.accent3 : room.biome.pal.accent,
      -p.vx * 0.055, -p.vy * 0.055, p.dashT > 0 ? 0.13 : 0.16, 9 + sp * 0.026, 'dot');
  }
  p.after.unshift({ x: p.x, y: p.y, face: p.face, spin: dashSpinPhase(p), life: p.dashT > 0 ? 0.13 : 0.16 });
  if (p.after.length > (view.mobile ? 6 : 9)) p.after.pop();
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

export function firePlayer(p, room) {
  p.fireCd = p.fireDelay * Math.pow(0.9, p.perks.fire);
  p.shots++;
  sfx('shot');
  const ax = p.aimX, ay = p.aimY;
  // shots leave the emitter barrel tip (body level, in the aim direction)
  const ex = p.x + ax * PLAYER.EMITTER_LEN, ey = p.y + PLAYER.EMITTER_Y + ay * PLAYER.EMITTER_LEN;
  for (let i = 0; i < 3; i++) {
    particle(room, ex, ey, room.biome.pal.accent,
      ax * (90 + Math.random() * 90) + (Math.random() * 50 - 25),
      ay * (90 + Math.random() * 90) + (Math.random() * 50 - 25), 0.16, 1.8 + Math.random() * 1.5);
  }
  const dmgBase = p.damage * (1 + p.perks.damage * 0.15);
  const crit = Math.random() < p.crit;
  const dmg = dmgBase * PLAYER.SHOT_MULT * (crit ? PLAYER.CRIT_MULT : 1);
  // twin-relay: two shots offset perpendicular (No Moon twin weapon)
  const px = -ay, py = ax;
  for (let side = -1; side <= 1; side += 2) {
    spawnBullet(room, 'player',
      ex + px * PLAYER.TWIN_OFFSET * side, ey + py * PLAYER.TWIN_OFFSET * side,
      ax * PLAYER.SHOT_SPEED + px * 28 * side, ay * PLAYER.SHOT_SPEED + py * 28 * side,
      PLAYER.SHOT_R, dmg, PLAYER.SHOT_LIFE, crit ? '#ffffff' : room.biome.pal.accent, { level: p.level });
  }
  hooks.run('onFire', p, { x: ax, y: ay, oy: PLAYER.EMITTER_Y });
}

export function tryDash(dx = null, dy = null, move = null) {
  if (state.mode !== 'play' || !state.run) return;
  const p = state.run.player, room = state.room;
  if (p.dashCd > 0) return;
  if (dx == null) {
    if (move && move.active) { dx = move.x; dy = move.y; }
    else { dx = p.aimX; dy = p.aimY; }
  }
  const n = norm(dx, dy);
  if (n.m < 0.08) return;
  p.lastDashAngle = Math.atan2(n.y, n.x);
  p.vx = n.x * PLAYER.DASH_IMPULSE; p.vy = n.y * PLAYER.DASH_IMPULSE;
  p.dashT = p.dashDur;
  p.dashSpinDir = (n.x * p.aimY - n.y * p.aimX) >= 0 ? 1 : -1;
  p.inv = Math.max(p.inv, PLAYER.DASH_IFRAMES);
  p.dashCd = p.dashCdBase;
  p.dashes++;
  sfx('dash'); haptic(14); hitPause('shot'); addShake(0.075);
  for (let i = 0; i < 28; i++) {
    particle(room, p.x - n.x * 10, p.y - n.y * 10, room.biome.pal.accent3,
      -n.x * (150 + Math.random() * 270) + (Math.random() * 180 - 90),
      -n.y * (150 + Math.random() * 270) + (Math.random() * 180 - 90), 0.32, 2 + Math.random() * 3.8);
  }
  const dmg = p.damage * (1 + p.perks.damage * 0.15) * PLAYER.DASH_HIT_MULT;
  let hits = 0;
  for (const e of room.enemies) {
    if (e.hp <= 0 || e.level !== p.level) continue; // dash only cuts your own level
    if (dist(p.x, p.y, e.x, e.y) < PLAYER.DASH_HIT_RANGE + e.r) {
      const k = norm(e.x - p.x, e.y - p.y);
      damageEnemy(e, dmg, k.x * PLAYER.DASH_KNOCK, k.y * PLAYER.DASH_KNOCK, 'dash');
      // make it obvious the dash cut through: bright spark + a slash mark
      burst(room, e.x, e.y, '#ffffff', 9, 240, 0.28, 3);
      addFloat(room, e.x, e.y - e.r - 8, '✦', '#ffffff', false, 0.34);
      hits++;
    }
  }
  if (hits) { addFlash(0.12); addShake(0.12); }
  // bigger dash = bigger feedback
  slowMo(0.06);
}
