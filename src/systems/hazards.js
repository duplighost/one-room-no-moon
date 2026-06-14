// The 10 No Moon hazard mechanics at Boon Moots kit scale
// (boon-moots index.html:690-714 mechanics; No Moon parameters via data/hazardKits.js).
import { state } from '../state.js';
import { clamp, dist, norm, rand, randi } from '../rng.js';
import { HAZARD_KITS } from '../data/hazardKits.js';
import { levelAt } from './levels.js';
import { hurtPlayer } from './combat.js';
import { fireEnemyShot } from './bullets.js';

function kitParam(kit, key, stage) {
  let v = kit[key];
  if (Array.isArray(v)) v = (v[0] + v[1]) / 2;
  const per = kit.perStage?.[key] || 0;
  return v + per * stage;
}

export function seedHazards(room, rng) {
  const type = room.biome.hazard;
  const kit = HAZARD_KITS[type];
  if (!kit) return;
  const stage = room.stage;
  const w = room.wall;

  if (type === 'pulse' || type === 'ritual') {
    const spots = kit.altars === 1
      ? [{ x: room.w * 0.5, y: room.h * 0.48 }]
      : [{ x: room.w * 0.5, y: room.h * 0.40 }, { x: room.w * 0.34, y: room.h * 0.62 }, { x: room.w * 0.66, y: room.h * 0.62 }];
    for (const s of spots) {
      room.hazards.push({
        type, x: s.x + rand(rng, -40, 40), y: s.y + rand(rng, -30, 30), r: kit.r,
        period: Math.max(1.2, rand(rng, kit.period[0], kit.period[1]) + (kit.perStage.period || 0) * stage),
        active: kit.active, waveSpan: Math.min(room.w, room.h) * kit.waveSpan,
        t: rng() * 2, wave: 0, on: false, hitCd: 0,
        color: type === 'ritual' ? room.biome.pal.accent : room.biome.pal.accent2,
      });
    }
    return;
  }

  if (type === 'lane' || type === 'sightline') {
    const n = Math.round(clamp(randi(rng, kit.count[0], kit.count[1]) + (kit.perStage.count || 0) * stage, 2, 7))
      - (state.runMobileLite ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const vertical = type === 'lane' ? i % 2 === 0 : rng() < 0.45;
      const pos = vertical ? rand(rng, w + 200, room.w - w - 200) : rand(rng, w + 170, room.h - w - 170);
      room.lanes.push({
        type, vertical,
        x1: vertical ? pos : w + 40, y1: vertical ? w + 40 : pos,
        x2: vertical ? pos : room.w - w - 40, y2: vertical ? room.h - w - 40 : pos,
        width: kit.width,
        t: rng() * 2.4,
        period: Math.max(1.6, rand(rng, kit.period[0], kit.period[1]) + (kit.perStage.period || 0) * stage),
        telegraphFrom: kit.telegraphFrom, activeFrom: kit.activeFrom, activeTo: kit.activeTo,
        active: false, tele: false, hitCd: 0,
        color: vertical ? room.biome.pal.accent : room.biome.pal.accent2,
      });
    }
    return;
  }

  // area hazards: fog/spore/snare/thorn/shard/volatile
  const n = Math.round(clamp(randi(rng, kit.count[0], kit.count[1]) + (kit.perStage.count || 0) * stage, 2, 9));
  for (let i = 0; i < n; i++) {
    for (let tries = 0; tries < 24; tries++) {
      const x = rand(rng, w + 110, room.w - w - 110);
      const y = rand(rng, w + 100, room.h - w - 100);
      if (dist(x, y, room.w / 2, room.h * 0.66) < 330) continue; // not on spawn
      room.hazards.push({
        type, x, y, r: rand(rng, kit.r[0], kit.r[1]) + (kit.perStage.r || 0) * stage,
        phase: rng() * 6, cd: rng() * 1.2, hitCd: 0,
        slow: kit.slow, coreFrac: kit.coreFrac, coreDmgCd: kit.coreDmgCd,
        spitCd: kit.spitCd, spitSpeed: kitParam(kit, 'spitSpeed', stage), spitRange: kit.spitRange,
        spreadShots: kit.spreadShots || 1,
        color: (type === 'fog' || type === 'snare') ? room.biome.pal.accent : room.biome.pal.accent2,
      });
      break;
    }
  }
  // tag each hazard with the level it sits on (high ground is safe from ground hazards)
  for (const h of room.hazards) h.level = levelAt(room, h.x, h.y);
  for (const l of room.lanes) l.level = 0;
}

export function updateHazards(room, dt) {
  const p = state.run.player;
  // once the room is cleared the walk to the portal is a victory lap: hazards go
  // inert (no fire, no contact damage, no slow). In-flight shots were wiped at
  // clear, and nothing new spawns here. draw.js dims them so it reads as off.
  if (room.cleared) return;
  for (const h of room.hazards) {
    h.phase = (h.phase || 0) + dt;
    h.cd = Math.max(0, (h.cd || 0) - dt);
    h.hitCd = Math.max(0, (h.hitCd || 0) - dt);
    const d = dist(h.x, h.y, p.x, p.y);
    const harm = (h.level || 0) === p.level; // only harms a player on its level

    if (h.type === 'lotus') {
      // slows ENEMIES only (marrowSpring's gift / blackLotus load-in bloom)
      if (h.life !== undefined) { h.life -= dt; }
      for (const e of room.enemies) {
        if (e.hp > 0 && dist(h.x, h.y, e.x, e.y) < h.r + e.r) {
          e.slowTimer = Math.max(e.slowTimer || 0, 0.2);
          e.slowMul = Math.min(e.slowMul, h.slow);
        }
      }
    } else if (h.type === 'fog' || h.type === 'spore') {
      if (harm && d < h.r + p.r) {
        p.vx *= Math.pow(h.slow, dt * 8); p.vy *= Math.pow(h.slow, dt * 8);
        if (h.type === 'spore' && h.cd <= 0 && p.inv <= 0 && d < h.r * h.coreFrac + p.r) {
          h.cd = h.coreDmgCd;
          hurtPlayer(1, h.x, h.y, 'hazard');
        }
      }
      if (h.type === 'spore' && h.cd <= 0 && d < h.spitRange) {
        h.cd = rand(Math.random, h.spitCd[0], h.spitCd[1]);
        const n = norm(p.x - h.x, p.y - h.y);
        fireEnemyShot(room, h, n.x, n.y, h.spitSpeed, 4.8, 2.2, h.color);
      }
    } else if (h.type === 'snare' || h.type === 'thorn') {
      if (harm && d < h.r + p.r) {
        p.vx *= Math.pow(0.62, dt * 9); p.vy *= Math.pow(0.62, dt * 9);
        if (h.cd <= 0 && p.inv <= 0 && d < h.r * h.coreFrac + p.r) {
          h.cd = h.coreDmgCd;
          hurtPlayer(1, h.x, h.y, 'hazard');
        }
      }
      if (h.cd <= 0 && d < h.r + h.spitRange) {
        h.cd = rand(Math.random, h.spitCd[0], h.spitCd[1]);
        const n = norm(p.x - h.x, p.y - h.y);
        fireEnemyShot(room, h, n.x, n.y, h.spitSpeed, 5.6, 1.5, h.color);
      }
    } else if (h.type === 'shard' || h.type === 'volatile') {
      if (h.cd <= 0 && d < h.spitRange) {
        h.cd = rand(Math.random, h.spitCd[0], h.spitCd[1]);
        const base = Math.atan2(p.y - h.y, p.x - h.x);
        const spread = h.spreadShots === 3 ? [-0.18, 0, 0.18] : [0];
        for (const off of spread) {
          fireEnemyShot(room, h, Math.cos(base + off), Math.sin(base + off), h.spitSpeed, 4.6, 2.15, h.color);
        }
      }
      if (harm && d < h.r + p.r && p.inv <= 0) hurtPlayer(1, h.x, h.y, 'hazard');
    } else if (h.type === 'pulse' || h.type === 'ritual') {
      h.t = ((h.t || 0) + dt) % h.period;
      const on = h.t > 0.64;
      h.on = on;
      h.wave = on ? ((h.t - 0.64) / Math.max(0.1, h.period - 0.64)) * h.waveSpan : 0;
      if (harm && on && h.hitCd <= 0 && Math.abs(d - h.wave) < p.r + 10 && p.inv <= 0) {
        h.hitCd = 0.55;
        hurtPlayer(1, h.x, h.y, 'hazard');
      }
    }
  }

  for (let i = room.hazards.length - 1; i >= 0; i--) {
    if (room.hazards[i].life !== undefined && room.hazards[i].life <= 0) room.hazards.splice(i, 1);
  }

  for (const l of room.lanes) {
    l.t = ((l.t || 0) + dt) % l.period;
    l.hitCd = Math.max(0, (l.hitCd || 0) - dt);
    const ph = l.t / l.period;
    l.tele = ph > l.telegraphFrom && ph <= l.activeFrom;
    l.active = ph > l.activeFrom && ph < l.activeTo;
    if (l.active && l.hitCd <= 0 && p.inv <= 0 && (l.level || 0) === p.level &&
        distPointSegment(p.x, p.y, l.x1, l.y1, l.x2, l.y2) < p.r + l.width * 0.5) {
      l.hitCd = 0.65;
      hurtPlayer(1, (l.x1 + l.x2) / 2, (l.y1 + l.y2) / 2, 'hazard');
    }
  }
}

export function distPointSegment(px, py, x1, y1, x2, y2) {
  const vx = x2 - x1, vy = y2 - y1, wx = px - x1, wy = py - y1;
  const c = clamp((wx * vx + wy * vy) / Math.max(1, vx * vx + vy * vy), 0, 1);
  return Math.hypot(px - (x1 + vx * c), py - (y1 + vy * c));
}

export function addPulseHazard(room, x, y, opts = {}) {
  room.hazards.push({
    type: 'pulse', x, y, r: opts.r || 30,
    period: opts.period || 2.6, active: 0.42, waveSpan: opts.span || 240,
    t: 0, wave: 0, on: false, hitCd: 0,
    color: opts.color || room.biome.pal.accent2,
  });
}

export function addSlowFog(room, x, y, opts = {}) {
  room.hazards.push({
    type: 'fog', x, y, r: opts.r || 96, slow: opts.slow || 0.58,
    phase: 0, cd: 0, hitCd: 0, color: opts.color || room.biome.pal.accent,
  });
}
