# Playtest Notes

## What is machine-verified (every commit)

`node tests/headless.mjs` — 69 checks, 5/5 stability runs at time of writing:
boot → play → clear → portal → draft → transition → death; all four boss brains
including Warden/Archon phase summons; route win → Overdrive round 21+; item
hooks (bounce/pierce/homing on spawn, stack caps, overflow→repair); companions
ticking; event rolls (~45% + pity) and variety; mutator rolls (~10%, never on
boss rounds); shrine purchase/application; headstart; Oath of Glass stats; daily
same-board determinism and daily-best banking; notices dedupe; bgm toggle
persistence; touch-pad suppression; 40-room roller audit (no consecutive
biome/layout repeats, ≥12 biomes, ≥7 layouts, ≥4 recipes, stages escalate,
every room has cover and hazards, annexes occur, seeded determinism, tier
banding, round-20 final arena).

A 12-round auto-play stress harness (drives the real loop, picks random draft
cards, crosses the round-5 and round-10 boss fights) runs ~8,000 frames with
zero exceptions and touches all 10 hazard kits and all 8 enemy AIs.

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
- **Character emitter + aim.** The floating aim-line over his face is gone;
  shots now leave a stubby **barrel + arrowhead at body level** that points where
  you aim — readable by SHAPE (dark outline), since the player is colourblind.
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
