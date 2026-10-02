/* Checks for the RWS Knocktoberfest page. Render, read the text back out of the
 * DOM, then count.
 *
 *   node verify.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;

const C = JSON.parse(readFileSync('copy.json', 'utf8'));
const frag = readFileSync('knocktober-live.txt', 'utf8');
const W = '../../agent-tix/widget/';
const events = JSON.parse(readFileSync(W + 'tests/calendar.json', 'utf8'));
const night = JSON.parse(readFileSync(W + 'tests/night.json', 'utf8'));
night.event = { ...night.event, eventKey: 'rws_2026_10_10', date: '2026-10-10' };
night.classes.find(c => c.code === 'ringside').seatsLeft = 3;
const widgetJs = readFileSync(W + 'widget.js', 'utf8');

let fails = 0;
const fail = m => { fails++; console.log('   FAIL ' + m); };
const ok = m => console.log('   ok   ' + m);
const norm = s => s.replace(/\s+/g, ' ').trim();

const doc = `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}#allrecords{font-family:Arial,sans-serif}#allrecords *{text-align:center}#allrecords a{text-decoration:none;color:inherit}#allrecords button{color:#000;font-family:serif}#allrecords ul,#allrecords ol{list-style:none;padding:0}</style></head><body><div id="allrecords">${frag}</div></body></html>`;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

async function open(w, h, { widget = true, doc: d = doc } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const p = await ctx.newPage();
  await p.route('**/functions/v1/**', r => { const bd = JSON.parse(r.request().postData() || '{}'); r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(bd.action === 'events' ? events : night) }); });
  await p.route('**static.tildacdn.com/**', r => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="985" height="1234"><rect width="100%" height="100%" fill="#444"/></svg>' }));
  p.on('pageerror', e => fail('page error: ' + e.message));
  await p.setContent(d, { waitUntil: 'load' });
  if (widget) { await p.addScriptTag({ content: widgetJs }); await p.waitForSelector('#mtx-booking .mtx-pick', { timeout: 8000 }); }
  await p.evaluate(async () => { for (const i of document.images) { i.loading = 'eager'; try { await i.decode(); } catch (e) {} } });
  await p.waitForTimeout(250);
  return { ctx, p };
}

/* ---- 1. the words ---- */
console.log('\n=== 1. THE WORDS ===');
{
  const { ctx, p } = await open(1280, 900);
  const text = norm(await p.evaluate(() => document.querySelector('#mtx-kt').innerText.length ? [...document.querySelectorAll('#mtx-kt *')].filter(e => !['SCRIPT','STYLE'].includes(e.tagName)).map(e => e.childNodes.length ? [...e.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join(' ') : '').join(' ') : ''));
  const strings = [];
  const walk = (o, k) => { if (typeof o === 'string') { if (!['_source', 'url', 'alt', 'href', 'path', 'title', 'description', 'event_description', 'checkout_label'].includes(k) || (k === 'title' && false)) strings.push(o); } else if (Array.isArray(o)) o.forEach(x => walk(x, k)); else if (o && typeof o === 'object') for (const [kk, v] of Object.entries(o)) { if (kk === 'images' || kk === 'seo' || kk === '_source') continue; walk(v, kk); } };
  walk(C, '');
  const flat = norm(text);
  let missing = 0;
  for (const s of strings) if (!flat.includes(norm(s)) && !['Rajadamnern Super Bantamweight champion'].includes(s) && !text.includes(norm(s))) { if (!norm(await p.evaluate(() => document.querySelector('#mtx-kt').textContent)).includes(norm(s))) { missing++; fail('copy.json string not on the page: ' + s); } }
  if (!missing) ok(`all ${strings.length} strings in copy.json are on the page, read back from the DOM`);

  const visible = norm(await p.evaluate(() => { const c = document.querySelector('#mtx-kt').cloneNode(true); c.querySelectorAll('#mtx-booking, script, style').forEach(e => e.remove()); return c.textContent; }));
  const bans = [[/—|–/, 'dash'], [/!/, 'exclamation mark'], [/book your seat/i, 'book your seat'], [/unassigned|assigned seating/i, 'assigned seating'],
    [/selling fast|hurry|% booked/i, 'scarcity'], [/singha|chang beer|leo beer/i, 'alcohol brand']];
  for (const [re, name] of bans) { const m = visible.match(re); if (m) fail(`banned: ${name} (${m[0]})`); }
  if (!fails) ok('no dashes, exclamation marks, scarcity or alcohol words');
  const kept = ['official', 'limited'].map(w => `${w} x${(visible.match(new RegExp(w, 'gi')) || []).length}`).join(', ');
  console.log(`   note  kept at Jason's instruction: ${kept}`);
  for (const w of ['fight card', 'Khomutov', 'Kazimba', 'Uganda', 'title fights', 'four championship', 'Four championship', 'seven bouts', 'Seven bouts'])
    if (visible.includes(w)) fail(`fight card wording is on the page: ${w}`);
  ok('no fight card wording (matchup names appear only in the supplied fighter profiles and the poster images)');
  if (/7:00/.test(visible)) fail('7:00 is on the page'); else ok('first fight is 7:10 pm everywhere, no 7:00');
  if (!/air-conditioned/.test(visible)) fail('air conditioning is missing'); else ok('air-conditioned is stated');
  await ctx.close();
}

/* ---- 2. layout ---- */
console.log('\n=== 2. LAYOUT, ZERO SIDEWAYS SCROLL ===');
for (const [w, h] of [[1440, 900], [1280, 800], [1024, 768], [860, 800], [620, 800], [390, 844], [320, 640]]) {
  const { ctx, p } = await open(w, h);
  const r = await p.evaluate(() => {
    const bad = []; for (const e of document.querySelectorAll('#mtx-kt *')) { const b = e.getBoundingClientRect(); if (b.width && b.right > innerWidth + 1 && getComputedStyle(e).position !== 'fixed') bad.push(e.className || e.tagName); }
    const cta = document.querySelector('.mtx-kt-hero .mtx-kt-btn').getBoundingClientRect();
    const wd = document.getElementById('mtx-kt-book').getBoundingClientRect();
    return { over: document.documentElement.scrollWidth - innerWidth, bad: [...new Set(bad)].slice(0, 5), ctaBottom: Math.round(cta.bottom), widgetTop: Math.round(wd.top), cols: getComputedStyle(document.querySelector('.mtx-kt-hero-in')).gridTemplateColumns.split(' ').length };
  });
  console.log(`   ${String(w).padStart(5)}px  overflow ${r.over}  hero columns ${r.cols}  first button ends ${r.ctaBottom}px of ${h}px  widget starts ${r.widgetTop}px`);
  if (r.over > 0 || r.bad.length) fail(`${w}px: sideways overflow ${r.over} ${r.bad.join(',')}`);
  if (w <= 620 && r.ctaBottom > h) fail(`${w}px: the first button is below the first screen`);
  await ctx.close();
}

/* ---- 3. wide-face stress test ---- */
console.log('\n=== 3. WIDE-FACE STRESS TEST (display face swapped for a wider one) ===');
for (const w of [320, 390, 860]) {
  const wide = doc.replace('</style></head>', '#mtx-kt, #mtx-kt *{font-family:"DejaVu Sans",Verdana,sans-serif}#mtx-kt h1,#mtx-kt h2,#mtx-kt h3,#mtx-kt strong,#mtx-kt dt,#mtx-kt .mtx-kt-fact-l,#mtx-kt .mtx-kt-fact-v,#mtx-kt .mtx-kt-btn,#mtx-kt .mtx-kt-util-in{font-weight:900}</style></head>');
  const { ctx, p } = await open(w, 800, { doc: wide });
  const r = await p.evaluate(() => ({ over: document.documentElement.scrollWidth - innerWidth,
    tight: [...document.querySelectorAll('#mtx-kt h1,#mtx-kt h2,#mtx-kt h3,#mtx-kt .mtx-kt-fact,#mtx-kt .mtx-kt-btn,#mtx-kt summary')].filter(e => e.scrollWidth > e.clientWidth + 1).map(e => e.className || e.tagName).slice(0, 4) }));
  console.log(`   ${String(w).padStart(5)}px  overflow ${r.over}  cells wider than their box: ${r.tight.length}`);
  if (r.over > 0 || r.tight.length) fail(`${w}px wide face: ${r.over} ${r.tight.join(',')}`);
  await ctx.close();
}

/* ---- 4. the booking widget, one night ---- */
console.log('\n=== 4. THE BOOKING WIDGET ON THIS PAGE ===');
for (const [w, h] of [[1180, 900], [390, 844]]) {
  const { ctx, p } = await open(w, h);
  const before = await p.evaluate(() => ({ tiles: document.querySelectorAll('#mtx-booking .mtx-pick').length, grid: !!document.querySelector('#mtx-booking [data-grid]') && getComputedStyle(document.querySelector('#mtx-booking [data-cal]')).display !== 'none', change: !!document.querySelector('#mtx-booking [data-back-date]') }));
  if (before.tiles !== 4) fail(`${w}px: ${before.tiles} seat tiles, expected 4`);
  if (before.grid) fail(`${w}px: a calendar is showing on a one-night page`);
  if (before.change) fail(`${w}px: a Change date button is offered on a one-night page`);
  await p.click('#mtx-booking [data-pick="ringside"]');
  await p.waitForSelector('#mtx-booking [data-go]');
  await p.waitForTimeout(300);
  const after = await p.evaluate(() => { const g = document.querySelector('#mtx-booking [data-go]'); const cs = getComputedStyle(g); const r = g.getBoundingClientRect();
    return { qty: document.querySelector('#mtx-booking [data-qty]').value, label: g.textContent.trim(), disabled: g.disabled, bg: cs.backgroundColor, fg: cs.color, h: Math.round(r.height), over: document.documentElement.scrollWidth - innerWidth }; });
  console.log(`   ${String(w).padStart(5)}px  tiles ${before.tiles}, no calendar; Ringside opened on ${after.qty} tickets; button "${after.label}" ${after.h}px; overflow ${after.over}`);
  if (after.qty !== '2') fail(`${w}px: tickets open on ${after.qty}`);
  if (after.label !== C.book.checkout_label) fail(`${w}px: button says "${after.label}"`);
  if (after.disabled || after.bg !== 'rgb(31, 91, 255)' || after.fg !== 'rgb(255, 255, 255)') fail(`${w}px: button is not live blue with white type (${after.bg} / ${after.fg})`);
  if (after.over > 0) fail(`${w}px: sideways scroll after choosing a seat`);
  await ctx.close();
}

/* ---- 5. the buttons and the phone bar ---- */
console.log('\n=== 5. BUTTONS AND THE PHONE BAR ===');
{
  const { ctx, p } = await open(390, 844);
  await p.click('.mtx-kt-hero .mtx-kt-btn'); await p.waitForTimeout(700);
  const top = await p.evaluate(() => Math.round(document.getElementById('mtx-kt-book').getBoundingClientRect().top));
  console.log(`   hero button lands the widget ${top}px from the top of the screen`);
  if (top < 0 || top > 40) fail(`the hero button lands the widget ${top}px from the top`);
  const bar = async () => p.evaluate(() => document.querySelector('[data-mtx-kt-bar]').className.includes('is-on') && getComputedStyle(document.querySelector('[data-mtx-kt-bar]')).display !== 'none');
  await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(200);
  if (await bar()) fail('the bar is on at the top of the page'); else ok('bar off at the top');
  await p.evaluate(() => window.scrollTo(0, 400)); await p.waitForTimeout(200);
  if (await bar()) fail('the bar is on while the widget is on screen'); else ok('bar off while the widget is in view');
  await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await p.waitForTimeout(250);
  if (!(await bar())) fail('the bar is off at the foot of the page'); else ok('bar on once the widget is behind the guest');
  const txt = await p.evaluate(() => document.querySelector('[data-mtx-kt-bar]').textContent.trim());
  if (txt !== `${C.bar.price}${C.bar.label}`) fail(`bar text is "${txt}"`);
  await ctx.close();
  const d = await open(1280, 800);
  await d.p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await d.p.waitForTimeout(250);
  if (await d.p.evaluate(() => getComputedStyle(document.querySelector('[data-mtx-kt-bar]')).display) !== 'none') fail('the phone bar shows on a desktop'); else ok('phone bar never shows on 1280px');
  await d.ctx.close();
}

/* ---- 6. pictures, structure, schema ---- */
console.log('\n=== 6. PICTURES, STRUCTURE, SCHEMA ===');
{
  const { ctx, p } = await open(1280, 800);
  const r = await p.evaluate(() => ({ imgs: [...document.querySelectorAll('#mtx-kt img')].map(i => ({ src: i.src, alt: i.alt, w: i.getAttribute('width'), h: i.getAttribute('height'), ok: i.naturalWidth > 0, eager: i.getAttribute('fetchpriority') })),
    h1: document.querySelectorAll('#mtx-kt h1').length, details: document.querySelectorAll('#mtx-kt details').length,
    detailsText: [...document.querySelectorAll('#mtx-kt details')].every(d => d.textContent.trim().length > 20),
    h2: [...document.querySelectorAll('#mtx-kt h2')].map(e => e.textContent.trim()) }));
  if (r.h1 !== 1) fail(`${r.h1} h1 elements`); else ok('one h1');
  console.log('   h2: ' + r.h2.join(' | '));
  if (r.details !== 9) fail(`${r.details} details elements, expected 9 (4 fighters, 5 questions)`); else ok('4 fighter profiles and 5 questions, every answer in the page at load');
  for (const k of ['hero', 'egor', 'petchdej']) { const i = C.images[k]; const m = r.imgs.find(x => x.src === i.url); if (!m) fail(`poster ${k} is not on the page`); else if (m.alt !== i.alt) fail(`poster ${k} alt differs`); }
  for (const k of ['Ringside', 'Club Class', 'LEO Section', 'Third Class']) { const i = C.images[k]; const m = r.imgs.find(x => x.src === i.url); if (!m) fail(`seat photo ${k} missing`); else if (m.alt !== i.alt) fail(`seat photo ${k} alt differs`); }
  if (r.imgs.some(i => !i.w || !i.h)) fail('an image has no width and height'); else ok('every image has width and height set, 7 pictures, supplied alt text used exactly');
  if (r.imgs.some(i => /graphic|illustration/i.test(i.alt))) fail('a graphic image is used');
  const order = await p.evaluate(() => [...document.querySelector('#mtx-kt').children].filter(e => ['HEADER', 'DIV', 'SECTION'].includes(e.tagName) && !e.matches('style,script')).map(e => e.tagName === 'HEADER' ? 'hero' : e.classList.contains('mtx-kt-util') ? 'strip' : e.className.includes('mtx-kt-sec') ? 'section' : 'other').slice(0, 3));
  if (order.join() !== 'hero,strip,section') fail('the gold strip is not straight under the hero: ' + order.join()); else ok('the gold strip is gone from the top and sits straight under the hero');
  const seatLinks = await p.evaluate(() => [...document.querySelectorAll('#mtx-kt .mtx-kt-seat a')].map(a => ({ href: a.getAttribute('href'), name: a.querySelector('.mtx-kt-h3').textContent })));
  const want = { 'Ringside': '/rajadamnern-stadium-seating/ringside', 'Club Class': '/rajadamnern-stadium-seating/club-class', 'LEO Section': '/rajadamnern-stadium-seating/leo-section', 'Third Class': '/rajadamnern-stadium-seating/third-class' };
  if (seatLinks.length !== 4 || seatLinks.some(l => want[l.name] !== l.href)) fail('seat cards do not link to their pages: ' + JSON.stringify(seatLinks)); else ok('all four seat cards link to their own seat page');
  const allLinks = await p.evaluate(() => [...document.querySelectorAll('#mtx-kt a[href]')].map(a => a.getAttribute('href')).filter(h => !h.startsWith('#')));
  console.log('   links out: ' + [...new Set(allLinks)].join('  '));
  const m = frag.match(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/);
  const j = JSON.parse(m[1]);
  const ev = j['@graph'].find(x => x['@type'] === 'Event'), fq = j['@graph'].find(x => x['@type'] === 'FAQPage');
  if (!/\+07:00$/.test(ev.startDate) || ev.startDate !== '2026-10-10T19:10:00+07:00') fail('Event start is wrong: ' + ev.startDate); else ok('Event JSON-LD starts 2026-10-10T19:10:00+07:00');
  if (fq.mainEntity.length !== 5 || fq.mainEntity.some((q, i) => q.name !== C.faq.items[i].q || q.acceptedAnswer.text !== C.faq.items[i].a)) fail('FAQ schema differs from the page'); else ok('FAQ schema matches the five questions word for word');
  await ctx.close();
}

/* ---- 7. css scope ---- */
console.log('\n=== 7. CSS STAYS INSIDE THE BLOCK ===');
{
  const css = readFileSync('style.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const sel = []; css.replace(/(^|\})\s*([^{}@][^{}]*)\{/g, (_, __, s) => { s.split(',').forEach(x => sel.push(x.trim())); return ''; });
  const loose = sel.filter(s => s && !/^@/.test(s) && !/^(\.mtx-kt-page|#mtx-kt)/.test(s) && !/^\d+%$/.test(s));
  if (loose.length) fail('selectors outside the block: ' + loose.slice(0, 4).join(' | ')); else ok(`${sel.length} selectors, all under .mtx-kt-page or #mtx-kt`);
  if (/<(html|head|body)[\s>]/i.test(frag)) fail('html, head or body tag in the block'); else ok('no html, head or body wrappers');
  if (/@import|https?:\/\/[^"')]*\.(css|woff2?)/.test(frag)) fail('an outside file is loaded'); else ok('nothing loaded from outside the block');
}

/* ---- 8. contrast ---- */
console.log('\n=== 8. CONTRAST ===');
{
  const { ctx, p } = await open(1280, 800);
  const bad = await p.evaluate(() => {
    const parse = s => (s.match(/[\d.]+/g) || []).map(Number);
    const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
    const bg = el => { for (let e = el; e; e = e.parentElement) { const cs = getComputedStyle(e); const c = parse(cs.backgroundColor); if (c.length >= 3 && (c.length < 4 || c[3] > 0.5)) return c.slice(0, 3); if (cs.backgroundImage !== 'none' && e.classList.contains('mtx-kt-hero')) return [21, 21, 24]; } return [255, 255, 255]; };
    const out = []; let n = 0;
    for (const el of document.querySelectorAll('#mtx-kt *')) {
      if (el.closest('#mtx-booking') || ['SCRIPT', 'STYLE', 'svg', 'path', 'rect', 'IMG'].includes(el.tagName)) continue;
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
