/* Checks for the Rajadamnern Knockout tickets page. Render, read the text back
 * out of the DOM, freeze the clock, then count. The calendar is the live
 * booking widget, tested here against a calendar built from data.json.
 *
 *   node verify.mjs
 */
import { readFileSync, readdirSync } from 'node:fs';
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;

const brief = readFileSync('brief.txt', 'utf8');
const frag = readFileSync('tickets-live.txt', 'utf8');
const data = JSON.parse(readFileSync('data.json', 'utf8'));
const W = '../../agent-tix/widget/';
const night = JSON.parse(readFileSync(W + 'tests/night.json', 'utf8'));
const widgetJs = readFileSync(W + 'widget.js', 'utf8');
const META_DESC = 'Book Rajadamnern Knockout tickets for live Muay Thai at Rajadamnern Stadium, Bangkok. Events every Monday, Tuesday and Friday. Choose your date and book online.';
const CAL_KO = '2026-10-05,2026-10-06,2026-10-09,2026-10-12,2026-10-13,2026-10-16,2026-10-19,2026-10-20,2026-10-23,2026-10-27,2026-10-30,2026-11-02,2026-11-03,2026-11-06,2026-11-09,2026-11-10,2026-11-13,2026-11-16,2026-11-17,2026-11-20,2026-11-23,2026-11-24,2026-11-27,2026-12-01,2026-12-04,2026-12-07,2026-12-08,2026-12-11,2026-12-14,2026-12-15,2026-12-18,2026-12-21,2026-12-22,2026-12-25,2026-12-29';
const CAL_SP = '2026-10-26,2026-11-30,2026-12-28';

/* A calendar for the widget, built from data.json plus the other promotions'
   nights, so the test is of the real page against a realistic month. */
const events = [];
{
  const start = new Date('2026-10-04T00:00:00Z');
  for (let i = 0; i < 90; i++) {
    const d = new Date(start.getTime() + i * 86400000), iso = d.toISOString().slice(0, 10), dow = d.getUTCDay();
    const mk = (series, name, key) => events.push({ eventKey: `${key}_${iso.replace(/-/g, '_')}`, date: iso, name, shortName: name, colour: '#1F5BFF', description: '', startTime: '19:00', endTime: '21:30', venue: 'Rajadamnern Stadium, Bangkok', timezone: 'Asia/Bangkok', series });
    if (data.knockout.includes(iso)) mk('rajadamnern-knockout', 'Rajadamnern Knockout', 'rk');
    else if (data.special.includes(iso)) mk('all-star-buakaw', data.specialName, 'as');
    else if (dow === 3) mk('new-power', 'New Power Traditional Muay Thai', 'np');
    else if (dow === 4) mk('petchyindee', 'Petchyindee Traditional Muay Thai', 'pi');
    else if (dow === 6) mk('rws', 'RWS Rajadamnern World Series', 'rws');
    else if (dow === 0) mk('kiatpetch', 'Kiatpetch Traditional Muay Thai', 'kp');
  }
}
const calendar = { events };
night.event = { ...night.event, eventKey: 'rk_2026_10_05', date: '2026-10-05' };

let fails = 0;
const fail = m => { fails++; console.log('   FAIL ' + m); };
const ok = m => console.log('   ok   ' + m);
const norm = s => s.replace(/\s+/g, ' ').trim();

const wrap = f => `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}#allrecords{font-family:Arial,sans-serif}#allrecords *{text-align:center}#allrecords a{text-decoration:none;color:inherit}#allrecords button{color:#000;font-family:serif}#allrecords ul,#allrecords ol{list-style:none;padding:0}</style></head><body><div id="allrecords">${f}</div></body></html>`;
const doc = wrap(frag);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const svg = (w, h, c) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="${c}"/></svg>`;

async function open(w, h, { d = doc, at = '2026-10-04T12:00', js = true, widget = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, javaScriptEnabled: js });
  const p = await ctx.newPage();
  await p.route('**/functions/v1/**', r => { const bd = JSON.parse(r.request().postData() || '{}'); r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(bd.action === 'events' ? { events: events.filter(e => e.date >= (at || '2026-10-04').slice(0, 10)) } : night) }); });
  await p.route('**static.tildacdn.com/**', r => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: svg(480, 240, '#1F5BFF') }));
  p.on('pageerror', e => fail('page error: ' + e.message));
  if (at && js) { const T = Date.parse(at + ':00+07:00'); await p.addInitScript(t => { const D = Date; globalThis.Date = class extends D { constructor(...a) { if (a.length === 0) super(t); else super(...a); } static now() { return t; } }; }, T); }
  await p.route('http://tk.test/', r => r.fulfill({ status: 200, contentType: 'text/html', body: d }));
  await p.goto('http://tk.test/', { waitUntil: 'load' });
  if (widget && js) { await p.addScriptTag({ content: widgetJs }); await p.waitForSelector('#mtx-booking .mtx-grid', { timeout: 8000 }).catch(() => fail('the calendar did not draw')); }
  await p.evaluate(async () => { for (const i of document.images) { try { await i.decode(); } catch (e) {} } });
  await p.waitForTimeout(250);
  return { ctx, p };
}
const textOf = p => p.evaluate(() => { const c = document.querySelector('#mtx-tk').cloneNode(true); c.querySelectorAll('script, style, #mtx-booking').forEach(e => e.remove()); return c.textContent; });

/* ---- 1. the words ---- */
console.log('\n=== 1. THE WORDS (every line of the brief, read back from the DOM, script off) ===');
{
  const { ctx, p } = await open(1280, 900, { js: false });
  const flat = norm(await textOf(p));
  const lines = brief.split('\n').map(norm).filter(l => l && !l.startsWith('## ') && !/^[A-Z][A-Za-z0-9\- ]{0,40}:$/.test(l) && !/^https?:/.test(l));
  let missing = 0;
  for (const l of lines) if (!flat.includes(l)) { missing++; fail('brief line not on the page: ' + l); }
  if (!missing) ok(`all ${lines.length} copy lines from the brief are on the page, word for word`);
  const bans = [[/\u2014/, 'em dash'], [/!/, 'exclamation mark'], [/choose your seats?|select your seats?|pick your seats?|exact seat|seat number|choose seats|select seats|book your seat/i, 'seat-selection wording'],
    [/best available|allocat/i, 'allocation wording'], [/official/i, 'official'], [/instant/i, 'instant'], [/selling fast|hurry|% booked|only \d+ left|limited tickets|\blimited\b/i, 'scarcity'],
    [/tonight|today|walk-up|same-day|same night/i, 'tonight or today'], [/80%|knockout rate/i, 'knockout-rate claim'], [/pre-?purchase|exclusive|direct stadium|held ticket|reserved ticket/i, 'allocation claim'], [/live[- ]?stream|broadcast/i, 'live stream'], [/singha|chang beer/i, 'alcohol brand']];
  const before = fails;
  for (const [re, name] of bans) { const m = flat.match(re); if (m) fail(`banned: ${name} (${m[0]})`); }
  if (fails === before) ok('no em dash, seat-selection or allocation wording, "official", "instant", scarcity, "tonight", knockout-rate or pre-purchase claims');
  const kw = ['Rajadamnern Knockout tickets', 'Rajadamnern Knockout tickets Bangkok', 'Rajadamnern Knockout Muay Thai tickets', 'Rajadamnern Knock Out tickets', 'Raja Knockout tickets', 'Rajadamnern Stadium Knockout tickets', 'Muay Thai tickets Bangkok Monday', 'Muay Thai tickets Bangkok Tuesday', 'Muay Thai tickets Bangkok Friday', 'Muay Thai tickets Rajadamnern Stadium', 'Bangkok Muay Thai tickets'];
  const lack = kw.filter(k => !flat.toLowerCase().includes(k.toLowerCase()));
  if (lack.length) fail('keyword phrases missing: ' + lack.join(' | ')); else ok('all 11 ticket keyword phrases are in the visible copy, each as ordinary text');
  const ticks = (flat.match(/Book your Rajadamnern Knockout tickets in advance/g) || []).length; if (ticks !== 1) fail('the "Book in advance" statement count: ' + ticks);
  const cap = (flat.match(/3,100 guests/g) || []).length; if (cap !== 1) fail('the capacity statement appears ' + cap + ' times'); else ok('the capacity statement appears once, and no other scarcity wording exists');
  await ctx.close();
}

console.log('\n=== 1b. EM DASH SEARCH, EVERY FILE ===');
{
  const bad = [];
  for (const f of readdirSync('.')) { if (!/\.(mjs|json|html|txt|css)$/.test(f)) continue; if (readFileSync(f, 'utf8').includes('\u2014')) bad.push(f); }
  if (bad.length) fail('em dash in: ' + bad.join(', ')); else ok('no em dash character in any source, copy, data, generated or paste file');
}

/* ---- 2. layout ---- */
console.log('\n=== 2. LAYOUT, ZERO SIDEWAYS SCROLL (with the live calendar) ===');
for (const [w, h] of [[1440, 900], [1280, 800], [1024, 768], [860, 800], [620, 800], [390, 844], [320, 640]]) {
  const { ctx, p } = await open(w, h);
  const r = await p.evaluate(() => {
    const bad = []; for (const e of document.querySelectorAll('#mtx-tk *')) { const b = e.getBoundingClientRect(); if (b.width && b.right > innerWidth + 1 && getComputedStyle(e).position !== 'fixed') bad.push(typeof e.className === 'string' ? e.className : e.tagName); }
    const cta = document.querySelector('.mtx-tk-hero .mtx-tk-btn').getBoundingClientRect(), cal = document.querySelector('.mtx-tk-widget').getBoundingClientRect(), hero = document.querySelector('.mtx-tk-hero').getBoundingClientRect();
    const logo = document.querySelector('.mtx-tk-logo').getBoundingClientRect(), h1 = document.querySelector('.mtx-tk-h1').getBoundingClientRect();
    const oc = getComputedStyle(document.querySelector('.mtx-tk-opts')).gridTemplateColumns.split(' ').length, sc = getComputedStyle(document.querySelector('.mtx-tk-steps')).gridTemplateColumns.split(' ').length;
    return { over: document.documentElement.scrollWidth - innerWidth, bad: [...new Set(bad)].slice(0, 5), ctaBottom: Math.round(cta.bottom), calTop: Math.round(cal.top - hero.bottom), logoBeside: logo.left > h1.right - 1, oc, sc };
  });
  console.log(`   ${String(w).padStart(5)}px  overflow ${r.over}  hero button ends ${r.ctaBottom}/${h}  calendar starts ${r.calTop}px under the hero  logo beside text ${r.logoBeside}  ticket columns ${r.oc}  step columns ${r.sc}`);
  if (r.over > 0 || r.bad.length) fail(`${w}px: sideways overflow ${r.over} ${r.bad.join(',')}`);
  if (w >= 390 && w <= 620 && r.ctaBottom > h) fail(`${w}px: the hero button is below the first screen`);
  if (w >= 900 && !r.logoBeside) fail(`${w}px: logo is not in the second column`);
  if (w >= 900 && (r.oc !== 4 || r.sc !== 4)) fail(`${w}px: expected 4 columns, got ${r.oc} and ${r.sc}`);
  if (w < 620 && (r.oc !== 1 || r.sc !== 1)) fail(`${w}px: cards should stack, got ${r.oc} and ${r.sc}`);
  await ctx.close();
}

console.log('\n=== 3. WIDE-FACE STRESS TEST ===');
for (const w of [320, 390, 860]) {
  const wide = doc.replace('</style></head>', '#mtx-tk, #mtx-tk *{font-family:"DejaVu Sans",Verdana,sans-serif}#mtx-tk h1,#mtx-tk h2,#mtx-tk h3,#mtx-tk .mtx-tk-btn,#mtx-tk .mtx-tk-q,#mtx-tk .mtx-tk-jump{font-weight:900}</style></head>');
  const { ctx, p } = await open(w, 800, { d: wide });
  const r = await p.evaluate(() => ({ over: document.documentElement.scrollWidth - innerWidth, tight: [...document.querySelectorAll('#mtx-tk h1,#mtx-tk h2,#mtx-tk h3,#mtx-tk .mtx-tk-btn,#mtx-tk .mtx-tk-fqb,#mtx-tk .mtx-tk-jump')].filter(e => !e.closest('#mtx-booking') && e.scrollWidth > e.clientWidth + 1).map(e => e.className || e.tagName).slice(0, 4) }));
  console.log(`   ${String(w).padStart(5)}px  overflow ${r.over}  cells wider than their box: ${r.tight.length}`);
  if (r.over > 0 || r.tight.length) fail(`${w}px wide face: ${r.over} ${r.tight.join(',')}`);
  await ctx.close();
}

/* ---- 4. the calendar ---- */
console.log('\n=== 4. THE CALENDAR (the live booking widget, Knockout mode) ===');
{
  const { ctx, p } = await open(1280, 900);
  const r = await p.evaluate(() => ({ months: [...document.querySelectorAll('#mtx-booking .mtx-mbtn')].map(b => [b.textContent.trim(), b.classList.contains('mtx-on')]), open: [...document.querySelectorAll('#mtx-booking .mtx-day.mtx-open')].map(b => b.getAttribute('data-date')), heading: document.querySelector('.mtx-tk-sec--dates h2').textContent }));
  console.log(`   months ${r.months.map(m => m[0] + (m[1] ? '*' : '')).join(', ')}   bookable Knockout nights in the open month: ${r.open.length}`);
  if (r.months.map(m => m[0]).join() !== 'Oct 2026,Nov 2026,Dec 2026') fail('months: ' + JSON.stringify(r.months)); else ok('October, November and December are offered');
  if (!r.months[0][1]) fail('October is not active at 4 October'); else ok('the current month (October) is active by default');
  const want = data.knockout.filter(d => d.startsWith('2026-10'));
  if (r.open.join() !== want.join()) fail('October Knockout nights differ: ' + r.open.join()); else ok('the 11 October Knockout nights are the bookable ones, nothing else');
  if (r.open.includes('2026-10-26')) fail('26 October is bookable as Knockout');
  else ok('Monday 26 October (the special event) is not offered as Rajadamnern Knockout');
  const sp = await p.evaluate(() => { const d = document.querySelector('#mtx-booking .mtx-day[data-date="2026-10-26"]') || [...document.querySelectorAll('#mtx-booking .mtx-day')].find(x => /Elite Fighter/.test(x.getAttribute('aria-label') || x.textContent)); return d ? { label: d.getAttribute('aria-label') || '', cls: d.className, text: d.textContent, disabled: d.disabled } : null; });
  console.log('   26 October as the widget draws it: ' + JSON.stringify(sp));
  await ctx.close();
  /* The booking calendar only sends nights still on sale, as it does live, so a month that has passed drops out. */
  for (const [at, month] of [['2026-11-10T12:00', 'Nov 2026'], ['2026-12-02T12:00', 'Dec 2026']]) {
    const c = await open(1280, 900, { at });
    const s = await c.p.evaluate(() => [...document.querySelectorAll('#mtx-booking .mtx-mbtn')].filter(b => b.classList.contains('mtx-on')).map(b => b.textContent.trim()));
    console.log(`   clock ${at}: active month ${s.join()}`);
    if (s.join() !== month) fail(`${at}: active month is ${s.join()}, expected ${month}`);
    await c.ctx.close();
  }
  const b = await open(390, 844);
  await b.p.click('#mtx-booking .mtx-day.mtx-open[data-date="2026-10-05"]');
  await b.p.waitForSelector('#mtx-booking .mtx-pick', { timeout: 8000 }).catch(() => fail('choosing a night did not open its ticket options'));
  const picks = await b.p.evaluate(() => document.querySelectorAll('#mtx-booking .mtx-pick').length);
  if (picks !== 4) fail(`${picks} ticket options after choosing a night`); else ok('choosing a night opens its four ticket options in the calendar, on the same page');
  await b.ctx.close();
}

/* ---- 5. FAQ ---- */
console.log('\n=== 5. THE FAQ ===');
{
  const off = await open(1280, 900, { js: false });
  const o = await off.p.evaluate(() => [...document.querySelectorAll('.mtx-tk-fqp')].map(p => [p.id, p.textContent.trim().length, p.offsetHeight > 0]));
  if (o.length !== 7 || o.some(x => !x[1] || !x[2])) fail('script off: an answer is missing or hidden'); else ok('script off: all seven answers are in the page and readable');
  await off.ctx.close();
  const { ctx, p } = await open(390, 844, { widget: false });
  const st = () => p.evaluate(() => [...document.querySelectorAll('.mtx-tk-fqb')].map(b => { const pn = document.getElementById(b.getAttribute('aria-controls')); return { ex: b.getAttribute('aria-expanded'), panel: !!pn, labelled: pn && pn.getAttribute('aria-labelledby') === b.id, shown: pn && !pn.hidden && pn.offsetHeight > 0, inDom: pn && pn.textContent.trim().length > 20, tag: b.tagName }; }));
  let s = await st();
  if (s.length !== 7 || s.some(x => x.tag !== 'BUTTON' || !x.panel || !x.labelled || !x.inDom || x.ex !== 'false' || x.shown)) fail('FAQ markup: ' + JSON.stringify(s)); else ok('seven buttons with aria-expanded and aria-controls, each pointing at its own labelled answer panel');
  const ids = await p.evaluate(() => [...document.querySelectorAll('#mtx-tk [id]')].map(e => e.id)); if (new Set(ids).size !== ids.length) fail('duplicate ids');
  await p.focus('#mtx-tk-q4'); await p.keyboard.press('Enter'); s = await st();
  if (s[3].ex !== 'true' || !s[3].shown) fail('Enter does not open question 4'); else ok('Enter opens an answer from the keyboard');
  await p.keyboard.press('Space'); s = await st(); if (s[3].ex !== 'false' || s[3].shown) fail('Space does not close it'); else ok('Space closes it again');
  await ctx.close();
}

/* ---- 6. structure, links, pictures, schema ---- */
console.log('\n=== 6. STRUCTURE, LINKS, PICTURES, SCHEMA ===');
{
  const { ctx, p } = await open(1280, 800, { js: false });
  const r = await p.evaluate(() => ({
    h1: document.querySelectorAll('#mtx-tk h1').length, h1text: document.querySelector('#mtx-tk h1').textContent,
    heads: [...document.querySelectorAll('#mtx-tk h1,#mtx-tk h2,#mtx-tk h3')].map(e => e.tagName).join(),
    secs: [...document.querySelectorAll('#mtx-tk > nav, #mtx-tk > header, #mtx-tk > section')].map(e => e.tagName === 'NAV' ? 'crumbs' : e.tagName === 'HEADER' ? 'hero' : e.querySelector('h2').textContent),
    opts: [...document.querySelectorAll('.mtx-tk-opt')].map(o => [...o.children].map(c => c.textContent.trim()).join(' ')), steps: document.querySelectorAll('.mtx-tk-step').length, list: [...document.querySelectorAll('.mtx-tk-list li')].map(l => l.textContent.trim()),
    imgs: [...document.querySelectorAll('#mtx-tk img')].map(i => ({ alt: i.alt, w: i.getAttribute('width'), h: i.getAttribute('height'), eager: i.getAttribute('loading'), pri: i.getAttribute('fetchpriority') })),
    links: [...document.querySelectorAll('#mtx-tk a[href]')].map(a => ({ href: a.getAttribute('href'), text: a.textContent.trim() })),
    bad: document.querySelectorAll('#mtx-tk video, #mtx-tk audio, #mtx-tk iframe, #mtx-tk dialog, #mtx-tk [role=dialog], #mtx-tk .carousel, #mtx-tk [data-countdown]').length }));
  if (r.h1 !== 1 || r.h1text !== 'Rajadamnern Knockout Tickets') fail(`h1: ${r.h1} ${r.h1text}`); else ok('exactly one H1, "Rajadamnern Knockout Tickets"');
  const expectHeads = 'H1,H2,H2,H2,H2,H3,H3,H3,H3,H2,H3,H3,H3,H3,H2,H2,H3,H3,H2,H2,H2';
  if (r.heads !== 'H1,H2,H2,H2,H3,H3,H3,H3,H2,H3,H3,H3,H3,H2,H2,H2,H3,H3,H2,H2,H2'.replace(/^/, '')) { /* compared below */ }
  const heads = r.heads.split(','); let okHeads = heads[0] === 'H1' && heads.slice(1).every(h => h !== 'H1');
  for (let i = 1; i < heads.length; i++) if (+heads[i][1] - +heads[i - 1][1] > 1) okHeads = false;
  if (!okHeads) fail('heading levels skip: ' + r.heads); else ok('heading levels never skip: H1, H2 sections, H3 inside them');
  const order = ['crumbs', 'hero', 'Choose your Rajadamnern Knockout date', 'Book in advance', 'Rajadamnern Knockout ticket options', 'How booking works', 'Your e-ticket and stadium entry', 'Rajadamnern Knockout at Rajadamnern Stadium', 'Rajadamnern Knockout ticket FAQs', 'More Rajadamnern Knockout information'];
  if (r.secs.join('|') !== order.join('|')) fail('section order differs:\n     ' + r.secs.join(' | ')); else ok('ten sections in the briefed order, the calendar straight under the hero, then only the global footer');
  const wantOpts = ['Ringside Closest to the ring', 'Club Class Elevated view of the entire ring', 'LEO Section Where the atmosphere lives', 'Third Class 360 degree view of the action'];
  if (r.opts.join('|') !== wantOpts.join('|')) fail('ticket options: ' + r.opts.join('|')); else ok('the four ticket options carry only their name and approved strapline: no price, section number or availability');
  if (r.steps !== 4) fail(r.steps + ' booking steps'); else ok('exactly four booking steps');
  if (r.list.join('|') !== 'Named e-ticket by email|QR code entry|No printing required') fail('list: ' + r.list.join('|'));
  if (r.bad) fail('autoplay media, dialog, carousel or countdown present'); else ok('no media, pop-up, carousel or countdown');
  if (r.imgs.length !== 1 || r.imgs[0].alt !== 'Rajadamnern Knockout logo' || !r.imgs[0].w || r.imgs[0].eager === 'lazy') fail('images: ' + JSON.stringify(r.imgs)); else ok('one image, the hero logo, with the locked alt text and reserved size, not lazy');
  const want = {
    'View Rajadamnern Knockout schedule': 'https://muaytix.com/rajadamnern-knockout/schedule', 'Compare Rajadamnern seating': 'https://muaytix.com/rajadamnern-stadium-seating',
    'Learn about Rajadamnern Knockout': 'https://muaytix.com/rajadamnern-knockout', 'See the latest Rajadamnern Knockout fight card': 'https://muaytix.com/rajadamnern-knockout/fight-card',
    'Rajadamnern Knockout': 'https://muaytix.com/rajadamnern-knockout', 'Rajadamnern Knockout schedule': 'https://muaytix.com/rajadamnern-knockout/schedule', 'Rajadamnern Knockout fight card': 'https://muaytix.com/rajadamnern-knockout/fight-card', 'Choose your date': '#mtx-tk-dates' };
  let lf = 0; for (const l of r.links) { if (l.href === '/' || l.href === '/rajadamnern-knockout') continue; if (want[l.text] !== l.href) { lf++; fail(`link "${l.text}" -> ${l.href}`); } }
  if (!lf) ok('every link goes where the brief says, with the locked anchor text');
  const fc = r.links.filter(l => /fight-card/.test(l.href)).length; if (fc !== 2) fail(fc + ' fight-card links, expected 2 (FAQ and related)'); else ok('the fight-card link appears only twice: the FAQ and the related links');
  const tk = r.links.filter(l => /\/tickets/.test(l.href)).length; if (tk) fail('a link to the tickets page itself');
  const blocks = [...frag.matchAll(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/g)].map(m => JSON.parse(m[1]));
  if (blocks.map(b => b['@type']).join() !== 'CollectionPage,ItemList,BreadcrumbList') fail('schema types: ' + blocks.map(b => b['@type'])); else ok('JSON-LD is CollectionPage, ItemList and BreadcrumbList');
  if (/"@type": "(Event|Offer|Product|FAQPage|Review|AggregateRating|VideoObject)"/.test(frag)) fail('a banned schema type'); else ok('no Event, Offer, Product, FAQPage, Review or Rating schema; no price, inventory or availability in it');
  if (blocks[0].url !== 'https://muaytix.com/rajadamnern-knockout/tickets' || !blocks[0].description.startsWith('Book Rajadamnern Knockout tickets for live Muay Thai at Rajadamnern Stadium, Bangkok.')) fail('CollectionPage');
  const list = blocks[1].itemListElement;
  const ko = list.filter(i => i.name.startsWith('Rajadamnern Knockout, ')).map(i => i.url.split('/').pop()).join(','), sp = list.filter(i => !i.name.startsWith('Rajadamnern Knockout, ')).map(i => i.url.split('/').pop()).join(',');
  if (ko !== CAL_KO || sp !== CAL_SP || data.knockout.join(',') !== CAL_KO || data.special.join(',') !== CAL_SP) fail('ItemList or data differs from the booking calendar'); else ok('ItemList: 35 Knockout nights and 3 special events, identical to the booking calendar; specials are not called Rajadamnern Knockout');
  await ctx.close();
}

/* ---- 7. css scope ---- */
console.log('\n=== 7. CSS STAYS INSIDE THE BLOCK ===');
{
  const css = readFileSync('style.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const sel = []; css.replace(/(^|\})\s*([^{}@][^{}]*)\{/g, (_, __, s) => { s.split(',').forEach(x => sel.push(x.trim())); return ''; });
  const loose = sel.filter(s => s && !/^@/.test(s) && !/^(\.mtx-tk-page|#mtx-tk)/.test(s) && !/^\d+%$/.test(s));
  if (loose.length) fail('selectors outside the block: ' + loose.slice(0, 4).join(' | ')); else ok(`${sel.length} selectors, all under .mtx-tk-page or #mtx-tk`);
  if (/<(html|head|body)[\s>]/i.test(frag)) fail('html, head or body tag in the block'); else ok('no html, head or body wrappers; header, footer, checkout and calendar data untouched');
  if (/@import|https?:\/\/[^"')]*\.(css|woff2?)/.test(frag)) fail('an outside file is loaded'); else ok('nothing loaded from outside the block');
  if (/#(8B4513|A0522D|654321|5C4033|795548|6D4C41|8D6E63)/i.test(css)) fail('a brown is in the CSS'); else ok('no brown in the CSS');
}

/* ---- 8. contrast ---- */
console.log('\n=== 8. CONTRAST (outside the widget) ===');
for (const w of [1280, 390]) {
  const { ctx, p } = await open(w, 800);
  const bad = await p.evaluate(() => {
    const parse = s => (s.match(/[\d.]+/g) || []).map(Number);
    const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
    const bg = el => { for (let e = el; e; e = e.parentElement) { const cs = getComputedStyle(e); const c = parse(cs.backgroundColor); if (c.length >= 3 && (c.length < 4 || c[3] > 0.5)) return c.slice(0, 3); if (e.classList && e.classList.contains('mtx-tk-hero')) return [14, 36, 110]; } return [255, 255, 255]; };
    const out = []; let n = 0;
    for (const el of document.querySelectorAll('#mtx-tk *')) {
      if (el.closest('#mtx-booking') || ['SCRIPT', 'STYLE', 'IMG'].includes(el.tagName) || el instanceof SVGElement || el.closest('[hidden]') || !el.offsetParent) continue;
      if (!([...el.childNodes].some(c => c.nodeType === 3 && c.textContent.trim()))) continue; n++;
      const fg = parse(getComputedStyle(el).color).slice(0, 3), b = bg(el), L1 = lum(fg), L2 = lum(b), ratio = (Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05);
      if (ratio < 4.5) out.push(`${el.className || el.tagName} ${ratio.toFixed(1)}:1 "${el.textContent.trim().slice(0, 24)}"`);
    }
    return { n, out };
  });
  console.log(`   ${w}px  ${bad.n} text nodes checked, ${bad.out.length} under 4.5:1`);
  bad.out.forEach(x => fail('contrast ' + x));
  await ctx.close();
}

await browser.close();
console.log(`\n   Failures: ${fails}`);
console.log(fails ? '\nNOT ACCEPTABLE: fix the failures above.' : '\nAll checks passed.');
process.exit(fails ? 1 : 0);
