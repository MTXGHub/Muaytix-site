// Agent Tix — what 0043 and its rollback are allowed to touch
//
//   node agent-tix/schema/tests/guest-hold-migration-guards.test.mjs
//
// Reads the two files as text. Jason's question of 10 October 2026: does the access
// change touch only the new objects? The database test (guest_hold.test.sql) proves
// it on a scratch copy, comparing every existing function's access before and
// after. This is the second half: the files themselves cannot be edited into
// touching anything else without this failing.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const up = fs.readFileSync(path.join(HERE, '..', '0043_guest_hold.sql'), 'utf8');
const down = fs.readFileSync(path.join(HERE, '..', '0043_guest_hold_rollback.sql'), 'utf8');

let pass = 0, fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail ? '  -> ' + detail : '')); }
};
// Statements only: no comments, and the inside of each function body (between the
// dollar quotes) blanked, so what is left is what runs at the top level.
const code = (s) => s.replace(/--[^\n]*/g, '').replace(/\$\$[\s\S]*?\$\$/g, '$$ $$');
const statements = (s) => code(s).split(';').map((x) => x.replace(/\s+/g, ' ').trim()).filter(Boolean);

const NEW = ['public.live_hold(uuid, text)', 'public.class_view_for_holder(uuid, integer)', 'public.replace_reservation(uuid, uuid, integer, timestamptz)'];
const EXISTING = ['reserve_tickets', 'release_reservation', 'complete_reservation', 'expire_stale_reservations', 'ticket_availability_status'];

console.log('\n0043_guest_hold.sql');
const upStatements = statements(up);
const access = upStatements.filter((s) => /^(revoke|grant)\b/i.test(s));
check('there are access statements, and every one names one of the three new functions by full signature',
  access.length === 6 && access.every((s) => NEW.some((n) => s.includes(' on function ' + n + ' '))), JSON.stringify(access));
check('no access statement is on a table, a schema, a role or everything in a schema',
  access.every((s) => /^(revoke all|grant execute) on function public\./i.test(s)));
check('no alter default privileges (that would change every future function)', !/alter\s+default\s+privileges/i.test(code(up)));
check('no access statement mentions an existing function',
  !access.some((s) => EXISTING.some((e) => s.includes(e))));
check('the revokes are from public, anon and authenticated, and nobody else',
  access.filter((s) => /^revoke/i.test(s)).every((s) => /from public, anon, authenticated$/i.test(s)));
check('the grants are to the service role only',
  access.filter((s) => /^grant/i.test(s)).every((s) => /to service_role$/i.test(s)));
check('the only things created are the three functions',
  upStatements.filter((s) => /^create\b/i.test(s)).length === 3 && upStatements.filter((s) => /^create\b/i.test(s)).every((s) => /^create or replace function public\.(live_hold|class_view_for_holder|replace_reservation)\(/i.test(s)));
check('and none of them replaces an existing function',
  !upStatements.some((s) => /^create/i.test(s) && EXISTING.some((e) => new RegExp('function public\\.' + e + '\\(', 'i').test(s))));
check('nothing is altered, dropped, inserted, updated or deleted',
  !upStatements.some((s) => /^(alter|drop|insert|update|delete|truncate)\b/i.test(s)));
check('no personal column is named', !/guest_email|guest_name/i.test(code(up)));

console.log('\n0043_guest_hold_rollback.sql');
const downStatements = statements(down);
check('it is three statements, all drop function if exists', downStatements.length === 3 && downStatements.every((s) => /^drop function if exists public\.(replace_reservation|class_view_for_holder|live_hold)\(/i.test(s)), JSON.stringify(downStatements));
check('with the same signatures the migration created', NEW.every((n) => downStatements.some((s) => s.endsWith(n.replace('public.', 'public.')) || s.includes(n))), JSON.stringify(downStatements));
check('no CASCADE, so it cannot drag anything else with it', !/cascade/i.test(code(down)));
check('it names no existing function', !downStatements.some((s) => EXISTING.some((e) => s.includes(e))));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
