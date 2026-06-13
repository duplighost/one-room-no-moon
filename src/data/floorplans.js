// Floorplan generators — Phase 8a. Each returns an array of wall rects that
// partition the room into real chambers, BEFORE the cover scatter. Walls are
// solid (block movement + all bullets). Openings are generous (the small-door
// complaint); some dividers seal with a breakable segment you smash to open.
// Connectivity is guaranteed by construction and validated by flood-fill in the
// roller (docs/room-architecture.md §2). Partitions sit in the upper/middle band
// so the player spawn (≈0.66h) stays clear and you traverse them to the portal.
import { rand, randi, chance, pick } from '../rng.js';

export const FLOORPLAN_IDS = ['none', 'none', 'bisect', 'innerSanctum', 'spineCorridor', 'quadrants'];

const T = 30;                 // wall thickness
const GAP = [170, 230];       // opening width — at least ~4 player diameters

function wall(x, y, w, h, style, extra = {}) {
  return { type: 'rect', x, y, w, h, wall: true, ledgeHeight: Infinity, style, round: 4, ...extra };
}

// a wall line with ONE opening. horizontal: spans xa..xb at center-y `c`.
// If breakable, the opening is filled by a smashable segment (room looks sealed
// until you break through); else it's just an open gap.
function lineH(rng, c, xa, xb, idx, breakable, out, openings) {
  const span = xb - xa;
  const gap = Math.min(rand(rng, GAP[0], GAP[1]), span * 0.55);
  const gx = rand(rng, xa + gap * 0.75, xb - gap * 0.75);
  out.push(wall(xa, c - T / 2, (gx - gap / 2) - xa, T, 'wall'));
  out.push(wall(gx + gap / 2, c - T / 2, xb - (gx + gap / 2), T, 'wall'));
  if (breakable) out.push(wall(gx - gap / 2, c - T / 2, gap, T, 'door', { breakable: true, species: 'wallSegment', hp: 7 + idx * 2 }));
  openings.push({ x: gx, y: c, breakable });
}
function lineV(rng, c, ya, yb, idx, breakable, out, openings) {
  const span = yb - ya;
  const gap = Math.min(rand(rng, GAP[0], GAP[1]), span * 0.55);
  const gy = rand(rng, ya + gap * 0.75, yb - gap * 0.75);
  out.push(wall(c - T / 2, ya, T, (gy - gap / 2) - ya, 'wall'));
  out.push(wall(c - T / 2, gy + gap / 2, T, yb - (gy + gap / 2), 'wall'));
  if (breakable) out.push(wall(c - T / 2, gy - gap / 2, T, gap, 'door', { breakable: true, species: 'wallSegment', hp: 7 + idx * 2 }));
  openings.push({ x: c, y: gy, breakable });
}

export const FLOORPLANS = {
  none() { return { walls: [], openings: [] }; },

  bisect(room, rng, idx) {
    const walls = [], openings = [];
    const w = room.wall;
    const breakable = chance(rng, 0.4);
    if (chance(rng, 0.6)) {
      // horizontal divider between portal (top) and spawn (lower)
      lineH(rng, room.h * rand(rng, 0.40, 0.5), w + 30, room.w - w - 30, idx, breakable, walls, openings);
    } else {
      // vertical divider, off-centre so it never bisects the spawn point
      lineV(rng, room.w * (chance(rng, 0.5) ? rand(rng, 0.30, 0.4) : rand(rng, 0.6, 0.7)), w + 30, room.h - w - 30, idx, breakable, walls, openings);
    }
    return { walls, openings };
  },

  spineCorridor(room, rng, idx) {
    // two vertical walls → central hallway (holds spawn) + two side chambers
    const walls = [], openings = [];
    const w = room.wall;
    const lx = room.w * rand(rng, 0.30, 0.36);
    const rx = room.w * rand(rng, 0.64, 0.70);
    lineV(rng, lx, w + 30, room.h - w - 30, idx, chance(rng, 0.3), walls, openings);
    lineV(rng, rx, w + 30, room.h - w - 30, idx, chance(rng, 0.3), walls, openings);
    return { walls, openings };
  },

  quadrants(room, rng, idx) {
    // a cross, offset so the spawn sits clear in one quadrant; gaps near the hub
    const walls = [], openings = [];
    const w = room.wall;
    const cy = room.h * rand(rng, 0.42, 0.5);
    const cx = room.w * (chance(rng, 0.5) ? rand(rng, 0.40, 0.46) : rand(rng, 0.54, 0.6));
    lineH(rng, cy, w + 30, room.w - w - 30, idx, false, walls, openings);
    lineV(rng, cx, w + 30, room.h - w - 30, idx, false, walls, openings);
    return { walls, openings };
  },

  innerSanctum(room, rng, idx) {
    // a walled box in the upper-middle with 1-2 entrances; holds the good stuff
    const walls = [], openings = [];
    const bw = room.w * rand(rng, 0.34, 0.44);
    const bh = room.h * rand(rng, 0.24, 0.30);
    const bx = room.w * 0.5 - bw / 2 + rand(rng, -40, 40);
    // sit the box mid-room: portal stays clear above it, spawn clear below it
    const by = room.h * rand(rng, 0.42, 0.47) - bh / 2;
    const gap = rand(rng, GAP[0], GAP[1]);
    // bottom edge always has the main entrance (faces the player)
    const egx = bx + bw * rand(rng, 0.35, 0.65);
    walls.push(wall(bx, by + bh - T / 2, (egx - gap / 2) - bx, T, 'wall'));
    walls.push(wall(egx + gap / 2, by + bh - T / 2, (bx + bw) - (egx + gap / 2), T, 'wall'));
    // top edge solid, sides solid (optionally a 2nd side entrance)
    walls.push(wall(bx, by - T / 2, bw, T, 'wall'));
    const sideGap = chance(rng, 0.5);
    if (sideGap) {
      const sgy = by + bh * rand(rng, 0.35, 0.6);
      walls.push(wall(bx - T / 2, by, T, (sgy - gap / 2) - by, 'wall'));
      walls.push(wall(bx - T / 2, sgy + gap / 2, T, (by + bh) - (sgy + gap / 2), 'wall'));
      walls.push(wall(bx + bw - T / 2, by, T, bh, 'wall'));
      openings.push({ x: bx, y: sgy, breakable: false });
    } else {
      walls.push(wall(bx - T / 2, by, T, bh, 'wall'));
      walls.push(wall(bx + bw - T / 2, by, T, bh, 'wall'));
    }
    openings.push({ x: egx, y: by + bh, breakable: false });
    return { walls, openings, sanctum: { x: bx, y: by, w: bw, h: bh } };
  },
};
