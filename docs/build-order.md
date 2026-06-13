# Build Order

Phased checklist for implementation. Each phase ends with: acceptance criteria met
(verified via `window.oneRoomDebug` where possible), committed, pushed to
`claude/bold-fermi-jio8q5`. Phases are sized so a session can land one or two
whole phases. Don't start a phase until the previous one's bar is green —
especially don't start Phase 3 content breadth before Phase 2's variety bar passes.

## Phase 0 — Skeleton (the stable base)

- [x] `index.html` shell: canvas, HUD DOM stubs, title overlay, CSS baseline
      (dark #05070b, Inter-stack font, glass panels — crib from `reference/no-moon/index-shell.html`)
- [x] `main.js` loop with dt clamp, mode state machine (`title → play → dead`)
- [x] `config.js`, `rng.js` (mulberry32 + hashString + bag dealer), `state.js`
- [x] `input.js`: keyboard + mouse (touch comes Phase 6, but structure the
      move/aim abstraction now exactly like Boon Moots' `getMoveInput/getAimInput`)
- [x] `camera.js` + `draw.js` composition order + empty-room render (gradient bg, wall border, vignette)
- [x] `window.oneRoomDebug` v1: `state()`, `start(seed)`, `selfTest()`
- [x] **Bar:** placeholder circle moves with Boon Moots feel constants in an empty
      room at 60fps; debug hooks respond; pushed.

## Phase 1 — Combat core (make it feel right before making it big)

- [x] Moots: sprite load (`assets/moots.webp`), aim line, twin-relay fire,
      spin-dash (full v50 spec: impulse/i-frames/afterimages/spin draw/dash damage),
      pulse meter + pulse bomb, hp/i-frames/knockback/death
- [x] `bullets.js` with pierce/bounce hooks (empty hook table wired now)
- [x] 3 enemies: skitter, gunner, charger (No Moon AI specs incl. charger windup
      telegraph + "LANE"-style float), contact damage, separation, wake = all-awake
- [x] Juice kit: hitstop, shake, flash, slow-mo, kill particles, floats, combo +
      streak names, kill/hurt/dash/pulse SFX (Boon Moots synth recipes)
- [x] One hand-built test room (fixed obstacles) + `killAll`/`grant` debug hooks
- [x] **Bar:** 60 seconds in the test room is *fun* — dash-weaving through a
      skitter swarm while a gunner strafes feels like Boon Moots. Honest check,
      not a checkbox.

## Phase 2 — The Room Roller (the heart; the anti-boring bar lives here)

- [x] `data/biomes.js` with the 8 early+mid biomes (palettes + hazard + bias from
      the systems doc; remaining 13 biomes land in Phase 3 as data-only PRs)
- [x] `data/patterns.js`: first 14 decoration painters (2 per shipped biome,
      ported from No Moon's recipes) + baked-background pipeline
- [x] Layout generators: courtyard, ring, lanesH/V, crossroads, spine, pockets,
      edges, scatter — each consuming ≥4 rolled parameters; obstacle placement +
      collision (circle/rect resolve from Boon Moots)
- [x] All 10 hazard kits (Boon Moots compact mechanics + No Moon parameters +
      danger-stage escalation tables)
- [x] Breakables: 4 species first (marrowJar, bellHusk, blackGlass, falseIdol)
- [x] Sealed annex (30%) with secret/ambush
- [x] No-repeat bag dealer wired for biome/layout/recipe axes; axis cross-check pass
- [x] Round lifecycle: transition splash (biome + mechanic tag + round) → live →
      clear (bullet wipe, tally, spark vacuum, portal) → portal touch → next round
      (draft arrives Phase 4 — portal goes straight to next room for now)
- [x] `oneRoomDebug.roll(20)` axis-summary audit
- [x] **Bar:** play 10 consecutive rounds — every room visibly and mechanically
      distinct (different bones, not different paint); `roll(50)` shows no
      consecutive axis repeats; baked backgrounds keep frame time flat.

## Phase 3 — Full roster + director

- [x] Remaining 5 enemies: turret, brute, sniper (with perch/aim telegraph),
      hexer, myrmidon — full No Moon AI specs
- [x] Remaining 13 biomes + remaining ~20 decoration painters (data-only)
- [x] `director.js`: budgets, allowed-types-by-round, recipes (all 7), staged
      waves with spawn telegraph glyphs, reinforcement triggers, MAX_ENEMIES caps
- [x] Captain system: 5 affixes, promotion odds, floated titles, on-death effects
- [x] Off-screen danger triangles (+telegraph brightening)
- [x] Danger-stage scaling formulas wired (hp/speed/cooldowns/hazard escalation)
- [x] **Bar:** rounds 1→15 ramp legibly; recipes are recognizable at a glance
      ("that's a gunline room"); captains read as events, not stat noise.

## Phase 4 — Drafts, items, economy, events

- [x] `data/items.js`: all 32 items on the hook table; stacking + maxStacks +
      weight familiarity bump
- [x] Draft UI at portal (3 DOM cards, number keys, stack chips); world keeps
      simulating particles behind it
- [x] Boon reroll: charge economy (1 per 2 clears, ×3 boss), draft re-deal, loose
      core re-roll, HUD LACING chip
- [x] Pickups: sparks (combo score + pulse + meta bank), repair/heart/marrow,
      amp/rapid/frame perk pickups, magnet, remaining 3 breakable species
- [x] Room events: all 7 (cache, gambit, market, nest, spring, vault, care objects)
      with event-weight table and pity timer
- [x] Build chips in HUD (grafts + stacks)
- [x] **Bar:** a 15-round run produces a *build* (visible synergy moment, e.g.
      ricochet+splitWake+graveCharge chain-clearing a swarm); gambit shrine causes
      one audible decision per encounter.

## Phase 5 — Bosses, route, win

- [x] Boss framework: intro card (webp art from `assets/bosses/`), boss bar,
      arena enforcement (ring/crossroads), summon rings with placement rules
- [x] R10 Graven Warden + R20 Null Archon to full No Moon spec; R5 False Moon +
      R15 Spiggot minibosses (one signature pattern each, ~40% boss HP)
- [x] Route win at R20: tally screen, "ROUTE BURNT OPEN" beat → Overdrive ∞
      (uncapped danger slope, ×1.35 score, boss every 5, full biome bag)
- [x] Death/restart flow: one-tap Run it back; score/speed/no-hit bonuses final;
      bests persisted (daily-best line ships with the daily mode in Phase 6)
- [x] **Bar:** full route is beatable by a competent run (~20–25 min); Warden and
      Archon phases match the No Moon spec; Overdrive scales until death.

## Phase 6 — Meta, audio, mobile, voice

- [x] Shrine (5 upgrades, sparks costs), codex (bestiary/notices/stats/favorite
      graft), behavior notices (all 8 from Boon Moots), achievements-lite (rides on notices + bestiary + lifetime stats)
- [x] Daily seed mode (UTC date seed, separate best line on title)
- [x] Oaths (glass/hunger/blind) unlocked by first route clear
- [x] BGM: No Moon's 86 BPM stress sequencer (kick/snare/bass/arp/lead/chords,
      stress = danger + boss + low HP); SFX/BGM toggles persisted
- [x] Mobile: two-thumbs-anywhere pads, flick dash + tap pulse (full v50 release
      semantics + dash latch), viewScale, DPR 1.35, haptics, particle/entity
      mobile budgets, input-suppression window on room load
- [x] Voice pass: wire `data/lines.js` everywhere (clear lines, mutator
      announcements, event copy, boss intros, death lines) under the §10 rules
- [x] **Bar:** playable start-to-death on a phone with thumbs only;
      `selfTest()` tap-target audit passes; sound on/off persists.

## Phase 7 — QA, balance, deploy

- [x] Tuning sheet written (docs/playtest-notes.md); numeric pass awaits human playtest (combo cap, budget slope, hazard
      escalation, item weights) — adjust `config.js` only
- [x] Perf pass: frame-time sample in `selfTest()` < 8ms p95 desktop / 14ms mobile
      sim; particle/bullet cap audits
- [x] `?fresh=1` wipe; pagehide final-save; error-free console sweep
- [x] README gains play/dev instructions; deploy folder check against `_headers`/
      `_redirects` conventions from the archive
- [x] Final full-route playtest log committed to `docs/playtest-notes.md`

## Phase 8 — Room Architecture (floorplans + true elevation)

Full spec: `docs/room-architecture.md`. Post-launch; from player feedback that
rooms felt sterile/open/rectangular and a want for verticality.

- [x] **8a Floorplans** — wall vocabulary (solid `wall`, breakable `wallSegment`),
      4 archetypes (bisect / innerSanctum / spineCorridor / quadrants) + none on a
      no-repeat bag, bigger partitioned rooms, generous openings, AABB placement
      fix, flood-fill connectivity guarantee + `roll()` audit + headless test
      (≥250 rooms, zero unreachable portals), architectural wall rendering.
- [ ] **8b Tiers** — raised regions as walled enclosures with ramps; `level`
      tracking; raised rendering + sort.
- [ ] **8c High-ground** — `bullet.level`, ledge height-gating, hit gate, hazard
      level, auto-aim filter; line-of-fire test.
- [ ] **8d Integration** — roll tiers as a roller axis; director seeds platform
      occupants (snipers/turrets) + validates spawn level/chamber; full visual pass.

## Standing orders

- Never edit `reference/`.
- Commit per system, push per phase (branch `claude/bold-fermi-jio8q5`).
- When a spec here conflicts with parent source, the parent source wins for *feel
  constants*, these docs win for *structure* — note the divergence in the doc.
- New flavor text goes through the voice rules (`game-design.md` §10) — when in
  doubt, reuse a real line.
