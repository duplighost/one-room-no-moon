# Playtest Notes

## What is machine-verified (every commit)

`node tests/headless.mjs` — 99 checks, 5/5 stability runs at time of writing:
boot → play → clear → portal → draft → transition → death; all four boss brains
including Warden/Archon phase summons; route win → Overdrive round 21+; item
hooks (bounce/pierce/homing on spawn, stack caps, overflow→repair); companions
ticking; event rolls (~45% + pity) and variety; mutator rolls (~10%, never on
boss rounds); shrine purchase/application; headstart; Oath of Glass stats; daily
same-board determinism and daily-best banking; notices dedupe; bgm toggle
persistence; touch-pad suppression; the hazard de-fang (retired spitters fire
nothing; surviving altar pulses still go inert on clear; former spitter biomes
furnish breakable cover); 40-room roller audit (no consecutive biome/layout
repeats, ≥12 biomes, ≥7 layouts, ≥4 recipes, stages escalate, every room has
hazards/lanes or breakable cover, annexes occur, seeded determinism, tier
banding, round-20 final arena).

A 12-round auto-play stress harness (drives the real loop, picks random draft
cards, crosses the round-5 and round-10 boss fights) runs ~8,000 frames with
zero exceptions across all 22 biomes (4 live hazard kits — pulse/ritual/lane/
sightline — the spitter kits are retired) and all 8+ enemy AIs.

## Power & spectacle push ("go as far as you can", 2026-06-15 latest)

A big batch on the "make it amazing" mandate. All verified (108 headless + stress + Chromium), all
UNPLAYED. Four features, each its own commit:

- **Cinematic boss intros** (`bossIntro` in bosses.js, `drawBossIntro` in draw.js): on the boss's
  first live tick — `slowMo(0.45)`, flash, shake; the name slams in huge center-screen and fades
  over a ~1.05s hold; boss is `invulnT`/held so it can't be cheesed. No new mode (brain
  short-circuits while `introT>0`). *Dial:* intro length = `introT` init.
- **Multi-phase boss transforms** (`bossPhaseShift`): at 50% HP — wipe enemy bullets (fair reset),
  shockwave + flash + shake, boss grows + recolors hot, `invulnT` window, then `e.enraged`. Each
  gimmick escalates off `enraged` (Warden gap narrows/spins faster, Moon pulls harder, Spiggot 4th
  spiral arm, Archon lanes arm more often). `invulnT` decays in updateEnemies; checked in combat.js.
- **Giant rooms + viewport culling**: desktop ~6→~12–14 Mpx (deviceScale pulls phones back).
  `visibleRect(margin)` in draw.js culls drawFloorMotion currents, drawFlowLanes, and obstacle
  rendering to the camera → per-frame cost no longer scales with room size. Enemy budget already
  sqrt-capped at 2.1× (spreads, doesn't multiply); `coverCap` + `areaBonus*6` hold cover density
  (>2.0/Mpx). *Dials:* room dims in roomRoller (line ~71); cull margins in `visibleRect` calls.
- **Combo power-fantasy juice** (score.js + draw.js + sprites.js): `comboMilestone` fires on each
  integer multiplier cross (flash/shake/named float/burst/chime, intensity ramps); on-fire
  screen-edge glow in the frame overlay (amber→pink→white by tier); player charged aura ring in
  drawPlayer. All cosmetic, `reduced()`-gated. *Dial:* COMBO.PER_KILL/CAP in config.js.

## Bosses — a signature gimmick each (player-directed, 2026-06-15)

Player picked "signature gimmick each." The four bosses were all "summon + fire rings"; each now
has one unforgettable, readable, dash-rewarding mechanic (in `systems/bosses.js` brains + hooks):

- **False Moon** — gravity *false pull*: telegraphed inhale (`armT`) then drags the player in
  (`p.vx/vy += pull`), then a ring blast on release. Dash (i-frames + speed) beats the gravity.
- **Graven Warden** — *rotating shield gap*: `e.shield`/`shieldAngle`/`gapHalf` rotate; `combat.js`
  `damageEnemy` checks the hit direction (kx,ky) vs the gap and drops off-gap damage to 12%
  (sparks). Shoot it, or **dash through the gap** into the core. Rendered as a gold arc + gap arrow
  in `sprites.js`.
- **Spiggot** — *spore spiral*: below half HP, a slow rotating 3-arm `fireEnemyShot` stream — a
  readable spiral you weave/dash through (plus the existing brood/fog).
- **Null Archon** (final) — *weaponizes the city*: arms the flow lanes (`laneArmT`, red warning
  flash) then they go **lethal** (`laneLiveT`) — standing on a boulevard calls `hurtPlayer`.
  `draw.js` `drawFlowLanes` reads the boss's lane state and lights the lanes red.

New imports: bosses.js now pulls `hurtPlayer` (combat), `distPointSegment` (hazards), `ripple`/
`addShake`/`addFlash`. No import cycle issue (all called at runtime). Verified: parse, 108 headless
(boss flow incl. archon), stress (fights False Moon @5 + Warden @10 live, no crash), Chromium —
shield arc + lethal-red lanes both render clearly, no console errors. UNPLAYED.

## Distinct, well-fleshed neighborhoods (player-directed + ChatGPT Round 2, 2026-06-15)

Player: "really distinct well-fleshed world and neighborhoods first, then amazing bosses." Shared
ChatGPT's "Giant Round 2" build (v0.5.2, source + patch + playable). Reviewed the patch and took
the gold; built the distinct part myself (neither build had it). All verified, UNPLAYED:

- **Distinct neighborhood hues** (my work): `seedDistricts` gives each grid district its own neon
  hue — `hsl((baseHue + id*64) % 360, 80%, 62%)`, baseHue room-random — drawn additively
  (`paintNeonDistricts` in 'lighter'). A single sprawl now reads as different-coloured neighborhoods.
  Denser grid (4–5 × 4–5, ~16 districts/room), skip 0.16→0.12.
- **City dressing** (ported from ChatGPT Round 2): `seedCityDressing` + `paintCityDressing` —
  skyways (aerial transit rails between districts), neon signs (NULL/MOON/GRAFT… district-tinted),
  traffic flecks along boost roads. All NON-COLLIDING and BAKED → world flesh at **zero per-frame
  cost** (desktop frameP95 stayed 33ms).
- **Background scaling** (`chooseBackgroundScale`, from ChatGPT): caps the baked canvas at 9MP
  desktop / 5.6MP mobile (draw in room-space, output scaled-down, drawImage scales back up). Lets
  giant rooms bake cheap. draw.js now draws the bg at full `room.w×room.h`.
- **Bake own-RNG isolation** (from ChatGPT): `bakeBackground` reseeds its own `mulberry32(hash…)`
  so visual baking never advances gameplay RNG. *Honest caveat:* ChatGPT's headless skipped baking
  (no `document`) so its browser/headless rooms diverged; MINE stubs `document` and bakes in
  headless too, so I didn't actually have that bug — but I adopted the isolation anyway (defensive,
  and needed once baking is scaled). +3 headless checks (dressing generated, distinct hues, scale).

Did NOT chase ChatGPT's 33 MP rooms — it admits it couldn't browser-perf-test them, and its own
earlier note called 33 MP an "Android-killing shopping cart." I kept the proven ~6 MP size (perf
gated); going bigger needs viewport-culling of the moving floor + lanes first (a clean follow-up).

## Neon districts in one sprawl (player-directed, ported from ChatGPT, 2026-06-15)

Player picked "districts in one sprawl," then shared ChatGPT's parallel "neon districts flow
state" build. Reviewed it (passes its own headless, clean) and **ported the gold onto our branch**
rather than adopting it wholesale (theirs lacks our chambers / biome emblems / auto-grant / de-fang
cover). Ported pieces, all verified:

- **District slabs** (`seedDistricts` + `paintNeonDistricts` in roomRoller): a grid of NON-COLLIDING
  rounded-rect city blocks baked under the fight + window/street grid + spawn/exit/plaza anchors.
  Pure visual fullness — the sprawl reads as a place without adding collision (the "full but not
  obstructive" ask, exactly).
- **Flow lanes** (`seedFlowLanes` + `applyFlowLanes` in player + `drawFlowLanes` in draw): wide neon
  boost boulevards (arteries spawn→portal + a 3×3 grid + diagonals). Riding one boosts you along it
  and lifts your speed cap (×1.5 walking, dash on a lane ×1.22 of dash speed). Animated scrolling
  dashes, brighter on the lane you're riding. Obstacles keep clear of the arteries (`nearProtected
  FlowLane` in `fits`; arteries-only so cover density still holds >2.0/Mpx).
- **District naming**: `rollDistrictName`/`Subtitle` → HUD zone + transition card ("Afterlight Array
  · CONDUCTOR GRID · star-city floor").

**Deliberately NOT ported:** ChatGPT's gun-`kick` recoil (player dislikes heavy knockback) and its
surge/clear-node mechanics (we have auto-grant + fast transitions).

**Two real bugs found + fixed during the port (the value of checking):**
1. *Perf hang* — `drawFlowLanes` used `ctx.shadowBlur` on long strokes × ~14 lanes × 3 passes/frame;
   at 6 Mpx it hung rendering (screenshot timed out). Dropped shadowBlur (bloom gives the glow free),
   trimmed the lane grid 5+5→3+3 bands, made the bright speed-line active-lane-only.
2. *Junction slowdown* — applying every overlapping lane's boost+steer made crossing lanes fight
   each other (A/B test: lane 242 vs no-lane 330 — the lane slowed you!). Now you ride only the
   single best-aligned lane. (ChatGPT's version has this latent.)

Verified: 107 headless checks (incl. 5 new: lanes generate, named, flowT sets, lane boosts speed
vs no-lane), stress, Chromium — desktop frameP95 33ms (software render; ~60fps real GPU), mobile
~50ms, no console errors. UNPLAYED.

## City-scale rooms + constant flow state (player-directed, 2026-06-15)

Player went big: "endless neon cyberpunk space districts," "almost a city," "constant flow
state," always shooting, never wait/choose/crash. This pass builds the *mechanical foundation*
of that (the art re-theme is the next layer). All verified, UNPLAYED:

- **City-scale rooms.** `rollRoom` dims ~2× area (landscape ≈2520-2960 × 1840-2160; measured a
  live room at 2824×2155 = 6.09 Mpx vs the old ~2.9). Density scales with area so the sprawl is
  full: cover `areaBonus` is now ~linear in area (clamp 16→28), ambient drift up (40→52 base,
  cap 1.55→2.6), and the **enemy budget scales with area** (`areaMult` in director `buildWaves`,
  passed as `budgetMult`). `CAPS.ENEMIES` 35→52 desktop / 25→34 mobile.
- **Always-fire + auto-aim** (`player.js`): the gun fires whenever there's a target; with no
  manual aim it locks the nearest same-level enemy. Manual aim still wins. Verified visually —
  player stands still and streams bullets at the nearest foe.
- **Auto-granted power-ups** (`autoGrant` in `draft.js`): the portal deals the usual 3 cards,
  takes one at random, grants it (the existing name-flash + chime fire since source≠'draft'),
  plus a "⚡ POWER UP" lead-in. No menu, no pause. Item *rate* is unchanged (every room, as the
  draft was) — only the choice/stop is gone. `openDraft`/`pickCard` kept but unused by gameplay.
- **Fast transitions** (`rooms.js`): 1.4→0.62s (boss 2.0→1.2). Barely a beat.
- Tests updated: the three draft-flow checks now assert the auto-grant contract (portal →
  power-up granted → straight to 'transition', round advances) instead of the old portalDraft→pick.

Verified: 104 headless checks, stress (all biomes/enemies, auto-fire on), Chromium visual —
desktop frameP95 16.8ms (no perf hit at 6 Mpx), mobile ~50ms (unchanged from before), NO console
errors. Confirmed the player's reported bugs are NOT in this branch: no fire-recoil in
`firePlayer`, rotate hint auto-dismisses (camera.js, 6s timer + re-arm), no "interlacing" word
(sound buttons read "sfx on"/"bgm on"). zC ("the best game") is the *space game* (a different
`js/` codebase), shared for lessons, not merged.

## Feel + biome-identity passes (player-directed, 2026-06-14)

Three quick passes after the de-fang, each committed + pushed to the branch, each verified
(headless + stress + Chromium, no console errors), all UNPLAYED:

1. **Dash-kill "pop" + stagger** (`13acece`). Dash-kills routed through the same FX as
   shot-kills; now `killEnemy` takes the kill `kind` and a dash-kill gets a directional slice
   (along `p.lastDashAngle`), a white core, twin rings, a `slowMo` beat, stronger shake, and a
   kill+break SFX crunch. Dash *hits* stagger non-boss enemies (`e.stun` 0.35 — AI is gated on
   stun) with dizzy stun-stars; executing a reeling enemy flourishes. Bosses immune. +5 headless
   checks. Chromium capture showed the slice + DOUBLE/TRIPLE multi-kill reading great.

2. **Organized-chamber floorplans** (`ade6285`). Player liked the wall density and asked for
   unique positions / organized chambers. Added gallery (3 stacked halls, zigzag doors), warren
   (4 chambers, open hub), antechamber (portal chamber + nook), Lcourt (corner court). `lineH/
   lineV` took an optional door-position arg for staggered flow. `openChance` 0.42→0.38. Audit
   over 300 rooms: all four appear ~17-19×, portal reachable 300/300.

3. **Per-biome visual identity** (this pass). Each biome gets a **signature floor emblem** baked
   centre — 9 family archetypes (bloom/tide/fracture/thorn/forge/spore/conduit/astral/rite) in
   `data/patterns.js`, mapped by biome, drawn in its palette so same-colour biomes still read
   apart (auricspire's rose window is the standout). Replaced the generic random floor motif in
   `paintFloorIdentity`. Added a biome **lighting grade** (faint accent glow toward the portal)
   in `bakeBackground`. Emblems are deliberately low-alpha (colourblind readability: signals stay
   shape-first). Surveyed all 22 biomes in Chromium (overdrive tier='any' to reach every biome) —
   distinct, no errors. Note: ring-structured emblems read best; bloom/thorn got concentric rings
   so the 5 petal/barb biomes read like the others.

## Adopt ChatGPT base + hazard de-fang (player-directed, 2026-06-14)

The player shared two builds (ours + ChatGPT's "beeeg perfect merge") and asked to use
ChatGPT's *if* it checked out, then to get rid of the obstacles that **shoot at you** —
"something you cannot shoot at and kill, which slows gameplay" — and repurpose what's left,
without making a mess. Two-step delivery:

**1. Adopted ChatGPT's build as the base** (`ad006cc`). Reviewed it against ours: same clean
axis-based architecture, not a monkey-patch. Net wins adopted — reachability-validated
`spawnAnchors` (reinforcements can't appear behind a wall, a stronger form of the
spawn-in-obstacle fix); more structure variety; the drawn gun muzzle derives from the same
`EMITTER_LEN`/`TWIN_OFFSET` constants `firePlayer` uses (art + bullet origin can't drift);
enemy gunfire can chew cracked wall segments. Verified before trusting it: all headless +
13-round stress + real Chromium (zero console errors). Kept the Dash Bell (player said keep
it this time) and our deliberately-tuned mutator pity 12 over the base's 8.

**2. De-fanged the biome hazards.** Decisions (asked up front): scope = **spitters → breakable
cover** (leave lasers + altar shockwaves as dodge-variety); gas clouds = **removed**; Dash
Bell = **kept**.

- *What "shoots":* `room.hazards` are intangible biome zones (nothing in collision touches
  them) — the player can't destroy them, exactly the complaint. The spitters (spore/snare/
  thorn/shard/volatile) fired via `fireEnemyShot`; the "stops shooting after clear" code is
  `if (room.cleared) return` in `updateHazards`.
- *Removed:* the area-hazard seeding block in `seedHazards`, the three spitter branches in
  `updateHazards`, the `kitParam` helper + `fireEnemyShot`/`norm`/`levelAt` imports, the dead
  draw branches (spore/snare/thorn/shard/volatile), and the six retired hazard kits. Net −28 lines.
- *Repurposed (roomRoller):* glass biomes (shard/volatile) → 3-5 breakable **chain-glass**
  nodes (reuses `volatileShard`); snare/thorn → breakable biome-styled cover via `rollSpecies`;
  fen/mycelium (fog/spore, gas removed) → light cover for parity (furniture, not the gas
  mechanic). All `fits()`-validated; breakable circles never block the reachability flood-fill,
  so no softlock risk.
- *Untouched:* altar shockwaves (pulse/ritual) + laser lanes (lane/sightline) stay as the
  remaining dodge-choreography; `addSlowFog`/lotus consequence-mechanics (rootCyst breaks,
  captain deaths, Spiggot boss, the enemy-slow lotus) are kept — only *biome ambient* fog is gone.
- *Tests:* the two assertions that encoded the old behavior were rewritten to the new contract
  ("retired spitter fires nothing", "surviving hazards go inert after clear", "former spitter
  biomes furnish breakable cover"); added a `breakables` count to the roller audit.

**Open for the hands** (see STATUS): does retiring the spitters actually read as faster/more
aggressive; are the former-spitter and fen/mycelium rooms furnished enough; are chain-glass
counts fun or explosion-soup; do the surviving altar/laser hazards still matter.

## Cross-build comparison vs ChatGPT's "beeg" build (2026-06-14)

The player shared ChatGPT's parallel build (a fork of the same `3a7bfad` base) and asked
to compare, steal the good bits, and find bugs both ways. We converged on most of the
scale/density work independently; the interesting deltas:

- **Structure philosophy.** ChatGPT leaned on *walls* (freestanding ribGate / brokenSpine /
  barricade, reachability-validated); ours leans on *cover + partitions* (non-wall landmark
  clusters + rebalanced partition rate + guaranteed rubble). Measured: ours denser cover
  (2.80 vs 2.17/Mpx), theirs more walls (3.25 vs 2.79).
- **Bug found in OURS (fixed, `c56f485`):** ~0.6% of enemies spawned inside obstacles —
  the cluster-jitter and event-added cover were never re-validated. Now 0/2.6k via
  `legalSpawn()` in the director + a post-event `sanitizeSpawns()` in the roller (only
  spends rng when it actually relocates one). Also scaled the player shadow with DRAW_SCALE.
- **Bugs in THEIRS (not adopted):** `addRoomStructures` runs on boss rooms too (~22% of
  boss arenas get a freestanding wall — legibility risk); island/dashBell hardcode
  `basilicaIdol` style across biomes; rotate hint re-shows on every resize; `room.landmarks`
  is dead data. (Their build passes the base headless+stress suite — no crashers.)
- **Borrowed from theirs (player-picked):** longer shot range (`SHOT_LIFE` 0.82→0.92, less
  stubby in big rooms), a **mutator pity timer** (force one after 12 dry eligible rounds so
  no seed goes mutator-dry — threshold 12 not 8, which keeps the rate at ~10.6% instead of
  inflating to 15%), and a faint **pilgrimage-path** floor decal (spawn→middle→portal) for
  direction. **Did NOT take:** their `dashBell` (player's call), `SHOT_R` 3.8 (kept 4.2 for
  colourblind readability), and their wall-structure approach (we have partitions+landmarks).

## Big-room structure & density + scale-coherence (player-directed, 2026-06-14)

The player playtested the roomier arena and reported the rooms "feel very vacant and
empty after we made them bigger… they cannot be large open spaces" — and that a mobile
"rotate to landscape" hint never went away. They also forwarded a ChatGPT scale-coherence
audit, with the instruction to **verify, not take its word**. Verdicts on the audit (all
checked against our code first):

- **Right, fixed:** 0.7 sprite scale was hardcoded → now `PLAYER.DRAW_SCALE` in config, the
  one knob for body+gun+emitter+rings. Bullet emitter floated ahead of the shrunk muzzle →
  `EMITTER_LEN/Y` and `TWIN_OFFSET` now ×DRAW_SCALE in `firePlayer` (locked to the drawn gun;
  `onFire` `oy` scaled too). Hurt/invuln/shield/dash-aura rings were full-size hoops on the
  smaller body → scaled by DRAW_SCALE. Background pattern counts were absolute → scaled to
  room area. Obstacles sparse, annexes tiny → both sized up. Hazards thinned in the big area
  → area hazards +1 count / +12% radius in big rooms.
- **Diverged, deliberately:** ChatGPT said shrink `SHOT_R` to ~3.6–3.8 to match the smaller
  gun. **Kept 4.2** — the player is colourblind and bullets already read small at 0.82 zoom;
  readability beats muzzle realism. Fixing the emitter *offset* solves the real mismatch.
- **Overruled by the player:** ChatGPT said "don't increase enemy count yet." The player
  explicitly asked the floor to "earn its size with other things too, not just environmental
  obstacles," so a *gentle* lift shipped (caps 22/32 → 25/35, +1 budget base, more spawn
  clusters). Flagged as the top dial to walk back if fights feel swingy.
- **Wrong here (env-specific):** ChatGPT said `tests/visual.mjs` imports Playwright from a
  "hardcoded missing path." That path **exists in our environment** (`/opt/pw-browsers` +
  `PLAYWRIGHT_BROWSERS_PATH`); the test ran fine and screenshots were verified. The absolute
  import *was* fragile across machines, so it now resolves Playwright from a candidate list.

The room-emptiness fix (the real ask) — the bigger floor needs **architecture, not confetti**:
- **Landmark set-pieces** (`placeLandmark`): a monument / pillar court / ruined wall / crater
  anchors most rooms. Ordinary cover (blocks bullets + movement — `bullets.js` already treats
  non-ledge obstacles as cover, confirmed), so they carve real line-of-fire zones. Spread on a
  flat ellipse (wide rooms have horizontal room; the spawn→portal lane squeezes vertical
  pieces), placed off that lane, gapped so they never wall you in, tagged `landmark` so the
  breakable pass leaves them solid. Must seat ≥3 pieces to count.
- **Breakable rubble fields** (`rubbleField`): a tight cluster of smashable blocks (`rubble`
  species, hp 2) — a destructible barricade you carve through. GUARANTEED in the rare open
  room that drew no landmark, so there are no bare arenas.
- **Chargers smash soft cover** during their dash (`smashThroughCover` in enemies.js) — the
  player's "broken by enemies" idea, scoped to rubble + light pots (never doors / wall
  segments / altars / volatile shards).
- **Baked floor identity** (`paintFloorIdentity`): a centre medallion / sweeping bands /
  fracture / plaza frames + corner framing, palette-keyed, low alpha — the big anchor the eye
  wants. **Partition rate eased 76% → ~57%** (one more `none` in `FLOORPLAN_IDS`) so annexes /
  tiers / landmarks actually get to appear.

Measured (headless, 30–40 seeds): cover density 1.49 → ~2.9/Mpx (back to the old "full" feel);
**~98% of rooms now carry major structure** (partition / landmark / tier / rubble); 0
unreachable portals across 250+-room audits; mutator rate still 10.8%. New headless checks lock
the density floor, landmark + rubble occurrence, and the scaled muzzle. Real Chromium: 0
console/page errors desktop + mobile portrait; the rotate hint now fades after ~6s and re-arms
only on a real rotate (was toggled solely in `resize()` → permanent nag in portrait); rings
read snug to the smaller Moots; screenshots confirm rich/structured rooms across biomes.

Open for the next human playtest: do the rooms feel *designed* in the hands; is the enemy
lift pleasant or swingy (`CAPS.ENEMIES`); do chargers smashing cover read well; any room feel
cramped on a phone. Dials in §"Top open tuning dials" of STATUS.md.

## Roomier arena pass (player-directed world rescale, 2026-06-14)

The character read as "gigantic in these rooms." Root cause, measured: his sprite
was drawn at 72×106 for a 40px hitbox (~2× his footprint), and the camera/rooms
were tight. Player chose the full rescale. Key idea documented for next time:
"smaller character + bigger room" done *proportionally* is just a camera zoom —
what actually changes feel is (a) the sprite-to-hitbox mismatch (free to fix) and
(b) the player-to-roomspace ratio (real balance). Shipped:

- **Sprite drawn at 0.7×** — a single `ctx.scale` in `drawPlayerBody`, so body, gun,
  eyes, and afterimages all shrink together; now matches his footprint and lines up
  with enemies (drawn ~hitbox size). Pure render; **hitbox unchanged** (zero balance
  shift). Shadow shrunk to match.
- **Rooms ~1.4× bigger** (roller rolls: non-boss ~1900–2160 w × 1360–1540 h, boss
  larger, portrait ~1760–1900 h). A mid-game room measured ~2100×1530 (was ~1490×1075).
- **Desktop camera zoomed to 0.82** (was 1.0) so the larger arena reads roomy; mobile
  stays adaptive.
- **Spawn distances scaled** with the arena (SPAWN_CLEAR 260→360; director 330→460;
  hazards 240→330; events 280→390) and obstacle count base/cap raised so bigger rooms
  aren't empty.
- **Base speed 304→330, pickup range 104→132** so traversal/vacuum keep pace. Dash
  kept absolute (1550/0.42) — now **21% of room width (was 29%)**, so it reads as a
  dodge, not a teleport.

On screen (desktop): player sprite ~72→41px wide; you now see ~39 player-widths across
(was 32). Verified: full headless suite + stress green (a brittle test that hardcoded
the old 304 base speed was made relative to `PLAYER.SPEED`); 0 console errors in real
Chromium desktop + mobile; screenshots confirm the roomy proportions.

Open for human eyes (the "full" option's retuning): does the bigger floor feel spacious
or too empty (enemy density is lower now — bump `DIRECTOR` budget / `CAPS.ENEMIES` if
sparse); are bullets/enemies readable at 0.82 desktop zoom (esp. colourblind shape-reads
— if small, nudge zoom to ~0.86 or bump `SHOT_R`); does mobile portrait show enough of
the bigger room (the rotate-to-landscape hint matters more now); boss arenas — more dodge
room may ease fights (watch TTK). Dials: `config.js` (ROOM, PLAYER.SPEED), `roomRoller.js`
(size rolls), `render/camera.js` (0.82), `render/sprites.js` (0.7 sprite scale).

## Grave Signal tempo + mobile-readability pass (player-directed, 2026-06-13 latest)

Player reviewed four ChatGPT prototypes and asked to pull the coolest bits into
*our* structure: faster Grave-Signal combat, dash aggression, Cathedral's
bullet-conversion, and a mobile-readability fix. Architecture untouched (one
arena, rerolls, drafts, bosses, hazards, two-thumb touch, tests, fx guards). The
rhythm/charge gun was explicitly **not** chosen — left out.

- **Faster, punchier shooting.** `FIRE_DELAY` 0.20 → 0.15; `SHOT_MULT` 0.78 →
  0.72 so total DPS rises only ~23% (basics die faster, bosses don't melt).
  `SHOT_SPEED` stays 860 (already inside the 835–900 target). Louder muzzle: a
  bright white pop + a wider 5-spark spray at the barrels.
- **Dash feeds the loop.** A dash that *cuts* an enemy zeroes `fireCd` (next shot
  fires the instant the dash ends). Every kill shaves `DASH_KILL_REFUND` (0.05s)
  off the dash cooldown (haloDrain still stacks more on close kills). Landing
  punctuation strengthened (bigger outer ring + crisp white inner snap + a small
  burst); dash afterimages live longer / run deeper during a dash. New `onDash`
  hook fired from `tryDash`.
- **Dash-bullet conversion (Cathedral / the picked feature).** Dashing *through*
  enemy fire flips the round into a small friendly shard aimed at the nearest
  enemy (owner→player, 0.6× dmg, retargeted). Gated on `dashT>0` only — hurt
  i-frames do NOT convert. Converted shots draw as a **diamond** and dash-primed
  shots as a **ringed circle**, so they read by SHAPE, not just colour
  (colourblind-safe).
- **Two new relics** — the only real gaps; the rest of the spec's "kinetic
  relics" list already existed (sidecarLances/rearArray = side/angled shots,
  splitWake/graveCharge = kill-splinters/death-burst, phaseDrill = pierce,
  hunterMycelia = homing, haloDrain = dash-cd-on-kill). **Redline Liturgy**
  (`redline`, tempo, ≤4) cycles guns ~10%/stack faster via `perks.fire`;
  **Kinetic Primer** (`kinetic`, tempo, ≤3) makes the next N volleys after a dash
  bigger + piercing (`DASH_PRIME_MULT` 1.5, +1 pierce). Player-facing names are
  placeholders — rename later **without** touching the IDs.
- **Quadratic camera trauma (Grave Signal).** Shake offset is `trauma²·GAIN`
  (`FX.SHAKE_GAIN` 30) instead of linear — tiny shot-shake stops buzzing, big
  hits still punch. Combat shakes rescaled to suit the curve (dash-cut 0.26,
  kill 0.18, boss 0.5).
- **Mobile readability (the stated gripe).** Old portrait camera shrank
  everything to 0.52 scale; now scale is adaptive to the smaller screen
  dimension (`clamp(min/560, 0.62, 0.92)`) — measured 0.52 → **0.70** on a 390px
  phone (sprites ~34% bigger). A subtle dash speed-zoom-out (to 0.95, damped)
  opens the room up when you dash. A "⟳ Rotate to landscape for a bigger view"
  hint shows only in portrait (lower-centre so it never covers the HUD). HUD font
  + off-screen threat triangles bumped on touch devices.
- **Already had it, didn't rebuild:** the "shoot suspicious objects" micro-secret
  loop (breakables — Moon Cache / Gambit Shrine / annex doors / cursed idols +
  cacheCompass) already covers spec #6; reinforcements already enter on a timer
  *or* when ≤2 remain (delay tightened to `[3.2, 5]`).

Machine-verified: 5 new headless checks (dash converts a bullet; hurt i-frames
do NOT; redline shortens the fire delay; a dash sets the primed flag; the primed
volley spawns bigger piercing shots) — all green alongside the existing suite.
12-round stress harness clean (13 rounds, ~7,900 frames, 0 exceptions). Real
Chromium: 0 console/page errors on desktop (1280×720) and mobile portrait /
landscape (390×844 / 844×390); portrait scale confirmed 0.70 and the rotate hint
shows only in portrait.

Open for human eyes: does 0.15 fire + the dash-prime/kill-refund loop feel like
Grave Signal in the hands without trivialising bosses (watch round 5/10/15/20
boss TTK); is the dash speed-zoom pleasant or swimmy on a phone; is the 0.6×
converted-shot payoff worth dashing into fire; are the Redline/Kinetic draft
weights (5/4) too tempting. Dials: `config.js` (PLAYER, `FX.SHAKE_GAIN`,
`DIRECTOR.REINFORCE_DELAY`), `render/camera.js` (scale band, zoom), and the two
relics in `data/items.js` + `systems/itemEffects.js`.

### Fastcombat fix pass (cross-review, 2026-06-13 latest)

A parallel ChatGPT build of the same brief flagged real issues in the first cut;
verified each against our code (measured) before fixing:

- **Dash didn't sweep — the headline bug.** The dash hit only at the *launch*
  point (within `DASH_HIT_RANGE` 156), but the dash *travels ~436px* (measured).
  An enemy 300px down the path took zero damage — it looked like a sawblade but
  only slapped whoever stood on the launch pad. Fixed: `performDashCut()` now runs
  at launch **and every frame during the dash** (`DASH_SWEEP_RANGE` 112), with a
  per-dash `Set` capping each enemy to **one hit**. Verified: an enemy 300px ahead
  now takes exactly one dash hit.
- **Dash could restart mid-dash.** `tryDash` only checked `dashCd`, and kill
  refunds (baseline + Halo Drain) can zero the cooldown *during* the 0.42s dash
  (the cd naturally decays to ~0.08 by dash-end anyway), letting you chain dashes
  into a near-untouchable blender. Guard added: `if (p.dashCd > 0 || p.dashT > 0)`.
- **Crowd fire-spike avoided.** The sweep's `fireCd = 0` is gated to **once per
  dash** (`_dashCutPrimed`), not once per enemy cut — so blender-dashing a pack
  doesn't become a 60fps fire hose (the side effect the ChatGPT build carried).
- **Bullet-conversion order.** Reordered to key off dash *state* before i-frames
  (`if (p.dashT>0) convert; else if (p.inv<=0) hurt`), so it survives any future
  i-frame retune instead of relying on `DASH_IFRAMES > DASH_DUR`.
- **Fire-rate floor.** `firePlayer` now `Math.max(0.075, …)`; both Redline *and*
  `rapid` pickups bump `perks.fire`, and there was no lower bound.

Machine-verified: 4 new headless checks (sweep cuts a 300px-ahead enemy; one hit
per enemy; no restart while dashing; cadence floored) — all green with the full
suite; stress clean; 0 console errors in real Chromium (desktop + mobile).

## Concept-sheet pass (player-shared ChatGPT concept art, 2026-06-13 late)

Took the *direction* from a 4-panel concept sheet (re-implemented as canvas
vectors, not imported):
- **Weapon → haunted blaster** (panel 2): chunky cylinder body with three glowing
  cyan chamber-windows, twin front barrels with lit muzzle tips, a top loop, a
  grip, and a tiny ghost emblem. Reads clearly as a cool gun by silhouette.
- **Slipstream movement trail** (panel 3 middle): a directional cyan speed-smear
  (3 fanned wedges) behind the player when moving fast; stronger during a dash.
- **Floor ripple** (panel 3 right): an expanding ground ring as dash punctuation —
  one at launch, a softer one on landing (new 'ring' particle kind).
Open: dash distance is now big (centre→wall in one dash) per "big & decisive" —
tune DASH_IMPULSE/DASH_DUR in config if it's too far. Slipstream strength is in
drawPlayer (sp>150 threshold, len/alpha).

## Combat-feel + platform + character pass (player feedback, 2026-06-13 eve)

- **Pulse bomb removed; dash is the centerpiece.** Gone: the player pulse meter,
  E/X/right-tap pulse, the on-Moots pulse halo. Dash is now long (impulse 1550,
  dur 0.42), glides committed (ignores steering mid-dash, eases out), invincible
  the whole dash (i-frames 0.46), and hits hard+wide (1.25× dmg, range 156).
  **Spacebar = dash, mouse = shoot** (Shift/RMB/flick also dash). The HUD meter
  by the hearts is now a dash-ready indicator. Pulse-tied bits repurposed: Halo
  Drain item → close kills refund dash cooldown; "Quicker Boots" shrine →
  −15% dash cd; care objects refresh the dash. (Note: the *pulse hazard* — the
  expanding-ring room hazard — is unrelated and stays.)
- **Platforms reworked to read as height** (was: flat 11px, "out of place").
  Now an extruded block: visible dark cliff face with striations, a biome-tinted
  walkable top with accent motes + lit rim, and **real stepped stairs** at the
  ramp. Lift raised to 34px; entities on top lift to match. Ledges no longer
  double-draw (the platform render owns the whole look).
- **Character emitter + aim.** The floating aim-line over his face is gone; shots
  now leave a little **double-barreled laser gun** held at body level (gunmetal
  receiver + glowing energy cell + sight fin + two barrels with lit muzzle tips,
  matching the twin-relay's two shots). Points where you aim, readable by SHAPE
  (the player is colourblind). Replaced an earlier stubby nub that, uh, read as a
  body part.
- **Captain label → threat tag:** a diamond marker + small dim affix label, so it
  reads "this one's dangerous," not "the enemy's name."
- **Dark-screen guard:** drawFrame now resets alpha/filter/blend/shadow each
  frame, so no leaked render state can dim a room.

## Enemy visual pass (player feedback, 2026-06-13 pm)

Replaced the geometric enemy primitives with characterful "haunted arcade
object-monster" sprites, adapted (re-implemented + scaled to our radii, not
copy-pasted) from the Boon Moots reference draw functions
(`reference/boon-moots/index.html` drawPewling/Censer/Lectern/LongCandle/
Antiphon/OxWarden/CrownSworn/Charger). Each type now has a distinct silhouette:
skitter=bug, gunner=smoking incense box, charger=streaked triangle, turret=
haunted book stand, brute=horned ox, sniper=flaring candle, hexer=ritual wheel,
myrmidon=crowned knight — all with glowing eyes. Behavior untouched; pure render.
Added a shape-agnostic white hit-flash and `oneRoomDebug.lineup()` for art
inspection. Verified the full row in real Chromium.

## Polish pass 2 (player feedback, 2026-06-13 pm)

- **Removed the mobile DASH/PULSE buttons.** Player preferred the bare
  two-thumb gestures (tap-to-pulse / flick-to-dash feel more natural). The
  surgical dash fix from pass 1 stays; buttons are gone. Easy to reinstate if a
  future tester wants them.
- **Pulse meter was secretly empty — fixed.** `#pulseFill` was a `<span>`
  (inline), so width/height never applied: the fill rendered at 0×0 and the bar
  has shown an empty track since Phase 0. Set both meter elements to
  `display:block`; the fill now actually fills as pulse charges, and "ready" is a
  bright cyan sheen instead of an expanding outline that read as "empty." The
  on-Moots halo (which was the only working pulse cue) stays.
- **Portal reworked.** The exit was a soft blurry gradient + star. Now: tight
  contained aura, rotating spokes (reads as a gate), crisp white double ring,
  a hot pulsing core, and sparks spiralling inward. Brighter, sharper, no muddy
  blur.

Room architecture shipped (Phase 8, see docs/room-architecture.md):
- **8a Floorplans** — partition walls carve real chambers (bisect / inner
  sanctum / spine corridor / quadrants); connectivity guaranteed by construction
  + flood-fill validated (≥250 rooms, zero unreachable portals).
- **8b/8c/8d Elevation + true high-ground** — raised platforms you climb via a
  ramp; ground shots can't hit raised enemies (blocked by the cliff), high
  enemies rain down; same-level dash/pulse/contact/hazard; auto-aim won't lock a
  target you can't reach. Director perches a sniper on the platform. Line-of-fire
  + interior-reachability proven headlessly; verified in-browser.

Open for the next human playtest: does high ground read intuitively in the hands
(the rule is taught only by the auto-aim filter + the sniper raining down — no
text); are platforms frequent enough / too frequent (~34% of eligible rooms);
do partitioned rooms ever feel cramped on a phone (portrait). Tuning in
src/data/floorplans.js (sizes/gaps), roomRoller maybeTier (tier rate/size).

## Visual verification pass (real Chromium, headless)

Performed with Playwright after Phase 7: zero page/console errors on desktop
(1280×720) and mobile (390×844, touch) loads; `selfTest()` ok on both (no
sub-44px tap targets, no overflow). Screenshots confirmed: title, round-1
combat with telegraphs, Shardreef volatile shards + whisper line, draft cards,
Graven Warden with boss bar + escorts, Crownworks with double active lane
beams + Starved Floor mutator + full companion build, mobile portrait layout
with danger triangles, death flow reached organically at round 17.

Two findings, both fixed:
1. **Off-screen portal had no pointer** → cleared rooms now draw a pulsing
   portal arrow + star at the screen edge (suppressed only by screen bounds,
   not by the Blind oath — finding the door isn't the oath's business).
2. **Bloom is the expensive draw** (confirmed: p95 50ms → 16.8ms without it
   under software rendering) → adaptive quality gate: if average frame time
   stays >24ms across 120 frames of play, `state.lowFx` flips (sticky for the
   session) — bloom off, particle budget halved. `selfTest()` reports it.

## Polish pass (player feedback, 2026-06-13)

From a real download-and-play session. All four shipped, verified headless
(75 checks) + in real Chromium desktop/mobile:

1. **Mobile dash fired on direction changes** — root cause was a re-trigger in
   `tickTouchDash` that dashed whenever the held stick moved fast. Now the left
   thumb only dashes on a deliberate slam from rest (`<0.55 → >0.82`); swinging
   a held stick to steer never dashes. Locked by a unit test.
2. **On-screen DASH/PULSE buttons** (touch devices only, bottom-right) — both
   for reliability and so the moves are discoverable. The pulse button glows
   when charged.
3. **Pulse was forgettable** — the meter now animates when full AND a breathing
   cyan halo appears on Moots (your eyes are on the character, not the HUD).
4. **Hazards kept firing after clear** ("undamageable enemies" = the hazards) —
   they now go fully inert the instant the room clears (no fire, no contact
   damage, no slow) and dim to 40% so it reads as powered-down. One guard at the
   top of `updateHazards`; in-flight shots were already wiped at clear. Locked
   by a before/after test.
5. **Dash felt non-obvious as an attack** — dash hits now throw a bright spark +
   ✦ mark + small flash so it's clear the dash cuts through. (Timings unchanged;
   the user confirmed those feel right.)

Confirmed not a bug: "Boon Moots" is intentional wordplay (Moon Boots anagram);
"The boon boots remain." is the canon death line from the parent game. Names
left exactly as-is.

## What needs human eyes (open items for the next playtest)

1. **The fun bars.** Phase 1's "60 seconds is fun" and Phase 2's "10 consecutive
   rooms feel distinct in the hands" are subjective — headless can only prove
   distinct *parameters*. Verify dash-weaving feel against Boon Moots directly
   (both run from this repo).
2. **Balance.** All knobs in `src/config.js`. Watch for: round 8–12 difficulty
   trough (full roster online but budgets still mid), pulse charge rate with
   haloDrain stacks, whether Starved Floor is hateable in a good way, Archon
   bullet density on mobile-size screens.
3. **Mobile feel.** The two-thumb system is a faithful v50 port but flick
   thresholds (speed > 620/860/920) deserve a real thumb check; also confirm
   the draft cards are comfortable on a 360px-wide screen.
4. **BGM mix.** The sequencer follows No Moon's architecture with our own chord
   voicings (the original chord table wasn't captured in the inventory — noted
   in `src/audio/bgm.js`). Check it against No Moon's mood by ear; the stress
   modulation (boss + low HP) should be audible but not annoying.
5. **Bloom cost on weak GPUs.** `ctx.filter: blur(11px)` on the composite is
   the one potentially expensive draw; if a device chugs, gate bloom on
   `view.mobile` or drop BLOOM.ALPHA.
6. **selfTest() in a real browser.** Run `oneRoomDebug.selfTest()` on desktop
   and phone: expect `ok: true` (all tap targets ≥44px) and frame p95 within
   budget (<8ms desktop / <14ms mobile).

## Tuning sheet (where the dials are)

`src/config.js`: PLAYER (all feel constants), DIRECTOR (budget slope `BASE +
round*PER_ROUND`, telegraph time, reinforcement window, stage divisor), COMBO,
SCORE, CAPS, ANNEX, BLOOM. Per-item numbers in `src/systems/itemEffects.js`;
hazard escalation in `src/data/hazardKits.js`; boss stats in
`src/systems/bosses.js` (BOSSES table).

## Known divergences from the parents (deliberate, documented in code)

- Charger dash speed uses No Moon's 450+18×stage (slower than Boon Moots' 910
  impulse) — `systems/enemies.js`.
- BGM chord voicings are ours; bass/arp/lead tables are No Moon's — `audio/bgm.js`.
- "Achievements-lite" rides on notices + bestiary + lifetime stats instead of a
  separate achievement table.
- Moon-debt currency stays out (No Moon ships it disabled); debt *ambushes*
  from cursed breakables are in.
