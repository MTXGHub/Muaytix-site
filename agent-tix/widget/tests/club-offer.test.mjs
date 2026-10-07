// Agent Tix — Club Class for a guest whose LEO is fully booked
//
//   node agent-tix/widget/tests/club-offer.test.mjs
//
// Jason, 7 October 2026. LEO sells out first. The guest who wanted LEO does not
// think to move up to Club Class and Third Class is closed, so they leave. The
// red LEO tile now opens an offer of Club Class at 1,650 baht (about 8 per cent
// off, inside the stadium's 10 per cent limit).
//
// What has to hold, and why:
//
//   The offer price is NOT on the class list. Guests who came for Club Class see
//   the ordinary price. Only a guest who taps the LEO tile is shown the offer.
//   The red tile still says "Fully booked", always. That wording is a hard rule.
//
//   The widget only ASKS. It sends offerFrom with the booking and nothing else:
//   no price, no discount. The server decides everything.
//
//   Whatever the server stops offering disappears. No offer from the server, a
//   Club Class that is itself unavailable, or an offer that has gone by the time
//   they pay: each leaves LEO exactly as it was before this feature.
//
//   Going back leaves nothing behind. A guest who backs out and picks Club Class
//   the ordinary way pays the ordinary price.

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

const baseNight = JSON.parse(fs.readFileSync(path.join(HERE, 'night.json'), 'utf8'));
const events    = JSON.parse(fs.readFileSync(path.join(HERE, 'calendar.json'), 'utf8'));
const classes   = JSON.parse(fs.readFileSync(path.join(HERE, 'classes.json'), 'utf8'));
const frag      = fs.readFileSync(path.join(HERE, '..', 'paste-into-tilda-header.html'), 'utf8');

let pass = 0, fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail ? '  -> ' + detail : '')); }
};
const text = (s) => s.replace(/\s+/g, ' ').trim();

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);

// A night where LEO is fully booked and Club Class is wide open. Club Class costs
// $55 / 1,800 baht in this fixture; the offer is $50 / 1,650 baht.
const OFFER = { toCode: 'club_class', prices: [
  { currency: 'usd', unitAmount: 5000 }, { currency: 'thb', unitAmount: 165000 } ] };

function night({ offer = OFFER, club = 'available', leo = 'fully_booked' } = {}) {
  const n = JSON.parse(JSON.stringify(baseNight));
  for (const c of n.classes) {
    if (c.code === 'ringside')    { c.status = 'available'; c.seatsLeft = null; }
    if (c.code === 'club_class')  { c.status = club; c.seatsLeft = null; }
    if (c.code === 'leo_section') {
      c.status = leo; c.seatsLeft = null;
      if (offer) c.offer = offer;
    }
    if (c.code === 'third_class') { c.status = 'closed'; c.seatsLeft = null; }
  }
  return n;
}

// `plan` answers the availability call; `checkout` answers create-checkout.
async function open({ plan, checkout, width = 1180, mount = 'data-event-id="rws_2026_09_05"' } = {}) {
  const sent = [];
  const ctx = await browser.newContext({ viewport: { width, height: 1000 }, locale: 'en-GB' });
  const page = await ctx.newPage();
  let served = 0;
  await page.route('**/functions/v1/**', async (route) => {
    const body = JSON.parse(route.request().postData() || '{}');
    sent.push({ url: route.request().url(), body });
    if (route.request().url().endsWith('/create-checkout')) {
      if (body.action === 'warm') return route.fulfill({ status: 200, contentType: 'application/json', body: '{"warm":true}' });
      const r = checkout ? checkout(body) : { status: 200, body: { checkoutUrl: 'https://checkout.stripe.test/x' } };
      return route.fulfill({ status: r.status, contentType: 'application/json', body: JSON.stringify(r.body) });
    }
    const out = body.action === 'events' ? events : body.action === 'classes' ? classes : plan(served++);
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(out) });
  });
  await page.route('https://checkout.stripe.test/**', r => r.fulfill({ status: 200, contentType: 'text/html', body: '<h1>stripe</h1>' }));
  await page.route('https://muaytix.test/**', r => r.fulfill({
    status: 200, contentType: 'text/html',
    body: `<!doctype html><html><head><meta charset="utf-8"><title>T</title>${frag}</head>
    <body style="margin:0"><div class="muaytix-ticket-selector" ${mount}></div></body></html>`,
  }));
  page.on('pageerror', e => { fail++; console.log('  FAIL page error -> ' + e.message); });
  await page.goto('https://muaytix.test/x', { waitUntil: 'domcontentloaded' });
  return { page, ctx, sent };
}

const bookings = (sent) => sent.filter(s => s.url.endsWith('/create-checkout') && s.body.action !== 'warm').map(s => s.body);

// ---------------------------------------------------------------------------
console.log('\nThe class list, before anyone taps anything');
{
  const { page, ctx } = await open({ plan: () => night() });
  await page.waitForSelector('.mtx-pick', { timeout: 12000 });
  const leo = page.locator('[data-offer="leo_section"]');
  check('the LEO tile can be pressed', await leo.count() === 1 && await leo.isEnabled());
  check('it still says Fully booked', /fully booked/i.test(text(await leo.innerText())), text(await leo.innerText()));
  check('and it is still the red tile', await leo.evaluate(e => e.classList.contains('mtx-pick--off')));
  check('it carries a line saying there is something to see', /club class offer/i.test(text(await leo.innerText())));
  check('LEO is not a plain pick any more', await page.locator('[data-pick="leo_section"]').count() === 0);

  const list = text(await page.innerText('.mtx-picker'));
  check('the offer price is NOT on the class list ($50)', !/\$\s?50\b/.test(list), list);
  check('the offer price is NOT on the class list (1,650)', !/1,?650/.test(list), list);
  const club = text(await page.locator('[data-pick="club_class"]').innerText());
  check('Club Class shows its ordinary price', /\$55/.test(club), club);
  check('the word "sold out" appears nowhere', !/sold out/i.test(text(await page.innerText('#mtx-booking'))));
  check('nothing says limited', !/limited/i.test(list));
  await ctx.close();
}

console.log('\nTapping the LEO tile');
{
  const { page, ctx, sent } = await open({ plan: () => night() });
  await page.waitForSelector('[data-offer]', { timeout: 12000 });
  await page.click('[data-offer="leo_section"]');
  await page.waitForSelector('[data-unit]');
  const panel = text(await page.innerText('.mtx-detail'));
  check('the chosen class is Club Class', /you have chosen club class/i.test(panel), panel);
  check('it says LEO is fully booked', /leo section is fully booked/i.test(panel), panel);
  check('it shows the usual price', /usual price \$55/i.test(panel), panel);
  const unit = text(await page.innerText('[data-unit]'));
  check('the price per ticket is the offer price', unit === '$50', unit);
  const total = text(await page.innerText('[data-total]'));
  check('the total is for two tickets', total === '$100', total);
  check('the button is live', await page.locator('[data-go]').isEnabled() && /reserve your tickets/i.test(await page.innerText('[data-go]')));

  await page.selectOption('[data-cur]', 'thb');
  check('in baht the price per ticket is 1,650', text(await page.innerText('[data-unit]')) === '฿1,650', text(await page.innerText('[data-unit]')));
  check('and the usual price follows the currency', /usual price ฿1,800/i.test(text(await page.innerText('.mtx-detail'))), text(await page.innerText('.mtx-detail')));
  await page.selectOption('[data-cur]', 'usd');

  await page.click('[data-go]');
  await page.waitForURL('https://checkout.stripe.test/**', { timeout: 8000 });
  const b = bookings(sent)[0] || {};
  check('checkout is asked for Club Class', b.classCode === 'club_class', JSON.stringify(b));
  check('and told the offer came from LEO', b.offerFrom === 'leo_section', JSON.stringify(b));
  check('with two tickets in dollars', b.quantity === 2 && b.currency === 'usd', JSON.stringify(b));
  check('and NO price or discount is sent from the browser',
        !Object.keys(b).some(k => /price|amount|discount|total/i.test(k)), Object.keys(b).join(','));
  await ctx.close();
}

console.log('\nAn ordinary Club Class booking is untouched');
{
  const { page, ctx, sent } = await open({ plan: () => night() });
  await page.waitForSelector('[data-pick="club_class"]', { timeout: 12000 });
  await page.click('[data-pick="club_class"]');
  await page.waitForSelector('[data-unit]');
  check('the ordinary price is shown', text(await page.innerText('[data-unit]')) === '$55', text(await page.innerText('[data-unit]')));
  check('with no offer banner', !/usual price/i.test(text(await page.innerText('.mtx-detail'))));
  await page.click('[data-go]');
  await page.waitForURL('https://checkout.stripe.test/**', { timeout: 8000 });
  const b = bookings(sent)[0] || {};
  check('no offerFrom is sent', !('offerFrom' in b), JSON.stringify(b));
  await ctx.close();
}

console.log('\nGoing back leaves nothing behind');
{
  const { page, ctx, sent } = await open({ plan: () => night() });
  await page.waitForSelector('[data-offer]', { timeout: 12000 });
  await page.click('[data-offer="leo_section"]');
  await page.waitForSelector('[data-unit]');
  await page.click('[data-back-class]');
  await page.waitForSelector('.mtx-picker');
  check('Change seat class returns to the list', await page.locator('[data-offer="leo_section"]').count() === 1);
  await page.click('[data-pick="club_class"]');
  await page.waitForSelector('[data-unit]');
  check('Club Class chosen the ordinary way costs the ordinary price', text(await page.innerText('[data-unit]')) === '$55', text(await page.innerText('[data-unit]')));
  await page.click('[data-go]');
  await page.waitForURL('https://checkout.stripe.test/**', { timeout: 8000 });
  check('and carries no offer', !('offerFrom' in (bookings(sent)[0] || {})), JSON.stringify(bookings(sent)));
  await ctx.close();
}
{
  const { page, ctx } = await open({ plan: () => night() });
  await page.waitForSelector('[data-offer]', { timeout: 12000 });
  await page.click('[data-offer="leo_section"]');
  await page.waitForSelector('[data-unit]');
  await page.goBack();
  await page.waitForSelector('.mtx-picker', { timeout: 4000 }).catch(() => {});
  check('the browser back button returns to the class list', await page.locator('.mtx-picker').count() === 1 && await page.locator('[data-unit]').count() === 0);
  await ctx.close();
}

console.log('\nWhen the server does not offer it');
for (const [name, plan] of [
  ['no offer sent', () => night({ offer: null })],
  ['Club Class itself fully booked', () => night({ club: 'fully_booked' })],
  ['Club Class booking closed', () => night({ club: 'booking_closed' })],
  ['LEO still on sale (the offer is only for a fully booked LEO)', () => night({ leo: 'available' })],
]) {
  const { page, ctx } = await open({ plan });
  await page.waitForSelector('.mtx-pick', { timeout: 12000 });
  const asOffer = await page.locator('[data-offer]').count();
  check(name + ': there is nothing to tap', asOffer === 0, 'offer tiles: ' + asOffer);
  if (name.startsWith('LEO still')) {
    check('and LEO is bookable as ever', await page.locator('[data-pick="leo_section"]').isEnabled());
  } else {
    check(name + ': LEO is the old disabled red tile', await page.locator('[data-pick="leo_section"]').isDisabled());
  }
  check(name + ': no offer wording on the page', !/club class offer/i.test(text(await page.innerText('#mtx-booking'))));
  await ctx.close();
}

console.log('\nThe offer goes by while the guest is deciding');
{
  // First read: offer on. By the time they pay, the server says no, then the
  // re-read of the night no longer carries it.
  const { page, ctx } = await open({
    plan: (i) => i === 0 ? night() : night({ offer: null }),
    checkout: () => ({ status: 409, body: { error: 'That offer is no longer available. Please choose your seats again.', code: 'offer_unavailable' } }),
  });
  await page.waitForSelector('[data-offer]', { timeout: 12000 });
  await page.click('[data-offer="leo_section"]');
  await page.waitForSelector('[data-unit]');
  await page.click('[data-go]');
  await page.waitForSelector('.mtx-fail', { timeout: 4000 });
  check('the guest is told, in words', /no longer available/i.test(text(await page.innerText('.mtx-fail'))));
  await page.waitForSelector('.mtx-picker', { timeout: 8000 });
  check('and the night is read again, offer gone', await page.locator('[data-offer]').count() === 0);
  check('LEO is back to the plain red tile', await page.locator('[data-pick="leo_section"]').isDisabled());
  await ctx.close();
}

console.log('\nOn a phone');
{
  const { page, ctx } = await open({ plan: () => night(), width: 390 });
  await page.waitForSelector('[data-offer]', { timeout: 12000 });
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check('no sideways scroll on the class list', over <= 0, 'overflow ' + over);
  await page.click('[data-offer="leo_section"]');
  await page.waitForSelector('[data-unit]');
  const over2 = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check('no sideways scroll on the offer panel', over2 <= 0, 'overflow ' + over2);
  await ctx.close();
}

console.log('\nSeat first (the page that asks which seat before which night)');
{
  const { page, ctx, sent } = await open({ plan: () => night(), mount: 'data-start="seats"' });
  await page.waitForSelector('[data-seat="leo_section"]', { timeout: 12000 });
  await page.click('[data-seat="leo_section"]');
  await page.waitForSelector('[data-date]:not([disabled])', { timeout: 12000 });
  await page.locator('[data-date]:not([disabled])').first().click();
  await page.waitForSelector('.mtx-detail', { timeout: 12000 });
  const detail = text(await page.innerText('.mtx-detail'));
  check('a fully booked LEO says so', /leo section is now fully booked/i.test(detail), detail);
  const btn = page.locator('.mtx-detail [data-offer="leo_section"]');
  check('and offers the way through', await btn.count() === 1);
  await btn.click();
  await page.waitForSelector('[data-unit]');
  check('the offer price shows', text(await page.innerText('[data-unit]')) === '$50', text(await page.innerText('[data-unit]')));
  await page.click('[data-go]');
  await page.waitForURL('https://checkout.stripe.test/**', { timeout: 8000 });
  check('and the booking carries the offer', bookings(sent)[0]?.offerFrom === 'leo_section', JSON.stringify(bookings(sent)));
  await ctx.close();
}

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
