// Agent Tix — what we put in front of them
//
//   node agent-tix/functions/tests/widget-looks-guards.test.mjs
//
// Ninety per cent of visitors never reach the checkout, so every report in this
// system has been blind to them. This records the half of the conversation we
// are entitled to: what the server answered when the widget asked.
//
// Two things are being defended here and they pull in opposite directions.
//
// The widget must never wait for a statistic. The guest gets their answer and
// the row is written afterwards, or not at all -- a missing row costs a number,
// a slow widget costs a sale.
//
// And nothing about the person may be recorded. No address, no IP, no user
// agent, no identifier of any kind. Jason's decision, and the reason the honest
// limit is written into the schema rather than discovered later: these are
// looks, not people.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(HERE, '..', 'availability', 'index.ts'), 'utf8');
const sql = fs.readFileSync(
  path.join(HERE, '..', '..', 'schema', '0023_what_we_put_in_front_of_them.sql'), 'utf8');

let pass = 0, fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail ? '  -> ' + detail : '')); }
};

console.log('\nThe guest never waits for it');

const recorder = src.slice(src.indexOf('function recordLook('), src.indexOf('Deno.serve'));
check('the recorder exists', /function recordLook\(/.test(src));
// An awaited insert would put a database round trip between the guest and the
// seat prices, on every single widget load.
check('it is never awaited anywhere',
  !/await recordLook/.test(src), 'awaited somewhere');
check('the insert is handed to the runtime to finish after the response',
  /EdgeRuntime\?\.waitUntil\?\./.test(recorder));
check('a runtime without waitUntil degrades to best effort, not a crash',
  /} catch {/.test(recorder));
check('a failed write is logged, never thrown',
  /console\.error\("could not record the look"/.test(recorder) && !/\bthrow\b/.test(recorder));
check('both promise outcomes are handled, so nothing is left unhandled',
  /\.then\(\s*\n?\s*\(\{ error \}\)/.test(recorder) && /\(err\) => console\.error/.test(recorder));

console.log('\nNothing about the person');

check('no IP address is read',
  !/x-forwarded-for|cf-connecting-ip|remoteAddr/i.test(src));
check('no user agent is read',
  !/user-agent/i.test(src));
check('no cookie is read or set',
  !/cookie/i.test(src));
// The referer carries the full URL, and a shared link is where a name or an
// address ends up. Same rule as the booking page in 0018.
check('the page comes from the referer, path only',
  /new URL\(raw\)\.pathname/.test(src));
check('a malformed referer is dropped rather than stored raw',
  /} catch {\s*\n\s*return null;/.test(src));
check('the path is length capped like every other stored path',
  /\.slice\(0, 255\)/.test(src));

console.log('\nWhat it records');

check('all three questions the widget asks are recorded',
  /action: "events"/.test(src) && /action: "classes"/.test(src) &&
  /action: "availability"/.test(src));
// The count and the answer must come from the same rows or a report can say
// something the guest never saw.
check('the counts are taken from the rows the guest is shown',
  /const shown = rows\.filter\(\(r\) => r\.status !== "hidden"\)/.test(src));
check('sold out and closed are counted separately, not lumped together',
  /sold_out: countOf\("fully_booked"\)/.test(src) &&
  /booking_closed: countOf\("booking_closed"\)/.test(src));
check('limited counts as buyable, because it is',
  /const buyable = countOf\("available"\) \+ countOf\("limited"\)/.test(src));
check('a night with nothing buyable is marked as a dead end',
  /dead_end: shown\.length > 0 && buyable === 0/.test(src));
check('a night that does not exist is recorded as not found, both ways it can fail',
  (src.match(/not_found: true/g) ?? []).length === 2);
check('the per class statuses are kept for questions not yet thought of',
  /statuses\[String\(r\.ticket_class_code\)\] = String\(r\.status\)/.test(src));

console.log('\nThe booking path is untouched');

check('the origin check still runs first',
  src.indexOf('This website is not authorised') < src.indexOf('recordLook({'));
check('seats left is still withheld above the threshold',
  /const SAY_REMAINING_AT = 5;/.test(src) &&
  /left > 0 && left <= SAY_REMAINING_AT \? left : null/.test(src));
check('sold out classes are still returned rather than hidden',
  /Hiding them is what sends a guest to a competitor/.test(src));

console.log('\nThe table');

check('it exists and is additive', /create table if not exists widget_looks/.test(sql));
check('only the three known actions are accepted',
  /check \(action in \('events', 'classes', 'availability'\)\)/.test(sql));
check('dead end is never null, so a count can never silently miss rows',
  /dead_end\s+boolean not null default false/.test(sql));
check('negative counts are refused',
  /classes_offered is null or classes_offered >= 0/.test(sql));
check('it is indexed for the query every report will run',
  /widget_looks_looked_at_idx on widget_looks \(looked_at desc\)/.test(sql));
// This is the sentence that stops somebody reading journeys into a total.
check('the honest limit is written into the schema, not left to be discovered',
  /Looks, not people/.test(sql) && /Four rows may be one guest/.test(sql));
check('it says in writing that nothing about the person is stored',
  /no address, no IP, no user agent/.test(sql));

console.log('\nThe reports');

check('the day report exists', /create or replace view widget_looks_by_day/.test(sql));
check('the per night report exists', /create or replace view widget_looks_by_event/.test(sql));
check('the per page report exists', /create or replace view widget_looks_by_page/.test(sql));
check('the funnel joins looks to checkouts to sales',
  /create or replace view look_to_sale_by_day/.test(sql) &&
  /look_to_checkout_pct/.test(sql) && /checkout_to_paid_pct/.test(sql));
check('a quiet day cannot divide by zero',
  (sql.match(/nullif\(/g) ?? []).length >= 4);
check('the funnel keeps days that have one side but not the other',
  /full outer join checkouts c on c\.day = l\.day/.test(sql));
// Days before today have no looks at all, and that must not read as a collapse.
check('it warns that days before the record began show no looks',
  /that is the record starting/.test(sql));
check('every report counts the Bangkok day',
  (sql.match(/at time zone 'Asia\/Bangkok'/g) ?? []).length >= 4);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
