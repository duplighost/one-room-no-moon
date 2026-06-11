# One Room No Moon — Game Design

The complete design. Numbers here are starting values, expected to move during the
Phase 7 balance pass; structures are commitments.

## 1. Fantasy & frame

No Moon's descent compressed into a single chamber. The room is the antagonist: it
keeps re-dressing itself in every biome the descent ever had, hoping one of them
finally takes. Moots — boots, sprite, bad attitude toward porchlights — is stuck in
it. The title screen line sets the contract: the room reloads; Moots answers.

Win = clear Round 20 (the Null Archon). The route then tears open into **Overdrive**
(endless, score chase, ∞ shown next to the round counter, like Boon Moots room 14+).

## 2. The round loop

```
TRANSITION (1.2s splash: biome name + mechanic tag + round number)
  → ROOM LIVE (waves spawn; fight; hazards tick; event object available)
  → CLEAR (last enemy dies: bullets wiped, tally floats, sparks vacuum, portal opens)
  → PORTAL (walk in; this is the only "menu": draft 3 cards, boon-reroll if charged)
  → pick → TRANSITION → next round
```

- No modal interrupts the fight. The draft happens only at the portal (Boon Moots'
  pattern, `reference/boon-moots/index.html:899-926` portal/clear flow). Standing in
  the cleared room to vacuum pickups / break remaining pots / touch the event object
  is allowed and encouraged.
- Death → one screen: score, round, best, two big buttons (**Run it back**, Shrine)
  plus codex link. Restart must be one input from death (arcade law).
- A run seeds a `mulberry32` RNG (Boon Moots `index.html:77-78`); all generation
  flows from it. This gives us replayable dailies for free.

## 3. The Room Roller (the heart)

Every round the roller deals one card from each axis. Axes are independent shuffled
bags ("no-repeat dealer"): each bag reshuffles when empty and refuses to repeat its
last 1–2 deals. Consecutive rooms therefore never share biome, layout, or recipe.

### Axis 1 — Biome (skin + mechanics)
All 21 No Moon biomes, tier-banded by round (No Moon's `BIOME_ROUTE_BANDS` idea,
`game_inline.js:839`):

| Rounds | Band | Biomes in bag |
| --- | --- | --- |
| 1–4 | early | verdigris, fen, mirror, rosewire |
| 5–8 | mid | ember, mycelium, shardreef, coilroot |
| 9–12 | late | archive, basilica, forge, ossuary |
| 13–16 | abyss | noctlith, frostreliquary, stormloom, umbraharvest |
| 17–19 | zenith | auricspire, blacksungarden, solarium, crownworks |
| 20 | final | empyrean or nullthrone (Archon arena) |
| 21+ (Overdrive) | all | full 21-biome bag, danger keeps climbing |

A biome contributes: palette (top/bottom/accents/deep/dim/shot), 2 decoration
patterns from its features + 1 from extras (catalog in `docs/no-moon-systems.md` §4),
ambient particle mode, obstacle visual style, boundary style, its hazard type, and
its enemy bias pair. All data ports from `game_inline.js:406-866`.

### Axis 2 — Layout (the bones)
Eight parameterized generators (No Moon's layout modes + Boon Moots'
`noMoonObstacleSpot`, `index.html:373-399`): **courtyard, ring, lanesH, lanesV,
crossroads, spine, pockets, edges**, plus **scatter** as the bag's joker. Each
generator takes parameters rolled per room — count, jitter, rotation, density,
asymmetry bias, mirror flag — so two "ring" rooms differ in pillar count, radius,
gap placement, and which arc is missing. Obstacles are circles + rounded rects
(both games' collision model); 55%-ish rolled as rect, sizes per No Moon
(`game_inline.js:8045-8099`).

Anti-boring rules (each a direct fix to an autopsy finding):
1. Generators must consume ≥4 random parameters (never a fixed stamp).
2. 30% of rooms add a **sealed annex** (No Moon's hidden side-pocket, `game_inline.js:3294-3404`) holding a secret or an ambush — the one-room version of secret rooms.
3. 1–3 obstacles per room are **breakables** with species rolled from the No Moon table (§5 below); shardreef/mirror/frost rooms swap some for **volatile shards** that chain-react (`game_inline.js:9887`).
4. Layout density scales with round and with the recipe (gunline wants cover; swarm wants open floor) — the roller cross-checks axes instead of rolling blind.

### Axis 3 — Hazard kit
The biome's hazard type spawns as a kit whose count/intensity scale with danger
stage: snare, fog, spore (slow clouds; some shoot), shard/volatile (turret-glass),
thorn (ambush spitters), pulse/ritual (expanding timed rings), lane (telegraphed
beams), sightline (long-candle pressure + cover geometry). Mechanics ported from
Boon Moots' compact implementations (`index.html:690-714`) upgraded with No Moon's
parameters (`docs/no-moon-systems.md` §3). Escalation: interval −, radius +, count +
with danger stage — hazards in round 15 are not hazards from round 3.

### Axis 4 — Spawn recipe + waves
No Moon's encounter grammar (`game_inline.js:19896-19968`) drives composition:
**swarm, gunline, bite, anchor, sniperGallery, hex, debt** — filtered by biome
enemy-bias and by the round's allowed-types table. Delivery is staged waves
(bellroom's best idea): initial wave ~70% of budget, reinforcement at ~6s or when
2 enemies remain (whichever first), late spike wave past round 6. Budget =
`5 + round*1.3 + dangerStage`, capped by `MAX_ENEMIES` 22 mobile / 32 desktop.
Spawns telegraph: 0.5s warning glyph at the spawn point before the enemy exists
(fairness; nothing materializes inside the player).

### Axis 5 — Room event (the spice slot)
~45% of non-boss rooms roll one event, weighted by depth and mood (No Moon breach
flavors reframed in-room, `game_inline.js:11994-12379`):

| Event | In-room form |
| --- | --- |
| Moon Cache | safe altar pot: break → module core + reward |
| Gambit Shrine | altar with the 28/30/20/22 jackpot/debt/curse/mercy roll |
| Black Market | mid-fight reliquary: costs 1 integrity, pays 1–2 module cores |
| Ambush Nest | extra budget, snare fogs, +reward on clear |
| Marrow Spring | lotus fog (slows enemies only) + marrow reward |
| Mirror Vault | volatile shards + lane hazard guarding 2 rewards |
| Care objects | Boon Moots' lamp/bench/umbrella/pie — touch once: heal + shield + pulse (`index.html:895-897`) |

### Axis 6 — Mutator (rare, loud)
10% of rooms ≥5, announced on the transition splash in the mechanic-tag slot. First
set: **Broken Floor** (+breakables, +falseIdol weight), **Listening Floor** (+1
sniper, sightlines everywhere), **Generous Floor** (+drops, +ambush appetite),
**Starved Floor** (no repair drops, +score ×1.25), **Bell-Fed** (all elites twice,
elite captains guaranteed), **Low Ceiling** (room 15% smaller), **Doubles** (recipe
dealt twice, budget split). Floor-mood names/flavor from `game_inline.js:14450-14456`.

### Axis 7 — Captains (elites)
No Moon's 5 captain affixes (`game_inline.js:14458-14464`): bell_fed, ash_drunk,
perched_witness, doorbreaker, saintless — stat mults, title floated over the enemy,
on-death effects (debt minion / pulse hazard / slow fog). Promotion chance by danger
stage (2% → 14%), +bonus in event rooms and Bell-Fed mutator rooms.

## 4. Rooms-as-rounds difficulty spine

Danger stage = `floor(round/4)` capped 5 in route, uncapped slope in Overdrive.
Enemy HP/speed scaling uses No Moon's formulas (`hp × (1 + idx*0.13 + stage*0.08)`),
where `idx` maps from round. Allowed-types unlock: skitter+gunner from R1, charger+
turret R2, brute R4, sniper R6, hexer R8, myrmidon R10 (compressed from No Moon's
biome-index table to fit a 20-round route).

**Boss cadence:** R5 False Moon (miniboss), R10 **Graven Warden** (full No Moon
boss: phases at 75%/46%, summons, ring+burst patterns, `game_inline.js:9025-9055`),
R15 Spiggot (miniboss), R20 **Null Archon** (phases 82/58/34%, dash evasion, 3
summon waves, `game_inline.js:9056-9087`). Boss rooms force layout=ring or
crossroads, suppress events/mutators, ×3 boon progress on clear. Minibosses are
new minimal implementations using the boss template at ~40% HP with one signature
pattern each (False Moon: mirror-aim volleys; Spiggot: spore ring + skitter brood).
Overdrive: boss every 5th round, cycling all four, stats on the climbing curve.

## 5. Moots — the player kit

Sprite-based (the extracted `reference/assets/boon-moots-sprite.webp`), drawn 72×106
with aim indicator line, afterimages, shadow (`index.html:1391-1419`).

| Verb | Spec (source) |
| --- | --- |
| **Shoot** | Twin-relay: 2 shots, ±7px perpendicular offset, 860 px/s, 0.78× dmg each, 0.20s delay (No Moon moots, `game_inline.js:279-291` + weapon spec §2 of systems doc). Mouse / right-thumb / auto-aim assist (nearest enemy within 620px) like Boon Moots `index.html:529-548`. |
| **Spin-dash** | 1325 px/s impulse, 0.295s, i-frames 0.36s, cd 0.43s, spin animation + afterimages + close-range dash damage (`index.html:645-654`). Keyboard Shift/Space, gamepad B, touch flick (move-pad shove or aim-pad flick, the full v50 flick detection `index.html:579-591`). |
| **Pulse** | Meter 0–100, charged by kills/sparks/standing still bonus; at full: clears enemy bullets, radial 2.2× dmg in 305px, slow-mo 0.42s, big shake (`index.html:669-676`). Key E/X, right-tap on touch. |
| **Boon Reroll** | Earned charge (1 per 2 clears, ×3 on boss); during draft re-deals the 3 cards; outside draft re-rolls loose module cores on the floor (No Moon Moots ability, `game_inline.js:40743-40784`). HUD chip shows LACING n/m progress. |

Health: 6 integrity, i-frames 0.92s on hit, knockback, shield rings drawn around the
sprite. Movement: Boon Moots' damped twin-accel model with lateral damping and brake
particles (`index.html:612-643`) — this exact feel is the Phase 1 acceptance bar.

## 6. Draft & items

Draft of 3 at every portal (Boon Moots cadence — every round, not No Moon's
per-biome). Pool = No Moon's 28 items ported whole (full table with effects, weights,
max stacks: `docs/no-moon-systems.md` §5) **plus** 4 converted Boon Moots exclusives:
**Gigi Management** (orbiting cat that makes calls = scavengerDrone variant with cat
art), **Echo Wall** (wall-bounce, merges into ricochet), **Halo Drain** (close kills
overfill the pulse meter), **Helpful Furniture** (+care object odds, +1 max HP).
Weights: No Moon's base weight × (1 + 0.12×stacks) familiarity bump; items at max
stacks leave the pool. Pickups: sparks (score+pulse+meta currency), repair, heart
(max+1), marrow (max+1 and +2), amp/rapid/frame perks — No Moon reward table
(`game_inline.js:1037-1091`).

## 7. Scoring

```
kill        = enemyScore × combo × (overdrive? 1.35 : 1)
combo       = +0.14/kill (+0.9 boss), decays after 2.6s, cap ×12
streaks     = 0.8s window kill chains float names (DOUBLE BOOT … UNSTOPPABLE PASSENGER)
clear bonus = (300 + round×82) × combo
no-hit room = +400 × combo  (+ "Clean room. Nothing brags." notice once)
speed bonus = max(0, 900 − clearSeconds×20) on rounds ≥3
sparks      = +18 × combo each, also bank to meta
```
Sources: Boon Moots kill/clear economy (`index.html:863-919`) + prototype speed
bonus. Persist bestScore, bestRound, and daily best per seed-date.

## 8. Meta (small, arcade-honest)

- **Shrine** (sparks): Stubborn Heart +1 HP, Restless Soles +speed, Louder Quiet +pulse radius, Spark Magnet +pickup, Headstart (start R2 with 1 draft). Boon Moots' shrine verbatim (`index.html:186-192`) — cheap, finite, no infinite treadmill.
- **Codex**: bestiary with kill counts (every enemy/boss), notices collection (clear-lines and behavior notices the player has earned), run stats, favorite graft.
- **Behavior notices** carried over: the room reacts to how you play — low-HP mercy line, standing-still line, dash-mastery line, no-hit line (`index.html:153-162`). These are the personality layer; implement early, they're cheap.
- **Daily**: same seed for everyone per UTC date, separate best-score line. No server; it's just `hash(dateString)`.
- **Oaths** (post-route unlock, pre-run toggle): Glass (+25% dmg, −2 max HP), Hunger (more forbidden breakables + debt), Blind (no off-screen danger triangles, +secret odds). Adapted from `game_inline.js:14434-14437`.

## 9. Presentation

- Canvas 2D + half-res bloom composite (`screen` blend, blur 11px, alpha 0.2 — No Moon's recipe), vignette, biome-tinted radial overlay, frame border.
- Camera: damped follow with aim-lead, kick on dash/hit, decaying shake. Room is
  larger than the viewport on phones (Boon Moots viewScale 0.52 portrait) and
  near-fit on desktop.
- Transition: Boon Moots' three-beat fade (out 28% / name card 44% / in 28%,
  `index.html:928-948`) showing biome name, mechanic tag, round number.
- Background is **baked once per room** to an offscreen canvas (No Moon
  `createBackground`, `game_inline.js:8440-8490`): gradient + decoration patterns;
  per-frame cost stays flat no matter how ornate the biome.
- Audio: WebAudio synth SFX (Boon Moots recipes first: shot/dash/kill/hurt/pulse/
  clear/care, `index.html:552-561`), then No Moon's 86 BPM stress-responsive BGM
  sequencer in Phase 6 (kick/snare/bass/arp/lead/chords, stress = danger + boss +
  low HP, `game_inline.js:1460-1637`).
- HUD: top chip (biome · round · ♥ hearts · shield), score + combo chip, pulse bar,
  boon chip, build chips along the bottom (graft icons + stack counts), boss bar,
  off-screen danger triangles, toast lane that never covers the player.

## 10. Voice guide (the "with teeth" clause)

The register, from the real games: concrete object + deadpan verdict + kindness
hidden under the joke. Real examples to keep as calibration (and to reuse
literally where they fit):
- "The moon was hiding behind a worse moon."
- "The bench heals you like a dad holding a flashlight."
- "You stop moving. The room stops lying."
- "A pie waits on the sill. Useless. Perfect."

Rules:
1. Every line is about a *thing in the room* or *what the player just did*. No abstract menace.
2. No body-horror grab-bag ("coughing teeth", "the invoice has teeth" spam) — the autopsy showed the teeth motif was placeholder-itis. One tooth joke per game, max, and only if it lands.
3. Lines may be kind. The games are kind. ("Some objects help without glowing first.")
4. Reuse the actual Boon Moots clear-lines pool and notice system as the base; write new lines only for new systems (mutators, events, bosses), matched to the four examples above.
5. Boss names stay in the established register: "Graven Warden", "Null Archon", "False Moon", "Spiggot" — never invent grimdark.

## 11. Out of scope (v1)

Multiple playable characters (Moots only; the roster can come later since the data
model supports it), No Moon's multi-room floors/minimap, moon-debt economy (No Moon
itself shipped it disabled), branch bosses (Night Ferry, Drowned Sun) beyond codex
cameos, service worker/PWA, server anything.
