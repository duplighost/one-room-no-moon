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
