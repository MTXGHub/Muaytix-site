// Agent Tix — Club Class for a guest whose LEO is fully booked: the server side
//
//   node agent-tix/functions/tests/club-offer-guards.test.mjs
//
// This is money logic that discounts a ticket MuayTix already holds, so it is
// tested by running it, not by reading it. The two functions that decide
// (resolveOffer in create-checkout, offersForNight in availability) are lifted
// out of the source, stripped of their types, and run against a small fake
// database. Edge functions cannot be run here directly: they need Deno, Stripe
// and a live project, none of which a test should touch.
//
// What has to hold:
//
//   Nothing is taken on the browser's word. The price, the night being switched
//   on, LEO really being fully booked and the 10 per cent limit all come from
//   the database at the moment of booking.
//
//   Any doubt, any missing row, any error means NO offer. Never a discount by
//   accident.
//
//   The offer is only ever an extra on the availability answer: if reading it
//   fails, the night is described exactly as before.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { stripTypeScriptTypes } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const read = (f) => fs.readFileSync(path.join(HERE, '..', f, 'index.ts'), 'utf8');
const checkoutSrc = read('create-checkout');
const availSrc = read('availability');

let pass = 0, fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail ? '  -> ' + detail : '')); }
};

// The text of one top-level function, from its first line to the "}" in column 0.
function lift(src, name, decl) {
  const start = src.indexOf(decl);
  if (start < 0) throw new Error('cannot find ' + name);
  const end = src.indexOf('\n}\n', start);
  return src.slice(start, end + 3);
}

// A tiny stand-in for the Supabase client. Tables are arrays; .eq/.in filter;
// awaiting a query gives {data: rows}; .maybeSingle() gives one row or null.
function fakeDb(tables, { failOn } = {}) {
  const query = (table) => {
    let rows = tables[table];
    const q = {
      select() { return q; },
      eq(col, v) { rows = rows.filter(r => r[col] === v); return q; },
      in(col, vs) { rows = rows.filter(r => vs.includes(r[col])); return q; },
      limit() { return q; },
      maybeSingle() { return Promise.resolve({ data: rows[0] ?? null, error: null }); },
      then(res, rej) { return Promise.resolve({ data: rows, error: null }).then(res, rej); },
    };
    return q;
  };
  return { from(table) {
    if (failOn === table) throw new Error('the database said no: ' + table);
    return query(table);
  } };
}

function build(src, decl, name) {
  const code = stripTypeScriptTypes(lift(src, name, decl));
  return (supabase) => {
    const ctx = vm.createContext({ supabase, console: { error() {}, log() {} }, Number, Map, Set, String, Array, Object, Promise, Math });
    vm.runInContext(code, ctx);
    return vm.runInContext(name, ctx);
  };
}

const makeResolve = build(checkoutSrc, 'async function resolveOffer(', 'resolveOffer');
const makeOffers  = build(availSrc, 'async function offersForNight(', 'offersForNight');

// ---------------------------------------------------------------------------
// The world as it should be when the offer is valid.
const world = () => ({
  events: [{ event_key: 'new_power_x', fallback_offer_enabled: true }],
  ticket_classes: [{ id: 'L', code: 'leo_section' }, { id: 'C', code: 'club_class' }],
  class_fallback_offers: [{ id: 'o1', code: 'leo_to_club', from_class_id: 'L', to_class_id: 'C', active: true }],
  class_fallback_offer_prices: [
    { offer_id: 'o1', currency: 'usd', unit_amount: 5000 },
    { offer_id: 'o1', currency: 'thb', unit_amount: 165000 },
  ],
  event_ticket_availability: [
    { event_key: 'new_power_x', ticket_class_code: 'leo_section', status: 'fully_booked' },
  ],
  event_ticket_prices: [
    { event_ticket_class_id: 'ETC', currency: 'thb', unit_amount: 180000 },
    { event_ticket_class_id: 'ETC', currency: 'usd', unit_amount: 5400 },
  ],
});
const CLUB_ROW = { ticket_class_code: 'club_class', event_ticket_class_id: 'ETC' };

console.log('\nresolveOffer: the checkout decides, not the browser');
{
  const run = (w, { cur = 'usd', night = 5400, from = 'leo_section', opts } = {}) =>
    makeResolve(fakeDb(w, opts))('new_power_x', from, CLUB_ROW, cur, night);

  const ok = await run(world());
  check('a valid offer is granted', ok && ok.unitAmount === 5000, JSON.stringify(ok));
  check('it names the offer for the books', ok && ok.code === 'leo_to_club', JSON.stringify(ok));
  check('the discount is measured in baht, per seat: 1,800 less 1,650 is 150',
        ok && ok.discountMinor === 15000, JSON.stringify(ok));
  const thb = await run(world(), { cur: 'thb', night: 180000 });
  check('paying in baht: 1,650', thb && thb.unitAmount === 165000 && thb.discountMinor === 15000, JSON.stringify(thb));

  let w = world(); w.events[0].fallback_offer_enabled = false;
  check('a night not switched on gets nothing (this is what keeps RWS out)', await run(w) === null);

  w = world(); w.events = [];
  check('an unknown night gets nothing', await run(w) === null);

  w = world(); w.event_ticket_availability[0].status = 'available';
  check('LEO still on sale: no offer', await run(w) === null);
  w = world(); w.event_ticket_availability[0].status = 'limited';
  check('LEO nearly gone but on sale: no offer', await run(w) === null);
  w = world(); w.event_ticket_availability[0].status = 'booking_closed';
  check('booking closed is not fully booked: no offer', await run(w) === null);
  w = world(); w.event_ticket_availability = [];
  check('no LEO row at all: no offer', await run(w) === null);

  w = world(); w.class_fallback_offers[0].active = false;
  check('an offer switched off is not honoured', await run(w) === null);
  w = world(); w.class_fallback_offers = [];
  check('no such offer: nothing', await run(w) === null);
  check('an offer asked for from the wrong class: nothing', await run(world(), { from: 'ringside' }) === null);
  check('an unknown class name: nothing', await run(world(), { from: 'nonsense' }) === null);

  w = world(); w.class_fallback_offer_prices = w.class_fallback_offer_prices.filter(p => p.currency !== 'usd');
  check('no offer price in the guest\'s currency: nothing', await run(w) === null);
  w = world(); w.class_fallback_offer_prices = w.class_fallback_offer_prices.filter(p => p.currency !== 'thb');
  check('no baht price to measure the discount by: nothing', await run(w) === null);
  w = world(); w.event_ticket_prices = w.event_ticket_prices.filter(p => p.currency !== 'thb');
  check('no baht price for the night: nothing', await run(w) === null);

  // The 10 per cent limit, against what is actually being charged tonight.
  w = world(); w.class_fallback_offer_prices.find(p => p.currency === 'usd').unit_amount = 4860;
  check('exactly 10 per cent under is allowed', (await run(w))?.unitAmount === 4860);
  w = world(); w.class_fallback_offer_prices.find(p => p.currency === 'usd').unit_amount = 4859;
  check('a cent past 10 per cent is refused', await run(w) === null);
  w = world(); w.class_fallback_offer_prices.find(p => p.currency === 'usd').unit_amount = 5401;
  check('an "offer" dearer than the ordinary price is refused', await run(w) === null);
  check('the limit is checked against tonight\'s price, not the standing one',
        await run(world(), { night: 4000 }) === null);

  w = world(); w.class_fallback_offer_prices.find(p => p.currency === 'thb').unit_amount = 150000;
  const deep = await run(w, { cur: 'thb', night: 180000 });
  check('1,500 baht against 1,800 (16.7 per cent) is refused', deep === null, JSON.stringify(deep));

  check('a database error means no offer, not a crash',
        await run(world(), { opts: { failOn: 'class_fallback_offers' } }) === null);
  check('a missing table means no offer, not a crash',
        await run(world(), { opts: { failOn: 'class_fallback_offer_prices' } }) === null);
}

console.log('\noffersForNight: what the widget is told it may draw');
{
  const rows = (leo = 'fully_booked', club = 'available') => ([
    { ticket_class_code: 'leo_section', status: leo,  event_ticket_class_id: 'EL' },
    { ticket_class_code: 'club_class',  status: club, event_ticket_class_id: 'EC' },
  ]);
  const prices = () => new Map([['EC', [{ currency: 'usd', unitAmount: 5400 }, { currency: 'thb', unitAmount: 180000 }]]]);
  const run = (w, r = rows(), p = prices(), opts) => makeOffers(fakeDb(w, opts))('new_power_x', r, p);

  const got = await run(world());
  const leo = got.get('leo_section');
  check('LEO fully booked with Club Class open: an offer', !!leo && leo.toCode === 'club_class');
  check('it carries a price in every currency Club Class is sold in',
        JSON.stringify(leo?.prices) === JSON.stringify([{ currency: 'usd', unitAmount: 5000 }, { currency: 'thb', unitAmount: 165000 }]),
        JSON.stringify(leo));
  check('only LEO has one', got.size === 1);

  let w = world(); w.events[0].fallback_offer_enabled = false;
  check('a night not switched on: nothing', (await run(w)).size === 0);
  check('LEO on sale: nothing', (await run(world(), rows('available'))).size === 0);
  check('LEO nearly gone but on sale: nothing', (await run(world(), rows('limited'))).size === 0);
  check('Club Class fully booked: nothing', (await run(world(), rows('fully_booked', 'fully_booked'))).size === 0);
  check('Club Class booking closed: nothing', (await run(world(), rows('fully_booked', 'booking_closed'))).size === 0);
  check('Club Class "closed": nothing', (await run(world(), rows('fully_booked', 'closed'))).size === 0);
  check('Club Class down to its last few still counts as open',
        (await run(world(), rows('fully_booked', 'limited'))).size === 1);

  w = world(); w.class_fallback_offer_prices = w.class_fallback_offer_prices.filter(p => p.currency !== 'thb');
  check('a currency with no offer price: no offer at all, never a dead button', (await run(w)).size === 0);
  w = world(); w.class_fallback_offer_prices.find(p => p.currency === 'usd').unit_amount = 4000;
  check('a price more than 10 per cent under: no offer', (await run(w)).size === 0);
  w = world(); w.class_fallback_offers[0].active = false;
  check('an offer switched off: nothing', (await run(w)).size === 0);
  check('no prices for Club Class tonight: nothing', (await run(world(), rows(), new Map())).size === 0);

  const broken = await run(world(), rows(), prices(), { failOn: 'class_fallback_offers' });
  check('a database error gives an empty answer, not a failure', broken instanceof Map && broken.size === 0);
  const noTable = await run(world(), rows(), prices(), { failOn: 'events' });
  check('and so does a missing column or table', noTable instanceof Map && noTable.size === 0);
}

console.log('\nThe shape of the code');
{
  const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
  const co = strip(checkoutSrc), av = strip(availSrc);

  check('checkout reads offerFrom from the request, capped', /const offerFrom = String\(body\.offerFrom \?\? ""\)\.trim\(\)\.slice\(0, 64\)/.test(co));
  check('but never a price, discount or total', !/body\.(price|unitAmount|unit_amount|discount|total|amount)/.test(co));
  check('an offer that does not stand is a 409 the widget already handles',
        /code: "offer_unavailable"[\s\S]{0,60}409/.test(co));
  check('the charge uses the resolved amount',
        /unit_amount: unitAmount,\s*\/\/ Built here|unit_amount: unitAmount,/.test(co) && !/unit_amount: price\.unit_amount,\s*\/\/ Built here/.test(co));
  check('the standing price is not charged when an offer was taken',
        !/unit_amount: price\.unit_amount/.test(co.slice(co.indexOf('const params'))));
  check('the offer is settled BEFORE any stock is held',
        co.indexOf('resolveOffer(eventKey') > 0 && co.indexOf('resolveOffer(eventKey') < co.indexOf('reserve_tickets'));
  check('an ordinary booking never names the new columns',
        /\.\.\.\(offer \? \{ offer_code: offer\.code, offer_discount_minor: offer\.discountMinor \} : \{\}\)/.test(co));
  check('the offer is recorded in Stripe metadata', /if \(offer\) metadata\.offer = offer\.code/.test(co));
  check('payment methods are still left to the Stripe configuration', !/payment_method_types/.test(co));

  check('availability wraps the offer in a try so it can never cost a night',
        /async function offersForNight[\s\S]*?try \{[\s\S]*?\} catch \(err\) \{[\s\S]*?return new Map\(\);/.test(av));
  check('availability only attaches it when there is one',
        /\.\.\.\(offers\.has\(String\(r\.ticket_class_code\)\) \? \{ offer: offers\.get/.test(av));
  check('the offer is per night and off unless switched on', /fallback_offer_enabled/.test(av) && /fallback_offer_enabled/.test(co));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
