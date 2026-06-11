# One Room No Moon

A one-room arcade re-imagining of **No Moon**: clear the room and a different room
loads into the same spot — every biome, enemy, hazard, item, and boss from the
descent feeding a single arena that re-rolls itself each round, played at **Boon
Moots** tempo and starring the Boon Moots character. It does not replace No Moon;
it's No Moon's most action-packed parts, distilled.

**Status: planned, not yet built.** The full plan is in [`PLAN.md`](PLAN.md) and
`docs/` (design, system inventories of both parent games with line anchors,
architecture, phased build order). The parent games live read-only in `reference/`.

| | |
| --- | --- |
| Play (after build) | serve repo root, open `index.html` |
| Dev server | `python3 -m http.server 8000` |
| Reference: Boon Moots | `reference/boon-moots/index.html` |
| Reference: No Moon | `reference/no-moon/index-shell.html` (loads `game_inline.js`) |
| Prototypes (recon only) | `reference/arcade-prototypes/` |
