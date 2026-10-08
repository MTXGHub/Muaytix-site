// Agent Tix — the Rybbit "purchase" event sent by the Stripe webhook
//
//   node agent-tix/functions/tests/rybbit-purchase-guards.test.mjs
//
// The webhook banks real money, so the analytics call that rides on it is
// tested by running it. rybbit.ts imports nothing, so it is loaded as it is
// (types stripped) and driven with a fake network and a fake claim.
//
// What has to hold:
//
//   One sale, one event. A retried or repeated webhook never sends a second.
//   No personal data leaves: no name, email, phone, address or card detail.
//   Any failure at all leaves the booking alone: nothing throws.
//   The amount follows Stripe's decimal rules for the currency.
//   `properties` is a JSON-encoded string of strings and numbers, as Rybbit asks.

import fs from 'node:fs';
import path from 'node:path';
import { stripTypeScriptTypes } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(HERE, '..', 'stripe-webhook-v2');
const rybbitSrc = fs.readFileSync(path.join(dir, 'rybbit.ts'), 'utf8');
const indexSrc = fs.readFileSync(path.join(dir, 'index.ts'), 'utf8');

const js = stripTypeScriptTypes(rybbitSrc);
const R = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));

let pass = 0, fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail ? '  -> ' + detail : '')); }
};

// ---------------------------------------------------------------------------
console.log('\nThe amount follows Stripe\'s decimal rules');
check('THB 250000 is 2500', R.majorUnits(250000, 'thb') === 2500);
check('USD 5400 is 54', R.majorUnits(5400, 'usd') === 54);
check('EUR 4400 is 44', R.majorUnits(4400, 'EUR') === 44);
check('GBP 3350 is 33.5', R.majorUnits(3350, 'gbp') === 33.5);
check('JPY is zero-decimal: 5000 is 5000', R.majorUnits(5000, 'jpy') === 5000);
check('KWD is three-decimal: 12345 is 12.345', R.majorUnits(12345, 'kwd') === 12.345);
check('ISK is sent two-decimal by Stripe: 100000 is 1000', R.majorUnits(100000, 'isk') === 1000);
check('currency case does not matter', R.decimalPlaces('JPY') === 0 && R.decimalPlaces('jpy') === 0);
check('no floating point dust: 1999 usd is 19.99', R.majorUnits(1999, 'usd') === 19.99);

// ---------------------------------------------------------------------------
console.log('\nThe request body');
const facts = {
  sessionId: 'cs_test_abc123', amountMinor: 360000, currency: 'thb', quantity: 2,
  ticketClass: 'Club Class', eventName: 'Petchyindee Traditional Muay Thai', eventDate: '2026-10-08',
};
const body = R.purchaseBody(facts, '049ad8e38da6');
check('site_id, type, event_name, hostname, pathname',
  body.site_id === '049ad8e38da6' && body.type === 'custom_event' && body.event_name === 'purchase'
  && body.hostname === 'muaytix.com' && body.pathname === '/stripe-webhook-purchase');
check('properties is a STRING, not an object', typeof body.properties === 'string');
check('an explicit user_agent is in the body, and it is an ordinary browser one',
  typeof body.user_agent === 'string' && body.user_agent.startsWith('Mozilla/5.0') && !/deno|supabase|bot|node|curl/i.test(body.user_agent));
check('a custom user agent replaces it', R.purchaseBody(facts, 'x', 'Custom/1').user_agent === 'Custom/1');
check('a blank one falls back to the default', R.purchaseBody(facts, 'x', '  ').user_agent === R.DEFAULT_USER_AGENT);
const props = JSON.parse(body.properties);
check('properties holds amount, currency, quantity, session id, class, event, date',
  props.amount === 3600 && props.quantity === 2 && props.currency === 'THB' && props.stripe_session_id === 'cs_test_abc123'
  && props.ticket_class === 'Club Class' && props.event_name === 'Petchyindee Traditional Muay Thai'
  && props.event_date === '2026-10-08');
check('only strings and numbers', Object.values(props).every(v => typeof v === 'string' || typeof v === 'number'));
check('exactly those seven property keys', Object.keys(props).sort().join() ===
  'amount,currency,event_date,event_name,quantity,stripe_session_id,ticket_class');
check('quantity is a NUMBER, not a string', typeof props.quantity === 'number');
for (const bad of ['2', 0, -1, 1.5, NaN, null, undefined]) {
  const p2 = JSON.parse(R.purchaseBody({ ...facts, quantity: bad }, 'x').properties);
  check('a quantity of ' + JSON.stringify(bad) + ' is left out, never guessed', !('quantity' in p2));
}
check('currency is upper case', props.currency === 'THB');
const sparse = JSON.parse(R.purchaseBody({ sessionId: 's', amountMinor: 100, currency: 'usd' }, '1').properties);
check('a missing detail is left out, not sent empty', Object.keys(sparse).sort().join() === 'amount,currency,stripe_session_id');
const ab = R.eventBody('abandoned_checkout', facts, '049ad8e38da6');
check('the abandoned event has its own name and pathname',
  ab.event_name === 'abandoned_checkout' && ab.pathname === '/stripe-webhook-abandoned'
  && ab.type === 'custom_event' && ab.hostname === 'muaytix.com' && ab.site_id === '049ad8e38da6');
check('the abandoned event carries the same user agent and a string properties',
  ab.user_agent === body.user_agent && typeof ab.properties === 'string');
check('the abandoned properties are the same seven keys, strings and numbers only',
  Object.keys(JSON.parse(ab.properties)).sort().join() === 'amount,currency,event_date,event_name,quantity,stripe_session_id,ticket_class'
  && Object.values(JSON.parse(ab.properties)).every(v => typeof v === 'string' || typeof v === 'number'));
check('the purchase event is unchanged: still purchase on /stripe-webhook-purchase',
  body.event_name === 'purchase' && body.pathname === '/stripe-webhook-purchase');

// ---------------------------------------------------------------------------
console.log('\nSending');
const reply = (status, text = '') => ({ ok: status >= 200 && status < 300, status, text: async () => text });
function net(...answers) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init });
    const a = answers.shift();
    if (a instanceof Error) throw a;
    return a ?? reply(200);
  };
  fn.calls = calls;
  return fn;
}

{
  const f = net(reply(200));
  const r = await R.sendPurchase({ apiKey: 'KEY', siteIds: ['049ad8e38da6', '10499'], facts, fetchFn: f });
  const c = f.calls[0];
  check('one POST to the track endpoint', f.calls.length === 1 && c.url === 'https://app.rybbit.io/api/track' && c.init.method === 'POST');
  check('Authorization: Bearer and JSON content type',
    c.init.headers.Authorization === 'Bearer KEY' && c.init.headers['Content-Type'] === 'application/json');
  check('success names the site id that worked', r.ok === true && r.siteIdUsed === '049ad8e38da6');
  check('the body on the wire is the body above', JSON.parse(c.init.body).event_name === 'purchase');
  check('the User-Agent header matches the user_agent field',
    c.init.headers['User-Agent'] === JSON.parse(c.init.body).user_agent && c.init.headers['User-Agent'].startsWith('Mozilla/5.0'));
}
{
  const f = net(reply(400, 'bad site'), reply(200));
  const r = await R.sendPurchase({ apiKey: 'KEY', siteIds: ['049ad8e38da6', '10499'], facts, fetchFn: f });
  check('a rejected site id tries the other form once',
    f.calls.length === 2 && JSON.parse(f.calls[1].init.body).site_id === '10499');
  check('and reports which one worked', r.ok === true && r.siteIdUsed === '10499');
}
{
  const f = net(reply(400), reply(400));
  const r = await R.sendPurchase({ apiKey: 'KEY', siteIds: ['a', 'b'], facts, fetchFn: f });
  check('both rejected: two tries, no more, reported as failed', f.calls.length === 2 && r.ok === false);
}
{
  const f = net(reply(401));
  const r = await R.sendPurchase({ apiKey: 'KEY', siteIds: ['a', 'b'], facts, fetchFn: f });
  check('a bad key is not retried with the other site id', f.calls.length === 1 && r.ok === false && r.status === 401);
}
{
  const f = net(reply(429));
  await R.sendPurchase({ apiKey: 'KEY', siteIds: ['a', 'b'], facts, fetchFn: f });
  check('a rate limit is not retried', f.calls.length === 1);
}
{
  const f = net(reply(500));
  const r = await R.sendPurchase({ apiKey: 'KEY', siteIds: ['a', 'b'], facts, fetchFn: f });
  check('a 5xx is not retried: the outcome is unknown, a second send could double count',
    f.calls.length === 1 && r.ok === false);
}
{
  const f = net(new Error('boom'));
  const r = await R.sendPurchase({ apiKey: 'KEY', siteIds: ['a', 'b'], facts, fetchFn: f });
  check('a network error does not throw and is not retried', f.calls.length === 1 && r.ok === false);
}
{
  const f = net();
  const r = await R.sendPurchase({ apiKey: 'KEY', siteIds: ['', ''], facts, fetchFn: f });
  check('no site id configured: nothing is sent', f.calls.length === 0 && r.ok === false);
}
{
  const f = net(reply(400, 'x'.repeat(50)));
  const r = await R.sendPurchase({ apiKey: 'SECRETKEY', siteIds: ['a'], facts, fetchFn: f });
  check('the failure reason never contains the key or the reply text',
    !JSON.stringify(r).includes('SECRETKEY') && !JSON.stringify(r).includes('xxxx'));
}

// ---------------------------------------------------------------------------
console.log('\nThe whole step, against a fake claim and a fake network');
const session = (over = {}) => ({
  id: 'cs_test_abc123', payment_status: 'paid', amount_total: 360000, currency: 'thb',
  metadata: { source: 'agent_tix_v2', quantity: '2', ticket_class: 'Club Class', event_name: 'Petchyindee Traditional Muay Thai', event_key: 'petchyindee_2026_10_08' },
  ...over,
});
function deps({ fetchFn, claimed = false, key = 'KEY', dateFails = false } = {}) {  // key: null means "not set"
  const logs = [];
  const d = {
    apiKey: key, siteIds: ['049ad8e38da6', '10499'], fetchFn: fetchFn ?? net(reply(200)),
    state: { claimed, released: 0 },
    claim: async () => { if (d.state.claimed) return false; d.state.claimed = true; return true; },
    release: async () => { d.state.claimed = false; d.state.released++; },
    eventDate: async () => { if (dateFails) throw new Error('db down'); return '2026-10-08'; },
    log: (level, msg, detail) => logs.push({ level, msg, detail }),
    logs,
  };
  return d;
}

{
  const d = deps();
  const out = await R.reportPurchase(session(), 'completed', d);
  const sent = JSON.parse(d.fetchFn.calls[0].init.body);
  check('a paid, completed sale sends one event', out === 'sent' && d.fetchFn.calls.length === 1);
  check('with the night\'s date from the calendar', JSON.parse(sent.properties).event_date === '2026-10-08');
  check('and the quantity from the session, as a number', JSON.parse(sent.properties).quantity === 2);
  check('the success is logged with the session id', d.logs.some(l => l.level === 'info' && l.detail.sessionId === 'cs_test_abc123'));
}
{
  const d = deps();
  await R.reportPurchase(session(), 'completed', d);
  const again = await R.reportPurchase(session(), 'already_completed', d);
  check('the same session again (a Stripe retry) sends nothing', again === 'skipped_already_sent' && d.fetchFn.calls.length === 1);
}
{
  const d = deps();
  const [a, b] = await Promise.all([
    R.reportPurchase(session(), 'completed', d),
    R.reportPurchase(session(), 'completed', d),
  ]);
  check('two copies arriving together: exactly one sends', d.fetchFn.calls.length === 1 && [a, b].sort().join() === 'sent,skipped_already_sent');
}
{
  const d = deps({ fetchFn: net(reply(500)) });
  const out = await R.reportPurchase(session(), 'completed', d);
  check('Rybbit down: no throw, reported as failed', out === 'failed');
  check('the failure is logged with the session id', d.logs.some(l => l.level === 'error' && l.detail.sessionId === 'cs_test_abc123'));
  check('the claim is handed back so a replay can try again, and nothing loops', d.state.released === 1 && d.fetchFn.calls.length === 1);
}
{
  const d = deps({ fetchFn: net(new Error('offline')) });
  check('network error: no throw', (await R.reportPurchase(session(), 'completed', d)) === 'failed');
}
{
  const d = deps();
  d.claim = async () => { throw new Error('db'); };
  check('the claim itself failing: no throw, nothing sent', (await R.reportPurchase(session(), 'completed', d)) === 'failed' && d.fetchFn.calls.length === 0);
}
{
  const d = deps({ dateFails: true });
  const out = await R.reportPurchase(session(), 'completed', d);
  const props = JSON.parse(JSON.parse(d.fetchFn.calls[0].init.body).properties);
  check('the calendar lookup failing still sends the sale, without the date', out === 'sent' && !('event_date' in props));
}
{
  const d = deps({ key: null });
  check('no RYBBIT_API_KEY: nothing happens at all', (await R.reportPurchase(session(), 'completed', d)) === 'skipped_no_key' && d.fetchFn.calls.length === 0 && d.state.claimed === false);
}
{
  const d = deps();
  const out = await R.reportPurchase(session({ payment_status: 'unpaid' }), 'completed', d);
  check('unpaid is not a purchase', out === 'skipped_not_paid' && d.fetchFn.calls.length === 0);
}
{
  const d = deps();
  const out = await R.reportPurchase(session({ payment_status: 'no_payment_required' }), 'completed', d);
  check('"no payment required" is not a purchase', out === 'skipped_not_paid' && d.fetchFn.calls.length === 0);
}
{
  const d = deps();
  const out = await R.reportPurchase(session(), 'paid_without_stock', d);
  check('paid but no seat left (a refund) is not counted as a sale', out === 'skipped_not_a_sale' && d.fetchFn.calls.length === 0);
}
{
  const d = deps();
  const out = await R.reportPurchase(session(), 'completed_late', d);
  check('a late payment that did get a seat is counted', out === 'sent');
}
{
  const d = deps();
  const out = await R.reportPurchase(session({ amount_total: null }), 'completed', d);
  check('no amount on the session: skipped and logged, not guessed', out === 'skipped_no_amount' && d.fetchFn.calls.length === 0);
}
{
  // The session object a real webhook carries is full of personal detail. It
  // must be impossible for any of it to reach the request.
  const d = deps();
  const rich = session({
    customer_details: { name: 'Jason Mclellan', email: 'jason@example.com', phone: '+66800000000',
      address: { line1: '1 Test Street', postal_code: 'AB1 2CD', country: 'GB' } },
    customer_email: 'jason@example.com',
    payment_intent: { id: 'pi_123', latest_charge: { payment_method_details: { card: { last4: '4242', country: 'GB' } } } },
  });
  await R.reportPurchase(rich, 'completed', d);
  const wire = d.fetchFn.calls[0].init.body;
  const leaked = ['Jason', 'Mclellan', 'jason@example.com', '+66800000000', 'Test Street', 'AB1 2CD', '4242', 'pi_123'].filter(s => wire.includes(s));
  check('no name, email, phone, address, card or payment intent in the request', leaked.length === 0, leaked.join());
}

// ---------------------------------------------------------------------------
console.log('\nThe abandoned checkout event, against a fake claim and a fake network');
const expired = (over = {}) => session({ payment_status: 'unpaid', ...over });
{
  const d = deps();
  const out = await R.reportAbandoned(expired(), d);
  const wire = JSON.parse(d.fetchFn.calls[0].init.body);
  check('an expired, unpaid session sends one abandoned_checkout event', out === 'sent' && d.fetchFn.calls.length === 1 && wire.event_name === 'abandoned_checkout');
  check('on /stripe-webhook-abandoned', wire.pathname === '/stripe-webhook-abandoned');
  const pr = JSON.parse(wire.properties);
  check('with amount, currency, quantity, class, event, date and session id',
    pr.amount === 3600 && pr.currency === 'THB' && pr.quantity === 2 && pr.ticket_class === 'Club Class'
    && pr.event_name === 'Petchyindee Traditional Muay Thai' && pr.event_date === '2026-10-08' && pr.stripe_session_id === 'cs_test_abc123');
  check('same headers and user agent as the purchase event',
    d.fetchFn.calls[0].init.headers.Authorization === 'Bearer KEY' && d.fetchFn.calls[0].init.headers['User-Agent'] === wire.user_agent && wire.user_agent.startsWith('Mozilla/5.0'));
}
{
  const d = deps();
  await R.reportAbandoned(expired(), d);
  const again = await R.reportAbandoned(expired(), d);
  check('the same expired event again sends nothing', again === 'skipped_already_sent' && d.fetchFn.calls.length === 1);
}
{
  const d = deps();
  const [a, b] = await Promise.all([R.reportAbandoned(expired(), d), R.reportAbandoned(expired(), d)]);
  check('two copies arriving together: exactly one sends', d.fetchFn.calls.length === 1 && [a, b].sort().join() === 'sent,skipped_already_sent');
}
{
  const d = deps();
  check('a PAID session is never reported as abandoned', (await R.reportAbandoned(session({ payment_status: 'paid' }), d)) === 'skipped_not_unpaid' && d.fetchFn.calls.length === 0);
}
{
  const d = deps({ key: null });
  check('no key: nothing happens at all', (await R.reportAbandoned(expired(), d)) === 'skipped_no_key' && d.fetchFn.calls.length === 0 && d.state.claimed === false);
}
{
  const d = deps({ fetchFn: net(reply(500)) });
  const out = await R.reportAbandoned(expired(), d);
  check('Rybbit down: no throw, logged with the session id, claim handed back, no loop',
    out === 'failed' && d.logs.some(l => l.level === 'error' && l.detail.sessionId === 'cs_test_abc123') && d.state.released === 1 && d.fetchFn.calls.length === 1);
}
{
  const d = deps({ fetchFn: net(new Error('offline')) });
  check('network error: no throw', (await R.reportAbandoned(expired(), d)) === 'failed');
}
{
  const d = deps();
  d.claim = async () => { throw new Error('db'); };
  check('the claim failing: no throw, nothing sent', (await R.reportAbandoned(expired(), d)) === 'failed' && d.fetchFn.calls.length === 0);
}
{
  const d = deps();
  const out = await R.reportAbandoned(expired({ amount_total: null }), d);
  check('no amount: skipped and logged, not guessed', out === 'skipped_no_amount' && d.fetchFn.calls.length === 0);
}
{
  const d = deps();
  const rich = expired({
    customer_details: { name: 'Jason Mclellan', email: 'jason@example.com', phone: '+66800000000', address: { line1: '1 Test Street' } },
    customer_email: 'jason@example.com',
  });
  await R.reportAbandoned(rich, d);
  const wire = d.fetchFn.calls[0].init.body;
  const leaked = ['Jason', 'Mclellan', 'jason@example.com', '+66800000000', 'Test Street'].filter(x => wire.includes(x));
  check('no name, email, phone or address in the abandoned request', leaked.length === 0, leaked.join());
}

// ---------------------------------------------------------------------------
console.log('\nThe webhook itself (source guards)');
const flat = (s) => s.replace(/\s+/g, ' ');
const idx = flat(indexSrc);
const at = (needle) => idx.indexOf(needle);

check('there is still exactly one webhook receiver', (indexSrc.match(/Deno\.serve\(/g) || []).length === 1);
check('the signature is still verified before anything else',
  at('constructEventAsync') > 0 && at('constructEventAsync') < at('reportPurchase('));
check('an invalid signature is still rejected with 400', /Invalid Stripe signature\."\s*\}\s*,\s*400/.test(indexSrc));
check('the Rybbit step runs AFTER the booking is completed',
  at('complete_reservation') > 0 && at('complete_reservation') < at('await reportPurchase('));
check('and after the guest details are saved', at('could not save guest details') < at('await reportPurchase('));
check('it sits in its own try/catch that only logs',
  /try \{ const rybbit = await reportPurchase\([\s\S]*?\} catch \(err\) \{ console\.error\("rybbit purchase failed"/.test(idx));
check('the outcome of every sale is logged, so a silent skip can be told from a send',
  idx.includes('"rybbit purchase outcome"'));
check('the user agent can be overridden from the environment', indexSrc.includes('Deno.env.get("RYBBIT_USER_AGENT")'));
check('the key and site ids come from the environment',
  indexSrc.includes('Deno.env.get("RYBBIT_API_KEY")') && indexSrc.includes('Deno.env.get("RYBBIT_SITE_ID")'));
check('the key is never written into the source',
  (rybbitSrc.match(/Bearer/g) || []).length >= 1
  && !/Bearer [A-Za-z0-9_-]{12,}/.test(indexSrc + rybbitSrc)
  && !/["'`][A-Za-z0-9_-]{32,}["'`]/.test(indexSrc + rybbitSrc));
check('the key is never logged', !/log[^;]*apiKey|console\.[a-z]+\([^)]*RYBBIT_API_KEY/.test(indexSrc + rybbitSrc));
check('nothing personal is read by the Rybbit module',
  !/customer_details|customer_email|guest_(name|email)|phone|address/.test(rybbitSrc.replace(/\/\/.*$/gm, '')));
check('no pattern with a double slash anywhere in the new code', !/\/[^/\n]*\/\/[^/\n]*\/[gimsuy]*[.,;)]/.test(rybbitSrc.replace(/\/\/.*$/gm, '').replace(/"[^"\n]*"/g, '""')));
check('the existing fulfilment calls are untouched',
  idx.includes('supabase.rpc("complete_reservation"') && idx.includes('supabase.rpc("release_reservation"'));
check('the 500 for a failed booking update is still there', idx.includes('"Booking update failed." }, 500'));

// The expired-session path. The release of the seats is the work that matters,
// so the Rybbit step must sit strictly after it and after the kept address.
const rel = at('supabase.rpc("release_reservation"');
const lapsedSave = at('could not save details from a lapsed checkout');
const abandoned = at('await reportAbandoned(');
const releasedLog = at('"agent tix reservation released"');
const replyLine = at('action: String(data ?? newStatus)');
check('the abandoned step runs AFTER release_reservation', rel > 0 && rel < abandoned);
check('and after the lapsed address is kept', lapsedSave > 0 && lapsedSave < abandoned);
check('and before the existing log line and reply, which are unchanged', abandoned < releasedLog && releasedLog < replyLine);
check('a failed release still throws into the 500 path, before any analytics',
  /p_new_status: newStatus,\s*\}\);\s*if \(error\) throw error;/.test(indexSrc) && rel < abandoned);
check('the abandoned step is only for checkout.session.expired, not async_payment_failed',
  /if \(event\.type === "checkout\.session\.expired"\) \{\s*try \{\s*const rybbit = await reportAbandoned\(/.test(indexSrc));
check('it sits in its own try/catch that only logs',
  /await reportAbandoned\([\s\S]*?\} catch \(err\) \{ console\.error\("rybbit abandoned failed"/.test(idx));
check('the abandoned claim uses its OWN column, not the purchase one',
  indexSrc.includes('rybbit_abandoned_sent_at') && !/reportAbandoned[\s\S]{0,2500}rybbit_purchase_sent_at[\s\S]{0,40}reportPurchase/.test(indexSrc));
check('the lapsed status is still derived the same way',
  idx.includes('const newStatus = event.type === "checkout.session.expired" ? "expired" : "failed";'));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
