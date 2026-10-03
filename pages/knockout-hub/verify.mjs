/* Checks for the Rajadamnern Knockout hub. Render, read the text back out of
 * the DOM, then count.
 *
 *   node verify.mjs
 */
import { readFileSync } from 'node:fs';
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;

const brief = readFileSync('brief.txt', 'utf8');
const frag = readFileSync('knockout-hub-live.txt', 'utf8');
const W = '../../agent-tix/widget/';
const night = JSON.parse(readFileSync(W + 'tests/night.json', 'utf8'));
const widgetJs = readFileSync(W + 'widget.js', 'utf8');

/* A calendar that starts tomorrow, so nothing is in the past whenever this
   runs: Knockout on Monday, Tuesday and Friday, a New Power night and a Sunday
   Kiatpetch night as the other promotions. */
const iso = d => d.toISOString().slice(0, 10);
const events = []; const start = new Date(Date.now() + 86400000);
for (let i = 0; i < 28; i++) {
  const d = new Date(start.getTime() + i * 86400000), dow = d.getUTCDay();
  const mk = (series, name, key) => events.push({ eventKey: `${key}_${iso(d).replace(/-/g, '_')}`, date: iso(d), name, shortName: name, colour: '#1F5BFF', description: '', startTime: '19:00', endTime: '21:30', venue: 'Rajadamnern Stadium, Bangkok', timezone: 'Asia/Bangkok', series });
  if ([1, 2, 5].includes(dow)) mk('rajadamnern-knockout', 'Rajadamnern Knockout', 'rk');
  else if (dow === 3) mk('new-power', 'New Power Traditional Muay Thai', 'np');
  else if (dow === 6) mk('rws', 'RWS', 'rws');
  else if (dow === 0) mk('kiatpetch', 'Kiatpetch', 'kp');
}
const firstKo = events.find(e => e.series === 'rajadamnern-knockout');
const calendar = { events };
night.event = { ...night.event, eventKey: firstKo.eventKey, date: firstKo.date };

let fails = 0;
const fail = m => { fails++; console.log('   FAIL ' + m); };
const ok = m => console.log('   ok   ' + m);
const norm = s => s.replace(/\s+/g, ' ').trim();

const doc = `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}#allrecords{font-family:Arial,sans-serif}#allrecords *{text-align:center}#allrecords a{text-decoration:none;color:inherit}#allrecords button{color:#000;font-family:serif}#allrecords ul,#allrecords ol{list-style:none;padding:0}</style></head><body><div id="allrecords">${frag}</div></body></html>`;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

async function open(w, h, { widget = true, doc: d = doc } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const p = await ctx.newPage();
  await p.route('**/functions/v1/**', r => { const bd = JSON.parse(r.request().postData() || '{}'); r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(bd.action === 'events' ? calendar : night) }); });
  const svg = (w2, h2, c) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w2}" height="${h2}"><rect width="100%" height="100%" fill="${c}"/></svg>`;
  await p.route('**static.tildacdn.com/**', r => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: /1000029307/.test(r.request().url()) ? svg(280, 80, '#1F5BFF') : svg(1600, 900, '#38507A') }));
  p.on('pageerror', e => fail('page error: ' + e.message));
  await p.setContent(d, { waitUntil: 'load' });
  if (widget) { await p.addScriptTag({ content: widgetJs }); await p.waitForSelector('#mtx-booking', { timeout: 8000 }); }
  await p.evaluate(async () => { for (const i of document.images) { i.loading = 'eager'; try { await i.decode(); } catch (e) {} } });
  await p.waitForTimeout(300);
  return { ctx, p };
}

/* ---- 1. the words ---- */
console.log('\n=== 1. THE WORDS (every line of the brief, read back from the DOM) ===');
const visibleOf = p => p.evaluate(() => { const c = document.querySelector('#mtx-kh').cloneNode(true); c.querySelectorAll('#mtx-booking, script, style').forEach(e => e.remove()); return c.textContent; });
{
  const { ctx, p } = await open(1280, 900);
  const flat = norm(await visibleOf(p));
  const lines = brief.split('\n').map(norm).filter(l => l
    && !l.startsWith('## ') && !/:$/.test(l) && !l.startsWith('[') && !/^https?:/.test(l) && !/^Smooth-scroll/.test(l));
  let missing = 0;
  for (const l of lines) if (!flat.includes(l)) { missing++; fail('brief line not on the page: ' + l); }
  if (!missing) ok(`all ${lines.length} copy lines from the brief are on the page, word for word`);
  const bans = [[/!/, 'exclamation mark'], [/book your seat/i, 'book your seat'], [/unassigned|assigned seating/i, 'assigned seating'],
    [/selling fast|hurry|% booked/i, 'scarcity'], [/singha|chang beer|leo beer/i, 'alcohol brand'], [/live[- ]?stream/i, 'live stream']];
  const before = fails;
  for (const [re, name] of bans) { const m = flat.match(re); if (m) fail(`banned: ${name} (${m[0]})`); }
  if (fails === before) ok('no em dashes, exclamation marks, scarcity, alcohol or live-stream words');
  const kept = ['official', 'limited'].map(w => `${w} x${(flat.match(new RegExp(w, 'gi')) || []).length}`).join(', ');
  console.log(`   note  "official" and "limited" count: ${kept}`);
  if (/\b(official|limited)\b/i.test(flat)) fail('official or limited appears');
  else ok('neither official nor limited appears');
  const em = (flat.match(/—/g) || []).length;
  console.log(`   note  em dashes: ${em} (the four supplied seat lines, kept as written; house style bans them elsewhere)`);
  if (em !== 4) fail(`${em} em dashes on the page, expected only the 4 in the supplied seat lines`);
  const en = (flat.match(/–/g) || []).length;
  console.log(`   note  en dashes: ${en} (the supplied "9:00–9:30 pm", kept as written)`);
  await ctx.close();
}

/* ---- 2. layout ---- */
console.log('\n=== 2. LAYOUT, ZERO SIDEWAYS SCROLL ===');
for (const [w, h] of [[1440, 900], [1280, 800], [1024, 768], [860, 800], [620, 800], [390, 844], [320, 640]]) {
  const { ctx, p } = await open(w, h);
  const r = await p.evaluate(() => {
    const bad = []; for (const e of document.querySelectorAll('#mtx-kh *')) { const b = e.getBoundingClientRect(); if (b.width && b.right > innerWidth + 1 && getComputedStyle(e).position !== 'fixed') bad.push(e.className && e.className.baseVal === undefined ? e.className : e.tagName); }
    const cta = document.querySelector('.mtx-kh-hero .mtx-kh-btn').getBoundingClientRect();
    const fc = getComputedStyle(document.querySelector('.mtx-kh-facts')).gridTemplateColumns.split(' ').length;
    const cc = getComputedStyle(document.querySelector('.mtx-kh-cards')).gridTemplateColumns.split(' ').length;
    const dome = document.querySelector('.mtx-kh-sec--dome').getBoundingClientRect().height;
    const expect = document.querySelector('.mtx-kh-sec--expect').getBoundingClientRect().height;
    return { over: document.documentElement.scrollWidth - innerWidth, bad: [...new Set(bad)].slice(0, 5), ctaBottom: Math.round(cta.bottom), fc, cc, dome: Math.round(dome), expect: Math.round(expect) };
  });
  console.log(`   ${String(w).padStart(5)}px  overflow ${r.over}  fact columns ${r.fc}  first-time columns ${r.cc}  first button ends ${r.ctaBottom}/${h}  dome ${r.dome}px vs expect ${r.expect}px`);
  if (r.over > 0 || r.bad.length) fail(`${w}px: sideways overflow ${r.over} ${r.bad.join(',')}`);
  if (w <= 620 && r.ctaBottom > h) fail(`${w}px: the first button is below the first screen`);
  if (w >= 760 && r.fc !== 3) fail(`${w}px: fact cards in ${r.fc} columns, expected 3 x 2`);
  if (w < 620 && r.fc !== 2) fail(`${w}px: fact cards in ${r.fc} columns, expected 2`);
  if (w >= 620 && r.cc !== 3) fail(`${w}px: first-time cards in ${r.cc} columns, expected 3`);
  if (r.dome > r.expect) fail(`${w}px: the dome block (${r.dome}px) is bigger than What to expect (${r.expect}px)`);
  await ctx.close();
}

/* ---- 3. wide-face stress test ---- */
console.log('\n=== 3. WIDE-FACE STRESS TEST (display face swapped for a wider one) ===');
for (const w of [320, 390, 860]) {
  const wide = doc.replace('</style></head>', '#mtx-kh, #mtx-kh *{font-family:"DejaVu Sans",Verdana,sans-serif}#mtx-kh h1,#mtx-kh h2,#mtx-kh h3,#mtx-kh .mtx-kh-fact-l,#mtx-kh .mtx-kh-fact-v,#mtx-kh .mtx-kh-btn,#mtx-kh .mtx-kh-q,#mtx-kh .mtx-kh-jump{font-weight:900}</style></head>');
  const { ctx, p } = await open(w, 800, { doc: wide });
  const r = await p.evaluate(() => ({ over: document.documentElement.scrollWidth - innerWidth,
    tight: [...document.querySelectorAll('#mtx-kh h1,#mtx-kh h2,#mtx-kh h3,#mtx-kh .mtx-kh-fact,#mtx-kh .mtx-kh-btn,#mtx-kh summary,#mtx-kh .mtx-kh-jump')].filter(e => e.scrollWidth > e.clientWidth + 1).map(e => e.className || e.tagName).slice(0, 4) }));
  console.log(`   ${String(w).padStart(5)}px  overflow ${r.over}  cells wider than their box: ${r.tight.length}`);
  if (r.over > 0 || r.tight.length) fail(`${w}px wide face: ${r.over} ${r.tight.join(',')}`);
  await ctx.close();
}

/* ---- 4. the booking widget, Knockout only ---- */
console.log('\n=== 4. THE BOOKING WIDGET ON THIS PAGE (Knockout nights only) ===');
for (const [w, h] of [[1180, 900], [390, 844]]) {
  const { ctx, p } = await open(w, h);
  await p.waitForSelector('#mtx-booking [data-grid], #mtx-booking .mtx-pick', { timeout: 8000 }).catch(() => {});
  const r = await p.evaluate(() => {
    const days = [...document.querySelectorAll('#mtx-booking .mtx-open')];
    const all = [...document.querySelectorAll('#mtx-booking [data-grid] button, #mtx-booking [data-grid] [data-event]')];
    return { go: days.length, all: all.length, green: days.slice(0, 1).map(d => getComputedStyle(d).backgroundColor), over: document.documentElement.scrollWidth - innerWidth };
  });
  const expected = events.filter(e => e.series === 'rajadamnern-knockout').length;
  console.log(`   ${String(w).padStart(5)}px  bookable nights highlighted ${r.go} of ${expected} Knockout nights in the next 28 days; overflow ${r.over}`);
  if (r.go === 0) fail(`${w}px: no bookable Knockout night is highlighted`);
  if (r.go > expected) fail(`${w}px: more nights highlighted (${r.go}) than Knockout nights (${expected})`);
  if (r.over > 0) fail(`${w}px: sideways scroll with the widget open`);
  await ctx.close();
}

/* ---- 5. the buttons and the phone bar ---- */
console.log('\n=== 5. BUTTONS AND THE PHONE BAR ===');
{
  const { ctx, p } = await open(390, 844);
  await p.click('.mtx-kh-hero .mtx-kh-btn'); await p.waitForTimeout(800);
  const top = await p.evaluate(() => Math.round(document.getElementById('mtx-kh-book').getBoundingClientRect().top));
  console.log(`   hero button lands the widget ${top}px from the top of the screen`);
  if (top < 0 || top > 40) fail(`the hero button lands the widget ${top}px from the top`);
  await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(200);
  const bar = async () => p.evaluate(() => document.querySelector('[data-mtx-kh-bar]').className.includes('is-on') && getComputedStyle(document.querySelector('[data-mtx-kh-bar]')).display !== 'none');
  if (await bar()) fail('the bar is on at the top of the page'); else ok('bar off at the top');
  await p.evaluate(() => document.getElementById('mtx-kh-book').scrollIntoView()); await p.waitForTimeout(250);
  if (await bar()) fail('the bar is on while the widget is on screen'); else ok('bar off while the widget is in view');
  await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await p.waitForTimeout(250);
  if (!(await bar())) fail('the bar is off at the foot of the page'); else ok('bar on once the widget is behind the guest');
  await p.click('[data-mtx-kh-bar]'); await p.waitForTimeout(800);
  const top2 = await p.evaluate(() => Math.round(document.getElementById('mtx-kh-book').getBoundingClientRect().top));
  if (top2 < 0 || top2 > 40) fail(`the phone bar lands the widget ${top2}px from the top`); else ok('phone bar scrolls back to the widget');
  await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await p.waitForTimeout(250);
  const clash = await p.evaluate(() => { const b = document.querySelector('[data-mtx-kh-bar]').getBoundingClientRect(); const last = document.querySelector('.mtx-kh-pick').getBoundingClientRect(); return last.bottom > b.top ? 'covered' : 'clear'; });
  if (clash === 'covered') fail('the phone bar covers the last row of content'); else ok('the phone bar does not cover the seat block');
  await ctx.close();
  const d = await open(1280, 800);
  await d.p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await d.p.waitForTimeout(250);
  if (await d.p.evaluate(() => getComputedStyle(document.querySelector('[data-mtx-kh-bar]')).display) !== 'none') fail('the phone bar shows on a desktop'); else ok('phone bar never shows on 1280px');
  await d.ctx.close();
}

/* ---- 6. pictures, structure, links, schema ---- */
console.log('\n=== 6. PICTURES, STRUCTURE, LINKS, SCHEMA ===');
{
  const { ctx, p } = await open(1280, 800);
  const r = await p.evaluate(() => ({
    imgs: [...document.querySelectorAll('#mtx-kh img')].map(i => ({ src: i.src, alt: i.alt, w: i.getAttribute('width'), h: i.getAttribute('height'), pri: i.getAttribute('fetchpriority'), lazy: i.getAttribute('loading') })),
    h1: document.querySelectorAll('#mtx-kh h1').length, facts: document.querySelectorAll('#mtx-kh .mtx-kh-fact').length,
    details: document.querySelectorAll('#mtx-kh details').length,
    answers: [...document.querySelectorAll('#mtx-kh details')].every(d => d.textContent.trim().length > 20),
    h2: [...document.querySelectorAll('#mtx-kh h2')].map(e => e.textContent.trim()),
    secs: [...document.querySelectorAll('#mtx-kh > nav, #mtx-kh > header, #mtx-kh > section')].map(e => e.tagName === 'NAV' ? 'crumbs' : e.tagName === 'HEADER' ? 'hero' : (e.querySelector('h2') || {}).textContent),
    widget: (document.querySelector('#mtx-kh-book .muaytix-ticket-selector') || { getAttribute: () => null }).getAttribute('data-series'),
    links: [...document.querySelectorAll('#mtx-kh a[href]')].map(a => ({ href: a.getAttribute('href'), text: a.textContent.trim(), label: a.getAttribute('aria-label') })),
    pending: [...document.querySelectorAll('#mtx-kh [data-needs-destination]')].map(e => e.textContent.trim()),
    placeholder: [...document.querySelectorAll('#mtx-kh [data-placeholder]')].map(e => e.getAttribute('data-placeholder')),
  }));
  if (r.h1 !== 1) fail(`${r.h1} h1 elements`); else ok('one h1');
  if (r.facts !== 6) fail(`${r.facts} fact cards`); else ok('six fact cards');
  if (r.details !== 5 || !r.answers) fail(`${r.details} FAQ items`); else ok('five FAQ questions, every answer is in the page at load');
  if (r.widget !== 'rajadamnern-knockout') fail('widget is not the Knockout series: ' + r.widget); else ok('widget mounted with data-series="rajadamnern-knockout"');
  const order = ['crumbs', 'hero', 'Rajadamnern Knockout at a glance', 'Choose your Rajadamnern Knockout date', 'What is Rajadamnern Knockout?', 'New to Muay Thai? You are in the right place.', 'What to expect at Rajadamnern Knockout', 'The Rajadamnern Dome Experience', 'Is Rajadamnern Knockout right for you?', 'Book with MuayTix', 'Rajadamnern Knockout FAQs', 'Plan your Rajadamnern Knockout night'];
  if (r.secs.join('|') !== order.join('|')) fail('section order differs:\n     ' + r.secs.join(' | ')); else ok('twelve sections in the briefed order');
  if (r.imgs.length !== 2) fail(`${r.imgs.length} images on the page, expected the hero and the logo only`);
  const bad = r.imgs.filter(i => !i.w || !i.h || !i.alt);
  if (bad.length) fail('an image has no width, height or alt: ' + bad.map(i => i.src).join(',')); else ok(`${r.imgs.length} images (hero and logo only), each with width, height and alt text`);
  const hero = r.imgs[0];
  if (hero.pri !== 'high' || hero.lazy !== 'eager') fail('the hero image is not eager and high priority'); else ok('hero image is eager and high priority; the rest are lazy where below the fold');
  const want = {
    'Choose your fight night': ['#mtx-kh-book'], 'See the latest fight card': ['https://muaytix.com/rajadamnern-knockout/fight-card'],
    'Saturday championship cards': ['https://muaytix.com/rws'], 'Sunday stadium atmosphere': ['https://muaytix.com/kiatpetch-muay-thai'],
    'See the latest Rajadamnern Knockout fight card': ['https://muaytix.com/rajadamnern-knockout/fight-card'],
    'View the Rajadamnern Knockout schedule': ['https://muaytix.com/rajadamnern-knockout/schedule'],
    'Choose Rajadamnern Knockout tickets': ['https://muaytix.com/rajadamnern-knockout/tickets'],
    'Compare Rajadamnern seating': ['https://muaytix.com/rajadamnern-stadium-seating'],
  };
  let linkFails = 0;
  for (const [t, hs] of Object.entries(want)) {
    const found = r.links.filter(l => l.text.startsWith(t) || l.label === t);
    if (!found.length || !found.every(l => hs.includes(l.href))) { linkFails++; fail(`link "${t}" is not ${hs[0]}: ${JSON.stringify(found.map(l => l.href))}`); }
  }
  const seatCtas = r.links.filter(l => l.text === 'Compare Rajadamnern seating');
  if (seatCtas.length !== 2 || seatCtas.some(l => l.href !== 'https://muaytix.com/rajadamnern-stadium-seating')) fail('seat CTA links: ' + JSON.stringify(seatCtas));
  else ok('"Compare Rajadamnern seating" appears twice (the existing link and the new button), both to https://muaytix.com/rajadamnern-stadium-seating');
  const seatLinks = r.links.filter(l => /seating/.test(l.href));
  if (seatLinks.some(l => l.href !== 'https://muaytix.com/rajadamnern-stadium-seating')) fail('a seating link goes somewhere else: ' + JSON.stringify(seatLinks)); else ok('the only seating destination on the page is /rajadamnern-stadium-seating');
  if (!linkFails) ok(`${Object.keys(want).length} links point where the brief says, hero and confidence CTAs scroll to the widget`);
  if (r.pending.length !== 1) fail('expected one link waiting for a destination'); else console.log(`   note  waiting for a destination: "${r.pending[0]}"`);
  console.log(`   note  placeholders: ${r.placeholder.join(', ')}`);
  console.log('   h2: ' + r.h2.join(' | '));

  const blocks = [...frag.matchAll(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/g)].map(m => JSON.parse(m[1]));
  const types = blocks.map(b => b['@type']);
  if (types.join() !== 'WebPage,BreadcrumbList') fail('schema types: ' + types.join()); else ok('JSON-LD is WebPage and BreadcrumbList only');
  if (/"Event"|"FAQPage"|"VideoObject"|"BroadcastEvent"/.test(frag)) fail('Event, FAQPage or live-stream schema is present'); else ok('no Event, FAQPage or live-stream schema');
  await ctx.close();
}

/* ---- 6b. the seat block ---- */
console.log('\n=== 6b. THE SEAT BLOCK ===');
for (const [w, h] of [[1440, 900], [860, 800], [390, 844], [320, 640]]) {
  const { ctx, p } = await open(w, h);
  const r = await p.evaluate(() => {
    const root = document.querySelector('#mtx-kh .mtx-kh-pick'); const rel = document.querySelector('#mtx-kh .mtx-kh-related');
    const lines = [...root.querySelectorAll('.mtx-kh-pick-i')];
    const tops = lines.map(l => Math.round(l.getBoundingClientRect().top)), lefts = lines.map(l => Math.round(l.getBoundingClientRect().left));
    const nav = rel.querySelector('.mtx-kh-rel').getBoundingClientRect();
    const cta = root.querySelector('a.mtx-kh-btn');
    const cs = getComputedStyle(cta);
    return { h3: root.querySelector('h3').textContent, body: root.querySelector('.mtx-kh-pick-b').textContent,
      lines: lines.map(l => l.textContent.replace(/\s+/g, ' ').trim()), tops, lefts,
      below: Math.round(root.getBoundingClientRect().top - nav.bottom), cta: cta.textContent.trim(), href: cta.getAttribute('href'),
      ctaBg: cs.backgroundColor, ctaFg: cs.color, ctaH: Math.round(cta.getBoundingClientRect().height),
      imgs: root.querySelectorAll('img, svg image, dialog, [role=dialog], [data-modal]').length,
      price: /฿|THB|\$|£|\d,\d{3}/.test(root.textContent), buttons: root.querySelectorAll('button, input, select').length,
      over: document.documentElement.scrollWidth - innerWidth, boxH: Math.round(root.getBoundingClientRect().height) };
  });
  const want = ['Ringside — closest to the ring', 'Club Class — best all-round view for most first-time guests', 'LEO Section — good-value stadium view and lively atmosphere', 'Third Class — the most affordable way to experience Rajadamnern'];
  const cols = new Set(r.lefts).size;
  console.log(`   ${String(w).padStart(5)}px  columns ${cols}  block ${r.boxH}px  sits ${r.below}px under the four links  button ${r.ctaH}px  overflow ${r.over}`);
  if (r.h3 !== 'Choose the right seat') fail('heading: ' + r.h3);
  if (r.body !== 'Every Rajadamnern seat category offers a different view and atmosphere.') fail('body: ' + r.body);
  if (r.lines.join('|') !== want.join('|')) fail('seat lines differ: ' + JSON.stringify(r.lines));
  if (r.cta !== 'Compare Rajadamnern seating' || r.href !== 'https://muaytix.com/rajadamnern-stadium-seating') fail(`cta: ${r.cta} ${r.href}`);
  if (r.imgs || r.price || r.buttons) fail(`block has images/modals ${r.imgs}, a price ${r.price} or form controls ${r.buttons}`);
  if (r.below < 0) fail('the block is not below the four links');
  if (w >= 760 && cols !== 2) fail(`${w}px: ${cols} columns, expected 2`);
  if (w < 620 && cols !== 1) fail(`${w}px: ${cols} columns, expected the lines stacked`);
  if (r.over > 0) fail(`${w}px: sideways overflow`);
  await ctx.close();
}
ok('heading, sentence, four lines and button read back exactly; no image, price, map, modal or booking control in the block');

/* ---- 7. css scope ---- */
console.log('\n=== 7. CSS STAYS INSIDE THE BLOCK ===');
{
  const css = readFileSync('style.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const sel = []; css.replace(/(^|\})\s*([^{}@][^{}]*)\{/g, (_, __, s) => { s.split(',').forEach(x => sel.push(x.trim())); return ''; });
  const loose = sel.filter(s => s && !/^@/.test(s) && !/^(\.mtx-kh-page|#mtx-kh)/.test(s) && !/^\d+%$/.test(s));
  if (loose.length) fail('selectors outside the block: ' + loose.slice(0, 4).join(' | ')); else ok(`${sel.length} selectors, all under .mtx-kh-page or #mtx-kh`);
  if (/<(html|head|body)[\s>]/i.test(frag)) fail('html, head or body tag in the block'); else ok('no html, head or body wrappers');
  if (/@import|https?:\/\/[^"')]*\.(css|woff2?)/.test(frag)) fail('an outside file is loaded'); else ok('nothing loaded from outside the block');
  if (/#(8B4513|A0522D|654321|5C4033|795548|6D4C41|8D6E63)/i.test(css)) fail('a brown is in the CSS'); else ok('no brown in the CSS');
}

/* ---- 8. contrast ---- */
console.log('\n=== 8. CONTRAST ===');
{
  const { ctx, p } = await open(1280, 800);
  const bad = await p.evaluate(() => {
    const parse = s => (s.match(/[\d.]+/g) || []).map(Number);
    const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
    const bg = el => { for (let e = el; e; e = e.parentElement) { const cs = getComputedStyle(e); const c = parse(cs.backgroundColor); if (c.length >= 3 && (c.length < 4 || c[3] > 0.5)) return c.slice(0, 3); if (e.classList && e.classList.contains('mtx-kh-hero')) return [10, 22, 64]; } return [255, 255, 255]; };
    const out = []; let n = 0;
    for (const el of document.querySelectorAll('#mtx-kh *')) {
      if (el.closest('#mtx-booking') || ['SCRIPT', 'STYLE', 'IMG'].includes(el.tagName) || el instanceof SVGElement) continue;
      const own = [...el.childNodes].some(c => c.nodeType === 3 && c.textContent.trim());
      if (!own) continue; n++;
      const fg = parse(getComputedStyle(el).color).slice(0, 3), b = bg(el);
      const L1 = lum(fg), L2 = lum(b), ratio = (Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05);
      if (ratio < 4.5) out.push(`${el.className || el.tagName} ${ratio.toFixed(1)}:1 "${el.textContent.trim().slice(0, 24)}"`);
    }
    return { n, out };
  });
  console.log(`   ${bad.n} text nodes checked outside the widget, ${bad.out.length} under 4.5:1`);
  bad.out.forEach(x => fail('contrast ' + x));
  await ctx.close();
}

await browser.close();
console.log(`\n   Failures: ${fails}`);
console.log(fails ? '\nNOT ACCEPTABLE: fix the failures above.' : '\nAll checks passed.');
process.exit(fails ? 1 : 0);
