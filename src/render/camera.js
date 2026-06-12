// Viewport + damped camera with aim-lead, kick and shake (No Moon's model).
import { clamp, damp } from '../rng.js';
import { state } from '../state.js';
import { coarse } from '../systems/juice.js';

export const view = { W: 1, H: 1, DPR: 1, scale: 1, mobile: false, portrait: false };
export const cam = { x: 0, y: 0, kickX: 0, kickY: 0 };

export function resize(canvas, bloomCanvas) {
  const iw = (typeof innerWidth !== 'undefined') ? innerWidth : 1280;
  const ih = (typeof innerHeight !== 'undefined') ? innerHeight : 720;
  view.mobile = coarse() || iw < 760 || ih < 560;
  view.portrait = ih >= iw;
  view.DPR = Math.min(view.mobile ? 1.35 : 2, Math.max(1, (typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1)));
  view.scale = view.mobile ? (view.portrait ? 0.52 : 0.70) : 1;
  view.W = Math.max(320, Math.floor(iw));
  view.H = Math.max(320, Math.floor(ih));
  if (canvas) {
    canvas.width = Math.floor(view.W * view.DPR);
    canvas.height = Math.floor(view.H * view.DPR);
    canvas.style.width = view.W + 'px';
    canvas.style.height = view.H + 'px';
  }
  if (bloomCanvas) {
    bloomCanvas.width = Math.max(1, Math.floor(view.W * view.DPR * 0.5));
    bloomCanvas.height = Math.max(1, Math.floor(view.H * view.DPR * 0.5));
  }
}

export function snapCamera() {
  const p = state.run?.player, room = state.room;
  if (!p || !room) return;
  const vw = view.W / view.scale, vh = view.H / view.scale;
  cam.x = clampCam(p.x - vw / 2, room.w, vw);
  cam.y = clampCam(p.y - vh / 2, room.h, vh);
}

function clampCam(v, roomSpan, viewSpan) {
  if (viewSpan >= roomSpan) return (roomSpan - viewSpan) / 2; // room smaller than view: center
  return clamp(v, 0, roomSpan - viewSpan);
}

export function kick(x, y) { cam.kickX += x; cam.kickY += y; }

export function updateCamera(dt) {
  const p = state.run?.player, room = state.room;
  if (!p || !room) return;
  const vw = view.W / view.scale, vh = view.H / view.scale;
  const tx = p.x + p.aimX * 58 + p.vx * 0.09 - vw / 2;
  const ty = p.y + p.aimY * 58 + p.vy * 0.09 - vh / 2;
  cam.x = damp(cam.x, clampCam(tx, room.w, vw), 8.8, dt);
  cam.y = damp(cam.y, clampCam(ty, room.h, vh), 8.8, dt);
  cam.kickX = damp(cam.kickX, 0, 17, dt);
  cam.kickY = damp(cam.kickY, 0, 17, dt);
}

// world transform for the frame; returns the shake offsets applied
export function applyWorldTransform(ctx) {
  const s = state.fx.shake;
  const ox = (Math.random() * 2 - 1) * s * 14;
  const oy = (Math.random() * 2 - 1) * s * 14;
  ctx.setTransform(view.DPR * view.scale, 0, 0, view.DPR * view.scale,
    (-cam.x - cam.kickX + ox) * view.DPR * view.scale,
    (-cam.y - cam.kickY + oy) * view.DPR * view.scale);
}

export function uiTransform(ctx) {
  ctx.setTransform(view.DPR, 0, 0, view.DPR, 0, 0);
}

export function screenToWorld(sx, sy) {
  return { x: cam.x + sx / view.scale, y: cam.y + sy / view.scale };
}
