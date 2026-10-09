// Agent Tix — the webhook and a hold the guest replaced
//
//   PGHOST=/tmp PGPORT=5544 PGUSER=postgres node agent-tix/functions/tests/webhook-replaced-hold-guards.test.mjs
//
// When a guest changes their seats, create-checkout releases the old hold and
// expires its Stripe page on purpose (schema/0043). That expiry comes back to the
// webhook as an ordinary checkout.session.expired. This runs the REAL webhook over
// a scratch Postgres and checks the one thing that changed there:
//
//   A replaced hold is not reported to Rybbit as an abandoned checkout. A guest
//   who timed out still is, whether the seats were put back by the webhook or
//   already by the five minute sweeper, exactly as before.
//
// Nothing else about the expired path may change: the seats are released first,
// the reply is the same, and complete_reservation and late payments are untouched.

import fs from 'node:fs';
import path from 'node:path';
import { stripTypeScriptTypes } from 'node:module';
import { fileURLToPath } from 'node:url';
import { makeDb, fakeClient, seed, resetClub, IDS } from './pg-harness.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(HERE, '..', 'stripe-webhook-v2', 'index.ts'), 'utf8');

let pass = 0, fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail ? '  -> ' + detail : '')); }
};

const db = makeDb('holdtest_wh');
try { db.create(); } catch (e) {
  console.log('Cannot reach a scratch Postgres (set PGHOST / PGPORT / PGUSER): ' + String(e.stderr ?? e.message).trim());
  process.exit(2);
}
seed(db);

function build() {
  const env = { STRIPE_SECRET_KEY: 'sk_test_fake', STRIPE_WEBHOOK_SECRET: 'whsec_fake',
    SUPABASE_URL: 'https://fake.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'service_fake' };
  const calls = { abandoned: 0, purchase: 0 };
  class FakeStripe {
    static createSubtleCryptoProvider() { return {}; }
    constructor() { this.webhooks = { constructEventAsync: async (raw) => JSON.parse(raw) }; }
  }
  const client = fakeClient(db, {});
  let handler = null;
  const Deno = { env: { get: (k) => env[k] }, serve: (h) => { handler = h; } };
  const R = { reportAbandoned: async () => { calls.abandoned++; return 'sent'; }, reportPurchase: async () => { calls.purchase++; return 'sent'; } };
  const quiet = { info() {}, warn() {}, error() {}, log() {} };
  let code = stripTypeScriptTypes(src);
  const swap = (re, to) => { if (!re.test(code)) throw new Error('import not found: ' + re); code = code.replace(re, to); };
  swap(/import "jsr:[^"]+";/, '');
  swap(/import \{ createClient \} from "npm:[^"]+";/, 'const createClient = __cc;');
  swap(/import Stripe from "npm:[^"]+";/, 'const Stripe = __S;');
  swap(/import \{ ([^}]+) \} from "\.\/rybbit\.ts";/, 'const { $1 } = __R;');
  new Function('Deno', '__cc', '__S', '__R', 'console', code)(Deno, () => client, FakeStripe, R, quiet);
  return {
    calls,
    async expired(reservationId, sessionId) {
      const event = { id: 'evt_1', type: 'checkout.session.expired', data: { object: {
        object: 'checkout.session', id: sessionId, payment_status: 'unpaid', amount_total: 540000, currency: 'thb',
        metadata: { source: 'agent_tix_v2', v2_reservation_id: reservationId, event_key: 'test_night_1' } } } };
      const res = await handler(new Request('https://fake.supabase.co/functions/v1/stripe-webhook-v2', {
        method: 'POST', headers: { 'stripe-signature': 't=1,v1=x' }, body: JSON.stringify(event) }));
      return { status: res.status, body: await res.json() };
    },
  };
}
const mk = (n) => db.rows(`select reservation_id from reserve_tickets('${IDS.club}', ${n}, now() + interval '5 minutes')`)[0].reservation_id;
const status = (id) => db.rows(`select status from checkout_reservations where id = '${id}'`)[0].status;
const reserved = () => db.rows(`select reserved_quantity r from event_ticket_classes where id = '${IDS.club}'`)[0].r;

console.log('\nA hold the guest replaced');
{
  resetClub(db);
  const h = build();
  const old = mk(3);
  db.exec(`select * from replace_reservation('${old}', '${IDS.club}', 2, now() + interval '5 minutes')`);
  check('the old hold is released by the swap', status(old) === 'released');
  const r = await h.expired(old, 'cs_old');
  check('its Stripe expiry is acknowledged normally', r.status === 200 && r.body.received === true, JSON.stringify(r.body));
  check('the webhook says the hold was already released', r.body.action === 'already_released', r.body.action);
  check('it is NOT reported to Rybbit as an abandoned checkout', h.calls.abandoned === 0);
  check('and the new hold is untouched: 2 still reserved', reserved() === 2);
}

console.log('\nA guest who simply timed out, as before');
{
  resetClub(db);
  const h = build();
  const lapsed = mk(3);
  const r = await h.expired(lapsed, 'cs_lapsed');
  check('the webhook puts the seats back', status(lapsed) === 'expired' && reserved() === 0 && r.body.action === 'expired', JSON.stringify(r.body));
  check('and reports an abandoned checkout, once', h.calls.abandoned === 1);
  resetClub(db);
  const h2 = build();
  const swept = mk(3);
  db.exec(`select release_reservation('${swept}', 'expired')`);        // what the sweeper does at five minutes
  const r2 = await h2.expired(swept, 'cs_swept');
  check('a hold the five minute sweeper already expired is still reported, as before', r2.body.action === 'already_expired' && h2.calls.abandoned === 1, JSON.stringify(r2.body) + ' ' + h2.calls.abandoned);
  resetClub(db);
  const h3 = build();
  const paid = mk(3);
  db.exec(`select complete_reservation('${paid}')`);
  const r3 = await h3.expired(paid, 'cs_paid');
  check('an expiry event for a hold that was already paid changes nothing', status(paid) === 'completed' && r3.status === 200);
}

db.drop();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
