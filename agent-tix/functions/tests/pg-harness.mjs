// Shared by the guest-hold tests: a fake Supabase client that talks to a REAL
// scratch Postgres, so the SQL in schema/0043_guest_hold.sql runs for real
// underneath the real edge function code. Nothing here ever touches the live
// database.
//
// Needs a Postgres server you can create a database on, through the usual
// PGHOST / PGPORT / PGUSER variables (the sandbox uses PGHOST=/tmp PGPORT=5544
// PGUSER=postgres). It builds its own database from schema/tests/replica.sql and
// 0043_guest_hold.sql each run.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA = path.join(HERE, '..', '..', 'schema');

const baseArgs = ['-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1'];
const psqlEnv = { ...process.env, PGHOST: process.env.PGHOST ?? '/tmp', PGPORT: process.env.PGPORT ?? '5544', PGUSER: process.env.PGUSER ?? 'postgres' };

export const lit = (v) => {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return `'${String(v).replace(/'/g, "''")}'`;
};

export function makeDb(name) {
  const run = (db, args) => execFileSync('psql', [...baseArgs, '-d', db, ...args], { env: psqlEnv, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const state = { statements: [] };
  const db = {
    name, state,
    create() {
      run('postgres', ['-c', `drop database if exists ${name}`]);
      run('postgres', ['-c', `create database ${name}`]);
      run(name, ['-f', path.join(SCHEMA, 'tests', 'replica.sql')]);
      run(name, ['-f', path.join(SCHEMA, '0043_guest_hold.sql')]);
    },
    // Runs a statement; returns rows as objects. Throws with Postgres's own message.
    rows(query) {
      state.statements.push(query);
      const out = run(name, ['-c', `select coalesce(json_agg(t), '[]'::json) from (${query}) t`]);
      return JSON.parse(out.trim() || '[]');
    },
    exec(query) { state.statements.push(query); run(name, ['-c', query]); },
    drop() { try { run('postgres', ['-c', `drop database if exists ${name}`]); } catch { /* the server may be gone */ } },
  };
  return db;
}

// "ERROR:  Only 1 remaining" -> "Only 1 remaining", the same text supabase-js gives.
const pgMessage = (e) => {
  const text = String(e.stderr ?? e.message ?? e);
  const m = text.match(/ERROR:\s+(.*)/);
  return m ? m[1].trim() : text.trim();
};

// A stand-in for the supabase-js client. Tables listed in `fixed` answer with
// canned rows; every other table is read from the scratch database; every rpc is
// a real function call.
export function fakeClient(db, { fixed = {}, onRpc, failRpc = [] } = {}) {
  const from = (table) => {
    const q = { cols: '*', where: [], patch: null, limitN: null };
    const exec = () => {
      if (table in fixed) {
        const v = typeof fixed[table] === 'function' ? fixed[table](q) : fixed[table];
        return { data: v, error: null };
      }
      try {
        const where = q.where.map(([c, op, v]) => op === 'eq' ? `${c} = ${lit(v)}` : `${c} in (${v.map(lit).join(',')})`).join(' and ');
        if (q.patch) {
          const set = Object.entries(q.patch).map(([c, v]) => `${c} = ${lit(v)}`).join(', ');
          db.exec(`update ${table} set ${set}${where ? ' where ' + where : ''}`);
          return { data: null, error: null };
        }
        const rows = db.rows(`select ${q.cols} from ${table}${where ? ' where ' + where : ''}${q.limitN ? ' limit ' + q.limitN : ''}`);
        return { data: rows, error: null };
      } catch (e) { return { data: null, error: { message: pgMessage(e) } }; }
    };
    const api = {
      select(cols) { q.cols = cols ?? '*'; return api; },
      eq(c, v) { q.where.push([c, 'eq', v]); return api; },
      in(c, v) { q.where.push([c, 'in', v]); return api; },
      limit(n) { q.limitN = n; return api; },
      order() { return api; },
      update(patch) { q.patch = patch; return api; },
      insert() { return Promise.resolve({ data: null, error: null }); },
      single() { const r = exec(); return Promise.resolve({ data: Array.isArray(r.data) ? r.data[0] : r.data, error: r.error }); },
      maybeSingle() { const r = exec(); return Promise.resolve({ data: Array.isArray(r.data) ? (r.data[0] ?? null) : r.data, error: r.error }); },
      then(ok, bad) { return Promise.resolve(exec()).then(ok, bad); },
    };
    return api;
  };
  return {
    from,
    rpc(name, args) {
      onRpc?.(name, args);
      if (failRpc.includes(name)) return Promise.resolve({ data: null, error: { message: 'rpc ' + name + ' is not available' } });
      try {
        const named = Object.entries(args ?? {}).map(([k, v]) => `${k} => ${lit(v)}`).join(', ');
        const rows = db.rows(`select * from ${name}(${named})`);
        // PostgREST answers a function that returns one plain value with that value.
        const scalar = rows.length === 1 && Object.keys(rows[0]).length === 1 && name in rows[0];
        return Promise.resolve({ data: scalar ? rows[0][name] : rows, error: null });
      } catch (e) { return Promise.resolve({ data: null, error: { message: pgMessage(e) } }); }
    },
  };
}

// One night with 10 Club seats (6 sold), a sold out Ringside and a free Third
// Class, each priced in THB and USD. Same ids as the SQL test.
export const IDS = {
  tenant: '00000000-0000-0000-0000-000000000001',
  club: '00000000-0000-0000-0000-00000000f101',
  ring: '00000000-0000-0000-0000-00000000f102',
  third: '00000000-0000-0000-0000-00000000f103',
  club2: '00000000-0000-0000-0000-00000000f201',
};

export function seed(db) {
  db.exec(`
    insert into tenants (id, slug) values ('${IDS.tenant}', 'muaytix');
    insert into venues (id, tenant_id, name) values ('00000000-0000-0000-0000-0000000000a1', '${IDS.tenant}', 'Test stadium');
    insert into events (id, tenant_id, venue_id, event_key, name, starts_at, publication_status) values
      ('00000000-0000-0000-0000-0000000000e1', '${IDS.tenant}', '00000000-0000-0000-0000-0000000000a1', 'test_night_1', 'Test night 1', now() + interval '2 days', 'published'),
      ('00000000-0000-0000-0000-0000000000e2', '${IDS.tenant}', '00000000-0000-0000-0000-0000000000a1', 'test_night_2', 'Test night 2', now() + interval '3 days', 'published');
    insert into ticket_classes (id, tenant_id, code, name, display_order) values
      ('00000000-0000-0000-0000-0000000000c1', '${IDS.tenant}', 'club_class', 'Club Class', 2),
      ('00000000-0000-0000-0000-0000000000c2', '${IDS.tenant}', 'ringside', 'Ringside', 1),
      ('00000000-0000-0000-0000-0000000000c3', '${IDS.tenant}', 'third_class', 'Third Class', 4);
    insert into event_ticket_classes (id, tenant_id, event_id, ticket_class_id, total_quantity, sold_quantity) values
      ('${IDS.club}', '${IDS.tenant}', '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000c1', 10, 6),
      ('${IDS.ring}', '${IDS.tenant}', '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000c2', 10, 10),
      ('${IDS.third}', '${IDS.tenant}', '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000c3', 50, 0),
      ('${IDS.club2}', '${IDS.tenant}', '00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000c1', 10, 0);
    insert into event_ticket_prices (event_ticket_class_id, currency, unit_amount) select id, 'thb', 180000 from event_ticket_classes;
    insert into event_ticket_prices (event_ticket_class_id, currency, unit_amount) select id, 'usd', 5400 from event_ticket_classes;
  `);
}

// Puts Club Class back to "10 seats, 6 sold, nothing held" and clears holds.
export function resetClub(db) {
  db.exec(`update checkout_reservations set status = 'failed' where status = 'held';
           update event_ticket_classes set total_quantity = 10, sold_quantity = 6, reserved_quantity = 0 where id = '${IDS.club}';
           update event_ticket_classes set reserved_quantity = 0 where id <> '${IDS.club}';`);
}

// Session ids are unique across every fake Stripe in a run, as Stripe's are: the
// reservations table has a unique index on them.
let sessionCounter = 0;

// A Stripe stand-in that remembers every call, in order.
export function fakeStripe({ createFails = false, expireFails = false, retrieveFails = false } = {}) {
  const sessions = new Map();
  const calls = [];
  class FakeStripe {
    constructor() {
      this.checkout = { sessions: {
        create: async (params) => {
          calls.push({ op: 'create', params });
          if (createFails) throw new Error('stripe is down');
          const id = 'cs_test_' + (++sessionCounter);
          const s = { id, url: 'https://checkout.stripe.com/c/pay/' + id, status: 'open', params,
            amount_total: params.line_items[0].price_data.unit_amount * params.line_items[0].quantity,
            currency: params.line_items[0].price_data.currency };
          sessions.set(id, s);
          return s;
        },
        retrieve: async (id) => {
          calls.push({ op: 'retrieve', id });
          if (retrieveFails) throw new Error('stripe retrieve failed');
          const s = sessions.get(id);
          if (!s) throw new Error('No such checkout.session: ' + id);
          return { ...s };
        },
        expire: async (id) => {
          calls.push({ op: 'expire', id });
          await new Promise((r) => setTimeout(r, 15));       // a real round trip takes time
          if (expireFails) throw new Error('stripe would not expire it');
          const s = sessions.get(id);
          if (!s) throw new Error('No such checkout.session: ' + id);
          s.status = 'expired';
          return { ...s };
        },
      } };
    }
  }
  return { FakeStripe, sessions, calls };
}
