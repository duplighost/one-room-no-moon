# ONE ROOM NO MOON — Master Plan

> **Premise:** What if No Moon was one room? Clear the room and a different room loads
> into the same spot. All of No Moon's content — 21 biomes, 8 enemy archetypes, elites,
> 10 hazard types, 28 items, bosses, breakables, shrines — feeds a single arena that
> re-rolls itself every round, played at Boon Moots arcade tempo, starring the Boon
> Moots character. This does not replace No Moon on the site; it is No Moon's most
> action-packed parts, distilled.

This file is the front door. Read it first, then go to `docs/` for depth.

| Doc | What it holds |
| --- | --- |
| `docs/game-design.md` | The actual game design: round loop, Room Roller, director, scoring, bosses, meta, voice guide |
| `docs/no-moon-systems.md` | Inventory of every No Moon system we draw from, with line anchors into `reference/no-moon/game_inline.js` |
| `docs/boon-moots-notes.md` | First-hand notes on Boon Moots (the arcade template + the main character), line anchors into `reference/boon-moots/index.html` |
| `docs/prototype-autopsy.md` | What the three earlier arcade prototypes did, why their rooms felt boring, what to keep/avoid |
| `docs/architecture.md` | File layout, module boundaries, data schemas, engine decisions, coding conventions |
| `docs/build-order.md` | Phased implementation checklist with acceptance criteria — the next session starts at Phase 0 |

`reference/` holds the read-only source games (do not edit them):

- `reference/no-moon/game_inline.js` — the full live No Moon build (71,771 lines). The single most important file to consult.
- `reference/no-moon/index-shell.html` — No Moon's HTML/CSS shell with the inline JS stripped out.
- `reference/boon-moots/index.html` — Boon Moots v50 (complete, playable, 1,536 lines).
- `reference/arcade-prototypes/` — the three quick prototypes (v1, one-room, bellroom). Reconnaissance only; we build fresh.
- `reference/assets/` — Moots sprite (`boon-moots-sprite.webp`, extracted from the Boon Moots base64), character portraits, boss cards.

## The pitch in one paragraph

One arena, center screen, that never moves — but every clear, the **Room Roller** deals
it a new identity: a biome skin (21 of them, tier-banded by depth), a layout skeleton
(parameterized generators, never the same twice), a hazard kit (the 10 No Moon hazard
types), a spawn recipe (No Moon's encounter grammar: swarm / gunline / bite / anchor /
sniperGallery / hex), an optional room event (cache altar, gambit shrine, black market,
ambush nest, care objects), and sometimes a mutator. Moots — the Boon Moots character,
sprite and all — fights through it with four verbs: **shoot, spin-dash, pulse, boon
reroll**. Combo and streaks feed score; a draft card every clear feeds the build; a
boss holds every fifth round; round 20 is the Null Archon and a route clear; after
that, overdrive endless. Death costs one tap to run it back.

## Why the prototypes failed (and our answer)

The three ChatGPT prototypes proved the loop works and the rooms bore. Diagnosis
(detail in `docs/prototype-autopsy.md`): fixed obstacle patterns per archetype,
cosmetic-only biome variety, hazards on static timers, inert arenas, scripted waves,
and off-tone flavor text ("coughing teeth"). Our answer is the Room Roller's
**no-repeat dealer** (shuffled bags per axis so consecutive rooms never share a
biome/layout/recipe), **parameterized generators** instead of fixed patterns, hazards
that **escalate with depth**, room **events and mutators** as a spice slot, and a
voice pass that uses the real games' lines and style instead of imitating them badly.

## What we take from where

**From No Moon** (content depth — port data + behavior, re-implement cleanly):
- 8 enemy archetypes with full AI specs (skitter/gunner/charger/turret/brute/sniper/hexer/myrmidon) + the 5 captain affixes + the 2 boss templates (Graven Warden, Null Archon) and miniboss concepts (False Moon, Spiggot).
- 21 biomes: palettes, ~34 baked decoration patterns, ambient particle modes, obstacle styles, the biome→hazard→enemy-bias table.
- The 10 hazard mechanics (snare/fog/shard/thorn/pulse/spore/volatile/lane/sightline/ritual).
- The 28-item draft pool with effects, stacking rules, and weights.
- Breakable species (marrowJar, bellHusk, blackGlass, rootCyst, archiveLockbox, falseIdol, moonseedUrn) and the cursed-bargain logic.
- Special-room events (moonCache, gambitShrine, ambushNest, marrowSpring, mirrorVault, blackMarket) reframed as in-room events.
- Cost-budget + weighted-pool + recipe spawn director, danger stages, scaling formulas.
- Oaths (glass/hunger/blind) as opt-in vows, floor moods as room mutators.

**From Boon Moots** (the arcade soul — adopt structure and feel):
- The one-room round structure itself: `makeRoom(level, theme)` → fight → `clearRoom()` → portal → draft → next. Boon Moots v50 is already a working one-room arcade game and even carries 10 No Moon-themed rooms; it is our structural template.
- The Moots character: embedded sprite, spin-dash with afterimages and flick detection, the No-Moon Pulse meter (bullet-clearing bomb + slow-mo), aim auto-assist, two-thumbs-anywhere touch.
- Juice kit: hitstop (`tactilePause`), shake, flash, slow-mo, kill streak names, combo decay, floats, off-screen danger triangles, haptics.
- Meta shape: sparks currency → shrine permanent upgrades; codex with bestiary + notices; behavior notices (the game noticing *how* you play); daily-seed RNG (mulberry32) ready for a daily mode.
- The voice. Clear-lines like "The moon was hiding behind a worse moon." are the register to extend — concrete, deadpan, kind underneath.

**From the prototypes** (small salvage): score formula shape (clear bonus + speed bonus + no-hit bonus), boon-reroll-as-earned-charge, captain/miniboss cadence, build chips in HUD.

**From No Moon's Moots specifically:** the Boon Reroll active (reroll the draft, or loose cores, or mutate an owned graft) becomes the fourth verb, fusing both games' versions of the character.

## Architecture in one breath

Plain ES modules, no build step, canvas 2D + half-res bloom — same tech as both parents.
`data/` holds catalogs (biomes, enemies, items, hazards, recipes, lines) as inert
objects; `systems/` holds the simulation (loop, player, enemies, bullets, hazards,
director, roomRoller, draft, score, save); `render/` and `audio/` and `ui/` stay
thin. The Room Roller consumes only catalogs, so new content lands by adding data,
not by touching systems. Full detail in `docs/architecture.md`.

## Build order in one breath

Phase 0 skeleton → Phase 1 combat core (Moots + 3 enemies, one hand-built room, make
it *feel* right first) → Phase 2 Room Roller (the heart — 10 consecutive distinct
rooms is the acceptance bar) → Phase 3 full roster + director → Phase 4 drafts +
economy + events → Phase 5 bosses + route + win/overdrive → Phase 6 meta + audio +
mobile + voice → Phase 7 QA/balance/deploy. Every phase ends green and pushed.
Full checklist in `docs/build-order.md`.

## Hard rules carried from the brief

1. Do not edit anything in `reference/` — it is the archive of the live games.
2. Do not blind-rip code from No Moon; re-implement against the documented specs in `docs/no-moon-systems.md`, consulting the source by line anchor when behavior is ambiguous.
3. Build the stable base before content breadth (Phases 0–2 before 3+).
4. The flavor-text register is the real games' voice; the banned register is documented in the voice guide (`docs/game-design.md` §10).
5. This game is additive — No Moon itself is untouched.
