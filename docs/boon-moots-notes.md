# Boon Moots Reference Notes

First-hand read of `reference/boon-moots/index.html` (v `5.0.0-boon-moots-ultimate`,
save key `boon.moots.ultimate.v50`, 1,536 lines). Line numbers are index.html lines.
This game is the **structural template** for One Room No Moon: it already is a
one-room arcade game, and v50 already imported ten No Moon biome rooms. The arcade
project takes its skeleton and feel, then swaps in No Moon's full content depth.

## 1. Shape of the file

Single HTML file. Line 8–10 CSS (one long line). Line 13–19 DOM: canvas, HUD panel,
whisper line, overlay modal, upgrade modal, codex, pause, shrine. Line 21:
`window.BOON_MOOTS_SRC` — the Moots character sprite as base64 webp (extracted for
us at `reference/assets/boon-moots-sprite.webp`, 29,112 bytes). Line 22–1534 the
game IIFE.

## 2. The round structure we're adopting

- `startRun(seedText)` (255): seeds `mulberry32(hashString(seed + runs))` — fully
  seeded runs; daily mode is free (`todaySeed()` at 81).
- `nextRoom()` (277): level += 1, theme dealt by `roomThemeForLevel` (133 — round-
  robin deck; **we replace this with the Room Roller's no-repeat bags**), player
  repositioned, camera snapped, touch pads hard-cleared with a 160ms input
  suppression window (subtle and important — prevents carried touches from dashing
  you into a wall on load).
- `makeRoom(level, theme)` (289): one function builds the whole room — decor,
  obstacles via layout spots, hazards via `seedNoMoonRoom` (401), ambient particles,
  floor deco, care objects (level ≥ 8), then enemies: levels 1–3 scripted tutorial
  spawns, every 5th level a boss + escort, otherwise pool spawn `5 + level×1.05 +
  rand(0,2)` capped 22/32 (334–352).
- `clearRoom()` (911): cleared flag, bullets wiped, clear-line notice, no-hit bonus
  `400×combo`, clear bonus `(300+level×82)×combo`, portal spawns top-center with a
  radial particle bloom.
- Portal touch (899) → `chooseUpgrade()` (950): 3 cards (4 with badges), pick →
  apply → `nextRoom()` directly. Transition splash (`startTransition` 922,
  `drawTransition` 928–948): fade out 28% / biome name + "room N" card 44% / fade
  in 28%, duration 1.4s.
- `die()` (958): banks bests, overlay "The boon boots remain." with Run it back /
  Codex / Shrine. One tap to restart.
- Level 13 is a "truth" beat; level 14+ flips `overdrive` (endless flag, score
  ×1.35, ∞ in HUD) (284–285, 864).

## 3. The Moots kit (port faithfully)

- **makePlayer** (244–253): hp 5/5, speed 304, accel 24.5, stop 37.5, turn 30,
  lateral 13.5, fireDelay 0.172, damage 15, pulse meter 0–100 (gain 4.8+1.15×
  pulseGain per s), pulseRadius 305, dashCdBase 0.43, dashDur 0.295, pickup 104.
  (The arcade rebases damage/hp to No Moon's scale — enemy hp 2.2–8.1 — but keeps
  these *feel* constants: accel/stop/turn/lateral/dash numbers.)
- **Movement** (612–643): twin-damped accel toward desired velocity with turn-
  pressure bonus and reverse boost; lateral damping kills drift-skate; brake
  particles when you release input at speed; afterimage trail buffer; max speed
  ×1.055 (×4.65 mid-dash). This exact model is the Phase 1 acceptance bar.
- **Dash** (645–654): impulse 1325, dur 0.295, i-frames ≥0.36, cd dashCdBase,
  spin direction from cross(aim, dashdir), close-range dash damage `dmg × (0.55 +
  0.18×dashTrail)` within 124+r, 28 burst particles, screenshake 0.075, haptic 14ms,
  hitPause 5ms.
- **Pulse** (669–676): requires full meter; wipes enemy bullets (life → 0.08),
  radial `2.2 + 0.5×pulseGain` × dmg within pulseRadius, flash 0.75, slowMo 0.42,
  shake 0.42, hitPause 38ms, 70 radial particles.
- **Fire** (656–661): crit chance `crit + tipper×0.025` → ×1.8; split shots ±0.18
  rad at 0.42+0.05/st damage; chain lightning every `5 − min(3, chain)` shots
  (664–667: nearest enemy in 390, float "ϟ").
- **Sprite drawing** (1391–1419): drawImage 72×106 at (−36,−72); aim indicator
  stroke from body; dash spin = scaleX yaw flip with halo ellipse; hurt ring, inv
  ring, shield rings; ghost afterimages at alpha 0.18; orbiting cat companions
  (`drawCat` 1420) when `p.cat > 0`.

## 4. Input (the two-thumbs system — port whole)

Lines 445–548. Touch pads assigned by screen half with overflow to the other pad;
pad vector = (touch − start)/70 clamped. Release semantics (484–500): aim-pad tap
(<260ms, <0.22 len) = pulse; aim-pad flick (<230ms, >0.82 len, speed >620) = dash.
Mid-drag dash detection (579–591): move-pad shove (len >0.80 + speed/angle-change
gates with a dash latch) — this is what makes mobile feel like Smash-style flicking
instead of haunted gymnastics. Keyboard: WASD/arrows, Shift dash, E/X pulse, Space/Z
fire-with-autoaim, Esc/P pause, Tab codex, U sound. Mouse: aim + hold LMB, RMB
pulse. Gamepad: left stick move, B dash, Y pulse (524–525). Auto-aim fallback
(529–535): nearest enemy within 620px when firing without explicit aim.

## 5. Juice kit (port whole)

`tactilePause(ms)` hitstop honoring prefers-reduced-motion (563); shake/flash/slowMo
globals decayed in update (566–568); kill: combo +0.14 (cap 12, 2.6s decay), pulse
gain, spark scatter, streak names `['','','DOUBLE BOOT','TRIPLE STAMP','','RAMPAGE
RECEIPT','','','UNSTOPPABLE PASSENGER']` (165), bestiary tally, hitPause 24/58ms,
shake 0.10/0.26 (863–877); hurt: i-frames 0.92, knockback 370, shake 0.46, flash
0.32, hitPause 72ms, haptic 48ms (880–884); off-screen danger triangles, brighter
×1.6 when a charger/crownsworn is mid-telegraph (1425–1442); floats rise and fade;
whisper line (one-shot toast under HUD, 967).

## 6. Hazards & enemy AI (compact versions)

`seedNoMoonRoom` (401–424) seeds per-theme hazard kits (counts 3–7 by type, mobile
lighter); `updateHazards` (690–714) runs all 10 No Moon hazard types in ~25 lines
each — these compact forms are the right starting size for the arcade, with No
Moon's parameters layered on. Enemy AI (717–822): 16 types in one switch; the No
Moon ports (pewling/censer/lectern/longcandle/antiphon/oxwarden/crownsworn) are
recognizable simplifications of the originals — useful as a cross-check that the
big game's AI survives compression. Boss (803–809): radial barrages + summons +
No Moon-skinned names ("Graven Warden in a borrowed car") when in a No Moon room.

## 7. Meta & voice (port whole, then extend)

- Sparks → **shrine** permanent upgrades (186–192, 1477–1491): +1 HP 80, +18 speed
  100, +30 pulse radius 120, +40 pickup 90, headstart 200. Finite, cheap, honest.
- **Codex** (1493–1509): bestiary with kill counts + flavor, run stats, favorite
  upgrade, collected notices.
- **Behavior notices** (153–162, 903–909): lowhp / standing-still / dash mastery /
  aim mastery / no-hit / care discovered / room-13 truth / endless — the game
  noticing the player. Implement in Phase 1–2; they cost nothing and carry the soul.
- **Clear lines** (135–151): the canonical voice. Reuse this pool directly.
  Calibration examples: "The moon was hiding behind a worse moon." / "The bench
  heals you like a dad holding a flashlight." / "The cat has promoted you to
  suspicious contractor." Note line 149 — "No Moon sent a room mechanic in a cheap
  disguise. It still had teeth." — the *original, earned* teeth line the prototypes
  ran into the ground. It stays in Boon Moots; the arcade writes its own.
- Title copy (1467): "The road grins. The boots answer. No Moon keeps breaking into
  the room wearing fake glasses." — tone north star.

## 8. Practical details worth copying

- `ctx.getContext('2d', { alpha: false, desynchronized: true })` (29).
- DPR clamp: mobile 1.35, desktop 2; viewScale 0.52 portrait / 0.70 landscape /
  1.0 desktop (85–93).
- Particle budget 150 mobile / 260 desktop (964); bullet caps enemy 110/170,
  player 90/160 (824–825).
- `pagehide`/`beforeunload` final save (1517–1518).
- **Self-test hooks** (1520–1529): `window.passengerTactileSelfTest/Debug/Start/
  SkipRoom/UnlockAll/Reset` — a console API that reports state, skips rooms, and
  audits tap-target sizes. Recreate the same idea (`window.oneRoomDebug`) in Phase
  0; it is how a coding agent verifies the game without eyes on every frame.
- Reduced-motion honored everywhere juice happens (`reduced()` 83).
