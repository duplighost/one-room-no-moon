// Spawn director: budgets, recipes, staged waves, captain promotion, danger math.
// Grammar from No Moon (docs/no-moon-systems.md §1); staged delivery from the
// bellroom prototype's one good idea. Every spawn is telegraphed — nothing
// materializes on top of the player.
import { state } from '../state.js';
import { CAPS, DIRECTOR } from '../config.js';
import { clamp, dist, rand, randi, weightedPick, chance } from '../rng.js';
import { ENEMY_TYPES, POOL_WEIGHTS, CAPTAINS } from '../data/enemies.js';
import { spawnTelegraphed } from './enemies.js';
import { makeBoss } from './bosses.js';
import { addFloat } from '../render/particles.js';
import { addPulseHazard, addSlowFog } from './hazards.js';
import { view } from '../render/camera.js';

export const dangerStage = (round, overdrive) => {
  const s = Math.floor(round / DIRECTOR.STAGE_DIV);
  return overdrive ? s : Math.min(DIRECTOR.STAGE_CAP, s);
};
export const depthIdx = (round) => Math.min(9, Math.floor((round - 1) / 2));
export const isBossRound = (round) => round % 5 === 0;

// Recipes: weight multipliers over the base pool + density hints for the roller.
export const RECIPES = {
  mixed:         { needs: [],           mult: {},                                density: 0 },
  swarm:         { needs: [],           mult: { skitter: 3.2, gunner: 0.6 },     density: -1, countAdj: 2 },
  gunline:       { needs: ['turret'],   mult: { gunner: 2.6, turret: 2.4, skitter: 0.5 }, density: 2 },
  bite:          { needs: ['charger'],  mult: { charger: 3.0, skitter: 1.4, gunner: 0.4 }, density: -1 },
  anchor:        { needs: ['brute'],    mult: { brute: 3.4, skitter: 1.2 },      density: 0 },
  sniperGallery: { needs: ['sniper'],   mult: { sniper: 3.2, turret: 1.8, skitter: 0.6 }, density: 2 },
  hex:           { needs: ['hexer'],    mult: { hexer: 3.0, turret: 1.4, myrmidon: 1.4 }, density: 1 },
};

export function availableRecipes(round) {
  const have = Object.keys(ENEMY_TYPES).filter(t => ENEMY_TYPES[t].from <= round);
  return Object.keys(RECIPES).filter(id => RECIPES[id].needs.every(t => have.includes(t)));
}

function buildPool(round, recipe) {
  const pool = [];
  for (const [type, def] of Object.entries(ENEMY_TYPES)) {
    if (def.from > round) continue;
    let w = POOL_WEIGHTS[type];
    if (typeof w === 'function') w = w(round);
    w *= (RECIPES[recipe]?.mult[type] ?? 1);
    if (w > 0) pool.push({ item: type, w, cost: def.cost });
  }
  return pool;
}

export function rollComposition(rng, round, recipe, overdrive, budgetMult = 1) {
  const stage = dangerStage(round, overdrive);
  // gentle +1 base so the bigger floor carries a touch more life; slope/cap unchanged
  let budget = (6 + round * 1.3 + stage + (RECIPES[recipe]?.countAdj || 0)) * budgetMult;
  const cap = view.mobile ? CAPS.ENEMIES.mobile : CAPS.ENEMIES.desktop;
  const pool = buildPool(round, recipe);
  const list = [];
  let guard = 80;
  while (budget >= 1 && list.length < cap && guard-- > 0) {
    const affordable = pool.filter(p => p.cost <= budget);
    if (!affordable.length) break;
    const type = weightedPick(rng, affordable);
    list.push(type);
    budget -= ENEMY_TYPES[type].cost;
  }
  return list;
}

// Spawn geometry: cluster points hugging edges, away from the player spawn.
function spawnPoints(room, rng, n) {
  const pts = [];
  const w = room.wall;
  for (let i = 0; i < n; i++) {
    for (let tries = 0; tries < 30; tries++) {
      const side = randi(rng, 0, 3);
      const x = side === 1 ? room.w - w - rand(rng, 60, 170)
        : side === 3 ? w + rand(rng, 60, 170)
        : rand(rng, w + 80, room.w - w - 80);
      const y = side === 0 ? w + rand(rng, 60, 150)
        : side === 2 ? room.h - w - rand(rng, 60, 150)
        : rand(rng, w + 80, room.h - w - 80);
      if (dist(x, y, room.w / 2, room.h * 0.66) < 460) continue;
      let blocked = false;
      for (const o of room.obstacles) {
        const ox = o.type === 'circle' ? o.x : o.x + o.w / 2;
        const oy = o.type === 'circle' ? o.y : o.y + o.h / 2;
        if (dist(x, y, ox, oy) < (o.rad || Math.max(o.w, o.h) / 2) + 40) { blocked = true; break; }
      }
      if (!blocked) { pts.push({ x, y }); break; }
    }
    if (pts.length <= i) pts.push({ x: room.w / 2, y: room.wall + 90 });
  }
  return pts;
}

export function buildWaves(room, rng) {
  const round = room.round;

  if (room.bossId) {
    // boss arena: the boss is present as the room reveals; two escort waves follow
    room.enemies.push(makeBoss(room.bossId, room));
    const escortPool = room.biome.bias.filter(t => ENEMY_TYPES[t] && ENEMY_TYPES[t].from <= round);
    const escorts = escortPool.length ? escortPool : ['skitter'];
    room.pendingWaves = [];
    for (const at of [5, 8.5]) {
      const clusters = spawnPoints(room, rng, 2);
      const n = 2 + Math.floor(room.stage * 0.5);
      room.pendingWaves.push({
        at, fired: false,
        spawns: Array.from({ length: n }, (_, i) => {
          const c = clusters[i % clusters.length];
          return { type: escorts[i % escorts.length], x: c.x + rand(rng, -60, 60), y: c.y + rand(rng, -50, 50), delay: i * 0.15 };
        }),
      });
    }
    return;
  }

  let comp;
  if (room.mutator?.doubleRecipe) {
    // the room deals the hand twice: two compositions at reduced budget each
    comp = [
      ...rollComposition(rng, round, room.recipeId, state.run.overdrive, 0.62),
      ...rollComposition(rng, round, room.recipeId, state.run.overdrive, 0.62),
    ];
  } else {
    comp = rollComposition(rng, round, room.recipeId, state.run.overdrive);
  }
  if (room.mutator?.extraSniper) {
    comp.push(ENEMY_TYPES.sniper.from <= round ? 'sniper' : 'gunner');
  }
  const splitAt = Math.max(2, Math.round(comp.length * DIRECTOR.REINFORCE_AT));
  const first = comp.slice(0, splitAt);
  const second = comp.slice(splitAt);
  // more, smaller clusters → enemies arrive spread around the bigger room instead of
  // piling into two corners (which left the middle reading empty).
  const clusters = spawnPoints(room, rng, clamp(Math.ceil(first.length / 2.4), 2, 5));
  room.pendingWaves = [];

  const firstSpawns = first.map((type, i) => {
    const c = clusters[i % clusters.length];
    return { type, x: c.x + rand(rng, -70, 70), y: c.y + rand(rng, -55, 55), delay: 0.45 + i * 0.12 };
  });
  // high ground wants a perched occupant: seed a sniper/turret on a tier so the
  // platform actually means something (you must climb to engage it).
  if (room.tiers && room.tiers.length) {
    const perch = ENEMY_TYPES.sniper.from <= round ? 'sniper' : ENEMY_TYPES.turret.from <= round ? 'turret' : 'gunner';
    const t = room.tiers[0];
    const spot = firstSpawns.find(s => s.type === perch) || firstSpawns[0];
    if (spot) { spot.type = perch; spot.x = t.x + t.w / 2; spot.y = t.y + t.h / 2; spot.delay = 0.3; }
    else firstSpawns.push({ type: perch, x: t.x + t.w / 2, y: t.y + t.h / 2, delay: 0.3 });
  }
  room.pendingWaves.push({ at: 0, spawns: firstSpawns, fired: false });

  if (second.length) {
    room.pendingWaves.push({
      at: rand(rng, DIRECTOR.REINFORCE_DELAY[0], DIRECTOR.REINFORCE_DELAY[1]),
      orWhenLeft: 2, spawns: null, list: second, fired: false,
    });
  }

  // captain promotion (No Moon odds by depth, game_inline.js:14813-14826)
  const idx = room.idx;
  const baseChance = idx <= 1 ? 0.02 : idx <= 4 ? 0.07 : idx <= 7 ? 0.11 : 0.14;
  const forced = room.mutator?.forceCaptains || 0;
  let promoted = 0;
  for (const s of firstSpawns) {
    if (promoted >= Math.max(1, forced)) break;
    if (!forced && !chance(rng, baseChance)) continue;
    const eligible = CAPTAINS.filter(c => c.hosts.includes(s.type));
    if (!eligible.length) continue;
    const affix = eligible[Math.floor(rng() * eligible.length)];
    s.captain = (e) => applyCaptain(e, affix);
    promoted++;
  }
}

export function applyCaptain(e, affix) {
  e.captain = affix.title;
  e.hp *= affix.hp; e.maxHp = e.hp;
  e.speed *= affix.speed;
  e.r *= 1.12;
  e.color = affix.color;
  e.score = Math.floor(e.score * 1.7);
  if (affix.onDeath === 'debtMinion') {
    e.captainDeath = (en) => spawnTelegraphed(state.room, 'skitter', en.x, en.y, 0.6);
  } else if (affix.onDeath === 'pulseHazard') {
    e.captainDeath = (en) => addPulseHazard(state.room, en.x, en.y, { r: 26, span: 230 });
  } else if (affix.onDeath === 'slowFog') {
    e.captainDeath = (en) => addSlowFog(state.room, en.x, en.y, { r: 96 });
  }
}

export function tickDirector(room, dt) {
  if (!room.pendingWaves) return;
  for (const wave of room.pendingWaves) {
    if (wave.fired) continue;
    const due = room.time >= wave.at ||
      (wave.orWhenLeft != null && room.time > 2.2 && room.enemies.length + room.spawnQueue.length <= wave.orWhenLeft);
    if (!due) continue;
    wave.fired = true;
    if (wave.spawns) {
      for (const s of wave.spawns) spawnTelegraphed(room, s.type, s.x, s.y, DIRECTOR.TELEGRAPH + s.delay, s.captain);
    } else if (wave.list?.length) {
      const rng = Math.random;
      const clusters = spawnPoints(room, rng, clamp(Math.ceil(wave.list.length / 3), 1, 3));
      wave.list.forEach((type, i) => {
        const c = clusters[i % clusters.length];
        spawnTelegraphed(room, type, c.x + rand(rng, -70, 70), c.y + rand(rng, -55, 55), DIRECTOR.TELEGRAPH + i * 0.14);
      });
      if (room.enemies.length) addFloat(room, room.w / 2, room.wall + 70, 'REINFORCEMENTS', room.biome.pal.bad);
    }
  }
}

export function wavesDone(room) {
  return !room.pendingWaves || room.pendingWaves.every(w => w.fired);
}
