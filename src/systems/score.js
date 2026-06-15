// Combo, streaks, bonuses, bests.
import { COMBO, SCORE } from '../config.js';
import { state, saveNow } from '../state.js';
import { addFloat, burst, ripple } from '../render/particles.js';
import { addFlash, addShake } from './juice.js';
import { sfx } from '../audio/sfx.js';
import { damp } from '../rng.js';

const COMBO_TIER_NAMES = ['', '', 'WARMING UP', 'IN THE POCKET', 'ON A TEAR', 'RAMPAGE RECEIPT',
  'UNTOUCHED', 'A BEAUTIFUL BLUR', 'UNSTOPPABLE PASSENGER', 'MOON-DRUNK', 'CITYWIDE WARRANT',
  'NULL AND VOID', 'PERFECT STORM'];

// Crossing an integer combo tier (×2, ×3 …) fires escalating juice — the climb feels huge.
function comboMilestone(tier, e) {
  const room = state.room; if (!room) return;
  const k = Math.min(1, (tier - 2) / 10);
  addFlash(0.12 + k * 0.30);
  addShake(0.22 + k * 0.75);
  const hot = tier >= 10 ? '#ffffff' : tier >= 6 ? '#ff9bf5' : (room.biome?.pal.accent3 || '#ffd36e');
  // NUMBER-forward: a big ×N + visual flair (expanding ring + shard burst). A word only
  // at a rare high milestone (×9+) as a flourish — the game wants visuals, not words.
  addFloat(room, e.x, e.y - 70, `×${tier}`, hot, true, 1.25 + k * 0.85);
  if (tier >= 9) { const w = COMBO_TIER_NAMES[Math.min(COMBO_TIER_NAMES.length - 1, tier)]; if (w) addFloat(room, e.x, e.y - 106, w, hot, false, 0.55); }
  ripple(room, e.x, e.y, hot, 80 + tier * 16, 0.55);
  burst(room, e.x, e.y, hot, 10 + tier * 2, 210 + tier * 28, 0.5, 3);
  sfx('pulse');
  // A good combo patches you up — a piece of integrity, but never the LAST point: caps
  // at maxHp-1 so combos can't fully heal you and damage always still matters.
  const p = state.run?.player;
  if (tier >= 3 && p && p.hp < p.maxHp - 1) {
    p.hp = Math.min(p.maxHp - 1, p.hp + 1);
    addFloat(room, p.x, p.y - 54, 'MEND +1', '#7efab7', true, 0.95);
    sfx('care');
  }
}

export function tickCombo(raw) {
  const run = state.run;
  if (!run) return;
  run.comboT = Math.max(0, run.comboT - raw);
  if (run.comboT <= 0) run.combo = damp(run.combo, 1, 3, raw);
  if (run.streakT > 0) {
    run.streakT = Math.max(0, run.streakT - raw);
    if (run.streakT <= 0) run.streak = 0;
  }
}

export function killScore(e) {
  const run = state.run;
  const prevTier = Math.floor(run.combo);
  run.combo = Math.min(COMBO.CAP, run.combo + (e.boss ? COMBO.PER_BOSS : COMBO.PER_KILL));
  const tier = Math.floor(run.combo);
  if (tier > prevTier && tier >= 2) comboMilestone(tier, e);
  run.comboT = COMBO.WINDOW;
  const pts = Math.floor(e.score * run.combo
    * (run.overdrive ? SCORE.OVERDRIVE_MULT : 1)
    * (state.room?.mutator?.scoreMult || 1));
  run.score += pts;
  run.kills++; run.roomKills++;
  state.save.lifetime.kills++;
  state.save.bestiary[e.type] = (state.save.bestiary[e.type] || 0) + 1;
  run.streak++; run.streakT = 0.8;
  // (streak word-floats removed — the combo ×N + its ring/burst is the feedback now;
  // the game wants numbers + visuals, not a word on every few kills)
  return pts;
}

export function sparkScore() {
  const run = state.run;
  run.score += Math.floor(SCORE.SPARK * run.combo);
  state.save.sparks = (state.save.sparks || 0) + 1;
}

export function roomClearScore(room) {
  const run = state.run;
  let total = Math.floor((SCORE.CLEAR_BASE + run.round * SCORE.CLEAR_PER_ROUND) * run.combo);
  const parts = [{ text: `+${total}`, big: true }];
  if (!run.player.roomHit) {
    const noHit = Math.floor(SCORE.NO_HIT * run.combo);
    total += noHit;
    parts.push({ text: `CLEAN +${noHit}` });
  }
  if (run.round >= SCORE.SPEED_FROM_ROUND) {
    const speed = Math.max(0, Math.floor(SCORE.SPEED_MAX - room.time * SCORE.SPEED_DRAIN));
    if (speed > 0) { total += speed; parts.push({ text: `FAST +${speed}` }); }
  }
  run.score += total;
  saveNow();
  return parts;
}
