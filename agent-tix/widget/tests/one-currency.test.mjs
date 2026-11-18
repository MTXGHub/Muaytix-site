// A class sold in one currency only says so (Jason, 18 November 2026: Third Class in GBP only).
//
// The rule defended: the sentence appears when, and only when, the class on screen has exactly one
// currency. A class with several currencies shows nothing. Wording is Jason's, version 1:
//   "Third Class tickets are charged in GBP only. No booking fee."
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
async function loadPlaywright(){
  try { return await import('playwright'); }
  catch { const r = execSync('npm root -g',{encoding:'utf8'}).trim();
    return await import(pathToFileURL(path.join(r,'playwright','index.js')).href); }
}
const pw = await loadPlaywright();
const chromium = pw.chromium ?? pw.default.chromium;

const events = JSON.parse(fs.readFileSync(new URL('./calendar.json', import.meta.url), 'utf8'));
const base   = JSON.parse(fs.readFileSync(new URL('./night.json', import.meta.url), 'utf8'));
const widget = fs.readFileSync(new URL('../widget.js', import.meta.url), 'utf8');

let pass = 0, fail = 0;
const check = (n, ok, d = '') => { ok ? (pass++, console.log('  ok   ' + n)) : (fail++, console.log('  FAIL ' + n + (d ? '  -> ' + d : ''))); };

const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});

// Third Class on sale in GBP only; every other class as the fixture has it (several currencies).
function night() {
  const n = JSON.parse(JSON.stringify(base));
  const third = n.classes.find(c => c.code === 'third_class');
  third.status = 'available';
  third.prices = [{ currency: 'gbp', unitAmount: 2500 }];
  return n;
}

async function open(code) {
  const ctx = await b.newContext({ viewport: { width: 1180, height: 1000 } });
  const p = await ctx.newPage();
  const fixture = night();
  await p.route('**/functions/v1/**', r => {
    const bd = JSON.parse(r.request().postData() || '{}');
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(bd.action === 'events' ? events : fixture) });
  });
  p.on('pageerror', e => { fail++; console.log('  FAIL page error -> ' + e.message); });
  await p.setContent(`<!doctype html><html><head><meta charset="utf-8"><title>t</title></head>
    <body><div class="muaytix-ticket-selector" data-event-id="rws_2026_09_05"></div>
    <script>${widget}<\/script></body></html>`, { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('[data-pick]', { timeout: 12000 });
  await p.click(`[data-pick="${code}"]`);
  await p.waitForSelector('[data-cur]', { timeout: 8000 });
  return { p, ctx };
}

console.log('\nThird Class, GBP only');
{
  const { p, ctx } = await open('third_class');
  const note = await p.locator('.mtx-onecur').allInnerTexts();
  check('exactly one sentence is shown', note.length === 1, JSON.stringify(note));
  check('it reads exactly as Jason wrote it',
        note[0] === 'Third Class tickets are charged in GBP only. No booking fee.', JSON.stringify(note));
  check('the currency box offers GBP and nothing else',
        JSON.stringify(await p.locator('[data-cur] option').allInnerTexts()) === '["GBP"]');
  const html = await p.content();
  check('no em dash and no scarcity words in the sentence', !/—|hurry|selling fast/i.test(note[0] || ''));
  const over = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check('no sideways scroll', over <= 0, String(over));
  await ctx.close();
}

console.log('\nA class with several currencies says nothing');
{
  const { p, ctx } = await open('ringside');
  check('no sentence', (await p.locator('.mtx-onecur').count()) === 0);
  check('the currency box still offers more than one',
        (await p.locator('[data-cur] option').count()) > 1);
  await ctx.close();
}

await b.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
