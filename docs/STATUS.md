# One Room No Moon — STATUS (start here when resuming)

Living snapshot of where we are. Full history + rationale lives in
`docs/playtest-notes.md`; this file is the short "where are we right now" view.

- **Branch:** `claude/busy-wozniak-tqe5fx` (commit + push per chunk). *(Earlier notes
  said `bold-fermi-jio8q5`; the live remote branch with all history is busy-wozniak.)*
- **Dev:** `python3 -m http.server 8000` → `http://localhost:8000/`.
- **Verify:** `node tests/headless.mjs` + `node tests/stress.mjs`; in-browser debug
  API `window.oneRoomDebug` (`state()`, `start(seed)`, `skipRound()`, `selfTest()`).
  Visual: serve on :8400, then `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node tests/visual.mjs`.
- **Player is mildly colourblind** — important signals must read by SHAPE, not colour.

## State (updated 2026-06-15)

Direction shifted hard toward **"endless neon cyberpunk space districts" — constant flow state,
light-speed combat, never stop/wait/choose.** Recently shipped, newest first:

- **Neon districts in one sprawl** (ported from ChatGPT's "neon districts" build, then improved).
  Each giant room now reads as a city: **non-colliding district slabs** (city blocks baked under
  the fight — visual fullness with *zero* added collision) + **flow lanes** (animated neon boost
  boulevards — riding one lifts your speed cap; dashing on one is 1.55×; momentum highways across
  the sprawl) + **district names** ("Afterlight Array · CONDUCTOR GRID · star-city floor") in the
  HUD/transition. *Did NOT port ChatGPT's heavy gun-`kick` recoil (player dislikes it) or its
  surge/clear-node mechanics (we have auto-grant).* **Fixed a real bug in the port:** overlapping
  crossing lanes fought each other (net slowdown at junctions) — now you ride only the single
  best-aligned lane. Perf: dropped per-stroke `shadowBlur` (it hung rendering at city scale —
  bloom gives the glow free) + trimmed the lane grid.
- **Moving floor** (`drawFloorMotion`, also from ChatGPT). The floor is alive: slow water/
  stained-glass currents + a biome-specific motion language per hazard tag (pulse→rings,
  thorn→tendrils, shard→glints, fog→drift, lane→wobble). No shadowBlur (perf-safe); gated by
  `reduced()`/`lowFx` so mobile pays nothing. (Skipped its `clearNode` pilgrimage line — we
  already bake a pilgrimage path.)
- **City-scale rooms + constant flow.** Rooms are now ~2× area (≈2800×2150, 6+ Mpx, "almost a
  city"); cover/ambient/enemy budget all scale with area so the sprawl stays *full of action*,
  not empty. **Always-fire + auto-aim** (the gun never stops — locks the nearest enemy when you
  aren't aiming). **Auto-granted power-ups** at the portal (`autoGrant` — no draft menu, no
  choosing, just a "⚡ POWER UP" flash). **Fast transitions** (1.4→0.62s; boss 2.0→1.2s — barely
  a stop). Enemy caps up (35→52 desktop). Verified: 104 headless + stress + Chromium, desktop
  frameP95 16.8ms (no perf hit at city scale), no console errors.
  *Confirmed clean in this branch (the bugs the player saw are in other builds): no fire-recoil,
  rotate-hint auto-dismisses, no mystery "interlacing" word.*
- **Per-biome visual identity.** Each biome now has a **signature floor emblem** baked into the
  centre — 9 family archetypes (bloom/tide/fracture/thorn/forge/spore/conduit/astral/rite) keyed
  by biome, drawn in its own palette so two same-colour biomes still read distinct (e.g. the gold
  rituals: auricspire's rose window vs the others). Replaced the old generic random floor motif.
  Added a **biome lighting grade** (a faint accent glow toward the portal — warm forges, cold
  reliquaries). Surveyed all 22 in Chromium: distinct, no console errors. (Emblems are low-alpha
  to protect colourblind readability — dial in `patterns.js` EMBLEMS / glow in `bakeBackground`.)
- **Organized-chamber floorplans.** Added 4 chamber layouts with unique, deliberate wall
  positions + staggered doorways: `gallery` (3 stacked halls, zigzag), `warren` (4 chambers
  around an open hub), `antechamber` (portal chamber + hall + nook), `Lcourt` (asymmetric
  corner court). `lineH/lineV` gained an optional door-position arg for organized flow. Nudged
  `openChance` 0.42→0.38 (~62% of non-boss rooms get chambers — player likes the walls).
  Audited: all 4 appear at healthy rates, portal reachable 300/300 (no softlocks).
- **Dash-kill "pop" + stagger.** A dash *kill* now gets a real pop — a directional "slice"
  spray along the dash line, a white core, twin shockwave rings, a `slowMo` beat, and a
  shatter-crunch SFX (vs the plain burst a shot-kill gets). A dash *blow* now **staggers**
  non-boss enemies (bumps `e.stun`, which gates their AI) — they reel with dizzy stun-stars,
  setting up the finish; executing a reeling enemy adds a small flourish. Bosses are immune
  to the stagger so fights stay honest.
- **Adopted ChatGPT's "beeeg perfect merge" as the base** (robust spawn anchors, structure
  variety, muzzle-coherence; Dash Bell kept), then **de-fanged the biome hazards.** The
  projectile-spitting hazards (spore/snare/thorn/shard/volatile) were retired into **breakable
  biome-styled cover** (glass → 3-5 chain-glass; plant/bone → rootCyst/marrow via `rollSpecies`).
  fog/spore **gas clouds removed** (fen/mycelium get cover for parity). Kept as dodge-
  choreography: altar shockwaves (pulse/ritual) + laser lanes. `addSlowFog`/lotus consequence-
  mechanics (rootCyst, captain deaths, Spiggot boss) untouched.

## ⚠️ NOT yet playtested by the human

- **The dash-kill pop + stagger are UNPLAYED.** Confirm in the hands:
  - Does the dash-kill actually feel *satisfying* (slow-mo beat not too sticky on multi-kills;
    slice spray reads; not too noisy)? Dials: `dashKillPop` in `combat.js`, `FX.HIT_PAUSE.dashKill`.
  - Stagger duration (`e.stun = 0.35` on dash-hit in `combat.js`) — does the reel read and
    feel fair, or does it trivialise crowds / feel too brief? Stun-star visual in `sprites.js`.
  - Does "dash to stagger, then finish" emerge as a real, fun loop?
- **The per-biome visual identity is UNPLAYED.** Confirm in the hands:
  - Do biomes read as distinct *in motion*? Any two still feel samey (esp. the gold rituals
    or the cyans)? → palettes in `data/biomes.js`.
  - Are the signature emblems the right strength — present but not busy/distracting against
    enemies/bullets (colourblind)? → alpha in `patterns.js` EMBLEMS; glow in `bakeBackground`.
- **The hazard de-fang + ChatGPT base are UNPLAYED.** Confirm in the hands:
  - Former spitter biomes (verdigris/mirror/rosewire/shardreef/ossuary/umbraharvest/
    blacksungarden/frostreliquary) as breakable-cover rooms — do they feel good, not emptier?
  - fen/mycelium (gas removed) — furnished enough now, or still bare? → `COVER_FROM_HAZARD`
    block in `roomRoller.js` (randi 2-4 +idx).
  - Glass biomes carry 3-5 chain-glass nodes — satisfying chains, or too many explosions?
  - **Pace:** does removing the spitters make it feel faster/more aggressive, as intended?
  - Altar pulses + laser lanes are the only ranged hazards left — do they still read / matter?
- **Also still unplayed from prior passes:** big-room structure/density, scale-coherence,
  caps lifted 22/32 → 25/35 (swingy? → `CAPS.ENEMIES`), chargers smashing soft cover.
- Everything *through* the fast-combat fixes (`44ca13b`) WAS played and liked ("yours is fun!").

## Top open tuning dials (only touch if a playtest flags them)

- **Rooms too big / small** → the `w`/`h` `rand(...)` ranges in `roomRoller.js` `rollRoom`.
  **Combat too soup / sparse** → `CAPS.ENEMIES` (config) + `areaMult` cap in director `buildWaves`.
  **Transitions too fast / slow** → `duration` in `rooms.js` `startTransition`. **Power-up
  pick** logic → `autoGrant` in `draft.js` (currently random-of-3; swap for a "smart" pick).
- **Biome emblems too faint / too busy** → `EMBLEMS` alphas + `SIGNATURE_OF` mapping in
  `data/patterns.js`; biome glow strength in `bakeBackground` (`roomRoller.js`).
- **Too many / too few chamber rooms** → `openChance` in `roomRoller.js` (0.38; up = fewer).
  Per-plan wall positions / door stagger live in `data/floorplans.js`.
- **Former-hazard biomes bare / too busy** → cover counts in `roomRoller.js`: the
  `COVER_FROM_HAZARD` block (snare/thorn/fog/spore, `randi(2,4)`) and the glass `randi(3,5)`.
- **Fights swingy / too dense** → `CAPS.ENEMIES` (config) back toward 22/32; `DIRECTOR` budget base 6→5.
- **Rooms still feel empty / too busy** → landmark chances + `forceRubble` in `roomRoller.js`;
  floor-identity alphas in `paintFloorIdentity`; partition rate via `FLOORPLAN_IDS` ('none' count).
- Bullets too small at zoom → camera `0.82` → ~`0.86` in `render/camera.js` (kept `SHOT_R` 4.2 for readability).
- Bosses melt / too easy → `DASH_HIT_MULT`, `DASH_KILL_REFUND` (config), boss HP in `systems/bosses.js`.
- Character / FX size → `PLAYER.DRAW_SCALE` in `config.js` (one knob: sprite + gun + emitter + rings).
- **Flow lanes too strong / weak or too dense** → `boost` values + `hBands`/`vBands` in
  `seedFlowLanes`; the flowing speed-cap mult (`1.5`/`1.22`) in `player.js`; lane render in `drawFlowLanes`.

## Next up (the "neon cyberpunk space districts" vision — not started)

- **Push the neon further:** brighter palettes; per-district color/biome variation within one
  sprawl (right now districts share the room's biome colour — could vary them).
- **Cooler bosses** (lesson from the space game) + more combo/flash juice.
- **"Full but not obstructive" tuning:** keep filling the sprawl with *non-collision* richness
  (decals/ambient/enemies) over hard cover, if playtest says it still gets in the way.

## Recent passes (newest first; detail in `playtest-notes.md`)

1. **Moving floor + boss-draft hybrid** (this pass) — ported ChatGPT's `drawFloorMotion` (live
   biome-specific floor currents; perf-safe, mobile-off via lowFx). And the draft hybrid (player
   chose "quick menu after bosses"): non-boss rooms auto-grant (no stop), **boss rooms open a real
   draft choice** — restores agency at the earned beat without breaking flow. +1 headless check
   (boss portal opens a draft). Verified clean. **UNPLAYED.**
2. **Neon districts in one sprawl** (`9b1e575`) — ported ChatGPT's district slabs (non-colliding
   city blocks) + flow lanes (neon boost boulevards) + district naming onto our branch; skipped
   its heavy gun-kick + surge/clear-node. Fixed a junction-slowdown bug (ride only the best lane);
   dropped shadowBlur (perf hang). +5 headless checks, Chromium-confirmed visually. **UNPLAYED.**
2. **City-scale rooms + constant flow** (`2f08cfb`) — ~2× rooms (6+ Mpx) with area-scaled
   cover/ambient/enemy budget; always-fire + auto-aim; auto-granted power-ups (no draft stop);
   fast transitions (0.62s); caps 35→52. 104 headless + stress + Chromium clean, frameP95 16.8ms.
   **UNPLAYED.**
2. **Per-biome visual identity** (`1a52e42`) — signature floor emblems (9 family archetypes,
   biome-keyed, palette-coloured) replace the generic floor motif; biome lighting glow. Surveyed
   all 22 in Chromium, distinct, no console errors. **UNPLAYED.**
2. **Organized-chamber floorplans** (`ade6285`) — 4 new chamber layouts (gallery/warren/
   antechamber/Lcourt) with deliberate wall positions + staggered doors; `openChance` 0.42→0.38.
   Audited in Chromium: all appear, portal reachable 300/300, no console errors. **UNPLAYED.**
2. **Dash-kill "pop" + stagger** (`13acece`) — dash-kills get a directional slice/core/rings/
   slow-mo pop + crunch SFX; dash-hits stagger non-boss enemies (stun-gated AI, dizzy stars);
   executing a reeling enemy flourishes. 5 new headless checks; Chromium-confirmed visually
   (DOUBLE/TRIPLE multi-kill reads great). **UNPLAYED.**
2. **Adopt ChatGPT base + hazard de-fang** (`ad006cc` + `a9b0c4f`) — took ChatGPT's
   "beeeg perfect merge" as the base (verified: headless + stress + Chromium clean), then
   retired the projectile-spitting hazards into breakable cover, removed fog/spore gas clouds,
   trimmed the dead hazard kits + draw branches. Kept mutator pity 12 over the base's 8. **UNPLAYED.**
2. **Cross-build compare vs ChatGPT** (`c56f485` + borrows) — fixed enemy-spawns-in-obstacles
   (0/2.6k now); borrowed longer shot range (`SHOT_LIFE` 0.92), mutator pity (force after 12
   dry rounds), pilgrimage-path floor decal. **UNPLAYED.**
2. **Big-room structure & density** (`329c945`,`21c5497`) — landmarks, rubble fields,
   floor identity, partition rebalance, enemy/hazard scaling. **UNPLAYED.**
2. **Scale-coherence + rotate-hint** (`0d633ed`) — `PLAYER.DRAW_SCALE` drives sprite+gun+
   emitter+rings; bullets leave the muzzle; rings sized to the body; rotate hint auto-dismisses. **UNPLAYED.**
3. **Roomier arena rescale** (`ffc43ab`) — bigger rooms, 0.7× sprite, 0.82 camera.
4. **Fast-combat fixes** (`44ca13b`) — dash sweeps the whole travel path; played ✓.
5. **Grave Signal tempo** (`b59e7bc`…`16138a2`) — faster fire, dash-bullet conversion, relics. Played ✓.

## How to resume in a fresh conversation

> Continuing One Room No Moon on branch `claude/busy-wozniak-tqe5fx`. Read
> `docs/STATUS.md` then `docs/playtest-notes.md`, then [next task].

(Keep this file current at the end of each work chunk — it's the handoff.)
