// Agent Tix — the page must not move on its own
//
//   node agent-tix/widget/tests/no-autoscroll.test.mjs
//
// Reported 9 September 2026. The "tonight" page carries three day-dated
// widgets. Opening it, or refreshing it, threw the guest straight down to the
// third one before they had read anything.
//
// A day-dated widget opens its night from boot, and openNight scrolls to
// itself — correct when a guest picks a date, wrong when the widget is merely
// loading. Three of them meant three scrolls, and the last one won.
//
// Driven through a real browser on a tall page, because this is entirely about
// where the viewport ends up.

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
async function loadPlaywright() {
  try { return await import('playwright'); }
  catch {
    const root = execSync('npm root -g', { encoding: 'utf8' }).trim();
    return await import(pathToFileURL(path.join(root, 'playwright', 'index.js')).href);
  }
}
const pw = await loadPlaywright();
const chromium = pw.chromium ?? pw.default.chromium;

const events = JSON.parse(fs.readFileSync(path.join(HERE, 'calendar.json'), 'utf8'));
const night  = JSON.parse(fs.readFileSync(path.join(HERE, 'night.json'), 'utf8'));
const frag   = fs.readFileSync(path.join(HERE, '..', 'paste-into-tilda-header.html'), 'utf8');

let pass = 0, fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail ? '  -> ' + detail : '')); }
};

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
const ctx = await browser.newContext({ viewport: { width: 420, height: 820 } });  // a phone
const page = await ctx.newPage();

await page.route('**/functions/v1/**', async (route) => {
  const body = JSON.parse(route.request().postData() || '{}');
  if (route.request().url().endsWith('/availability')) {
    return route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify(body.action === 'events' ? events : night) });
  }
  return route.fulfill({ status: 200, contentType: 'application/json', body: '{"warm":true}' });
});

// The tonight page: some copy, then three day-dated widgets down the page.
await page.route('https://muaytix.test/**', route => route.fulfill({
  status: 200, contentType: 'text/html',
  body: `<!doctype html><html><head><meta charset="utf-8"><title>Tonight</title>${frag}</head>
  <body style="background:#fff;margin:0">
    <div style="height:900px;padding:20px"><h1>Tonight at Rajadamnern</h1></div>
    <div class="muaytix-ticket-selector" data-event-id="rajadamnern_knockout_2026_09_11"></div>
    <div style="height:600px"></div>
    <div class="muaytix-ticket-selector" data-event-id="new_power_2026_09_09"></div>
    <div style="height:600px"></div>
    <div class="muaytix-ticket-selector" data-event-id="rws_2026_09_12"></div>
    <div style="height:900px"></div>
  </body></html>`,
}));

page.on('pageerror', e => { fail++; console.log('  FAIL page error -> ' + e.message); });

console.log('\nThree day-dated widgets on one page');

await page.goto('https://muaytix.test/tonight', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-out] .mtx-tix, [data-out] .mtx-band', { timeout: 12000 });
await new Promise(r => setTimeout(r, 2500));      // let any smooth scroll finish

const y = await page.evaluate(() => window.scrollY);
check('the page has not moved on load', y === 0, 'scrollY=' + y);

// And again on a refresh, which is how it was reported.
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-out] .mtx-tix, [data-out] .mtx-band', { timeout: 12000 });
await new Promise(r => setTimeout(r, 2500));

const y2 = await page.evaluate(() => window.scrollY);
check('the page has not moved on refresh', y2 === 0, 'scrollY=' + y2);

// All three still loaded their night — the fix must not have broken them.
const loaded = await page.$$eval('.muaytix-ticket-selector',
  els => els.map(e => !!e.querySelector('[data-out] .mtx-tix, [data-out] .mtx-band')));
check('all three widgets still opened their night',
      loaded.length === 3 && loaded.every(Boolean), JSON.stringify(loaded));

// The scroll must still happen when a guest actually picks a date, so the
// calendar widget is not left feeling broken on a phone.
await page.route('https://muaytix.test/cal', route => route.fulfill({
  status: 200, contentType: 'text/html',
  body: `<!doctype html><html><head><meta charset="utf-8"><title>Calendar</title>${frag}</head>
  <body style="background:#fff;margin:0">
    <div style="height:900px;padding:20px"><h1>All dates</h1></div>
    <div class="muaytix-ticket-selector"></div>
    <div style="height:900px"></div>
  </body></html>`,
}));

console.log('\nPicking a date still takes the guest to the night');
await page.goto('https://muaytix.test/cal', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-grid] [data-date]', { timeout: 12000 });
await new Promise(r => setTimeout(r, 1200));
const before = await page.evaluate(() => window.scrollY);
check('calendar page also sits still on load', before === 0, 'scrollY=' + before);

await page.click('[data-grid] [data-date="2026-09-05"]');
await new Promise(r => setTimeout(r, 2500));
const after = await page.evaluate(() => window.scrollY);
check('choosing a date does still move the page to it', after > before, 'before=' + before + ' after=' + after);

await browser.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
