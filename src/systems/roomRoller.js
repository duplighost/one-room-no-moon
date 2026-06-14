// THE generator. Deals one card per axis from no-repeat bags, cross-checks the
// axes, builds the room object, and bakes its background once. Consumes only
// data/ + rng (architecture.md §4 rule 2).
import { ROOM, TAU } from '../config.js';
import { Bag, clamp, dist, rand, randi, chance, pick } from '../rng.js';
import { BIOMES, BIOMES_BY_TIER, tierForRound } from '../data/biomes.js';
import { LAYOUTS, LAYOUT_IDS } from '../data/layouts.js';
import { paintPattern } from '../data/patterns.js';
import { SPECIES } from './breakables.js';
import { seedHazards } from './hazards.js';
import { buildWaves, availableRecipes, dangerStage, depthIdx, RECIPES } from './director.js';
import { view } from '../render/camera.js';
import { ANNEX } from '../config.js';
import { rollEvent } from './events.js';
import { stacks } from './items.js';
import { bossForRound } from './bosses.js';
import { MUTATORS } from '../data/mutators.js';
import { FLOORPLANS, FLOORPLAN_IDS } from '../data/floorplans.js';

export function rollRoom(run, round) {
  const rng = run.rng;
  const bags = run.bags;

  // ── axis 1: biome (tier-banded bag) ──
  const tier = tierForRound(round, run.overdrive);
  const tierKey = 'biome_' + tier;
  if (!bags[tierKey]) {
    const ids = tier === 'any' ? BIOMES.map(b => b.id) : BIOMES_BY_TIER[tier].map(b => b.id);
    bags[tierKey] = new Bag(ids, tier === 'any' ? 2 : 1);
  }
  const dealtBiomeId = bags[tierKey].deal(rng);
  const biome = BIOMES.find(b => b.id === dealtBiomeId);

  // ── axis 2+4: layout & recipe (recipe first: density cross-check) ──
  if (!bags.layout) bags.layout = new Bag(LAYOUT_IDS, 2);
  if (!bags.recipe) bags.recipe = new Bag(Object.keys(RECIPES), 1);
  const avail = availableRecipes(round);
  let recipeId = 'mixed';
  for (let i = 0; i < 8; i++) {
    const r = bags.recipe.deal(rng);
    if (avail.includes(r)) { recipeId = r; break; }
  }
  const bossId = bossForRound(round, run.overdrive);
  const layoutId = bossId ? pick(rng, ['ring', 'crossroads']) : bags.layout.deal(rng);

  // ── axis 6: mutator (rare, loud) ──
  const mutator = (!bossId && round >= 5 && chance(rng, 0.10))
    ? MUTATORS[Math.floor(rng() * MUTATORS.length)] : null;
  const sizeScale = mutator?.sizeScale || 1;

  const portrait = view.mobile && view.portrait;
  const room = {
    round, idx: depthIdx(round), stage: dangerStage(round, run.overdrive),
    biome, layoutId, recipeId, mutatorId: mutator?.id || null, mutator, eventId: null, bossId,
    floorplanId: 'none', openings: [], sanctum: null, tiers: [],
    w: Math.round(rand(rng, bossId ? 1980 : 1900, bossId ? 2260 : 2160) * sizeScale),
    h: Math.round((portrait ? rand(rng, 1760, 1900) : rand(rng, bossId ? 1440 : 1360, bossId ? 1600 : 1540)) * sizeScale),
    wall: ROOM.WALL,
    obstacles: [], annex: null, hazards: [], lanes: [],
    enemies: [], bullets: [], pickups: [], particles: [], floats: [],
    ambient: [], spawnQueue: [], pendingWaves: null,
    cleared: false, clearT: 0, portal: null, time: 0,
    background: null,
  };
  const px = room.w / 2, py = room.h * 0.66; // player spawn
  const portalX = room.w / 2, portalY = room.h * 0.20;

  // ── floorplan (Phase 8a): partition walls before the cover scatter ──
  if (!bags.floorplan) bags.floorplan = new Bag(FLOORPLAN_IDS, 2);
  let floorplanId = bossId ? 'none' : bags.floorplan.deal(rng);
  if (floorplanId !== 'none') {
    const plan = FLOORPLANS[floorplanId](room, rng, room.idx);
    const trial = plan.walls;
    // place, then validate: spawn must be clear of walls and the portal reachable
    const spawnInWall = trial.some(o => px > o.x - 24 && px < o.x + o.w + 24 && py > o.y - 24 && py < o.y + o.h + 24);
    room.obstacles.push(...trial);
    const reach = reachableFrom(room, px, py);
    if (spawnInWall || !reach.has(portalX, portalY)) {
      room.obstacles.length = 0;   // fall back to an open room rather than risk a softlock
      floorplanId = 'none';
    } else {
      room.openings = plan.openings;
      room.sanctum = plan.sanctum || null;
    }
  }
  room.floorplanId = floorplanId;
  const partitioned = floorplanId !== 'none';

  // ── axis 2 continued: obstacles from the layout generator ──
  const density = (RECIPES[recipeId]?.density || 0);
  // a big structural set-piece anchors the room (monument / pillar court / ruin /
  // crater). Placed BEFORE the scatter so cover arranges around it. Allowed in
  // partitioned rooms too (it fills a chamber; fits() arbitrates against the walls),
  // just rarer there since the partitions already give those rooms their bones.
  const landmark = !bossId && chance(rng, partitioned ? 0.3 : 0.72) && placeLandmark(room, rng, px, py, portalX, portalY);
  // scale cover with the (~1.9x) floor so big rooms aren't bare; the landmark/rubble
  // passes add the real structure on top of this baseline scatter.
  const areaK = clamp((room.w * room.h) / 1.55e6, 1, 1.95);
  const count = clamp(Math.round((5 + density) * areaK) + Math.floor(room.stage * 0.5) + randi(rng, 0, 2)
    - (partitioned ? 3 : 0) - (landmark ? 2 : 0), partitioned ? 2 : 5, 16);
  const spots = LAYOUTS[layoutId](room, rng, count);
  for (const s of spots) {
    if (dist(s.x, s.y, px, py) < ROOM.SPAWN_CLEAR) continue;
    let o;
    if (s.rect) {
      const w = s.wide ? rand(rng, 150, 260) : s.tall ? rand(rng, 70, 110) : rand(rng, 105, 205);
      const h = s.tall ? rand(rng, 150, 260) : s.wide ? rand(rng, 64, 104) : rand(rng, 72, 128);
      o = { type: 'rect', x: s.x - w / 2, y: s.y - h / 2, w, h, style: biome.obstacleStyle, round: 16 };
    } else {
      o = { type: 'circle', x: s.x, y: s.y, rad: s.big ? rand(rng, 60, 92) : rand(rng, 40, 72), style: biome.obstacleStyle };
    }
    if (!fits(room, o)) continue;
    room.obstacles.push(o);
  }
  // placement hygiene can reject spots; guarantee a minimum of cover
  for (let tries = 0; room.obstacles.length < 4 && tries < 30; tries++) {
    const o = {
      type: 'circle', x: rand(rng, room.wall + 150, room.w - room.wall - 150),
      y: rand(rng, room.wall + 140, room.h - room.wall - 170),
      rad: rand(rng, 42, 66), style: biome.obstacleStyle,
    };
    if (dist(o.x, o.y, px, py) < ROOM.SPAWN_CLEAR || !fits(room, o)) continue;
    room.obstacles.push(o);
  }
  // a destructible rubble barricade — smashable cover you carve through (and chargers
  // plow through, see enemies.js). Pure line-of-fire cover until broken.
  if (!bossId && chance(rng, 0.5)) rubbleField(room, rng, px, py);

  // ── elevation (Phase 8b): a raised platform as a walled enclosure + ramp ──
  // Skip when partitioned or a boss arena (keep those legible). The platform is
  // high ground: snipers/turrets seeded on it (director, 8d) can only be engaged
  // by climbing the ramp.
  if (!bossId && !partitioned && chance(rng, 0.34)) maybeTier(room, rng, px, py, portalX, portalY);

  // ── axis 3 prep: volatile shards in glass biomes (chain toys) ──
  if (biome.hazard === 'volatile' || (biome.hazard === 'shard' && chance(rng, 0.6))) {
    const n = randi(rng, 2, 3);
    for (let i = 0; i < n; i++) {
      const o = {
        type: 'circle', x: rand(rng, room.wall + 130, room.w - room.wall - 130),
        y: rand(rng, room.wall + 120, room.h - room.wall - 150),
        rad: rand(rng, 18, 26), style: 'glassNode',
        breakable: true, species: 'volatileShard', hp: SPECIES.volatileShard.hp, volatile: true,
      };
      if (dist(o.x, o.y, px, py) < 220 || !fits(room, o)) continue;
      room.obstacles.push(o);
    }
  }

  // ── breakable conversion (species weights with biome bumps) ──
  const breakN = randi(rng, 2, 4) + (mutator?.breakBonus || 0) + (run.oath === 'hunger' ? 1 : 0);
  const candidates = room.obstacles.filter(o => !o.breakable && !o.landmark && o.type === 'circle' && o.rad < 60);
  for (let i = 0; i < breakN && candidates.length; i++) {
    const o = candidates.splice(Math.floor(rng() * candidates.length), 1)[0];
    o.breakable = true;
    o.species = rollSpecies(rng, biome, room.idx, mutator?.idolBump || run.oath === 'hunger');
    o.hp = SPECIES[o.species].hp + room.idx * 0.8;
  }

  // ── sealed annex (skip when a floorplan already partitions the room) ──
  const compass = stacks(run.player, 'cacheCompass');
  const annexChance = ANNEX.CHANCE + compass * 0.12 + (run.oath === 'blind' ? 0.15 : 0);
  if (!bossId && !partitioned && chance(rng, annexChance)) buildAnnex(room, rng);

  // ── axis 3: hazard kit ──
  seedHazards(room, rng);
  if (mutator?.extraLane) {
    const pos = rand(rng, room.wall + 220, room.w - room.wall - 220);
    room.lanes.push({
      type: 'sightline', vertical: true, x1: pos, y1: room.wall + 40, x2: pos, y2: room.h - room.wall - 40,
      width: 26, t: rng() * 2, period: 3.2, telegraphFrom: 0.40, activeFrom: 0.74, activeTo: 0.98,
      active: false, tele: false, hitCd: 0, color: biome.pal.accent2,
    });
  }

  // ── ambient particles ──
  const ambN = view.mobile ? 24 : 40;
  for (let i = 0; i < ambN; i++) {
    room.ambient.push({
      type: pick(rng, biome.ambient), x: rng() * room.w, y: rng() * room.h,
      vx: rand(rng, -12, 12), vy: rand(rng, -18, 8), phase: rng() * TAU, r: rand(rng, 1.5, 4),
    });
  }

  // ── axis 4: waves ──
  buildWaves(room, rng);

  // ── axis 5: room event (the spice slot) ──
  rollEvent(room, rng);

  // ── bake the background once ──
  room.background = bakeBackground(room, rng);
  return room;
}

function aabb(o) {
  return o.type === 'circle'
    ? { x: o.x - o.rad, y: o.y - o.rad, w: o.rad * 2, h: o.rad * 2 }
    : { x: o.x, y: o.y, w: o.w, h: o.h };
}

// AABB overlap with a margin (correct for long walls; the old center-distance
// test rejected most of the room around a partition wall).
function fits(room, o, margin = 20) {
  const w = room.wall, b = aabb(o);
  if (b.x < w + 10 || b.y < w + 10 || b.x + b.w > room.w - w - 10 || b.y + b.h > room.h - w - 10) return false;
  for (const other of room.obstacles) {
    const a = aabb(other);
    if (b.x < a.x + a.w + margin && b.x + b.w + margin > a.x &&
        b.y < a.y + a.h + margin && b.y + b.h + margin > a.y) return false;
  }
  return true;
}

// Coarse-grid flood-fill from the player spawn. Breakable walls count as passable
// (the player can smash them). Used to guarantee no unclearable/softlocked rooms.
const CELL = 44;
export function reachableFrom(room, sx, sy) {
  const cols = Math.ceil(room.w / CELL), rows = Math.ceil(room.h / CELL);
  const solids = room.obstacles.filter(o => o.wall && !o.breakable);
  const inset = room.wall + 8;
  const blocked = (cx, cy) => {
    if (cx < inset || cy < inset || cx > room.w - inset || cy > room.h - inset) return true;
    for (const o of solids) {
      if (cx > o.x - 16 && cx < o.x + o.w + 16 && cy > o.y - 16 && cy < o.y + o.h + 16) return true;
    }
    return false;
  };
  const key = (c, r) => c + ',' + r;
  const seen = new Set();
  const start = [Math.floor(sx / CELL), Math.floor(sy / CELL)];
  const stack = [start];
  seen.add(key(...start));
  while (stack.length) {
    const [c, r] = stack.pop();
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc, nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows || seen.has(key(nc, nr))) continue;
      if (blocked(nc * CELL + CELL / 2, nr * CELL + CELL / 2)) continue;
      seen.add(key(nc, nr));
      stack.push([nc, nr]);
    }
  }
  return { has: (x, y) => seen.has(key(Math.floor(x / CELL), Math.floor(y / CELL))), cells: seen };
}

// Place one raised platform: a rect tier whose perimeter is ledge walls, with a
// ramp gap on the edge facing the player. Ledges block movement always and block
// low bullets (high-ground); the ramp lets you walk up. Validated for spawn
// clearance + portal reachability; bails cleanly if it can't fit.
function maybeTier(room, rng, px, py, portalX, portalY) {
  const T = 26;
  const tw = room.w * rand(rng, 0.24, 0.34);
  const th = room.h * rand(rng, 0.22, 0.30);
  for (let tries = 0; tries < 14; tries++) {
    const tx = rand(rng, room.wall + 80, room.w - room.wall - 80 - tw);
    const ty = rand(rng, room.wall + 80, room.h * 0.55 - th); // upper area, clear of spawn
    const rect = { x: tx, y: ty, w: tw, h: th };
    // keep clear of spawn and portal points
    const pad = 90;
    const hit = (qx, qy) => qx > tx - pad && qx < tx + tw + pad && qy > ty - pad && qy < ty + th + pad;
    if (hit(px, py) || hit(portalX, portalY)) continue;
    // ramp on the bottom edge (faces the player below); gap centred-ish
    const gap = rand(rng, 150, 200);
    const rgx = tx + tw * rand(rng, 0.4, 0.6);
    const ledges = [
      wallSlab(tx - T / 2, ty - T / 2, tw + T, T),                                   // top
      wallSlab(tx - T / 2, ty + th - T / 2, (rgx - gap / 2) - (tx - T / 2), T),       // bottom-left
      wallSlab(rgx + gap / 2, ty + th - T / 2, (tx + tw + T / 2) - (rgx + gap / 2), T), // bottom-right
      wallSlab(tx - T / 2, ty - T / 2, T, th + T),                                   // left
      wallSlab(tx + tw - T / 2, ty - T / 2, T, th + T),                              // right
    ];
    const before = room.obstacles.length;
    room.obstacles.push(...ledges);
    // portal AND the platform interior must be reachable (else a perched sniper
    // would be unkillable and stall the room).
    const reach = reachableFrom(room, px, py);
    if (!reach.has(portalX, portalY) || !reach.has(tx + tw / 2, ty + th / 2)) {
      room.obstacles.length = before; // undo, try again
      continue;
    }
    room.tiers.push({ x: tx, y: ty, w: tw, h: th, height: 1, ramp: { x: rgx, y: ty + th, w: gap } });
    return;
  }
}
function wallSlab(x, y, w, h) {
  return { type: 'rect', x, y, w: Math.max(8, w), h: Math.max(8, h), wall: true, ledge: true, ledgeHeight: 1, style: 'ledge', round: 3 };
}

// A large structural set-piece — the thing that makes a big room feel designed
// instead of a field. Pieces are ordinary cover (block bullets + movement, tagged
// `landmark` so the breakable pass leaves them solid); discrete and gapped so they
// never wall the player in. The centroid is searched in regions OFF the spawn↔portal
// corridor (upper-centre or a side third) so it composes with walls and clears the
// traversal lane. Returns true if it seated ≥2 pieces.
function placeLandmark(room, rng, px, py, portalX, portalY) {
  const style = room.biome.obstacleStyle;
  const clearOf = (x, y, r) =>
    dist(x, y, px, py) > 200 + r * 0.4 && dist(x, y, portalX, portalY) > 130 + r;
  const tryPush = (o) => {
    const ax = o.type === 'circle' ? o.x : o.x + o.w / 2;
    const ay = o.type === 'circle' ? o.y : o.y + o.h / 2;
    const ar = o.type === 'circle' ? o.rad : Math.max(o.w, o.h) / 2;
    if (!clearOf(ax, ay, ar) || !fits(room, o)) return false;
    o.landmark = true; room.obstacles.push(o); return true;
  };
  // find a centroid with breathing room: try a few candidates across the eligible band
  let cx = room.w / 2, cy = room.h * 0.44;
  for (let t = 0; t < 8; t++) {
    const region = rng();
    cx = region < 0.4 ? room.w * rand(rng, 0.40, 0.60)                       // centre column
      : region < 0.7 ? room.w * rand(rng, 0.18, 0.34)                        // left third
      : room.w * rand(rng, 0.66, 0.82);                                      // right third
    cy = room.h * rand(rng, 0.34, 0.56);
    if (clearOf(cx, cy, 80)) break;
  }
  const kind = pick(rng, ['monument', 'pillars', 'ruin', 'crater']);
  let placed = 0;
  if (kind === 'monument') {
    placed += tryPush({ type: 'circle', x: cx, y: cy, rad: rand(rng, 80, 110), style }) ? 1 : 0;
    const sat = randi(rng, 3, 5), rr = rand(rng, 150, 210), a0 = rng() * TAU;
    for (let i = 0; i < sat; i++) {
      const a = a0 + (i / sat) * TAU + rand(rng, -0.3, 0.3);
      placed += tryPush({ type: 'circle', x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr, rad: rand(rng, 34, 54), style }) ? 1 : 0;
    }
  } else if (kind === 'pillars') {
    const n = randi(rng, 4, 6), rr = Math.min(room.w, room.h) * rand(rng, 0.15, 0.21), a0 = rng() * TAU;
    for (let i = 0; i < n; i++) {
      const a = a0 + (i / n) * TAU;
      placed += tryPush({ type: 'circle', x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr * 0.82, rad: rand(rng, 46, 68), style }) ? 1 : 0;
    }
    if (rng() < 0.5) placed += tryPush({ type: 'circle', x: cx, y: cy, rad: rand(rng, 40, 56), style }) ? 1 : 0;
  } else if (kind === 'ruin') {
    // staggered broken-wall slabs with gaps to weave through
    const n = randi(rng, 3, 4);
    for (let i = 0; i < n; i++) {
      const horiz = rng() < 0.5;
      const sw = horiz ? rand(rng, 230, 360) : rand(rng, 66, 108);
      const sh = horiz ? rand(rng, 66, 108) : rand(rng, 200, 330);
      placed += tryPush({ type: 'rect', x: cx + rand(rng, -250, 250) - sw / 2, y: cy + rand(rng, -170, 170) - sh / 2, w: sw, h: sh, style, round: 14 }) ? 1 : 0;
    }
  } else { // crater — a ring of medium stones around an open eye
    const n = randi(rng, 7, 10), rr = Math.min(room.w, room.h) * rand(rng, 0.17, 0.23), a0 = rng() * TAU;
    for (let i = 0; i < n; i++) {
      const a = a0 + (i / n) * TAU;
      placed += tryPush({ type: 'circle', x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr * 0.78, rad: rand(rng, 30, 48), style }) ? 1 : 0;
    }
  }
  return placed >= 2;
}

// A tight cluster of smashable blocks — a destructible barricade. Retries the centre
// so it actually seats (partition walls / cover steal a lot of spots); small `fits`
// margin so it packs into a real wall of debris you carve a hole through.
function rubbleField(room, rng, px, py) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const cx = rand(rng, room.wall + 240, room.w - room.wall - 240);
    const cy = rand(rng, room.wall + 200, room.h - room.wall - 220);
    if (dist(cx, cy, px, py) < ROOM.SPAWN_CLEAR + 40) continue;
    const n = randi(rng, 5, 9);
    let placed = 0;
    for (let i = 0; i < n; i++) {
      const a = rng() * TAU, rr = rand(rng, 0, 140);
      const o = {
        type: 'circle', x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr,
        rad: rand(rng, 20, 32), style: room.biome.obstacleStyle,
        breakable: true, species: 'rubble', hp: SPECIES.rubble.hp + room.idx * 0.5,
      };
      if (dist(o.x, o.y, px, py) < ROOM.SPAWN_CLEAR || !fits(room, o, 6)) continue;
      room.obstacles.push(o); placed++;
    }
    if (placed >= 3) return; // a real barricade seated; otherwise try another centre
  }
}

function rollSpecies(rng, biome, idx, idolBump = false) {
  const w = { marrowJar: 18, bellHusk: 12, blackGlass: 12, rootCyst: 10, moonseedUrn: 7, falseIdol: 3 };
  if (idolBump) { w.falseIdol += 8; w.moonseedUrn += 6; }
  if (['mirror', 'shardreef', 'frostreliquary'].includes(biome.id)) w.blackGlass += 18;
  if (['verdigris', 'fen', 'mycelium', 'coilroot', 'rosewire', 'blacksungarden'].includes(biome.id)) { w.rootCyst += 14; w.marrowJar += 8; }
  if (['basilica', 'ossuary', 'empyrean', 'nullthrone', 'auricspire'].includes(biome.id)) { w.falseIdol += 7; w.bellHusk += 10; }
  if (idx >= 5) w.falseIdol += 3;
  const pool = Object.entries(w).map(([item, wt]) => ({ item, w: wt }));
  let total = 0; for (const p of pool) total += p.w;
  let roll = rng() * total;
  for (const p of pool) { roll -= p.w; if (roll <= 0) return p.item; }
  return 'marrowJar';
}

function buildAnnex(room, rng) {
  const side = pick(rng, ['n', 'e', 'w']); // not south: player spawns low
  const w = room.wall;
  // sized up for the bigger arena — an old 180×120 annex read as a closet bolted to
  // a cathedral. Now a real side-chamber you commit to entering.
  const span = rand(rng, 250, 340), depth = rand(rng, 155, 220);
  let rect, doorRect, cx, cy;
  if (side === 'n') {
    const x = rand(rng, w + 160, room.w - w - 160 - span);
    rect = { x, y: w, w: span, h: depth };
    doorRect = { x: x + span * 0.3, y: w + depth - 16, w: span * 0.4, h: 18 };
    cx = x + span / 2; cy = w + depth * 0.45;
  } else if (side === 'e') {
    const y = rand(rng, w + 140, room.h - w - 140 - span);
    rect = { x: room.w - w - depth, y, w: depth, h: span };
    doorRect = { x: room.w - w - depth - 2, y: y + span * 0.3, w: 18, h: span * 0.4 };
    cx = room.w - w - depth * 0.45; cy = y + span / 2;
  } else {
    const y = rand(rng, w + 140, room.h - w - 140 - span);
    rect = { x: w, y, w: depth, h: span };
    doorRect = { x: w + depth - 16, y: y + span * 0.3, w: 18, h: span * 0.4 };
    cx = w + depth * 0.45; cy = y + span / 2;
  }
  const ambush = chance(rng, ANNEX.AMBUSH);
  room.annex = {
    side, rect, opened: false, cx, cy,
    kind: ambush ? 'ambush' : 'secret',
    ambushType: pick(rng, ['skitter', 'skitter', 'gunner']),
    ambushCount: randi(rng, 2, 3),
    reward: pick(rng, ['heart', 'repair', 'marrow']),
  };
  // flank walls (solid) + the breakable door
  const t = 14;
  if (side === 'n') {
    room.obstacles.push(
      { type: 'rect', x: rect.x - t, y: rect.y, w: t, h: rect.h, style: 'boundary', solidWall: true },
      { type: 'rect', x: rect.x + rect.w, y: rect.y, w: t, h: rect.h, style: 'boundary', solidWall: true },
      { type: 'rect', x: rect.x, y: rect.y + rect.h - 2, w: doorRect.x - rect.x, h: t, style: 'boundary', solidWall: true },
      { type: 'rect', x: doorRect.x + doorRect.w, y: rect.y + rect.h - 2, w: rect.x + rect.w - doorRect.x - doorRect.w, h: t, style: 'boundary', solidWall: true },
    );
  } else if (side === 'e') {
    room.obstacles.push(
      { type: 'rect', x: rect.x, y: rect.y - t, w: rect.w, h: t, style: 'boundary', solidWall: true },
      { type: 'rect', x: rect.x, y: rect.y + rect.h, w: rect.w, h: t, style: 'boundary', solidWall: true },
      { type: 'rect', x: rect.x - 2, y: rect.y, w: t, h: doorRect.y - rect.y, style: 'boundary', solidWall: true },
      { type: 'rect', x: rect.x - 2, y: doorRect.y + doorRect.h, w: t, h: rect.y + rect.h - doorRect.y - doorRect.h, style: 'boundary', solidWall: true },
    );
  } else {
    room.obstacles.push(
      { type: 'rect', x: rect.x, y: rect.y - t, w: rect.w, h: t, style: 'boundary', solidWall: true },
      { type: 'rect', x: rect.x, y: rect.y + rect.h, w: rect.w, h: t, style: 'boundary', solidWall: true },
      { type: 'rect', x: rect.x + rect.w - t + 2, y: rect.y, w: t, h: doorRect.y - rect.y, style: 'boundary', solidWall: true },
      { type: 'rect', x: rect.x + rect.w - t + 2, y: doorRect.y + doorRect.h, w: t, h: rect.y + rect.h - doorRect.y - doorRect.h, style: 'boundary', solidWall: true },
    );
  }
  room.obstacles.push({
    type: 'rect', ...doorRect, style: 'door',
    breakable: true, species: 'annexDoor', hp: SPECIES.annexDoor.hp + room.idx,
  });
}

function bakeBackground(room, rng) {
  if (typeof document === 'undefined') return null; // headless tests
  const c = document.createElement('canvas');
  c.width = room.w; c.height = room.h;
  const ctx = c.getContext('2d');
  const pal = room.biome.pal;
  const g = ctx.createLinearGradient(0, 0, 0, room.h);
  g.addColorStop(0, pal.bg);
  g.addColorStop(1, pal.floor);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, room.w, room.h);

  // 2 feature patterns + 1 extra, dealt without in-room repeats
  const deck = [...room.biome.features];
  const picks = [];
  for (let i = 0; i < 2 && deck.length; i++) picks.push(deck.splice(Math.floor(rng() * deck.length), 1)[0]);
  picks.push(pick(rng, room.biome.extras));
  for (const name of picks) paintPattern(name, ctx, room.w, room.h, rng, pal);

  // big baked FLOOR IDENTITY — the bigger floor needs landmarks, not more confetti:
  // a centre medallion / sweeping bands / a fracture, plus corner framing. Subtle
  // (low alpha) so entities still read, but large enough to anchor the eye.
  paintFloorIdentity(ctx, room, rng, pal);

  // annex floor tint
  if (room.annex) {
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = pal.bg;
    ctx.fillRect(room.annex.rect.x, room.annex.rect.y, room.annex.rect.w, room.annex.rect.h);
    ctx.globalAlpha = 1;
  }

  // baked edge darkening
  const v = ctx.createRadialGradient(room.w / 2, room.h / 2, Math.min(room.w, room.h) * 0.3, room.w / 2, room.h / 2, Math.max(room.w, room.h) * 0.72);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.42)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, room.w, room.h);
  return c;
}

// Large baked floor anchors. Always frames the corners (architectural read); then
// rolls ONE centrepiece so rooms don't all wear the same medallion. Palette-keyed,
// deterministic from rng, low alpha. Pure decoration — no collision.
function paintFloorIdentity(ctx, room, rng, pal) {
  const { w, h } = room, wall = room.wall;
  const cx = w / 2, cy = h * 0.46;
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';

  // corner framing brackets — quiet, consistent "this is a built room"
  ctx.globalAlpha = 0.11; ctx.strokeStyle = pal.accent3; ctx.lineWidth = 4;
  const m = wall + 36, L = 70 + rng() * 46;
  for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const x = sx > 0 ? m : w - m, y = sy > 0 ? m : h - m;
    ctx.beginPath(); ctx.moveTo(x + sx * L, y); ctx.lineTo(x, y); ctx.lineTo(x, y + sy * L); ctx.stroke();
  }

  const style = Math.floor(rng() * 4);
  if (style === 0) {
    // centre medallion — concentric rings + radial spokes + tick glyphs
    const R = Math.min(w, h) * (0.17 + rng() * 0.05);
    ctx.globalAlpha = 0.10; ctx.strokeStyle = pal.accent3; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.62, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 0.07; ctx.lineWidth = 2;
    const spokes = 8 + Math.floor(rng() * 6);
    for (let i = 0; i < spokes; i++) {
      const a = (i / spokes) * TAU + rng() * 0.04;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * R * 0.62, cy + Math.sin(a) * R * 0.62);
      ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.06; ctx.fillStyle = pal.accent;
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.2, 0, TAU); ctx.fill();
  } else if (style === 1) {
    // broad sweeping bands — a runner / sigil lane crossing the floor
    const vertical = rng() < 0.5;
    const bands = 1 + (rng() < 0.45 ? 1 : 0);
    for (let b = 0; b < bands; b++) {
      const span = (vertical ? w : h);
      const bw = span * (0.09 + rng() * 0.06);
      const pos = span * (0.30 + rng() * 0.40);
      ctx.globalAlpha = 0.05; ctx.fillStyle = pal.accent;
      if (vertical) ctx.fillRect(pos - bw / 2, wall, bw, h - wall * 2);
      else ctx.fillRect(wall, pos - bw / 2, w - wall * 2, bw);
      ctx.globalAlpha = 0.10; ctx.strokeStyle = pal.accent3; ctx.lineWidth = 2.5;
      if (vertical) { line(ctx, pos - bw / 2, wall, pos - bw / 2, h - wall); line(ctx, pos + bw / 2, wall, pos + bw / 2, h - wall); }
      else { line(ctx, wall, pos - bw / 2, w - wall, pos - bw / 2); line(ctx, wall, pos + bw / 2, w - wall, pos + bw / 2); }
    }
  } else if (style === 2) {
    // a big fracture splitting the floor — one bold jagged seam (ChatGPT: bigger cracks)
    ctx.globalAlpha = 0.13; ctx.strokeStyle = pal.accent3; ctx.lineWidth = 3.5;
    const horiz = rng() < 0.5;
    let x = horiz ? wall : rand(rng, w * 0.3, w * 0.7);
    let y = horiz ? rand(rng, h * 0.3, h * 0.7) : wall;
    ctx.beginPath(); ctx.moveTo(x, y);
    const steps = 9 + Math.floor(rng() * 5);
    for (let i = 0; i < steps; i++) {
      if (horiz) { x += (w - wall * 2) / steps; y += rand(rng, -60, 60); }
      else { y += (h - wall * 2) / steps; x += rand(rng, -60, 60); }
      ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.globalAlpha = 0.06; ctx.lineWidth = 9; ctx.stroke(); // soft glow under the seam
  } else {
    // plaza — nested square frames around the centre (a stepped dais read)
    ctx.globalAlpha = 0.09; ctx.strokeStyle = pal.accent3;
    const base = Math.min(w, h) * (0.30 + rng() * 0.08);
    for (let k = 0; k < 3; k++) {
      const s = base * (1 - k * 0.26); ctx.lineWidth = 3 - k * 0.4;
      ctx.strokeRect(cx - s / 2, cy - s / 2, s, s);
    }
  }
  ctx.restore();
}
function line(ctx, x1, y1, x2, y2) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
