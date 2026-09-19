// Agent Tix — what the week owes
//
//   node agent-tix/functions/tests/weekly-pay-guards.test.mjs
//
// Wages are paid weekly, as a company decision rather than a convenience: this
// report exists so the weekly number takes thirty seconds instead of an
// afternoon.
//
// Two properties matter more than the rest, and both are checked below.
//
// The bands are MARGINAL. Earning one pound more must never make the total go
// down -- a cliff edge in a wage calculation is the kind of bug someone only
// finds on payday.
//
// The accelerator is paid on contribution AFTER advertising. Paying on gross
// would have rewarded a 196% week in which the money actually left in the
// business grew 20%.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const sql = fs.readFileSync(
  path.join(HERE, '..', '..', 'schema', '0021_the_weekly_wage.sql'), 'utf8');

let pass = 0, fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail ? '  -> ' + detail : '')); }
};

// The band maths, in JavaScript, so the rules are tested rather than the SQL
// merely being read. Pence throughout, same as the table.
const BANDS = [
  { lower: 0,      upper: 55000,  rate: 15 },
  { lower: 55000,  upper: 90000,  rate: 30 },
  { lower: 90000,  upper: 135000, rate: 40 },
  { lower: 135000, upper: 200000, rate: 45 },
  { lower: 200000, upper: null,   rate: 50 },
];
const BASE = 10000, PER_TICKET = 50, THB_PER_GBP = 44.6310;

const accelerator = (net) => BANDS
  .filter(b => net > b.lower)
  .reduce((sum, b) => sum + (Math.min(net, b.upper ?? net) - b.lower) * b.rate / 100, 0);

const totalPay = (net, tickets) => BASE + tickets * PER_TICKET + accelerator(net);

console.log('\nThe bands are marginal, with no cliff edge');

let dropped = 0, last = -1;
for (let net = 0; net <= 300000; net += 250) {
  const now = accelerator(net);
  if (now < last) dropped++;
  last = now;
}
check('pay never goes DOWN as the week gets better', dropped === 0, dropped + ' drops');

// A cliff edge would show up as a jump at a boundary. Marginal bands step
// smoothly: one more pound is only ever taxed at that band's own rate.
const atBoundary = (b) => Math.round(accelerator(b + 100) - accelerator(b));
check('crossing 550 adds only the new rate, not a lump',
  atBoundary(55000) === 30, atBoundary(55000));
check('crossing 900 adds only the new rate',
  atBoundary(90000) === 40, atBoundary(90000));
check('crossing 1,350 adds only the new rate',
  atBoundary(135000) === 45, atBoundary(135000));
check('crossing 2,000 adds only the new rate',
  atBoundary(200000) === 50, atBoundary(200000));
check('a week that made nothing pays base only, never a negative',
  totalPay(0, 0) === BASE && accelerator(0) === 0);
check('a loss-making week cannot produce a negative accelerator',
  accelerator(-5000) === 0, accelerator(-5000));

console.log('\nIt reproduces the three real weeks');

// Gross contribution in baht, and the advertising Google actually billed.
const weeks = [
  { from: '31 Aug', thb: 33850, adGbp: 86.07,  tickets: 65,  expect: 251.71 },
  { from: '7 Sep',  thb: 40950, adGbp: 215.39, tickets: 72,  expect: 264.14 },
  { from: '14 Sep', thb: 62325, adGbp: 586.20, tickets: 107, expect: 314.08 },
];
for (const w of weeks) {
  const net = Math.round(w.thb * 100 / THB_PER_GBP) - Math.round(w.adGbp * 100);
  const paid = totalPay(net, w.tickets) / 100;
  check('w/c ' + w.from + ' pays £' + w.expect,
    Math.abs(paid - w.expect) < 0.02, '£' + paid.toFixed(2));
}

console.log('\nAn accelerator, not a flat rate');

// The whole point: pay must grow FASTER than the business does, or it is not an
// accelerator, it is a percentage.
const nowNet = Math.round(62325 * 100 / THB_PER_GBP) - 58620;
const doubled = nowNet * 2;
const growthInPay = totalPay(doubled, 214) / totalPay(nowNet, 107);
check('doubling net contribution MORE than doubles the pay',
  growthInPay > 2, '×' + growthInPay.toFixed(2));
// And the company's side of it: the share rises, which is the cost of an
// accelerator and is worth seeing rather than discovering.
const share = (net, tickets) => 100 * totalPay(net, tickets) / net;
check('the share of net contribution rises with the business',
  share(doubled, 214) > share(nowNet, 107),
  share(nowNet, 107).toFixed(1) + '% -> ' + share(doubled, 214).toFixed(1) + '%');

console.log('\nThe schema says what it does');

check('advertising spend is stored, so net can be computed at all',
  /create table if not exists ad_spend_daily/.test(sql));
check('the arrangement is a table, changeable without a migration',
  /create table if not exists pay_structure/.test(sql) &&
  /create table if not exists pay_bands/.test(sql));
// A second row would silently double everyone's wages.
check('only one pay structure can ever exist',
  /only_row\s+boolean primary key default true check \(only_row\)/.test(sql));
check('the top band has no ceiling', /\(200000,\s+null,\s+50\)/.test(sql));
check('base and slice match what was agreed',
  /values \(10000, 50, 44\.6310\)/.test(sql));
check('the accelerator is computed on contribution after advertising',
  /net_minor/.test(sql) && /- coalesce\(a\.ad_minor, 0\)/.test(sql));
check('a week that lost money on advertising shows no share, not a nonsense one',
  /case when n\.net_minor > 0 then/.test(sql));
check('wages are sterling, margin is baht, and the rate is an input',
  /thb_per_gbp/.test(sql));

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
