// Agent Tix — where the card was issued
//
//   node agent-tix/functions/tests/card-country-guards.test.mjs
//
// Nationality is worked out by hand today from the card ISSUER country. Stripe
// knows it on every card payment, so the webhook now records it -- along with
// what the sale settled for, which is the only figure comparable across the six
// currencies bookings arrive in.
//
// This reads Stripe again AFTER the sale is banked, which makes one rule absolute
// and is most of what is checked here: the guest has already paid, so nothing in
// this path may throw, retry the webhook, or overwrite a value already stored.
//
// Source-level, like the other guards here: the function is not run, its text is
// read, because what is being checked is that the guards exist at all.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(HERE, '..', 'stripe-webhook-v2', 'index.ts'), 'utf8');
const sql = fs.readFileSync(
  path.join(HERE, '..', '..', 'schema', '0019_where_the_card_was_issued.sql'), 'utf8');

let pass = 0, fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail ? '  -> ' + detail : '')); }
};

console.log('\nReading the facts off the payment');

check('one guarded reader does the work',
  /async function paymentFacts\(/.test(src));
check('no payment intent means no facts, not a crash',
  /if \(!paymentIntentId\) return NO_FACTS;/.test(src));
check('the issuer country and the settlement come from one expanded read',
  /expand: \["latest_charge", "latest_charge\.balance_transaction"\]/.test(src));
check('a charge that came back as a bare id is refused',
  /typeof charge === "string"/.test(src));
check('a balance transaction that came back as a bare id is refused',
  /typeof txn !== "string"/.test(src));

// Alipay and WeChat Pay carry no issuer country at all, and they were switched on
// for a market with marketing behind it.
check('the country is only taken from a card',
  /const card = details\?\.card \?\? null;/.test(src));
check('the payment method type is stored so a null country can be explained',
  /payment_method_type: details\?\.type \?\? null/.test(src));
check('the country is upper-cased and checked against two letters',
  /toUpperCase\(\)/.test(src) && /\/\^\[A-Z\]\{2\}\$\//.test(src));

console.log('\nIt can never cost a sale');

const reader = src.slice(src.indexOf('async function paymentFacts'),
                         src.indexOf('Deno.serve'));
check('every failure returns nulls and is logged, never thrown',
  /catch \(err\)/.test(reader) && /console\.error/.test(reader) && !/throw/.test(reader));
check('the sale is recorded BEFORE Stripe is read again',
  src.indexOf('complete_reservation') < src.indexOf('await paymentFacts('));
// Stripe sends completed and then async_payment_succeeded, and the second copy
// does not always carry the same detail.
check('a second copy of the event cannot null out a stored value',
  /if \(facts\.card_country\) guestPatch\.card_country/.test(src) &&
  /if \(facts\.payment_method_type\) guestPatch\.payment_method_type/.test(src));
// A fully discounted booking settles at zero, which is a real figure.
check('zero settled is stored, not discarded as falsy',
  /facts\.settled_amount !== null/.test(src) && /facts\.stripe_fee !== null/.test(src));
check('the patch can carry numbers as well as text',
  /guestPatch: Record<string, string \| number>|Record<string, string \| number> = \{\}/.test(src));

console.log('\nThe booking path is untouched');

check('it still only handles sessions this system created',
  /meta\.source !== OUR_SOURCE/.test(src));
check('an unpaid but completed session still waits for the money',
  /awaiting_payment/.test(src));
check('abandoned checkouts still put the seats back',
  /release_reservation/.test(src));
check('a real failure still returns 500 so Stripe retries',
  /return reply\(\{ error: "Booking update failed\." \}, 500\)/.test(src));

console.log('\nThe columns and the reports');

check('all five columns are added',
  /add column card_country/.test(sql) && /add column payment_method_type/.test(sql) &&
  /add column settled_amount/.test(sql) && /add column settled_currency/.test(sql) &&
  /add column stripe_fee/.test(sql));
check('the database refuses a malformed country',
  /card_country ~ '\^\[A-Z\]\{2\}\$'/.test(sql));
check('the nationality report exists',
  /create or replace view bookings_by_nationality/.test(sql));
check('it reports seats and basket size, not only money',
  /sum\(r\.quantity\)\s+as seats/.test(sql) && /avg\(r\.quantity\)/.test(sql));
check('it shows which seats each country buys',
  /filter \(where tc\.code = 'ringside'\)/.test(sql) &&
  /filter \(where tc\.code = 'third_class'\)/.test(sql));
// A country whose bookings predate these columns would otherwise look cheap.
check('it says how many rows actually have a settled figure',
  /with_settlement/.test(sql));
check('the payment method report exists',
  /create or replace view bookings_by_payment_method/.test(sql));
check('nationality is carried onto the per-booking report',
  /booking_attribution[\s\S]*r\.card_country/.test(sql));
check('so is what it settled for',
  /booking_attribution[\s\S]*r\.settled_amount/.test(sql));
check('the reports count paid bookings only',
  /bookings_by_nationality[\s\S]*completed_at is not null/.test(sql));

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
