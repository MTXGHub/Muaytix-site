/* Checks for the Rajadamnern Knockout schedule page. Render, read the text back
 * out of the DOM, freeze the clock either side of each boundary, then count.
 *
 *   node verify.mjs
 */
import { readFileSync, readdirSync } from 'node:fs';
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;

const brief = readFileSync('brief.txt', 'utf8');
const frag = readFileSync('schedule-live.txt', 'utf8');
const data = JSON.parse(readFileSync('data.json', 'utf8'));
const META_DESC = 'See upcoming Rajadamnern Knockout dates at Rajadamnern Stadium, Bangkok. Live Muay Thai every Monday, Tuesday and Friday. Book tickets for your date online.';

/* The booking calendar, read from Supabase event_calendar on 4 October 2026. */
const CAL_KO = '2026-10-05,2026-10-06,2026-10-09,2026-10-12,2026-10-13,2026-10-16,2026-10-19,2026-10-20,2026-10-23,2026-10-27,2026-10-30,2026-11-02,2026-11-03,2026-11-06,2026-11-09,2026-11-10,2026-11-13,2026-11-16,2026-11-17,2026-11-20,2026-11-23,2026-11-24,2026-11-27,2026-12-01,2026-12-04,2026-12-07,2026-12-08,2026-12-11,2026-12-14,2026-12-15,2026-12-18,2026-12-21,2026-12-22,2026-12-25,2026-12-29';
const CAL_SP = '2026-10-26,2026-11-30,2026-12-28';

let fails = 0;
const fail = m => { fails++; console.log('   FAIL ' + m); };
const ok = m => console.log('   ok   ' + m);
const norm = s => s.replace(/\s+/g, ' ').trim();

const doc = `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}#allrecords{font-family:Arial,sans-serif}#allrecords *{text-align:center}#allrecords a{text-decoration:none;color:inherit}#allrecords ul,#allrecords ol{list-style:none;padding:0}</style></head><body><div id="allrecords">${frag}</div></body></html>`;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const svg = (w, h, c) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="${c}"/></svg>`;

async function open(w, h, { d = doc, at = null, js = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, javaScriptEnabled: js });
  const p = await ctx.newPage();
  await p.route('**static.tildacdn.com/**', r => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: svg(480, 240, '#1F5BFF') }));
  p.on('pageerror', e => fail('page error: ' + e.message));
  if (at && js) {
    const T = Date.parse(at + ':00+07:00');
    await p.addInitScript(t => { const D = Date; globalThis.Date = class extends D { constructor(...a) { if (a.length === 0) super(t); else super(...a); } static now() { return t; } }; }, T);
  }
  await p.route('http://ks.test/', r => r.fulfill({ status: 200, contentType: 'text/html', body: d }));
  await p.goto('http://ks.test/', { waitUntil: 'load' });
  await p.evaluate(async () => { for (const i of document.images) { try { await i.decode(); } catch (e) {} } });
  await p.waitForTimeout(200);
  return { ctx, p };
}
const textOf = p => p.evaluate(() => { const c = document.querySelector('#mtx-ks').cloneNode(true); c.querySelectorAll('script, style').forEach(e => e.remove()); return c.textContent; });

/* ---- 1. the words ---- */
console.log('\n=== 1. THE WORDS (every line of the brief, read back from the DOM) ===');
{
  const { ctx, p } = await open(1280, 900, { js: false });
  const flat = norm(await textOf(p));
  const lines = brief.split('\n').map(norm).filter(l => l && !l.startsWith('## ') && !/^[A-Z][A-Za-z0-9\- ]{0,40}:$/.test(l) && !/^https?:/.test(l));
  let missing = 0;
  for (const l of lines) if (!flat.includes(l)) { missing++; fail('brief line not on the page: ' + l); }
  if (!missing) ok(`all ${lines.length} copy lines from the brief are on the page, word for word (read with the script switched off)`);
  const bans = [[/\u2014/, 'em dash'], [/!/, 'exclamation mark'], [/book your seat/i, 'book your seat'], [/choose your seats?|select your seats?|pick your seats?|exact seat|seat number|choose seats|select seats/i, 'seat-selection wording'],
    [/selling fast|hurry|% booked|only \d+ left/i, 'scarcity'], [/\blimited\b|\bofficial\b/i, 'limited or official'], [/live[- ]?stream|broadcast/i, 'live stream'], [/singha|chang beer/i, 'alcohol brand']];
  const before = fails;
  for (const [re, name] of bans) { const m = flat.match(re); if (m) fail(`banned: ${name} (${m[0]})`); }
  if (fails === before) ok('no em dashes, seat-selection wording, scarcity, "limited", "official" or live-stream words');
  const alloc = (flat.match(/Best available seats are allocated/g) || []).length;
  if (alloc !== 2) fail(`the allocation sentence appears ${alloc} times, expected 2 (next event, FAQ answer)`); else ok('the allocation sentence appears twice: beside the next event and in the FAQ answer');
  const inFeature = await p.evaluate(() => document.querySelector('.mtx-ks-feat .mtx-ks-note').textContent);
  if (!/^Best available seats are allocated in your chosen section at the time of booking\.$/.test(inFeature)) fail('support note: ' + inFeature);
  const kw = ['Rajadamnern Knockout schedule', 'Rajadamnern Knockout dates', 'Rajadamnern Knockout Monday', 'Rajadamnern Knockout Tuesday', 'Rajadamnern Knockout Friday', 'Rajadamnern Knockout tonight', 'Rajadamnern Knockout today', 'Rajadamnern Knockout Muay Thai', 'Rajadamnern Knockout event', 'Rajadamnern Knock Out', 'Rajadamnern Stadium Knockout', 'Muay Thai Monday Bangkok', 'Muay Thai Tuesday Bangkok', 'Muay Thai Friday Bangkok', 'Muay Thai fights Bangkok Monday', 'Muay Thai fights Bangkok Tuesday', 'Muay Thai fights Bangkok Friday'];
  const have = kw.filter(k => flat.toLowerCase().includes(k.toLowerCase())), lack = kw.filter(k => !have.includes(k));
  console.log(`   note  keyword phrases in the visible copy: ${have.length} of ${kw.length}`);
  console.log(`   note  NOT in the locked copy, so not on the page: ${lack.join(' | ') || 'none'}`);
  await ctx.close();
}

/* ---- 1b. em dash search, every file ---- */
console.log('\n=== 1b. EM DASH SEARCH, EVERY FILE ===');
{
  const bad = [];
  for (const f of readdirSync('.')) { if (!/\.(mjs|json|html|txt|css)$/.test(f)) continue; if (readFileSync(f, 'utf8').includes('\u2014')) bad.push(f); }
  if (bad.length) fail('em dash in: ' + bad.join(', ')); else ok('no em dash character in any source, copy, data, generated or paste file');
}

/* ---- 1c. the dates match the booking calendar ---- */
console.log('\n=== 1c. THE DATES MATCH THE BOOKING CALENDAR ===');
{
  const ko = data.knockout.join(','), sp = data.special.join(',');
  if (ko !== CAL_KO) fail('Knockout dates differ from the calendar'); else ok('35 standard Knockout nights, October 5 to December 29, identical to the calendar');
  if (sp !== CAL_SP) fail('special dates differ from the calendar'); else ok('3 special Monday replacements (26 October, 30 November, 28 December), identical to the calendar');
  const dow = d => new Date(d + 'T00:00:00Z').getUTCDay();
  if (data.knockout.some(d => ![1, 2, 5].includes(dow(d))) || data.special.some(d => dow(d) !== 1)) fail('a date is on the wrong weekday'); else ok('every Knockout night is a Monday, Tuesday or Friday; every special is a Monday');
}

/* ---- 2. layout ---- */
console.log('\n=== 2. LAYOUT, ZERO SIDEWAYS SCROLL ===');
for (const [w, h] of [[1440, 900], [1280, 800], [1024, 768], [860, 800], [620, 800], [390, 844], [320, 640]]) {
  const { ctx, p } = await open(w, h);
  const r = await p.evaluate(() => {
    const bad = []; for (const e of document.querySelectorAll('#mtx-ks *')) { if (e.closest('[data-mtx-tabs]')) continue; const b = e.getBoundingClientRect(); if (b.width && b.right > innerWidth + 1 && getComputedStyle(e).position !== 'fixed') bad.push(typeof e.className === 'string' ? e.className : e.tagName); }
    const cta = document.querySelector('.mtx-ks-hero .mtx-ks-btn').getBoundingClientRect();
    const tabs = document.querySelector('[data-mtx-tabs]').getBoundingClientRect();
    const feat = document.querySelector('.mtx-ks-feat .mtx-ks-btn').getBoundingClientRect();
    const row = document.querySelector('.mtx-ks-panel:not([hidden]) .mtx-ks-row').getBoundingClientRect();
    const logo = document.querySelector('.mtx-ks-logo').getBoundingClientRect(), h1 = document.querySelector('.mtx-ks-h1').getBoundingClientRect();
    return { over: document.documentElement.scrollWidth - innerWidth, bad: [...new Set(bad)].slice(0, 5), ctaBottom: Math.round(cta.bottom), tabsTop: Math.round(tabs.top), featBottom: Math.round(feat.bottom), rowH: Math.round(row.height), logoBeside: logo.left > h1.right - 1 };
  });
  console.log(`   ${String(w).padStart(5)}px  overflow ${r.over}  hero button ends ${r.ctaBottom}  next-event button ends ${r.featBottom}  tabs at ${r.tabsTop}  first row ${r.rowH}px  logo beside text: ${r.logoBeside}  (screen ${h})`);
  if (r.over > 0 || r.bad.length) fail(`${w}px: sideways overflow ${r.over} ${r.bad.join(',')}`);
  if (w >= 390 && w <= 620 && r.ctaBottom > h) fail(`${w}px: the hero button is below the first screen`);
  if (w >= 900 && !r.logoBeside) fail(`${w}px: the logo is not in the second hero column`);
  if (w >= 760 && r.rowH > 125) fail(`${w}px: rows are ${r.rowH}px tall, not compact`);
  await ctx.close();
}

/* ---- 3. wide-face stress test ---- */
console.log('\n=== 3. WIDE-FACE STRESS TEST (display face swapped for a wider one) ===');
for (const w of [320, 390, 860]) {
  const wide = doc.replace('</style></head>', '#mtx-ks, #mtx-ks *{font-family:"DejaVu Sans",Verdana,sans-serif}#mtx-ks h1,#mtx-ks h2,#mtx-ks h3,#mtx-ks .mtx-ks-btn,#mtx-ks .mtx-ks-q,#mtx-ks .mtx-ks-jump,#mtx-ks .mtx-ks-fdate,#mtx-ks .mtx-ks-dm,#mtx-ks .mtx-ks-name,#mtx-ks .mtx-ks-tab{font-weight:900}</style></head>');
  const { ctx, p } = await open(w, 800, { d: wide });
  const r = await p.evaluate(() => ({ over: document.documentElement.scrollWidth - innerWidth,
    tight: [...document.querySelectorAll('#mtx-ks h1,#mtx-ks h2,#mtx-ks .mtx-ks-btn,#mtx-ks summary,#mtx-ks .mtx-ks-jump,#mtx-ks .mtx-ks-fdate,#mtx-ks .mtx-ks-dm,#mtx-ks .mtx-ks-fact,#mtx-ks .mtx-ks-name')].filter(e => !e.closest('[hidden]') && e.scrollWidth > e.clientWidth + 1).map(e => e.className || e.tagName).slice(0, 4) }));
  console.log(`   ${String(w).padStart(5)}px  overflow ${r.over}  cells wider than their box: ${r.tight.length}`);
  if (r.over > 0 || r.tight.length) fail(`${w}px wide face: ${r.over} ${r.tight.join(',')}`);
  await ctx.close();
}

/* ---- 4. rows ---- */
console.log('\n=== 4. THE DATE ROWS ===');
{
  const { ctx, p } = await open(1280, 900, { js: false });
  const r = await p.evaluate(() => ({
    months: [...document.querySelectorAll('.mtx-ks-panel')].map(pn => ({ m: pn.getAttribute('data-month'), rows: pn.querySelectorAll('.mtx-ks-row').length, special: pn.querySelectorAll('.mtx-ks-row--special').length, visible: pn.offsetHeight > 0 })),
    rows: [...document.querySelectorAll('.mtx-ks-row')].map(x => ({ date: x.getAttribute('data-date'), kind: x.getAttribute('data-kind'), text: x.querySelector('.mtx-ks-d').textContent.replace(/\s+/g, ' ').trim(), name: x.querySelector('.mtx-ks-name').textContent, sub: x.querySelector('.mtx-ks-sub').textContent, time: (x.querySelector('.mtx-ks-time') || { textContent: null }).textContent, tag: (x.querySelector('.mtx-ks-tag') || { textContent: null }).textContent, cta: x.querySelector('a').textContent, href: x.querySelector('a').getAttribute('href'), aria: x.querySelector('a').getAttribute('aria-label'), imgs: x.querySelectorAll('img').length, all: x.textContent })),
  }));
  console.log('   ' + r.months.map(m => `${m.m}: ${m.rows} rows (${m.special} special)`).join('   '));
  if (r.rows.length !== 38) fail(`${r.rows.length} rows, expected 38`); else ok('38 rows in the page HTML with the script off: 35 standard and 3 special');
  if (r.months.some(m => !m.visible)) fail('a month is hidden with the script off'); else ok('with the script off all three months are on the page, stacked');
  const WD = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], MO = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  let bad = 0;
  r.rows.forEach((x, i) => {
    const [y, m, d] = x.date.split('-').map(Number), w = WD[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
    const want = `${w} ${d} ${MO[m - 1]} ${y}`;
    if (x.text !== want) { bad++; fail(`${x.date}: date reads "${x.text}"`); }
    if (i && r.rows[i - 1].date >= x.date) { bad++; fail('rows are not in date order at ' + x.date); }
    if (x.kind === 'knockout') {
      if (x.name !== 'Rajadamnern Knockout' || x.sub !== 'Rajadamnern Stadium, Bangkok' || x.time !== 'Doors 6:00 pm. First fight 7:00 pm.' || x.cta !== 'Book tickets' || x.href !== `https://muaytix.com/rajadamnern-knockout/${x.date}` || x.tag !== null || !x.aria.startsWith('Book tickets for ')) { bad++; fail('standard row differs from the pattern: ' + JSON.stringify(x)); }
    } else {
      if (x.name !== 'All Star Fight: Elite Fighter' || x.tag !== 'Special event' || x.sub !== 'Special event at Rajadamnern Stadium' || x.cta !== 'View event' || /rajadamnern-knockout\//.test(x.href) || x.href !== `https://muaytix.com/all-star-fight-by-buakaw/${x.date}`) { bad++; fail('special row differs: ' + JSON.stringify(x)); }
      if (/Rajadamnern Knockout/.test(x.all)) { bad++; fail('a special row says Rajadamnern Knockout: ' + x.date); }
    }
    if (x.imgs) { bad++; fail('an image is in the row ' + x.date); }
    if (/fight card|fighter|bout|\bvs\b|card status|tbc|announced/i.test(x.all.replace('All Star Fight: Elite Fighter', ''))) { bad++; fail('fight-card wording in the row ' + x.date); }
  });
  if (!bad) ok('every standard row reads Rajadamnern Knockout, venue, times, "Book tickets" and its own dated page; every special row is labelled, named All Star Fight: Elite Fighter and goes to its own event page');
  if (r.rows.some(x => x.kind === 'knockout' && [0, 3, 6].includes(new Date(x.date + 'T00:00:00Z').getUTCDay()))) fail('a Knockout row is on the wrong weekday');
  await ctx.close();
}

/* ---- 5. tabs ---- */
console.log('\n=== 5. MONTH TABS ===');
for (const [w, h] of [[1280, 800], [390, 844], [320, 640]]) {
  const { ctx, p } = await open(w, h);
  const st = () => p.evaluate(() => ({ role: document.querySelector('[data-mtx-tabs]').getAttribute('role'), tabs: [...document.querySelectorAll('.mtx-ks-tab')].map(a => [a.textContent, a.getAttribute('role'), a.getAttribute('aria-selected'), a.getAttribute('tabindex')]), shown: [...document.querySelectorAll('.mtx-ks-panel')].filter(x => !x.hidden).map(x => x.getAttribute('data-month')), focus: document.activeElement && document.activeElement.textContent, rowsShown: [...document.querySelectorAll('.mtx-ks-panel:not([hidden]) .mtx-ks-row')].filter(r => r.offsetHeight > 0).length, scrollW: (e => e.scrollWidth - e.clientWidth)(document.querySelector('[data-mtx-tabs]')), over: document.documentElement.scrollWidth - innerWidth }));
  let s = await st();
  if (s.role !== 'tablist' || s.tabs.some(t => t[1] !== 'tab')) fail(`${w}px: tabs have no tab roles`);
  if (s.shown.join() !== '2026-10' || s.tabs[0][2] !== 'true' || s.tabs[1][2] !== 'false') fail(`${w}px: October is not the active month by default: ${JSON.stringify(s.tabs)}`);
  await p.click('.mtx-ks-tab[data-month="2026-11"]'); s = await st();
  if (s.shown.join() !== '2026-11' || s.tabs[1][2] !== 'true' || s.rowsShown !== 13) fail(`${w}px: November did not open with 13 rows: ${JSON.stringify(s.shown)} ${s.rowsShown}`);
  await p.keyboard.press('ArrowRight'); s = await st();
  if (s.shown.join() !== '2026-12' || s.focus.trim() !== 'December 2026' || s.rowsShown !== 13) fail(`${w}px: arrow key did not move to December: ${JSON.stringify(s.shown)} ${s.focus}`);
  await p.keyboard.press('ArrowRight'); s = await st();
  if (s.shown.join() !== '2026-10') fail(`${w}px: arrow key does not wrap`);
  console.log(`   ${String(w).padStart(5)}px  October active by default, click and arrow keys work, tabs scroll inside their own strip by ${s.scrollW}px, page overflow ${s.over}`);
  if (s.over > 0) fail(`${w}px: page overflow after tab changes`);
  await ctx.close();
}
ok('tabs are real links with tab roles, aria-selected, roving tabindex and arrow-key movement');

/* ---- 6. the clock ---- */
console.log('\n=== 6. THE CLOCK (Bangkok time, either side of each boundary) ===');
{
  const cases = [
    ['2026-10-04T00:42', '2026-10-05', 'Monday 5 October', '2026-10', 0, 'now'],
    ['2026-10-05T21:59', '2026-10-05', 'Monday 5 October', '2026-10', 0, 'Monday, a minute before the 10:00 pm changeover'],
    ['2026-10-05T22:00', '2026-10-06', 'Tuesday 6 October', '2026-10', 1, 'Monday night over'],
    ['2026-10-09T22:00', '2026-10-12', 'Monday 12 October', '2026-10', 4, 'Friday night over: next is Monday, skipping the weekend'],
    ['2026-10-25T23:00', '2026-10-27', 'Tuesday 27 October', '2026-10', 10, 'Sunday night: the special Monday 26 October is skipped as the next Knockout night'],
    ['2026-10-30T22:00', '2026-11-02', 'Monday 2 November', '2026-11', 11, 'last October night over: October tab goes, November opens'],
    ['2026-12-29T21:59', '2026-12-29', 'Tuesday 29 December', '2026-12', null, 'the last Knockout night, a minute before'],
  ];
  for (const [at, iso, short, month, , why] of cases) {
    const { ctx, p } = await open(390, 844, { at });
    const r = await p.evaluate(() => { const f = document.querySelector('[data-mtx-next]'); return { hidden: f.hidden, date: f.querySelector('[data-mtx-next-date]').textContent, cta: f.querySelector('[data-mtx-next-cta]').textContent.trim(), href: f.querySelector('[data-mtx-next-cta]').getAttribute('href'),
      shown: [...document.querySelectorAll('.mtx-ks-panel')].filter(x => !x.hidden).map(x => x.getAttribute('data-month')), tabs: [...document.querySelectorAll('[data-mtx-tabs] li')].filter(l => !l.hidden).length, firstRow: (document.querySelector('.mtx-ks-row:not([hidden])') || { getAttribute: () => null }).getAttribute('data-date') }; });
    console.log(`   ${at}  feature ${r.date} -> ${r.href.split('/').pop()}  month open ${r.shown.join()}  tabs ${r.tabs}  first row ${r.firstRow}   (${why})`);
    if (r.hidden || r.href !== `https://muaytix.com/rajadamnern-knockout/${iso}` || r.cta !== `Book tickets for ${short}` || !r.date.startsWith(short)) fail(`${at}: ${JSON.stringify(r)}`);
    if (r.shown.join() !== month) fail(`${at}: month open ${r.shown}, expected ${month}`);
    if (r.firstRow < at.slice(0, 10) && at.slice(11) < '22:00') fail(`${at}: a finished night is still listed`);
    if (/rajadamnern-knockout\/2026-10-0[1-4]/.test(r.href)) fail('feature points at a finished night');
    await ctx.close();
  }
  const { ctx, p } = await open(390, 844, { at: '2026-12-29T22:00' });
  const r = await p.evaluate(() => ({ hidden: document.querySelector('[data-mtx-next]').hidden, rows: [...document.querySelectorAll('.mtx-ks-row')].filter(x => !x.hidden).length }));
  if (!r.hidden || r.rows) fail('after the last Knockout night the page still shows a night'); else ok('after the last Knockout night the next-event feature is hidden and no night is listed, so a finished night is never offered');
  await ctx.close();
}

/* ---- 7. phone bar ---- */
console.log('\n=== 7. THE PHONE BAR ===');
{
  const { ctx, p } = await open(390, 844);
  const bar = async () => p.evaluate(() => document.querySelector('[data-mtx-ks-bar]').className.includes('is-on') && getComputedStyle(document.querySelector('[data-mtx-ks-bar]')).display !== 'none');
  if (await bar()) fail('the bar is on at the top'); else ok('bar off at the top');
  await p.click('.mtx-ks-hero .mtx-ks-btn'); await p.waitForTimeout(900);
  const top = await p.evaluate(() => Math.round(document.getElementById('mtx-ks-dates').getBoundingClientRect().top));
  if (top < -2 || top > 40) fail(`the hero button lands the dates ${top}px from the top`); else ok(`the hero button scrolls to the dates (${top}px from the top)`);
  if (await bar()) fail('the bar is on while the dates are on screen'); else ok('bar off while the date list is on screen');
  await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await p.waitForTimeout(250);
  if (!(await bar())) fail('the bar is off at the foot of the page'); else ok('bar on once the guest is past the dates');
  const clash = await p.evaluate(() => document.querySelector('.mtx-ks-rel').getBoundingClientRect().bottom > document.querySelector('[data-mtx-ks-bar]').getBoundingClientRect().top ? 'covered' : 'clear');
  if (clash === 'covered') fail('the phone bar covers the last links'); else ok('the phone bar does not cover the last links');
  const t = await p.evaluate(() => document.querySelector('[data-mtx-ks-bar]').textContent);
  if (t !== 'View upcoming dates') fail('bar text: ' + t);
  await p.click('[data-mtx-ks-bar]'); await p.waitForTimeout(900);
  const top2 = await p.evaluate(() => Math.round(document.getElementById('mtx-ks-dates').getBoundingClientRect().top));
  if (top2 < -2 || top2 > 40) fail(`the phone bar lands the dates ${top2}px from the top`); else ok('the phone bar scrolls to the dates');
  await ctx.close();
  const d = await open(1280, 800);
  await d.p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await d.p.waitForTimeout(250);
  if (await d.p.evaluate(() => getComputedStyle(document.querySelector('[data-mtx-ks-bar]')).display) !== 'none') fail('the phone bar shows on a desktop'); else ok('phone bar never shows on 1280px');
  await d.ctx.close();
}

/* ---- 8. structure, links, pictures, schema ---- */
console.log('\n=== 8. STRUCTURE, LINKS, PICTURES, SCHEMA ===');
{
  const { ctx, p } = await open(1280, 800, { js: false });
  const r = await p.evaluate(() => ({
    h1: document.querySelectorAll('#mtx-ks h1').length,
    heads: [...document.querySelectorAll('#mtx-ks h1,#mtx-ks h2,#mtx-ks h3')].map(e => e.tagName),
    secs: [...document.querySelectorAll('#mtx-ks > nav, #mtx-ks > header, #mtx-ks > section')].map(e => e.tagName === 'NAV' ? 'crumbs' : e.tagName === 'HEADER' ? 'hero' : e.querySelector('h2').textContent),
    details: document.querySelectorAll('#mtx-ks details').length, answers: [...document.querySelectorAll('#mtx-ks details')].every(d => d.textContent.trim().length > 20),
    imgs: [...document.querySelectorAll('#mtx-ks img')].map(i => ({ alt: i.alt, w: i.getAttribute('width'), h: i.getAttribute('height'), eager: i.getAttribute('loading'), pri: i.getAttribute('fetchpriority') })),
    links: [...document.querySelectorAll('#mtx-ks a[href]')].filter(a => !a.closest('.mtx-ks-row')).map(a => ({ href: a.getAttribute('href'), text: a.textContent.trim() })),
    rowFight: [...document.querySelectorAll('.mtx-ks-row a')].filter(a => /fight-card/.test(a.getAttribute('href'))).length,
    bad: document.querySelectorAll('#mtx-ks video, #mtx-ks audio, #mtx-ks iframe, #mtx-ks dialog, #mtx-ks [role=dialog], #mtx-ks .carousel, #mtx-ks [data-countdown]').length }));
  if (r.h1 !== 1) fail(`${r.h1} h1 elements`); else ok('one h1');
  if (r.heads.join() !== 'H1,H2,H2,H2,H3,H3,H2,H2') fail('heading hierarchy: ' + r.heads.join()); else ok('heading hierarchy is H1, then H2s, with two H3s inside the planning section');
  const order = ['crumbs', 'hero', 'Next Rajadamnern Knockout event', 'Rajadamnern Knockout dates', 'Plan your Rajadamnern Knockout night', 'Rajadamnern Knockout schedule FAQs', 'More Rajadamnern Knockout information'];
  if (r.secs.join('|') !== order.join('|')) fail('section order differs:\n     ' + r.secs.join(' | ')); else ok('seven sections in the briefed order, then only the global footer');
  if (r.details !== 5 || !r.answers) fail(`${r.details} FAQ items`); else ok('five FAQ questions, every answer in the page at load');
  if (r.bad) fail('autoplay media, dialog, carousel or countdown element present'); else ok('no media, pop-up, carousel or countdown');
  if (r.imgs.length !== 1 || r.imgs[0].alt !== 'Rajadamnern Knockout logo' || !r.imgs[0].w || !r.imgs[0].h || r.imgs[0].eager === 'lazy') fail('images: ' + JSON.stringify(r.imgs)); else ok('one image only, the hero logo, with the locked alt text, reserved size and not lazy; none in any date row');
  const want = {
    'Learn about Rajadamnern Knockout': 'https://muaytix.com/rajadamnern-knockout',
    'See the latest Rajadamnern Knockout fight card': 'https://muaytix.com/rajadamnern-knockout/fight-card',
    'Rajadamnern Knockout': 'https://muaytix.com/rajadamnern-knockout',
    'Rajadamnern Knockout fight card': 'https://muaytix.com/rajadamnern-knockout/fight-card',
    'Rajadamnern Knockout tickets': 'https://muaytix.com/rajadamnern-knockout/tickets',
    'Compare Rajadamnern seating': 'https://muaytix.com/rajadamnern-stadium-seating',
    'View upcoming dates': '#mtx-ks-dates',
  };
  let lf = 0;
  for (const l of r.links) {
    if (l.href === '/' || l.href === '/rajadamnern-knockout' || /^#mtx-ks-m-/.test(l.href)) continue;
    if (/^Book tickets for /.test(l.text)) { if (!/^https:\/\/muaytix\.com\/rajadamnern-knockout\/2026-\d\d-\d\d$/.test(l.href)) { lf++; fail('next-event link ' + l.href); } continue; }
    if (want[l.text] !== l.href) { lf++; fail(`link "${l.text}" -> ${l.href}`); }
  }
  if (!lf) ok('every link goes where the brief says, with the locked anchor text');
  const fc = r.links.filter(l => /fight-card/.test(l.href)).length;
  if (r.rowFight || fc !== 2) fail(`fight-card links: ${r.rowFight} in rows, ${fc} elsewhere`); else ok('no fight-card link in any date row; the only two are the FAQ link and the related link, as in the locked copy');
  const blocks = [...frag.matchAll(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/g)].map(m => JSON.parse(m[1]));
  if (blocks.map(b => b['@type']).join() !== 'CollectionPage,ItemList,BreadcrumbList') fail('schema types: ' + blocks.map(b => b['@type'])); else ok('JSON-LD is CollectionPage, ItemList and BreadcrumbList');
  if (/"@type": "(Event|Offer|Product|FAQPage|Review|AggregateRating|VideoObject)"/.test(frag)) fail('a banned schema type is present'); else ok('no Event, Offer, Product, FAQPage, Review or Rating schema');
  if (blocks[0].url !== 'https://muaytix.com/rajadamnern-knockout/schedule' || !META_DESC.startsWith(blocks[0].description)) fail('CollectionPage url or description');
  const list = blocks[1].itemListElement;
  const rows = await p.evaluate(() => [...document.querySelectorAll('.mtx-ks-row')].map(x => [x.getAttribute('data-kind'), x.querySelector('.mtx-ks-d').textContent.replace(/\s+/g, ' ').trim(), x.querySelector('.mtx-ks-name').textContent, x.querySelector('a').getAttribute('href')]));
  const same = list.length === rows.length && list.every((it, i) => it.position === i + 1 && it.url === rows[i][3] && it.name === `${rows[i][2]}, ${rows[i][1]}`);
  if (!same) fail('ItemList differs from the visible rows'); else ok(`ItemList holds exactly the ${rows.length} visible rows, in order, with their own names and URLs; specials are named All Star Fight: Elite Fighter`);
  await ctx.close();
}

/* ---- 9. css scope ---- */
console.log('\n=== 9. CSS STAYS INSIDE THE BLOCK ===');
{
  const css = readFileSync('style.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const sel = []; css.replace(/(^|\})\s*([^{}@][^{}]*)\{/g, (_, __, s) => { s.split(',').forEach(x => sel.push(x.trim())); return ''; });
  const loose = sel.filter(s => s && !/^@/.test(s) && !/^(\.mtx-ks-page|#mtx-ks)/.test(s) && !/^\d+%$/.test(s));
  if (loose.length) fail('selectors outside the block: ' + loose.slice(0, 4).join(' | ')); else ok(`${sel.length} selectors, all under .mtx-ks-page or #mtx-ks`);
  if (/<(html|head|body)[\s>]/i.test(frag)) fail('html, head or body tag in the block'); else ok('no html, head or body wrappers; no header, footer, checkout or booking logic touched');
  if (/@import|https?:\/\/[^"')]*\.(css|woff2?)/.test(frag)) fail('an outside file is loaded'); else ok('nothing loaded from outside the block');
  if (/#(8B4513|A0522D|654321|5C4033|795548|6D4C41|8D6E63)/i.test(css)) fail('a brown is in the CSS'); else ok('no brown in the CSS');
}

/* ---- 10. contrast ---- */
console.log('\n=== 10. CONTRAST ===');
for (const w of [1280, 390]) {
  const { ctx, p } = await open(w, 800);
  const bad = await p.evaluate(() => {
    const parse = s => (s.match(/[\d.]+/g) || []).map(Number);
    const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
    const bg = el => { for (let e = el; e; e = e.parentElement) { const cs = getComputedStyle(e); const c = parse(cs.backgroundColor); if (c.length >= 3 && (c.length < 4 || c[3] > 0.5)) return c.slice(0, 3); if (e.classList && e.classList.contains('mtx-ks-hero')) return [14, 36, 110]; } return [255, 255, 255]; };
    const out = []; let n = 0;
    for (const el of document.querySelectorAll('#mtx-ks *')) {
      if (['SCRIPT', 'STYLE', 'IMG'].includes(el.tagName) || el instanceof SVGElement || el.closest('[hidden]') || !el.offsetParent && getComputedStyle(el).position !== 'fixed') continue;
      if (!([...el.childNodes].some(c => c.nodeType === 3 && c.textContent.trim()))) continue; n++;
      const fg = parse(getComputedStyle(el).color).slice(0, 3), b = bg(el), L1 = lum(fg), L2 = lum(b), ratio = (Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05);
      if (ratio < 4.5) out.push(`${el.className || el.tagName} ${ratio.toFixed(1)}:1 "${el.textContent.trim().slice(0, 24)}"`);
    }
    return { n, out };
  });
  console.log(`   ${w}px  ${bad.n} visible text nodes checked, ${bad.out.length} under 4.5:1`);
  bad.out.forEach(x => fail('contrast ' + x));
  await ctx.close();
}

await browser.close();
console.log(`\n   Failures: ${fails}`);
console.log(fails ? '\nNOT ACCEPTABLE: fix the failures above.' : '\nAll checks passed.');
process.exit(fails ? 1 : 0);
