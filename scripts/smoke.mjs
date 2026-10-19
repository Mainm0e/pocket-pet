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
  for (const a of ['Feed', 'Play']) {
    await btn(a).click();
    await wait(2500);
  }
  await shot('04-care');
  await btn('More').click();
  await wait(400);
  await btn('Pet card').click();
  await wait(2500);
  check((await page.locator('.gene').count()) > 8, 'pet card shows genes');
  await shot('05-card');
  await btn('Close').click();
  await btn('Sleep').click();
  await wait(3500);
  check((await page.locator('.actions button.active').count()) === 1, 'pet goes to sleep');
  await shot('06-sleep');
  await btn('Wake').click();
  await wait(1500);

  // ---- growing up with the dev clock ----
  const dev = async (label) => {
    if (!(await page.locator('.panel').count())) await page.locator('.toggle').click();
    await page.getByRole('button', { name: label, exact: true }).click();
    await wait(400);
  };
  const dismissEvo = async () => {
    if (!(await evo())) return false;
    await wait(4500);
    if (await page.getByRole('button', { name: 'Yay!' }).count()) await page.getByRole('button', { name: 'Yay!' }).click();
    else {
      await wait(2600);
      await shot('07-adult-card');
      await page.getByRole('button', { name: 'Amazing!' }).click();
    }
    await wait(600);
    return true;
  };
  const act = async (name) => {
    if (await evo()) return;
    await btn(name).click();
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
  if (await page.locator('.actions button.active').count()) await btn('Wake').click();
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

  // ---- battle ----
  await wait(2000);
  await more('Battle');
  await wait(3000);
  await shot('10-battle-pick');
  await page.locator('.fight').first().click();
  await wait(2000);
  await page.locator('.moves button', { hasText: 'Cheer' }).click();
  await page.waitForSelector('.result', { timeout: 90000 });
  check(true, 'battle finished');
  await shot('11-battle-result');
  await btn('Back home').click();
  await wait(1500);

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

  // ---- seed lab ----
  await page.goto(`${URL}/?lab&seed=MO1-3E&stage=adult&top=playful&second=calm&yaw=0.4`, { waitUntil: 'domcontentloaded' });
  await page.locator('.gene').first().waitFor({ timeout: 120000 });
  await wait(5500);
  await shot('14-seed-lab');
  check((await page.locator('.gene').count()) > 8, 'Seed Lab shows genes');
} catch (err) {
  const msg = 'crashed: ' + err.message.split('\n')[0];
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
