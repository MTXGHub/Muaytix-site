// Agent Tix — where a guest lands when Stripe's back arrow sends them home
//
//   PGHOST=/tmp PGPORT=5544 PGUSER=postgres CHROMIUM_PATH=... node agent-tix/widget/tests/guest-hold-scroll.test.mjs
//
// Stripe's back arrow opens the page the guest pressed Reserve on, with
// ?checkout=cancelled on the end. That is a fresh page load, so the browser starts
// at the top (the hero heading). The green "tickets are held" bar is far below it,
// inside the widget, and only exists once the hold has been fetched.
//
// What has to hold, from Jason's report of 10 October 2026:
//
//   Back from Stripe with a live hold: the green bar is in view near the top of the
//   screen, clear of the site's fixed header. On a desktop and on a phone. On a
//   fresh load and when the browser hands back a kept page. Waits for the bar to be
//   drawn, because the hold is fetched after the page loads.
//
//   Hold already run out (or none can be found): land at the top of the widget.
//
//   Any other visit moves nothing, and a guest who scrolls for themselves is never
//   dragged back.
//
// The real widget (the built header block), a real browser, the REAL availability
// and create-checkout code over a scratch Postgres, and a fake Stripe. The page
// around the widget has a tall hero and a fixed header, like the Tilda pages.

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { makeDb, buildCreateCheckout, buildAvailability, seed, resetClub } from '../../functions/tests/pg-harness.mjs';

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
const devices = pw.devices ?? pw.default.devices;

const header = fs.readFileSync(path.join(HERE, '..', 'paste-into-tilda-header.html'), 'utf8');

let pass = 0, fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail ? '  -> ' + detail : '')); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const db = makeDb('holdtest_scroll');
try { db.create(); } catch (e) {
  console.log('Cannot reach a scratch Postgres (set PGHOST / PGPORT / PGUSER): ' + String(e.stderr ?? e.message).trim());
  process.exit(2);
}
seed(db);

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const FIXED = 72;                       // the site's fixed header, in pixels
const PATH_ = '/rajadamnern-knockout/2026-10-12';

let fns = null;
async function freshFunctions() {
  fns = { checkout: await buildCreateCheckout(db, {}), avail: buildAvailability(db) };
}

// A page like the live ones: a fixed menu, a tall hero with the H1, then the
// widget, then a long page below it. `late` adds a picture above the widget that
// arrives after everything else and pushes the widget down.
function pageHtml({ late = false, hdr = header } = {}) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Page</title>${hdr}</head>
    <body style="margin:0">
      <div id="site-header" style="position:fixed;top:0;left:0;right:0;height:${FIXED}px;background:#222;color:#fff;z-index:9999">Menu</div>
      <div style="height:${FIXED}px"></div>
      <h1 id="hero" style="margin:0;height:700px">Hero heading</h1>
      ${late ? '<img id="late" src="/late.svg" alt="" style="display:block;width:100%">' : ''}
      <div id="host"><div class="muaytix-ticket-selector" data-event-id="test_night_1"></div></div>
      <div style="height:3000px">after</div>
    </body></html>`;
}

// One guest: their own browser context. `device` is a Playwright device name for a phone.
async function guest({ device = null, late = false, availDelay = 0 } = {}) {
  const ctx = await browser.newContext(device
    ? { ...devices[device] }
    : { viewport: { width: 1180, height: 900 }, locale: 'en-GB' });
  await ctx.route('https://jlwopomkqeawrxlapwpc.supabase.co/functions/v1/**', async (route) => {
    const url = route.request().url();
    const fn = url.endsWith('/create-checkout') ? fns.checkout : fns.avail;
    const bodyText = route.request().postData() || '{}';
    const body = JSON.parse(bodyText);
    if (fn === fns.checkout && body.action === 'warm') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"warm":true}', headers: { 'access-control-allow-origin': '*' } });
    }
    // Slows the hold answer down, so the bar appears well after the page has loaded.
    if (availDelay && body.action === 'hold') await sleep(availDelay);
    const res = await fn.handle(new Request(url, { method: 'POST', headers: { origin: 'https://muaytix.com', 'content-type': 'application/json', referer: 'https://muaytix.com' + PATH_ }, body: bodyText }));
    return route.fulfill({ status: res.status, contentType: 'application/json', body: await res.text(), headers: { 'access-control-allow-origin': '*' } });
  });
  await ctx.route('https://checkout.stripe.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Stripe</title><h1>stripe</h1>' }));
  await ctx.route('https://muaytix.com/late.svg', async (r) => {
    await sleep(1800);
    r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500"><rect width="800" height="500" fill="#ccc"/></svg>' });
  });
  await ctx.route('https://muaytix.com/**', (r) => {
    if (r.request().url().endsWith('/late.svg')) return r.fallback();
    return r.fulfill({ status: 200, contentType: 'text/html', body: pageHtml({ late }) });
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { fail++; console.log('  FAIL page error -> ' + e.message); });
  return {
    ctx, page,
    async reserveOnce(n = 2) {                       // press Reserve and arrive at Stripe
      await page.goto('https://muaytix.com' + PATH_, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('[data-pick="club_class"]', { timeout: 15000 });
      await page.click('[data-pick="club_class"]');
      await page.selectOption('#mtxQty', String(n));
      await page.click('[data-go]');
      await page.waitForURL(/checkout\.stripe\.com/, { timeout: 15000 });
    },
    // Stripe's back arrow: the cancel address, a brand new page load.
    async comeBack(query = '?checkout=cancelled') {
      await page.goto('https://muaytix.com' + PATH_ + query, { waitUntil: 'domcontentloaded' });
    },
    // Where things are, in the visible screen.
    async where() {
      return page.evaluate(() => {
        const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), hidden: !!e.hidden }; };
        return { scrollY: Math.round(window.scrollY), vh: window.innerHeight, bar: r('.mtx-hold'), host: r('#host'), hero: r('#hero') };
      });
    },
  };
}

// The bar is "in view near the top": below the fixed header, not far below it, and wholly on screen.
const barOk = (w, gap = FIXED) => w.bar && !w.bar.hidden && w.bar.top >= gap - 1 && w.bar.top <= gap + 60 && w.bar.bottom <= w.vh;
const show = (w) => JSON.stringify(w);

// ---------------------------------------------------------------------------
console.log('\nBack from Stripe on a computer, hold still live');
{
  resetClub(db); await freshFunctions();
  const a = await guest();
  await a.reserveOnce(2);
  await a.comeBack();
  await a.page.waitForSelector('.mtx-hold:not([hidden])', { timeout: 15000 });
  await sleep(600);
  const w = await a.where();
  if (process.env.SHOTS) await a.page.screenshot({ path: process.env.SHOTS + '/computer.jpg', type: 'jpeg', quality: 70 });
  check('the green bar is on screen, just under the fixed header', barOk(w), show(w));
  check('and the page is not sitting at the top', w.scrollY > 300, show(w));
  check('the hero heading is not what the guest is looking at', w.hero.bottom < FIXED + 5, show(w));
  const n = await a.page.textContent('.mtx-hold');
  check('and it is the held-tickets bar', /Your 2 Club Class tickets are held for \d:\d\d/.test(n) && /Continue to payment/.test(n) && /Change tickets/.test(n), n.replace(/\s+/g, ' '));
  await a.ctx.close();
}

// ---------------------------------------------------------------------------
console.log('\nBack from Stripe on a phone, hold still live');
{
  resetClub(db); await freshFunctions();
  const a = await guest({ device: 'iPhone 13' });
  await a.reserveOnce(2);
  await a.comeBack();
  await a.page.waitForSelector('.mtx-hold:not([hidden])', { timeout: 15000 });
  await sleep(600);
  const w = await a.where();
  if (process.env.SHOTS) await a.page.screenshot({ path: process.env.SHOTS + '/phone.jpg', type: 'jpeg', quality: 70 });
  check('the green bar is on screen, just under the fixed header', barOk(w), show(w));
  check('and the page is not sitting at the top', w.scrollY > 300, show(w));
  await a.ctx.close();
}

// ---------------------------------------------------------------------------
console.log('\nThe hold arrives late: the scroll waits for the bar');
{
  resetClub(db); await freshFunctions();
  const a = await guest({ availDelay: 1500 });
  await a.reserveOnce(2);
  await a.comeBack();
  await sleep(500);
  const early = await a.where();
  check('before the hold is answered the page has not been thrown anywhere', early.scrollY === 0 && (!early.bar || early.bar.hidden), show(early));
  await a.page.waitForSelector('.mtx-hold:not([hidden])', { timeout: 15000 });
  await sleep(600);
  const w = await a.where();
  check('once the bar is drawn, it is brought into view', barOk(w), show(w));
  await a.ctx.close();
}

// ---------------------------------------------------------------------------
console.log('\nA picture above the widget arrives late and pushes it down');
{
  resetClub(db); await freshFunctions();
  const a = await guest({ late: true });
  await a.reserveOnce(2);
  await a.comeBack();
  await a.page.waitForSelector('.mtx-hold:not([hidden])', { timeout: 15000 });
  await sleep(300);
  const before = await a.where();
  await a.page.waitForFunction(() => document.getElementById('late').naturalHeight > 0, null, { timeout: 15000 });
  await sleep(800);
  const w = await a.where();
  check('the picture really did move the widget', (await a.page.evaluate(() => document.getElementById('late').getBoundingClientRect().height)) > 300, show(before));
  check('and the bar is still on screen under the header afterwards', barOk(w), 'before ' + show(before) + ' after ' + show(w));
  await a.ctx.close();
}

// ---------------------------------------------------------------------------
console.log('\nA guest who scrolls for themselves is not dragged back');
{
  resetClub(db); await freshFunctions();
  const a = await guest({ availDelay: 1500 });
  await a.reserveOnce(2);
  await a.comeBack();
  await sleep(300);
  await a.page.mouse.move(300, 300);
  await a.page.mouse.wheel(0, 200);
  await sleep(400);
  const mine = (await a.where()).scrollY;
  await a.page.waitForSelector('.mtx-hold:not([hidden])', { timeout: 15000 });
  await sleep(800);
  const w = await a.where();
  check('the guest scrolled, so the bar did not move them', Math.abs(w.scrollY - mine) < 5, 'they were at ' + mine + ', now ' + show(w));
  await a.ctx.close();
}

// ---------------------------------------------------------------------------
console.log('\nHold already run out: land at the top of the widget');
{
  resetClub(db); await freshFunctions();
  const a = await guest();
  await a.reserveOnce(2);
  db.exec(`update checkout_reservations set expires_at = now() - interval '1 minute' where status = 'held'`);
  await a.comeBack();
  await a.page.waitForSelector('.mtx-detail, .mtx-pick', { timeout: 15000 });
  await sleep(1200);
  const w = await a.where();
  check('there is no green bar', !w.bar || w.bar.hidden, show(w));
  check('the top of the widget is just under the fixed header', w.host.top >= FIXED - 1 && w.host.top <= FIXED + 40, show(w));
  await a.ctx.close();
}

console.log('\nNothing remembered in this browser: land at the top of the widget');
{
  resetClub(db); await freshFunctions();
  const a = await guest();
  await a.ctx.clearCookies();
  await a.comeBack();
  await a.page.waitForSelector('.mtx-detail, .mtx-pick', { timeout: 15000 });
  await sleep(1200);
  const w = await a.where();
  check('the top of the widget is just under the fixed header', w.host.top >= FIXED - 1 && w.host.top <= FIXED + 40, show(w));
  await a.ctx.close();
}

// ---------------------------------------------------------------------------
console.log('\nAny other visit moves nothing');
{
  resetClub(db); await freshFunctions();
  const a = await guest();
  await a.reserveOnce(2);
  await a.comeBack('');                                   // same page, no ?checkout=cancelled
  await a.page.waitForSelector('.mtx-hold:not([hidden])', { timeout: 15000 });
  await sleep(800);
  const w = await a.where();
  check('a plain visit with a live hold stays at the top', w.scrollY === 0, show(w));
  await a.comeBack('?utm_source=x');
  await a.page.waitForSelector('.mtx-hold:not([hidden])', { timeout: 15000 });
  await sleep(800);
  check('and so does one with another query', (await a.where()).scrollY === 0);
  await a.ctx.close();
}

// ---------------------------------------------------------------------------
console.log('\nThe browser hands back a kept page');
{
  resetClub(db); await freshFunctions();
  const a = await guest();
  await a.reserveOnce(2);
  await a.comeBack();
  await a.page.waitForSelector('.mtx-hold:not([hidden])', { timeout: 15000 });
  await sleep(600);
  // The guest scrolls away to read, goes to Stripe's payment page and returns by the back button.
  // A real page restore cannot be forced here; this fires the same event the browser does.
  await a.page.evaluate(() => window.scrollTo(0, 0));
  await sleep(200);
  await a.page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
  await sleep(1200);
  const w = await a.where();
  check('the bar is brought back into view', barOk(w), show(w));
  await a.ctx.close();
}

await browser.close();
db.drop();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
