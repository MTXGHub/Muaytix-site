// Agent Tix — which page did they book from
//
//   node agent-tix/widget/tests/booking-page.test.mjs
//
// GA4 cannot answer this. Its conversion fires on the thank-you page, so every
// booking on the site looks as though it happened there, and a guest returning
// from Stripe starts a fresh GA4 session that throws the entry page away. So the
// widget records both itself: the page the visit began on, and the page Reserve
// was actually pressed on.
//
// The two are usually different, and that difference is the whole point. The
// test therefore lands on a page with NO widget, walks to one that has, and
// checks both values arrive at create-checkout separately and correctly.
//
// The rules that are easy to get quietly wrong, and are checked here: the query
// string never leaves the browser, the entry page is the FIRST page of the visit
// and not the latest, a new visit starts fresh, and nothing about any of this may
// stop a ticket selling.

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
const frag   = fs.readFileSync(path.join(HERE, '..', 'paste-into-tilda-header.html'), 'utf8');

let pass = 0, fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail ? '  -> ' + detail : '')); }
};

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);

// One place that stands up a browsing context with the site's header block on
// every page, so each scenario below starts from a genuinely fresh visit.
//   /about and /fight-card carry no widget; everything else does.
async function visit({ beforeLoad } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 }, locale: 'en-GB' });
  const page = await ctx.newPage();
  const sent = { body: null };

  if (beforeLoad) await page.addInitScript(beforeLoad);

  await page.route('**/functions/v1/**', async (route) => {
    const body = JSON.parse(route.request().postData() || '{}');
    if (route.request().url().endsWith('/availability')) {
      return route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify(body.action === 'events' ? events : night) });
    }
    if (body.action === 'warm') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"warm":true}' });
    }
    sent.body = body;
    return route.fulfill({ status: 200, contentType: 'application/json',
      body: '{"checkoutUrl":"https://checkout.stripe.test/x"}' });
  });

  await page.route('https://muaytix.test/**', (route) => {
    const url = new URL(route.request().url());
    const bare = url.pathname === '/about' || url.pathname === '/fight-card';
    return route.fulfill({
      status: 200, contentType: 'text/html',
      body: `<!doctype html><html><head><meta charset="utf-8"><title>T</title>${frag}</head>
      <body style="margin:0"><h1>Muay Thai</h1>${
        bare ? '' : '<div class="muaytix-ticket-selector" data-event-id="rws_2026_09_19"></div>'
      }</body></html>`,
    });
  });
  page.on('pageerror', e => { fail++; console.log('  FAIL page error -> ' + e.message); });

  return { ctx, page, sent };
}

async function book(page) {
  await page.waitForSelector('[data-pick]', { timeout: 12000 });
  await page.click('[data-pick="ringside"]');
  await page.waitForSelector('select[data-qty]', { timeout: 8000 });
  await page.selectOption('select[data-qty]', '2');
  await page.click('[data-go]');
  await page.waitForTimeout(700);
}

const remembered = (p) => p.evaluate(() => {
  try { return sessionStorage.getItem('mtx_landing'); } catch (e) { return null; }
});

// ---------------------------------------------------------------------------
console.log('\nRemembering where the visit started');

{
  const { ctx, page, sent } = await visit();

  // A page with no widget on it still has to remember. This is the case that
  // matters: the advert lands on a fight card, the booking happens elsewhere.
  await page.goto('https://muaytix.test/fight-card', { waitUntil: 'domcontentloaded' });
  check('a page with no widget still records the entry page',
    (await remembered(page)) === '/fight-card', await remembered(page));

  await page.goto('https://muaytix.test/rws/schedule', { waitUntil: 'domcontentloaded' });
  check('walking to a second page does NOT move the entry page',
    (await remembered(page)) === '/fight-card', await remembered(page));

  await page.goto('https://muaytix.test/rws/tickets', { waitUntil: 'domcontentloaded' });
  await book(page);

  check('create-checkout is told the entry page',
    sent.body?.landingPage === '/fight-card', JSON.stringify(sent.body?.landingPage));
  check('create-checkout is told the page Reserve was pressed on',
    sent.body?.pagePath === '/rws/tickets', JSON.stringify(sent.body?.pagePath));
  check('the two are reported separately, not collapsed into one',
    sent.body?.landingPage !== sent.body?.pagePath);
  check('the booking itself is unchanged',
    sent.body?.eventKey === night.event.eventKey && sent.body?.quantity === 2,
    JSON.stringify({ key: sent.body?.eventKey, qty: sent.body?.quantity }));

  await ctx.close();
}

// ---------------------------------------------------------------------------
console.log('\nThe query string never leaves the browser');

{
  const { ctx, page, sent } = await visit();

  // A shared link is where a stray email address or name turns up, and none of
  // that belongs in a funnel report.
  await page.goto('https://muaytix.test/about?email=someone%40example.com&gclid=abc123',
    { waitUntil: 'domcontentloaded' });
  check('the entry page is stored as a path alone',
    (await remembered(page)) === '/about', await remembered(page));

  await page.goto('https://muaytix.test/rws/tickets?utm_source=google&name=Jason#seats',
    { waitUntil: 'domcontentloaded' });
  await book(page);

  check('no query string is sent with the booking page',
    sent.body?.pagePath === '/rws/tickets', JSON.stringify(sent.body?.pagePath));
  check('no query string is sent with the entry page',
    sent.body?.landingPage === '/about', JSON.stringify(sent.body?.landingPage));

  const whole = JSON.stringify(sent.body || {});
  check('the address never reaches the request at all', !whole.includes('example.com'));
  check('the name never reaches the request at all', !whole.includes('Jason'));
  // The click id is separate plumbing and is still expected to travel.
  check('the click id is untouched by any of this',
    sent.body?.attribution?.clickId === 'abc123', JSON.stringify(sent.body?.attribution?.clickId));

  await ctx.close();
}

// ---------------------------------------------------------------------------
console.log('\nA new visit starts somewhere new');

{
  // sessionStorage rather than localStorage, deliberately: a guest who comes
  // back next week has landed on a different page and the report should say so.
  const { ctx, page } = await visit();
  await page.goto('https://muaytix.test/about', { waitUntil: 'domcontentloaded' });
  check('first visit records its own entry page', (await remembered(page)) === '/about');
  await ctx.close();

  const second = await visit();
  await second.page.goto('https://muaytix.test/rws/tickets', { waitUntil: 'domcontentloaded' });
  check('a fresh visit does not inherit the old entry page',
    (await remembered(second.page)) === '/rws/tickets',
    await remembered(second.page));
  await second.ctx.close();
}

// ---------------------------------------------------------------------------
console.log('\nWhen storage refuses, the ticket still sells');

{
  // A private window, cleared site data, or a browser with storage blocked. The
  // booking is the business; the report is bookkeeping.
  const { ctx, page, sent } = await visit({
    beforeLoad: () => {
      const boom = () => { throw new Error('storage refused'); };
      try {
        Object.defineProperty(window, 'sessionStorage', {
          configurable: true,
          get() { return { getItem: boom, setItem: boom, removeItem: boom }; },
        });
      } catch (e) {}
    },
  });

  await page.goto('https://muaytix.test/rws/tickets', { waitUntil: 'domcontentloaded' });
  await book(page);

  check('the booking still reaches create-checkout', !!sent.body?.eventKey);
  check('the quantity is still right', sent.body?.quantity === 2);
  check('the page Reserve was pressed on is still known',
    sent.body?.pagePath === '/rws/tickets', JSON.stringify(sent.body?.pagePath));
  check('the unknowable entry page is simply absent, not invented',
    sent.body?.landingPage === undefined, JSON.stringify(sent.body?.landingPage));

  await ctx.close();
}

await browser.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed\n');
process.exit(fail ? 1 : 0);
