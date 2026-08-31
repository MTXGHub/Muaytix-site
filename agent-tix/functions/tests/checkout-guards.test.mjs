// Agent Tix — guards on the checkout call
//
//   node agent-tix/functions/tests/checkout-guards.test.mjs
//
// These are source-level checks, not behavioural ones. They exist because the
// browser tests stub Stripe out entirely and therefore cannot see what is
// actually sent to it — which is exactly where the most expensive mistake so
// far was made.
//
// On 31 August 2026 `payment_method_types: ["card", "link"]` was added to the
// checkout call, on the mistaken belief that this matched V1. It did not. The
// account's payment method configuration has Alipay, WeChat Pay, KakaoPay,
// Naver Pay, Pix, iDEAL, Bancontact and the rest deliberately switched on, with
// marketing spend behind the Chinese methods and a 400% rise in bookings from
// that market. Setting the field overrides the configuration wholesale and
// switches all of it off, silently, with no error and no failed test.
//
// A comment saying "do not do this" is not enough. This fails the build.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(HERE, '..', 'create-checkout', 'index.ts'), 'utf8');

let pass = 0, fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail ? '  -> ' + detail : '')); }
};

// Strip comments so the explanation above the code does not satisfy or trip
// any of these checks by accident.
const code = source
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n').filter(line => !line.trim().startsWith('//')).join('\n');

console.log('\nThe checkout call');

check('payment methods are left to the Stripe configuration',
      !/payment_method_types/.test(code),
      'create-checkout sets payment_method_types, which overrides the account configuration and switches off Alipay, WeChat Pay and every other geo-specific method');

// Standing instruction, 31 August 2026: the name is REQUIRED and stays
// required. It is how guests are addressed by first name, and it is a signal
// Radar uses. Making it optional to dodge a form-validation problem on Stripe's
// own page was rejected outright, and rightly.
check('the customer name is collected',
      /name_collection/.test(code));

check('and it is required, not optional',
      /name_collection[\s\S]{0,120}?optional:\s*false/.test(code)
      && !/name_collection[\s\S]{0,120}?optional:\s*true/.test(code),
      'name_collection must stay optional:false');

check('the price is read server side, never taken from the request',
      /event_ticket_prices/.test(code) && !/body\.(unitAmount|unit_amount|amount|price)\b/.test(code));

check('stock is held before Stripe is called',
      code.indexOf('reserve_tickets') < code.indexOf('checkout.sessions.create'));

check('a failure after the hold gives the seats back',
      /release_reservation/.test(code));

check('V2 sessions are tagged so V1 ignores them',
      /v2_reservation_id/.test(code) && !/\breservation_id:/.test(code));

check('the session outlives Stripe’s 30 minute minimum',
      /SESSION_MINUTES = (3[1-9]|[4-9]\d)/.test(code));

check('our hold outlives the Stripe session',
      (() => {
        const hold = Number((code.match(/HOLD_MINUTES = (\d+)/) || [])[1]);
        const sess = Number((code.match(/SESSION_MINUTES = (\d+)/) || [])[1]);
        return Number.isFinite(hold) && Number.isFinite(sess) && hold > sess;
      })());

check('the warm-up cannot reserve anything',
      code.indexOf('action === "warm"') < code.indexOf('reserve_tickets'));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
