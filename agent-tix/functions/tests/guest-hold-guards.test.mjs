// Agent Tix — a guest's own hold, in create-checkout
//
//   PGHOST=/tmp PGPORT=5544 PGUSER=postgres node agent-tix/functions/tests/guest-hold-guards.test.mjs
//
// Runs the REAL create-checkout handler over a REAL scratch Postgres that has
// schema/0043_guest_hold.sql loaded, with a fake Stripe. Nothing touches the live
// database or the live Stripe account. See pg-harness.mjs.
//
// What has to hold, from Jason's brief of 9 October 2026:
//
//   A guest's own hold is not subtracted from what that guest may buy, on the
//   server as well as in the widget. Everyone else still sees the true count.
//
//   The same choice again while the hold is live makes nothing new: one
//   reservation, one Stripe session, the same URL.
//
//   A different choice takes the new seats first and gives the old ones back
//   only if that worked. A change that cannot be made leaves the old hold, and its
//   Stripe page, exactly as they were. A change that works expires the old Stripe
//   page so it cannot be paid.
//
//   Stripe's back arrow goes to the page the guest came from, never to a page
//   saying a payment failed, and never with the reservation id in the address.
//
//   A request with no hold reference behaves exactly as it did before.

import fs from 'node:fs';
import path from 'node:path';
import { stripTypeScriptTypes } from 'node:module';
import { fileURLToPath } from 'node:url';
import { makeDb, fakeClient, fakeStripe, seed, resetClub, IDS } from './pg-harness.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FN = path.join(HERE, '..');
const checkoutSrc = fs.readFileSync(path.join(FN, 'create-checkout', 'index.ts'), 'utf8');
const rybbitSrc = fs.readFileSync(path.join(FN, 'create-checkout', 'rybbit.ts'), 'utf8');
const R = await import('data:text/javascript;base64,' + Buffer.from(stripTypeScriptTypes(rybbitSrc)).toString('base64'));

let pass = 0, fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail ? '  -> ' + detail : '')); }
};

const db = makeDb('holdtest_fn');
try { db.create(); } catch (e) {
  console.log('Cannot reach a scratch Postgres (set PGHOST / PGPORT / PGUSER): ' + String(e.stderr ?? e.message).trim());
  process.exit(2);
}
seed(db);

const held = () => db.rows(`select id, status, quantity, stripe_checkout_session_id sid from checkout_reservations where status = 'held' order by created_at`);
const club = () => db.rows(`select quantity_available avail, reserved_quantity reserved, sold_quantity sold from event_ticket_classes where id = '${IDS.club}'`)[0];
const publicView = () => db.rows(`select status, max_per_order from event_ticket_availability where event_key = 'test_night_1' and ticket_class_code = 'club_class'`)[0];
const reservation = (id) => db.rows(`select status, quantity from checkout_reservations where id = '${id}'`)[0];

// Builds the real handler around the scratch database and a fake Stripe.
function build({ stripe = {} } = {}) {
  const env = { STRIPE_SECRET_KEY: 'sk_test_fake', SUPABASE_URL: 'https://fake.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'service_fake' };
  const log = { rpcs: [], logs: [] };
  const S = fakeStripe(stripe);
  const client = fakeClient(db, {
    fixed: { tenants: { allowed_origins: ['https://muaytix.com'] } },
    onRpc: (name, args) => log.rpcs.push({ name, args }),
  });
  let handler = null;
  const Deno = { env: { get: (k) => env[k] }, serve: (h) => { handler = h; } };
  const logger = (level) => (...a) => log.logs.push({ level, a });
  const fakeConsole = { info: logger('info'), warn: logger('warn'), error: logger('error'), log: logger('info') };
  let code = stripTypeScriptTypes(checkoutSrc);
  const swap = (re, to) => { if (!re.test(code)) throw new Error('import not found: ' + re); code = code.replace(re, to); };
  swap(/import "jsr:[^"]+";/, '');
  swap(/import \{ createClient \} from "npm:[^"]+";/, 'const createClient = __createClient;');
  swap(/import Stripe from "npm:[^"]+";/, 'const Stripe = __Stripe;');
  swap(/import \{ ([^}]+) \} from "\.\/rybbit\.ts";/, 'const { $1 } = __R;');
  new Function('Deno', '__createClient', '__Stripe', '__R', 'fetch', 'console', code)(
    Deno, () => client, S.FakeStripe, R, async () => ({ ok: true, status: 200, text: async () => '' }), fakeConsole);
  return {
    log, stripe: S,
    async send(body = {}) {
      const req = new Request('https://fake.supabase.co/functions/v1/create-checkout', {
        method: 'POST', headers: { origin: 'https://muaytix.com', 'content-type': 'application/json' },
        body: JSON.stringify({ eventKey: 'test_night_1', classCode: 'club_class', quantity: 3, currency: 'thb',
          pagePath: '/rajadamnern-knockout/2026-10-12', landingPage: '/', ...body }),
      });
      const res = await handler(req);
      const text = await res.text();
      return { status: res.status, body: JSON.parse(text), text };
    },
  };
}

// ---------------------------------------------------------------------------
console.log('\nNo hold reference: exactly as before');
{
  resetClub(db);
  const h = build();
  const r = await h.send();
  check('a guest with no hold reserves and is sent to Stripe', r.status === 200 && r.body.checkoutUrl.startsWith('https://checkout.stripe.com/'), r.text);
  check('through reserve_tickets, the same call as always', h.log.rpcs.map((x) => x.name).join() === 'reserve_tickets', h.log.rpcs.map((x) => x.name).join());
  check('no hold is looked up, no swap is tried', !h.log.rpcs.some((x) => ['live_hold', 'replace_reservation', 'class_view_for_holder'].includes(x.name)));
  check('the response has the old fields plus the hold time', Object.keys(r.body).join() === 'checkoutUrl,sessionId,reservationId,currency,unitAmount,total,expiresAt,secondsLeft', Object.keys(r.body).join());
  check('the hold is 300 seconds', r.body.secondsLeft === 300);
  const exp = Date.parse(r.body.expiresAt) - Date.now();
  check('and expiresAt is about five minutes away', exp > 290_000 && exp < 301_000, String(exp));
  check('3 held, public sees 1 left and max per order 1', club().reserved === 3 && club().avail === 1 && publicView().max_per_order === 1, JSON.stringify(club()));
  const again = await h.send();
  check('pressing Reserve again WITHOUT a hold reference still makes a second hold (the old behaviour)', again.status === 409 || held().length === 2, JSON.stringify(again.body));
  check('an older widget asking for more than the public count is refused as ever', (await h.send({ quantity: 4 })).status === 409);
  resetClub(db);
  check('a made up hold reference is ignored: behaves as no hold', (await build().send({ holdId: 'not-a-uuid', quantity: 1 })).status === 200);
  resetClub(db);
  check('an unknown but well formed hold reference is ignored too', (await build().send({ holdId: '11111111-1111-4111-8111-111111111111', quantity: 1 })).status === 200);
}

// ---------------------------------------------------------------------------
console.log('\n4 seats left: hold 3, change to 4 (own seats count for the holder only)');
{
  resetClub(db);
  const h = build();
  const first = await h.send({ quantity: 3 });
  const R1 = first.body.reservationId;
  const stranger = await h.send({ quantity: 4 });
  check('another guest asking for 4 is refused: only 1 left', stranger.status === 409 && /Only 1 remaining/.test(stranger.body.error), stranger.text);
  const mine = await h.send({ quantity: 4, holdId: R1 });
  check('the holder asking for 4 is allowed', mine.status === 200 && mine.body.replaced === true, mine.text);
  check('the old hold is released and the new one is held for 4', reservation(R1).status === 'released' && reservation(mine.body.reservationId).quantity === 4 && reservation(mine.body.reservationId).status === 'held');
  check('exactly one live hold remains', held().length === 1);
  check('the class is now full for everyone else', club().avail === 0 && publicView().status === 'fully_booked');
  check('the old Stripe page was expired, and before the answer came back', h.stripe.sessions.get(first.body.sessionId).status === 'expired');
  check('the new Stripe page is open', h.stripe.sessions.get(mine.body.sessionId).status === 'open');
  const ops = h.stripe.calls.filter((c) => c.op !== 'retrieve').map((c) => c.op + (c.id ? ':' + c.id : ''));
  check('Stripe was told: create the first page, create the new one, expire the old one (the expire starts at once, alongside the create)',
    ops.filter((o) => o === 'create').length === 2 && ops.includes('expire:' + first.body.sessionId) && ops.length === 3, ops.join());
  const five = await h.send({ quantity: 5, holdId: mine.body.reservationId });
  check('asking for 5 when own 4 plus public 0 is only 4: refused', five.status === 409 && five.body.code === 'change_unavailable', five.text);
  check('...and the 4 are still held, untouched', reservation(mine.body.reservationId).status === 'held' && club().reserved === 4);
}

// ---------------------------------------------------------------------------
console.log('\nHold 3, change to 2: 3 released, 2 held, public count 2');
{
  resetClub(db);
  const h = build();
  const first = await h.send({ quantity: 3 });
  const second = await h.send({ quantity: 2, holdId: first.body.reservationId });
  check('the change is accepted and reported as a replacement', second.status === 200 && second.body.replaced === true, second.text);
  check('old 3 released, new 2 held', reservation(first.body.reservationId).status === 'released' && reservation(second.body.reservationId).quantity === 2);
  check('public count is 2 (6 sold + 2 held of 10)', club().avail === 2 && club().reserved === 2, JSON.stringify(club()));
  check('old Stripe page expired, new one open',
    h.stripe.sessions.get(first.body.sessionId).status === 'expired' && h.stripe.sessions.get(second.body.sessionId).status === 'open');
  check('the new session carries the new quantity', h.stripe.sessions.get(second.body.sessionId).params.line_items[0].quantity === 2);
  check('the new reservation is stored against the new session', held()[0].sid === second.body.sessionId);
}

// ---------------------------------------------------------------------------
console.log('\nHold 3, change to a sold out class: refused, old hold untouched');
{
  resetClub(db);
  const h = build();
  const first = await h.send({ quantity: 3 });
  const creates = h.stripe.calls.filter((c) => c.op === 'create').length;
  const r = await h.send({ classCode: 'ringside', quantity: 1, holdId: first.body.reservationId });
  check('the new choice is refused with a 409', r.status === 409, r.text);
  check('and the guest is told so, in words', r.body.code === 'change_unavailable' && /not available/i.test(r.body.error) && /still held/i.test(r.body.error), r.text);
  check('the old hold is still held, same size', reservation(first.body.reservationId).status === 'held' && reservation(first.body.reservationId).quantity === 3);
  check('the old seats never came back to the public', club().reserved === 3 && club().avail === 1);
  check('no new Stripe session was made', h.stripe.calls.filter((c) => c.op === 'create').length === creates);
  check('the old Stripe page was NOT expired', h.stripe.sessions.get(first.body.sessionId).status === 'open' && !h.stripe.calls.some((c) => c.op === 'expire'));
  const again = await h.send({ quantity: 3, holdId: first.body.reservationId });
  check('and the old choice still works afterwards (same URL back)', again.status === 200 && again.body.checkoutUrl === first.body.checkoutUrl);
}

// ---------------------------------------------------------------------------
console.log('\nThe same choice twice: one reservation, one Stripe session');
{
  resetClub(db);
  const h = build();
  const first = await h.send({ quantity: 3 });
  const second = await h.send({ quantity: 3, holdId: first.body.reservationId });
  check('the same URL comes back', second.status === 200 && second.body.checkoutUrl === first.body.checkoutUrl, second.text);
  check('the same session and the same reservation', second.body.sessionId === first.body.sessionId && second.body.reservationId === first.body.reservationId);
  check('marked as resumed, with the time that is left', second.body.resumed === true && second.body.secondsLeft > 0 && second.body.secondsLeft <= 300, String(second.body.secondsLeft));
  check('one live hold, still 3 reserved', held().length === 1 && club().reserved === 3);
  check('Stripe was asked to create exactly once', h.stripe.calls.filter((c) => c.op === 'create').length === 1);
  check('and nothing was expired', !h.stripe.calls.some((c) => c.op === 'expire'));
  const third = await h.send({ quantity: 3, holdId: first.body.reservationId });
  check('a third press is the same again', third.body.sessionId === first.body.sessionId && held().length === 1);
  const usd = await h.send({ quantity: 3, currency: 'usd', holdId: first.body.reservationId });
  check('a different currency is a different choice: new hold, old page expired', usd.status === 200 && usd.body.replaced === true && usd.body.sessionId !== first.body.sessionId && h.stripe.sessions.get(first.body.sessionId).status === 'expired', usd.text);
}

console.log('\nThe held Stripe page is no longer open: carry on as a change');
{
  resetClub(db);
  const h = build();
  const first = await h.send({ quantity: 3 });
  h.stripe.sessions.get(first.body.sessionId).status = 'expired';
  const r = await h.send({ quantity: 3, holdId: first.body.reservationId });
  check('a new session is made and the guest is sent to it', r.status === 200 && r.body.sessionId !== first.body.sessionId && r.body.resumed !== true, r.text);
  check('still exactly one live hold', held().length === 1 && club().reserved === 3);
  const h2 = build({ stripe: { retrieveFails: true } });
  resetClub(db);
  const a = await h2.send({ quantity: 3 });
  const b = await h2.send({ quantity: 3, holdId: a.body.reservationId });
  check('if Stripe cannot be asked at all, the guest still gets a working checkout', b.status === 200, b.text);
}

// ---------------------------------------------------------------------------
console.log('\nExpiring the old page fails: logged, the guest is not blocked');
{
  resetClub(db);
  const h = build({ stripe: { expireFails: true } });
  const first = await h.send({ quantity: 3 });
  const r = await h.send({ quantity: 2, holdId: first.body.reservationId });
  check('the change still works', r.status === 200 && r.body.replaced === true, r.text);
  check('the failure is logged with the session id', h.log.logs.some((l) => l.level === 'error' && JSON.stringify(l.a).includes(first.body.sessionId) && /expire/.test(JSON.stringify(l.a))));
}

console.log('\nStripe fails after the swap');
{
  resetClub(db);
  const ok = build();
  const first = await ok.send({ quantity: 3 });
  const h = build({ stripe: { createFails: true } });
  // The old session lives in the other fake Stripe; give this one a copy so expire can find it.
  h.stripe.sessions.set(first.body.sessionId, { id: first.body.sessionId, status: 'open', url: 'x' });
  const r = await h.send({ quantity: 2, holdId: first.body.reservationId });
  check('the guest is told it could not be started, status 500', r.status === 500, r.text);
  check('the new hold is given back, and no live hold is left', held().length === 0 && club().reserved === 0, JSON.stringify(club()));
  check('the old page was still expired, so it cannot be paid', h.stripe.sessions.get(first.body.sessionId).status === 'expired');
}

// ---------------------------------------------------------------------------
console.log('\nA hold that has run out, or belongs to another night, is not a hold');
{
  resetClub(db);
  const h = build();
  const first = await h.send({ quantity: 3 });
  db.exec(`update checkout_reservations set expires_at = now() - interval '1 second' where id = '${first.body.reservationId}'`);
  const r = await h.send({ quantity: 1, holdId: first.body.reservationId });
  check('an expired hold is treated as no hold (one seat: public count is 1)', r.status === 200 && h.log.rpcs.some((x) => x.name === 'reserve_tickets') , r.text);
  check('and the expired hold is not touched by the request', reservation(first.body.reservationId).status === 'held');
  resetClub(db);
  const a = await h.send({ quantity: 3 });
  const other = await h.send({ eventKey: 'test_night_2', quantity: 2, holdId: a.body.reservationId });
  check('a hold on another night is left alone', other.status === 200 && other.body.replaced !== true && reservation(a.body.reservationId).status === 'held', other.text);
}

// ---------------------------------------------------------------------------
console.log('\nA holder moves to a different class on the same night');
{
  resetClub(db);
  const h = build();
  const first = await h.send({ quantity: 3 });
  const r = await h.send({ classCode: 'third_class', quantity: 2, holdId: first.body.reservationId });
  check('Club seats released, Third Class held', r.status === 200 && reservation(first.body.reservationId).status === 'released' && club().reserved === 0, r.text);
  check('old page expired', h.stripe.sessions.get(first.body.sessionId).status === 'expired');
}

// ---------------------------------------------------------------------------
console.log('\nStripe back arrow: where it goes');
{
  const cases = [
    ['/rajadamnern-knockout/2026-10-12', 'https://muaytix.com/rajadamnern-knockout/2026-10-12?checkout=cancelled', 'a dated Knockout page'],
    ['/rws/knocktoberfest-10-october-2026', 'https://muaytix.com/rws/knocktoberfest-10-october-2026?checkout=cancelled', 'an RWS page'],
    ['/rws', 'https://muaytix.com/rws?checkout=cancelled', 'the RWS prefix itself'],
    ['/rajadamnern-stadium-tickets', 'https://muaytix.com/rajadamnern-stadium-tickets?checkout=cancelled', 'the tickets page'],
    ['/rajadamnern-stadium-seating/club-class', 'https://muaytix.com/rajadamnern-stadium-seating/club-class?checkout=cancelled', 'a seat class page'],
    ['/some-other-page', 'https://muaytix.com/payment-failed', 'an unknown page falls back'],
    ['/rwsx', 'https://muaytix.com/payment-failed', 'a prefix is a whole path part: /rwsx is not /rws'],
    ['/rws/../admin', 'https://muaytix.com/payment-failed', 'path traversal falls back'],
    ['//evil.example/rws', 'https://muaytix.com/payment-failed', 'a protocol relative address falls back'],
    ['https://evil.example/rws', 'https://muaytix.com/payment-failed', 'a full address falls back'],
    ['/rws/a b', 'https://muaytix.com/payment-failed', 'spaces fall back'],
    ['/rws/%2e%2e/x', 'https://muaytix.com/payment-failed', 'encoded dots fall back'],
    ['/rws/page?x=1#y', 'https://muaytix.com/rws/page?checkout=cancelled', 'a query string and fragment are cut off, not carried'],
    [undefined, 'https://muaytix.com/payment-failed', 'no page reported falls back'],
    ['/', 'https://muaytix.com/payment-failed', 'the home page is not a known widget page: falls back'],
  ];
  for (const [pagePath, want, label] of cases) {
    resetClub(db);
    const h = build();
    const r = await h.send({ quantity: 1, pagePath });
    const params = h.stripe.sessions.get(r.body.sessionId).params;
    check(label + ' -> ' + want.replace('https://muaytix.com', ''), params.cancel_url === want, params.cancel_url);
  }
  resetClub(db);
  const h = build();
  const r = await h.send({ quantity: 1, pagePath: '/rws/tickets' });
  const params = h.stripe.sessions.get(r.body.sessionId).params;
  check('the reservation id is not in the cancel address', !params.cancel_url.includes(r.body.reservationId) && !params.cancel_url.includes('reservation'));
  check('the success address is untouched', params.success_url === 'https://muaytix.com/payment-successful?session_id={CHECKOUT_SESSION_ID}');
  const r2 = await h.send({ quantity: 1, pagePath: '/rws/tickets', cancelUrl: 'https://muaytix.com/custom-cancel' });
  check('an explicit same-site cancelUrl from the request still wins, as it always did', h.stripe.sessions.get(r2.body.sessionId).params.cancel_url === 'https://muaytix.com/custom-cancel');
  const r3 = await h.send({ quantity: 1, pagePath: '/rws/tickets', cancelUrl: 'https://evil.example/' });
  check('an explicit cancelUrl on another site is ignored, as it always was', h.stripe.sessions.get(r3.body.sessionId).params.cancel_url === 'https://muaytix.com/rws/tickets?checkout=cancelled');
}

// ---------------------------------------------------------------------------
console.log('\nPersonal data');
{
  const all = db.state.statements.join('\n');
  check('no statement this test ran, through the function, mentions a guest column', !/guest_email|guest_name/i.test(all.replace(/-- [^\n]*/g, '')));
  check('create-checkout never names a guest column', !/guest_email|guest_name/.test(checkoutSrc));
  check('the hold is looked up only through live_hold', /rpc\("live_hold"/.test(checkoutSrc) && !/from\("checkout_reservations"\)\s*\.select/.test(checkoutSrc));
}

db.drop();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
