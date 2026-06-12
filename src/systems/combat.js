// Shared damage/kill/hurt resolution — the one place hp changes hands.
import { state } from '../state.js';
import { PLAYER } from '../config.js';
import { norm } from '../rng.js';
import { particle, burst, addFloat } from '../render/particles.js';
import { addShake, addFlash, hitPause, haptic } from './juice.js';
import { sfx } from '../audio/sfx.js';
import { killScore } from './score.js';
import { hooks } from './items.js';

export function damageEnemy(e, dmg, kx = 0, ky = 0, kind = 'shot') {
  if (e.hp <= 0) return;
  e.hp -= dmg;
  e.vx += kx; e.vy += ky;
  e.hit = 0.11;
  e.stun = Math.max(e.stun || 0, 0.032);
  const room = state.room;
  hitPause(kind === 'pulse' ? 'pulse' : kind === 'dash' ? 'dash' : kind === 'chain' ? 'chain' : 'shot');
  addShake(kind === 'pulse' ? 0.16 : kind === 'dash' ? 0.09 : 0.035);
  for (let i = 0; i < 4; i++) {
    particle(room, e.x, e.y, kind === 'pulse' ? room.biome.pal.accent3 : e.color,
      (Math.random() * 180 - 90) + kx * 0.08, (Math.random() * 180 - 90) + ky * 0.08, 0.22, 2 + Math.random() * 2.4);
  }
  hooks.run('onHit', e, dmg, kind);
  if (e.hp <= 0) killEnemy(e);
}

export function killEnemy(e) {
  const room = state.room, run = state.run, p = run.player;
  e.hp = 0;
  killScore(e);
  p.pulse = Math.min(100, p.pulse + (e.boss ? PLAYER.PULSE_PER_BOSS : PLAYER.PULSE_PER_KILL) * p.pulseGain);
  // spark scatter (meta currency + pulse food)
  const n = e.boss ? 24 : (e.captain ? 8 : 3 + Math.floor(Math.random() * 3));
  for (let i = 0; i < n; i++) {
    room.pickups.push({
      type: 'spark', x: e.x + Math.random() * 24 - 12, y: e.y + Math.random() * 24 - 12,
      vx: Math.random() * 240 - 120, vy: Math.random() * 240 - 120, r: 6, life: 8,
    });
  }
  if ((e.boss || Math.random() < 0.035) && p.hp < p.maxHp) {
    room.pickups.push({ type: 'repair', x: e.x, y: e.y, vx: Math.random() * 160 - 80, vy: Math.random() * 160 - 80, r: 11, life: 8 });
  }
  burst(room, e.x, e.y, e.color, e.boss ? 42 : 13, 170, 0.5, 3);
  hitPause(e.boss ? 'boss' : 'kill');
  addShake(e.boss ? 0.26 : 0.10);
  sfx('kill');
  if (e.captainDeath) e.captainDeath(e);
  hooks.run('onKill', e);
}

export function hurtPlayer(amount, sx, sy, source = 'hit') {
  const p = state.run?.player, room = state.room;
  if (!p || p.inv > 0 || state.mode !== 'play') return false;
  if (p.shield > 0) {
    p.shield--; amount = 0;
    p.inv = 0.36;
    addFloat(room, p.x, p.y - 44, 'GUARD', '#aef3ff');
  } else {
    p.hp -= amount;
    p.inv = PLAYER.HURT_IFRAMES;
  }
  p.roomHit = true;
  p.hurt = 0.34;
  addShake(0.46); addFlash(0.32); hitPause('hurt'); haptic(48);
  sfx('hurt');
  const k = norm(p.x - sx, p.y - sy);
  p.vx += k.x * PLAYER.HURT_KNOCK; p.vy += k.y * PLAYER.HURT_KNOCK;
  burst(room, p.x, p.y, room?.biome?.pal.bad || '#ff6b6b', 20, 140, 0.45, 3);
  hooks.run('onPlayerHurt', amount, source);
  if (p.hp <= 0) p.dead = true; // rooms.js notices and runs the death flow
  return true;
}
