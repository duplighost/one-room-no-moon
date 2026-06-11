# Architecture

The technical contract for One Room No Moon. The goal is the elegance the parents
lack: No Moon is 71k lines in one IIFE; Boon Moots is 1.5k lines in one IIFE. We
keep their zero-build philosophy but split along system seams so content grows in
`data/` without touching `systems/`.

## 1. Tech decisions (settled)

- **Vanilla JS, ES modules, no build step, no dependencies.** `<script type="module">`
  from `index.html`. Dev = any static server (`python3 -m http.server`). Deploys as
  a folder to the existing site exactly like the parents (Netlify `_headers` /
  `_redirects` patterns already in the archive).
- **Canvas 2D** main canvas (`{ alpha:false, desynchronized:true }`) + half-res
  bloom canvas + per-room baked background canvas. DPR clamp 1.35 mobile / 2 desktop.
- **No service worker** (No Moon removed theirs deliberately, game_inline.js:2395).
- **One save key**: `oneRoomNoMoon.v1`, JSON, with `?fresh=1` wipe param.
- **Seeded RNG everywhere in generation**: `mulberry32(hashString(seed))`; a run's
  roller, director, and drops all pull from the run RNG stream. `Math.random()` is
  allowed only for non-gameplay cosmetics (particle jitter).
- **Target**: 60fps desktop, stable on mid phones; entity caps as in the parents
  (enemies 22/32, enemy bullets 110/170, particles 150/260 with FIFO eviction).

## 2. File layout

```
index.html              shell: canvas, HUD DOM, overlay/draft/codex/shrine modals, CSS
src/
  main.js               boot: wire modules, rAF loop, mode state machine
  config.js             tuning constants (feel numbers, caps, flags) — one place
  rng.js                mulberry32, hashString, pick/shuffle/weighted helpers (bag dealer lives here)
  state.js              the single run/save/session state object + mode transitions
  data/
    biomes.js           21 biome defs (palette, patterns, ambient, styles, hazard, bias, tier)
    enemies.js          8 archetypes + captains + boss/miniboss templates (stats only)
    items.js            32 items (28 No Moon + 4 Boon Moots converts): meta + apply/hooks
    hazards.js          10 hazard kit parameter tables by danger stage
    recipes.js          spawn grammar (swarm/gunline/bite/anchor/sniperGallery/hex/debt)
    events.js           room events (cache/gambit/market/nest/spring/vault/care)
    mutators.js         floor mutators
    patterns.js         34 background decoration painters (pure (ctx, room, rng, palette) fns)
    lines.js            voice: clear lines, behavior notices, event/boss copy
  systems/
    roomRoller.js       THE generator: deals axes, builds room object, bakes background
    director.js         budgets, waves, allowed types, captain promotion, danger stage
    player.js           Moots: movement, dash, pulse, fire, hp/shield, boon reroll
    enemies.js          AI update per archetype + boss brains
    bullets.js          player/enemy projectiles, pierce/bounce/chain/freeze hooks
    hazards.js          hazard tick + collision
    pickups.js          sparks/repair/heart/cores, magnet, vacuum-on-clear
    breakables.js       species behavior on break
    rooms.js            round lifecycle: live → clear → portal → transition
    draft.js            card dealing, weights, stacks, boon reroll
    score.js            combo, streaks, bonuses, bests
    meta.js             save load/store, shrine, codex data, achievements/notices
  render/
    draw.js             frame composition (order fixed: bg→ambient→telegraphs→entities y-sorted→bullets→particles→bloom→overlay→hud)
    sprites.js          Moots sprite loader (from assets/), enemy/boss vector painters
    particles.js        particle kinds + budget
    camera.js           damped follow, aim-lead, kick, shake
    hudCanvas.js        in-canvas HUD bits (danger triangles, floats, touch pads, boss bar)
  audio/
    sfx.js              tone/noise recipes (shot/dash/kill/hurt/pulse/clear/care/draft/boss)
    bgm.js              86 BPM stress sequencer (Phase 6)
  ui/
    overlays.js         title/death/pause DOM, draft cards DOM, codex, shrine
    input.js            keyboard/mouse/gamepad/two-thumb touch, flick detection
assets/
  moots.webp            the Boon Moots sprite (copy of reference/assets/boon-moots-sprite.webp)
  portraits/, bosses/   webp art for codex/boss intros (copied from reference/assets/)
docs/, reference/       this planning suite + read-only source games
```

Order-of-magnitude budget: ~6–8k lines total. If a file passes ~500 lines, split it.

## 3. Core data shapes

```js
// the room the roller returns — systems consume this, never the roller's internals
room = {
  round, biome, layoutId, mutatorId|null, eventId|null,
  w, h, wall,                       // bounds (wall = inset)
  background,                       // baked offscreen canvas
  obstacles: [{x,y, type:'circle'|'rect', r|w/h, style, breakable?, species?, hp?, volatile?}],
  annex: {side, rect, kind:'secret'|'ambush'} | null,
  hazards: [...], lanes: [...],     // per data/hazards.js params
  enemies: [], bullets: [], pickups: [], particles: [], floats: [],
  waves: [{at, list:[{type, x, y, captain?}]}],   // director output, telegraphed spawns
  event: {...} | null, care: [...],
  cleared: false, clearT: 0, portal: null, time: 0,
}

enemy = { id, type, x,y, vx,vy, r, hp, maxHp, speed, color, awake, phase, cd, tele,
          stun, slowTimer, slowMul, captain|null, boss?, bossPhase? }

player = { x,y,vx,vy, r:20, face, aimX,aimY, hp, maxHp, shield, shieldMax, inv, hurt,
           fireDelay, fireCd, damage, pulse, pulseGain, pulseRadius,
           dashCdBase, dashCd, dashT, dashDur, after: [],
           perks: {damage, fire, speed, maxHp}, modules: {itemId: stacks},
           boon: {charges, progress, need} }

save = { version, bestScore, bestRound, dailyBest: {date, score}, sparks, runs,
         shrine: {id: true}, bestiary: {type: kills}, notices: [], seenItems: {},
         lifetime: {kills, rooms, wins, deaths, timePlayed}, settings: {sfx, bgm} }
```

## 4. Module rules

1. **`data/` is inert.** Catalog files export plain objects/arrays + tiny pure
   functions (`apply(player)` hooks at most). No imports from `systems/`.
2. **`roomRoller.js` consumes only `data/` + `rng.js`.** It owns the no-repeat bags
   (one per axis, persisted on run state) and the axis cross-check pass (recipe↔
   layout density, biome↔hazard, event↔mutator exclusions). Output is a complete
   `room` object + baked background. It never touches live entities.
3. **`director.js` owns time.** Wave scheduling, spawn telegraphs, captain rolls,
   danger stage math. The roller asks it for `waves` at build; it then ticks during
   play (reinforcements, boss summons).
4. **Item effects are hooks, not ifs.** `items.js` registers behavior on a small
   hook table: `onFire`, `onBulletSpawn`, `onHit`, `onKill`, `onRoomClear`,
   `onPlayerHurt`, `tick`. Systems call hooks; no system ever switches on item ids.
   (This is the cleanup of No Moon's scattered `moduleStacks()` call sites.)
5. **One state object** (`state.js`), explicit mode enum: `title | play | portalDraft
   | dead | pause | codex | shrine | transition`. Update and draw both switch on it
   in one place (`main.js`).
6. **Feel constants live in `config.js`**, named exactly as in the docs (e.g.
   `DASH_IMPULSE = 1325`) so the parity bar against Boon Moots is checkable.
7. **Reduced-motion and mobile checks** are utilities (`coarse()`, `reduced()`)
   honored by juice and particle budgets, as in Boon Moots.

## 5. The frame

```
rAF → dtRaw clamp(1..33ms) → decay shake/flash/slowMo/hitPause
  if hitPause: particles only
  worldDt = dt × slowMoScale
  switch(mode): play → input → player → director.tick → enemies → bullets →
                hazards → breakables/event → pickups → particles → score/combo →
                clear check → camera
  draw(state) — single composition function, fixed order, bloom composite last
```

Identical bones to both parents (No Moon 9410, Boon Moots 1516). No fixed timestep;
clamped variable dt with damp() everywhere, exactly like the parents — their feel
constants assume it.

## 6. Verification harness (build it in Phase 0, use it every phase)

`window.oneRoomDebug` mirroring Boon Moots' `passengerTactile*` hooks
(`reference/boon-moots/index.html:1520–1529`):

- `state()` → mode, round, biome, layout, enemy/bullet/particle counts, hp, score
- `start(seed?)`, `skipRound()`, `killAll()`, `grant(itemId)`, `roll(n)` →
  generate n rooms headless and return their axis summaries (the anti-boring
  audit: assert no consecutive repeats, assert parameter spread)
- `selfTest()` → tap-target audit + overflow check + 60-frame timing sample

This is how each phase's acceptance criteria get checked from the console/CI
without a human watching every frame.

## 7. Porting protocol (the "don't rip blindly" rule, operationalized)

For each system ported from a parent: (1) read its spec in these docs; (2) write
the clean version against our shapes; (3) only when behavior is ambiguous, open the
parent at the line anchor and read the *minimum* needed; (4) note any deliberate
divergence in a `// differs from No Moon:` comment. Never copy-paste parent code —
both parents' versions are entangled with their own state objects, and the
prototypes already demonstrated what mechanical copying gets you.
