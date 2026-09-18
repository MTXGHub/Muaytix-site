// Agent Tix — the seat step has to say yes
//
//   node agent-tix/widget/tests/seat-tiles.test.mjs
//
// Jason, 18 September 2026. Three amber "Limited" labels and one red, no price,
// no reason to choose, and four seat-class colours that mean nothing to someone
// who has never been. He watched a friend reach this screen and stall — not
// over how to tap a tile, over which one was hers.
//
// So: green fill and AVAILABLE for anything bookable, the number only once it is
// genuinely down to the last few, the strip and border carrying availability
// rather than seat class, and a price in the guest's own currency — never baht
// unless the device is actually Thai, because every baht payment costs us FX on
// a margin that is already thin.

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

const night  = JSON.parse(fs.readFileSync(path.join(HERE, 'night.json'), 'utf8'));
const events = JSON.parse(fs.readFileSync(path.join(HERE, 'calendar.json'), 'utf8'));
const frag   = fs.readFileSync(path.join(HERE, '..', 'paste-into-tilda-header.html'), 'utf8');

let pass = 0, fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail ? '  -> ' + detail : '')); }
};

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);

// Tonight's shape: one class wide open, one down to three, one gone, one closed.
function nightWith() {
  const n = JSON.parse(JSON.stringify(night));
  for (const c of n.classes) {
    if (c.code === 'ringside')    { c.status = 'available';    c.seatsLeft = null; }
    if (c.code === 'club_class')  { c.status = 'limited';      c.seatsLeft = 3; }
    if (c.code === 'leo_section') { c.status = 'fully_booked'; c.seatsLeft = null; }
    if (c.code === 'third_class') { c.status = 'available';    c.seatsLeft = null; }
  }
  return n;
}

async function open(locale) {
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 }, locale });
  const page = await ctx.newPage();
  await page.route('**/functions/v1/**', async (route) => {
    const body = JSON.parse(route.request().postData() || '{}');
    if (route.request().url().endsWith('/availability')) {
      return route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify(body.action === 'events' ? events : nightWith()) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{"warm":true}' });
  });
  await page.route('https://muaytix.test/**', r => r.fulfill({
    status: 200, contentType: 'text/html',
    body: `<!doctype html><html><head><meta charset="utf-8"><title>T</title>${frag}</head>
    <body style="margin:0"><div class="muaytix-ticket-selector" data-event-id="rws_2026_09_19"></div></body></html>`,
  }));
  page.on('pageerror', e => { fail++; console.log('  FAIL page error -> ' + e.message); });
  await page.goto('https://muaytix.test/x', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-pick]', { timeout: 12000 });
  return page;
}

const text = (s) => s.replace(/\s+/g, ' ').trim();
const rgb  = (s) => s.replace(/\s/g, '');

console.log('\nThe seat step');
let page = await open('en-GB');

// --- the words ---
const all = text(await page.innerText('[data-grid], .mtx-picker') || '');
const grid = text(await page.innerText('.mtx-picker'));
check('the word "Limited" is gone', !/limited/i.test(grid), grid);
check('open classes say AVAILABLE', (grid.match(/AVAILABLE/g) || []).length === 2, grid);
check('the low one says its number', /ONLY 3 LEFT/.test(grid), grid);
check('a sold-out class says so plainly', /SOLD OUT/i.test(grid), grid);

// --- the reason to choose ---
check('each tile carries its reason', await page.locator('.mtx-pick-why').count() === 4);
check('Ringside says closest to the action',
  /closest to the action/i.test(await page.locator('[data-pick="ringside"] .mtx-pick-why').innerText()));

// --- the colours ---
const ring = page.locator('[data-pick="ringside"]');
const leo  = page.locator('[data-pick="leo_section"]');
const club = page.locator('[data-pick="club_class"]');
const bar = (l) => l.locator('.mtx-pick-bar').evaluate(e => getComputedStyle(e).backgroundColor);
const brd = (l) => l.evaluate(e => getComputedStyle(e).borderTopColor);
const GREEN = 'rgb(0,165,80)', RED = 'rgb(156,31,31)';

check('an available strip is green', rgb(await bar(ring)) === GREEN, await bar(ring));
check('an available border is green', rgb(await brd(ring)) === GREEN, await brd(ring));
check('only-3-left keeps a GREEN frame — it can still be booked',
  rgb(await bar(club)) === GREEN && rgb(await brd(club)) === GREEN, await bar(club));
check('sold out turns the frame red', rgb(await bar(leo)) === RED, await bar(leo));
check('no seat-class colour survives on the tile',
  ![await bar(ring), await bar(leo), await bar(club)].some(c => /255,212,0|58,134,212|232,99,26/.test(rgb(c))));

// --- nothing a guest can still buy is painted red ---
const badge = (l) => l.locator('.mtx-avail').evaluate(e => ({
  bg: getComputedStyle(e).backgroundColor.replace(/\s/g, ''),
  fg: getComputedStyle(e).color.replace(/\s/g, ''),
}));
const clubBadge = await badge(club), ringBadge = await badge(ring), leoBadge = await badge(leo);
check('"only 5 left" is green, not red', clubBadge.bg === GREEN, JSON.stringify(clubBadge));
check('available is green', ringBadge.bg === GREEN, JSON.stringify(ringBadge));
check('sold out is a solid red badge, not a pale ghost',
  leoBadge.bg === RED && leoBadge.fg === 'rgb(255,255,255)', JSON.stringify(leoBadge));
check('a sold-out tile stays readable', await leo.evaluate(e => {
  const o = getComputedStyle(e).opacity; return o === '' || Number(o) >= 0.99;
}));

// --- the four tiles line up ---
const boxes = await page.locator('.mtx-pick').evaluateAll(
  els => els.map(e => Math.round(e.getBoundingClientRect().bottom)));
const rowA = boxes.slice(0, 2), rowB = boxes.slice(2);
check('the top row has one flat bottom edge', Math.abs(rowA[0] - rowA[1]) <= 1, rowA.join(' vs '));
check('the bottom row has one flat bottom edge', Math.abs(rowB[0] - rowB[1]) <= 1, rowB.join(' vs '));
const badges = await page.locator('.mtx-avail').evaluateAll(
  els => els.map(e => Math.round(e.getBoundingClientRect().bottom)));
check('all four badges sit on the same baseline in their row',
  Math.abs(badges[0] - badges[1]) <= 1 && Math.abs(badges[2] - badges[3]) <= 1, badges.join(' '));
check('a badge is a badge, not a blob', await page.locator('.mtx-avail').first()
  .evaluate(e => e.getBoundingClientRect().height < 48));

// --- the chosen-class panel must not borrow the reserve button's styling ---
// --- it looks pressable ---
check('a bookable tile has an arrow', await ring.locator('.mtx-pick-go').count() === 1);
check('a sold-out tile has none', await leo.locator('.mtx-pick-go').count() === 0);
check('a sold-out tile cannot be pressed', await leo.isDisabled());
check('no tile begs to be tapped', !/tap to book|click here/i.test(grid), grid);

// --- the price, and the currency it is in ---
check('every bookable tile shows a price', await page.locator('.mtx-pick-price').count() >= 3);
const ukPrice = await ring.locator('.mtx-pick-price').innerText();
check('a UK phone is priced in pounds', ukPrice.includes('£'), ukPrice);
check('a UK phone is never shown baht', !/THB|฿/.test(grid), grid);
await page.context().close();

// Checked by amount, not by symbol. A guest sees their own money written the way
// their own phone writes it, so an Australian gets a plain "$" for Australian
// dollars exactly as they would anywhere else — the amount is what proves the
// right currency was chosen. Ringside on this night: £57 / $77 / €67 / A$109.
for (const [locale, amount, who] of [
  ['en-US', '77',  'an American phone is priced in US dollars'],
  ['de-DE', '67',  'a German phone is priced in euros'],
  ['en-AU', '109', 'an Australian phone is priced in Australian dollars'],
  ['ja-JP', '77',  'a Japanese phone falls back to US dollars'],
]) {
  page = await open(locale);
  const p = await page.locator('[data-pick="ringside"] .mtx-pick-price').innerText();
  check(who, p.includes(amount), p);
  check(who.split(' is ')[0] + ' is never shown baht',
    !/THB|฿/.test(text(await page.innerText('.mtx-picker'))));
  await page.context().close();
}

page = await open('th-TH');
const thai = await page.locator('[data-pick="ringside"] .mtx-pick-price').innerText();
check('a Thai phone — and only a Thai phone — is priced in baht', /THB|฿/.test(thai), thai);
await page.context().close();

// --- the currency carries into the next screen ---
page = await open('en-GB');
await page.click('[data-pick="ringside"]');
await page.waitForSelector('select[data-cur]', { timeout: 8000 });
const chosen = await page.$eval('select[data-cur]', e => e.value);
check('the next screen opens on the same currency, not baht', chosen === 'gbp', chosen);

// mtx-go is the reserve button. A status badge that borrows it comes out as a
// full-width black bar, which is what shipped the first time.
const panelPill = await page.locator('.mtx-detail .mtx-pill').evaluate(e => ({
  bg: getComputedStyle(e).backgroundColor.replace(/\s/g, ''),
  h: Math.round(e.getBoundingClientRect().height),
}));
check('the chosen-class badge is not the reserve button in disguise',
  panelPill.bg !== 'rgb(20,17,14)' && panelPill.h < 48, JSON.stringify(panelPill));
await page.context().close();

await browser.close();
console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
