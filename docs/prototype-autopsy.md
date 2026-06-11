# Arcade Prototype Autopsy

Three quick ChatGPT prototypes live in `reference/arcade-prototypes/`. They proved
the one-room loop works and demonstrated exactly how it goes stale. We build fresh;
this is reconnaissance. (Full variant hashes/routes: `reference/arcade-prototypes/VARIANTS.md`.)

## The three, in one line each

| Build | Files | Verdict |
| --- | --- | --- |
| **v1** | `v1/index.html` (1,206 lines) | Tightest loop, blandest rooms; save `noMoonArcadeBest.v1` |
| **one-room** | `one-room/index.html` + `game.js` (2,729) | Most ambitious: 16 biomes in tiers, 9 archetypes, elites, waves; save `noMoonArcadeSave_v1` |
| **bellroom** | `bellroom/index.html` + `game.js` (2,490) | Cleanest UI, most layouts (9×22 biomes), captain rooms; worst flavor text; save `noMoonBellroomArcade_v1`. (No actual bell mechanic — name is theming only.) |

Common loop in all three: clear arena → draft 1 of 3 stacking modules → room
re-skins → repeat; boss every 5th room; combo + speed/no-hit bonuses; boon reroll
charge earned by clears. All star Moots (drawn, not the sprite).

## Why their rooms felt boring (the problem we are hired to solve)

1. **Fixed stamps.** Each layout archetype placed obstacles at near-hardcoded
   positions ("crossfire" = always 2 verticals + 2 horizontals; one-room
   `game.js:160–169`, bellroom `game.js:548–627`). Two visits to the same archetype
   were the same room with different paint.
2. **Cosmetic biomes.** Biome changed colors and hazard skin, not density, layout
   family, spawn grammar, or events.
3. **Static hazards.** Lane/pulse timers identical at round 3 and round 30; no
   escalation, no interaction with the fight.
4. **Inert arenas.** Nothing in the room changed while you fought; no breakables
   worth caring about, no events, no annexes, no mid-fight reveals.
5. **Scripted waves with no grammar.** Budgets rose but composition logic was a
   flat weighted pick — no swarm/gunline/anchor identities.
6. **Modal-heavy flow.** Draft modals froze the world instantly on clear; no
   pickup-vacuum moment, no portal walk, no breathing room.

Each numbered item has a direct countermeasure in `docs/game-design.md` §3
(parameterized generators, axis cross-checks, hazard escalation, events/annexes,
recipes, portal-gated drafts).

## The flavor-text incident

The user flagged odd copy like "with teeth." Found it: bellroom `index.html:319`
("…until the whole sky starts **coughing teeth**") and `index.html:342`
("**footwear with a criminal record**"), v1's "The invoice has teeth" /
"The room reloads teeth" (`index.html:231, 661`). Diagnosis: the prototypes
pattern-matched Boon Moots' single earned teeth line (Boon Moots `index.html:149`)
and spammed the motif without grounding. Rule going forward is in the voice guide
(`docs/game-design.md` §10): lines must be about a thing in the room or a thing the
player did; reuse the real games' lines; no recycled menace.

## Worth keeping (small salvage)

- Score formula shape: clear bonus + speed bonus (`max(0, 1000 − clearTime×18)`)
  + no-hit bonus (v1 `index.html:795` area).
- Boon reroll as an earned charge with a need-counter (all three; one-room
  `game.js:459`).
- Captain/miniboss cadence between bosses (bellroom `game.js:643–667`: captain
  rooms at round >7, round %4, non-boss).
- Staged waves: initial ~72% budget → reinforcement → late spike (bellroom
  `game.js:643–667`).
- Elite roll formula `(round − 8) × 0.012` capped 0.22 (one-room/bellroom) — we
  use No Moon's captain system instead but the cadence reference is useful.
- Build chips in HUD (current grafts as small icons) — players need to see the
  build without opening anything.

## Known bugs to not repeat

- Boss-room archetype hardcoded (one-room `game.js:531`) — vary boss arenas within
  the legal set.
- Reinforcement toast mid-combat with no telegraph (v1 `index.html:661`) — our
  spawns get warning glyphs.
- Draft modal can't be exited and blocks all play — ours sits behind the portal
  walk-in.
