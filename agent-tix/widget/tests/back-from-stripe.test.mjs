// Agent Tix — coming back from the payment page
//
//   node agent-tix/widget/tests/back-from-stripe.test.mjs
//
// Found live on 9 September 2026. A guest picked a seat class, pressed reserve,
// landed on Stripe, and pressed the X to come back. The widget handed them a
// dead button still reading "Reserving your tickets…". Tapping it did nothing.
// The only escape was "Change seat class", which nobody thinks to press.
//
// The cause: reserve() sets state.busy and deliberately never clears it, on the
// assumption that the page is about to be destroyed. When the browser restores
// the page instead of rebuilding it, nothing re-runs and the button stays dead.
//
// This drives a real browser through the whole thing: widget page -> Stripe ->
// back button. Both pages are served from routed URLs so the navigation and the
// history entry are real, which is the only way the restore behaves as it does
// for a guest.

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
// Deliberately the block that actually ships. booking-widget.html is an older
// separate copy of the same widget; testing that would prove nothing about what
// a guest loads.
const frag   = fs.readFileSync(path.join(HERE, '..', 'paste-into-tilda-header.html'), 'utf8');

let pass = 0, fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail ? '  -> ' + detail : '')); }
};

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
const ctx = await browser.newContext({ viewport: { width: 1180, height: 900 } });
const page = await ctx.newPage();

await page.route('https://muaytix.test/**', route => route.fulfill({
  status: 200, contentType: 'text/html',
  body: `<!doctype html><html><head><meta charset="utf-8"><title>MuayTix</title>
         ${frag}</head>
         <body style="background:#fff"><div class="muaytix-ticket-selector"></div></body></html>`,
}));

// Stand-in for the Stripe payment page: a real navigation to a real other page.
await page.route('https://checkout.stripe.com/**', route => route.fulfill({
  status: 200, contentType: 'text/html',
  body: '<!doctype html><html><head><title>Stripe</title></head><body><h1>Pay</h1></body></html>',
}));

await page.route('**/functions/v1/**', async (route) => {
  const req = route.request();
  const body = JSON.parse(req.postData() || '{}');
  if (req.url().endsWith('/availability')) {
    return route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify(body.action === 'events' ? events : night) });
  }
  if (req.url().endsWith('/create-checkout')) {
    return route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ checkoutUrl: 'https://checkout.stripe.com/c/pay/test_123' }) });
  }
  return route.fulfill({ status: 404, body: '{}' });
});

page.on('pageerror', e => { fail++; console.log('  FAIL page error -> ' + e.message); });

console.log('\nA guest goes to Stripe and comes straight back');

await page.goto('https://muaytix.test/rws', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-grid] [data-date]', { timeout: 10000 });

// Pick a night, then a seat class that is actually on sale.
await page.click('[data-grid] [data-date="2026-09-05"]');
await page.waitForSelector('[data-pick]', { timeout: 10000 });
// The first seat class that is actually on sale.
const live = await page.$$eval('[data-pick]', els =>
  els.filter(e => !e.classList.contains('mtx-pick--off')).map(e => e.getAttribute('data-pick')));
await page.click(`[data-pick="${live[0]}"]`);
await page.waitForSelector('select[data-qty]', { timeout: 10000 });

// Quantity is what enables the button.
await page.selectOption('select[data-qty]', '1');

await page.waitForFunction(
  () => { const b = document.querySelector('[data-go]'); return b && !b.disabled; },
  { timeout: 10000 });

check('button is live before we leave',
      (await page.textContent('[data-go]')).trim() === 'Reserve your tickets');

await Promise.all([
  page.waitForURL('**/checkout.stripe.com/**', { timeout: 10000 }),
  page.click('[data-go]'),
]);
check('reserving takes the guest to the payment page', page.url().includes('checkout.stripe.com'));

// The X on the payment tab. Chromium under automation rebuilds the page here
// rather than restoring it from its cache, so the guest simply gets a fresh
// widget — correct, but not the case that stranded people.
await page.goBack({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-grid] [data-date]', { timeout: 10000 });
check('coming back to a rebuilt page leaves a working widget',
      (await page.$$eval('[data-grid] [data-date]', d => d.length)) > 0);

// The real case: the browser hands the page back exactly as it was, and fires
// pageshow to say so. Nothing else re-runs. Reproduced here by holding the
// checkout call open, which leaves the button in precisely the state a returning
// guest was shown — disabled, reading "Reserving your tickets…".
console.log('\nThe page is handed back mid-reserve, as the browser does');

let reserveCalls = 0;
await page.route('**/functions/v1/create-checkout', async (route) => {
  if (JSON.parse(route.request().postData() || '{}').action === 'warm') {
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{"warm":true}' });
  }
  reserveCalls++;
  await new Promise(() => {});                       // held open on purpose
  return route.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ checkoutUrl: 'https://checkout.stripe.com/c/pay/test_456' }) });
});

await page.click('[data-grid] [data-date="2026-09-05"]');
await page.waitForSelector('[data-pick]', { timeout: 10000 });
const live2 = await page.$$eval('[data-pick]', els =>
  els.filter(e => !e.classList.contains('mtx-pick--off')).map(e => e.getAttribute('data-pick')));
await page.click(`[data-pick="${live2[0]}"]`);
await page.waitForSelector('select[data-qty]', { timeout: 10000 });
await page.selectOption('select[data-qty]', '1');
await page.waitForFunction(
  () => { const b = document.querySelector('[data-go]'); return b && !b.disabled; },
  { timeout: 10000 });

await page.click('[data-go]');
await page.waitForFunction(
  () => document.querySelector('[data-go]')?.textContent.indexOf('Reserving') === 0,
  { timeout: 10000 });

const stuck = await page.$eval('[data-go]', b => ({ text: b.textContent.trim(), disabled: b.disabled }));
check('the stuck state is real: disabled and reading "Reserving your tickets…"',
      stuck.disabled === true && stuck.text.indexOf('Reserving') === 0, JSON.stringify(stuck));

// Exactly what the browser does on restoring a page.
await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));

const back = await page.$eval('[data-go]', b => ({ text: b.textContent.trim(), disabled: b.disabled }));
check('the button is no longer stuck on "Reserving your tickets…"',
      back.text.indexOf('Reserving') !== 0, JSON.stringify(back));
check('the button works again', back.disabled === false, JSON.stringify(back));
check('and reads like a button again', back.text === 'Reserve your tickets', JSON.stringify(back));

// It must genuinely work, not merely look enabled. The first call is still
// held open, so a second one arriving proves the button really is live again
// rather than just looking it.
const before = reserveCalls;
await page.click('[data-go]');
await page.waitForFunction(() => true, { timeout: 500 }).catch(() => {});
await new Promise(r => setTimeout(r, 1500));
check('pressing it actually starts a new reservation',
      reserveCalls > before, 'calls before=' + before + ' after=' + reserveCalls);

await browser.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
