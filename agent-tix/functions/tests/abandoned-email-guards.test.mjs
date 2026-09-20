// Agent Tix — the ones who nearly booked
//
//   node agent-tix/functions/tests/abandoned-email-guards.test.mjs
//
// A hundred and three checkouts were abandoned in a fortnight and every one was
// anonymous, because the email only ever arrived with the payment. This keeps
// the address Stripe already had.
//
// One rule outranks everything else here and most of these checks defend it:
// the seats come back first, and nothing added for the sake of a mailing list
// may delay that, undo it, or make Stripe retry an event whose real work is
// done. The five minute hold was a decision -- "we are involved in selling
// tickets, not keeping tickets" -- not an accident to be worked around.
//
// Source-level, like the other guards here: the function is not run, its text
// is read, because what is being checked is that the guards exist at all.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(HERE, '..', 'stripe-webhook-v2', 'index.ts'), 'utf8');
const sql = fs.readFileSync(
  path.join(HERE, '..', '..', 'schema', '0022_the_ones_who_nearly_booked.sql'), 'utf8');

let pass = 0, fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail ? '  -> ' + detail : '')); }
};

console.log('\nThe seats still come first');

const lapsed = src.slice(src.indexOf('// Abandoned or failed. Put the seats back.'));
check('the release still happens, and happens before anything new',
  lapsed.indexOf('release_reservation') < lapsed.indexOf('lapsedPatch'));
check('the release error still throws, so a real failure is retried',
  /release_reservation[\s\S]{0,200}if \(error\) throw error;/.test(lapsed));
// Stripe retries anything that does not answer 200. Retrying for the sake of an
// address would replay an event whose seats are already back on sale.
// \b so the word "thrown" in a comment does not read as a throw statement.
check('a failure to save the address is logged, never thrown',
  /could not save details from a lapsed checkout/.test(lapsed) &&
  !/\bthrow\b/.test(lapsed.slice(lapsed.indexOf('lapsedPatch'))));
check('nothing in the new branch touches the hold or the sweeper',
  !/HOLD_MINUTES|expires_at|cron/.test(lapsed));

console.log('\nWhat it keeps');

check('the address comes from what the guest typed, then the prefill',
  /session\.customer_details\?\.email \?\? session\.customer_email/.test(lapsed));
check('the name is kept too, so they can be written to by name',
  /lapsedPatch\.guest_name = lapsedName/.test(lapsed));
// "Jason Mclellan " with a trailing space reached a live booking once already.
check('both are trimmed, same as the paid branch',
  /const tidyGuest = \(v: string \| null \| undefined\)/.test(lapsed));
check('an empty string is stored as nothing, not as an empty address',
  /return t\.length > 0 \? t : null;/.test(lapsed));
check('a session carrying no address writes nothing at all',
  /if \(Object\.keys\(lapsedPatch\)\.length > 0\)/.test(lapsed));
check('the log says whether an address was kept, so the rate can be checked',
  /keptAddress: Boolean\(lapsedEmail\)/.test(lapsed));

console.log('\nThe paid path is untouched');

check('completion still runs through the idempotent function',
  /complete_reservation/.test(src));
check('card country and settlement still recorded',
  /paymentFacts\(stripe, paymentIntentId\)/.test(src));
check('it still only handles sessions this system created',
  /meta\.source !== OUR_SOURCE/.test(src));
check('a real failure still returns 500 so Stripe retries',
  /return reply\(\{ error: "Booking update failed\." \}, 500\)/.test(src));
check('the header no longer claims it does nothing else',
  /It sends nothing: no email/.test(src) && !/It does nothing else/.test(src));

console.log('\nThe list is fit to send to');

check('the view exists', /create or replace view abandoned_checkouts/.test(sql));
// Writing to somebody who was beaten by the clock and came straight back is the
// single worst thing this list could do.
check('anyone who has since bought is excluded outright',
  /and not exists \(/.test(sql) && /lower\(p\.guest_email\) = a\.email_key/.test(sql));
check('a refunded booking does not count as having bought',
  /p\.refunded_at is null/.test(sql));
check('one row per address, most recent attempt',
  /row_number\(\) over \(/.test(sql) && /order by r\.created_at desc/.test(sql) &&
  /where a\.recency = 1/.test(sql));
check('rows with no address never reach the list',
  /r\.guest_email is not null/.test(sql) && /r\.guest_email <> ''/.test(sql));
check('only unpaid attempts are listed',
  /r\.completed_at is null/.test(sql));
check('it says which night they wanted and whether it has gone',
  /event_date/.test(sql) && /event_has_passed/.test(sql));
check('it carries what the booking was worth, so the list can be ranked',
  /contribution_at_stake_thb/.test(sql));
check('it carries where they came from, so the offer can match the page',
  /page_path/.test(sql) && /landing_page/.test(sql) && /channel/.test(sql));
// Soft opt-in is narrow ground and the view should say so where it is read.
check('the view says in writing that it is not a marketing list',
  /not a marketing list/.test(sql));

console.log('\nAnd a way to tell whether it was worth building');

check('the capture rate is reported by day',
  /create or replace view abandoned_capture_by_day/.test(sql));
check('it shows the rate, not just the count',
  /capture_rate_pct/.test(sql));
check('it cannot divide by zero on a quiet day',
  /nullif\(count\(\*\), 0\)/.test(sql));
check('it counts the Bangkok day, like every other report here',
  /at time zone v\.timezone/.test(sql));

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
