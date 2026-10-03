/* Checks for the rolling Rajadamnern Knockout fight-card page. Render, read the
 * text back out of the DOM, freeze the clock either side of each boundary, then
 * count.
 *
 *   node verify.mjs
 */
import { readFileSync, readdirSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;

const brief = readFileSync('brief.txt', 'utf8');
const frag = readFileSync('fightcard-live.txt', 'utf8');
const recent = JSON.parse(readFileSync('recent.json', 'utf8'));
const META_DESC = 'See the latest Rajadamnern Knockout fight card at Rajadamnern Stadium, Bangkok. Confirmed bouts are updated when announced. Choose seats for the next event online.';

let fails = 0;
const fail = m => { fails++; console.log('   FAIL ' + m); };
const ok = m => console.log('   ok   ' + m);
const norm = s => s.replace(/\s+/g, ' ').trim();

const wrap = f => `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}#allrecords{font-family:Arial,sans-serif}#allrecords *{text-align:center}#allrecords a{text-decoration:none;color:inherit}#allrecords ul,#allrecords ol{list-style:none;padding:0}</style></head><body><div id="allrecords">${f}</div></body></html>`;
const doc = wrap(frag);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const svg = (w, h, c) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="${c}"/></svg>`;

/* `at` freezes the clock at a Bangkok wall-clock time, "2026-10-05T21:59". */
async function open(w, h, { d = doc, at = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const p = await ctx.newPage();
  await p.route('**static.tildacdn.com/**', r => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: /1000029307/.test(r.request().url()) ? svg(280, 80, '#1F5BFF') : svg(900, 1100, '#8A93A8') }));
  p.on('pageerror', e => fail('page error: ' + e.message));
  if (at) {
    const T = Date.parse(at + ':00+07:00');
    await p.addInitScript(t => { const D = Date; globalThis.Date = class extends D { constructor(...a) { if (a.length === 0) super(t); else super(...a); } static now() { return t; } }; }, T);
  }
  await p.route('http://fc.test/', r => r.fulfill({ status: 200, contentType: 'text/html', body: d }));
  await p.goto('http://fc.test/', { waitUntil: 'load' });
  await p.evaluate(async () => { for (const i of document.images) { i.loading = 'eager'; try { await i.decode(); } catch (e) {} } });
  await p.waitForTimeout(200);
  return { ctx, p };
}
const textOf = p => p.evaluate(() => { const c = document.querySelector('#mtx-fc').cloneNode(true); c.querySelectorAll('script, style').forEach(e => e.remove()); return c.textContent; });

/* ---- 1. the words ---- */
console.log('\n=== 1. THE WORDS (every line of the brief, read back from the DOM) ===');
{
  const { ctx, p } = await open(1280, 900);
  const flat = norm(await textOf(p));
  const skip = new Set();
  let sec = '';
  const lines = [];
  for (const raw of brief.split('\n')) {
    const l = norm(raw); if (!l) continue;
    if (l.startsWith('## ')) { sec = l; continue; }
    if (sec.startsWith('## 4B')) continue;
    if (/^[A-Z][A-Za-z0-9\- ]{0,40}:$/.test(l) || /^https?:/.test(l)) continue;
    lines.push(l);
  }
  let missing = 0;
  for (const l of lines) if (!flat.includes(l)) { missing++; fail('brief line not on the page: ' + l); }
  if (!missing) ok(`all ${lines.length} State A copy lines from the brief are on the page, word for word`);
  const upd = await p.evaluate(() => document.querySelector('.mtx-fc-upd-v').textContent);
  if (!/^\d{1,2} [A-Z][a-z]+ 2026, \d{1,2}:\d{2} (am|pm) Bangkok time$/.test(upd)) fail('last-updated value: ' + upd); else ok(`last updated is visible and in Bangkok time: "${upd}"`);
  const bans = [[/\u2014/, 'em dash'], [/!/, 'exclamation mark'], [/book your seat/i, 'book your seat'], [/unassigned|assigned seating/i, 'assigned seating'],
    [/selling fast|hurry|% booked/i, 'scarcity'], [/singha|chang beer/i, 'alcohol brand'], [/live[- ]?stream/i, 'live stream'], [/\blimited\b/i, 'limited'], [/TBA|to be announced/i, 'a TBA placeholder']];
  const before = fails;
  for (const [re, name] of bans) { const m = flat.match(re); if (m) fail(`banned: ${name} (${m[0]})`); }
  if (fails === before) ok('no em dashes, exclamation marks, scarcity, alcohol, live-stream, "limited" or TBA placeholders');
  const off = (flat.match(/official/gi) || []).length;
  console.log(`   note  "official" appears ${off} time(s): it is in the supplied State A copy ("The official line-ups will be added here")`);
  if (/Bout \d|\bvs\b/.test(flat)) fail('a bout row is on a State A page'); else ok('no Bout rows, no fake matchups, no empty rows');
  if (/7:00 pm/.test(flat) && !/First fight 7:00 pm/.test(flat)) fail('first fight time');
  await ctx.close();
}

/* ---- 1b. no em dash in any file of this page ---- */
console.log('\n=== 1b. EM DASH SEARCH, EVERY FILE ===');
{
  const bad = [];
  for (const f of readdirSync('.')) { if (!/\.(mjs|json|html|txt|css)$/.test(f)) continue; if (readFileSync(f, 'utf8').includes('\u2014')) bad.push(f); }
  for (const f of readdirSync('fixtures')) if (readFileSync('fixtures/' + f, 'utf8').includes('\u2014')) bad.push('fixtures/' + f);
  if (bad.length) fail('em dash in: ' + bad.join(', ')); else ok('no em dash character in any source, copy, data, generated or paste file');
}

/* ---- 2. layout ---- */
console.log('\n=== 2. LAYOUT, ZERO SIDEWAYS SCROLL ===');
for (const [w, h] of [[1440, 900], [1280, 800], [1024, 768], [860, 800], [620, 800], [390, 844], [320, 640]]) {
  const { ctx, p } = await open(w, h);
  const r = await p.evaluate(() => {
    const bad = []; for (const e of document.querySelectorAll('#mtx-fc *')) { const b = e.getBoundingClientRect(); if (b.width && b.right > innerWidth + 1 && getComputedStyle(e).position !== 'fixed') bad.push(typeof e.className === 'string' ? e.className : e.tagName); }
    const cta = document.querySelector('.mtx-fc-hero .mtx-fc-btn').getBoundingClientRect();
    const pill = document.querySelector('.mtx-fc-pill').getBoundingClientRect();
    const date = document.querySelector('.mtx-fc-sec--status .mtx-fc-date').getBoundingClientRect();
    const sCta = document.querySelector('.mtx-fc-sec--status .mtx-fc-btn').getBoundingClientRect();
    const fc = getComputedStyle(document.querySelector('.mtx-fc-sec--status .mtx-fc-facts')).gridTemplateColumns.split(' ').length;
    return { over: document.documentElement.scrollWidth - innerWidth, bad: [...new Set(bad)].slice(0, 5), ctaBottom: Math.round(cta.bottom), dateTop: Math.round(date.top), pillBottom: Math.round(pill.bottom), sCtaBottom: Math.round(sCta.bottom), fc };
  });
  console.log(`   ${String(w).padStart(5)}px  overflow ${r.over}  hero button ends ${r.ctaBottom}  date ${r.dateTop}  status ${r.pillBottom}  status button ends ${r.sCtaBottom}  (screen ${h})  fact columns ${r.fc}`);
  if (r.over > 0 || r.bad.length) fail(`${w}px: sideways overflow ${r.over} ${r.bad.join(',')}`);
  if (w <= 620 && r.ctaBottom > h) fail(`${w}px: the hero button is below the first screen`);
  if (w >= 390 && w <= 620 && r.pillBottom > h * 1.7) fail(`${w}px: card status is more than 1.7 screens down`);
  await ctx.close();
}

/* ---- 3. wide-face stress test ---- */
console.log('\n=== 3. WIDE-FACE STRESS TEST (display face swapped for a wider one) ===');
for (const w of [320, 390, 860]) {
  const wide = doc.replace('</style></head>', '#mtx-fc, #mtx-fc *{font-family:"DejaVu Sans",Verdana,sans-serif}#mtx-fc h1,#mtx-fc h2,#mtx-fc h3,#mtx-fc .mtx-fc-btn,#mtx-fc .mtx-fc-q,#mtx-fc .mtx-fc-jump,#mtx-fc .mtx-fc-pill,#mtx-fc .mtx-fc-date,#mtx-fc .mtx-fc-night{font-weight:900}</style></head>');
  const { ctx, p } = await open(w, 800, { d: wide });
  const r = await p.evaluate(() => ({ over: document.documentElement.scrollWidth - innerWidth,
    tight: [...document.querySelectorAll('#mtx-fc h1,#mtx-fc h2,#mtx-fc .mtx-fc-btn,#mtx-fc summary,#mtx-fc .mtx-fc-jump,#mtx-fc .mtx-fc-pill,#mtx-fc .mtx-fc-night,#mtx-fc .mtx-fc-fact')].filter(e => e.scrollWidth > e.clientWidth + 1).map(e => e.className || e.tagName).slice(0, 4) }));
  console.log(`   ${String(w).padStart(5)}px  overflow ${r.over}  cells wider than their box: ${r.tight.length}`);
  if (r.over > 0 || r.tight.length) fail(`${w}px wide face: ${r.over} ${r.tight.join(',')}`);
  await ctx.close();
}

/* ---- 4. the clock: which night the buttons point at ---- */
console.log('\n=== 4. THE CLOCK (Bangkok time, either side of each boundary) ===');
{
  const cases = [
    ['2026-10-04T00:42', '2026-10-05', 'Monday 5 October', 'now'],
    ['2026-10-05T21:59', '2026-10-05', 'Monday 5 October', 'Monday, a minute before the 10:00 pm changeover'],
    ['2026-10-05T22:00', '2026-10-06', 'Tuesday 6 October', 'Monday night over'],
    ['2026-10-06T21:59', '2026-10-06', 'Tuesday 6 October', 'Tuesday, a minute before'],
    ['2026-10-06T22:00', '2026-10-09', 'Friday 9 October', 'Tuesday night over'],
    ['2026-10-09T21:59', '2026-10-09', 'Friday 9 October', 'Friday, a minute before'],
  ];
  for (const [at, iso, short, why] of cases) {
    const { ctx, p } = await open(390, 844, { at });
    const r = await p.evaluate(() => ({
      ctas: [...document.querySelectorAll('#mtx-fc a[data-mtx-cta]')].map(a => [a.textContent.trim(), a.getAttribute('href'), (a.offsetWidth ? a.innerText.replace(/\s+/g, ' ').trim() : null)]),
      date: document.querySelector('.mtx-fc-sec--status .mtx-fc-date').textContent,
      nights: [...document.querySelectorAll('#mtx-fc [data-mtx-night]')].filter(e => !e.hidden).map(e => e.textContent),
      sec7: document.querySelector('.mtx-fc-conf .mtx-fc-body').textContent }));
    const wantText = `Choose seats for ${short}`, wantHref = `https://muaytix.com/rajadamnern-knockout/${iso}`;
    const wrong = r.ctas.filter(([t, h, rendered]) => t !== wantText || h !== wantHref || (rendered && rendered.toLowerCase() !== wantText.toLowerCase()));
    console.log(`   ${at}  ${r.ctas.length} buttons -> ${iso}  date "${r.date}"  nights shown: ${r.nights.length}   (${why})`);
    if (r.ctas.length !== 6) fail(`${at}: ${r.ctas.length} booking links, expected 6 (hero, status, card area, book, FAQ, phone bar)`);
    if (wrong.length) fail(`${at}: ${JSON.stringify(wrong)}`);
    if (!r.sec7.includes(short)) fail(`${at}: section 7 says "${r.sec7}"`);
    if (r.date.indexOf(short) !== 0) fail(`${at}: date line "${r.date}"`);
    await ctx.close();
  }
  const { ctx, p } = await open(390, 844, { at: '2026-10-09T22:00' });
  const r = await p.evaluate(() => ({ hrefs: [...document.querySelectorAll('#mtx-fc a[data-mtx-cta]')].map(a => a.getAttribute('href')), texts: [...document.querySelectorAll('#mtx-fc a[data-mtx-cta]')].map(a => a.innerText.replace(/\s+/g, ' ').trim()), dated: [...document.querySelectorAll('#mtx-fc a')].filter(a => /\/\d{4}-\d{2}-\d{2}$/.test(a.getAttribute('href'))).length, shown: [...document.querySelectorAll('#mtx-fc [data-mtx-night]')].filter(e => !e.hidden).length }));
  console.log(`   2026-10-09T22:00  every scheduled night over: buttons -> ${[...new Set(r.hrefs)].join(', ')}  dated links ${r.dated}  nights shown ${r.shown}`);
  if (r.dated || r.shown || new Set(r.hrefs).size !== 1 || r.hrefs[0] !== 'https://muaytix.com/rajadamnern-knockout/schedule') fail('after the last night the page still offers a finished night');
  else ok('after the last scheduled night no button offers a finished night; they fall back to the schedule page');
  await ctx.close();
}

/* ---- 5. buttons and the phone bar ---- */
console.log('\n=== 5. THE PHONE BAR ===');
{
  const { ctx, p } = await open(390, 844);
  const bar = async () => p.evaluate(() => document.querySelector('[data-mtx-fc-bar]').className.includes('is-on') && getComputedStyle(document.querySelector('[data-mtx-fc-bar]')).display !== 'none');
  if (await bar()) fail('the bar is on at the top'); else ok('bar off at the top');
  await p.evaluate(() => document.querySelector('.mtx-fc-sec--status .mtx-fc-btn').scrollIntoView({ block: 'center' })); await p.waitForTimeout(250);
  if (await bar()) fail('the bar is on while a booking button is on screen'); else ok('bar off while another booking button is on screen');
  await p.evaluate(() => document.querySelector('.mtx-fc-sec--note').scrollIntoView({ block: 'start' })); await p.waitForTimeout(250);
  const midOn = await bar();
  await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await p.waitForTimeout(250);
  if (!(await bar())) fail('the bar is off at the foot of the page'); else ok('bar on once the guest is past the buttons' + (midOn ? '' : ' (off at the note, where the card-area button is still near)'));
  const clash = await p.evaluate(() => document.querySelector('.mtx-fc-rel').getBoundingClientRect().bottom > document.querySelector('[data-mtx-fc-bar]').getBoundingClientRect().top ? 'covered' : 'clear');
  if (clash === 'covered') fail('the phone bar covers the last links'); else ok('the phone bar does not cover the last links');
  const t = await p.evaluate(() => [document.querySelector('[data-mtx-fc-bar]').textContent, document.querySelector('[data-mtx-fc-bar]').getAttribute('href')]);
  if (t[0] !== 'Choose seats for Monday 5 October' || t[1] !== 'https://muaytix.com/rajadamnern-knockout/2026-10-05') fail('bar text or link: ' + t);
  await ctx.close();
  const d = await open(1280, 800);
  await d.p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await d.p.waitForTimeout(250);
  if (await d.p.evaluate(() => getComputedStyle(document.querySelector('[data-mtx-fc-bar]')).display) !== 'none') fail('the phone bar shows on a desktop'); else ok('phone bar never shows on 1280px');
  await d.ctx.close();
}

/* ---- 6. structure, links, pictures, schema ---- */
console.log('\n=== 6. STRUCTURE, LINKS, PICTURES, SCHEMA ===');
{
  const { ctx, p } = await open(1280, 800);
  const r = await p.evaluate(() => ({
    h1: document.querySelectorAll('#mtx-fc h1').length,
    secs: [...document.querySelectorAll('#mtx-fc > nav, #mtx-fc > header, #mtx-fc > section')].map(e => e.tagName === 'NAV' ? 'crumbs' : e.tagName === 'HEADER' ? 'hero' : (e.querySelector('h2') || { textContent: 'NOTE' }).textContent),
    details: document.querySelectorAll('#mtx-fc details').length,
    answers: [...document.querySelectorAll('#mtx-fc details')].every(d => d.textContent.trim().length > 20),
    imgs: [...document.querySelectorAll('#mtx-fc img')].map(i => ({ src: i.src, alt: i.alt, w: i.getAttribute('width'), h: i.getAttribute('height'), top: Math.round(i.getBoundingClientRect().top + scrollY) })),
    links: [...document.querySelectorAll('#mtx-fc a[href]')].map(a => ({ href: a.getAttribute('href'), text: a.textContent.trim() })),
    bad: document.querySelectorAll('#mtx-fc video, #mtx-fc audio, #mtx-fc iframe, #mtx-fc dialog, #mtx-fc [role=dialog], #mtx-fc .carousel, #mtx-fc [data-countdown]').length,
    nightsShown: [...document.querySelectorAll('#mtx-fc [data-mtx-night]')].map(e => e.textContent),
  }));
  if (r.h1 !== 1) fail(`${r.h1} h1 elements`); else ok('one h1');
  const order = ['crumbs', 'hero', 'Next Rajadamnern Knockout event', 'Fight cards for next week', 'NOTE', 'What to expect from Rajadamnern Knockout', 'Book the next Rajadamnern Knockout night', 'Recent Rajadamnern Knockout cards', 'Rajadamnern Knockout fight-card FAQs', 'Plan your Rajadamnern Knockout night'];
  if (r.secs.join('|') !== order.join('|')) fail('section order differs:\n     ' + r.secs.join(' | ')); else ok('ten sections in the briefed order, then only the global footer');
  if (r.details !== 5 || !r.answers) fail(`${r.details} FAQ items`); else ok('five FAQ questions, every answer in the page at load');
  if (r.bad) fail('autoplay media, dialog, carousel or countdown element present'); else ok('no media, pop-up, carousel or countdown');
  if (r.nightsShown.join('|') !== 'Monday 5 October 2026|Tuesday 6 October 2026|Friday 9 October 2026') fail('upcoming dates: ' + r.nightsShown.join('|')); else ok('Monday 5, Tuesday 6 and Friday 9 October listed as scheduled nights');
  const noAlt = r.imgs.filter(i => !i.alt || !i.w || !i.h);
  if (noAlt.length) fail('image without alt, width or height'); else ok(`${r.imgs.length} images, each with alt text and reserved width and height`);
  if (r.imgs.length !== 1 + recent.length) fail(`${r.imgs.length} images, expected the logo and ${recent.length} recent cards`);
  const rc = r.imgs.slice(1);
  const tags = [...frag.matchAll(/<img [^>]*>/g)].map(m => m[0]);
  if (!tags.slice(1).every(t => /loading="lazy"/.test(t)) || tags.length !== 3) fail('a recent-card poster is not lazy-loaded'); else ok('recent-card posters are lazy-loaded; the logo above the fold is eager');
  if (/loading="lazy"/.test(tags[0])) fail('the above-the-fold image is lazy');
  if (rc.some(i => /graphic|illustration/i.test(i.alt))) fail('image alt mentions graphic');
  const want = {
    'Choose seats for Monday 5 October': 'https://muaytix.com/rajadamnern-knockout/2026-10-05',
    'View the Rajadamnern Knockout schedule': 'https://muaytix.com/rajadamnern-knockout/schedule',
    'See all Rajadamnern Knockout dates': 'https://muaytix.com/rajadamnern-knockout/schedule',
    'Learn about Rajadamnern Knockout': 'https://muaytix.com/rajadamnern-knockout',
    'Rajadamnern Knockout': 'https://muaytix.com/rajadamnern-knockout',
    'Choose Rajadamnern Knockout tickets': 'https://muaytix.com/rajadamnern-knockout/tickets',
    'Compare Rajadamnern seating': 'https://muaytix.com/rajadamnern-stadium-seating',
  };
  let lf = 0;
  for (const l of r.links) {
    if (l.href === '/' || l.href === '/rajadamnern-knockout') continue;
    const key = Object.keys(want).find(k => l.text === k);
    if (!key || want[key] !== l.href) { lf++; fail(`link "${l.text}" -> ${l.href}`); }
  }
  const counts = Object.fromEntries(Object.keys(want).map(k => [k, r.links.filter(l => l.text === k).length]));
  if (counts['Choose seats for Monday 5 October'] !== 6) fail(`${counts['Choose seats for Monday 5 October']} "Choose seats" links, expected 6 (hero, status, card area, book, FAQ and the phone bar)`);
  if (r.links.some(l => /fight-card\/\d|\/2026-10-0[5-9]\/fight-card/.test(l.href))) fail('a date-specific fight-card URL is linked');
  if (!lf) ok('every link goes where the brief says, with the locked anchor text; no date-specific fight-card URL');
  if (r.links.some(l => /ticket/i.test(l.href) && /fight card/i.test(l.text)) || r.links.some(l => /fight-card/.test(l.href))) fail('a fight-card anchor goes to tickets, or a link goes to a fight-card page'); else ok('no fight-card anchor links to a ticket page, and no ticket anchor to a fight-card page');

  const blocks = [...frag.matchAll(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/g)].map(m => JSON.parse(m[1]));
  const types = blocks.map(b => b['@type']).join();
  if (types !== 'CollectionPage,ItemList,BreadcrumbList') fail('schema types: ' + types); else ok('JSON-LD is CollectionPage, ItemList and BreadcrumbList');
  if (/"@type": "(Event|Offer|Product|FAQPage|Review|AggregateRating|VideoObject)"/.test(frag)) fail('a banned schema type is present'); else ok('no Event, Offer, Product, FAQPage, Review or Rating schema');
  if (blocks[0].description !== META_DESC || blocks[0].url !== 'https://muaytix.com/rajadamnern-knockout/fight-card') fail('CollectionPage url or description differs from the metadata');
  if (blocks[1].itemListElement.length !== recent.length) fail('ItemList count differs from the recent cards shown'); else ok('ItemList holds only the recent cards that are shown; no unannounced bout is in the schema');
  if (/PORNNAPHA|ABI KAMATE|THESTAR/i.test(frag.replace(/<img[^>]*>/g, ''))) fail('a fighter name is in State A output'); else ok('no fighter names anywhere in State A');
  await ctx.close();
}

/* ---- 7. State B, built from a test fixture ---- */
console.log('\n=== 7. STATE B (test fixture, never written to the live files) ===');
{
  const dir = mkdtempSync(join(tmpdir(), 'fcb-'));
  const env = { ...process.env, CARD_FILE: 'fixtures/state-b-test.json', OUT_DIR: dir };
  execFileSync('node', ['gen.mjs'], { env, stdio: 'pipe' }); execFileSync('node', ['build.mjs'], { env, stdio: 'pipe' });
  const fb = readFileSync(join(dir, 'fightcard-live.txt'), 'utf8');
  const fx = JSON.parse(readFileSync('fixtures/state-b-test.json', 'utf8'));
  const dB = wrap(fb);
  for (const [w, h] of [[1280, 900], [390, 844], [320, 640]]) {
    const { ctx, p } = await open(w, h, { d: dB });
    const r = await p.evaluate(() => {
      const bouts = [...document.querySelectorAll('#mtx-fc .mtx-fc-bout')].map(b => ({ h: b.querySelector('h3').textContent, f: [...b.querySelectorAll('.mtx-fc-f')].map(f => [...f.children].map(c => c.textContent)), v: b.querySelector('.mtx-fc-v').textContent }));
      const poster = document.querySelector('.mtx-fc-poster'), info = document.querySelector('.mtx-fc-cardinfo');
      return { bouts, h1: document.querySelectorAll('#mtx-fc h1').length, h2: [...document.querySelectorAll('#mtx-fc h2')].map(e => e.textContent), over: document.documentElement.scrollWidth - innerWidth,
        pill: [...document.querySelectorAll('.mtx-fc-pill')].map(e => e.textContent), poster: poster ? { prio: poster.getAttribute('fetchpriority'), lazy: poster.getAttribute('loading'), w: poster.getAttribute('width'), h: poster.getAttribute('height'), left: Math.round(poster.getBoundingClientRect().right) <= Math.round(info.getBoundingClientRect().left) + 1 } : null,
        cta: [...document.querySelectorAll('#mtx-fc [data-mtx-cta-fixed]')].map(a => [a.textContent.trim(), a.getAttribute('href')]), stateA: document.querySelectorAll('[data-mtx-state="A"]').length,
        text: document.querySelector('#mtx-fc').textContent };
    });
    console.log(`   ${String(w).padStart(5)}px  ${r.bouts.length} bouts  poster beside details: ${r.poster && r.poster.left}  overflow ${r.over}`);
    if (r.bouts.length !== 7) fail(`${w}px: ${r.bouts.length} bouts`);
    r.bouts.forEach((b, i) => { const x = fx.bouts[i];
      if (b.h !== `Bout ${x.n}` || b.f[0][0] !== x.a || b.f[0][1] !== x.ag || b.f[1][0] !== x.b || b.f[1][1] !== x.bg || b.v !== 'vs') fail(`${w}px: bout ${i + 1} differs from the published order and spelling: ${JSON.stringify(b)}`); });
    if (r.h1 !== 1) fail('State B has ' + r.h1 + ' h1');
    if (r.stateA) fail('State A is still on the page in State B');
    if (r.over > 0) fail(`${w}px: sideways overflow in State B`);
    if (!r.pill.includes('Confirmed')) fail('State B status is not Confirmed: ' + r.pill);
    if (!r.poster || r.poster.prio !== 'high' || r.poster.lazy === 'lazy' || r.poster.w !== '900') fail('poster is lazy, or has no reserved size');
    if (w >= 1024 && r.poster && !r.poster.left) fail('the poster is not beside the details on desktop');
    if (r.cta[0][0] !== 'Choose seats for Friday 2 October' || r.cta[0][1] !== 'https://muaytix.com/rajadamnern-knockout/2026-10-02') fail('State B button: ' + JSON.stringify(r.cta));
    if (/\u2014|TBA/.test(r.text)) fail('em dash or TBA in State B');
    await ctx.close();
  }
  ok('seven bouts in the published order with the published spellings, status Confirmed, poster above the fold and not lazy, button to the card date, no State A block');
  const bl = JSON.parse(fb.match(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/)[1]);
  if (bl['@type'] !== 'CollectionPage' || /Event/.test(fb.match(/"@type": "[A-Za-z]+"/g).join())) fail('State B schema'); else ok('State B schema is still CollectionPage, ItemList and BreadcrumbList only');
  const { ctx, p } = await open(1280, 900, { d: dB });
  const c = await p.evaluate(() => {
    const parse = s => (s.match(/[\d.]+/g) || []).map(Number);
    const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
    const bg = el => { for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c.length >= 3 && (c.length < 4 || c[3] > .5)) return c.slice(0, 3); } return [255, 255, 255]; };
    const out = []; for (const el of document.querySelectorAll('#mtx-fc .mtx-fc-sec--card *')) { if (!([...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()))) continue;
      const a = lum(parse(getComputedStyle(el).color).slice(0, 3)), b = lum(bg(el)), ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05); if (ratio < 4.5) out.push(el.className + ' ' + ratio.toFixed(1)); } return out; });
  if (c.length) fail('State B contrast: ' + c.join(', ')); else ok('State B card area passes 4.5:1 contrast');
  await ctx.close();
}

/* ---- 8. css scope ---- */
console.log('\n=== 8. CSS STAYS INSIDE THE BLOCK ===');
{
  const css = readFileSync('style.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const sel = []; css.replace(/(^|\})\s*([^{}@][^{}]*)\{/g, (_, __, s) => { s.split(',').forEach(x => sel.push(x.trim())); return ''; });
  const loose = sel.filter(s => s && !/^@/.test(s) && !/^(\.mtx-fc-page|#mtx-fc)/.test(s) && !/^\d+%$/.test(s));
  if (loose.length) fail('selectors outside the block: ' + loose.slice(0, 4).join(' | ')); else ok(`${sel.length} selectors, all under .mtx-fc-page or #mtx-fc`);
  if (/<(html|head|body)[\s>]/i.test(frag)) fail('html, head or body tag in the block'); else ok('no html, head or body wrappers; no header, footer or booking logic touched');
  if (/@import|https?:\/\/[^"')]*\.(css|woff2?)/.test(frag)) fail('an outside file is loaded'); else ok('nothing loaded from outside the block');
  if (/#(8B4513|A0522D|654321|5C4033|795548|6D4C41|8D6E63)/i.test(css)) fail('a brown is in the CSS'); else ok('no brown in the CSS');
}

/* ---- 9. contrast, State A ---- */
console.log('\n=== 9. CONTRAST ===');
{
  const { ctx, p } = await open(1280, 800);
  const bad = await p.evaluate(() => {
    const parse = s => (s.match(/[\d.]+/g) || []).map(Number);
    const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
    const bg = el => { for (let e = el; e; e = e.parentElement) { const cs = getComputedStyle(e); const c = parse(cs.backgroundColor); if (c.length >= 3 && (c.length < 4 || c[3] > 0.5)) return c.slice(0, 3); if (e.classList && e.classList.contains('mtx-fc-hero')) return [14, 36, 110]; } return [255, 255, 255]; };
    const out = []; let n = 0;
    for (const el of document.querySelectorAll('#mtx-fc *')) {
      if (['SCRIPT', 'STYLE', 'IMG'].includes(el.tagName) || el instanceof SVGElement) continue;
      if (!([...el.childNodes].some(c => c.nodeType === 3 && c.textContent.trim()))) continue; n++;
      const fg = parse(getComputedStyle(el).color).slice(0, 3), b = bg(el), L1 = lum(fg), L2 = lum(b), ratio = (Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05);
      if (ratio < 4.5) out.push(`${el.className || el.tagName} ${ratio.toFixed(1)}:1 "${el.textContent.trim().slice(0, 24)}"`);
    }
    return { n, out };
  });
  console.log(`   ${bad.n} text nodes checked, ${bad.out.length} under 4.5:1`);
  bad.out.forEach(x => fail('contrast ' + x));
  await ctx.close();
}

await browser.close();
console.log(`\n   Failures: ${fails}`);
console.log(fails ? '\nNOT ACCEPTABLE: fix the failures above.' : '\nAll checks passed.');
process.exit(fails ? 1 : 0);
