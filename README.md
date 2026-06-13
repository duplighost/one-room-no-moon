# One Room No Moon

A one-room arcade re-imagining of **No Moon**: clear the room and a different room
loads into the same spot — every biome, enemy, hazard, item, and boss from the
descent feeding a single arena that re-rolls itself each round, played at **Boon
Moots** tempo and starring the Boon Moots character. It does not replace No Moon;
it's No Moon's most action-packed parts, distilled.

## Play

Serve the repo root and open it — ES modules need a server, `file://` won't work:

```
python3 -m http.server 8000     # then open http://localhost:8000/
```

| Input | Action |
| --- | --- |
| WASD / arrows · left stick | move |
| mouse · right stick · left thumb pad | aim |
| hold LMB · Space/Z (auto-aim) · hold right pad | fire |
| Shift · flick either thumb pad · B (pad) | spin-dash |
| E / X · tap right pad · Y (pad) | pulse bomb (when meter full) |
| R | boon reroll (draft, or loose cores on the floor) |
| 1 / 2 / 3 | pick a draft card |
| Esc / P · Tab · M · B | pause · codex · sfx · bgm |
| `?fresh=1` URL param | wipe the save |

Mobile is two-thumbs-anywhere: left half moves, right half aims and fires.
Dash and pulse have dedicated buttons in the bottom-right (the pulse button
glows when it's charged); the left thumb still dashes on a deliberate slam from
rest, and the right thumb still flicks to dash / taps to pulse.

**The run:** clear the room → walk into the portal → draft a graft → the room
re-deals itself. Boss every 5th round. Beat the Null Archon at round 20 to burn
the route open into endless Overdrive. Sparks bank between runs at the Shrine;
the Daily button gives everyone the same board per UTC day; Oaths unlock after
your first route clear.

## Development

No build step, no dependencies — plain ES modules under `src/` (catalogs in
`src/data/`, simulation in `src/systems/`, presentation in `src/render`/`ui`/
`audio`). Tuning constants live in `src/config.js`.

```
node tests/headless.mjs      # 69-check suite: sim, drafts, bosses, win, meta, roller audits
```

In-browser verification API: `window.oneRoomDebug` — `state()`, `start(seed)`,
`skipRound()`, `killAll()`, `grant('gigi')`, `roll(40)` (room-variety audit),
`selfTest()` (tap targets + frame p95).

Planning docs are in [`PLAN.md`](PLAN.md) and `docs/` (game design, parent-game
system inventories with line anchors, architecture, build order). The parent
games live read-only in `reference/` — `reference/boon-moots/index.html` and
`reference/no-moon/index-shell.html` both run from the same server.
