// Visual verification: load the real game in Chromium, drive it via
// window.oneRoomDebug, screenshot key states, report console errors.
// Resolve Playwright across environments (local install, env override, or the
// global install path) instead of a single hardcoded absolute path that only
// exists on one machine.
async function loadChromium() {
  const candidates = [
    'playwright',
    process.env.PLAYWRIGHT_PATH,
    '/opt/node22/lib/node_modules/playwright/index.mjs',
  ].filter(Boolean);
  for (const c of candidates) {
    try { return (await import(c)).chromium; } catch { /* try next */ }
  }
  throw new Error('playwright not found — `npm i -D playwright` or set PLAYWRIGHT_PATH');
}
const chromium = await loadChromium();

const BASE = 'http://localhost:8400';
const shots = './tests/shots';
const errors = [];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

await page.goto(BASE + '/?fresh=1', { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
await page.screenshot({ path: shots + '/01-title.png' });

// start a seeded run, let round 1 breathe
await page.evaluate(() => window.oneRoomDebug.start('visual-1'));
await page.waitForTimeout(2600);
await page.screenshot({ path: shots + '/02-round1-verdigris.png' });

// dash + fire moment (synthetic input via debug state isn't enough; use keys)
await page.keyboard.down('d'); await page.keyboard.down(' ');
await page.waitForTimeout(900);
await page.keyboard.press('Shift');
await page.waitForTimeout(350);
await page.screenshot({ path: shots + '/03-combat-dash.png' });
await page.keyboard.up('d'); await page.keyboard.up(' ');

// a later normal round with hazards (lane biome) + an event
await page.evaluate(() => { for (let i = 0; i < 6; i++) window.oneRoomDebug.skipRound(); });
await page.waitForTimeout(2200);
await page.screenshot({ path: shots + '/04-mid-round.png' });

// clear → portal → tally
await page.evaluate(() => window.oneRoomDebug.killAll());
await page.waitForTimeout(1400);
await page.screenshot({ path: shots + '/05-cleared-portal.png' });

// walk into the portal → draft
await page.evaluate(() => {
  const s = window.oneRoomDebug; const st = s.state();
  // teleport the player onto the portal
  const room = window.__room ?? null;
});
await page.evaluate(async () => {
  // touch the portal via direct state access through the debug module pattern
  const dbg = window.oneRoomDebug;
  // brute force: hold up key to walk in
});
await page.keyboard.down('w');
await page.waitForTimeout(2600);
await page.keyboard.up('w');
const mode1 = await page.evaluate(() => window.oneRoomDebug.state().mode);
if (mode1 !== 'portalDraft') {
  // keep walking with slight x correction
  await page.keyboard.down('w'); await page.waitForTimeout(2200); await page.keyboard.up('w');
}
await page.screenshot({ path: shots + '/06-draft.png' });
const modeDraft = await page.evaluate(() => window.oneRoomDebug.state().mode);

// pick a card if we made it, then boss round
if (modeDraft === 'portalDraft') {
  await page.keyboard.press('1');
  await page.waitForTimeout(800);
  await page.screenshot({ path: shots + '/07-transition.png' });
  await page.waitForTimeout(1200);
}
await page.evaluate(() => { const d = window.oneRoomDebug; while (d.state().run.round < 9) d.skipRound(); d.skipRound(); });
await page.waitForTimeout(2500);
await page.screenshot({ path: shots + '/08-warden-boss.png' });

// grant a build for companion visuals
await page.evaluate(() => {
  const d = window.oneRoomDebug;
  d.grant('orbitalHalo'); d.grant('scavengerDrone'); d.grant('gigi'); d.grant('ricochet');
});
await page.waitForTimeout(1500);
await page.screenshot({ path: shots + '/09-companions.png' });

// later biome look (abyss/zenith)
await page.evaluate(() => { const d = window.oneRoomDebug; while (d.state().run.round < 17) d.skipRound(); });
await page.waitForTimeout(2200);
await page.screenshot({ path: shots + '/10-zenith.png' });

// death screen
await page.evaluate(() => { const d = window.oneRoomDebug; });
await page.evaluate(() => {
  // drain hp via repeated contact: easiest is direct - expose through debug state? use keyboard idle
});
// force death through debug: damage player via state not exposed; stand still among enemies
await page.waitForTimeout(14000);
await page.screenshot({ path: shots + '/11-late-or-death.png' });

// selfTest + state dump
const self = await page.evaluate(() => window.oneRoomDebug.selfTest());
const fin = await page.evaluate(() => window.oneRoomDebug.state());
console.log('selfTest:', JSON.stringify(self));
console.log('final state:', JSON.stringify(fin.run), fin.mode);

// mobile viewport pass
const mob = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
mob.on('pageerror', (e) => errors.push('mobile pageerror: ' + e.message));
await mob.goto(BASE + '/', { waitUntil: 'networkidle' });
await mob.waitForTimeout(800);
await mob.screenshot({ path: shots + '/12-mobile-title.png' });
await mob.evaluate(() => window.oneRoomDebug.start('mobile-1'));
await mob.waitForTimeout(2400);
// simulate a touch drag (move pad)
await mob.touchscreen.tap(100, 700);
await mob.waitForTimeout(400);
await mob.screenshot({ path: shots + '/13-mobile-play.png' });
const mobSelf = await mob.evaluate(() => window.oneRoomDebug.selfTest());
console.log('mobile selfTest:', JSON.stringify(mobSelf));

console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'NO PAGE/CONSOLE ERRORS');
await browser.close();
