// Agent Tix — a guest's own hold, in the widget
//
//   PGHOST=/tmp PGPORT=5544 PGUSER=postgres CHROMIUM_PATH=... node agent-tix/widget/tests/guest-hold.test.mjs
//
// The real widget (the built header block), in a real browser, talking to the REAL
// availability and create-checkout code over a scratch Postgres that has
// schema/0043_guest_hold.sql loaded, with a fake Stripe. Nothing here touches the
// live database or Stripe. Each guest is a separate browser context, so what one
// guest's page shows another's is genuinely separate.
//
// What has to hold, from Jason's brief of 9 October 2026:
//
//   A guest's own hold is remembered in their browser (and only theirs), checked
//   with the server whenever the page loads or the browser hands back a kept page,
//   and drawn as a notice with a live countdown only if the server says it is
//   still held.
//
//   Their own seats count for them: with 4 left and 3 held, everyone else sees 1
//   and the holder can choose up to 4.
//
//   The same choice again goes back to the same Stripe page. A change takes the
//   new seats first. A change that cannot be made leaves the old hold and says so.
//
//   Rybbit hears three events, each with the Stripe session id and nothing else.
//   Never at the cost of a redirect.
//
//   A widget that knows nothing about holds (the header already cached in
//   browsers) behaves as before.

import fs from 'node:fs';
import path from 'node:path';
import { execSync, execFileSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { makeDb, buildCreateCheckout, buildAvailability, seed, resetClub, IDS } from '../../functions/tests/pg-harness.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(HERE, '..', '..', '..');
async function loadPlaywright() {
  try { return await import('playwright'); }
  catch {
    const root = execSync('npm root -g', { encoding: 'utf8' }).trim();
    return await import(pathToFileURL(path.join(root, 'playwright', 'index.js')).href);
  }
}
const pw = await loadPlaywright();
const chromium = pw.chromium ?? pw.default.chromium;

const header = fs.readFileSync(path.join(HERE, '..', 'paste-into-tilda-header.html'), 'utf8');
// The header as it was before this feature, to prove an older cached copy still
// works. 0472ed1 is the one CLAUDE.md records as live.
const OLD_COMMIT = process.env.OLD_HEADER_COMMIT || '0472ed1';
const cachedHeader = execFileSync('git', ['show', `${OLD_COMMIT}:agent-tix/widget/paste-into-tilda-header.html`], { cwd: REPO, encoding: 'utf8' });

let pass = 0, fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail ? '  -> ' + detail : '')); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const db = makeDb('holdtest_ui');
try { db.create(); } catch (e) {
  console.log('Cannot reach a scratch Postgres (set PGHOST / PGPORT / PGUSER): ' + String(e.stderr ?? e.message).trim());
  process.exit(2);
}
seed(db);

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});

// The two real functions and a Stripe that remembers everything. Rebuilt per
// scenario so the call logs start clean.
let fns = null;
async function freshFunctions(stripe = {}) {
  fns = { checkout: await buildCreateCheckout(db, { stripe }), avail: buildAvailability(db) };
  return fns;
}

const rows = (q) => db.rows(q);
const held = () => rows(`select id, status, quantity, stripe_checkout_session_id sid from checkout_reservations where status = 'held' order by created_at`);
const club = () => rows(`select quantity_available avail, reserved_quantity reserved from event_ticket_classes where id = '${IDS.club}'`)[0];

// One guest: their own browser context, a page on "muaytix.com" that carries the
// header and a single-night widget, with every call to the functions routed to
// the real handlers. `rybbit` is a script run first, standing in for the site's tag.
async function guest({ hdr = header, rybbit = true, path_ = '/rajadamnern-knockout/2026-10-12', ctx: shared } = {}) {
  const ctx = shared ?? await browser.newContext({ viewport: { width: 1180, height: 1000 }, locale: 'en-GB' });
  const events = [];                       // what Rybbit was told
  await ctx.exposeBinding('__rybbit', (_src, name, props) => { events.push({ name, props }); });
  await ctx.addInitScript(rybbit
    ? `window.rybbit = { event: function(n, p){ window.__rybbit(n, p); } };`
    : '');
  const seen = [];
  await ctx.route('https://jlwopomkqeawrxlapwpc.supabase.co/functions/v1/**', async (route) => {
    const url = route.request().url();
    const fn = url.endsWith('/create-checkout') ? fns.checkout : fns.avail;
    const bodyText = route.request().postData() || '{}';
    const body = JSON.parse(bodyText);
    seen.push({ fn: url.split('/').pop(), body });
    if (fn === fns.checkout && body.action === 'warm') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"warm":true}', headers: { 'access-control-allow-origin': '*' } });
    }
    const res = await fn.handle(new Request(url, { method: 'POST', headers: { origin: 'https://muaytix.com', 'content-type': 'application/json', referer: 'https://muaytix.com' + path_ }, body: bodyText }));
    return route.fulfill({ status: res.status, contentType: 'application/json', body: await res.text(), headers: { 'access-control-allow-origin': '*' } });
  });
  await ctx.route('https://checkout.stripe.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Stripe</title><h1>stripe</h1>' }));
  await ctx.route('https://muaytix.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/html',
    body: `<!doctype html><html><head><meta charset="utf-8"><title>Page</title>${hdr}</head>
      <body style="margin:0"><div class="muaytix-ticket-selector" data-event-id="test_night_1"></div></body></html>` }));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { fail++; console.log('  FAIL page error -> ' + e.message); });
  const api = {
    ctx, page, events, seen,
    async open(p = path_) { await page.goto('https://muaytix.com' + p, { waitUntil: 'domcontentloaded' }); await page.waitForSelector('.mtx-pick, .mtx-detail', { timeout: 15000 }); },
    async pickClub() { await page.click('[data-pick="club_class"]'); },
    async qty(n) { await page.selectOption('#mtxQty', String(n)); },
    async reserve() { await page.click('[data-go]'); await page.waitForURL(/checkout\.stripe\.com/, { timeout: 15000 }); },
    maxQty: () => page.$$eval('#mtxQty option', (o) => o.length),
    notice: async () => (await page.isVisible('.mtx-hold')) ? (await page.textContent('.mtx-hold')).replace(/\s+/g, ' ').trim() : null,
    stored: () => page.evaluate(() => { try { return JSON.parse(localStorage.getItem('mtx_hold')); } catch (e) { return null; } }),
  };
  return api;
}

// ---------------------------------------------------------------------------
console.log('\nHold 3 of the last 4: others see 1, the holder can choose 4');
{
  resetClub(db);
  await freshFunctions();
  const a = await guest();
  await a.open();
  await a.pickClub(); await a.qty(3); await a.reserve();
  check('the guest is sent to Stripe', /checkout\.stripe\.com\/c\/pay\//.test(a.page.url()), a.page.url());

  const b = await guest();                       // someone else, another browser
  await b.open();
  await b.pickClub();
  check('another guest is offered at most 1 ticket', await b.maxQty() === 1, String(await b.maxQty()));
  check('and sees "Only 1 left"', /Only 1 left/i.test(await b.page.textContent('.mtx-detail')), (await b.page.textContent('.mtx-detail')).slice(0, 120));
  check('another guest sees no hold notice', await b.notice() === null);
  check('and nothing is stored in their browser', await b.stored() === null);

  await a.page.goBack().catch(() => {});
  await a.page.waitForSelector('.mtx-hold:not([hidden])', { timeout: 15000 });
  const n = await a.notice();
  check('the holder, back from Stripe, sees the notice with their seats', /Your 3 Club Class seats are held for \d:\d\d/.test(n), n);
  check('and a Continue to payment button and a way to change seats', /Continue to payment/.test(n) && /Change seats/.test(n), n);
  await a.pickClub().catch(() => {});
  const opts = await a.page.waitForSelector('#mtxQty', { timeout: 15000 }).then(() => a.maxQty());
  check('the holder may choose up to 4 tickets (their 3 plus the 1 left)', opts === 4, String(opts));
  check('and is told 4 are left', /Only 4 left/i.test(await a.page.textContent('.mtx-detail')), (await a.page.textContent('.mtx-detail')).slice(0, 140));
  const secs = await a.page.evaluate(() => { const m = document.querySelector('[data-left]').textContent.split(':'); return +m[0] * 60 + +m[1]; });
  check('the countdown is under five minutes', secs > 200 && secs <= 300, String(secs));
  const first = await a.page.textContent('[data-left]'); await sleep(2100); const second = await a.page.textContent('[data-left]');
  check('and it is live: it moved', first !== second, first + ' -> ' + second);
  await a.ctx.close(); await b.ctx.close();
}

// ---------------------------------------------------------------------------
console.log('\nSame choice twice: one reservation, one Stripe session');
{
  resetClub(db);
  const f = await freshFunctions();
  const a = await guest();
  await a.open();
  await a.pickClub(); await a.qty(3); await a.reserve();
  const firstUrl = a.page.url();
  await a.page.goBack().catch(() => {});
  await a.page.waitForSelector('.mtx-hold:not([hidden])', { timeout: 15000 });
  await a.pickClub().catch(() => {});
  await a.page.waitForSelector('#mtxQty'); await a.qty(3);
  await a.reserve();
  check('the guest lands on the very same Stripe page', a.page.url() === firstUrl, a.page.url() + ' vs ' + firstUrl);
  check('one live reservation', held().length === 1, String(held().length));
  check('and Stripe was asked to create once', f.checkout.stripe.calls.filter((c) => c.op === 'create').length === 1);
  check('3 reserved, not 6', club().reserved === 3);
  await a.ctx.close();
}

// ---------------------------------------------------------------------------
console.log('\nChange seats: 3 to 2');
{
  resetClub(db);
  const f = await freshFunctions();
  const a = await guest();
  await a.open();
  await a.pickClub(); await a.qty(3); await a.reserve();
  const first = held()[0];
  const firstSession = first.sid;
  await a.page.goBack().catch(() => {});
  await a.page.waitForSelector('.mtx-hold:not([hidden])', { timeout: 15000 });
  await a.page.click('[data-change-hold]');
  await a.page.waitForSelector('.mtx-pick, #mtxQty', { timeout: 15000 });
  if (!(await a.page.$('#mtxQty'))) await a.pickClub();
  await a.page.waitForSelector('#mtxQty'); await a.qty(2);
  await a.reserve();
  const now = held();
  check('exactly one live hold, for 2', now.length === 1 && now[0].quantity === 2, JSON.stringify(now));
  check('the 3 were released', rows(`select status from checkout_reservations where id = '${first.id}'`)[0].status === 'released');
  check('the public count is 2', club().avail === 2 && club().reserved === 2, JSON.stringify(club()));
  check('the old Stripe page was expired', f.checkout.stripe.sessions.get(firstSession).status === 'expired');
  const newSession = now[0].sid;
  const handoffs = a.events.filter((e) => e.name === 'checkout_handoff');
  const replaced = a.events.filter((e) => e.name === 'hold_replaced');
  check('Rybbit heard checkout_handoff once, with the new session id only', handoffs.length === 1 && handoffs[0].props.stripe_session_id === newSession && Object.keys(handoffs[0].props).join() === 'stripe_session_id', JSON.stringify(a.events));
  check('and hold_replaced once, with the replaced (old) session id only', replaced.length === 1 && replaced[0].props.stripe_session_id === firstSession && Object.keys(replaced[0].props).join() === 'stripe_session_id', JSON.stringify(replaced));
  const st = await a.stored();
  check('the browser now remembers the new hold, not the old one', st && st.r === now[0].id && st.q === 2 && st.s === newSession, JSON.stringify(st));
  check('and what it remembers is only ids, quantities and times', Object.keys(st).sort().join() === 'c,e,k,m,n,q,r,s,u,x', Object.keys(st).sort().join());
  await a.ctx.close();
}

// ---------------------------------------------------------------------------
console.log('\nChange to something that is not available: the old hold stays');
{
  resetClub(db);
  const f = await freshFunctions();
  const a = await guest();
  await a.open();
  await a.pickClub(); await a.qty(3); await a.reserve();
  const first = held()[0];
  await a.page.goBack().catch(() => {});
  await a.page.waitForSelector('.mtx-hold:not([hidden])', { timeout: 15000 });
  await a.page.click('[data-change-hold]');
  await a.page.waitForSelector('[data-pick="third_class"]', { timeout: 15000 }).catch(() => {});
  if (!(await a.page.$('[data-pick="third_class"]'))) { await a.page.click('[data-back-class]'); await a.page.waitForSelector('[data-pick="third_class"]'); }
  // The night changes under the guest while they are deciding.
  db.exec(`update event_ticket_classes set manual_status = 'fully_booked' where id = '${IDS.third}'`);
  await a.page.click('[data-pick="third_class"]');
  await a.page.waitForSelector('#mtxQty', { timeout: 15000 }).catch(() => {});
  const creates = f.checkout.stripe.calls.filter((c) => c.op === 'create').length;
  if (await a.page.$('#mtxQty')) {
    await a.qty(2);
    await a.page.click('[data-go]');
    await a.page.waitForSelector('[data-fail] .mtx-fail', { timeout: 15000 });
    const msg = await a.page.textContent('[data-fail] .mtx-fail');
    check('the guest is told the new choice is not available and that their seats are still held', /not available/i.test(msg) && /still held/i.test(msg), msg);
    check('the page stays where it is (no redirect)', /muaytix\.com/.test(a.page.url()));
    check('the notice is still there', (await a.notice()) !== null);
  } else {
    check('Third Class could be chosen in this test', false, 'the tile was not selectable');
  }
  check('the old hold is still held, same size', held().length === 1 && held()[0].id === first.id && held()[0].quantity === 3);
  check('nothing new was created at Stripe and the old page is open', f.checkout.stripe.calls.filter((c) => c.op === 'create').length === creates && f.checkout.stripe.sessions.get(first.sid).status === 'open');
  check('Rybbit heard nothing for the refused change', !a.events.some((e) => e.name === 'hold_replaced'));
  db.exec(`update event_ticket_classes set manual_status = null where id = '${IDS.third}'`);
  await a.ctx.close();
}

// ---------------------------------------------------------------------------
console.log('\nContinue to payment');
{
  resetClub(db);
  await freshFunctions();
  const a = await guest();
  await a.open();
  await a.pickClub(); await a.qty(2); await a.reserve();
  const url = a.page.url();
  await a.page.goBack().catch(() => {});
  await a.page.waitForSelector('.mtx-hold:not([hidden])', { timeout: 15000 });
  await a.page.click('[data-resume]');
  await a.page.waitForURL(/checkout\.stripe\.com/, { timeout: 15000 });
  check('goes straight to the stored Stripe page', a.page.url() === url, a.page.url());
  const resumed = a.events.filter((e) => e.name === 'hold_resumed');
  check('Rybbit heard hold_resumed once with the session id only', resumed.length === 1 && Object.keys(resumed[0].props).join() === 'stripe_session_id' && resumed[0].props.stripe_session_id === held()[0].sid, JSON.stringify(a.events));
  await a.ctx.close();
}

// ---------------------------------------------------------------------------
console.log('\nA page restored from the browser cache is checked again');
{
  resetClub(db);
  await freshFunctions();
  const a = await guest();
  await a.open();
  await a.pickClub(); await a.qty(3); await a.reserve();
  await a.page.goBack().catch(() => {});
  await a.page.waitForSelector('.mtx-hold:not([hidden])', { timeout: 15000 });
  const navType = await a.page.evaluate(() => performance.getEntriesByType('navigation')[0].type);
  check('coming back, the notice and count are right however the browser rebuilt the page (' + navType + ')', /Your 3 Club Class seats/.test(await a.notice()));
  // The same thing the browser does for a kept page: a pageshow with persisted set.
  await a.page.click('[data-change-hold]');
  await a.page.waitForSelector('[data-pick="club_class"]');
  // Meanwhile, elsewhere: another guest takes the last seat.
  db.exec(`select * from reserve_tickets('${IDS.club}', 1, now() + interval '5 minutes')`);
  const before = a.seen.filter((s) => s.fn === 'availability').length;
  await a.page.evaluate(() => window.dispatchEvent(Object.assign(new Event('pageshow'), { persisted: true })));
  await sleep(1500);
  const after = a.seen.filter((s) => s.fn === 'availability');
  check('a restored page asks the server again: the hold, and the night', after.length >= before + 2 && after.slice(before).some((s) => s.body.action === 'hold') && after.slice(before).some((s) => s.body.action === 'availability'), JSON.stringify(after.slice(before).map((s) => s.body.action)));
  check('and sends only the hold id with it', after.slice(before).every((s) => Object.keys(s.body).every((k) => ['action', 'holdId', 'eventKey'].includes(k))), JSON.stringify(after.slice(before)));
  check('the notice is still shown after the check', (await a.notice()) !== null);
  // A stale page whose hold has gone: the check clears it.
  db.exec(`update checkout_reservations set expires_at = now() - interval '1 second' where status = 'held' and quantity = 3`);
  await a.page.evaluate(() => window.dispatchEvent(Object.assign(new Event('pageshow'), { persisted: true })));
  await a.page.waitForSelector('.mtx-hold', { state: 'hidden', timeout: 10000 });
  check('a hold the server says is gone is removed from the page', (await a.notice()) === null);
  check('and forgotten by the browser', (await a.stored()) === null);
  await a.ctx.close();
}

// ---------------------------------------------------------------------------
console.log('\nThe hold runs out while the guest is looking');
{
  resetClub(db);
  await freshFunctions();
  const a = await guest();
  await a.open();
  await a.pickClub(); await a.qty(3); await a.reserve();
  await a.page.goBack().catch(() => {});
  await a.page.waitForSelector('.mtx-hold:not([hidden])', { timeout: 15000 });
  await a.page.click('[data-change-hold]');
  await a.page.waitForSelector('[data-pick="club_class"]');
  await a.pickClub();
  await a.page.waitForSelector('#mtxQty');
  check('while it lives they may choose 4', await a.maxQty() === 4);
  // Shorten it: the server's hold ends in 3 seconds, the browser's clock is told the same.
  db.exec(`update checkout_reservations set expires_at = now() + interval '3 seconds' where status = 'held'`);
  await a.page.evaluate(() => { const h = JSON.parse(localStorage.getItem('mtx_hold')); h.x = Date.now() + 3000; localStorage.setItem('mtx_hold', JSON.stringify(h)); });
  await a.page.reload({ waitUntil: 'domcontentloaded' });
  await a.page.waitForSelector('.mtx-hold:not([hidden])', { timeout: 15000 });
  await a.page.click('[data-change-hold]');
  await sleep(300);
  const askedBefore = a.seen.filter((s) => s.fn === 'availability' && s.body.action === 'availability').length;
  await sleep(3600);
  db.exec(`select expire_stale_reservations()`);        // what the five minute sweeper does
  await a.page.waitForSelector('.mtx-hold', { state: 'hidden', timeout: 10000 });
  check('the notice is removed when the countdown ends', (await a.notice()) === null);
  check('and the browser forgets the hold', (await a.stored()) === null);
  await sleep(1500);
  const asked = a.seen.filter((s) => s.fn === 'availability' && s.body.action === 'availability').length;
  check('and the page asked the server for fresh availability', asked > askedBefore, asked + ' vs ' + askedBefore);
  check('the seats are back with the public: 4 left again', club().avail === 4, JSON.stringify(club()));
  await a.ctx.close();
}

// ---------------------------------------------------------------------------
console.log('\nStripe back arrow lands on the page the guest came from');
{
  resetClub(db);
  const f = await freshFunctions();
  const a = await guest({ path_: '/rajadamnern-knockout/2026-10-12' });
  await a.open();
  await a.pickClub(); await a.qty(2); await a.reserve();
  const session = f.checkout.stripe.sessions.get(held()[0].sid);
  check('the session was created with that page as its cancel address', session.params.cancel_url === 'https://muaytix.com/rajadamnern-knockout/2026-10-12?checkout=cancelled', session.params.cancel_url);
  // Stripe's arrow takes the guest there: a fresh page load of that address.
  await a.page.goto(session.params.cancel_url, { waitUntil: 'domcontentloaded' });
  await a.page.waitForSelector('.mtx-hold:not([hidden])', { timeout: 15000 });
  check('and there the guest sees their seats held, with a way back to payment', /Your 2 Club Class seats are held/.test(await a.notice()) && /Continue to payment/.test(await a.notice()), await a.notice());
  await a.ctx.close();
}

// ---------------------------------------------------------------------------
console.log('\nRybbit never costs a redirect');
for (const [label, rybbit] of [['absent', false], ['throwing', 'throw']]) {
  resetClub(db);
  await freshFunctions();
  const ctx = await browser.newContext({ viewport: { width: 1180, height: 1000 }, locale: 'en-GB' });
  if (rybbit === 'throw') await ctx.addInitScript(`window.rybbit = { event: function(){ throw new Error('rybbit exploded'); } };`);
  const a = await guest({ ctx, rybbit: false });
  await a.open();
  await a.pickClub(); await a.qty(2); await a.reserve();
  check('Rybbit ' + label + ': the guest still reaches Stripe', /checkout\.stripe\.com/.test(a.page.url()));
  await a.page.goBack().catch(() => {});
  await a.page.waitForSelector('.mtx-hold:not([hidden])', { timeout: 15000 });
  await a.page.click('[data-resume]');
  await a.page.waitForURL(/checkout\.stripe\.com/, { timeout: 15000 });
  check('Rybbit ' + label + ': Continue to payment still works', /checkout\.stripe\.com/.test(a.page.url()));
  await ctx.close();
}

// ---------------------------------------------------------------------------
console.log('\nA tampered or stale browser entry is not trusted');
{
  resetClub(db);
  await freshFunctions();
  const ctx = await browser.newContext({ viewport: { width: 1180, height: 1000 }, locale: 'en-GB' });
  const a = await guest({ ctx });
  await a.page.goto('https://muaytix.com/rws', { waitUntil: 'domcontentloaded' }).catch(() => {});
  await a.page.evaluate(() => localStorage.setItem('mtx_hold', JSON.stringify({ r: '11111111-1111-4111-8111-111111111111', s: 'cs_x', u: 'https://evil.example/pay', e: 'x', x: Date.now() + 100000, k: 'test_night_1', c: 'club_class', n: 'Club Class', q: 3, m: 'thb' })));
  await a.open();
  await sleep(800);
  check('a hold the server has never heard of shows no notice', (await a.notice()) === null);
  check('and is forgotten', (await a.stored()) === null);
  await a.page.evaluate(() => localStorage.setItem('mtx_hold', 'not json {'));
  await a.open();
  check('a broken entry is ignored, the widget loads', (await a.notice()) === null && await a.page.isVisible('.mtx-pick'));
  resetClub(db);
  await a.open();
  await a.pickClub(); await a.qty(2); await a.reserve();
  await a.page.evaluate(() => { const h = JSON.parse(localStorage.getItem('mtx_hold')); h.u = 'https://evil.example/pay'; localStorage.setItem('mtx_hold', JSON.stringify(h)); });
  await a.page.goto('https://muaytix.com/rws', { waitUntil: 'domcontentloaded' });
  await a.page.waitForSelector('.mtx-hold:not([hidden])', { timeout: 15000 });
  await a.page.click('[data-resume]');
  await sleep(800);
  check('Continue to payment only ever goes to Stripe', /muaytix\.com/.test(a.page.url()), a.page.url());
  await ctx.close();
}

// ---------------------------------------------------------------------------
console.log('\nAn older copy of the widget (no hold reference at all)');
{
  resetClub(db);
  const f = await freshFunctions();
  const a = await guest({ hdr: cachedHeader });
  await a.open();
  await a.pickClub(); await a.qty(3); await a.reserve();
  check('still reserves and reaches Stripe', /checkout\.stripe\.com/.test(a.page.url()));
  check('through the old path: reserve_tickets, no hold lookups', f.checkout.log.rpcs.map((r) => r.name).join() === 'reserve_tickets', f.checkout.log.rpcs.map((r) => r.name).join());
  check('no hold notice and nothing stored by an old widget', (await a.stored()) === null);
  await a.page.goBack().catch(() => {});
  await a.page.waitForSelector('.mtx-pick, .mtx-detail', { timeout: 15000 });
  check('and asks nothing about holds', !a.seen.some((s) => s.body.holdId || s.body.action === 'hold'));
  const avail = f.avail;
  const res = await avail.handle(new Request('https://x/functions/v1/availability', { method: 'POST', headers: { origin: 'https://muaytix.com' }, body: JSON.stringify({ action: 'availability', eventKey: 'test_night_1' }) }));
  const j = await res.json();
  check('the public still sees 1 left, as before', j.classes.find((c) => c.code === 'club_class').seatsLeft === 1);
  await a.ctx.close();
}

// ---------------------------------------------------------------------------
console.log('\nNothing personal is stored or sent');
{
  const all = fns.checkout.log.rpcs.map((r) => JSON.stringify(r.args)).join(' ') + db.state.statements.join(' ');
  check('no hold lookup or swap named a guest column', !/guest_email|guest_name/.test(all));
  check('the widget stores nothing under any other key for holds', !/localStorage\.setItem\("(?!mtx_)/.test(fs.readFileSync(path.join(HERE, '..', 'widget.js'), 'utf8').replace(/mtx_attr/g, '')));
}

await browser.close();
db.drop();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
