// Agent Tix — what a seat is actually worth
//
//   node agent-tix/functions/tests/contribution-guards.test.mjs
//
// Every report counted tickets until now. Tickets are not what the business runs
// on: Third Class looked like a problem all afternoon purely because nothing
// here knew it earns 250 baht against the others' 600.
//
// The margin is ours, in baht, whatever the guest paid in -- which makes
// contribution the first figure in this system that sums cleanly across the six
// currencies bookings arrive in. That is the property most worth protecting, so
// it is what these checks are about.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const sql = fs.readFileSync(
  path.join(HERE, '..', '..', 'schema', '0020_what_a_seat_is_actually_worth.sql'), 'utf8');

let pass = 0, fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail ? '  -> ' + detail : '')); }
};

console.log('\nThe margin itself');

check('it lives on the class, not the booking',
  /alter table ticket_classes[\s\S]{0,120}add column margin_minor/.test(sql));
check('stored in satang like every other money column here',
  /margin_minor\s+bigint/.test(sql) && /62500/.test(sql));
check('Jason’s four figures, exactly',
  /'ringside'/.test(sql) && /62500/.test(sql) &&
  /margin_minor = 60000 where code = 'club_class'/.test(sql) &&
  /margin_minor = 60000 where code = 'leo_section'/.test(sql) &&
  /margin_minor = 25000 where code = 'third_class'/.test(sql));
check('a negative margin is refused outright',
  /margin_minor >= 0/.test(sql));
// Present so a second agent in another country needs no schema change.
check('the currency travels with the number',
  /add column margin_currency text not null default 'thb'/.test(sql));

console.log('\nThe reports');

check('the trading day report exists',
  /create or replace view contribution_by_day/.test(sql));
// The question a trader asks at the end of a day is about the day the money
// arrived, not the night the fight is on.
check('it groups on the day the money arrived, at the venue’s clock',
  /completed_at at time zone v\.timezone/.test(sql));
check('a refund is taken back out of the day it was sold',
  /contribution_by_day[\s\S]*refunded_at is null/.test(sql));
check('what the losses cost is a report of its own',
  /create or replace view contribution_lost_by_page/.test(sql));
check('it counts lost and won separately',
  /contribution_lost_thb/.test(sql) && /contribution_won_thb/.test(sql));
check('nationality is rebuilt on contribution',
  /bookings_by_nationality[\s\S]*contribution_thb/.test(sql));
check('and says what a booking from there is worth',
  /contribution_per_booking_thb/.test(sql));
check('margin and contribution reach the per-booking report',
  /booking_attribution[\s\S]*margin_per_seat_minor/.test(sql) &&
  /booking_attribution[\s\S]*contribution_minor/.test(sql));

console.log('\nThe views that gained a column are dropped, not replaced');

// Postgres refuses to reorder a view's columns through create-or-replace, and
// both of these take contribution in the middle of the list.
check('bookings_by_nationality is dropped first',
  sql.indexOf('drop view if exists bookings_by_nationality') <
  sql.indexOf('create view bookings_by_nationality'));
check('booking_attribution is dropped first',
  sql.indexOf('drop view if exists booking_attribution') <
  sql.indexOf('create view booking_attribution'));

console.log('\nThe limits are written down, not assumed');

check('it says this is a standing rate, not a per-night cost',
  /rate, not an invoice/.test(sql));
check('it says FX drift is not reflected',
  /FX drift/.test(sql));

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
