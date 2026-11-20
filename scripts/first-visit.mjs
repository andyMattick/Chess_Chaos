/**
 * First-time visitor walkthrough, for the weekly check.
 *
 * A brand-new player on a phone (no save): opens the app, makes a player,
 * looks at Home, plays a few moves against the first bot, opens Party match,
 * Puzzles and Game modes, and comes back Home. Saves a screenshot of every
 * step and a report of anything that went wrong (page errors, blank screens,
 * steps that could not be found, slow screens).
 *
 *   node scripts/first-visit.mjs [url=http://localhost:5174] [outDir=first-visit]
 *
 * Needs Playwright (set PLAYWRIGHT=/path/to/playwright/index.mjs if it is not
 * installed in the repo). Writes <outDir>/report.json and <outDir>/NN-step.png.
 */
import { mkdirSync, writeFileSync } from 'node:fs';

const URL_ = process.argv[2] ?? 'http://localhost:5174';
const OUT = process.argv[3] ?? 'first-visit';
const pw = await import(process.env.PLAYWRIGHT ?? 'playwright');
const { chromium } = pw.default ?? pw;
mkdirSync(OUT, { recursive: true });

const report = { url: URL_, date: new Date().toISOString(), steps: [], errors: [], console: [] };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
page.on('pageerror', (e) => report.errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') report.console.push(m.text().slice(0, 200)); });

let n = 0;
async function step(name, fn) {
  const t0 = Date.now();
  let ok = true, note = '';
  try { await fn(); } catch (e) { ok = false; note = String(e).split('\n')[0].slice(0, 200); }
  await page.waitForTimeout(250);
  const text = (await page.locator('body').innerText().catch(() => '')).trim();
  const file = `${String(++n).padStart(2, '0')}-${name.replace(/\W+/g, '-').toLowerCase()}.png`;
  await page.screenshot({ path: `${OUT}/${file}` }).catch(() => {});
  report.steps.push({ step: name, ok, ms: Date.now() - t0, blank: text.length < 20, words: text.split(/\s+/).length, screenshot: file, note, firstText: text.slice(0, 160).replace(/\s+/g, ' ') });
}

const home = async () => {
  const b = page.getByRole('button', { name: /^← (Home|Back)$/ }).first();
  await b.scrollIntoViewIfNeeded({ timeout: 5000 });
  await b.click({ timeout: 8000 });
};

await step('open the app', async () => { await page.goto(URL_); await page.waitForLoadState('networkidle'); });
await step('make a player', async () => { await page.getByLabel('Nickname').fill('Newbie'); await page.getByText("Let's go!").click(); });
await step('player number question (say not now)', async () => {
  // Owner, 2026-11-18: new players are asked once for a player number. A first visitor can say no.
  const ask = page.locator('.number-modal');
  if (await ask.waitFor({ timeout: 3000 }).then(() => true).catch(() => false)) await ask.getByRole('button', { name: 'Not now' }).click();
});
await step('home screen', async () => { await page.getByText('Play the bots').waitFor({ timeout: 5000 }); });
await step('open the bot path', async () => { await page.getByText('Play the bots').click(); });
await step('pick the first bot', async () => { await page.locator('.path-info').first().click(); });
await step('start as white', async () => { await page.getByText(/White \(move first\)/).click(); await page.waitForSelector('svg.board'); });
await step('play three moves', async () => {
  for (let k = 0; k < 3; k++) {
    await page.waitForFunction(() => /Your move/.test(document.body.innerText) || document.querySelector('.result-card'), null, { timeout: 20000 });
    const before = await page.locator('.moves .mv').count();
    let moved = false;
    for (const s of await page.$$eval('[data-square]', (els) => els.map((e) => e.getAttribute('data-square')))) {
      await page.click(`[data-square="${s}"]`, { force: true });
      const t = await page.$$('.target-dot, .target-ring');
      if (t.length) { const bb = await t[0].boundingBox(); await page.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2); moved = true; break; }
    }
    if (!moved) throw new Error('could not find a move to tap');
    await page.waitForFunction((b) => document.querySelectorAll('.moves .mv').length > b + 1 || document.querySelector('.result-card'), before, { timeout: 20000 });
  }
});
await step('back home from a game', async () => { await home(); await page.getByText('Play the bots').waitFor({ timeout: 5000 }); });
await step('party match setup', async () => { await page.getByText('Party match').click(); await page.waitForTimeout(1500); });
await step('home again', async () => { await home(); });
await step('puzzles', async () => { await page.getByText('Puzzles', { exact: true }).first().click(); await page.getByText('find the trick').waitFor({ timeout: 5000 }); });
await step('home again 2', async () => { await home(); });
await step('game modes', async () => { await page.getByText('Game modes', { exact: true }).first().click(); });
await step('home again 3', async () => { await home(); });
await step('settings', async () => { await page.getByText('⚙️ Settings').click(); });

report.ok = report.steps.every((s) => s.ok && !s.blank) && !report.errors.length;
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ok: report.ok, failed: report.steps.filter((s) => !s.ok || s.blank).map((s) => `${s.step}: ${s.note || 'blank screen'}`), errors: report.errors }, null, 2));
await browser.close();
