// Background decoration painters — No Moon's 34-pattern vocabulary
// (docs/no-moon-systems.md §4, game_inline.js:3831-4260). Pure functions; baked
// once per room onto the background canvas. Signature: (ctx, w, h, rng, pal).
import { TAU } from '../config.js';
import { rand, randi } from '../rng.js';

const a = (rng, lo, hi) => lo + rng() * (hi - lo);

function stroke(ctx, color, alpha, width = 1.5) {
  ctx.strokeStyle = color; ctx.globalAlpha = alpha; ctx.lineWidth = width;
}
function fill(ctx, color, alpha) {
  ctx.fillStyle = color; ctx.globalAlpha = alpha;
}
function wander(ctx, rng, x, y, steps, stepLen, turn) {
  let ang = rng() * TAU;
  ctx.beginPath(); ctx.moveTo(x, y);
  for (let s = 0; s < steps; s++) {
    ang += a(rng, -turn, turn);
    x += Math.cos(ang) * stepLen; y += Math.sin(ang) * stepLen;
    ctx.lineTo(x, y);
  }
  ctx.stroke();
}

export const PATTERNS = {
  gridSoft(ctx, w, h, rng, pal) {
    stroke(ctx, pal.accent, 0.05, 1);
    const gap = a(rng, 118, 150);
    for (let x = gap / 2; x < w; x += gap) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = gap / 2; y < h; y += gap) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    fill(ctx, pal.accent, 0.08);
    for (let i = 0; i < 50; i++) ctx.fillRect(rng() * w, rng() * h, 2, 2);
  },
  vines(ctx, w, h, rng, pal) {
    stroke(ctx, pal.accent3, 0.16, 1.6);
    for (let i = 0; i < 60; i++) wander(ctx, rng, rng() * w, rng() * h, randi(rng, 3, 6), a(rng, 16, 38), 0.95);
  },
  plinths(ctx, w, h, rng, pal) {
    for (let i = 0; i < 24; i++) {
      const x = rng() * w, y = rng() * h, r = a(rng, 8, 22);
      stroke(ctx, pal.accent3, 0.18, 1.4);
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y, r * 0.55, 0, TAU); ctx.stroke();
    }
  },
  pools(ctx, w, h, rng, pal) {
    for (let i = 0; i < 36; i++) {
      const x = rng() * w, y = rng() * h, rx = a(rng, 18, 56);
      fill(ctx, pal.accent, 0.05);
      ctx.beginPath(); ctx.ellipse(x, y, rx, rx * a(rng, 0.4, 0.7), rng() * TAU, 0, TAU); ctx.fill();
    }
  },
  reeds(ctx, w, h, rng, pal) {
    stroke(ctx, pal.accent3, 0.2, 1.3);
    for (let i = 0; i < 140; i++) {
      const x = rng() * w, y = rng() * h, len = a(rng, 10, 26);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + a(rng, -8, 8), y - len); ctx.stroke();
    }
  },
  mudRings(ctx, w, h, rng, pal) {
    stroke(ctx, '#e8d9b6', 0.07, 1.2);
    for (let i = 0; i < 56; i++) {
      const x = rng() * w, y = rng() * h, r = a(rng, 8, 26);
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
      if (rng() < 0.5) { ctx.beginPath(); ctx.arc(x, y, r * 0.6, 0, TAU); ctx.stroke(); }
    }
  },
  fogBanks(ctx, w, h, rng, pal) {
    for (let i = 0; i < 24; i++) {
      fill(ctx, '#d8f8ff', 0.035);
      ctx.beginPath(); ctx.ellipse(rng() * w, rng() * h, a(rng, 70, 180), a(rng, 26, 60), rng() * 0.6, 0, TAU); ctx.fill();
    }
  },
  lilyLights(ctx, w, h, rng, pal) {
    fill(ctx, pal.accent2, 0.22);
    for (let i = 0; i < 90; i++) { ctx.beginPath(); ctx.arc(rng() * w, rng() * h, a(rng, 1.4, 3.6), 0, TAU); ctx.fill(); }
  },
  glassShards(ctx, w, h, rng, pal) {
    stroke(ctx, pal.accent, 0.14, 1.2);
    for (let i = 0; i < 62; i++) {
      const x = rng() * w, y = rng() * h, n = randi(rng, 4, 6), r = a(rng, 8, 26);
      ctx.beginPath();
      for (let k = 0; k < n; k++) {
        const ang = (k / n) * TAU + rng() * 0.6;
        const rr = r * a(rng, 0.5, 1);
        k ? ctx.lineTo(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr) : ctx.moveTo(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr);
      }
      ctx.closePath(); ctx.stroke();
    }
  },
  reflections(ctx, w, h, rng, pal) {
    stroke(ctx, '#ffffff', 0.10, 1.2);
    for (let i = 0; i < 100; i++) {
      const x = rng() * w, y = rng() * h, len = a(rng, 8, 42);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + len, y); ctx.stroke();
    }
  },
  cracks(ctx, w, h, rng, pal) {
    stroke(ctx, pal.accent3, 0.2, 1.1);
    for (let i = 0; i < 76; i++) wander(ctx, rng, rng() * w, rng() * h, randi(rng, 3, 5), a(rng, 16, 42), 0.75);
  },
  petals(ctx, w, h, rng, pal) {
    for (let i = 0; i < 180; i++) {
      fill(ctx, rng() < 0.5 ? pal.accent : pal.accent2, 0.12);
      ctx.beginPath(); ctx.ellipse(rng() * w, rng() * h, a(rng, 2, 5), a(rng, 1.2, 2.8), rng() * TAU, 0, TAU); ctx.fill();
    }
  },
  braids(ctx, w, h, rng, pal) {
    stroke(ctx, pal.accent3, 0.14, 1.3);
    for (let i = 0; i < 50; i++) {
      const x = rng() * w, y = rng() * h, ang = rng() * TAU, len = a(rng, 30, 70);
      for (const off of [-4, 4]) {
        ctx.beginPath();
        for (let s = 0; s <= 6; s++) {
          const t = s / 6;
          const px = x + Math.cos(ang) * len * t + Math.cos(ang + Math.PI / 2) * (off + Math.sin(t * TAU) * 4);
          const py = y + Math.sin(ang) * len * t + Math.sin(ang + Math.PI / 2) * (off + Math.sin(t * TAU) * 4);
          s ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        }
        ctx.stroke();
      }
    }
  },
  arches(ctx, w, h, rng, pal) {
    stroke(ctx, pal.accent3, 0.18, 1.6);
    for (let i = 0; i < 20; i++) {
      const x = rng() * w, y = rng() * h, r = a(rng, 18, 54);
      ctx.beginPath(); ctx.arc(x, y, r, Math.PI, TAU); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - r, y); ctx.lineTo(x - r, y + r * 0.6); ctx.moveTo(x + r, y); ctx.lineTo(x + r, y + r * 0.6); ctx.stroke();
    }
  },
  embers(ctx, w, h, rng, pal) {
    for (let i = 0; i < 130; i++) {
      fill(ctx, rng() < 0.6 ? pal.accent : pal.accent2, a(rng, 0.06, 0.2));
      ctx.beginPath(); ctx.arc(rng() * w, rng() * h, a(rng, 1.5, 5), 0, TAU); ctx.fill();
    }
  },
  fans(ctx, w, h, rng, pal) {
    stroke(ctx, pal.accent3, 0.15, 1.3);
    for (let i = 0; i < 28; i++) {
      const x = rng() * w, y = rng() * h, base = rng() * TAU, span = a(rng, 0.5, 1.3);
      for (let k = 1; k <= 3; k++) {
        ctx.beginPath(); ctx.arc(x, y, k * a(rng, 8, 14), base, base + span); ctx.stroke();
      }
    }
  },
  kilnRings(ctx, w, h, rng, pal) {
    stroke(ctx, pal.accent, 0.08, 1.6);
    for (let i = 0; i < 30; i++) {
      const x = rng() * w, y = rng() * h;
      for (let k = 1; k <= randi(rng, 2, 3); k++) { ctx.beginPath(); ctx.arc(x, y, k * a(rng, 9, 15), 0, TAU); ctx.stroke(); }
    }
  },
  ashWaves(ctx, w, h, rng, pal) {
    stroke(ctx, '#f8d0b5', 0.08, 1.2);
    for (let i = 0; i < 48; i++) {
      const x = rng() * w, y = rng() * h, len = a(rng, 40, 90), amp = a(rng, 4, 12);
      ctx.beginPath();
      for (let s = 0; s <= 8; s++) {
        const t = s / 8;
        s ? ctx.lineTo(x + len * t, y + Math.sin(t * TAU) * amp) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
  },
  hyphae(ctx, w, h, rng, pal) {
    stroke(ctx, pal.accent3, 0.16, 1.2);
    for (let i = 0; i < 64; i++) {
      const x = rng() * w, y = rng() * h;
      wander(ctx, rng, x, y, 5, a(rng, 10, 22), 0.7);
      if (rng() < 0.5) wander(ctx, rng, x, y, 3, a(rng, 8, 16), 0.9);
    }
  },
  caps(ctx, w, h, rng, pal) {
    for (let i = 0; i < 56; i++) {
      const x = rng() * w, y = rng() * h, r = a(rng, 4, 12);
      fill(ctx, pal.accent, 0.13);
      ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.55, 0, Math.PI, TAU); ctx.fill();
      stroke(ctx, pal.accent3, 0.18, 1.2);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + r * 0.9); ctx.stroke();
    }
  },
  sporeRings(ctx, w, h, rng, pal) {
    stroke(ctx, pal.accent2, 0.1, 1);
    for (let i = 0; i < 70; i++) {
      const x = rng() * w, y = rng() * h, r = a(rng, 6, 18);
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
      if (rng() < 0.4) { ctx.beginPath(); ctx.arc(x, y, r * 0.5, 0, TAU); ctx.stroke(); }
    }
  },
  glowDots(ctx, w, h, rng, pal) {
    for (let i = 0; i < 130; i++) {
      fill(ctx, rng() < 0.5 ? pal.accent : pal.accent2, a(rng, 0.1, 0.3));
      ctx.beginPath(); ctx.arc(rng() * w, rng() * h, a(rng, 1.2, 5.2), 0, TAU); ctx.fill();
    }
  },
  hexes(ctx, w, h, rng, pal) {
    stroke(ctx, pal.accent, 0.10, 1.2);
    for (let i = 0; i < 50; i++) {
      const x = rng() * w, y = rng() * h, r = a(rng, 8, 22), rot = rng() * TAU;
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const ang = rot + (k / 6) * TAU;
        k ? ctx.lineTo(x + Math.cos(ang) * r, y + Math.sin(ang) * r) : ctx.moveTo(x + Math.cos(ang) * r, y + Math.sin(ang) * r);
      }
      ctx.closePath(); ctx.stroke();
    }
  },
  circuits(ctx, w, h, rng, pal) {
    stroke(ctx, pal.accent, 0.12, 1.2);
    fill(ctx, pal.accent, 0.2);
    for (let i = 0; i < 60; i++) {
      let x = rng() * w, y = rng() * h;
      ctx.beginPath(); ctx.moveTo(x, y);
      for (let s = 0; s < randi(rng, 2, 4); s++) {
        if (rng() < 0.5) x += a(rng, -50, 50); else y += a(rng, -50, 50);
        ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y, 2.2, 0, TAU); ctx.fill();
    }
  },
  roots(ctx, w, h, rng, pal) {
    for (let i = 0; i < 38; i++) {
      stroke(ctx, pal.accent3, 0.2, a(rng, 2, 3.4));
      wander(ctx, rng, rng() * w, rng() * h, 4, a(rng, 18, 34), 0.6);
      stroke(ctx, pal.accent3, 0.14, 1.1);
      wander(ctx, rng, rng() * w, rng() * h, 4, a(rng, 12, 24), 0.8);
    }
  },
  monoliths(ctx, w, h, rng, pal) {
    for (let i = 0; i < 24; i++) {
      const x = rng() * w, y = rng() * h, ww = a(rng, 18, 42), hh = a(rng, 32, 76);
      fill(ctx, pal.accent3, 0.13);
      ctx.fillRect(x, y, ww, hh);
      stroke(ctx, pal.accent3, 0.22, 1.2);
      ctx.strokeRect(x, y, ww, hh);
    }
  },
  rings(ctx, w, h, rng, pal) {
    stroke(ctx, pal.accent, 0.08, 1.4);
    for (let i = 0; i < 34; i++) {
      ctx.beginPath(); ctx.arc(rng() * w, rng() * h, a(rng, 10, 36), 0, TAU); ctx.stroke();
    }
  },
  orbits(ctx, w, h, rng, pal) {
    stroke(ctx, pal.accent, 0.12, 1.2);
    fill(ctx, pal.accent2, 0.3);
    for (let i = 0; i < 26; i++) {
      const x = rng() * w, y = rng() * h, r = a(rng, 18, 54), s = rng() * TAU, e = s + a(rng, 1.2, 4.4);
      ctx.beginPath(); ctx.arc(x, y, r, s, e); ctx.stroke();
      ctx.beginPath(); ctx.arc(x + Math.cos(e) * r, y + Math.sin(e) * r, 2.4, 0, TAU); ctx.fill();
    }
  },
  stacks(ctx, w, h, rng, pal) {
    for (let i = 0; i < 32; i++) {
      const x = rng() * w, y = rng() * h, ww = a(rng, 20, 58);
      for (let k = 0; k < randi(rng, 2, 3); k++) {
        fill(ctx, pal.accent3, 0.14);
        const hh = a(rng, 8, 16);
        ctx.fillRect(x + a(rng, -4, 4), y - k * (hh + 2), ww * a(rng, 0.7, 1), hh);
      }
    }
  },
  glyphs(ctx, w, h, rng, pal) {
    stroke(ctx, pal.accent2, 0.16, 1.2);
    for (let i = 0; i < 90; i++) {
      const x = rng() * w, y = rng() * h, s = a(rng, 3, 8);
      ctx.beginPath();
      if (rng() < 0.5) { ctx.moveTo(x - s, y); ctx.lineTo(x + s, y); ctx.moveTo(x, y - s); ctx.lineTo(x, y + s); }
      else { ctx.moveTo(x - s, y - s); ctx.lineTo(x + s, y + s); ctx.moveTo(x + s, y - s); ctx.lineTo(x - s, y + s); }
      ctx.stroke();
    }
  },
  bones(ctx, w, h, rng, pal) {
    stroke(ctx, pal.accent2, 0.11, 1.6);
    fill(ctx, pal.accent2, 0.16);
    for (let i = 0; i < 28; i++) {
      const x = rng() * w, y = rng() * h, ang = rng() * TAU, len = a(rng, 14, 34);
      const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
      ctx.beginPath(); ctx.moveTo(x, y);
      ctx.quadraticCurveTo((x + x2) / 2 + a(rng, -6, 6), (y + y2) / 2 + a(rng, -6, 6), x2, y2); ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y, 2.2, 0, TAU); ctx.arc(x2, y2, 2.2, 0, TAU); ctx.fill();
    }
  },
  halos(ctx, w, h, rng, pal) {
    stroke(ctx, pal.accent, 0.06, 2);
    for (let i = 0; i < 20; i++) {
      ctx.beginPath(); ctx.arc(rng() * w, rng() * h, a(rng, 30, 90), 0, TAU); ctx.stroke();
    }
  },
  stars(ctx, w, h, rng, pal) {
    fill(ctx, '#ffffff', 0.16);
    for (let i = 0; i < 130; i++) {
      const x = rng() * w, y = rng() * h, r = a(rng, 1, 2.6);
      ctx.beginPath();
      for (let k = 0; k < 8; k++) {
        const ang = (k / 8) * TAU, rr = k % 2 ? r : r * 2.2;
        k ? ctx.lineTo(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr) : ctx.moveTo(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr);
      }
      ctx.closePath(); ctx.fill();
    }
  },
};

export function paintPattern(name, ctx, w, h, rng, pal) {
  const fn = PATTERNS[name];
  if (!fn) return;
  ctx.save();
  fn(ctx, w, h, rng, pal);
  ctx.restore();
  ctx.globalAlpha = 1;
}
