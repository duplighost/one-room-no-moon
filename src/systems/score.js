// Combo, streaks, bonuses, bests.
import { COMBO, SCORE, STREAK_NAMES } from '../config.js';
import { state, saveNow } from '../state.js';
import { addFloat } from '../render/particles.js';
import { damp } from '../rng.js';

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
  run.combo = Math.min(COMBO.CAP, run.combo + (e.boss ? COMBO.PER_BOSS : COMBO.PER_KILL));
  run.comboT = COMBO.WINDOW;
  const pts = Math.floor(e.score * run.combo
    * (run.overdrive ? SCORE.OVERDRIVE_MULT : 1)
    * (state.room?.mutator?.scoreMult || 1));
  run.score += pts;
  run.kills++; run.roomKills++;
  state.save.lifetime.kills++;
  state.save.bestiary[e.type] = (state.save.bestiary[e.type] || 0) + 1;
  run.streak++; run.streakT = 0.8;
  if (run.streak < STREAK_NAMES.length && STREAK_NAMES[run.streak] && state.room) {
    addFloat(state.room, e.x, e.y - 58, STREAK_NAMES[run.streak], state.room.biome?.pal.accent3 || '#ffd36e', true);
  }
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
