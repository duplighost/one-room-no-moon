# No Moon Systems Reference

Condensed inventory of every No Moon system the arcade game draws from. All line
anchors point into `reference/no-moon/game_inline.js` (71,771 lines) unless noted.
Anchors are correct as of this archive; grep nearby if a ref drifts. Compiled from
five deep-dive passes over the source; trust the numbers here first and the source
second only when behavior is ambiguous.

Top-level constants: `TAU` (line 34), `TOTAL_BIOMES = 10` (35), `MID_BOSS_LEVEL = 4`
(840), `FINAL_BOSS_LEVEL = 9` (841), `MAX_ENEMIES = 30/42` small/large screens (14094).

## 1. Enemies

Defined in `ENEMY_TYPES` (line 1024). Update loop / per-type AI: lines 8825–9121.
Firing helpers: `fireEnemyBurst` (5124), `fireEnemyRing` (5148).

| id | display | cost | hp | speed | r | wake | attack | cooldown | range |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| skitter | Pewling | 1 | 2.2 | 92 | 14 | 360 | melee only | — | — |
| gunner | Censer | 2 | 3.6 | 76 | 16 | 470 | burst 1–3, spread 0.18 | 0.9–1.55 | 760 |
| charger | Ramwraith | 2 | 4.4 | 90 | 18 | 430 | dash 450+18×danger | 1.7–2.6 | trigger <290 |
| turret | Lectern | 2 | 4.9 | 26 | 18 | 560 | ring 8–10 or burst 4–5 | 1.0–2.15 | 800 |
| brute | Ox-Warden | 3 | 8.1 | 62 | 24 | 460 | burst 5–6, spread 0.58 | 1.6–2.5 | 460 |
| sniper | Long Candle | 3 | 4.8 | 84 | 17 | 780 | single aimed 520+18/idx | 1.8–2.8 | 980 |
| hexer | Antiphon | 3 | 5.4 | 84 | 18 | 700 | ring 6–8 | 1.7–2.7 | 860 |
| myrmidon | Crown-Sworn | 4 | 7.4 | 88 | 21 | 620 | burst 3–5 + evasive hop | 1.0–1.85 | 680 |

AI flavor worth preserving (lines 8906–9024): skitter sine-wiggles and grows bolder
when you're firing, calmer when you stand still; gunner strafes a 210–320px band;
charger has a 0.55s windup state then a 0.42s dash with frame-rate-safe decay;
turret alternates ring/burst (45% ring past danger 2); sniper kites a 380–720px band
and has a visible aim state ("perch" telegraph machine at 8854+); hexer orbits and
sprays rings; myrmidon orbits, bursts, and back-hops (impulse −170) when crowded at
<260px with a 1.6s hop cd. Velocity damping factor per type ≈5–8 (skitter highest).

Shared mechanics: wake system (sleep until player < wakeRadius; sleeping alpha 0.72)
(4322, 8851); separation push between live enemies, overlap force ×140 (9089–9111);
contact damage 1 + mutual knockback (9113–9120); hurt flash 0.14–0.18s decay (8834);
slow system `slowTimer`/`slowMul` floor 0.42 (4589, 8836–8840).

**Scaling** (1010–1018): non-boss `hp × (1 + idx*0.13 + stage*0.08)`, `speed × (1 +
idx*0.02 + stage*0.02)`. Boss `hp × (1 + idx*0.08 + stage*0.06)`. Danger stage by
biome index: 0–1→0, 2–3→1, 4–5→2, 6–7→3, 8→4, 9→5 (973–980).

**Spawn director** (4269–4397): allowed types unlock by biome index (0: skitter w8,
gunner w5; 1+: charger w3, turret w3; 2+: brute w2+0.6idx; 4+: sniper w3+0.2idx; 6+:
hexer w3+0.2idx; 7+: myrmidon w2+0.18idx; 8+: extra charger/turret/sniper w2).
Weighted pick filtered by remaining cost budget. 2–3 clusters per room; per-cluster
budget `2 + floor(idx*0.85) + stage + rand(0,2)`. Spawn placement: 60 attempts,
20–120px from cluster center, never inside obstacles (4347–4358).

**Recipes** (19896–19968): swarm (5–7 skitter ± gunner), gunline (gunner+turret,
+sniper idx≥5, +skitter screen), bite (chargers + skitters + brute), anchor (1 tank +
1–3 escorts), sniperGallery (perched snipers + turret), hex (hexer+turret ± myrmidon),
debt (purple-tinted mixed, from cursed breakables).

**Captains / elite affixes** (defs 14458–14464, promotion 14798–14826):

| id | title | hosts | hp× | spd× | on death |
| --- | --- | --- | --- | --- | --- |
| bell_fed | Bell-Fed | skitter, charger | 1.35 | 1.16 | spawns 1 debt minion |
| ash_drunk | Ash-Drunk | gunner, brute | 1.38 | 0.94 | pulse hazard r64 |
| perched_witness | Perched Witness | sniper, turret | 1.30 | 0.88 | — |
| doorbreaker | Doorbreaker | charger, brute | 1.48 | 1.08 | — |
| saintless | Saintless | hexer, myrmidon | 1.42 | 1.00 | slow fog r96 |

Promotion: one eligible living non-boss per room; chance 2% (biome 0–1), 7% (2–4),
11% (5–7), 14% (8+); +4% cache/breach rooms, +3.5% listening floor, +3.5% hunger
oath. Captain gets affix color, forced awake, floating title at −r×1.82.

## 2. Bosses

In-route bosses (the two to port as full fights):

**Graven Warden** — biome 4, crossroads arena. Spawn hp 76, r 44, speed 82, color
#ffe27d (init 4379–4386; AI 9025–9055). Phases by HP: >75% base patterns; <75%
summon wave 1 (skitter+gunner, phase-lock 0.7s); <46% summon wave 2 (charger+brute,
0.82s). Burst 4–5 / spread 0.74–0.92 / speed 266+10idx / cd 1.12–1.46; ring 10–12 /
202+8idx / cd 2.45–3.18 rotating offset. Holds fire if enemy bullets > 108 (sanity
cap). Summons placed on a 34–110px ring, 40 attempts (message + ring visual).

**Null Archon** — biome 9, ring arena. Spawn hp 126, r 54, speed 88, color #f5d9ff
(init 4388–4396; AI 9056–9087). Summons at <82% (charger+sniper), <58%
(hexer+myrmidon), <34% (brute+sniper+hexer). Burst 7–9 / spread 1.05–1.4 / 310+14idx
/ cd 0.72–1.0; ring 14–18 / 235+12idx / cd 1.22–1.7; dash-evades (impulse 240 at
±0.82 rad) when player < 540px, cd 2.6. No fire cap; phase 4 (<34%) tightens rates.

Boss cards exist for more (41229–41235): falseMoon, nightFerry, spiggot, sun (+
drowned-sun, first-walker as webp assets). Night Ferry (~41208+) and Drowned Sun
(~46815+) are branch-route encounters that unlock Vesper/Nadir — out of scope v1,
but the card art in `reference/assets/bosses/` is usable for arcade boss intros.
False Moon and Spiggot have no in-route implementation here; the arcade builds them
fresh as minibosses (design doc §4).

## 3. Biomes, hazards, room generation

**Biome defs** 406–828; biome→mechanic/hazard/enemy-bias map 844–866. 21 biomes in
six tiers (4 early / 4 mid / 4 late / 4 abyss / 4 zenith / 2 final — see design doc
table). Each: id, tier, name, palette (top, bottom, accent, accent2, accent3, deep,
dim, shot), `features` + `extras` (decoration pattern names), `layouts`,
`ambientModes`, `obstacleStyles` (e.g. rootStone, glassNode, slagHeart, basilicaIdol,
archivePillar, machineHub, mycoCap, kilnPillar — styles 3211–3223), `boundary`.

Biome → hazard → enemy bias (844–866):

| biome | hazard | bias | | biome | hazard | bias |
| --- | --- | --- | --- | --- | --- | --- |
| verdigris | snare | charger, skitter | | noctlith | sightline | sniper, hexer |
| fen | fog | gunner, sniper | | frostreliquary | shard | sniper, turret |
| mirror | shard | sniper, turret | | stormloom | lane | turret, hexer |
| rosewire | thorn | skitter, charger | | umbraharvest | thorn | charger, myrmidon |
| ember | pulse | brute, charger | | auricspire | ritual | hexer, sniper |
| mycelium | spore | hexer, skitter | | blacksungarden | thorn | skitter, myrmidon |
| shardreef | volatile | sniper, gunner | | solarium | pulse | brute, sniper |
| coilroot | lane | turret, hexer | | crownworks | lane | turret, hexer |
| archive | sightline | sniper, turret | | empyrean | ritual | hexer, myrmidon |
| basilica | ritual | hexer, myrmidon | | nullthrone | ritual | sniper, hexer, myrmidon |
| forge | pulse | brute, turret | | ossuary | thorn | brute, myrmidon |

**Hazard mechanics** (add fns 9832–9885, update loop 10413–10468):
- fog: slow field 0.72×, drifts, r 110–190; snare: slow 0.58 + 1 dmg inside 0.34r
  (hitCd 1.4s); spore: slow 0.66 + dmg inside 0.46r, may spit a homing-ish shot;
  lotus: slows *enemies only* (marrowSpring's gift).
- pulse: cycle interval 2.0–3.2s, active window 0.42s, r 62–92, 1 dmg on the
  expanding ring; ritual: bigger (r 70–128), slower (2.8–4.0s), basilica-flavored.
- lane: vertical/horizontal strip width 34–52, telegraph then 0.5s active out of a
  2.5–3.6s cycle, 1 dmg.
- volatile shards: breakable obstacles, on break 1 dmg to player in radius and
  0.85× player-dmg chain to enemies, radius ≈ 92 + 1.2r (9887) — chain reactions.
- sightline/thorn are partly *grammar* (enemy bias + cover geometry + breakable
  ambush odds) rather than standalone objects — port them as room-roller behavior.

**Room generation pipeline** (the part the arcade reuses per-round, not per-floor):
sizes 980–1160 × 720–860 normal, boss 1280+ × 880+ (8257); wall inset 72. Obstacles:
`4 + floor(idx*0.25) + depth + rand(0,2)` circles/rects r 26–78, biome-styled;
breakable 38% normal / 55% cache rooms, hp 7+2idx, hidden item odds per species
(8040–8111). Layout placement via `findThemedSpot` modes lanesH/lanesV/courtyard/
crossroads/spine/edges/pockets (+ring fallback) (3120–3205). Sealed annexes 0–2 per
room: wall pocket 88–132 deep behind a secret door, ambush or bonus inside
(3294–3404). Cache altar: breakable r38–46, hp 10+2.4idx, reward + hidden item +
ambush chance 54–70% (9909–9960). Ambient particles `18 + 3idx + 2depth` with
per-mode physics (rain falls 220–340, embers rise, petals spin) (8113–8158); 2–4
slow "veil" overlays (mist/scan/arc) (8142–8158). Background baked once to canvas:
gradient + decoration patterns (8440–8490). Clear = `enemies.length === 0` (8225,
checked 9127); doors unlock on clear (7836–7839) — arcade replaces doors with the
portal.

## 4. Decoration patterns (the background vocabulary)

All bake into the background canvas at room build (3831–4260). 34 patterns; each
uses biome accents with rolled alpha/rotation. One-liners:

gridSoft (soft grid + glyph marks 3831) · vines (95 wandering strokes 3855) ·
plinths (circled rings 3861) · pools (striped ellipses 3878) · reeds (210 vertical
strokes 3888) · mudRings (84 tan rings 3901) · fogBanks (34 glow ellipses 3911) ·
lilyLights (130 dots 3917) · glassShards (90 polygons 3926) · reflections (140
horizontal glints 3940) · cracks (110 wander strokes 3953) · petals (260 tiny
ellipses 3959) · braids (72 paired waves 3965) · arches (28 arch outlines 3984) ·
embers (180 dots 4003) · fans (40 arc bundles 4012) · kilnRings (42 rings 4028) ·
ashWaves (70 sine strokes 4038) · hyphae (95 branching paths 4054) · caps (80
mushroom caps 4078) · sporeRings (100 tiny rings 4096) · glowDots (180 glow dots
4106) · hexes (72 hex outlines 4115) · circuits (86 L-paths + node dots 4124) ·
roots (52 thick/thin strokes 4147) · monoliths (34 rounded slabs 4154) · rings (48
circles 4169) · orbits (36 partial arcs + dots 4179) · stacks (46 layered slabs
4197) · glyphs (120 cross/star marks 4212) · bones (38 curved bone lines 4218) ·
halos (30 big rings 4242) · stars (180 star polys 4254).

Port these nearly verbatim — they are cheap, they bake once, and they are most of
why biomes read as places.

## 5. Items, draft, economy

**ITEM_POOL** (1100–1380), 28 items. Draft = 3 cards, weight × (1 + 0.12×min(3,
stacks)), items at maxStacks leave the pool (2145–2178); grant logic 2274–2315.
In No Moon drafts fire per biome clear; the arcade drafts every round.

| id | name | w | max | effect (impl anchor) |
| --- | --- | --- | --- | --- |
| ricochet | Prism Teeth | 4 | — | +wall bounces per stack (5029) |
| splitWake | Split Wake | 4 | — | kills burst a shot-fan (5031) |
| orbitalHalo | Orbital Halo | 5 | — | orbiting ward damages + eats bullets (4776) |
| rearArray | Rear Array | 4 | — | rear shots per volley (4697–4717) |
| graveCharge | Grave Charge | 6 | — | enemies explode on death |
| hunterMycelia | Hunter Mycelia | 6 | — | homing turn 4.4+1.45/st (5036) |
| phaseDrill | Phase Drill | 6 | — | +pierce per stack (5030) |
| sidecarLances | Sidecar Lances | 3 | — | lateral side-shots (4717) |
| staticLink | Arc Rosary | 5 | — | chain dmg 0.32+0.09/st (4633) |
| cryoRime | Gravemire Liturgy | 5 | — | slow on hit 0.75+0.2s, mul 1−0.16/st floor 0.42 |
| scavengerDrone | Lantern Pup | 4 | — | autofire pup, cd 0.62−0.05/st (4840) |
| emberMine | Ember Mine | 4 | — | movement lays mines (4849) |
| spiteCore | Spite Core | 4 | — | radial burst when hit |
| shrapnelChamber | Shrapnel Chamber | 3 | — | impacts fragment (5032) |
| echoChamber | Echo Chamber | 4 | 3 | spectral repeat volley (4740, 11718) |
| cacheCompass | Hush Compass | 4 | 3 | secret sense range (8797) |
| gravityWell | Covetmark | 4 | — | pickup magnet (5424) |
| hullScripture | Hull Scripture | 3 | 3 | +1 max integrity (1051) |
| bloodTithe | Blood Tithe | 4 | — | heal every N kills (10295) |
| sutureEngine | Hull Suture | 3 | 3 | chance heal on wounded clear (10213) |
| lunarCaliber | Lunar Caliber | 5 | — | bigger, harder shots (10265) |
| blackLotus | Black Lotus | 4 | — | slow bloom on clear r120+20/st (10206) |
| aegisLattice | Aegis Lattice | 3 | 2 | +shield charge, regen 10s idle (2996) |
| siphonVane | Siphon Vane | 4 | 4 | kills can drop repair (10305) |
| executionBloom | Execution Bloom | 4 | 4 | bonus dmg vs wounded (10312) |
| moonShard | Moon Shard | 4 | 4 | crit chance (10271) |
| riftCapacitor | Rift Capacitor | 3 | 3 | +1 integrity per N clears (10225) |

(28th slot: weights vary per build; treat table as canonical list, source as truth
for any effect detail.)

**Pickups/rewards** (1037–1091): repair (+2 hp), heart (+1 max), marrow (+1 max,
+2 hp), amp (+15% dmg perk), rapid (+10% fire), frame (+8% speed). Magnet pull via
gravityWell stacks. Moon Splinters = meta currency dropped by breakables (14501).

**Breakable species** (defs 14440–14448, weights 14580–14603, break handling
14678–14714): marrowJar (25% repair), bellHusk (wakes room, 35% pulse hazard, 55%
splinters), blackGlass (5–7 shard bullets), rootCyst (55% snare fog, 30% debt
ambush — 55% under hunger oath), archiveLockbox (25% module, 30% lane hazard),
falseIdol (55% module + 1–2 debt ambush + 55% pulse — the cursed bargain),
moonseedUrn (splinters + secret hint). Per-biome weight bumps (e.g. mirror/frost
+18 blackGlass; basilica/ossuary +7 falseIdol). Count/room: 1 base +1 idx≥3 @42%
+1 depth≥3 @34%, mobile cap 3.

**Breach/special rooms** (11994–12379): moonCache (safe, module+reward), gambitShrine
(altar roll: 28% jackpot 2 modules / 30% debt spawns / 20% curse hazard+module / 22%
mercy heals — 12320–12359), ambushNest (budget+, snare fogs, reward), marrowSpring
(lotus fog + ritual pulse + marrow), mirrorVault (3 volatile shards + lane guard 2
rewards), blackMarket (ritual+lane pressure, 1–2 modules). Early rooms bias safe,
late rooms bias unsafe (12002–12012).

## 6. Player model (for parity)

Characters 222–291 (+visual kits 294–403). Moots: hp 6, speed 264, dmg 0.88, delay
0.20, weapon twin, accent #f3dcff, silhouette cross-laced, icon ⇄; unlocked by first
route win (2087); Boon Reroll system 40743–40784 (charge per room clears, reroll
draft → loose cores → mutate owned graft, cd 0.55s, HUD chip with LACING counter).
Weapons (5045–5122): shotgun 5×0.68 @840; needle 1×0.72 @980 pierce 1; twin 2×0.78
@860 ±7px; spore 2×0.70 @590 homing turn 5.5. Movement config (8698–8742):
MOVE_ACCEL 17.5, STOP_DECEL 24, TURN_ACCEL_BONUS 14, LATERAL_DAMP 7, max ×1.035,
snap-stop <8. Damage intake (4951–4962, 10773–10797): shield absorbs first
(i-frames 0.36 on shield, 0.52–0.9 on hull), shield reknits after 10s clean.
Perk scaling: dmg ×(1+0.15n), fire ×0.9^n, speed ×(1+0.08n) (2991–2993).

## 7. Engine notes (what the new engine reproduces)

- Loop: rAF, dt clamp 1–33ms (9410–9417); slow-mo `startSlowMo(dur, scale)` quad
  easing, worldDt = dt × scale (2343–2352, 5606–5608); update order 5605–5657.
- Render order 7731–7804: baked background → veils → walls → ambient → telegraphs →
  shadows → y-sorted entities → glow field → bullets → particles → bloom → tint/
  vignette/border → HUD → flash → transition. Bloom: half-res canvas, `screen`
  blend, alpha 0.20, `blur(11px) saturate(1.16)` (3786–3795).
- Camera 5546–5588: damp λ8.8 follow, aim-lead 58px + vel×0.09, kick decay λ17,
  shake decay 26/s applied in worldToScreen (7602).
- Particles: plain array, kinds dot/streak/glow/ring/beam (7562–7599), soft cap ~
  120–240 with FIFO eviction and mobile ~50 (12888–12919).
- Audio: lazy AudioContext, master 0.24 (1785–1801); `playToneBurst` osc+lowpass+
  envelope, `playNoiseBurst` noise buffer+bandpass (1812–1858); BGM sequencer 86
  BPM, 280ms lookahead/82ms timer, kick/snare/bass/arp/lead/chords, stress = route
  tension + 0.32 boss + 0.18 low-hp modulating filters/gains/density (1460–1637);
  EQ + limiter chain (1687–1724). Mute key `noMoonSfxMute_v1` (1742–1772).
- Input: WASD/arrows; mouse aim + hold fire; two-thumb touch pads split at half
  width (2883–2931); draft accepts number keys.
- Save: `noMoonSave_v1` JSON (shape at 1999–2021): lifetime stats, achievements,
  victories, unlocks, discoveredItems, defeatedBosses. `?fresh=1` wipe (2426–2463).
  Service worker intentionally removed (2395–2420) — do not add one.

## 8. Corrections & vestigial systems (read before porting)

1. **Moon debt is shipped disabled** in No Moon (`addMoonDebt` stubbed ~14525) —
   debt *ambushes* from breakables are live, the debt *currency* is not. The arcade
   keeps the ambushes, skips the currency.
2. **Floor moods** (14450–14456) exist mostly as flavor + breakable-weight nudges;
   they're our mutator seed, not a complete system to port.
3. Only **Warden and Archon** are in-route bosses; the other six boss cards belong
   to branch/legacy content. Don't go hunting for a False Moon implementation in
   this file — build it fresh.
4. The **oath system** applies its modifiers in scattered call sites; port oaths as
   clean flags read by the roller/director, not by copying call sites.
5. `no-moon/index.html` line N ≈ `game_inline.js` line N−1045 (script starts at
   1046); all anchors here are game_inline.js lines already.
