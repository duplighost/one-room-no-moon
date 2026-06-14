// All tuning lives here. Feel constants come from Boon Moots v50; content stats
// come from No Moon. Anchors refer to docs/ inventories.

export const TAU = Math.PI * 2;
export const SAVE_KEY = 'oneRoomNoMoon.v1';
export const VERSION = '0.2.0';

export const ROOM = {
  W: 2050, H: 1460, H_PORTRAIT: 1820,   // base dims (the roller rolls actual sizes; these document the target)
  WALL: 56,                 // playfield inset
  SPAWN_CLEAR: 360,         // radius around player spawn kept obstacle-free (scales with the bigger arena)
};

export const PLAYER = {
  R: 20, MAX_HP: 6,
  // Moots is DRAWN at this fraction of his art size (the sprite was ~2× his 40px
  // hitbox, which read as "gigantic"). One knob: body, gun, eyes, afterimages,
  // body-hugging rings, AND the bullet emitter all key off it so they never drift
  // apart. Hitbox (R) is unchanged — pure render. (ChatGPT scale-coherence pass.)
  DRAW_SCALE: 0.7,
  SPEED: 330, ACCEL: 24.5, STOP: 37.5, TURN: 30, LATERAL: 13.5,
  MAX_SPEED_MULT: 1.055, DASH_SPEED_MULT: 5.4,
  FIRE_DELAY: 0.15, DAMAGE: 0.88, SHOT_MULT: 0.72, SHOT_SPEED: 860,
  // SHOT_R kept at 4.2 (NOT shrunk with the gun): the player is colourblind and
  // bullets already read small at the 0.82 zoom — readability beats muzzle realism.
  SHOT_R: 4.2, SHOT_LIFE: 0.82, TWIN_OFFSET: 6,
  // emitter: shots leave the twin barrel tips at body level, in the aim direction.
  // These are gun-space (art) units; firePlayer multiplies by DRAW_SCALE so the
  // bullet origin tracks the visually-shrunk muzzle instead of floating ahead of it.
  EMITTER_Y: -16, EMITTER_LEN: 32,
  CRIT: 0.03, CRIT_MULT: 1.8,
  // the dash is the centerpiece: long, far, invincible throughout, hits hard+wide
  DASH_IMPULSE: 1550, DASH_DUR: 0.42, DASH_CD: 0.5, DASH_IFRAMES: 0.46,
  DASH_GLIDE: 2.0, DASH_HIT_RANGE: 156, DASH_SWEEP_RANGE: 112, DASH_HIT_MULT: 1.25, DASH_KNOCK: 500,
  DASH_KILL_REFUND: 0.05,   // every kill shaves a little off the dash cooldown
  DASH_PRIME_MULT: 1.5, DASH_PRIME_PIERCE: 1, // "dash primes next shot" relic payload
  HURT_IFRAMES: 0.92, HURT_KNOCK: 370,
  PICKUP_RANGE: 132,
};

export const COMBO = { PER_KILL: 0.14, PER_BOSS: 0.9, CAP: 12, WINDOW: 2.6 };

export const SCORE = {
  CLEAR_BASE: 300, CLEAR_PER_ROUND: 82, NO_HIT: 400,
  SPEED_MAX: 900, SPEED_DRAIN: 20, SPEED_FROM_ROUND: 3,
  SPARK: 18, OVERDRIVE_MULT: 1.35,
};

export const CAPS = {
  ENEMIES: { mobile: 22, desktop: 32 },
  ENEMY_BULLETS: { mobile: 110, desktop: 170 },
  PLAYER_BULLETS: { mobile: 90, desktop: 160 },
  PARTICLES: { mobile: 150, desktop: 260 },
};

export const DIRECTOR = {
  // spawn count: clamp(BASE + round*PER_ROUND + rand(0,2) , MIN, cap)
  BASE: 4, PER_ROUND: 1.05, MIN: 4,
  TELEGRAPH: 0.55,            // warning glyph time before a spawn lands
  REINFORCE_AT: 0.62,         // fraction of count held for the second wave
  REINFORCE_DELAY: [3.2, 5],  // seconds (or when 2 enemies remain) — kept snappy for tempo
  // danger stage = min(5, floor(round / 4)) during the route
  STAGE_DIV: 4, STAGE_CAP: 5,
  // non-boss scaling per No Moon: hp ×(1 + stageIdx*0.13 + stage*0.08)
  HP_IDX: 0.13, HP_STAGE: 0.08, SPD_IDX: 0.02, SPD_STAGE: 0.02,
};

export const FX = {
  SHAKE_DECAY: 2.25, FLASH_DECAY: 1.7, SLOWMO_SCALE: 0.55,
  // camera shake is quadratic in trauma (Grave Signal model): offset = trauma²·GAIN.
  // small hits stop buzzing; big hits still punch. GAIN tuned so peak ≈ the old linear feel.
  SHAKE_GAIN: 30,
  HIT_PAUSE: { shot: 10, chain: 16, dash: 18, pulse: 30, kill: 24, boss: 58, hurt: 72 }, // ms
};

export const BLOOM = { ALPHA: 0.20, FILTER: 'blur(11px) saturate(1.16)' };

export const ANNEX = { CHANCE: 0.30, AMBUSH: 0.35 };

export const STREAK_NAMES = ['', '', 'DOUBLE BOOT', 'TRIPLE STAMP', '', 'RAMPAGE RECEIPT', '', '', 'UNSTOPPABLE PASSENGER'];
