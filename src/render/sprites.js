// Entity painters: the Moots sprite + vector enemies/obstacles (No Moon/BM idiom).
import { TAU } from '../config.js';
import { clamp } from '../rng.js';
import { dashSpinPhase } from '../systems/player.js';

export const moots = { img: null, ready: false };
export const bossCards = {}; // bossId -> {img, ready}

export function loadSprites() {
  if (typeof Image === 'undefined') return;
  const img = new Image();
  img.onload = () => { moots.ready = true; };
  img.src = './assets/moots.webp';
  moots.img = img;
  for (const [id, file] of Object.entries({
    falseMoon: 'false-moon-card', warden: 'warden-card', spiggot: 'spiggot-card', archon: 'archon-card',
  })) {
    const card = new Image();
    bossCards[id] = { img: card, ready: false };
    card.onload = () => { bossCards[id].ready = true; };
    card.src = `./assets/bosses/${file}.webp`;
  }
}

function shadow(ctx, x, y, w, h, a) {
  ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.ellipse(x, y, w, h, 0, 0, TAU); ctx.fill(); ctx.restore();
}

// ── player ──────────────────────────────────────────────────────────────────
export function drawPlayer(ctx, p, room) {
  const pal = room.biome.pal;
  const spin = dashSpinPhase(p);
  // slipstream trail — directional speed-smear behind movement (concept panel 3)
  const sp = Math.hypot(p.vx, p.vy);
  if (sp > 150) {
    const inv = 1 / sp, bx = -p.vx * inv, by = -p.vy * inv;       // backward unit
    const perpx = -by, perpy = bx;
    const len = Math.min(52, sp * 0.045) * (p.dashT > 0 ? 1.7 : 1);
    // start the wake behind the body so it never sits over his (part-transparent) sprite
    const baseX = p.x + bx * 22, baseY = p.y - 12 + by * 22;
    ctx.save();
    ctx.fillStyle = p.dashT > 0 ? pal.accent3 : pal.accent;
    for (let i = -1; i <= 1; i++) {
      const ox = perpx * i * 7, oy = perpy * i * 7;
      ctx.globalAlpha = (0.24 - Math.abs(i) * 0.07) * (p.dashT > 0 ? 1.5 : 1);
      ctx.beginPath();
      ctx.moveTo(baseX + ox + perpx * 3, baseY + oy + perpy * 3);
      ctx.lineTo(baseX + ox + bx * len, baseY + oy + by * len);
      ctx.lineTo(baseX + ox - perpx * 3, baseY + oy - perpy * 3);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  for (let i = p.after.length - 1; i >= 0; i--) {
    const a = p.after[i];
    drawPlayerBody(ctx, a.x, a.y, a.face, pal, clamp(a.life / 0.16, 0, 1) * 0.18, true, a.spin || 0);
  }
  if (p.dashT > 0) {
    const k = clamp(p.dashT / (p.dashDur || 0.001), 0, 1), ring = 1 - k;
    ctx.save(); ctx.translate(p.x, p.y - 20);
    ctx.globalAlpha = 0.30 + 0.34 * Math.sin(ring * Math.PI);
    ctx.strokeStyle = pal.accent3; ctx.shadowColor = pal.accent3; ctx.shadowBlur = 20; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(0, 0, 42 + ring * 10, 12 + Math.sin(spin * 2) * 3, Math.sin(spin) * 0.10, 0, TAU); ctx.stroke();
    ctx.strokeStyle = pal.accent2; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, 7, 32 + ring * 8, 8, 0, 0, TAU); ctx.stroke();
    ctx.restore();
  }
  // companions (item visuals)
  if (p._orbitals) for (const o of p._orbitals) {
    if (o.x === undefined) continue;
    ctx.save();
    ctx.fillStyle = '#f3dcff'; ctx.shadowColor = '#f3dcff'; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.arc(o.x, o.y, 7, 0, TAU); ctx.fill();
    ctx.restore();
  }
  if (p._drones) for (const d of p._drones) {
    if (d.x === undefined) continue;
    ctx.save();
    ctx.fillStyle = '#ffd36e'; ctx.shadowColor = '#ffd36e'; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(d.x, d.y, 6, 0, TAU); ctx.fill();
    ctx.fillStyle = '#3a2c10';
    ctx.fillRect(d.x - 2, d.y - 2, 4, 4);
    ctx.restore();
  }
  if (p._cat) drawCat(ctx, p._cat.x, p._cat.y, 0.58, pal);
  drawPlayerBody(ctx, p.x, p.y, p.face, pal, 1, false, spin);
  if (p.hurt > 0) {
    ctx.strokeStyle = pal.bad + 'cc'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(p.x, p.y, 42 + (1 - p.hurt / 0.42) * 28, 0, TAU); ctx.stroke();
  }
  if (p.inv > 0 && p.hurt <= 0) {
    ctx.strokeStyle = pal.accent3 + 'aa'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(p.x, p.y, 31 + Math.sin(performance.now() / 80) * 3, 0, TAU); ctx.stroke();
  }
  if (p.shield > 0) {
    ctx.strokeStyle = pal.accent + '99'; ctx.lineWidth = 2;
    for (let i = 0; i < p.shield; i++) { ctx.beginPath(); ctx.arc(p.x, p.y, 38 + i * 5, 0, TAU); ctx.stroke(); }
  }
}

export function drawPlayerBody(ctx, x, y, face, pal, alpha = 1, ghost = false, spinPhase = 0) {
  ctx.save(); ctx.globalAlpha = alpha;
  shadow(ctx, x, y + 25, 28, 9, ghost ? 0.1 : 0.30);
  ctx.translate(x, y);
  const spinning = !ghost && Math.abs(spinPhase) > 0.001;
  if (moots.ready && !ghost) {
    const yaw = Math.cos(spinPhase);
    const sx = spinning ? (0.28 + 0.72 * Math.abs(yaw)) : 1;
    const flip = spinning ? (yaw < 0 ? -1 : 1) : 1;
    ctx.save();
    ctx.scale(sx * flip, 1 + 0.035 * Math.sin(spinPhase * 2));
    ctx.drawImage(moots.img, -36, -72, 72, 106);
    ctx.restore();
    if (spinning) {
      ctx.save(); ctx.globalAlpha = alpha * 0.55;
      ctx.strokeStyle = pal.accent3; ctx.shadowColor = pal.accent3; ctx.shadowBlur = 14; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, -23, 37 * sx, 10, 0, 0, TAU); ctx.stroke();
      ctx.restore();
    }
    drawEmitter(ctx, face, pal);
  } else {
    // fallback blob until the sprite loads (Boon Moots index.html:1416)
    if (spinning) {
      const yaw = Math.cos(spinPhase);
      ctx.scale((0.35 + 0.65 * Math.abs(yaw)) * (yaw < 0 ? -1 : 1), 1 + 0.035 * Math.sin(spinPhase * 2));
    }
    ctx.fillStyle = ghost ? pal.accent : '#fff5f8';
    ctx.strokeStyle = '#05030a'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.ellipse(0, -8, 21, 27, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#05030a';
    ctx.beginPath(); ctx.arc(-8, -12, 4, 0, TAU); ctx.arc(8, -12, 4, 0, TAU); ctx.fill();
    ctx.fillStyle = pal.accent2;
    ctx.fillRect(-17, 19, 14, 16); ctx.fillRect(4, 19, 14, 16);
    drawEmitter(ctx, face, pal);
  }
  ctx.restore(); ctx.globalAlpha = 1;
}

// Aim emitter: a chunky haunted blaster (concept panel 2) — cylinder body with
// glowing cyan chamber-windows, twin front barrels, a top loop, a tiny ghost
// emblem. Reads by SHAPE (colourblind-safe), biome-coloured energy, dark outline.
// Held at body level pointing where you aim; shots leave the barrel tips.
function drawEmitter(ctx, face, pal) {
  ctx.save();
  ctx.translate(0, -16); // matches PLAYER.EMITTER_Y
  ctx.rotate(face);
  ctx.lineJoin = 'round';
  const ink = '#0b0c14', metal = '#322b44', metalHi = '#4d4366', barrel = '#241f30';

  // top loop / hook
  ctx.strokeStyle = metalHi; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(4, -14, 4.5, Math.PI * 0.15, Math.PI * 1.85); ctx.stroke();

  // twin barrels at the muzzle
  ctx.strokeStyle = ink; ctx.lineWidth = 2;
  for (const sgn of [-1, 1]) {
    ctx.fillStyle = barrel;
    roundRectPath(ctx, 18, sgn * 6 - 3.4, 15, 6.8, 2); ctx.fill(); ctx.stroke();
  }

  // main cylinder body
  ctx.fillStyle = metal;
  roundRectPath(ctx, -9, -10, 28, 20, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = metalHi; // top bevel
  roundRectPath(ctx, -6, -9, 22, 4.5, 3); ctx.fill();

  // glowing chamber windows (the "energy" — biome-coloured)
  ctx.shadowColor = pal.accent; ctx.shadowBlur = 7; ctx.fillStyle = pal.accent;
  for (const cx of [-3, 3, 9]) { roundRectPath(ctx, cx, -5, 3, 10, 1.5); ctx.fill(); }
  ctx.shadowBlur = 0;

  // tiny ghost emblem on the receiver
  ctx.fillStyle = hexA('#eef3ff', 0.85);
  ctx.beginPath(); ctx.arc(-3.5, 4, 2.4, Math.PI, 0); ctx.lineTo(-1.1, 7); ctx.lineTo(-3.5, 6); ctx.lineTo(-5.9, 7); ctx.closePath(); ctx.fill();

  // grip + muzzle tips
  ctx.fillStyle = barrel; ctx.strokeStyle = ink; ctx.lineWidth = 2;
  roundRectPath(ctx, -5, 9, 9, 7, 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = pal.accent; ctx.shadowColor = pal.accent; ctx.shadowBlur = 8;
  for (const sgn of [-1, 1]) { ctx.beginPath(); ctx.arc(33, sgn * 6, 2.6, 0, TAU); ctx.fill(); }
  ctx.shadowBlur = 0;
  ctx.restore();
}

// Gigi (Boon Moots index.html:1420)
export function drawCat(ctx, x, y, s, pal) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  shadow(ctx, 0, 14, 20, 6, 0.25);
  ctx.fillStyle = '#11131b';
  ctx.beginPath(); ctx.ellipse(0, 0, 26, 18, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#f9f6ee';
  ctx.beginPath(); ctx.ellipse(-8, 1, 12, 16, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#11131b';
  ctx.beginPath();
  ctx.moveTo(-18, -10); ctx.lineTo(-10, -30); ctx.lineTo(-2, -9);
  ctx.moveTo(8, -9); ctx.lineTo(16, -30); ctx.lineTo(22, -8);
  ctx.fill();
  ctx.fillStyle = pal.accent3;
  ctx.beginPath(); ctx.arc(-7, -3, 2.8, 0, TAU); ctx.arc(9, -3, 2.8, 0, TAU); ctx.fill();
  ctx.restore();
}

// care / market objects
export function drawCare(ctx, c, pal) {
  const t = performance.now() / 1000;
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.globalAlpha = c.used ? 0.35 : 1;
  shadow(ctx, 0, 22, 26, 8, 0.28);
  const glow = c.used ? 0 : 10 + Math.sin(t * 2.4 + c.phase) * 5;
  ctx.shadowColor = c.kind === 'market' ? '#ffd47a' : '#9bffd1';
  ctx.shadowBlur = glow;
  if (c.kind === 'lamp') {
    ctx.strokeStyle = '#d8c979'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(0, 20); ctx.lineTo(0, -26); ctx.stroke();
    ctx.fillStyle = '#ffe9a8';
    ctx.beginPath(); ctx.arc(0, -32, 9, 0, TAU); ctx.fill();
  } else if (c.kind === 'bench') {
    ctx.fillStyle = '#9b8c6a';
    ctx.fillRect(-24, -4, 48, 8);
    ctx.fillRect(-20, 4, 6, 14); ctx.fillRect(14, 4, 6, 14);
  } else if (c.kind === 'umbrella') {
    ctx.strokeStyle = '#b6a8d8'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, 22); ctx.lineTo(0, -18); ctx.stroke();
    ctx.fillStyle = pal.accent2;
    ctx.beginPath(); ctx.arc(0, -18, 22, Math.PI, TAU); ctx.fill();
  } else if (c.kind === 'pie') {
    ctx.fillStyle = '#e8b06a';
    ctx.beginPath(); ctx.ellipse(0, 0, 18, 11, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#a8763a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, -2, 13, 7, 0, 0, TAU); ctx.stroke();
  } else if (c.kind === 'market') {
    ctx.fillStyle = '#241a10';
    ctx.strokeStyle = '#ffd47a'; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(-22, 18); ctx.lineTo(0, -24); ctx.lineTo(22, 18); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffd47a';
    ctx.font = '900 14px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('1♥', 0, 10);
  }
  ctx.restore();
}

// ── enemies ─────────────────────────────────────────────────────────────────
// Glowing eyes give the object-monsters personality (adapted from Boon Moots'
// drawEnemyEyes, index.html:1387). A near-black body tint keyed to the biome.
function enemyEyes(ctx, x, y, rx, ry, color) {
  ctx.save();
  ctx.shadowColor = color; ctx.shadowBlur = 12; ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, -0.18, 0, TAU);
  ctx.ellipse(-x, y, rx, ry, 0.18, 0, TAU);
  ctx.fill();
  ctx.restore();
}
const darkOf = (pal) => mix(pal.bg, '#000000', 0.35);

export function drawEnemy(ctx, e, room) {
  const pal = room.biome.pal;
  shadow(ctx, e.x, e.y + e.r * 0.85, e.r * 1.15, e.r * 0.34, 0.26);
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.shadowColor = e.color; ctx.shadowBlur = e.captain ? 12 : 5;
  const flash = e.hit > 0;
  const body = flash ? '#ffffff' : e.color;     // boss case still uses this
  const dark = darkOf(pal);
  const A = pal.accent, B = pal.accent2;          // bright biome accents for detail/eyes

  switch (e.type) {
    case 'skitter': { // Pewling — twitchy little bug-body
      ctx.rotate(Math.sin(e.phase * 9) * 0.18);
      const s = e.r / 15;
      ctx.strokeStyle = e.color; ctx.globalAlpha = 0.7; ctx.lineWidth = 3;
      for (let k = -1; k <= 1; k++) {
        ctx.beginPath();
        ctx.moveTo(-6 * s, k * 6 * s); ctx.lineTo(-25 * s, k * 11 * s + Math.sin(e.phase * 8 + k) * 4);
        ctx.moveTo(6 * s, k * 6 * s); ctx.lineTo(25 * s, k * 11 * s - Math.sin(e.phase * 8 + k) * 4);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = dark; ctx.beginPath(); ctx.arc(0, 0, e.r, 0, TAU); ctx.fill();
      ctx.fillStyle = e.color; ctx.beginPath(); ctx.arc(0, 0, e.r * 0.62, 0, TAU); ctx.fill();
      enemyEyes(ctx, -5 * s, -3 * s, 4, 3, B);
      break;
    }
    case 'gunner': { // Censer — squat incense/shrine box trailing smoke
      ctx.rotate(Math.sin(e.phase * 1.3) * 0.12);
      const s = e.r / 18;
      ctx.fillStyle = dark; ctx.strokeStyle = e.color; ctx.lineWidth = 3;
      roundRectPath(ctx, -20 * s, -24 * s, 40 * s, 44 * s, 8 * s); ctx.fill(); ctx.stroke();
      ctx.fillStyle = e.color; roundRectPath(ctx, -12 * s, -14 * s, 24 * s, 26 * s, 5 * s); ctx.fill();
      ctx.fillStyle = dark; roundRectPath(ctx, 4 * s, -4 * s, 22 * s, 8 * s, 4 * s); ctx.fill();
      ctx.globalAlpha = 0.33; ctx.strokeStyle = B; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, -24 * s); ctx.bezierCurveTo(-16 * s, -44 * s, 17 * s, -46 * s, 0, -66 * s); ctx.stroke();
      ctx.globalAlpha = 1;
      enemyEyes(ctx, -6 * s, 2 * s, 4, 3, B);
      break;
    }
    case 'charger': { // Ramwraith — sharp triangular charger with motion streaks
      const dir = (e.state === 'windup' || e.state === 'dash') ? { x: e.chargeX || e.vx, y: e.chargeY || e.vy } : { x: e.vx, y: e.vy };
      if (e.state === 'windup') {
        ctx.save(); ctx.rotate(Math.atan2(e.chargeY || e.vy, e.chargeX || e.vx));
        ctx.globalAlpha = 0.4 + 0.3 * Math.sin(e.phase * 30);
        ctx.strokeStyle = pal.bad; ctx.lineWidth = 3; ctx.setLineDash([10, 8]);
        ctx.beginPath(); ctx.moveTo(e.r, 0); ctx.lineTo(e.r + 320, 0); ctx.stroke();
        ctx.restore();
      }
      const moving = Math.hypot(dir.x, dir.y) > 30 || e.state === 'dash';
      ctx.rotate(moving ? Math.atan2(dir.y, dir.x) + Math.PI / 2 : Math.sin(e.phase) * 0.12);
      const s = e.r / 24;
      for (let i = 0; i < 3; i++) { // motion streaks
        ctx.globalAlpha = 0.18; ctx.fillStyle = e.color;
        ctx.beginPath(); ctx.moveTo(-14 * s, -20 * s - i * 11 * s); ctx.lineTo(14 * s, -20 * s - i * 11 * s); ctx.lineTo(0, -48 * s - i * 16 * s); ctx.closePath(); ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = e.color; ctx.strokeStyle = '#ffffffcc'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(0, -34 * s); ctx.lineTo(24 * s, 19 * s); ctx.lineTo(-24 * s, 19 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff4e8'; ctx.fillRect(-14 * s, -7 * s, 28 * s, 8 * s); ctx.fillRect(-19 * s, 9 * s, 38 * s, 7 * s);
      ctx.fillStyle = dark; roundRectPath(ctx, -17 * s, 4 * s, 34 * s, 17 * s, 5 * s); ctx.fill();
      enemyEyes(ctx, -7 * s, 11 * s, 5, 4, B);
      break;
    }
    case 'turret': { // Lectern — haunted book stand / altar (stationary)
      const s = e.r / 20;
      ctx.fillStyle = dark; ctx.strokeStyle = e.color; ctx.lineWidth = 3;
      roundRectPath(ctx, -25 * s, -19 * s, 50 * s, 38 * s, 8 * s); ctx.fill(); ctx.stroke();
      ctx.fillStyle = e.color; ctx.globalAlpha = 0.9; roundRectPath(ctx, -18 * s, -13 * s, 36 * s, 22 * s, 5 * s); ctx.fill(); ctx.globalAlpha = 1;
      ctx.strokeStyle = dark; ctx.lineWidth = 2;
      for (let y = -7; y < 8; y += 6) { ctx.beginPath(); ctx.moveTo(-12 * s, y * s); ctx.lineTo(12 * s, y * s); ctx.stroke(); }
      ctx.strokeStyle = B; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-9 * s, 20 * s); ctx.lineTo(-16 * s, 38 * s); ctx.moveTo(9 * s, 20 * s); ctx.lineTo(16 * s, 38 * s); ctx.stroke();
      break;
    }
    case 'brute': { // Ox-Warden — heavy horned brute
      const s = e.r / 34;
      ctx.fillStyle = dark; ctx.strokeStyle = e.color; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.ellipse(0, 2 * s, e.r * 1.05, e.r * 0.82, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = B; ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(-18 * s, -18 * s); ctx.quadraticCurveTo(-40 * s, -36 * s, -54 * s, -20 * s);
      ctx.moveTo(18 * s, -18 * s); ctx.quadraticCurveTo(40 * s, -36 * s, 54 * s, -20 * s); ctx.stroke();
      ctx.fillStyle = e.color; ctx.beginPath(); ctx.arc(0, 0, e.r * 0.38, 0, TAU); ctx.fill();
      enemyEyes(ctx, -10 * s, -7 * s, 6, 5, B);
      break;
    }
    case 'sniper': { // Long Candle — tall candle with a flaring flame
      const s = e.r / 17;
      const aim = e.aimT > 0;
      if (aim && e.snipeX !== undefined) {
        ctx.save(); ctx.rotate(Math.atan2(e.snipeY, e.snipeX));
        ctx.globalAlpha = 0.35; ctx.strokeStyle = pal.bad; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(960, 0); ctx.stroke(); ctx.restore();
      }
      ctx.fillStyle = dark; ctx.strokeStyle = aim ? pal.bad : e.color; ctx.lineWidth = 3;
      roundRectPath(ctx, -10 * s, -34 * s, 20 * s, 56 * s, 8 * s); ctx.fill(); ctx.stroke();
      const flame = 1 + Math.sin(e.phase * 12) * 0.15;
      ctx.fillStyle = aim ? pal.bad : B;
      ctx.beginPath(); ctx.ellipse(0, -43 * s, 7 * flame * s, 13 * flame * s, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = e.color; ctx.globalAlpha = 0.7; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-22 * s, -2 * s); ctx.lineTo(22 * s, -2 * s); ctx.stroke(); ctx.globalAlpha = 1;
      enemyEyes(ctx, -4 * s, -12 * s, 3, 3, A);
      break;
    }
    case 'hexer': { // Antiphon — rotating ritual wheel / glyph
      const s = e.r / 19;
      ctx.rotate(e.phase * 0.6);
      ctx.strokeStyle = e.color; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, e.r * 0.95, 0, TAU); ctx.stroke();
      for (let k = 0; k < 6; k++) {
        const a = k * TAU / 6;
        ctx.beginPath(); ctx.moveTo(Math.cos(a) * e.r * 0.45, Math.sin(a) * e.r * 0.45); ctx.lineTo(Math.cos(a) * e.r * 1.2, Math.sin(a) * e.r * 1.2); ctx.stroke();
      }
      ctx.fillStyle = dark; ctx.beginPath(); ctx.arc(0, 0, e.r * 0.7, 0, TAU); ctx.fill();
      ctx.fillStyle = e.color; ctx.beginPath(); ctx.arc(0, 0, e.r * 0.32, 0, TAU); ctx.fill();
      enemyEyes(ctx, -5 * s, -3 * s, 3, 3, B);
      break;
    }
    case 'myrmidon': { // Crown-Sworn — crowned triangular knight
      const s = e.r / 23;
      const a = Math.hypot(e.vx, e.vy) > 40 ? Math.atan2(e.vy, e.vx) + Math.PI / 2 : Math.sin(e.phase) * 0.16;
      ctx.rotate(a);
      ctx.fillStyle = dark; ctx.strokeStyle = e.color; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(0, -32 * s); ctx.lineTo(25 * s, 20 * s); ctx.lineTo(-25 * s, 20 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = B; // crown
      ctx.beginPath();
      ctx.moveTo(-17 * s, -35 * s); ctx.lineTo(-7 * s, -23 * s); ctx.lineTo(0, -38 * s); ctx.lineTo(7 * s, -23 * s); ctx.lineTo(17 * s, -35 * s); ctx.lineTo(12 * s, -18 * s); ctx.lineTo(-12 * s, -18 * s);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = A; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 18 * s); ctx.lineTo(0, 42 * s); ctx.stroke();
      enemyEyes(ctx, -7 * s, 3 * s, 4, 4, B);
      break;
    }
    case 'boss': {
      const t = performance.now() / 1000;
      ctx.shadowBlur = 26;
      ctx.strokeStyle = body; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, e.r, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, e.r * 0.72, 0, TAU); ctx.stroke();
      ctx.fillStyle = body; ctx.globalAlpha = 0.22;
      ctx.beginPath(); ctx.arc(0, 0, e.r, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
      if (e.bossId === 'archon' || e.bossId === 'falseMoon') {
        ctx.save(); ctx.rotate(t * 0.18);
        ctx.fillStyle = body;
        starPath(ctx, 0, 0, e.r * 0.52, e.r * 0.22, 6); ctx.fill();
        ctx.restore();
        for (let k = 0; k < 4; k++) {
          const a = t * 0.6 + (k / 4) * TAU;
          ctx.beginPath(); ctx.arc(Math.cos(a) * e.r * 0.86, Math.sin(a) * e.r * 0.86, 4, 0, TAU);
          ctx.fillStyle = body; ctx.fill();
        }
      } else if (e.bossId === 'spiggot') {
        ctx.fillStyle = body;
        ctx.beginPath(); ctx.ellipse(0, -e.r * 0.18, e.r * 0.5, e.r * 0.34, 0, Math.PI, TAU); ctx.fill();
        ctx.strokeStyle = body; ctx.lineWidth = 2.4;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, e.r * 0.5); ctx.stroke();
        for (let k = 0; k < 5; k++) {
          const a = t * 0.9 + (k / 5) * TAU;
          ctx.beginPath(); ctx.arc(Math.cos(a) * e.r * 0.6, Math.sin(a) * e.r * 0.6, 3, 0, TAU); ctx.fill();
        }
      } else { // warden
        ctx.save(); ctx.rotate(Math.atan2(e.vy, e.vx));
        ctx.fillStyle = body;
        ctx.beginPath();
        ctx.moveTo(e.r * 0.55, 0); ctx.lineTo(-e.r * 0.2, -e.r * 0.3); ctx.lineTo(-e.r * 0.2, e.r * 0.3);
        ctx.closePath(); ctx.fill();
        ctx.restore();
        ctx.beginPath(); ctx.moveTo(0, -e.r * 1.05); ctx.lineTo(-7, -e.r * 0.8); ctx.lineTo(7, -e.r * 0.8); ctx.closePath();
        ctx.fillStyle = body; ctx.fill();
      }
      break;
    }
    default: {
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.arc(0, 0, e.r, 0, TAU); ctx.fill();
    }
  }
  if (flash && e.type !== 'boss') { // white pop on hit, shape-agnostic
    ctx.globalAlpha = clamp(e.hit / 0.11, 0, 1) * 0.55;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(0, 0, e.r * 1.12, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  if (e.captain) {
    // elite threat tag — reads as "this one's dangerous", not the enemy's name:
    // a diamond marker + a small dim label
    ctx.save();
    ctx.textAlign = 'center';
    const ty = e.y - e.r * 1.7;
    ctx.fillStyle = e.color; ctx.shadowColor = e.color; ctx.shadowBlur = 8;
    ctx.beginPath(); // marker diamond
    ctx.moveTo(e.x, ty - 11); ctx.lineTo(e.x + 5, ty - 6); ctx.lineTo(e.x, ty - 1); ctx.lineTo(e.x - 5, ty - 6);
    ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 0.8;
    ctx.font = '800 9px Inter, system-ui, sans-serif';
    ctx.fillText(e.captain.toUpperCase(), e.x, ty + 11);
    ctx.restore();
  }
  if (e.maxHp > 6 && e.hp < e.maxHp) {
    const w = e.r * 1.8;
    ctx.fillStyle = 'rgba(0,0,0,.45)';
    ctx.fillRect(e.x - w / 2, e.y - e.r - 12, w, 4);
    ctx.fillStyle = e.color;
    ctx.fillRect(e.x - w / 2, e.y - e.r - 12, w * clamp(e.hp / e.maxHp, 0, 1), 4);
  }
}

// ── obstacles ───────────────────────────────────────────────────────────────
const STYLE_GROUPS = {
  rootStone: 'stone', boneMound: 'stone', fenStump: 'stump', slagHeart: 'stump',
  glassNode: 'glass', bloomBulb: 'bloom', mycoCap: 'bloom',
  machineHub: 'machine', kilnPillar: 'machine',
  archivePillar: 'idol', basilicaIdol: 'idol',
  boundary: 'boundary', door: 'door', wall: 'wall', ledge: 'wall',
};

export function drawObstacle(ctx, o, room) {
  if (o.gone || o.ledge) return; // tier ledges are rendered as part of the platform (drawTiers)
  const pal = room.biome.pal;
  const group = STYLE_GROUPS[o.style] || 'stone';
  const sh = o.shake = Math.max(0, (o.shake || 0) - 0.016);
  const jx = sh > 0 ? (Math.random() - 0.5) * 6 : 0;
  const jy = sh > 0 ? (Math.random() - 0.5) * 6 : 0;
  ctx.save();
  ctx.translate(jx, jy);

  if (group === 'boundary') {
    ctx.fillStyle = pal.bg;
    ctx.strokeStyle = pal.accent3; ctx.lineWidth = 2;
    roundRectPath(ctx, o.x, o.y, o.w, o.h, 4); ctx.fill(); ctx.stroke();
    ctx.restore();
    return;
  }
  if (group === 'wall') {
    // architectural partition: solid slab with a lit cap edge + drop shadow
    shadow(ctx, o.x + o.w / 2, o.y + o.h + 4, o.w / 2, 7, 0.32);
    const horizontal = o.w >= o.h;
    const g = horizontal
      ? ctx.createLinearGradient(0, o.y, 0, o.y + o.h)
      : ctx.createLinearGradient(o.x, 0, o.x + o.w, 0);
    g.addColorStop(0, mix(pal.floor, '#ffffff', 0.10));
    g.addColorStop(0.5, pal.floor);
    g.addColorStop(1, pal.bg);
    ctx.fillStyle = g;
    roundRectPath(ctx, o.x, o.y, o.w, o.h, 5); ctx.fill();
    ctx.strokeStyle = pal.accent3; ctx.lineWidth = 2;
    ctx.stroke();
    // lit top edge
    ctx.strokeStyle = mix(pal.accent, '#ffffff', 0.3);
    ctx.globalAlpha = 0.5; ctx.lineWidth = 2;
    ctx.beginPath();
    if (horizontal) { ctx.moveTo(o.x + 4, o.y + 1.5); ctx.lineTo(o.x + o.w - 4, o.y + 1.5); }
    else { ctx.moveTo(o.x + 1.5, o.y + 4); ctx.lineTo(o.x + 1.5, o.y + o.h - 4); }
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();
    return;
  }
  if (group === 'door') {
    const cracked = o.hp < 5;
    ctx.fillStyle = pal.floor;
    ctx.strokeStyle = pal.accent2; ctx.lineWidth = 2.4;
    ctx.setLineDash([7, 5]);
    roundRectPath(ctx, o.x, o.y, o.w, o.h, 4); ctx.fill(); ctx.stroke();
    ctx.setLineDash([]);
    if (cracked) {
      ctx.strokeStyle = pal.accent2; ctx.globalAlpha = 0.7; ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(o.x + o.w * 0.3, o.y); ctx.lineTo(o.x + o.w * 0.5, o.y + o.h * 0.6); ctx.lineTo(o.x + o.w * 0.72, o.y + o.h);
      ctx.stroke(); ctx.globalAlpha = 1;
    }
    ctx.restore();
    return;
  }

  const cx = o.type === 'circle' ? o.x : o.x + o.w / 2;
  const cy = o.type === 'circle' ? o.y : o.y + o.h / 2;
  const cr = o.type === 'circle' ? o.rad : Math.min(o.w, o.h) / 2;
  shadow(ctx, cx, cy + cr * 0.8, cr * 1.2, cr * 0.3, 0.3);

  ctx.fillStyle = pal.floor;
  ctx.strokeStyle = pal.accent3; ctx.lineWidth = 2.5;
  if (o.type === 'circle') {
    ctx.beginPath(); ctx.arc(o.x, o.y, o.rad, 0, TAU); ctx.fill(); ctx.stroke();
  } else {
    roundRectPath(ctx, o.x, o.y, o.w, o.h, o.round || 12); ctx.fill(); ctx.stroke();
  }

  ctx.globalAlpha = 0.85;
  if (group === 'glass') {
    ctx.strokeStyle = o.volatile ? '#bfe8ff' : pal.accent;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(cx - cr * 0.5, cy - cr * 0.4); ctx.lineTo(cx + cr * 0.2, cy + cr * 0.5);
    ctx.moveTo(cx + cr * 0.4, cy - cr * 0.5); ctx.lineTo(cx - cr * 0.1, cy + cr * 0.3);
    ctx.stroke();
    if (o.volatile) {
      ctx.shadowColor = '#bfe8ff'; ctx.shadowBlur = 14;
      ctx.fillStyle = '#bfe8ff';
      ctx.beginPath(); ctx.arc(cx, cy, cr * 0.3 + Math.sin(performance.now() / 200) * 2, 0, TAU); ctx.fill();
    }
  } else if (group === 'bloom') {
    ctx.fillStyle = pal.accent;
    ctx.beginPath(); ctx.ellipse(cx, cy - cr * 0.2, cr * 0.5, cr * 0.32, 0, Math.PI, TAU); ctx.fill();
    ctx.strokeStyle = pal.accent3; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, cy + cr * 0.5); ctx.stroke();
  } else if (group === 'machine') {
    ctx.strokeStyle = pal.accent; ctx.lineWidth = 1.6;
    ctx.strokeRect(cx - cr * 0.45, cy - cr * 0.45, cr * 0.9, cr * 0.9);
    ctx.fillStyle = pal.accent;
    ctx.beginPath(); ctx.arc(cx, cy, 2.6, 0, TAU); ctx.fill();
  } else if (group === 'idol') {
    ctx.strokeStyle = pal.accent2; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(cx, cy - cr * 0.1, cr * 0.42, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy - cr * 0.62); ctx.lineTo(cx, cy + cr * 0.5); ctx.stroke();
  } else if (group === 'stump') {
    ctx.strokeStyle = pal.accent3; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(cx, cy, cr * 0.55, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, cr * 0.28, 0, TAU); ctx.stroke();
  } else { // stone
    ctx.strokeStyle = pal.accent3; ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(cx - cr * 0.4, cy + cr * 0.2); ctx.lineTo(cx - cr * 0.05, cy - cr * 0.3); ctx.lineTo(cx + cr * 0.4, cy + cr * 0.05);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  if (o.breakable && o.species !== 'volatileShard') {
    ctx.strokeStyle = pal.accent2; ctx.globalAlpha = 0.5; ctx.lineWidth = 1.2;
    if (o.type === 'circle') { ctx.beginPath(); ctx.arc(o.x, o.y, o.rad * 0.75, 0, TAU); ctx.stroke(); }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

// ── shared paths ────────────────────────────────────────────────────────────
function hexA(hex, a) {
  const h = hex.replace('#', '');
  return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${a})`;
}

export function mix(a, b, t) {
  const pa = parseInt(a.replace('#', ''), 16), pb = parseInt(b.replace('#', ''), 16);
  const ar = (pa >> 16) & 255, ag = (pa >> 8) & 255, ab = pa & 255;
  const br = (pb >> 16) & 255, bg = (pb >> 8) & 255, bb = pb & 255;
  const r = Math.round(ar + (br - ar) * t), g = Math.round(ag + (bg - ag) * t), bl = Math.round(ab + (bb - ab) * t);
  return `rgb(${r},${g},${bl})`;
}

export function roundRectPath(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export function starPath(ctx, x, y, r1, r2, n) {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / n;
    const r = i % 2 ? r2 : r1;
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath();
}

export function heartPath(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.42);
  ctx.bezierCurveTo(x - s * 1.25, y - s * 0.24, x - s * 0.72, y - s * 0.95, x, y - s * 0.45);
  ctx.bezierCurveTo(x + s * 0.72, y - s * 0.95, x + s * 1.25, y - s * 0.24, x, y + s * 0.42);
}

export function hexPath(ctx, x, y, r) {
  ctx.beginPath();
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * TAU;
    k ? ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r) : ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath();
}
