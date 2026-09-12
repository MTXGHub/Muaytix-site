// Agent Tix — a night where no two seats are together
//
//   node agent-tix/widget/tests/seats-apart.test.mjs
//
// Asked for on 12 September 2026: Kiatpetch Ringside had six seats left and
// not one pair of them side by side. The widget only knew how to say "we can
// seat N of your group together", and it read a zero as "say nothing at all" —
// so a couple would have bought two scattered seats believing they were
// sitting next to each other, and found out at the gate.
//
// Zero now means zero: a group is warned, and a lone guest is not, because one
// person is not a group.

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
async function loadPlaywright() {
  try { return await import('playwright'); }
  catch {
    const root = execSync('npm root -g', { encoding: 'utf8' }).trim();
    return await import(pathToFileURL(path.join(root, 'playwright', 'index.js')).href);
  }
}
const pw = await loadPlaywright();
const chromium = pw.chromium ?? pw.default.chromium;

const night  = JSON.parse(fs.readFileSync(path.join(HERE, 'night.json'), 'utf8'));
const events = JSON.parse(fs.readFileSync(path.join(HERE, 'calendar.json'), 'utf8'));
const frag  = fs.readFileSync(path.join(HERE, '..', 'paste-into-tilda-header.html'), 'utf8');

// Ringside: six seats left, none of them together. LEO: unassigned seating,
// so it must stay silent however many are bought.
const scattered = JSON.parse(JSON.stringify(night));
for (const c of scattered.classes) {
  if (c.code === 'ringside') { c.maximumSeatsTogether = 0; c.maxPerOrder = 6; c.status = 'limited'; }
}

let pass = 0, fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail ? '  -> ' + detail : '')); }
};

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
const page = await (await browser.newContext({ viewport: { width: 420, height: 820 } })).newPage();

let blockedByServer = 0;
await page.route('**/functions/v1/**', async (route) => {
  const body = JSON.parse(route.request().postData() || '{}');
  if (route.request().url().endsWith('/availability')) {
    return route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify(body.action === 'events' ? events : scattered) });
  }
  if (body.action === 'warm') {
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{"warm":true}' });
  }
  // Stand in for the real guard in create-checkout.
  if (body.quantity > 1 && !body.seatingAcknowledged) {
    blockedByServer++;
    return route.fulfill({ status: 409, contentType: 'application/json',
      body: '{"error":"We cannot seat your group together on this night.","code":"seating_ack_required"}' });
  }
  return route.fulfill({ status: 200, contentType: 'application/json',
    body: '{"url":"https://checkout.stripe.test/x"}' });
});

await page.route('https://muaytix.test/**', route => route.fulfill({
  status: 200, contentType: 'text/html',
  body: `<!doctype html><html><head><meta charset="utf-8"><title>Kiatpetch</title>${frag}</head>
  <body style="background:#fff;margin:0">
    <div class="muaytix-ticket-selector" data-event-id="kiatpetch_2026_09_13"></div>
  </body></html>`,
}));

page.on('pageerror', e => { fail++; console.log('  FAIL page error -> ' + e.message); });

console.log('\nKiatpetch Ringside, six seats, none together');

await page.goto('https://muaytix.test/sunday', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-pick]', { timeout: 12000 });
await page.click('[data-pick="ringside"]');
await page.waitForSelector('select[data-qty]', { timeout: 8000 });

const warn = '[data-seatack] .mtx-warn';
const go   = '[data-go]';

// One ticket: one person is not a group, so no warning and nothing to confirm.
await page.selectOption('select[data-qty]', '1');
await new Promise(r => setTimeout(r, 150));
check('one ticket shows no seating warning', await page.locator(warn).count() === 0);
check('one ticket can go straight through', await page.isEnabled(go));

// Two tickets: the warning must appear, and say the seats are apart.
await page.selectOption('select[data-qty]', '2');
await new Promise(r => setTimeout(r, 150));
check('two tickets raise the warning', await page.locator(warn).count() === 1);
const text = (await page.locator(warn).first().innerText()).replace(/\s+/g, ' ');
check('the warning says we cannot seat them together',
  /cannot seat your group together/i.test(text), text);
check('it does not claim a number of seats together',
  !/can seat \d+ of your group/i.test(text), text);

// And it must block until the guest accepts it.
check('button is held until the guest accepts', !(await page.isEnabled(go)));
check('button asks for confirmation',
  /confirm seating/i.test(await page.innerText(go)), await page.innerText(go));

await page.click('[data-ack]');
await new Promise(r => setTimeout(r, 150));
check('accepting releases the button', await page.isEnabled(go));

// Dropping back to one ticket clears it again.
await page.selectOption('select[data-qty]', '1');
await new Promise(r => setTimeout(r, 150));
check('back to one ticket clears the warning', await page.locator(warn).count() === 0);
check('back to one ticket the button is free', await page.isEnabled(go));

// LEO has unassigned seating, so it must never warn however many are bought.
await page.click('[data-back-class]');
await page.waitForSelector('[data-pick="leo_section"]', { timeout: 8000 });
await page.click('[data-pick="leo_section"]');
await page.waitForSelector('select[data-qty]', { timeout: 8000 });
await page.selectOption('select[data-qty]', '4');
await new Promise(r => setTimeout(r, 150));
check('unassigned seating never warns', await page.locator(warn).count() === 0);

await browser.close();
console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
