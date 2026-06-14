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

Feature-complete; in iterative feel/polish driven by the player's playtests. Last
shipped: the **big-room structure & density pass** + a **scale-coherence pass** + the
rotate-hint fix. The roomier arena (`ffc43ab`) felt vacant once it doubled in area; now
big rooms earn their size — landmark set-pieces, breakable rubble fields, baked floor
identity, ~98% of rooms carry major structure, cover density back to ~2.9/Mpx.

## ⚠️ NOT yet playtested by the human

- **The structure/density pass + scale-coherence are UNPLAYED.** Confirm in the hands:
  - Do the rooms feel *designed* now (landmarks/rubble/partitions), not bare? Any room
    feel cramped instead (esp. on a phone)?
  - Enemy density was lifted (caps 22/32 → 25/35, +1 budget base). Too swingy? → `CAPS.ENEMIES`.
  - Bullets/enemies readable at the 0.82 zoom? (colourblind — shape first.)
  - Chargers now smash soft cover/rubble during their dash — does that read as cool or chaotic?
  - Boss arenas unchanged structurally; watch TTK isn't trivialised by the extra dodge room.
- Everything *through* the fast-combat fixes (`44ca13b`) WAS played and liked ("yours is fun!").

## Top open tuning dials (only touch if a playtest flags them)

- **Fights swingy / too dense** → `CAPS.ENEMIES` (config) back toward 22/32; `DIRECTOR` budget base 6→5.
- **Rooms still feel empty / too busy** → landmark chances + `forceRubble` in `roomRoller.js`;
  floor-identity alphas in `paintFloorIdentity`; partition rate via `FLOORPLAN_IDS` ('none' count).
- Bullets too small at zoom → camera `0.82` → ~`0.86` in `render/camera.js` (kept `SHOT_R` 4.2 for readability).
- Bosses melt / too easy → `DASH_HIT_MULT`, `DASH_KILL_REFUND` (config), boss HP in `systems/bosses.js`.
- Character / FX size → `PLAYER.DRAW_SCALE` in `config.js` (one knob: sprite + gun + emitter + rings).

## Recent passes (newest first; detail in `playtest-notes.md`)

1. **Cross-build compare vs ChatGPT** (`c56f485` + borrows) — fixed enemy-spawns-in-obstacles
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
