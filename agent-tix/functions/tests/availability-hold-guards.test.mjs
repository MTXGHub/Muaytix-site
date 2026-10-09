// Agent Tix — a guest's own hold, in availability
//
//   PGHOST=/tmp PGPORT=5544 PGUSER=postgres node agent-tix/functions/tests/availability-hold-guards.test.mjs
//
// Runs the real availability handler over a scratch Postgres with
// schema/0043_guest_hold.sql loaded (see pg-harness.mjs). Nothing live.
//
// What has to hold:
//
//   No holdId: the answer is BYTE FOR BYTE what the function gave before this
//   change. An older copy of the widget, cached in a browser for days, sends no
//   holdId and must not see a difference. This is proved by running the previous
//   version of the function (from git) beside the new one.
//
//   A guest's own seats are added back for the class they hold, in the count, the
//   status and the most they can order, and for nobody else.
//
//   A hold that cannot be read leaves the public answer alone and says nothing
//   about the hold, so the widget keeps what it had.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { makeDb, buildAvailability, seed, resetClub, IDS } from './pg-harness.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(HERE, '..', '..', '..');
const newSrc = fs.readFileSync(path.join(HERE, '..', 'availability', 'index.ts'), 'utf8');
const oldSrc = execFileSync('git', ['show', 'HEAD:agent-tix/functions/availability/index.ts'], { cwd: REPO, encoding: 'utf8' });

let pass = 0, fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail ? '  -> ' + detail : '')); }
};

const db = makeDb('holdtest_av');
try { db.create(); } catch (e) {
  console.log('Cannot reach a scratch Postgres (set PGHOST / PGPORT / PGUSER): ' + String(e.stderr ?? e.message).trim());
  process.exit(2);
}
seed(db);

function build(src, { failRpc = [] } = {}) {
  const h = buildAvailability(db, { source: src, failRpc });
  return {
    log: h.log,
    async ask(body) {
      const res = await h.handle(new Request('https://fake.supabase.co/functions/v1/availability', {
        method: 'POST', headers: { origin: 'https://muaytix.com', 'content-type': 'application/json', referer: 'https://muaytix.com/rws' },
        body: JSON.stringify(body) }));
      const text = await res.text();
      return { status: res.status, text, body: JSON.parse(text) };
    },
  };
}

const night = { action: 'availability', eventKey: 'test_night_1' };
const cls = (r, code) => r.body.classes.find((c) => c.code === code);

// A guest holds 3 of the 4 left.
const reserve = (cls_, n) => db.rows(`select reservation_id from reserve_tickets('${cls_}', ${n}, now() + interval '5 minutes')`)[0].reservation_id;

console.log('\nNo holdId: byte for byte as before');
{
  resetClub(db);
  const before = build(oldSrc), after = build(newSrc);
  const R = reserve(IDS.club, 3);
  const a = await before.ask(night), b = await after.ask(night);
  check('while a hold exists in the database, the answer is identical to the old function', a.text === b.text, a.text.length + ' vs ' + b.text.length);
  check('no hold key at all', !('hold' in b.body));
  check('others see 1 left and max per order 1', cls(b, 'club_class').maxPerOrder === 1 && cls(b, 'club_class').seatsLeft === 1);
  check('the same with a made up holdId', (await after.ask({ ...night, holdId: 'nope' })).body.classes.length === 3);
  const c = await before.ask({ action: 'events', from: '2026-10-01', to: '2026-10-31' }).catch(() => null);
  check('the old function and the new one agree on an unknown action', (await before.ask({ action: 'zzz' })).text === (await after.ask({ action: 'zzz' })).text);
  void R; void c;
}

console.log('\nThe holder sees their own seats added back');
{
  resetClub(db);
  const h = build(newSrc);
  const R = reserve(IDS.club, 3);
  const mine = await h.ask({ ...night, holdId: R });
  const club = cls(mine, 'club_class');
  check('the answer carries the hold', mine.body.hold && mine.body.hold.classCode === 'club_class' && mine.body.hold.quantity === 3, JSON.stringify(mine.body.hold));
  check('with the name, the time left and nothing personal',
    mine.body.hold.className === 'Club Class' && mine.body.hold.secondsLeft > 290 && Object.keys(mine.body.hold).sort().join() === 'classCode,className,currency,eventKey,expiresAt,quantity,secondsLeft');
  check('the holder may order up to 4', club.maxPerOrder === 4, String(club.maxPerOrder));
  check('and is told 4 are left', club.seatsLeft === 4, String(club.seatsLeft));
  check('and the class is on sale', club.status === 'limited' || club.status === 'available', club.status);
  const stranger = await h.ask(night);
  check('a stranger asking at the same moment sees 1 left, max 1', cls(stranger, 'club_class').maxPerOrder === 1 && cls(stranger, 'club_class').seatsLeft === 1);
  check('the other classes are untouched for the holder',
    JSON.stringify(cls(mine, 'ringside')) === JSON.stringify(cls(stranger, 'ringside')) && JSON.stringify(cls(mine, 'third_class')) === JSON.stringify(cls(stranger, 'third_class')));
  const rest = (r) => JSON.stringify({ ...r.body, hold: undefined, classes: r.body.classes.filter((c) => c.code !== 'club_class') });
  check('and so is everything else in the answer', rest(mine) === rest(stranger));
}

console.log('\nHolding the last seats');
{
  resetClub(db);
  db.exec(`update event_ticket_classes set total_quantity = 9 where id = '${IDS.club}'`);   // 3 left
  const h = build(newSrc);
  const R = reserve(IDS.club, 3);
  const stranger = await h.ask(night), mine = await h.ask({ ...night, holdId: R });
  check('everyone else sees it fully booked', cls(stranger, 'club_class').status === 'fully_booked' && cls(stranger, 'club_class').seatsLeft === null);
  check('the holder does not: it is on sale with 3 left, up to 3', ['available', 'limited'].includes(cls(mine, 'club_class').status) && cls(mine, 'club_class').seatsLeft === 3 && cls(mine, 'club_class').maxPerOrder === 3, JSON.stringify(cls(mine, 'club_class')));
  db.exec(`update event_ticket_classes set manual_status = 'fully_booked' where id = '${IDS.club}'`);
  const closed = await h.ask({ ...night, holdId: R });
  check('a class closed by hand stays closed for the holder too', cls(closed, 'club_class').status === 'fully_booked', cls(closed, 'club_class').status);
  db.exec(`update event_ticket_classes set manual_status = null where id = '${IDS.club}'`);
  db.exec(`update events set starts_at = now() + interval '10 minutes' where event_key = 'test_night_1'`);
  const late = await h.ask({ ...night, holdId: R });
  check('past the booking cutoff the holder is shut out like everyone else', cls(late, 'club_class').status === 'booking_closed', cls(late, 'club_class').status);
  db.exec(`update events set starts_at = now() + interval '2 days' where event_key = 'test_night_1'`);
}

console.log('\nA hold that is gone, or elsewhere');
{
  resetClub(db);
  const h = build(newSrc);
  const R = reserve(IDS.club, 3);
  db.exec(`update checkout_reservations set expires_at = now() - interval '1 second' where id = '${R}'`);
  const gone = await h.ask({ ...night, holdId: R });
  check('an expired hold comes back as null, so the widget forgets it', gone.body.hold === null);
  check('and the figures are public', cls(gone, 'club_class').maxPerOrder === 1);
  const R2 = reserve(IDS.club2, 2);
  const elsewhere = await h.ask({ ...night, holdId: R2 });
  check('a hold on another night is null here, and changes nothing about this night', elsewhere.body.hold === null && cls(elsewhere, 'club_class').maxPerOrder === 1);
  db.exec(`update checkout_reservations set status = 'completed' where id = '${R2}'`);
  check('a paid reservation is not a hold', (await h.ask({ ...night, holdId: R2 })).body.hold === null);
}

console.log('\nThe hold action, for page load and the back button');
{
  resetClub(db);
  const h = build(newSrc);
  const R = reserve(IDS.club, 3);
  const live = await h.ask({ action: 'hold', holdId: R });
  check('a live hold is confirmed, with seconds left', live.status === 200 && live.body.hold.quantity === 3 && live.body.hold.secondsLeft > 290, live.text);
  check('whatever night it is for', live.body.hold.eventKey === 'test_night_1');
  check('no personal data in it', !/guest|email|name"/.test(live.text.replace('className', '')));
  check('a made up id is null', (await h.ask({ action: 'hold', holdId: 'x' })).body.hold === null);
  check('no id is null', (await h.ask({ action: 'hold' })).body.hold === null);
  db.exec(`update checkout_reservations set expires_at = now() - interval '1 second' where id = '${R}'`);
  check('an expired hold is null', (await h.ask({ action: 'hold', holdId: R })).body.hold === null);
  db.exec(`update checkout_reservations set expires_at = now() + interval '5 minutes' where id = '${R}'`);
  const broken = build(newSrc, { failRpc: ['live_hold'] });
  const e = await broken.ask({ action: 'hold', holdId: R });
  check('if the database cannot say, that is an error (not "gone"), so the widget keeps what it has', e.status === 500, e.text);
}

console.log('\nIf the hold cannot be read the night still loads');
{
  resetClub(db);
  const R = reserve(IDS.club, 3);
  const broken = build(newSrc, { failRpc: ['live_hold'] });
  const r = await broken.ask({ ...night, holdId: R });
  check('the public answer is given', r.status === 200 && cls(r, 'club_class').maxPerOrder === 1);
  check('and says nothing about the hold, so the widget keeps its own', !('hold' in r.body));
  check('the problem is logged', broken.log.length > 0);
  const broken2 = build(newSrc, { failRpc: ['class_view_for_holder'] });
  const r2 = await broken2.ask({ ...night, holdId: R });
  check('same if only the holder view fails', r2.status === 200 && !('hold' in r2.body) && cls(r2, 'club_class').maxPerOrder === 1);
}

console.log('\nPersonal data');
check('availability never reads checkout_reservations directly', !/from\("checkout_reservations"\)/.test(newSrc));
check('and never names a guest column', !/guest_email|guest_name/.test(newSrc));

db.drop();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
