// Agent Tix — the Rybbit "checkout_started" event sent by create-checkout
//
//   node agent-tix/functions/tests/checkout-started-guards.test.mjs
//
// create-checkout hands a guest to Stripe, so the analytics call that rides on
// it is tested by RUNNING THE REAL HANDLER, not by reading it. The function is
// loaded with its types stripped and its imports swapped for fakes (a fake
// database, a fake Stripe, a fake network), then called with real Requests.
//
// What has to hold:
//
//   Sent once, only after the Stripe session exists and its URL is about to be
//   returned. Never sent when the session fails or any earlier check refuses.
//
//   Checkout is untouched. The response is the same bytes with or without
//   Rybbit, whether Rybbit answers, errors, hangs or is switched off, and the
//   guest never waits for it.
//
//   No personal data leaves: nothing from the Stripe session's customer fields,
//   nothing from the attribution the browser sent, no IP.

import fs from 'node:fs';
import path from 'node:path';
import { stripTypeScriptTypes } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FN = path.join(HERE, '..');
const checkoutSrc = fs.readFileSync(path.join(FN, 'create-checkout', 'index.ts'), 'utf8');
const rybbitSrc = fs.readFileSync(path.join(FN, 'create-checkout', 'rybbit.ts'), 'utf8');
const webhookRybbitSrc = fs.readFileSync(path.join(FN, 'stripe-webhook-v2', 'rybbit.ts'), 'utf8');

const R = await import('data:text/javascript;base64,' +
  Buffer.from(stripTypeScriptTypes(rybbitSrc)).toString('base64'));

let pass = 0, fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail ? '  -> ' + detail : '')); }
};
// A real socket keeps the process alive while a request is pending, and the
// two second cut-off (AbortSignal.timeout) does not. The fake network has no
// socket, so this stands in for one.
const keepAlive = setInterval(() => {}, 100);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// The harness
// ---------------------------------------------------------------------------
const RES_ID = '3f1c2b4a-5d6e-4f70-8a9b-0c1d2e3f4a5b';
const ROW = {
  status: 'available', ticket_class_code: 'club_class', event_ticket_class_id: 'etc-1',
  event_key: 'petchyindee_2026_10_08', event_name: 'Petchyindee Traditional Muay Thai',
  ticket_class_name: 'Club Class', starts_at: '2026-10-08T11:00:00+00:00',
  venue_timezone: 'Asia/Bangkok', venue_name: 'Rajadamnern Stadium, Bangkok',
  assigned_seating: false, maximum_seats_together: null, closed_explanation: null,
};

function fakeSupabase(state) {
  const result = (table) => {
    if (table === 'tenants') return { data: { allowed_origins: ['https://muaytix.com'] }, error: null };
    if (table === 'event_ticket_availability') return { data: state.rows ?? [ROW], error: null };
    if (table === 'event_ticket_prices') return { data: { unit_amount: 180000, is_override: false }, error: null };
    return { data: null, error: null };
  };
  const from = (table) => {
    const q = {
      select() { return q; }, eq() { return q; }, in() { return q; }, limit() { return q; },
      update(patch) { state.updates.push({ table, patch }); return q; },
      single() { return Promise.resolve(result(table)); },
      maybeSingle() { return Promise.resolve(result(table)); },
      then(ok, bad) { return Promise.resolve(result(table)).then(ok, bad); },
    };
    return q;
  };
  return {
    from,
    rpc(name, args) {
      state.rpcs.push({ name, args });
      if (name === 'reserve_tickets') return Promise.resolve({ data: [{ reservation_id: RES_ID }], error: null });
      return Promise.resolve({ data: null, error: null });
    },
  };
}

const okSession = (params) => ({
  id: 'cs_test_abc123',
  url: 'https://checkout.stripe.com/c/pay/cs_test_abc123',
  amount_total: params.line_items[0].price_data.unit_amount * params.line_items[0].quantity,
  currency: params.line_items[0].price_data.currency,
  // Everything below is personal and must never reach Rybbit.
  customer_email: 'jason@example.com',
  customer_details: { name: 'Jason Mclellan', email: 'jason@example.com', phone: '+66800000000',
    address: { line1: '1 Test Street', postal_code: 'AB1 2CD' } },
});

const reply = (status, text = '') => ({ ok: status >= 200 && status < 300, status, text: async () => text });

// Builds the real create-checkout handler around fakes. Returns a function that
// sends a request through it and reports everything that happened.
function build({ rybbit = 'ok', key = 'RYBBIT_TEST_KEY', stripeCreate, rows } = {}) {
  const state = { updates: [], rpcs: [], logs: [], rybbitCalls: [], waits: [], rows };
  const env = {
    STRIPE_SECRET_KEY: 'sk_test_fake', SUPABASE_URL: 'https://fake.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'service_fake',
    RYBBIT_SITE_ID: '049ad8e38da6', RYBBIT_SITE_ID_ALT: '10499',
  };
  if (key) env.RYBBIT_API_KEY = key;

  let handler = null;
  const Deno = { env: { get: (k) => env[k] }, serve: (h) => { handler = h; } };

  const fakeFetch = (url, init) => {
    state.rybbitCalls.push({ url, init });
    if (rybbit === 'ok') return Promise.resolve(reply(200));
    if (rybbit === 'http500') return Promise.resolve(reply(500, 'boom'));
    if (rybbit === 'reject') return Promise.reject(new Error('offline'));
    if (rybbit === 'sync') throw new Error('fetch itself blew up');
    if (rybbit === 'hang') {
      return new Promise((_, rej) => {
        init.signal.addEventListener('abort', () => rej(new DOMException('timed out', 'TimeoutError')));
      });
    }
    return Promise.resolve(reply(200));
  };

  const log = (level) => (...a) => state.logs.push({ level, a });
  const fakeConsole = { info: log('info'), warn: log('warn'), error: log('error'), log: log('info') };

  class FakeStripe {
    constructor() {
      this.checkout = { sessions: { create: async (p) => (stripeCreate ?? (async (x) => okSession(x)))(p) } };
    }
  }

  let code = stripTypeScriptTypes(checkoutSrc);
  const swap = (re, to) => {
    if (!re.test(code)) throw new Error('import not found: ' + re);
    code = code.replace(re, to);
  };
  swap(/import "jsr:[^"]+";/, '');
  swap(/import \{ createClient \} from "npm:[^"]+";/, 'const createClient = __createClient;');
  swap(/import Stripe from "npm:[^"]+";/, 'const Stripe = __Stripe;');
  swap(/import \{ ([^}]+) \} from "\.\/rybbit\.ts";/, 'const { $1 } = __R;');

  const supabase = fakeSupabase(state);
  new Function('Deno', '__createClient', '__Stripe', '__R', 'fetch', 'console', code)(
    Deno, () => supabase, FakeStripe, R, fakeFetch, fakeConsole);

  return {
    state,
    async send(overrides = {}) {
      const body = {
        eventKey: 'petchyindee_2026_10_08', classCode: 'club_class', quantity: 2, currency: 'thb',
        pagePath: '/new-power-muay-thai', landingPage: '/',
        attribution: { clickId: 'GCLID_SECRET_123', clickIdKind: 'gclid', source: 'google', medium: 'cpc',
          campaign: 'brand_campaign', device: 'm' },
        ...overrides,
      };
      delete body.edgeRuntime;
      const req = new Request('https://fake.supabase.co/functions/v1/create-checkout', {
        method: 'POST',
        headers: { origin: 'https://muaytix.com', 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const started = Date.now();
      if (overrides.edgeRuntime === 'missing') delete globalThis.EdgeRuntime;
      else if (overrides.edgeRuntime === 'nowait') globalThis.EdgeRuntime = {};
      else globalThis.EdgeRuntime = { waitUntil: (p) => state.waits.push(p) };
      const res = await handler(req);
      const text = await res.text();
      const elapsed = Date.now() - started;
      delete globalThis.EdgeRuntime;
      return { status: res.status, text, elapsed };
    },
  };
}

const parse = (call) => JSON.parse(call.init.body);
// expiresAt is "now plus five minutes", so two runs differ by a few milliseconds
// there and nowhere else.
const sameButTime = (a, b) => {
  const strip = (t) => JSON.stringify({ ...JSON.parse(t), expiresAt: 'T' });
  return strip(a) === strip(b);
};

// ---------------------------------------------------------------------------
console.log('\nSent once, after the session exists');
let baseline;
{
  const h = build();
  const r = await h.send();
  baseline = r;
  check('the guest still gets the checkout URL, status 200', r.status === 200 && JSON.parse(r.text).checkoutUrl === 'https://checkout.stripe.com/c/pay/cs_test_abc123');
  // 9 October 2026: expiresAt and secondsLeft were added so the widget can count
  // down a hold (schema/0043). They are additive; nothing that was there moved.
  check('and the response has the same fields as before, plus the hold time',
    Object.keys(JSON.parse(r.text)).join() === 'checkoutUrl,sessionId,reservationId,currency,unitAmount,total,expiresAt,secondsLeft');
  check('exactly one Rybbit request', h.state.rybbitCalls.length === 1);
  const c = h.state.rybbitCalls[0];
  const b = parse(c);
  check('to the track endpoint, as a POST with the key and a JSON body',
    c.url === 'https://app.rybbit.io/api/track' && c.init.method === 'POST'
    && c.init.headers.Authorization === 'Bearer RYBBIT_TEST_KEY' && c.init.headers['Content-Type'] === 'application/json');
  check('type, event_name, hostname, pathname',
    b.type === 'custom_event' && b.event_name === 'checkout_started' && b.hostname === 'muaytix.com' && b.pathname === '/checkout-started');
  check('the site id and the explicit user agent, in body and header',
    b.site_id === '049ad8e38da6' && b.user_agent.startsWith('Mozilla/5.0') && c.init.headers['User-Agent'] === b.user_agent);
  check('properties is a JSON-encoded STRING', typeof b.properties === 'string');
  const p = JSON.parse(b.properties);
  check('amount in major units (THB 3600), currency upper case, quantity a number',
    p.amount === 3600 && p.currency === 'THB' && p.quantity === 2 && typeof p.quantity === 'number');
  check('class, event, date and session id',
    p.ticket_class === 'Club Class' && p.event_name === 'Petchyindee Traditional Muay Thai'
    && p.event_date === '2026-10-08' && p.stripe_session_id === 'cs_test_abc123');
  check('exactly those seven properties, strings and numbers only',
    Object.keys(p).sort().join() === 'amount,currency,event_date,event_name,quantity,stripe_session_id,ticket_class'
    && Object.values(p).every(v => typeof v === 'string' || typeof v === 'number'));
  check('the call is handed to EdgeRuntime.waitUntil so it survives the response', h.state.waits.length === 1 && typeof h.state.waits[0].then === 'function');
  await h.state.waits[0];
  check('the outcome is logged with the session id', h.state.logs.some(l => l.level === 'info' && JSON.stringify(l.a).includes('cs_test_abc123') && JSON.stringify(l.a).includes('sent')));
}
{
  const h = build();
  const r = await h.send({ quantity: 3, currency: 'usd' });
  const p = JSON.parse(parse(h.state.rybbitCalls[0]).properties);
  check('a USD booking of 3 reports USD, quantity 3, and the amount divided by 100 (fake price 180000 minor x 3 is 5400)', p.currency === 'USD' && p.quantity === 3 && p.amount === 5400);
}

// ---------------------------------------------------------------------------
console.log('\nNever sent unless the session was created');
{
  const h = build({ stripeCreate: async () => { throw new Error('stripe is down'); } });
  const r = await h.send();
  check('Stripe failing: the same 500 and message as before', r.status === 500 && JSON.parse(r.text).error === 'The secure checkout could not be started. Please try again.');
  check('and nothing is sent to Rybbit', h.state.rybbitCalls.length === 0 && h.state.waits.length === 0);
  check('and the seats are still given straight back', h.state.rpcs.some(c => c.name === 'release_reservation' && c.args.p_new_status === 'failed'));
}
{
  const h = build({ stripeCreate: async (p) => ({ ...okSession(p), url: null }) });
  const r = await h.send();
  check('Stripe returning no URL: a 500 and nothing sent', r.status === 500 && h.state.rybbitCalls.length === 0);
}
for (const [label, over, rows, status] of [
  ['a bad quantity', { quantity: 0 }, undefined, 400],
  ['a bad currency', { currency: 'baht' }, undefined, 400],
  ['a fully booked class', {}, [{ ...ROW, status: 'fully_booked' }], 409],
  ['a closed class', {}, [{ ...ROW, status: 'closed' }], 409],
  ['a class that does not exist', {}, [], 404],
]) {
  const h = build({ rows });
  const r = await h.send(over);
  check(label + ' is refused as before (' + status + ') and sends nothing', r.status === status && h.state.rybbitCalls.length === 0);
}
{
  const h = build();
  const r = await h.send({ action: 'warm' });
  check('the warm-up ping does nothing, reserves nothing, sends nothing', r.status === 200 && JSON.parse(r.text).warm === true && h.state.rybbitCalls.length === 0 && h.state.rpcs.length === 0);
}

// ---------------------------------------------------------------------------
console.log('\nCheckout is never changed by Rybbit');
for (const mode of ['http500', 'reject', 'hang']) {
  const h = build({ rybbit: mode });
  const r = await h.send();
  check('Rybbit ' + mode + ': the response is byte for byte the same as with Rybbit working', r.status === baseline.status && sameButTime(r.text, baseline.text));
  check('Rybbit ' + mode + ': the guest did not wait for it (' + r.elapsed + ' ms)', r.elapsed < 400);
  const t0 = Date.now();
  await h.state.waits[0];
  const waited = Date.now() - t0;
  check('Rybbit ' + mode + ': failure is logged with the session id',
    h.state.logs.some(l => l.level === 'error' && JSON.stringify(l.a).includes('cs_test_abc123')));
  check('Rybbit ' + mode + ': one try only, no retry loop', h.state.rybbitCalls.length === 1);
  if (mode === 'hang') {
    check('a hung Rybbit is cut off after about two seconds (' + waited + ' ms)', waited > 1500 && waited < 3200, String(waited));
  }
}
{
  const h = build({ key: null });
  const r = await h.send();
  check('no RYBBIT_API_KEY: the response is the same and nothing is sent', r.status === baseline.status && sameButTime(r.text, baseline.text) && h.state.rybbitCalls.length === 0);
}
{
  // The tracker itself blowing up (here fetch throws before returning anything)
  // must not reach the guest either.
  const h = build({ rybbit: 'sync' });
  const r = await h.send();
  await h.state.waits[0];
  check('fetch throwing outright: still the same response, logged with the session id',
    r.status === baseline.status && sameButTime(r.text, baseline.text)
    && h.state.logs.some(l => l.level === 'error' && JSON.stringify(l.a).includes('cs_test_abc123')));
}

for (const mode of ['missing', 'nowait']) {
  const h = build();
  const r = await h.send({ edgeRuntime: mode });
  await sleep(20);
  check('EdgeRuntime ' + mode + ': the response is the same as with it present', r.status === baseline.status && sameButTime(r.text, baseline.text));
  check('EdgeRuntime ' + mode + ': a warning naming the session id is logged',
    h.state.logs.some(l => l.level === 'warn' && JSON.stringify(l.a).includes('waitUntil') && JSON.stringify(l.a).includes('cs_test_abc123')));
  check('EdgeRuntime ' + mode + ': the event is still sent, once, best effort', h.state.rybbitCalls.length === 1);
}
{
  const h = build();
  await h.send();
  check('with the keep-alive present there is no warning', !h.state.logs.some(l => l.level === 'warn' && JSON.stringify(l.a).includes('waitUntil')));
}

// ---------------------------------------------------------------------------
console.log('\nNo personal data');
{
  const h = build();
  await h.send();
  const wire = h.state.rybbitCalls[0].init.body;
  const headers = JSON.stringify(h.state.rybbitCalls[0].init.headers);
  const leaked = ['Jason', 'Mclellan', 'jason@example.com', '+66800000000', 'Test Street', 'AB1 2CD',
    'GCLID_SECRET_123', 'brand_campaign', '/new-power-muay-thai', RES_ID].filter(s => wire.includes(s) || headers.includes(s));
  check('nothing from the Stripe customer fields, the browser attribution or the reservation reaches Rybbit', leaked.length === 0, leaked.join());
  const b = JSON.parse(wire);
  check('the body has only the agreed top-level fields, so no ip or user fields',
    Object.keys(b).sort().join() === 'event_name,hostname,pathname,properties,site_id,type,user_agent');
}

// ---------------------------------------------------------------------------
console.log('\nThe helper on its own');
check('localDateOf gives the venue’s date: 11:00 UTC is 18:00 Bangkok the same day', R.localDateOf('2026-10-08T11:00:00+00:00', 'Asia/Bangkok') === '2026-10-08');
check('and rolls over correctly: 20:00 UTC is already tomorrow in Bangkok', R.localDateOf('2026-10-08T20:00:00+00:00', 'Asia/Bangkok') === '2026-10-09');
check('garbage in, null out', R.localDateOf('nope', 'Asia/Bangkok') === null && R.localDateOf(null, null) === null);
check('the amount follows Stripe’s decimals: JPY 5000 is 5000, KWD 12345 is 12.345', R.majorUnits(5000, 'jpy') === 5000 && R.majorUnits(12345, 'kwd') === 12.345);
{
  const calls = [];
  const out = await R.reportCheckoutStarted(
    { sessionId: 's1', amountMinor: null, currency: 'thb', quantity: 1 },
    { apiKey: 'K', siteIds: ['a'], fetchFn: async (...a) => { calls.push(a); return reply(200); }, log: () => {} });
  check('no amount: skipped, not guessed', out === 'skipped_no_amount' && calls.length === 0);
}

// ---------------------------------------------------------------------------
console.log('\nCreate-checkout is otherwise untouched (source guards)');
const flat = (s) => s.replace(/\s+/g, ' ');
const idx = flat(checkoutSrc);
const at = (needle) => idx.indexOf(needle);
check('the Rybbit step is after the session URL check', at('if (!session.url) throw') > 0 && at('if (!session.url) throw') < at('reportCheckoutStarted({'));
check('after the attribution is stored', at('attribution not stored') < at('reportCheckoutStarted({'));
check('and right before the response is returned', at('reportCheckoutStarted({') < at('return json({ checkoutUrl: session.url'));
check('it is outside the catch that gives the seats back', at('reportCheckoutStarted({') < at('If anything failed after the hold'));
check('it is not awaited', !/await reportCheckoutStarted/.test(checkoutSrc));
check('the response fields are unchanged, with the hold time added after them',
  idx.includes('return json({ checkoutUrl: session.url, sessionId: session.id, reservationId, currency, unitAmount, total: unitAmount * quantity,'));
check('the error response and the seat release are unchanged',
  idx.includes('The secure checkout could not be started. Please try again.') && idx.includes('p_new_status: "failed"'));
check('the metadata is unchanged', idx.includes('source: "agent_tix_v2", v2_reservation_id: String(reservationId), event_key: row.event_key,'));
check('the key and site ids come from the environment, never the source',
  checkoutSrc.includes('Deno.env.get("RYBBIT_API_KEY")') && checkoutSrc.includes('Deno.env.get("RYBBIT_SITE_ID")')
  && !/Bearer [A-Za-z0-9_-]{12,}/.test(checkoutSrc + rybbitSrc) && !/["'`][A-Za-z0-9_-]{32,}["'`]/.test(checkoutSrc + rybbitSrc));
check('create-checkout’s copy of rybbit.ts is byte for byte the webhook’s copy', rybbitSrc === webhookRybbitSrc);

clearInterval(keepAlive);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
