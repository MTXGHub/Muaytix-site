// Agent Tix — what create-checkout accepts as a page path
//
//   node agent-tix/functions/tests/booking-page-guards.test.mjs
//
// The booking page and the entry page arrive from a browser, so they are read as
// hostile. Two rules: a query string never gets stored -- it is where a shared
// link's email address or name ends up -- and nothing about recording a page may
// ever stop a ticket selling.
//
// The widget already strips the query string. This is checked here anyway,
// deliberately: the live widget is a block of pasted header code, so an older
// copy can sit in a guest's browser cache for days after a change. The function
// is the side that cannot be stale.
//
// Source-level, like the other guards here: the function is not run, its text is
// read, because what is being checked is that the guards exist at all.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const fn  = path.join(HERE, '..', 'create-checkout', 'index.ts');
const src = fs.readFileSync(fn, 'utf8');

let pass = 0, fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail ? '  -> ' + detail : '')); }
};

console.log('\nPage paths, read as hostile');

check('both pages go through one guarded reader',
  /function pagePathFrom\(value: unknown\)/.test(src));
check('the booking page uses it', /pagePathFrom\(body\.pagePath\)/.test(src));
check('the entry page uses it', /pagePathFrom\(body\.landingPage\)/.test(src));

check('anything that is not a string becomes null, not a crash',
  /if \(typeof value !== "string"\) return null;/.test(src));
check('the query string and fragment are cut off',
  /\.split\(\/\[\?#\]\/\)\[0\]/.test(src));
check('control characters are stripped',
  /pagePathFrom[\s\S]{0,400}\\u0000-\\u001F/.test(src));
check('the value is capped so a long path cannot bloat a row',
  /pagePathFrom[\s\S]{0,400}\.slice\(0, 255\)/.test(src));
check('a full URL is refused rather than stored as a path',
  /startsWith\("\/"\)/.test(src) && /startsWith\("\/\/"\)/.test(src));

console.log('\nStored with the booking, and never at its expense');

check('both columns are written on the same update as the session id',
  /stripe_checkout_session_id: session\.id[\s\S]{0,300}page_path: pagePath[\s\S]{0,120}landing_page: landingPage/
    .test(src));

// The whole point: a reporting column must never be able to refuse a sale.
const update = src.slice(src.indexOf('const { error: attrError }'));
check('a failed write is logged, not thrown',
  /console\.error\(/.test(update) && !/throw/.test(update.slice(0, update.indexOf('return json'))));

console.log('\nThe booking path is untouched');

check('the price is still read server side',
  /from\("event_ticket_prices"\)/.test(src) && !/body\.unitAmount/.test(src));
check('stock is still held before Stripe is called',
  src.indexOf('reserve_tickets') < src.indexOf('stripe.checkout.sessions.create'));
check('the seating guard still stands', /seating_ack_required/.test(src));
check('the click attribution still travels', /attributionFrom\(body\.attribution\)/.test(src));

console.log('\nThe reports exist and count the right rows');

const sql = fs.readFileSync(
  path.join(HERE, '..', '..', 'schema', '0018_where_did_they_book_from.sql'), 'utf8');

check('both columns are added', /add column page_path/.test(sql) && /add column landing_page/.test(sql));
check('the per-booking-page funnel view exists',
  /create or replace view checkout_funnel_by_page/.test(sql));
check('the per-entry-page funnel view exists',
  /create or replace view checkout_funnel_by_landing_page/.test(sql));
check('both pages are carried onto the attribution report',
  /booking_attribution[\s\S]*r\.landing_page/.test(sql) &&
  /booking_attribution[\s\S]*r\.page_path\s+as booked_from_page/.test(sql));

// A held seat that never reached a payment page is not an abandoned checkout,
// and counting it as one would blame the page for something it did not do.
check('only rows that actually reached Stripe are counted',
  (sql.match(/stripe_checkout_session_id is not null/g) || []).length >= 2);
// A refund is a later, separate event. Folding it in here would make a page look
// as though it failed to sell something it sold.
check('a refunded booking still counts as paid',
  /completed_at is not null/.test(sql) && !/refunded_at is null[\s\S]*funnel/.test(sql));

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
