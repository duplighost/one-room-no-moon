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
  // Big rooms need occasional rule-spice, but pure 10% RNG can ghost the run for
  // ages. Add a quiet pity counter so the system stays rare without becoming
  // invisible in unlucky seeds.
  let mutator = null;
  if (!bossId && round >= 5) {
    run.sinceMutator = run.sinceMutator ?? 0;
    // pity 12 (not 8): keeps the effective mutator rate ~10.6% — rare but never
    // ghosting a run. Deliberately tuned last session; kept over the base's 8.
    const forceMutator = run.sinceMutator >= 12;
    if (forceMutator || chance(rng, 0.10)) {
      mutator = MUTATORS[Math.floor(rng() * MUTATORS.length)];
      run.sinceMutator = 0;
    } else run.sinceMutator++;
  }
  const sizeScale = mutator?.sizeScale || 1;

  const portrait = view.mobile && view.portrait;
  const room = {
    round, idx: depthIdx(round), stage: dangerStage(round, run.overdrive),
    biome, layoutId, recipeId, mutatorId: mutator?.id || null, mutator, eventId: null, bossId,
    floorplanId: 'none', openings: [], sanctum: null, tiers: [],
    w: Math.round(rand(rng, bossId ? 1980 : 1900, bossId ? 2260 : 2160) * sizeScale),
    h: Math.round((portrait ? rand(rng, 1760, 1900) : rand(rng, bossId ? 1440 : 1360, bossId ? 1600 : 1540)) * sizeScale),
    wall: ROOM.WALL,
    obstacles: [], landmarks: [], annex: null, hazards: [], lanes: [],
    enemies: [], bullets: [], pickups: [], particles: [], floats: [],
    ambient: [], spawnQueue: [], pendingWaves: null, spawnAnchors: [],
    cleared: false, clearT: 0, portal: null, time: 0,
    background: null,
  };
  const px = room.w / 2, py = room.h * 0.66; // player spawn
  const portalX = room.w / 2, portalY = room.h * 0.20;

  // ── floorplan (Phase 8a): partition walls before the cover scatter ──
  if (!bags.floorplan) bags.floorplan = new Bag(FLOORPLAN_IDS, 2);
  // Weighted open-room roll happens outside the Bag. Duplicate 'none' cards get
  // suppressed by Bag recent-history, so this is the honest way to reduce over-partitioning.
  const openChance = 0.42;
  let floorplanId = (bossId || chance(rng, openChance)) ? 'none' : bags.floorplan.deal(rng);
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
  // Big rooms need a visual/combat anchor before scatter, so cover arranges around
  // a designed thing instead of confetti. Validated later with the same reachability audit.
  const landmark = !bossId && chance(rng, partitioned ? 0.30 : 0.84) && placeLandmark(room, rng, px, py, portalX, portalY);
  const areaBonus = Math.max(1, Math.round((Math.sqrt(roomAreaScale(room)) - 1) * 5));
  const count = clamp(6 + density + areaBonus + Math.floor(room.stage * 0.45) + randi(rng, 0, 2)
    - (partitioned ? 2 : 0) - (landmark ? 2 : 0), partitioned ? 3 : 5, partitioned ? 14 : 16);
  const spots = LAYOUTS[layoutId](room, rng, count);
  for (const s of spots) {
    if (dist(s.x, s.y, px, py) < ROOM.SPAWN_CLEAR) continue;
    let o;
    if (s.rect) {
      const w = s.wide ? rand(rng, 155, 260) : s.tall ? rand(rng, 72, 112) : rand(rng, 105, 210);
      const h = s.tall ? rand(rng, 155, 260) : s.wide ? rand(rng, 66, 108) : rand(rng, 72, 132);
      o = { type: 'rect', x: s.x - w / 2, y: s.y - h / 2, w, h, style: biome.obstacleStyle, round: 16 };
    } else {
      o = { type: 'circle', x: s.x, y: s.y, rad: s.big ? rand(rng, 66, 96) : rand(rng, 40, 70), style: biome.obstacleStyle };
    }
    if (!fits(room, o)) continue;
    room.obstacles.push(o);
  }
  // placement hygiene can reject spots; guarantee a minimum of cover
  for (let tries = 0; room.obstacles.length < (partitioned ? 5 : 7) && tries < 50; tries++) {
    const o = {
      type: 'circle', x: rand(rng, room.wall + 150, room.w - room.wall - 150),
      y: rand(rng, room.wall + 140, room.h - room.wall - 170),
      rad: rand(rng, 42, 66), style: biome.obstacleStyle,
    };
    if (dist(o.x, o.y, px, py) < ROOM.SPAWN_CLEAR || !fits(room, o)) continue;
    room.obstacles.push(o);
  }

  // Big-room architecture: short ribs, cracked barricades, landmarks, dash bells, and soft rubble.
  // These are validated for portal reachability, so they add traversal decisions without softlocks.
  addRoomStructures(room, rng, px, py, portalX, portalY, partitioned, !!landmark);
  const forceRubble = !bossId && !partitioned && !landmark;
  if (!bossId && (forceRubble || chance(rng, partitioned ? 0.36 : 0.48))) rubbleField(room, rng, px, py, portalX, portalY);

  // ── elevation (Phase 8b): a raised platform as a walled enclosure + ramp ──
  // Skip when partitioned or a boss arena (keep those legible). The platform is
  // high ground: snipers/turrets seeded on it (director, 8d) can only be engaged
  // by climbing the ramp.
  if (!bossId && !partitioned && chance(rng, 0.34)) maybeTier(room, rng, px, py, portalX, portalY);

  // ── glass biomes furnish breakable chain-glass (the shard/volatile projectile
  // hazard is retired; this cover IS their identity now — shoot or dash one and the
  // blast chains to its neighbours). Breakable circles never block reachability. ──
  if (biome.hazard === 'volatile' || biome.hazard === 'shard') {
    const n = randi(rng, 3, 5);
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

  // ── biomes that lost their area hazard furnish breakable biome-styled cover in
  // its place, so they stay as furnished as the altar/laser biomes. Covers the
  // snare/thorn projectile-roots AND the removed fog/spore gas clouds (fen/mycelium)
  // — not the gas mechanic, just native furniture. rollSpecies already biases these
  // plant/fungal/bone biomes toward rootCyst/marrowJar, so the cover reads native. ──
  const COVER_FROM_HAZARD = new Set(['snare', 'thorn', 'fog', 'spore']);
  if (!bossId && COVER_FROM_HAZARD.has(biome.hazard)) {
    const n = randi(rng, 2, 4) + (room.idx >= 4 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      for (let tries = 0; tries < 18; tries++) {
        const species = rollSpecies(rng, biome, room.idx, false);
        const o = {
          type: 'circle', x: rand(rng, room.wall + 130, room.w - room.wall - 130),
          y: rand(rng, room.wall + 120, room.h - room.wall - 150),
          rad: rand(rng, 34, 56), style: biome.obstacleStyle,
          breakable: true, species, hp: SPECIES[species].hp + room.idx * 0.6,
        };
        if (dist(o.x, o.y, px, py) < ROOM.SPAWN_CLEAR || dist(o.x, o.y, portalX, portalY) < 150 || !fits(room, o)) continue;
        room.obstacles.push(o);
        break;
      }
    }
  }

  // ── breakable conversion (species weights with biome bumps) ──
  const breakN = randi(rng, 1, 3) + (mutator?.breakBonus || 0) + (run.oath === 'hunger' ? 1 : 0);
  const candidates = room.obstacles.filter(o => !o.breakable && !o.landmark && o.type === 'circle' && o.rad < 72);
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
  const ambN = Math.round((view.mobile ? 24 : 40) * Math.min(1.55, Math.sqrt(roomAreaScale(room))));
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
  sanitizePendingSpawns(room, rng, px, py, portalX, portalY);

  // ── bake the background once ──
  room.background = bakeBackground(room, rng);
  return room;
}

const OLD_ROOM_AREA = 1500 * 1020;
function roomAreaScale(room) { return (room.w * room.h) / OLD_ROOM_AREA; }

function architecturalWall(x, y, w, h, breakable, idx) {
  const o = { type: 'rect', x, y, w: Math.max(12, w), h: Math.max(12, h), wall: true, ledgeHeight: Infinity, style: breakable ? 'door' : 'wall', round: breakable ? 4 : 5 };
  if (breakable) Object.assign(o, { breakable: true, species: 'wallSegment', hp: 8 + idx * 1.6 });
  return o;
}

function clearOfPoint(o, x, y, pad) {
  const b = aabb(o);
  const cx = clamp(x, b.x, b.x + b.w), cy = clamp(y, b.y, b.y + b.h);
  return dist(x, y, cx, cy) > pad;
}

function tryAddGroup(room, group, px, py, portalX, portalY) {
  const before = room.obstacles.length;
  for (const o of group) {
    const spawnPad = o.wall ? (o.breakable ? 300 : 335) : 285;
    if (!clearOfPoint(o, px, py, spawnPad) || !clearOfPoint(o, portalX, portalY, o.wall ? 150 : 120) || !fits(room, o, o.wall ? 28 : 22)) {
      room.obstacles.length = before;
      return false;
    }
    room.obstacles.push(o);
  }
  const reach = reachableFrom(room, px, py);
  if (!reach.has(portalX, portalY)) { room.obstacles.length = before; return false; }
  return true;
}

function addRoomStructures(room, rng, px, py, portalX, portalY, partitioned, hasLandmark = false) {
  const target = room.bossId ? 1 : partitioned ? 1 : (hasLandmark ? 1 : 2);
  const tries = room.bossId ? 4 : partitioned ? 7 : 12;
  let placed = 0;
  const kinds = partitioned ? ['island', 'barricade', 'pillarCrown'] : ['ribGate', 'barricade', 'brokenSpine', 'island', 'pillarCrown'];
  for (let t = 0; t < tries && placed < target; t++) {
    const group = makeStructureGroup(room, rng, pick(rng, kinds));
    if (group.length && tryAddGroup(room, group, px, py, portalX, portalY)) {
      placed++;
      room.landmarks.push({ kind: group[0].archKind || 'structure', x: group.reduce((a, o) => a + (o.x || 0) + (o.w || 0) / 2, 0) / group.length, y: group.reduce((a, o) => a + (o.y || 0) + (o.h || 0) / 2, 0) / group.length });
    }
  }

  if (!room.bossId) {
    const bells = chance(rng, 0.56) ? 1 + (roomAreaScale(room) > 1.8 && chance(rng, 0.12) ? 1 : 0) : 0;
    for (let i = 0; i < bells; i++) placeDashBell(room, rng, px, py, portalX, portalY);
  }
}

function makeStructureGroup(room, rng, kind) {
  const cx = rand(rng, room.w * 0.28, room.w * 0.72);
  const cy = rand(rng, room.h * 0.26, room.h * 0.58);
  const idx = room.idx;
  const style = room.biome.obstacleStyle;
  if (kind === 'ribGate') {
    const gap = rand(rng, 245, 350), len = rand(rng, 235, 370), thick = rand(rng, 24, 34);
    const a = architecturalWall(cx - gap / 2 - thick, cy - len / 2, thick, len, false, idx);
    const b = architecturalWall(cx + gap / 2, cy - len / 2, thick, len, false, idx);
    a.archKind = b.archKind = 'ribGate';
    return [a, b];
  }
  if (kind === 'brokenSpine') {
    const horizontal = chance(rng, 0.55), n = 3, out = [];
    const len = rand(rng, 145, 220), thick = rand(rng, 24, 32), gap = rand(rng, 96, 132);
    for (let i = 0; i < n; i++) {
      const off = (i - 1) * (len + gap);
      const breakable = i === 1 && chance(rng, 0.65);
      const o = horizontal
        ? architecturalWall(cx + off - len / 2, cy - thick / 2, len, thick, breakable, idx)
        : architecturalWall(cx - thick / 2, cy + off - len / 2, thick, len, breakable, idx);
      o.archKind = 'brokenSpine'; out.push(o);
    }
    return out;
  }
  if (kind === 'barricade') {
    const horizontal = chance(rng, 0.5), len = rand(rng, 250, 410), thick = rand(rng, 25, 34);
    const o = horizontal
      ? architecturalWall(cx - len / 2, cy - thick / 2, len, thick, true, idx)
      : architecturalWall(cx - thick / 2, cy - len / 2, thick, len, true, idx);
    o.archKind = 'barricade';
    return [o];
  }
  if (kind === 'pillarCrown') {
    const out = [];
    const rad = rand(rng, 58, 78), rr = rand(rng, 150, 225), start = rng() * TAU;
    for (let i = 0; i < 3; i++) {
      const a = start + (i / 3) * TAU;
      out.push({ type: 'circle', x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr * 0.72, rad, style, archKind: 'pillarCrown' });
    }
    return out;
  }
  // island: one big readable landmark plus a small smashable satellite
  return [
    { type: 'circle', x: cx, y: cy, rad: rand(rng, 78, 106), style, archKind: 'island' },
    { type: 'circle', x: cx + rand(rng, -150, 150), y: cy + rand(rng, -115, 115), rad: rand(rng, 38, 52), style: 'basilicaIdol', breakable: true, species: rollSpecies(rng, room.biome, idx, false), hp: 4 + idx * 0.7, archKind: 'island' },
  ];
}

function placeDashBell(room, rng, px, py, portalX, portalY) {
  for (let tries = 0; tries < 50; tries++) {
    const o = {
      type: 'circle', x: rand(rng, room.wall + 190, room.w - room.wall - 190),
      y: rand(rng, room.wall + 160, room.h - room.wall - 190),
      rad: rand(rng, 28, 36), style: 'basilicaIdol', breakable: true,
      species: 'dashBell', hp: SPECIES.dashBell.hp + room.idx * 0.35, archKind: 'dashBell',
    };
    if (dist(o.x, o.y, px, py) < ROOM.SPAWN_CLEAR + 70 || dist(o.x, o.y, portalX, portalY) < 150 || !fits(room, o, 28)) continue;
    room.obstacles.push(o);
    room.landmarks.push({ kind: 'dashBell', x: o.x, y: o.y });
    return true;
  }
  return false;
}

function pointBlockedForSpawn(room, x, y, pad = 42) {
  for (const o of room.obstacles) {
    if (o.gone) continue;
    if (o.type === 'circle') { if (dist(x, y, o.x, o.y) < o.rad + pad) return true; }
    else {
      const cx = clamp(x, o.x, o.x + o.w), cy = clamp(y, o.y, o.y + o.h);
      if (dist(x, y, cx, cy) < pad) return true;
    }
  }
  return false;
}

function findReachableSpawn(room, rng, reach, px, py) {
  for (let tries = 0; tries < 80; tries++) {
    const side = randi(rng, 0, 3), w = room.wall;
    const x = side === 1 ? room.w - w - rand(rng, 90, 230)
      : side === 3 ? w + rand(rng, 90, 230)
      : rand(rng, w + 130, room.w - w - 130);
    const y = side === 0 ? w + rand(rng, 90, 210)
      : side === 2 ? room.h - w - rand(rng, 90, 210)
      : rand(rng, w + 120, room.h - w - 120);
    if (dist(x, y, px, py) < 460 || pointBlockedForSpawn(room, x, y) || !reach.has(x, y)) continue;
    return { x, y };
  }
  const cells = Array.from(reach.cells || []);
  for (let tries = 0; tries < 120 && cells.length; tries++) {
    const [c, r] = String(cells[Math.floor(rng() * cells.length)]).split(',').map(Number);
    const x = c * CELL + CELL / 2, y = r * CELL + CELL / 2;
    if (dist(x, y, px, py) >= 460 && !pointBlockedForSpawn(room, x, y)) return { x, y };
  }
  return { x: room.w / 2, y: room.wall + 120 };
}

function sanitizePendingSpawns(room, rng, px, py, portalX, portalY) {
  const reach = reachableFrom(room, px, py);
  const fix = (s) => {
    if (!s || (reach.has(s.x, s.y) && !pointBlockedForSpawn(room, s.x, s.y) && dist(s.x, s.y, px, py) >= 460)) return;
    const p = findReachableSpawn(room, rng, reach, px, py);
    s.x = p.x; s.y = p.y;
  };
  if (room.pendingWaves) {
    for (const w of room.pendingWaves) if (w.spawns) for (const s of w.spawns) fix(s);
  }
  for (const s of room.spawnQueue) fix(s);
  // Cache safe edge-biased anchors for late reinforcement waves. Without this,
  // a big-room wall structure can make a random edge spawn technically legal
  // but unreachable — the worst kind of haunted bullshit.
  room.spawnAnchors = [];
  for (let i = 0; i < 22; i++) {
    const p = findReachableSpawn(room, rng, reach, px, py);
    if (!room.spawnAnchors.some(a => dist(a.x, a.y, p.x, p.y) < 125)) room.spawnAnchors.push(p);
  }
  // If a generated solid accidentally boxed the portal after late event placement, fail open.
  if (!reach.has(portalX, portalY)) room.obstacles = room.obstacles.filter(o => !(o.archKind && o.wall && !o.breakable));
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

function placeLandmark(room, rng, px, py, portalX, portalY) {
  const before = room.obstacles.length;
  const style = room.biome.obstacleStyle;
  const clearOf = (x, y, r) =>
    dist(x, y, px, py) > 210 + r * 0.4 && dist(x, y, portalX, portalY) > 135 + r;
  const tryPush = (o) => {
    const ax = o.type === 'circle' ? o.x : o.x + o.w / 2;
    const ay = o.type === 'circle' ? o.y : o.y + o.h / 2;
    const ar = o.type === 'circle' ? o.rad : Math.max(o.w, o.h) / 2;
    if (!clearOf(ax, ay, ar) || !fits(room, o, 22)) return false;
    o.landmark = true; o.archKind = o.archKind || 'setpiece';
    room.obstacles.push(o); return true;
  };

  let cx = room.w / 2, cy = room.h * 0.44;
  for (let t = 0; t < 10; t++) {
    const region = rng();
    cx = region < 0.4 ? room.w * rand(rng, 0.40, 0.60)
      : region < 0.7 ? room.w * rand(rng, 0.18, 0.34)
      : room.w * rand(rng, 0.66, 0.82);
    cy = room.h * rand(rng, 0.32, 0.56);
    if (clearOf(cx, cy, 90)) break;
  }

  const kind = pick(rng, ['monument', 'pillars', 'ruin', 'crater']);
  let placed = 0;
  if (kind === 'monument') {
    placed += tryPush({ type: 'circle', x: cx, y: cy, rad: rand(rng, 86, 116), style, archKind: 'monument' }) ? 1 : 0;
    const sat = randi(rng, 4, 6), rx = rand(rng, 150, 220), a0 = rng() * TAU;
    for (let i = 0; i < sat; i++) {
      const a = a0 + (i / sat) * TAU + rand(rng, -0.25, 0.25);
      placed += tryPush({ type: 'circle', x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * rx * 0.62, rad: rand(rng, 36, 58), style, archKind: 'monument' }) ? 1 : 0;
    }
  } else if (kind === 'pillars') {
    const n = randi(rng, 5, 7), rx = Math.min(room.w, room.h) * rand(rng, 0.17, 0.24), a0 = rng() * TAU;
    for (let i = 0; i < n; i++) {
      const a = a0 + (i / n) * TAU;
      placed += tryPush({ type: 'circle', x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * rx * 0.6, rad: rand(rng, 48, 70), style, archKind: 'pillarCourt' }) ? 1 : 0;
    }
    if (rng() < 0.5) placed += tryPush({ type: 'circle', x: cx, y: cy, rad: rand(rng, 40, 56), style, archKind: 'pillarCourt' }) ? 1 : 0;
  } else if (kind === 'ruin') {
    const n = randi(rng, 3, 5);
    for (let i = 0; i < n; i++) {
      const horiz = rng() < 0.5;
      const sw = horiz ? rand(rng, 230, 360) : rand(rng, 66, 108);
      const sh = horiz ? rand(rng, 66, 108) : rand(rng, 190, 300);
      placed += tryPush({ type: 'rect', x: cx + rand(rng, -270, 270) - sw / 2, y: cy + rand(rng, -150, 150) - sh / 2, w: sw, h: sh, style, round: 14, archKind: 'ruin' }) ? 1 : 0;
    }
  } else {
    const n = randi(rng, 8, 11), rx = Math.min(room.w, room.h) * rand(rng, 0.18, 0.25), a0 = rng() * TAU;
    for (let i = 0; i < n; i++) {
      const a = a0 + (i / n) * TAU;
      placed += tryPush({ type: 'circle', x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * rx * 0.6, rad: rand(rng, 32, 50), style, archKind: 'crater' }) ? 1 : 0;
    }
  }

  const ok = placed >= 3 && reachableFrom(room, px, py).has(portalX, portalY);
  if (!ok) { room.obstacles.length = before; return false; }
  room.landmarks.push({ kind, x: cx, y: cy });
  return true;
}

function rubbleField(room, rng, px, py, portalX, portalY) {
  for (let attempt = 0; attempt < 7; attempt++) {
    const before = room.obstacles.length;
    const cx = rand(rng, room.wall + 240, room.w - room.wall - 240);
    const cy = rand(rng, room.wall + 200, room.h - room.wall - 220);
    if (dist(cx, cy, px, py) < ROOM.SPAWN_CLEAR + 40 || dist(cx, cy, portalX, portalY) < 180) continue;
    const n = randi(rng, 5, 9);
    let placed = 0;
    for (let i = 0; i < n; i++) {
      const a = rng() * TAU, rr = rand(rng, 0, 142);
      const o = {
        type: 'circle', x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr,
        rad: rand(rng, 20, 32), style: room.biome.obstacleStyle,
        breakable: true, species: 'rubble', hp: SPECIES.rubble.hp + room.idx * 0.5,
        archKind: 'rubble', softCover: true,
      };
      if (dist(o.x, o.y, px, py) < ROOM.SPAWN_CLEAR || !fits(room, o, 6)) continue;
      room.obstacles.push(o); placed++;
    }
    if (placed >= 3 && reachableFrom(room, px, py).has(portalX, portalY)) {
      room.landmarks.push({ kind: 'rubble', x: cx, y: cy });
      return true;
    }
    room.obstacles.length = before;
  }
  return false;
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
  const span = rand(rng, 250, 340), depth = rand(rng, 155, 225);
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
  const t = 18;
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

function paintFloorIdentity(ctx, room, rng, pal) {
  const { w, h } = room, wall = room.wall;
  const cx = w / 2, cy = h * 0.46;
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.globalAlpha = 0.13; ctx.strokeStyle = pal.accent3; ctx.lineWidth = 4;
  const m = wall + 36, L = 70 + rng() * 46;
  for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const x = sx > 0 ? m : w - m, y = sy > 0 ? m : h - m;
    ctx.beginPath(); ctx.moveTo(x + sx * L, y); ctx.lineTo(x, y); ctx.lineTo(x, y + sy * L); ctx.stroke();
  }
  const style = Math.floor(rng() * 4);
  if (style === 0) {
    const R = Math.min(w, h) * (0.17 + rng() * 0.05);
    ctx.globalAlpha = 0.13; ctx.strokeStyle = pal.accent3; ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.62, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 0.08; ctx.lineWidth = 2;
    const spokes = 8 + Math.floor(rng() * 6);
    for (let i = 0; i < spokes; i++) {
      const a = (i / spokes) * TAU + rng() * 0.04;
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * R * 0.62, cy + Math.sin(a) * R * 0.62);
      ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); ctx.stroke();
    }
  } else if (style === 1) {
    const vertical = rng() < 0.5;
    const bands = 1 + (rng() < 0.45 ? 1 : 0);
    for (let b = 0; b < bands; b++) {
      const span = (vertical ? w : h), bw = span * (0.09 + rng() * 0.06), pos = span * (0.30 + rng() * 0.40);
      ctx.globalAlpha = 0.055; ctx.fillStyle = pal.accent;
      if (vertical) ctx.fillRect(pos - bw / 2, wall, bw, h - wall * 2);
      else ctx.fillRect(wall, pos - bw / 2, w - wall * 2, bw);
      ctx.globalAlpha = 0.12; ctx.strokeStyle = pal.accent3; ctx.lineWidth = 2.5;
      if (vertical) { floorLine(ctx, pos - bw / 2, wall, pos - bw / 2, h - wall); floorLine(ctx, pos + bw / 2, wall, pos + bw / 2, h - wall); }
      else { floorLine(ctx, wall, pos - bw / 2, w - wall, pos - bw / 2); floorLine(ctx, wall, pos + bw / 2, w - wall, pos + bw / 2); }
    }
  } else if (style === 2) {
    ctx.globalAlpha = 0.14; ctx.strokeStyle = pal.accent3; ctx.lineWidth = 3.5;
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
    ctx.stroke(); ctx.globalAlpha = 0.065; ctx.lineWidth = 9; ctx.stroke();
  } else {
    ctx.globalAlpha = 0.11; ctx.strokeStyle = pal.accent3;
    const base = Math.min(w, h) * (0.30 + rng() * 0.08);
    for (let k = 0; k < 3; k++) { const s = base * (1 - k * 0.26); ctx.lineWidth = 3 - k * 0.4; ctx.strokeRect(cx - s / 2, cy - s / 2, s, s); }
  }
  ctx.restore(); ctx.globalAlpha = 1;
}
function floorLine(ctx, x1, y1, x2, y2) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }

function paintArchitecturalDecals(room, ctx, rng, pal) {
  const spawn = { x: room.w / 2, y: room.h * 0.66 }, portal = { x: room.w / 2, y: room.h * 0.20 };
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';

  // A faint pilgrimage path gives the huge floor direction: spawn → middle → portal.
  const midY = room.h * (room.floorplanId === 'none' ? 0.46 : 0.50);
  ctx.strokeStyle = hexA(pal.accent3, 0.10); ctx.lineWidth = Math.max(46, Math.min(room.w, room.h) * 0.045);
  ctx.beginPath(); ctx.moveTo(spawn.x, spawn.y); ctx.bezierCurveTo(room.w * 0.44, midY, room.w * 0.56, midY, portal.x, portal.y); ctx.stroke();
  ctx.strokeStyle = hexA(pal.bg, 0.16); ctx.lineWidth *= 0.46;
  ctx.beginPath(); ctx.moveTo(spawn.x, spawn.y); ctx.bezierCurveTo(room.w * 0.46, midY, room.w * 0.54, midY, portal.x, portal.y); ctx.stroke();

  // Large room seals: one readable landmark beats fifty random freckles.
  const seals = room.bossId ? 3 : 2;
  for (let i = 0; i < seals; i++) {
    const x = room.w * rand(rng, 0.28, 0.72), y = room.h * rand(rng, 0.27, 0.62);
    const r = Math.min(room.w, room.h) * rand(rng, 0.08, 0.14);
    ctx.save(); ctx.translate(x, y); ctx.rotate(rng() * TAU);
    ctx.strokeStyle = hexA(i % 2 ? pal.accent2 : pal.accent, 0.12); ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(0, 0, r, r * rand(rng, 0.42, 0.72), 0, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 0.75;
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * TAU;
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 0.35, Math.sin(a) * r * 0.35); ctx.lineTo(Math.cos(a) * r * 0.92, Math.sin(a) * r * 0.92); ctx.stroke();
    }
    ctx.restore();
  }

  // Wall shadows and landmark halos baked into the floor so architecture feels rooted.
  for (const o of room.obstacles) {
    if (!o.archKind && !o.wall) continue;
    const b = aabb(o);
    ctx.fillStyle = hexA('#000000', o.wall ? 0.14 : 0.07);
    if (o.type === 'circle') {
      ctx.beginPath(); ctx.ellipse(o.x + 7, o.y + (o.rad || 20) * 0.72, (o.rad || 20) * 1.35, (o.rad || 20) * 0.38, 0, 0, TAU); ctx.fill();
    } else {
      roundRect(ctx, b.x + 5, b.y + b.h * 0.55, b.w, Math.max(12, b.h * 0.5), 8); ctx.fill();
    }
  }

  ctx.restore(); ctx.globalAlpha = 1;
}

function hexA(hex, alpha) {
  const h = hex.replace('#', '');
  return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${alpha})`;
}

function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
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
  paintFloorIdentity(ctx, room, rng, pal);
  paintArchitecturalDecals(room, ctx, rng, pal);

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
