// Boss brains. Warden + Archon are full No Moon ports (docs/no-moon-systems.md §2,
// game_inline.js:9025-9087); False Moon + Spiggot are new minibosses built on the
// same template (one signature pattern each, ~40-45% boss HP).
import { state } from '../state.js';
import { TAU } from '../config.js';
import { clamp, damp, dist, norm } from '../rng.js';
import { fireEnemyBurst, fireEnemyRing, fireEnemyShot } from './bullets.js';
import { spawnTelegraphed, makeEnemy } from './enemies.js';
import { addFloat, burst } from '../render/particles.js';
import { addSlowFog } from './hazards.js';
import { sfx } from '../audio/sfx.js';

export const BOSSES = {
  falseMoon: {
    name: 'False Moon', round: 5, hp: 36, r: 36, speed: 70, color: '#f0b8ff',
    score: 600, card: 'false-moon-card', brain: falseMoonBrain,
  },
  warden: {
    name: 'Graven Warden', round: 10, hp: 76, r: 44, speed: 82, color: '#ffe27d',
    score: 980, card: 'warden-card', brain: wardenBrain,
  },
  spiggot: {
    name: 'Spiggot', round: 15, hp: 58, r: 38, speed: 78, color: '#9effdc',
    score: 800, card: 'spiggot-card', brain: spiggotBrain,
  },
  archon: {
    name: 'Null Archon', round: 20, hp: 126, r: 54, speed: 88, color: '#f5d9ff',
    score: 1800, card: 'archon-card', brain: archonBrain,
  },
};

const BOSS_ORDER = ['falseMoon', 'warden', 'spiggot', 'archon'];

export function bossForRound(round, overdrive) {
  if (round % 5 !== 0) return null;
  if (!overdrive && round <= 20) {
    return Object.entries(BOSSES).find(([, b]) => b.round === round)?.[0] ?? null;
  }
  // overdrive: cycle the roster, scaling handled by stage
  return BOSS_ORDER[(Math.floor(round / 5) - 1) % BOSS_ORDER.length];
}

export function makeBoss(bossId, room) {
  const def = BOSSES[bossId];
  const e = makeEnemy('skitter', room.w / 2, room.wall + 150, room); // base shell, fully overridden
  const hpScale = 1 + room.idx * 0.08 + room.stage * 0.06;
  const spdScale = 1 + room.stage * 0.03;
  Object.assign(e, {
    type: 'boss', bossId, boss: true, display: def.name,
    r: def.r, hp: def.hp * hpScale, maxHp: def.hp * hpScale,
    speed: def.speed * spdScale, color: def.color, score: def.score,
    brain: def.brain, fireCd: 1.2, ringCd: 2.4, dashCd: 3.4, summons: 0, phaseLock: 0,
  });
  return e;
}

function summonFromBoss(boss, types, room) {
  for (const type of types) {
    for (let tries = 0; tries < 12; tries++) {
      const a = Math.random() * TAU, d = 34 + Math.random() * 76;
      const x = boss.x + Math.cos(a) * (boss.r + d);
      const y = boss.y + Math.sin(a) * (boss.r + d);
      if (x > room.wall + 30 && x < room.w - room.wall - 30 && y > room.wall + 30 && y < room.h - room.wall - 30) {
        spawnTelegraphed(room, type, x, y, 0.7);
        break;
      }
    }
  }
  addFloat(room, boss.x, boss.y - boss.r - 26, 'IT CALLS', room.biome.pal.bad, false, 0.6);
  burst(room, boss.x, boss.y, boss.color, 16, 200, 0.5, 3);
  sfx('telegraph');
}

// ── Graven Warden (game_inline.js:9025-9055) ────────────────────────────────
function wardenBrain(e, room, p, to, d, dt) {
  const idx = room.idx;
  const hpFrac = e.hp / e.maxHp;
  e.phaseLock = Math.max(0, (e.phaseLock || 0) - dt);
  if (hpFrac < 0.75 && e.summons < 1) { e.summons = 1; e.phaseLock = 0.70; summonFromBoss(e, ['skitter', 'gunner'], room); }
  if (hpFrac < 0.46 && e.summons < 2) { e.summons = 2; e.phaseLock = 0.82; summonFromBoss(e, ['charger', 'brute'], room); }
  const phase3 = hpFrac < 0.46;

  let ax = to.x * e.speed * 0.78, ay = to.y * e.speed * 0.78;
  if (e.phaseLock > 0) { ax *= 0.2; ay *= 0.2; }
  e.vx = damp(e.vx, ax, 5, dt); e.vy = damp(e.vy, ay, 5, dt);

  e.fireCd -= dt; e.ringCd -= dt;
  const enemyBullets = room.bullets.reduce((n, b) => n + (b.owner === 'enemy' ? 1 : 0), 0);
  if (e.phaseLock <= 0 && enemyBullets < 108) {
    if (e.fireCd <= 0) {
      e.fireCd = phase3 ? 1.12 : 1.46;
      fireEnemyBurst(room, e, p.x, p.y, phase3 ? 5 : 4, phase3 ? 0.92 : 0.74, 266 + idx * 10, 3.2, '#ffe394');
    }
    if (e.ringCd <= 0) {
      e.ringCd = phase3 ? 2.45 : 3.18;
      fireEnemyRing(room, e, phase3 ? 12 : 10, 202 + idx * 8, 3.25, '#ffe394', e.phase * 0.45);
    }
  }
}

// ── Null Archon (game_inline.js:9056-9087) ──────────────────────────────────
function archonBrain(e, room, p, to, d, dt) {
  const idx = room.idx;
  const hpFrac = e.hp / e.maxHp;
  e.phaseLock = Math.max(0, (e.phaseLock || 0) - dt);
  if (hpFrac < 0.82 && e.summons < 1) { e.summons = 1; e.phaseLock = 0.7; summonFromBoss(e, ['charger', 'sniper'], room); }
  if (hpFrac < 0.58 && e.summons < 2) { e.summons = 2; e.phaseLock = 0.7; summonFromBoss(e, ['hexer', 'myrmidon'], room); }
  if (hpFrac < 0.34 && e.summons < 3) { e.summons = 3; e.phaseLock = 0.82; summonFromBoss(e, ['brute', 'sniper', 'hexer'], room); }
  const enraged = hpFrac < 0.34;

  let ax = to.x * e.speed * 0.88, ay = to.y * e.speed * 0.88;
  if (e.phaseLock > 0) { ax *= 0.2; ay *= 0.2; }
  e.dashCd -= dt;
  if (d < 540 && e.dashCd <= 0) {
    e.dashCd = 2.6;
    const a = Math.atan2(to.y, to.x) + (Math.random() < 0.5 ? 0.82 : -0.82);
    e.vx += Math.cos(a) * 240; e.vy += Math.sin(a) * 240;
  }
  e.vx = damp(e.vx, ax, 5, dt); e.vy = damp(e.vy, ay, 5, dt);

  e.fireCd -= dt; e.ringCd -= dt;
  if (e.phaseLock <= 0) {
    if (e.fireCd <= 0) {
      e.fireCd = enraged ? 0.72 : 1.0;
      fireEnemyBurst(room, e, p.x, p.y, enraged ? 9 : 7, enraged ? 1.4 : 1.05, 310 + idx * 14, 4.1, '#f7dbff');
    }
    if (e.ringCd <= 0) {
      e.ringCd = enraged ? 1.22 : 1.7;
      fireEnemyRing(room, e, enraged ? 18 : 14, 235 + idx * 12, 4.2, '#ffeaa9', e.seed + e.phase * 0.3);
    }
  }
}

// ── False Moon (miniboss: mirrors your aim back at you) ─────────────────────
function falseMoonBrain(e, room, p, to, d, dt) {
  const idx = room.idx;
  const hpFrac = e.hp / e.maxHp;
  // slow orbit, keeps middle distance
  const orbit = Math.atan2(e.y - p.y, e.x - p.x) + Math.PI / 2;
  const want = d < 300 ? -0.8 : d > 520 ? 0.9 : 0.05;
  const ax = to.x * e.speed * want + Math.cos(orbit) * e.speed * 0.85;
  const ay = to.y * e.speed * want + Math.sin(orbit) * e.speed * 0.85;
  e.vx = damp(e.vx, ax, 5.5, dt); e.vy = damp(e.vy, ay, 5.5, dt);

  e.fireCd -= dt; e.ringCd -= dt;
  if (e.fireCd <= 0 && d < 820) {
    e.fireCd = 1.15;
    // signature: a volley along YOUR aim line, reflected back (punishes tunnel vision)
    const mirror = Math.atan2(p.aimY, p.aimX) + Math.PI;
    for (let k = -1; k <= 1; k++) {
      const a = mirror + k * 0.14;
      fireEnemyShot(room, e, Math.cos(a), Math.sin(a), 330 + idx * 8, 5.4, 2.6, '#f0b8ff');
    }
    fireEnemyBurst(room, e, p.x, p.y, 2, 0.22, 280 + idx * 8, 2.8, '#f0b8ff');
  }
  if (hpFrac < 0.5 && e.ringCd <= 0) {
    e.ringCd = 2.7;
    fireEnemyRing(room, e, 8, 190 + idx * 7, 3.0, '#f0b8ff', e.phase * 0.6);
  }
  if (hpFrac < 0.55 && e.summons < 1) { e.summons = 1; summonFromBoss(e, ['skitter', 'skitter'], room); }
}

// ── Spiggot (miniboss: spore rings + skitter brood) ─────────────────────────
function spiggotBrain(e, room, p, to, d, dt) {
  const idx = room.idx;
  const hpFrac = e.hp / e.maxHp;
  const ax = to.x * e.speed * 0.7 + Math.cos(e.phase * 1.4) * 50;
  const ay = to.y * e.speed * 0.7 + Math.sin(e.phase * 1.2) * 50;
  e.vx = damp(e.vx, ax, 5, dt); e.vy = damp(e.vy, ay, 5, dt);

  e.ringCd -= dt; e.fireCd -= dt;
  if (e.ringCd <= 0) {
    e.ringCd = 2.1;
    fireEnemyRing(room, e, 10, 170 + idx * 6, 3.4, '#9effdc', e.phase * 0.8);
  }
  if (e.fireCd <= 0 && d < 600) {
    e.fireCd = 1.5;
    fireEnemyBurst(room, e, p.x, p.y, 3, 0.34, 250 + idx * 8, 2.9, '#c596ff');
  }
  // brood at 75/50/25%
  const broodAt = [0.75, 0.5, 0.25];
  if (e.summons < broodAt.length && hpFrac < broodAt[e.summons]) {
    e.summons++;
    summonFromBoss(e, ['skitter', 'skitter'], room);
    addSlowFog(room, e.x, e.y, { r: 100, slow: 0.66, color: '#9effdc' });
  }
}
