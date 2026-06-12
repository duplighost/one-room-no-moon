// DOM overlays + HUD. Imports only state; actions arrive as callbacks (no cycles).
import { state, saveNow } from '../state.js';
import { clamp } from '../rng.js';

const $ = (id) => (typeof document !== 'undefined' ? document.getElementById(id) : null);
let ui = null;

export function initOverlays() {
  ui = {
    overlay: $('overlay'), overlayTitle: $('overlayTitle'), overlayCopy: $('overlayCopy'),
    overlayButtons: $('overlayButtons'), overlayMeta: $('overlayMeta'),
    draft: $('draft'), draftTitle: $('draftTitle'), draftCards: $('draftCards'), draftMeta: $('draftMeta'),
    pause: $('pause'), resumeBtn: $('resumeBtn'), pauseSfxBtn: $('pauseSfxBtn'),
    zone: $('zone'), roomNo: $('roomNo'), hp: $('hp'), score: $('score'),
    comboChip: $('comboChip'), pulseWrap: $('pulseWrap'), pulseFill: $('pulseFill'),
    sfxBtn: $('sfxBtn'), whisper: $('whisper'), buildChips: $('buildChips'),
  };
}

export function showOverlay(title, copy, buttons, meta = '') {
  if (!ui?.overlay) return;
  ui.overlayTitle.textContent = title;
  ui.overlayCopy.textContent = copy;
  ui.overlayMeta.textContent = meta;
  ui.overlayButtons.innerHTML = '';
  for (const [label, fn] of buttons) {
    const b = document.createElement('button');
    b.className = 'bigBtn';
    b.type = 'button';
    b.textContent = label;
    b.onclick = fn;
    ui.overlayButtons.appendChild(b);
  }
  ui.overlay.classList.add('show');
}

export function hideOverlays() {
  ui?.overlay?.classList.remove('show');
  ui?.pause?.classList.remove('show');
  ui?.draft?.classList.remove('show');
}

export function showTitle(onStart) {
  const s = state.save;
  const meta = s.bestScore
    ? `best ${Math.floor(s.bestScore).toLocaleString()} · round ${s.bestRound} · ${s.runs} runs`
    : 'two thumbs, one room';
  showOverlay(
    'One Room No Moon',
    'One room. It keeps re-dressing itself in every biome the descent ever had, hoping one finally takes. Moots answers.',
    [['Play', onStart]],
    meta,
  );
}

export function showDeath(stats, onRestart) {
  showOverlay(
    'The boon boots remain.',
    `Score ${stats.score.toLocaleString()} · round ${stats.round} · ${stats.kills} marks.`,
    [['Run it back', onRestart]],
    `best ${Math.floor(stats.best).toLocaleString()} · round ${stats.bestRound}`,
  );
}

export function showPause(visible, sfxLabel) {
  if (!ui?.pause) return;
  ui.pause.classList.toggle('show', visible);
  if (visible && ui.pauseSfxBtn) ui.pauseSfxBtn.textContent = sfxLabel;
}

export function wirePauseButtons(onResume, onSfx) {
  if (ui?.resumeBtn) ui.resumeBtn.onclick = onResume;
  if (ui?.pauseSfxBtn) ui.pauseSfxBtn.onclick = onSfx;
}

export function wireSfxButton(onToggle) {
  if (ui?.sfxBtn) ui.sfxBtn.onclick = onToggle;
}

export function whisper(text) {
  if (!ui?.whisper) return;
  ui.whisper.textContent = text;
  ui.whisper.classList.add('show');
  clearTimeout(whisper._t);
  whisper._t = setTimeout(() => ui.whisper.classList.remove('show'), 2600);
}

export function updateHud() {
  if (!ui?.zone) return;
  const run = state.run, room = state.room;
  if (!run || !room) {
    ui.zone.textContent = 'One Room No Moon';
    ui.roomNo.textContent = 'round 0';
    ui.hp.textContent = '♥♥♥♥♥♥';
    ui.score.textContent = '0';
    ui.comboChip.textContent = 'two thumbs';
    ui.pulseFill.style.width = '0%';
  } else {
    const p = run.player;
    ui.zone.textContent = room.biome.name;
    ui.roomNo.textContent = `round ${run.round}${run.overdrive ? ' ∞' : ''}`;
    const hearts = '♥'.repeat(Math.max(0, Math.ceil(p.hp))) + '♡'.repeat(Math.max(0, p.maxHp - Math.ceil(p.hp)));
    ui.hp.innerHTML = (p.hp <= 2 ? `<span class="hurt">${hearts}</span>` : hearts) + (p.shield ? ` +${p.shield}` : '');
    ui.score.textContent = Math.floor(run.score).toLocaleString();
    ui.comboChip.textContent = `x${run.combo.toFixed(1)}`;
    const pct = clamp(p.pulse, 0, 100);
    ui.pulseFill.style.width = pct + '%';
    ui.pulseWrap.classList.toggle('ready', pct >= 100);
  }
  if (ui.sfxBtn) ui.sfxBtn.textContent = state.save.settings.sfx ? 'sfx on' : 'sfx off';
}

export function setSfxLabels() {
  const label = state.save.settings.sfx ? 'sfx on' : 'sfx off';
  if (ui?.sfxBtn) ui.sfxBtn.textContent = label;
  if (ui?.pauseSfxBtn) ui.pauseSfxBtn.textContent = label;
  saveNow();
}
