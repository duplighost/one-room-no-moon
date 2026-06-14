# One Room No Moon — STATUS (start here when resuming)

Living snapshot of where we are. Full history + rationale lives in
`docs/playtest-notes.md`; this file is the short "where are we right now" view.

- **Branch:** `claude/bold-fermi-jio8q5` (commit + push per chunk).
- **Dev:** `python3 -m http.server 8000` → `http://localhost:8000/`.
- **Verify:** `node tests/headless.mjs` + `node tests/stress.mjs`; in-browser debug
  API `window.oneRoomDebug` (`state()`, `start(seed)`, `skipRound()`, `selfTest()`).
- **Player is mildly colourblind** — important signals must read by SHAPE, not colour.

## State (updated 2026-06-14)

Feature-complete; in iterative feel/polish driven by the player's playtests. Last
shipped: the **roomier arena rescale** (`ffc43ab`) — rooms ~1.4× bigger, Moots drawn
at 0.7× (matches his hitbox; hitbox unchanged), desktop camera zoomed to 0.82, dash
now ~21% of room width (a dodge, not a teleport).

## ⚠️ NOT yet playtested by the human

- **The roomier arena pass (`ffc43ab`) is UNPLAYED.** Confirm in the hands before
  building further on it:
  - Does the bigger floor feel spacious, or too empty? (enemy density is lower now)
  - Are bullets/enemies readable at the 0.82 desktop zoom? (colourblind — shape first)
  - Does mobile portrait show enough of the bigger room?
  - Boss arenas: more dodge room may make them easier — watch time-to-kill.
- Everything *through* the fast-combat fixes (`44ca13b`) WAS played and liked
  ("yours is fun!").

## Top open tuning dials (only touch if a playtest flags them)

- Floor feels empty → `DIRECTOR` budget / `CAPS.ENEMIES` in `config.js`.
- Bullets too small at zoom → camera `0.82` → ~`0.86` in `render/camera.js`, or `SHOT_R`.
- Bosses melt / too easy → `DASH_HIT_MULT`, `DASH_KILL_REFUND` (config), boss HP in
  `systems/bosses.js`.
- Character size → the `ctx.scale(0.7, 0.7)` in `render/sprites.js` (`drawPlayerBody`).

## Recent passes (newest first; detail in `playtest-notes.md`)

1. **Roomier arena rescale** (`ffc43ab`) — bigger rooms, 0.7× sprite, 0.82 camera. **UNPLAYED.**
2. **Fast-combat fixes** (`44ca13b`) — dash now sweeps the whole travel path (not just
   launch), restart guard, fire-rate floor, conversion reorder. Played ✓.
3. **Grave Signal tempo** (`b59e7bc`…`16138a2`) — faster fire, dash-bullet conversion,
   Redline/Kinetic relics, quadratic shake, mobile readability + rotate hint. Played ✓.

## How to resume in a fresh conversation

> Continuing One Room No Moon on branch `claude/bold-fermi-jio8q5`. Read
> `docs/STATUS.md` then `docs/playtest-notes.md`, then [next task].

(Keep this file current at the end of each work chunk — it's the handoff.)
