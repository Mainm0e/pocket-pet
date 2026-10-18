// Visual smoke test: renders the app in headless Chromium and saves screenshots.
// Setup (once):  npm i three@0.128.0 playwright      (set PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 if Chromium is preinstalled)
// Run:           node tests/render-check.js [path-to-chromium]
// Output:        screenshots/*.png and a list of page errors (must be empty).
// Three.js is loaded from node_modules instead of the CDN so it works offline.
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const root = path.join(__dirname, '..');
const outDir = path.join(root, 'screenshots');

const html = fs.readFileSync(path.join(root, 'app/index.html'), 'utf8')
  .split('https://cdn.jsdelivr.net/npm/three@0.128.0/').join(path.join(root, 'node_modules/three/') + '/')
  .replace('<link rel="stylesheet" href="https://fonts.googleapis.com', '<link rel="x-skip-offline" href="https://fonts.googleapis.com'); // no web fonts offline
const testFile = path.join(root, 'tests/.render-test.html');
fs.writeFileSync(testFile, html);

(async () => {
  const exe = process.argv[2];
  const browser = await chromium.launch({ executablePath: exe || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1700 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + testFile);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(outDir, 'app-egg.png') });

  // Hatch, then raise it mostly by playing.
  for (let i = 0; i < 9; i++) { await page.click('#warm'); await page.waitForTimeout(60); }
  await page.waitForTimeout(2300);
  for (let i = 0; i < 16; i++) {
    await page.evaluate(() => { cooldown = {}; M.busyUntil = 0; state.care.energy = 80; state.care.fullness = 60; });
    await page.click(i % 4 === 0 ? '#feed' : '#play');
    await page.waitForTimeout(40);
  }
  await page.waitForTimeout(1500);
  await page.evaluate(() => { controls.autoRotate = false; frontView(state.stage); });
  await page.screenshot({ path: path.join(outDir, 'app-raised.png') });

  // Every life stage for a few seeds, and every adult form for one seed.
  const shot = async (name) => { await page.waitForTimeout(150); await page.locator('#stage').screenshot({ path: path.join(outDir, name) }); };
  for (const seed of ['MOCHI-001', 'UNI-14', 'BAT-3']) {
    for (let st = 0; st < 5; st++) {
      await page.evaluate(([s, st]) => { dna = decode(s); showModel(dna, st, { bounce: false }); controls.autoRotate = false; M.behUntil = 1e9; }, [seed, st]);
      await shot(`stage-${seed}-${st}-${['egg', 'baby', 'child', 'teen', 'adult'][st]}.png`);
    }
  }
  for (const f of ['Sweet', 'Chonky', 'Sporty', 'Dreamy', 'Radiant', 'Scruffy']) {
    await page.evaluate((f) => { dna = decode('BAT-3'); showModel(dna, 4, { bounce: false, form: f }); controls.autoRotate = false; M.behUntil = 1e9; }, f);
    await shot(`form-BAT-3-${f}.png`);
  }
  console.log('page errors:', errors.length ? errors : 'none');
  await browser.close();
  fs.unlinkSync(testFile);
  process.exit(errors.length ? 1 : 0);
})();
