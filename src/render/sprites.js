// Entity painters: the Moots sprite + vector enemies/obstacles (No Moon/BM idiom).
import { TAU } from '../config.js';
import { clamp } from '../rng.js';
import { dashSpinPhase } from '../systems/player.js';

export const moots = { img: null, ready: false };

export function loadSprites() {
  if (typeof Image === 'undefined') return;
  const img = new Image();
  img.onload = () => { moots.ready = true; };
  img.src = './assets/moots.webp';
  moots.img = img;
}

function shadow(ctx, x, y, w, h, a) {
  ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.ellipse(x, y, w, h, 0, 0, TAU); ctx.fill(); ctx.restore();
}

// ── player ──────────────────────────────────────────────────────────────────
export function drawPlayer(ctx, p, room) {
  const pal = room.biome.pal;
  const spin = dashSpinPhase(p);
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
    ctx.strokeStyle = pal.accent; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(Math.cos(face) * 16, -30 + Math.sin(face) * 16);
    ctx.lineTo(Math.cos(face) * 40, -30 + Math.sin(face) * 40);
    ctx.stroke();
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
  }
  ctx.restore(); ctx.globalAlpha = 1;
}

// ── enemies ─────────────────────────────────────────────────────────────────
export function drawEnemy(ctx, e, room) {
  const pal = room.biome.pal;
  shadow(ctx, e.x, e.y + e.r * 0.85, e.r * 1.15, e.r * 0.34, 0.26);
  ctx.save();
  ctx.translate(e.x, e.y);
  const glow = e.captain ? 18 : 10;
  ctx.shadowColor = e.color; ctx.shadowBlur = glow;
  const hitFlash = e.hit > 0;
  const body = hitFlash ? '#ffffff' : e.color;

  switch (e.type) {
    case 'skitter': {
      ctx.strokeStyle = body; ctx.lineWidth = 2.4;
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * TAU + e.phase * 1.6;
        ctx.beginPath(); ctx.moveTo(Math.cos(a) * e.r * 0.5, Math.sin(a) * e.r * 0.5);
        ctx.lineTo(Math.cos(a) * e.r * 1.45, Math.sin(a) * e.r * 1.45); ctx.stroke();
      }
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.arc(0, 0, e.r * 0.92, 0, TAU); ctx.fill();
      ctx.fillStyle = '#1a0d12';
      ctx.beginPath(); ctx.arc(0, 0, e.r * 0.4, 0, TAU); ctx.fill();
      break;
    }
    case 'gunner': {
      ctx.fillStyle = body;
      roundRectPath(ctx, -e.r, -e.r * 0.85, e.r * 2, e.r * 1.7, 5); ctx.fill();
      ctx.fillStyle = '#190f08';
      ctx.fillRect(-e.r * 0.42, -e.r * 0.3, e.r * 0.84, e.r * 0.6);
      ctx.fillStyle = body;
      ctx.fillRect(-e.r * 0.16, -e.r * 0.12, e.r * 0.32, e.r * 0.24);
      break;
    }
    case 'charger': {
      const ang = e.state === 'windup' || e.state === 'dash'
        ? Math.atan2(e.chargeY || e.vy, e.chargeX || e.vx) : Math.atan2(e.vy, e.vx);
      ctx.rotate(ang);
      if (e.state === 'windup') {
        ctx.save(); ctx.globalAlpha = 0.4 + 0.3 * Math.sin(e.phase * 30);
        ctx.strokeStyle = pal.bad; ctx.lineWidth = 3; ctx.setLineDash([10, 8]);
        ctx.beginPath(); ctx.moveTo(e.r, 0); ctx.lineTo(e.r + 320, 0); ctx.stroke();
        ctx.restore();
      }
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.moveTo(e.r * 1.3, 0); ctx.lineTo(-e.r * 0.8, -e.r * 0.9);
      ctx.lineTo(-e.r * 0.35, 0); ctx.lineTo(-e.r * 0.8, e.r * 0.9);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#2a0d16';
      ctx.beginPath(); ctx.arc(e.r * 0.1, 0, e.r * 0.3, 0, TAU); ctx.fill();
      break;
    }
    case 'turret': {
      ctx.strokeStyle = body; ctx.lineWidth = 2.6;
      ctx.beginPath(); ctx.arc(0, 0, e.r, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, e.r * 0.62, 0, TAU); ctx.stroke();
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.arc(0, 0, e.r * 0.3, 0, TAU); ctx.fill();
      ctx.save(); ctx.rotate(e.phase * 0.5);
      ctx.fillRect(e.r * 0.5, -3, e.r * 0.7, 6);
      ctx.restore();
      break;
    }
    case 'brute': {
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.arc(0, 0, e.r, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#2a160c'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(0, 0, e.r * 0.62, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-e.r * 0.7, -e.r * 0.7); ctx.lineTo(e.r * 0.7, e.r * 0.7); ctx.stroke();
      break;
    }
    case 'sniper': {
      if (e.aimT > 0 && e.snipeX !== undefined) {
        ctx.save(); ctx.globalAlpha = 0.35 + 0.45 * (1 - e.aimT / 0.88);
        ctx.strokeStyle = '#bfe6ff'; ctx.lineWidth = 1.6; ctx.setLineDash([6, 10]);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(e.snipeX * 960, e.snipeY * 960); ctx.stroke();
        ctx.restore();
      }
      ctx.rotate(Math.PI / 4 + e.phase * 0.2);
      ctx.fillStyle = body;
      starPath(ctx, 0, 0, e.r * 1.15, e.r * 0.4, 4); ctx.fill();
      ctx.fillStyle = '#0e1620';
      ctx.beginPath(); ctx.arc(0, 0, e.r * 0.32, 0, TAU); ctx.fill();
      break;
    }
    case 'hexer': {
      ctx.strokeStyle = body; ctx.lineWidth = 2.6;
      ctx.save(); ctx.rotate(e.phase * 0.7);
      hexPath(ctx, 0, 0, e.r * 1.1); ctx.stroke();
      ctx.restore();
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.arc(0, 0, e.r * 0.5, 0, TAU); ctx.fill();
      break;
    }
    case 'myrmidon': {
      ctx.rotate(Math.atan2(e.vy, e.vx));
      ctx.strokeStyle = body; ctx.lineWidth = 2.6;
      ctx.beginPath(); ctx.arc(0, 0, e.r, 0, TAU); ctx.stroke();
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.moveTo(e.r * 0.95, 0); ctx.lineTo(-e.r * 0.5, -e.r * 0.6); ctx.lineTo(-e.r * 0.2, 0); ctx.lineTo(-e.r * 0.5, e.r * 0.6);
      ctx.closePath(); ctx.fill();
      break;
    }
    default: {
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.arc(0, 0, e.r, 0, TAU); ctx.fill();
    }
  }
  ctx.restore();

  if (e.captain) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = '900 13px Inter, system-ui, sans-serif';
    ctx.fillStyle = e.color; ctx.shadowColor = e.color; ctx.shadowBlur = 10;
    ctx.fillText(e.captain.toUpperCase(), e.x, e.y - e.r * 1.82);
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
  boundary: 'boundary', door: 'door',
};

export function drawObstacle(ctx, o, room) {
  if (o.gone) return;
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
