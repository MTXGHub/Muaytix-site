// Agent Tix — what create-checkout accepts as attribution
//
//   node agent-tix/functions/tests/attribution-guards.test.mjs
//
// Everything in the attribution payload arrives from a browser, so it is read
// as hostile. The two rules that matter: nothing the database would reject may
// reach it, and nothing about attribution may ever stop a ticket selling.
//
// Source-level, like the other guards here: the function is not run, its text
// is read, because what is being checked is that the guards exist at all.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(HERE, '..', 'create-checkout', 'index.ts'), 'utf8');

let pass = 0, fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail ? '  -> ' + detail : '')); }
};

console.log('\nAttribution, read as hostile');

check('the payload is parsed through one guarded reader',
  /function attributionFrom\(value: unknown\)/.test(src));

check('a non-object payload becomes no attribution, not a crash',
  /if \(!value \|\| typeof value !== "object"\) return empty;/.test(src));

// The database has a check constraint on click_id_kind. A kind it does not
// accept must be dropped here, or the update fails and the row loses the lot.
check('only gclid, gbraid and wbraid are accepted as a kind',
  /CLICK_KINDS = new Set\(\["gclid", "gbraid", "wbraid"\]\)/.test(src));
check('an unrecognised kind takes the click id down with it',
  /click_id: kind && CLICK_KINDS\.has\(kind\) \? id : null/.test(src));

check('every field is length-capped', /\.slice\(0, max\)/.test(src));
check('control characters are stripped', /\\u0000-\\u001F/.test(src));
check('a bad timestamp is dropped rather than stored',
  /Number\.isNaN\(Date\.parse\(clickedAt\)\)/.test(src));

console.log('\nIt must never cost a sale');

// The guest is already on their way to Stripe by the time this is written.
const storeBlock = src.slice(src.indexOf('...attribution,'));
check('a failed attribution write is logged, not thrown',
  /if \(attrError\) \{[\s\S]{0,200}console\.error\("attribution not stored"/.test(storeBlock));
check('and nothing after it releases the seats',
  !/if \(attrError\)[\s\S]{0,300}release_reservation/.test(storeBlock));
check('attribution is written with the session id, in one update',
  /stripe_checkout_session_id: session\.id,[\s\S]{0,160}\.\.\.attribution,/.test(src));

console.log('\nWhat Stripe is told');

check('the click id reaches Stripe metadata',
  /metadata\.click_id = attribution\.click_id;/.test(src));
check('only when it has a kind to go with it',
  /if \(attribution\.click_id && attribution\.click_id_kind\) \{/.test(src));
// Campaign and keyword are ours. Stripe has no use for them and every extra
// metadata key is a key nearer the limit.
check('the campaign detail is not shipped to Stripe',
  !/metadata\.utm_campaign|metadata\.utm_term/.test(src));

console.log('\nThe booking path is untouched');

check('the price is still read server side',
  /from\("event_ticket_prices"\)/.test(src) && !/body\.unitAmount/.test(src));
check('stock is still held before Stripe is called',
  src.indexOf('reserve_tickets') < src.indexOf('stripe.checkout.sessions.create'));
check('the seating guard still stands',
  /seating_ack_required/.test(src));

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
