// Agent Tix — booking widget tests
//
//   node agent-tix/widget/tests/booking-widget.test.mjs
//
// The widget is driven through a real browser with the two Edge Functions
// stubbed, so what is under test is the widget's own behaviour: what it asks
// for, what it shows, what it refuses to let a guest do, and how it behaves
// when the server is slow, broken, or has just sold the last seat.
//
// The fixtures are real payloads taken from agent-tix-build, edited only to
// put all four statuses on one night.
//
// Two traps worth knowing about before adding a test here:
//
//   * `window.location.assign` cannot be replaced in Chromium, so a redirect
//     has to be caught by routing the destination, not by stubbing the call.
//   * The widget holds "Checking live availability" on screen for 1.2 seconds
//     on purpose, so anything after a date click needs to wait for the result
//     rather than assume it is already there.

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// Playwright may be installed locally or globally, and an ES module import does
// not fall back to the global folder the way `require` does. Try both rather
// than making every machine install it in the same place.
async function loadPlaywright() {
  try { return await import('playwright'); }
  catch {
    const root = execSync('npm root -g', { encoding: 'utf8' }).trim();
    return await import(pathToFileURL(path.join(root, 'playwright', 'index.js')).href);
  }
}
// The global copy resolves as CommonJS, so the exports arrive under `default`.
const pw = await loadPlaywright();
const chromium = pw.chromium ?? pw.default.chromium;

const WIDGET = path.join(HERE, '..', 'booking-widget.html');
const events = JSON.parse(fs.readFileSync(path.join(HERE, 'calendar.json'), 'utf8'));
const night  = JSON.parse(fs.readFileSync(path.join(HERE, 'night.json'), 'utf8'));
const frag   = fs.readFileSync(WIDGET, 'utf8');

const page_html = (extra = '') => `<!doctype html><html><head><meta charset="utf-8">
<title>t</title>${extra}</head><body style="background:#fff">${frag}</body></html>`;

// What Tilda actually does to the widget. The live page centred every
// description and turned the CTA into a solid black rectangle with invisible
// text, because the host's rules outranked ours and its text-align inherited
// straight in. Deliberately nastier than Tilda: an id-scoped rule, so anything
// that survives this survives most page builders.
const HOSTILE_HOST = `<style>
  body { text-align: center; }
  #allrecords, #allrecords * { text-align: center; }
  #allrecords button { color: #000000; font-family: serif; }
  #allrecords .day, #allrecords .note, #allrecords .pill { background: #ff00ff; color: #ff00ff; }
  #allrecords select { border-radius: 0; }
</style>`;
const hostile_page = () => `<!doctype html><html><head><meta charset="utf-8"><title>t</title>
${HOSTILE_HOST}</head><body><div id="allrecords">${frag}</div></body></html>`;

let pass = 0, fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail ? '  -> ' + detail : '')); }
};

// Honours PLAYWRIGHT_BROWSERS_PATH when the machine has its own Chromium.
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);

async function newPage({ mode = 'ok', checkoutReply = null } = {}) {
  const ctx = await browser.newContext({
    viewport: { width: 1180, height: 900 },
    timezoneId: 'America/Los_Angeles',   // deliberately not Bangkok
  });
  const page = await ctx.newPage();
  const calls = [];
  await page.route('**/functions/v1/**', async (route) => {
    const req = route.request();
    const body = JSON.parse(req.postData() || '{}');
    calls.push({ url: req.url(), body });

    if (req.url().endsWith('/availability')) {
      if (mode === 'events-fail' && body.action === 'events') return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Availability could not be checked.' }) });
      if (mode === 'events-hang'  && body.action === 'events') return new Promise(() => {});
      if (mode === 'night-fail' && body.action === 'availability') return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Availability could not be checked.' }) });
      const payload = body.action === 'events' ? events : night;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) });
    }
    if (req.url().endsWith('/create-checkout')) {
      const r = checkoutReply || { status: 200, body: { checkoutUrl: 'https://checkout.stripe.com/c/pay/test_123' } };
      return route.fulfill({ status: r.status, contentType: 'application/json', body: JSON.stringify(r.body) });
    }
    return route.fulfill({ status: 404, body: '{}' });
  });
  page.on('pageerror', e => { fail++; console.log('  FAIL page error -> ' + e.message); });
  await page.setContent(page_html(), { waitUntil: 'domcontentloaded' });
  return { page, ctx, calls };
}

// ---------------------------------------------------------------- happy path
console.log('\nCalendar loads from the API');
{
  const { page, ctx, calls } = await newPage();
  await page.waitForSelector('#mtxGrid [data-date]', { timeout: 8000 });

  check('one events call on load', calls.filter(c => c.body.action === 'events').length === 1);
  const range = calls[0].body;
  check('range starts today at the venue, not on the guest phone',
        /^\d{4}-\d{2}-\d{2}$/.test(range.from) && range.to > range.from, JSON.stringify(range));

  const btns = await page.$$eval('#mtxMonths button', b => b.map(x => x.textContent.trim()));
  check('month buttons come from the data', JSON.stringify(btns) === '["Sep 2026","Oct 2026"]', JSON.stringify(btns));

  const sel = await page.$eval('#mtxMonths button.mtx-on', b => b.textContent.trim());
  check('first month selected', sel === 'Sep 2026', sel);
  check('month banner names it', (await page.textContent('#mtxMonthNote')) === 'SEPTEMBER 2026');

  const dates = await page.$$eval('#mtxGrid [data-date]', b => b.map(x => x.dataset.date));
  check('only nights with events are clickable',
        JSON.stringify(dates) === '["2026-09-01","2026-09-02","2026-09-05"]', JSON.stringify(dates));

  const first = await page.$eval('#mtxGrid [data-date="2026-09-01"]', b => ({
    tag: b.querySelector('.mtx-tag').textContent, colour: b.style.getPropertyValue('--evt') }));
  check('promotion name and colour come from the data',
        first.tag === 'Knockout' && first.colour.trim() === '#B0342E', JSON.stringify(first));

  // 1 Sept 2026 is a Tuesday: two blanks lead the Monday-first grid.
  const lead = await page.$$eval('#mtxGrid .mtx-none', n => n.length);
  check('grid starts on the right weekday', lead === 1, 'lead=' + lead);

  await page.click('#mtxMonths button:nth-child(2)');
  check('switching month redraws', (await page.textContent('#mtxMonthNote')) === 'OCTOBER 2026');
  const octDates = await page.$$eval('#mtxGrid [data-date]', b => b.map(x => x.dataset.date));
  check('October shows its own night', JSON.stringify(octDates) === '["2026-10-05"]', JSON.stringify(octDates));
  await ctx.close();
}

console.log('\nChoosing a date');
{
  const { page, ctx, calls } = await newPage();
  await page.waitForSelector('#mtxGrid [data-date]');
  await page.click('[data-date="2026-09-05"]');

  check('says it is checking', (await page.textContent('.mtx-load')).includes('Checking live availability'));
  await page.waitForSelector('.mtx-band-h', { timeout: 8000 });
  check('calendar handed the screen over', await page.isHidden('#mtxCal'));
  check('event named', (await page.textContent('.mtx-band-h')) === 'RWS Rajadamnern World Series');

  const when = await page.$$eval('.mtx-band-when span', s => s.map(x => x.textContent.trim()));
  check('full date printed', when[0] === 'Saturday 5 September 2026', when[0]);
  check('start and end in 12-hour', when[1] === '7:10pm – 10pm', when[1]);

  const picks = await page.$$eval('.mtx-pick', b => b.map(x => ({
    name: x.querySelector('.mtx-pick-name').textContent,
    pill: x.querySelector('.mtx-pill').textContent.trim(),
    off: x.classList.contains('mtx-pick--off') })));
  check('all four classes shown, sold out and closed included', picks.length === 4, JSON.stringify(picks));
  check('statuses read correctly',
        picks[0].pill === 'Available' && picks[1].pill === 'Fully booked' &&
        picks[2].pill === 'Limited'   && picks[3].pill === 'Closed', JSON.stringify(picks.map(p => p.pill)));
  check('no price on the four choices', !(await page.textContent('.mtx-picker')).match(/[$£€฿]/));
  await ctx.close();
}

console.log('\nA closed class still explains itself');
{
  const { page, ctx } = await newPage();
  await page.waitForSelector('#mtxGrid [data-date]');
  await page.click('[data-date="2026-09-05"]');
  await page.waitForSelector('.mtx-pick');
  await page.click('[data-pick="third_class"]');
  const note = await page.textContent('.mtx-note');
  check('closed explanation shown', note.includes('usually opened by the stadium'), note);
  check('no purchase controls on a closed class', (await page.$('[data-go]')) === null);
  check('a way back is offered', (await page.$('[data-back-class]')) !== null);
  await ctx.close();
}

console.log('\nFully booked wording');
{
  const { page, ctx } = await newPage();
  await page.waitForSelector('#mtxGrid [data-date]');
  await page.click('[data-date="2026-09-05"]');
  await page.waitForSelector('.mtx-pick');
  await page.click('[data-pick="club_class"]');
  const note = await page.textContent('.mtx-note');
  check('agreed fully-booked copy', note.includes('Club Class is now officially Fully Booked') &&
        note.includes('Change seat class button below'), note);
  await ctx.close();
}

console.log('\nQuantity, currency and totals');
{
  const { page, ctx } = await newPage();
  await page.waitForSelector('#mtxGrid [data-date]');
  await page.click('[data-date="2026-09-05"]');
  await page.waitForSelector('.mtx-pick');
  await page.click('[data-pick="leo_section"]');

  const opts = await page.$$eval('#mtxQty option', o => o.map(x => x.value).filter(Boolean));
  check('quantity capped by what is left', JSON.stringify(opts) === '["1","2","3","4"]', JSON.stringify(opts));

  const curs = await page.$$eval('#mtxCur option', o => o.map(x => x.textContent));
  check('currencies come from the data, in order', JSON.stringify(curs) === '["USD","THB"]', JSON.stringify(curs));

  check('button waits', (await page.textContent('[data-go]')).trim() === 'Select number of tickets');
  check('button disabled until a quantity is chosen', await page.isDisabled('[data-go]'));

  await page.selectOption('#mtxQty', '3');
  check('unit price', (await page.textContent('[data-unit]')) === '$46', await page.textContent('[data-unit]'));
  check('total', (await page.textContent('[data-total]')) === '$138', await page.textContent('[data-total]'));
  check('cta reads Reserve your tickets', (await page.textContent('[data-go]')).trim() === 'Reserve your tickets');
  check('cta enabled', !(await page.isDisabled('[data-go]')));

  await page.selectOption('#mtxCur', 'thb');
  check('switching currency reprices', (await page.textContent('[data-total]')) === '฿4,500', await page.textContent('[data-total]'));
  await ctx.close();
}

console.log('\nSeating warning is enforced before the button unlocks');
{
  const { page, ctx } = await newPage();
  await page.waitForSelector('#mtxGrid [data-date]');
  await page.click('[data-date="2026-09-05"]');
  await page.waitForSelector('.mtx-pick');
  await page.click('[data-pick="ringside"]');
  await page.selectOption('#mtxQty', '2');
  check('no warning when the group fits', (await page.$('[data-ack]')) === null);
  await page.selectOption('#mtxQty', '5');
  check('warning appears above three', (await page.$('[data-ack]')) !== null);
  check('cta blocked', await page.isDisabled('[data-go]'));
  check('cta says what is missing', (await page.textContent('[data-go]')).trim() === 'Confirm seating above');
  await page.check('[data-ack]');
  check('cta unlocks once confirmed', !(await page.isDisabled('[data-go]')));
  await ctx.close();
}

console.log('\nHanding over to Stripe');
{
  const { page, ctx, calls } = await newPage();
  await page.waitForSelector('#mtxGrid [data-date]');
  await page.click('[data-date="2026-09-05"]');
  await page.waitForSelector('.mtx-pick');
  await page.click('[data-pick="leo_section"]');
  await page.selectOption('#mtxQty', '2');
  await page.selectOption('#mtxCur', 'usd');

  // location.assign cannot be shadowed in Chromium, so catch the real
  // navigation instead of pretending to.
  let went = null;
  await page.route('https://checkout.stripe.com/**', async (route) => {
    went = route.request().url();
    await route.fulfill({ status: 200, contentType: 'text/html', body: '<p>stripe</p>' });
  });
  await page.click('[data-go]');
  await page.waitForURL(/checkout\.stripe\.com/, { timeout: 8000 });

  const sent = calls.find(c => c.url.endsWith('/create-checkout') && c.body.action !== 'warm').body;
  check('checkout asked for the right thing',
        sent.eventKey === 'rws_2026_09_05' && sent.classCode === 'leo_section' &&
        sent.quantity === 2 && sent.currency === 'usd' && sent.seatingAcknowledged === false,
        JSON.stringify(sent));
  check('no price sent from the browser', !('unitAmount' in sent) && !('amount' in sent));
  check('redirected to Stripe', went === 'https://checkout.stripe.com/c/pay/test_123', String(went));
  await ctx.close();
}

console.log('\nSurviving the page it is embedded in');
{
  const ctx = await browser.newContext({ viewport: { width: 1180, height: 1000 } });
  const page = await ctx.newPage();
  await page.route('**/functions/v1/**', async (route) => {
    const body = JSON.parse(route.request().postData() || '{}');
    return route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify(body.action === 'events' ? events : night) });
  });
  page.on('pageerror', e => { fail++; console.log('  FAIL page error -> ' + e.message); });
  await page.setContent(hostile_page(), { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#mtxGrid [data-date]', { timeout: 8000 });
  await page.click('[data-date="2026-09-05"]');
  await page.waitForSelector('.mtx-pick', { timeout: 8000 });

  const eventText = await page.$eval('.mtx-band-d', el => getComputedStyle(el).textAlign);
  check('the fight night description reads left', eventText === 'left', eventText);

  await page.click('[data-pick="leo_section"]');
  const chosen = await page.$eval('.mtx-detail-k', el => getComputedStyle(el).textAlign);
  const classDesc = await page.$eval('.mtx-detail-d', el => getComputedStyle(el).textAlign);
  check('"You have chosen" reads left', chosen === 'left', chosen);
  check('the seat class description reads left', classDesc === 'left', classDesc);

  // "You have chosen" must sit on its own line above the class name.
  const stacked = await page.evaluate(() => {
    const k = document.querySelector('.mtx-detail-k').getBoundingClientRect();
    const h = document.querySelector('.mtx-detail-h').getBoundingClientRect();
    return { above: k.bottom <= h.top + 1, aligned: Math.abs(k.left - h.left) < 2 };
  });
  check('it sits above the seat class name', stacked.above);
  check('and lines up with it', stacked.aligned);

  await page.selectOption('#mtxQty', '2');
  const cta = await page.evaluate(() => {
    const b = document.querySelector('[data-go]');
    const s = getComputedStyle(b);
    const parse = (c) => c.match(/\d+/g).slice(0, 3).map(Number);
    const [r, g, bl] = parse(s.color);
    const [br, bg, bb] = parse(s.backgroundColor);
    // Relative luminance, roughly. What matters is that they are not the same.
    const lum = (x) => 0.2126 * x[0] + 0.7152 * x[1] + 0.0722 * x[2];
    return { text: s.color, bg: s.backgroundColor,
             contrast: Math.abs(lum([r, g, bl]) - lum([br, bg, bb])),
             font: s.fontFamily };
  });
  check('the reserve button has readable text on its background',
        cta.contrast > 100, cta.text + ' on ' + cta.bg);
  check('and keeps its own typeface', /Barlow/.test(cta.font), cta.font);

  const day = await page.evaluate(() => {
    document.querySelector('[data-back-date]').click();
    return null;
  });
  await page.waitForSelector('#mtxGrid [data-date]');
  const dayBg = await page.$eval('#mtxGrid [data-date]', el => getComputedStyle(el).backgroundColor);
  check('the host cannot repaint the calendar', dayBg !== 'rgb(255, 0, 255)', dayBg);
  await ctx.close();
}

console.log('\nThe checkout is woken before it is needed');
{
  const { page, ctx, calls } = await newPage();
  await page.waitForSelector('#mtxGrid [data-date]');
  await page.click('[data-date="2026-09-05"]');
  await page.waitForSelector('.mtx-pick');
  check('nothing sent to checkout before a class is picked',
        calls.filter(c => c.url.endsWith('/create-checkout')).length === 0);

  await page.click('[data-pick="leo_section"]');
  await page.waitForFunction(() => true);
  await page.waitForTimeout(300);
  const warm = calls.filter(c => c.url.endsWith('/create-checkout'));
  check('picking a class wakes the checkout', warm.length === 1, JSON.stringify(warm.map(w => w.body)));
  check('the wake-up carries nothing that could book anything',
        warm[0] && warm[0].body.action === 'warm' && !warm[0].body.eventKey && !warm[0].body.quantity,
        JSON.stringify(warm[0] && warm[0].body));

  // Going back and forth must not spray pings at the server.
  await page.click('[data-back-class]');
  await page.click('[data-pick="ringside"]');
  await page.waitForTimeout(300);
  check('it only ever wakes once',
        calls.filter(c => c.url.endsWith('/create-checkout')).length === 1);
  await ctx.close();
}

console.log('\nNo CORS preflight is provoked');
{
  const ctx = await browser.newContext({ viewport: { width: 1180, height: 900 } });
  const page = await ctx.newPage();
  const methods = [];
  await page.route('**/functions/v1/**', async (route) => {
    const req = route.request();
    methods.push(req.method());
    const body = JSON.parse(req.postData() || '{}');
    return route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify(body.action === 'events' ? events : night) });
  });
  page.on('pageerror', e => { fail++; console.log('  FAIL page error -> ' + e.message); });
  await page.setContent(page_html(), { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#mtxGrid [data-date]');
  await page.click('[data-date="2026-09-05"]');
  await page.waitForSelector('.mtx-pick');
  // An OPTIONS here would mean the guest waits for a whole extra round trip,
  // paying a cold boot twice on the first request of the day.
  check('every request goes straight out as a POST',
        methods.length > 0 && methods.every(m => m === 'POST'), methods.join(','));
  await ctx.close();
}

console.log('\nThe last seat going while the guest decides');
{
  const { page, ctx } = await newPage({ checkoutReply: { status: 409, body: { error: 'Only 1 remaining' } } });
  await page.waitForSelector('#mtxGrid [data-date]');
  await page.click('[data-date="2026-09-05"]');
  await page.waitForSelector('.mtx-pick');
  await page.click('[data-pick="leo_section"]');
  await page.selectOption('#mtxQty', '4');
  await page.click('[data-go]');
  await page.waitForSelector('.mtx-fail', { timeout: 8000 });
  check('the real reason is shown, not a generic error',
        (await page.textContent('.mtx-fail')).includes('Only 1 remaining'), await page.textContent('.mtx-fail'));
  // and the night is re-read so the guest is not left looking at stale stock
  await page.waitForSelector('.mtx-load', { timeout: 5000 });
  check('availability is re-checked after a clash', true);
  await ctx.close();
}

console.log('\nWhen the server cannot be reached');
{
  const { page, ctx } = await newPage({ mode: 'events-fail' });
  await page.waitForSelector('.mtx-state', { timeout: 8000 });
  check('the guest is told', (await page.textContent('.mtx-state h3')).includes('could not load'));
  check('and offered another go', (await page.textContent('[data-retry]')).trim() === 'Try again');
  check('calendar stays hidden rather than showing an empty month', await page.isHidden('#mtxCal'));
  await ctx.close();
}

console.log('\nRetry actually works');
{
  const ctx = await browser.newContext({ viewport: { width: 1180, height: 900 } });
  const page = await ctx.newPage();
  let firstTry = true;
  await page.route('**/functions/v1/**', async (route) => {
    const body = JSON.parse(route.request().postData() || '{}');
    if (body.action === 'events' && firstTry) { firstTry = false;
      return route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"boom"}' }); }
    return route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify(body.action === 'events' ? events : night) });
  });
  page.on('pageerror', e => { fail++; console.log('  FAIL page error -> ' + e.message); });
  await page.setContent(page_html(), { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-retry]', { timeout: 8000 });
  await page.click('[data-retry]');
  await page.waitForSelector('#mtxGrid [data-date]', { timeout: 8000 });
  check('second attempt loads the calendar', (await page.$$('#mtxGrid [data-date]')).length === 3);
  await ctx.close();
}

console.log('\nA request that never answers');
{
  const { page, ctx } = await newPage({ mode: 'events-hang' });
  // The widget's own timeout is 12s; give it room and confirm it gives up.
  await page.waitForSelector('.mtx-state', { timeout: 20000 });
  const msg = await page.textContent('.mtx-state p');
  check('times out rather than spinning forever', msg.includes('longer than expected'), msg);
  await ctx.close();
}

await browser.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
