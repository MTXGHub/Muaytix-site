// Agent Tix — the "checkout_handoff" Rybbit event
//
//   node agent-tix/widget/tests/handoff-event.test.mjs
//
// Jason, 9 October 2026. The moment a guest is handed to Stripe, the widget
// sends one Rybbit custom event carrying the Stripe session id and nothing else.
//
// What has to hold:
//   * The event fires once, with exactly one property: stripe_session_id.
//   * Rybbit absent, blocked, or throwing never stops the redirect.
//   * No sessionId in the reply means no event, and the redirect still happens.
//   * A double click gives one booking call and one event.

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

const events  = JSON.parse(fs.readFileSync(path.join(HERE, 'calendar.json'), 'utf8'));
const classes = JSON.parse(fs.readFileSync(path.join(HERE, 'classes.json'), 'utf8'));
const night   = JSON.parse(fs.readFileSync(path.join(HERE, 'night.json'), 'utf8'));
const frag    = fs.readFileSync(path.join(HERE, '..', 'paste-into-tilda-header.html'), 'utf8');

let pass = 0, fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail ? '  -> ' + detail : '')); }
};

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);

// `rybbit` is the script run before the page (stands in for the site's Rybbit
// tag). `reply` is the create-checkout answer. `slow` holds the reply back so a
// second click can land while the first is in flight.
async function run({ rybbit = '', reply, slow = 0, doubleClick = false }) {
  const ctx = await browser.newContext({ viewport: { width: 1180, height: 1000 }, locale: 'en-GB' });
  const page = await ctx.newPage();
  let bookingCalls = 0, stripeHit = null; const seen = [];
  await page.route('https://rybbit.test/**', r => { seen.push(JSON.parse(r.request().postData() || '{}')); return r.fulfill({ status: 204, body: '' }); });
  page.on('pageerror', e => { fail++; console.log('  FAIL page error -> ' + e.message); });
  await page.addInitScript(`window.__ev = []; ${rybbit}`);
  await page.route('**/functions/v1/**', async (route) => {
    const body = JSON.parse(route.request().postData() || '{}');
    if (route.request().url().endsWith('/create-checkout')) {
      if (body.action === 'warm') return route.fulfill({ status: 200, contentType: 'application/json', body: '{"warm":true}' });
      bookingCalls++;
      if (slow) await new Promise(r => setTimeout(r, slow));
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(reply) });
    }
    const out = body.action === 'events' ? events : body.action === 'classes' ? classes : night;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(out) });
  });
  await page.route('https://checkout.stripe.test/**', r => { stripeHit = r.request().url();
    return r.fulfill({ status: 200, contentType: 'text/html', body: '<h1>stripe</h1>' }); });
  await page.route('https://muaytix.test/**', r => r.fulfill({
    status: 200, contentType: 'text/html',
    body: `<!doctype html><html><head><meta charset="utf-8"><title>T</title>${frag}</head>
    <body style="margin:0"><div class="muaytix-ticket-selector" data-event-id="rws_2026_09_05"></div></body></html>`,
  }));
  await page.goto('https://muaytix.test/x', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.mtx-pick', { timeout: 12000 });
  await page.click('[data-pick="ringside"]');
  await page.selectOption('#mtxQty', '2');
  if (doubleClick) {
    await page.evaluate(() => { const b = document.querySelector('[data-go]'); b.click(); b.click(); });
  } else {
    await page.click('[data-go]');
  }
  await page.waitForURL(/checkout\.stripe\.test/, { timeout: 8000 }).catch(() => {});
  const url = page.url();
  // The widget page is gone after the redirect, so the stand-in reports each
  // call to a URL we capture from outside (keep-alive, as the real one does).
  await ctx.close();
  return { url, log: seen, bookingCalls, stripeHit };
}

// A Rybbit stand-in that records every call where it survives the redirect.
const REC = `window.rybbit = { event: function(n, p){ fetch('https://rybbit.test/e', { method: 'POST', keepalive: true, body: JSON.stringify({ name: n, props: p }) }); } };`;
const THROWS = `window.rybbit = { event: function(){ throw new Error('rybbit exploded'); } };`;
const NOT_A_FN = `window.rybbit = { event: 'nope' };`;
const OK = { checkoutUrl: 'https://checkout.stripe.test/c/pay/x', sessionId: 'cs_test_abc123', reservationId: 'r1' };

console.log('\nThe event fires once, with the right property');
{
  const r = await run({ rybbit: REC, reply: OK });
  check('redirected to Stripe', /checkout\.stripe\.test\/c\/pay\/x/.test(r.url), r.url);
  check('exactly one event', r.log && r.log.length === 1, JSON.stringify(r.log));
  check('named checkout_handoff', r.log?.[0]?.name === 'checkout_handoff');
  check('one property, stripe_session_id, the Stripe session id',
        JSON.stringify(r.log?.[0]?.props) === '{"stripe_session_id":"cs_test_abc123"}', JSON.stringify(r.log?.[0]?.props));
}

console.log('\nA double click is one booking and one event');
{
  const r = await run({ rybbit: REC, reply: OK, slow: 400, doubleClick: true });
  check('one booking call', r.bookingCalls === 1, String(r.bookingCalls));
  check('one event', r.log && r.log.length === 1, JSON.stringify(r.log));
  check('redirected', /checkout\.stripe\.test/.test(r.url), r.url);
}

console.log('\nRybbit missing: the redirect works as before');
{
  const r = await run({ rybbit: '', reply: OK });
  check('redirected to Stripe', /checkout\.stripe\.test\/c\/pay\/x/.test(r.url), r.url);
}

console.log('\nRybbit present but its event call is not a function');
{
  const r = await run({ rybbit: NOT_A_FN, reply: OK });
  check('redirected to Stripe', /checkout\.stripe\.test\/c\/pay\/x/.test(r.url), r.url);
}

console.log('\nRybbit event call throws');
{
  const r = await run({ rybbit: THROWS, reply: OK });
  check('redirected to Stripe anyway', /checkout\.stripe\.test\/c\/pay\/x/.test(r.url), r.url);
}

console.log('\nNo sessionId in the reply');
{
  const r = await run({ rybbit: REC, reply: { checkoutUrl: OK.checkoutUrl } });
  check('redirected to Stripe', /checkout\.stripe\.test\/c\/pay\/x/.test(r.url), r.url);
  check('no event sent', !r.log || r.log.length === 0, JSON.stringify(r.log));
}
{
  const r = await run({ rybbit: REC, reply: { checkoutUrl: OK.checkoutUrl, sessionId: 12345 } });
  check('a non-text sessionId is not sent either', !r.log || r.log.length === 0, JSON.stringify(r.log));
  check('and the redirect still happens', /checkout\.stripe\.test/.test(r.url), r.url);
}

console.log('\nNo checkoutUrl: no event, no redirect, error shown as before');
{
  const r = await run({ rybbit: REC, reply: { sessionId: 'cs_test_abc123' } });
  check('did not leave the page', !/checkout\.stripe\.test/.test(r.url), r.url);
}

console.log('\nThe built header');
check('header still under 63,000 bytes', Buffer.byteLength(frag) < 63000, String(Buffer.byteLength(frag)));
check('event name appears once in the header', frag.split('checkout_handoff').length === 2);

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
