// Agent Tix — which advert paid for the booking
//
//   node agent-tix/widget/tests/attribution.test.mjs
//
// Google Ads says a campaign produced seven conversions. It cannot say that two
// were Club Class at £41 and the rest Third Class, and only that version of the
// number is worth spending against. So the click is caught on arrival, carried
// through the site, and sent to create-checkout with the booking.
//
// The rules that are easy to get quietly wrong, and are therefore checked here:
// first click wins, capture happens on every page rather than only where a
// widget mounts, and nothing about attribution may ever stop a ticket selling.

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
const ctx = await browser.newContext({ viewport: { width: 420, height: 900 }, locale: 'en-GB' });
const page = await ctx.newPage();

let sentToCheckout = null;
await page.route('**/functions/v1/**', async (route) => {
  const body = JSON.parse(route.request().postData() || '{}');
  if (route.request().url().endsWith('/availability')) {
    return route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify(body.action === 'events' ? events : night) });
  }
  if (body.action === 'warm') {
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{"warm":true}' });
  }
  sentToCheckout = body;
  return route.fulfill({ status: 200, contentType: 'application/json',
    body: '{"checkoutUrl":"https://checkout.stripe.test/x"}' });
});

// Two kinds of page: one with a widget, one without. Both carry the header
// block, because it lives in the site-wide head.
await page.route('https://muaytix.test/**', (route) => {
  const url = new URL(route.request().url());
  const hasWidget = url.pathname !== '/about';
  return route.fulfill({
    status: 200, contentType: 'text/html',
    body: `<!doctype html><html><head><meta charset="utf-8"><title>T</title>${frag}</head>
    <body style="margin:0"><h1>Muay Thai</h1>${
      hasWidget ? '<div class="muaytix-ticket-selector" data-event-id="rws_2026_09_19"></div>' : ''
    }</body></html>`,
  });
});
page.on('pageerror', e => { fail++; console.log('  FAIL page error -> ' + e.message); });

const held = () => page.evaluate(() => {
  try { return JSON.parse(localStorage.getItem('mtx_attr') || 'null'); }
  catch (e) { return null; }
});
const AD = '/about?gclid=Cj0KEQ_test_click&utm_source=google&utm_medium=cpc'
         + '&utm_campaign=22110044&utm_term=rajadamnern%20tickets&utm_content=7781'
         + '&mt_adgroup=99001&mt_match=e&mt_device=m';

console.log('\nCatching the click');

// A page with no widget on it still has to capture. This is the whole point:
// the advert lands on the home page, the booking happens three pages later.
await page.goto('https://muaytix.test' + AD, { waitUntil: 'domcontentloaded' });
let a = await held();
check('a page with no widget still captures the click', a !== null);
check('the click id is kept whole', a && a.clickId === 'Cj0KEQ_test_click', a && a.clickId);
check('it knows which of the three it is', a && a.clickIdKind === 'gclid', a && a.clickIdKind);
check('the keyword is kept', a && a.term === 'rajadamnern tickets', a && a.term);
check('the campaign is kept', a && a.campaign === '22110044', a && a.campaign);
check('the ad group is kept', a && a.adGroupId === '99001', a && a.adGroupId);
check('the match type is kept', a && a.matchType === 'e', a && a.matchType);
check('the arrival time is recorded', a && !Number.isNaN(Date.parse(a.at)), a && a.at);

// First click wins. A guest won by an advert who comes back через organic search
// two days later was still won by the advert.
await page.goto('https://muaytix.test/tickets', { waitUntil: 'domcontentloaded' });
check('an ordinary page view does not wipe it', (await held())?.clickId === 'Cj0KEQ_test_click');

await page.goto('https://muaytix.test/tickets?utm_source=newsletter&utm_medium=email',
  { waitUntil: 'domcontentloaded' });
a = await held();
check('FIRST click wins — a later free channel does not take the credit',
  a && a.clickId === 'Cj0KEQ_test_click' && a.source === 'google', JSON.stringify(a));

console.log('\nCarrying it to the booking');

await page.waitForSelector('[data-pick]', { timeout: 12000 });
await page.click('[data-pick="ringside"]');
await page.waitForSelector('select[data-qty]', { timeout: 8000 });
await page.selectOption('select[data-qty]', '2');
await page.click('[data-go]');
await page.waitForTimeout(700);

check('create-checkout is told about the click', !!sentToCheckout?.attribution);
check('it sends the same click id', sentToCheckout?.attribution?.clickId === 'Cj0KEQ_test_click');
check('it sends the keyword', sentToCheckout?.attribution?.term === 'rajadamnern tickets');
// The night comes from the availability response, not from the div, so it is
// the fixture's key that goes to checkout.
check('the booking itself is unchanged',
  sentToCheckout?.eventKey === night.event.eventKey && sentToCheckout?.quantity === 2,
  JSON.stringify({ sent: sentToCheckout?.eventKey, qty: sentToCheckout?.quantity }));

console.log('\nWhen there is no advert, and when storage refuses');

const clean = await browser.newContext({ viewport: { width: 420, height: 900 }, locale: 'en-GB' });
const p2 = await clean.newPage();
let plainCheckout = null;
await p2.route('**/functions/v1/**', async (route) => {
  const body = JSON.parse(route.request().postData() || '{}');
  if (route.request().url().endsWith('/availability')) {
    return route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify(body.action === 'events' ? events : night) });
  }
  if (body.action === 'warm') {
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{"warm":true}' });
  }
  plainCheckout = body;
  return route.fulfill({ status: 200, contentType: 'application/json',
    body: '{"checkoutUrl":"https://checkout.stripe.test/x"}' });
});
await p2.route('https://muaytix.test/**', r => r.fulfill({
  status: 200, contentType: 'text/html',
  body: `<!doctype html><html><head><meta charset="utf-8"><title>T</title>${frag}</head>
  <body style="margin:0"><div class="muaytix-ticket-selector" data-event-id="rws_2026_09_19"></div></body></html>`,
}));
p2.on('pageerror', e => { fail++; console.log('  FAIL page error -> ' + e.message); });

// A guest who never saw an advert, on a browser that refuses storage entirely —
// a private window, or blocked site data. The ticket still has to sell.
await p2.addInitScript(() => {
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    get() { throw new DOMException('denied', 'SecurityError'); },
  });
});
await p2.goto('https://muaytix.test/tickets', { waitUntil: 'domcontentloaded' });
await p2.waitForSelector('[data-pick]', { timeout: 12000 });
await p2.click('[data-pick="ringside"]');
await p2.waitForSelector('select[data-qty]', { timeout: 8000 });
await p2.selectOption('select[data-qty]', '1');
await p2.click('[data-go]');
await p2.waitForTimeout(700);

check('storage being refused does not break the widget', plainCheckout !== null);
check('the ticket still sells',
  plainCheckout?.eventKey === night.event.eventKey && plainCheckout?.quantity === 1,
  JSON.stringify({ sent: plainCheckout?.eventKey }));
check('no attribution is invented', plainCheckout?.attribution === undefined,
  JSON.stringify(plainCheckout?.attribution));
await clean.close();

console.log('\nConsent');

const shy = await browser.newContext({ viewport: { width: 420, height: 900 }, locale: 'en-GB' });
const p3 = await shy.newPage();
await p3.route('**/functions/v1/**', r => r.fulfill({
  status: 200, contentType: 'application/json', body: JSON.stringify(night) }));
await p3.route('https://muaytix.test/**', r => r.fulfill({
  status: 200, contentType: 'text/html',
  body: `<!doctype html><html><head><meta charset="utf-8"><title>T</title>
  <script>window.mtxAttributionConsent = function(){ return false; };<\/script>
  ${frag}</head><body style="margin:0"></body></html>`,
}));
await p3.goto('https://muaytix.test' + AD, { waitUntil: 'domcontentloaded' });
const refused = await p3.evaluate(() => {
  try { return localStorage.getItem('mtx_attr'); } catch (e) { return 'threw'; }
});
check('a site that says no stores nothing', refused === null, String(refused));
await shy.close();

await browser.close();
console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
