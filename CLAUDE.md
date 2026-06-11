# One Room No Moon — working notes for Claude

This repo builds a new game: a one-room arcade re-imagining of No Moon, starring
the Boon Moots character. Planning is complete; implementation has not started.

**Start here, in order:**
1. `PLAN.md` — the master plan and map of everything.
2. `docs/build-order.md` — find the first unchecked phase; that's the work.
3. `docs/architecture.md` — file layout and module rules before writing code.
4. `docs/game-design.md` — the design being implemented.
5. `docs/no-moon-systems.md`, `docs/boon-moots-notes.md` — system specs with line
   anchors into `reference/` for any porting question.

**Rules:**
- `reference/` is read-only archive of the live games. Never edit it. The new game
  is built fresh at the repo root (`index.html` + `src/`) per the architecture doc.
- Re-implement from the specs in `docs/`; open `reference/` sources by line anchor
  only to resolve ambiguity. No copy-pasting parent code.
- Vanilla JS ES modules, no build step, no dependencies, no service worker.
- Feel constants come from Boon Moots (dash/movement/juice); content stats come
  from No Moon. Both are tabulated in the docs.
- Flavor text follows the voice guide (`docs/game-design.md` §10). Reuse real
  lines from the parents before writing new ones. No "teeth" recycling.
- Branch: `claude/bold-fermi-jio8q5`. Commit per system, push per phase.

**Dev:** `python3 -m http.server 8000` then open `http://localhost:8000/`.
ES modules require a server (file:// won't work).
**Verify:** use the `window.oneRoomDebug` console API (built in Phase 0) —
`state()`, `start(seed)`, `skipRound()`, `roll(n)`, `selfTest()`.
**Reference games can be played too:** serve the repo root and open
`reference/boon-moots/index.html` (complete single file) or
`reference/no-moon/index-shell.html` (the shell loads `game_inline.js` from the
sibling path; some title videos are absent from the archive but the game runs).
Use them to check feel/behavior questions hands-on.
