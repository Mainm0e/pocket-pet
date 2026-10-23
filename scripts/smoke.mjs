// Smoke test: plays the whole game in a phone-sized headless Chromium and fails on
// any page error or broken check. Screenshots go to screenshots/.
//
//   npm run build && npm run smoke            (uses the real GPU if it can)
//   npm run smoke -- --software               (force SwiftShader: slow, ~4 fps)
//   CHROMIUM_PATH=/path/to/chrome npm run smoke
//
// Needs a Chromium for Playwright: `npx playwright install chromium-headless-shell`,
// or any cached build in ~/.cache/ms-playwright (picked up automatically).
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const PORT = 4179;
const URL = `http://localhost:${PORT}`;
const OUT = 'screenshots';
const software = process.argv.includes('--software');
mkdirSync(OUT, { recursive: true });

function findChromium() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const root = join(homedir(), '.cache', 'ms-playwright');
  if (!existsSync(root)) return undefined;
  const dirs = readdirSync(root).filter((d) => d.startsWith('chromium_headless_shell-')).sort().reverse();
  for (const d of dirs) {
    const p = join(root, d, 'chrome-headless-shell-linux64', 'chrome-headless-shell');
    if (existsSync(p)) return p;
  }
  return undefined; // let Playwright use its own default
}

const failures = [];
const check = (ok, what) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
  if (!ok) failures.push(what);
};

// ---- start the preview server (serves dist/) ----
if (!existsSync('dist/index.html')) {
  console.error('No dist/ build. Run `npm run build` first.');
  process.exit(1);
}
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
const stop = () => server.kill();
process.on('exit', stop);
for (let i = 0; i < 50; i++) {
  try {
    if ((await fetch(URL)).ok) break;
  } catch {}
  await new Promise((r) => setTimeout(r, 200));
}

const args = software
  ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
  : ['--use-angle=gl-egl', '--enable-gpu', '--ignore-gpu-blocklist'];
const browser = await chromium.launch({ executablePath: findChromium(), args });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
// software WebGL (CI) is slow: be patient with navigation and long waits
page.setDefaultTimeout(software ? 45000 : 20000);
page.setDefaultNavigationTimeout(120000);
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text()));
const shot = (n) => page.screenshot({ path: `${OUT}/${n}.png`, timeout: 90000 });
const wait = (ms) => page.waitForTimeout(ms);
const btn = (name) => page.getByRole('button', { name, exact: false }).first();
// the action bar (other buttons, like the wish bubble, can mention "play" too)
const care = (name) => page.locator('.actions button', { hasText: name }).first();
const evo = () => page.locator('.evo').count();

try {
  // ---- hatching ----
  await page.goto(`${URL}/?dev`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await wait(2500);
  await shot('01-intro');
  await btn("Let's go").click();
  for (let i = 0; i < 6; i++) {
    await page.locator('.opt').nth(i % 2).click();
    await wait(420);
  }
  await page.waitForFunction(() => !!window.__stage, null, { timeout: 30000 });
  await wait(2500);
  await shot('02-egg');
  for (let i = 0; i < 5; i++) {
    await page.mouse.click(195, 480);
    await wait(500);
  }
  await page.locator('.wrap input').waitFor();
  check(true, 'egg hatched after 5 taps');
  await shot('03-naming');
  await btn("That's the one").click();
  await wait(1500);
  check((await page.locator('.name small').textContent()).includes('Baby'), 'baby stage after hatching');

  // ---- care ----
  // let each scene finish before the next one (in slow motion, Play would interrupt the meal)
  const heardAll = (names) =>
    page.waitForFunction((n) => n.every((x) => window.__sfx.includes(x)), names, { timeout: software ? 90000 : 10000 }).catch(() => {});
  await care('Feed').click();
  await heardAll(['chomp', 'gulp']);
  await wait(1500);
  await care('Play').click();
  await heardAll(['jump', 'pat']);
  await wait(1500);
  await shot('04-care');
  // (software WebGL runs scenes in slow motion: wait for the sounds rather than a fixed time)
  await page.waitForFunction(() => ['hatch', 'chomp', 'gulp', 'jump', 'pat'].every((n) => window.__sfx.includes(n)), null, { timeout: software ? 90000 : 10000 }).catch(() => {});
  const heard = await page.evaluate(() => window.__sfx.slice());
  check(['hatch', 'chomp', 'gulp', 'jump', 'pat'].every((n) => heard.includes(n)), `care sounds play (${[...new Set(heard)].join(' ')})`);
  // ---- daily wish ----
  const wishKind = await page.locator('.wish').getAttribute('data-kind');
  if (wishKind === 'bath' || wishKind === 'train') {
    await btn('More').click();
    await wait(400);
    await page.locator('.grid button', { hasText: wishKind === 'bath' ? 'Bath' : 'Train' }).click();
    await wait(4000);
  } else if (wishKind === 'pat') {
    for (let i = 0; i < 3; i++) {
      const p = await page.evaluate(() => window.__stage.screenPosOfPet());
      await page.mouse.click(p.x, p.y);
      await wait(800);
    }
  }
  if (wishKind !== 'match') {
    const granted = await page.locator('.wish.done').waitFor({ timeout: 10000 }).then(() => true, () => false);
    check(granted, `the daily wish (${wishKind}) is granted by doing it`);
    await shot('04b-wish');
  }
  await wait(2500);

  await btn('More').click();
  await wait(400);
  await btn('Pet card').click();
  await wait(2500);
  check((await page.locator('.gene').count()) > 8, 'pet card shows genes');
  await shot('05-card');
  await btn('Close').click();
  await care('Sleep').click();
  await wait(3500);
  check((await page.locator('.actions button.active').count()) === 1, 'pet goes to sleep');
  // (software WebGL runs the room in slow motion, so the walk to bed takes much longer there)
  const snored = await page.waitForFunction(() => window.__sfx.includes('snore'), null, { timeout: software ? 90000 : 15000 }).then(() => true, () => false);
  check(snored, 'sleeping pet snores');
  await shot('06-sleep');
  await care('Wake').click();
  await wait(1500);

  // ---- coming back after a while: a greeting ----
  if (!(await page.locator('.panel').count())) await page.locator('.toggle').click();
  await page.locator('.panel button', { hasText: '+1h' }).click();
  await wait(800);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__stage, null, { timeout: 120000 });
  const greeted = await page.locator('.bubble').waitFor({ timeout: software ? 90000 : 8000 }).then(() => page.locator('.bubble').textContent(), () => '');
  const GREETS = ["You're back!!", 'I missed you SO much!', 'Yay! Yay! You came back!', 'Hi! I missed you!', 'Welcome back!', 'There you are!', 'Oh! Hi there.', 'You came back!', 'Hello again!', '...hi.', '*peeks*', "Oh... it's you."];
  check(GREETS.includes(greeted), `pet greets you when you come back ("${greeted}")`);
  await wait(800);
  await shot('06b-greet');
  await wait(3000);

  // ---- growing up with the dev clock ----
  const dev = async (label) => {
    if (!(await page.locator('.panel').count())) await page.locator('.toggle').click();
    await page.getByRole('button', { name: label, exact: true }).click();
    await wait(400);
  };
  const dismissEvo = async () => {
    if (!(await evo())) return false;
    // teen: "Yay!" after the reveal; adult: "Amazing!" on the card a bit later. Wait for whichever shows.
    const yay = page.getByRole('button', { name: 'Yay!' });
    const amazing = page.getByRole('button', { name: 'Amazing!' });
    await Promise.race([yay.waitFor(), amazing.waitFor()]);
    if (await yay.count()) await yay.click();
    else {
      await wait(600);
      await shot('07-adult-card');
      await amazing.click();
    }
    await wait(600);
    return true;
  };
  const act = async (name) => {
    if (await evo()) return;
    await care(name).click();
    await wait(300);
  };
  const more = async (name) => {
    if (await evo()) return;
    await btn('More').click();
    await wait(350);
    await page.locator('.grid button', { hasText: name }).click();
    await wait(400);
  };
  let grown = 0;
  for (let day = 0; day < 7 && grown < 2; day++) {
    if (!(await page.locator('.actions button.active').count())) await act('Sleep');
    await dev('+1 day');
    if (await dismissEvo()) grown++;
    if (await page.locator('.actions button.active').count()) await act('Wake');
    for (const a of ['Feed', 'Play', 'Play', 'Feed', 'Play']) await act(a);
    await more('Train');
    await more('Train');
    await more('Bath');
    if (await dismissEvo()) grown++;
  }
  check(grown === 2, 'evolved to Teen and Adult');
  await wait(3000);
  await shot('08-adult-room');

  // ---- furniture: collision + taps ----
  if (await page.locator('.actions button.active').count()) await care('Wake').click();
  await wait(2500);
  let overlap = 0;
  for (let i = 0; i < 30; i++) {
    await wait(150);
    const d = await page.evaluate(() => window.__stage.debugPet());
    for (const o of d.obstacles) if (o.id !== d.enterId) overlap = Math.max(overlap, o.r + d.r - Math.hypot(d.x - o.x, d.z - o.z));
  }
  check(overlap < 0.02, `pet never stands inside furniture (max overlap ${overlap.toFixed(3)})`);
  const tap = async (id) => {
    const p = await page.evaluate((i) => window.__stage.screenPosOf(i), id);
    await page.mouse.click(p.x, p.y);
  };
  await tap('plant1');
  await wait(2000);
  await shot('09-plant');

  // ---- volleyball ----
  await wait(2000);
  // the dev clock has moved on several days since the wish check: read today's wish now
  const matchWish = (await page.locator('.wish').getAttribute('data-kind')) === 'match' && !(await page.locator('.wish.done').count());
  await more('Volleyball');
  await wait(3000);
  check((await page.locator('.bond').textContent()).includes('listens'), 'match screen shows how well the pet listens');
  await shot('10-battle-pick');
  await page.locator('.fight').first().click();
  await page.waitForFunction(() => !!window.__court, null, { timeout: 120000 });
  await page.locator('.moves button', { hasText: 'Cheer' }).click();
  await wait(5000);
  await shot('11a-match');
  const midScore = await page.locator('.nums').textContent();
  await page.waitForSelector('.result', { timeout: 240000 });
  check(true, `volleyball match finished (${(await page.locator('.final').textContent()).trim()}, mid-match ${midScore.replace(/\s+/g, ' ').trim()})`);
  const dbg = await page.evaluate(() => window.__court.debug());
  const close = Object.entries(dbg.byPhase).filter(([, q]) => q < 0.9).map(([k, q]) => `${k} ${q}`);
  check(dbg.closest >= 0.99, `the ball never goes through a pet (closest ${dbg.closest}, 1 = touching)`);
  // the moves themselves should already avoid the pets; software WebGL (~4 fps) fires them up to a frame late
  check(software || dbg.planned >= 0.9, `the moves keep the ball off the pets (${dbg.planned}${close.length ? '; ' + close.join(', ') : ''})`);
  const finalScore = (await page.locator('.final').textContent()).split('–').map(Number);
  check(Math.max(...finalScore) === 5, 'match is first to 5');
  if (matchWish) check((await page.locator('.box').textContent()).includes('Wish granted'), 'the daily wish (match) is granted by playing');
  const matchSounds = await page.evaluate(() => window.__sfx.slice(-300));
  check(['serve', 'whistle'].every((n) => matchSounds.includes(n)) && matchSounds.some((n) => ['bump', 'spike'].includes(n)), 'match sounds play');
  await shot('11-battle-result');
  await btn('Back home').click();
  await wait(1500);
  // let any scene the player started finish first (slow under software WebGL)
  await page.waitForFunction(() => !window.__stage.debugPet().busy, null, { timeout: software ? 90000 : 20000 }).catch(() => {});
  const before = await page.evaluate(() => window.__sfx.length);
  await wait(10000); // leave the pet alone: its idle wandering must stay quiet
  const idle = await page.evaluate((n) => window.__sfx.slice(n).filter((s) => ['jump', 'pat', 'step'].includes(s)), before);
  check(idle.length === 0, `idle pet makes no movement sounds${idle.length ? ` (heard ${idle.join(' ')})` : ''}`);

  // ---- decorate ----
  await btn('More').click();
  await wait(400);
  await btn('Decorate room').click();
  await wait(1500);
  await page.locator('.item', { hasText: 'Cushion' }).click();
  await page.locator('.item', { hasText: 'Toy box' }).click();
  const bed = await page.evaluate(() => window.__stage.screenPosOf('bed1'));
  await page.mouse.move(bed.x, bed.y);
  await page.mouse.down();
  await page.mouse.move(bed.x + 80, bed.y + 60, { steps: 10 });
  await page.mouse.up();
  await btn('Rotate').click();
  await page.getByRole('tab', { name: 'Walls' }).click();
  await page.getByRole('button', { name: 'Mint' }).click();
  await page.getByRole('tab', { name: 'Floor' }).click();
  await page.getByRole('button', { name: 'Checker' }).click();
  await wait(600);
  await shot('12-decorate');
  await btn('Done').click();
  await wait(1500);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__stage, null, { timeout: 120000 });
  await wait(3500);
  const room = await page.evaluate(() => JSON.parse(localStorage['pocketpet.db.v1']).room);
  check(room?.wall === 'mint' && room.floor === 'checker' && room.items.some((i) => i.kind === 'toybox'), 'decorated room is saved and survives a reload');
  await shot('13-room-after-reload');

  // ---- sound toggle ----
  await btn('More').click();
  await wait(400);
  await btn('Turn sound off').click();
  await wait(300);
  await shot('13b-sound-off');
  check(await btn('Turn sound on').isVisible(), 'sound can be muted');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__stage, null, { timeout: 120000 });
  await btn('More').click();
  await wait(400);
  check(await btn('Turn sound on').isVisible(), 'mute is remembered after a reload');
  await btn('Turn sound on').click();
  await btn('Close').click();

  // ---- seed lab ----
  await page.goto(`${URL}/?lab&seed=MO1-3E&stage=adult&top=playful&second=calm&yaw=0.4`, { waitUntil: 'domcontentloaded' });
  await page.locator('.gene').first().waitFor({ timeout: 120000 });
  await wait(5500);
  await shot('14-seed-lab');
  check((await page.locator('.gene').count()) > 8, 'Seed Lab shows genes');
} catch (err) {
  const msg = 'crashed: ' + err.message.split('\n').slice(0, 4).join(' | ');
  console.log('FAIL ' + msg);
  failures.push(msg);
  await shot('crash').catch(() => {});
} finally {
  await browser.close();
  stop();
}

check(errors.length === 0, `no page errors${errors.length ? ':\n  ' + [...new Set(errors)].join('\n  ') : ''}`);
console.log(failures.length ? `\n${failures.length} check(s) failed. Screenshots in ${OUT}/` : `\nAll checks passed. Screenshots in ${OUT}/`);
process.exit(failures.length ? 1 : 0);
