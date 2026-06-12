// Frame composition — fixed order (architecture.md §2): baked bg → hazards →
// telegraphs → portal → pickups → y-sorted entities → bullets → particles →
// floats → bloom → screen overlay → danger triangles → flash → transition.
import { TAU, BLOOM } from '../config.js';
import { state } from '../state.js';
import { clamp } from '../rng.js';
import { view, cam, applyWorldTransform, uiTransform } from './camera.js';
import { drawPlayer, drawEnemy, drawObstacle, roundRectPath, starPath, heartPath } from './sprites.js';
import { drawParticles, drawFloats } from './particles.js';
import { ENEMY_TYPES } from '../data/enemies.js';
import { reduced } from '../systems/juice.js';

let canvas = null, ctx = null, bloomCanvas = null, bloomCtx = null;

export function initDraw(c, bc) {
  canvas = c;
  ctx = c.getContext('2d', { alpha: false, desynchronized: true });
  bloomCanvas = bc;
  bloomCtx = bc.getContext('2d');
  return ctx;
}

export function drawFrame() {
  if (!ctx) return;
  uiTransform(ctx);
  ctx.fillStyle = '#05070b';
  ctx.fillRect(0, 0, view.W, view.H);

  const room = state.room;
  if (!room) { drawTitleBg(); return; }
  const p = state.run?.player;
  const pal = room.biome.pal;

  applyWorldTransform(ctx);

  // baked background
  if (room.background) ctx.drawImage(room.background, 0, 0);
  else { ctx.fillStyle = pal.floor; ctx.fillRect(0, 0, room.w, room.h); }

  // wall frame
  ctx.strokeStyle = pal.accent3; ctx.globalAlpha = 0.85; ctx.lineWidth = 5;
  roundRectPath(ctx, room.wall - 20, room.wall - 20, room.w - room.wall * 2 + 40, room.h - room.wall * 2 + 40, 26);
  ctx.stroke();
  ctx.globalAlpha = 0.25; ctx.strokeStyle = pal.accent; ctx.lineWidth = 12;
  roundRectPath(ctx, room.wall - 28, room.wall - 28, room.w - room.wall * 2 + 56, room.h - room.wall * 2 + 56, 30);
  ctx.stroke();
  ctx.globalAlpha = 1;

  drawHazardsUnder(room, pal);
  drawSpawnGlyphs(room);
  if (room.portal) drawPortal(room, pal);
  drawPickups(room, pal);

  // y-sorted entities
  const renderables = [];
  for (const o of room.obstacles) if (!o.gone) {
    renderables.push({ y: o.type === 'circle' ? o.y + o.rad : o.y + o.h, draw: () => drawObstacle(ctx, o, room) });
  }
  for (const e of room.enemies) renderables.push({ y: e.y + e.r, draw: () => drawEnemy(ctx, e, room) });
  if (p && !p.dead) renderables.push({ y: p.y + p.r + 6, draw: () => drawPlayer(ctx, p, room) });
  renderables.sort((a, b) => a.y - b.y);
  for (const r of renderables) r.draw();

  drawLanesOver(room);
  drawBullets(room);
  drawParticles(ctx, room);
  drawFloats(ctx, room);

  // bloom composite (No Moon recipe: half-res, screen blend)
  if (!reduced() && bloomCanvas) {
    bloomCtx.setTransform(1, 0, 0, 1, 0, 0);
    bloomCtx.clearRect(0, 0, bloomCanvas.width, bloomCanvas.height);
    bloomCtx.drawImage(canvas, 0, 0, bloomCanvas.width, bloomCanvas.height);
    uiTransform(ctx);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = BLOOM.ALPHA;
    ctx.filter = BLOOM.FILTER;
    ctx.drawImage(bloomCanvas, 0, 0, view.W, view.H);
    ctx.restore();
  }

  // screen overlay: biome tint, vignette, frame, danger triangles, flash
  uiTransform(ctx);
  const tint = ctx.createRadialGradient(view.W / 2, view.H * 0.46, Math.min(view.W, view.H) * 0.2, view.W / 2, view.H / 2, Math.max(view.W, view.H) * 0.7);
  tint.addColorStop(0, hexA(pal.accent, 0.04));
  tint.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, view.W, view.H);

  const vg = ctx.createRadialGradient(view.W / 2, view.H * 0.48, Math.min(view.W, view.H) * 0.22, view.W / 2, view.H / 2, Math.max(view.W, view.H) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.38)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, view.W, view.H);

  if (p && state.mode === 'play') drawDangerTriangles(room, p);

  if (state.fx.flash > 0) {
    ctx.fillStyle = `rgba(255,235,245,${clamp(state.fx.flash * 0.5, 0, 0.5)})`;
    ctx.fillRect(0, 0, view.W, view.H);
  }

  if (state.transition) drawTransition();
}

// ── hazards ─────────────────────────────────────────────────────────────────
function drawHazardsUnder(room, pal) {
  const t = performance.now() / 1000;
  for (const h of room.hazards) {
    if (h.type === 'fog' || h.type === 'spore') {
      const g = ctx.createRadialGradient(h.x, h.y, h.r * 0.2, h.x, h.y, h.r);
      g.addColorStop(0, hexA(h.color, h.type === 'spore' ? 0.22 : 0.16));
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(h.x, h.y, h.r + Math.sin(t * 1.4 + h.phase) * 6, 0, TAU); ctx.fill();
      if (h.type === 'spore') {
        ctx.strokeStyle = hexA(h.color, 0.5); ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(h.x, h.y, h.r * h.coreFrac, 0, TAU); ctx.stroke();
      }
    } else if (h.type === 'snare' || h.type === 'thorn') {
      ctx.strokeStyle = hexA(h.color, 0.55); ctx.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU + h.phase * 0.4;
        ctx.beginPath();
        ctx.moveTo(h.x + Math.cos(a) * h.r * 0.3, h.y + Math.sin(a) * h.r * 0.3);
        ctx.quadraticCurveTo(
          h.x + Math.cos(a + 0.5) * h.r * 0.8, h.y + Math.sin(a + 0.5) * h.r * 0.8,
          h.x + Math.cos(a + 0.2) * h.r, h.y + Math.sin(a + 0.2) * h.r);
        ctx.stroke();
      }
      ctx.fillStyle = hexA(h.color, 0.1);
      ctx.beginPath(); ctx.arc(h.x, h.y, h.r, 0, TAU); ctx.fill();
    } else if (h.type === 'shard' || h.type === 'volatile') {
      ctx.save();
      ctx.translate(h.x, h.y); ctx.rotate(h.phase * 0.3);
      ctx.fillStyle = hexA(h.color, 0.85);
      ctx.shadowColor = h.color; ctx.shadowBlur = 12;
      starPath(ctx, 0, 0, h.r, h.r * 0.45, 4); ctx.fill();
      ctx.restore();
    } else if (h.type === 'pulse' || h.type === 'ritual') {
      ctx.strokeStyle = hexA(h.color, 0.8); ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.arc(h.x, h.y, h.r * (0.8 + Math.sin(t * 2 + h.phase) * 0.1), 0, TAU); ctx.stroke();
      ctx.fillStyle = hexA(h.color, 0.25);
      ctx.beginPath(); ctx.arc(h.x, h.y, h.r * 0.45, 0, TAU); ctx.fill();
      if (h.on && h.wave > 0) {
        ctx.strokeStyle = hexA(h.color, clamp(1 - h.wave / h.waveSpan, 0.15, 0.9));
        ctx.lineWidth = 7;
        ctx.beginPath(); ctx.arc(h.x, h.y, h.wave, 0, TAU); ctx.stroke();
      }
    }
  }
}

function drawLanesOver(room) {
  for (const l of room.lanes) {
    if (!l.tele && !l.active) continue;
    ctx.save();
    if (l.tele) {
      ctx.globalAlpha = 0.3;
      ctx.strokeStyle = l.color; ctx.lineWidth = 2; ctx.setLineDash([12, 10]);
      ctx.beginPath(); ctx.moveTo(l.x1, l.y1); ctx.lineTo(l.x2, l.y2); ctx.stroke();
    } else {
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = l.color;
      ctx.shadowColor = l.color; ctx.shadowBlur = 18;
      ctx.lineWidth = l.width;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(l.x1, l.y1); ctx.lineTo(l.x2, l.y2); ctx.stroke();
    }
    ctx.restore();
  }
}

function drawSpawnGlyphs(room) {
  for (const s of room.spawnQueue) {
    const def = ENEMY_TYPES[s.type];
    const t = clamp((room.time - s.glyphAt) / Math.max(0.01, s.at - s.glyphAt), 0, 1);
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.globalAlpha = 0.25 + t * 0.6;
    ctx.strokeStyle = def?.color || '#fff';
    ctx.lineWidth = 2;
    ctx.rotate(t * Math.PI);
    const r = 18 * (1 - t * 0.4);
    ctx.strokeRect(-r, -r, r * 2, r * 2);
    ctx.beginPath(); ctx.arc(0, 0, r * 1.5 * (1 - t), 0, TAU); ctx.stroke();
    ctx.restore();
  }
}

function drawPortal(room, pal) {
  const po = room.portal;
  const t = performance.now() / 1000;
  const r = po.r + Math.sin(t * 5) * 4;
  const g = ctx.createRadialGradient(po.x, po.y, 8, po.x, po.y, r * 1.8);
  g.addColorStop(0, hexA(pal.accent3, 0.8));
  g.addColorStop(0.45, hexA(pal.accent, 0.4));
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(po.x, po.y, r * 1.8, 0, TAU); ctx.fill();
  ctx.strokeStyle = pal.accent3; ctx.lineWidth = 4;
  ctx.shadowColor = pal.accent3; ctx.shadowBlur = 16;
  starPath(ctx, po.x, po.y, r, r * 0.45, 6);
  ctx.stroke();
  ctx.shadowBlur = 0;
}

function drawPickups(room, pal) {
  const t = performance.now() / 1000;
  for (const q of room.pickups) {
    const bob = Math.sin(t * 4 + q.x * 0.01) * 3;
    ctx.save();
    ctx.translate(q.x, q.y + bob);
    if (q.type === 'spark') {
      ctx.fillStyle = pal.accent2;
      ctx.shadowColor = pal.accent2; ctx.shadowBlur = 9;
      starPath(ctx, 0, 0, 5.5, 2.4, 4); ctx.fill();
    } else if (q.type === 'repair') {
      ctx.fillStyle = '#7efab7'; ctx.shadowColor = '#7efab7'; ctx.shadowBlur = 10;
      ctx.fillRect(-7, -2.4, 14, 4.8); ctx.fillRect(-2.4, -7, 4.8, 14);
    } else if (q.type === 'heart' || q.type === 'marrow') {
      const c = q.type === 'heart' ? '#ff8ea6' : '#f7d7ff';
      ctx.fillStyle = c; ctx.shadowColor = c; ctx.shadowBlur = 12;
      heartPath(ctx, 0, 0, 11); ctx.fill();
    }
    ctx.restore();
  }
}

function drawBullets(room) {
  for (const b of room.bullets) {
    ctx.save();
    ctx.fillStyle = b.color;
    ctx.shadowColor = b.color;
    ctx.shadowBlur = b.owner === 'player' ? 10 : 13;
    const sp = Math.hypot(b.vx, b.vy) || 1;
    if (sp > 60) {
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = b.color; ctx.lineWidth = b.r * 1.1; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(b.x - (b.vx / sp) * b.r * 3.2, b.y - (b.vy / sp) * b.r * 3.2);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
    ctx.restore();
  }
}

function drawDangerTriangles(room, p) {
  const margin = 28, triSize = 12;
  let count = 0;
  for (const e of room.enemies) {
    if (e.hp <= 0 || count >= 8) break;
    const sx = (e.x - cam.x) * view.scale, sy = (e.y - cam.y) * view.scale;
    if (sx > margin && sx < view.W - margin && sy > margin && sy < view.H - margin) continue;
    count++;
    const cx = clamp(sx, margin, view.W - margin), cy = clamp(sy, margin, view.H - margin);
    const angle = Math.atan2(sy - view.H / 2, sx - view.W / 2);
    const isTele = (e.type === 'charger' && e.state === 'windup') || (e.type === 'sniper' && e.aimT > 0);
    const s = isTele ? triSize * 1.6 : triSize;
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(angle);
    ctx.globalAlpha = isTele ? 0.95 : 0.55;
    ctx.fillStyle = isTele ? '#ff3333' : e.color;
    ctx.beginPath();
    ctx.moveTo(s, 0); ctx.lineTo(-s * 0.5, -s * 0.6); ctx.lineTo(-s * 0.5, s * 0.6);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}

// ── transition (Boon Moots' three-beat fade, index.html:928-948) ────────────
function drawTransition() {
  const t = state.transition;
  const p = clamp(t.timer / t.duration, 0, 1);
  if (p < 0.28) {
    ctx.fillStyle = `rgba(5,3,10,${p / 0.28})`;
    ctx.fillRect(0, 0, view.W, view.H);
  } else if (p < 0.72) {
    ctx.fillStyle = '#05030a';
    ctx.fillRect(0, 0, view.W, view.H);
    const a = Math.min(1, (p - 0.28) / 0.1) * Math.min(1, (0.72 - p) / 0.1);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff7ff';
    ctx.font = '900 42px Inter, system-ui, sans-serif';
    ctx.fillText(t.title, view.W / 2, view.H / 2 - 8);
    ctx.font = '800 16px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#cabee0';
    ctx.fillText(t.sub, view.W / 2, view.H / 2 + 28);
    if (t.tag) {
      ctx.fillStyle = '#8fa3c8';
      ctx.font = '800 13px Inter, system-ui, sans-serif';
      ctx.fillText(t.tag, view.W / 2, view.H / 2 + 52);
    }
    ctx.restore();
  } else {
    ctx.fillStyle = `rgba(5,3,10,${1 - (p - 0.72) / 0.28})`;
    ctx.fillRect(0, 0, view.W, view.H);
  }
}

// ── title backdrop ──────────────────────────────────────────────────────────
const titleMotes = [];
function drawTitleBg() {
  const t = performance.now() / 1000;
  const g = ctx.createLinearGradient(0, 0, 0, view.H);
  g.addColorStop(0, '#070411');
  g.addColorStop(1, '#0d1018');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, view.W, view.H);
  if (!titleMotes.length) {
    for (let i = 0; i < 70; i++) {
      titleMotes.push({ x: Math.random(), y: Math.random(), r: Math.random() * 2.2 + 0.6, s: Math.random() * 0.014 + 0.004, ph: Math.random() * TAU });
    }
  }
  for (const m of titleMotes) {
    m.y -= m.s * 0.016;
    if (m.y < -0.02) m.y = 1.02;
    ctx.globalAlpha = 0.3 + Math.sin(t * 2 + m.ph) * 0.2;
    ctx.fillStyle = '#9eb4d8';
    ctx.beginPath(); ctx.arc(m.x * view.W, m.y * view.H, m.r, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function hexA(hex, a) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}
