// Round lifecycle: transition → live → clear → portal → next. Boon Moots'
// skeleton (index.html:277-305, 911-948) with the Room Roller in place of the
// theme deck.
import { state, newRun, bankBests, saveNow } from '../state.js';
import { dist } from '../rng.js';
import { rollRoom } from './roomRoller.js';
import { makePlayer } from './player.js';
import { roomClearScore } from './score.js';
import { vacuumSparks } from './pickups.js';
import { wavesDone } from './director.js';
import { addFloat, burst } from '../render/particles.js';
import { snapCamera } from '../render/camera.js';
import { sfx } from '../audio/sfx.js';
import { suppressInput } from '../ui/input.js';
import { showDeath, hideOverlays, updateHud } from '../ui/overlays.js';
import { hooks } from './items.js';

export function startRun(seedText = Date.now()) {
  hooks.clear();
  const run = newRun(seedText);
  run.player = makePlayer();
  hideOverlays();
  state.mode = 'play';
  beginRound(1);
  saveNow();
}

function applyRoom(room) {
  state.room = room;
  const p = state.run.player;
  p.x = room.w / 2; p.y = room.h * 0.66;
  p.vx = p.vy = 0;
  p.inv = Math.max(p.inv, 0.9);
  p.roomHit = false;
  p.after.length = 0;
  suppressInput(160);
  snapCamera();
  addFloat(room, room.w / 2, room.wall + 64, room.biome.mech, room.biome.pal.accent3, true, 1.2);
  if (room.captainRound) {
    addFloat(room, room.w / 2, room.wall + 104, 'CAPTAINS IN THE ROOM', room.biome.pal.bad, true, 1.3);
  }
}

export function beginRound(n) {
  state.run.round = n;
  state.run.roomKills = 0;
  applyRoom(rollRoom(state.run, n));
}

export function clearRoom(room) {
  room.cleared = true;
  room.clearT = 0.5;
  room.bullets.length = 0;
  state.save.lifetime.rooms++;
  const p = state.run.player;
  const parts = roomClearScore(room);
  let y = p.y - 70;
  for (const part of parts) {
    addFloat(room, p.x, y, part.text, part.big ? '#ffffff' : room.biome.pal.accent2, !!part.big, 0.95);
    y -= 34;
  }
  vacuumSparks(room);
  sfx('clear');
  // boon reroll lacing (full reroll lands with the draft in Phase 4)
  const boon = p.boon;
  boon.progress++;
  if (boon.progress >= boon.need) { boon.progress = 0; boon.charges = Math.min(1, boon.charges + 1); }
  room.portal = { x: room.w / 2, y: room.h * 0.20, r: 55, t: 0 };
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2, rr = 40 + Math.random() * 150;
    burst(room, room.portal.x, room.portal.y, room.biome.pal.accent3, 1, rr * 1.6, 0.75, 3);
  }
  hooks.run('onRoomClear', room);
}

export function updateRound(dt) {
  const room = state.room, run = state.run, p = run.player;
  if (!room) return;
  room.time += dt;

  if (p.dead) { die(); return; }

  if (!room.cleared && room.enemies.length === 0 && room.spawnQueue.length === 0 && wavesDone(room) && room.time > 0.8) {
    clearRoom(room);
  }

  if (room.portal) {
    room.portal.t += dt;
    room.clearT = Math.max(0, room.clearT - dt);
    if (room.clearT <= 0 && dist(room.portal.x, room.portal.y, p.x, p.y) < room.portal.r + p.r) {
      enterPortal();
    }
  }
}

function enterPortal() {
  // Phase 4 inserts the draft here (portal → draft → transition).
  sfx('portal');
  startTransition();
}

export function startTransition() {
  const run = state.run;
  const next = rollRoom(run, run.round + 1);
  state.transition = {
    timer: 0, duration: 1.4, swapped: false, next,
    title: next.biome.name,
    sub: 'round ' + (run.round + 1) + (run.overdrive ? ' ∞' : ''),
    tag: next.biome.mech,
  };
  state.mode = 'transition';
}

export function updateTransition(raw) {
  const t = state.transition;
  if (!t) { state.mode = 'play'; return; }
  t.timer += raw;
  if (!t.swapped && t.timer >= t.duration * 0.4) {
    t.swapped = true;
    state.run.round += 1;
    state.run.roomKills = 0;
    applyRoom(t.next);
  }
  if (t.timer >= t.duration) {
    state.transition = null;
    state.mode = 'play';
  }
}

export function die() {
  const run = state.run;
  state.mode = 'dead';
  state.save.lifetime.deaths++;
  bankBests();
  updateHud();
  showDeath({
    score: Math.floor(run.score), round: run.round,
    best: state.save.bestScore, bestRound: state.save.bestRound,
    kills: run.kills,
  }, () => startRun());
}
