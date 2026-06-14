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

## State (updated 2026-06-14)

Feature-complete; in iterative feel/polish driven by playtests. Last shipped: **adopted
ChatGPT's "beeeg perfect merge" build as the base** (reviewed clean — robust spawn anchors,
more structure variety, muzzle-coherence; Dash Bell kept), then **de-fanged the biome
hazards.** The projectile-spitting hazards (spore/snare/thorn/shard/volatile) were unkillable
and stalled the pace, so they're retired: those biomes now furnish **breakable biome-styled
cover** instead (glass biomes → 3-5 chain-glass nodes; plant/bone biomes → rootCyst/marrow
cover via `rollSpecies`). The fog/spore **gas clouds were removed** (fen/mycelium get cover
for parity — furniture, not the gas mechanic). Kept as dodge-choreography: altar shockwaves
(pulse/ritual) + laser lanes (lane/sightline). The `addSlowFog`/lotus consequence-mechanics
(rootCyst, captain deaths, Spiggot boss) are untouched.

## ⚠️ NOT yet playtested by the human

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

- **Former-hazard biomes bare / too busy** → cover counts in `roomRoller.js`: the
  `COVER_FROM_HAZARD` block (snare/thorn/fog/spore, `randi(2,4)`) and the glass `randi(3,5)`.
- **Fights swingy / too dense** → `CAPS.ENEMIES` (config) back toward 22/32; `DIRECTOR` budget base 6→5.
- **Rooms still feel empty / too busy** → landmark chances + `forceRubble` in `roomRoller.js`;
  floor-identity alphas in `paintFloorIdentity`; partition rate via `FLOORPLAN_IDS` ('none' count).
- Bullets too small at zoom → camera `0.82` → ~`0.86` in `render/camera.js` (kept `SHOT_R` 4.2 for readability).
- Bosses melt / too easy → `DASH_HIT_MULT`, `DASH_KILL_REFUND` (config), boss HP in `systems/bosses.js`.
- Character / FX size → `PLAYER.DRAW_SCALE` in `config.js` (one knob: sprite + gun + emitter + rings).

## Next up (player requested — not started)

- **Dash-kill "pop":** enemies killed *by a dash* should burst in a much more satisfying way.
- **Stagger patterns:** enemy types/states you can stagger, with a cooler finisher when you do.
- **Per-biome visual identity:** each biome stunning *and* internally consistent, but clearly
  distinct from the others (22 biomes currently share rendering — differentiate palette /
  patterns / obstacle styles per biome).
- **More enemies / faster, aggressive pacing** (later — touches `CAPS`/director budget).

## Recent passes (newest first; detail in `playtest-notes.md`)

1. **Adopt ChatGPT base + hazard de-fang** (`ad006cc` + de-fang commit) — took ChatGPT's
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
