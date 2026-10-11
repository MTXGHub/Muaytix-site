// Muay Thai Bangkok Tonight: read the built page back and check it against the brief
//
//   CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node verify.mjs
//   SHOTS=/some/folder   (optional) also saves a picture at 1280 and 390
//
// The paste file is loaded the way Tilda serves it (inside a page that already
// carries the booking widget's header block) in a real browser, then:
//
//   1  every word of Part B is on the page, in order, and nothing else is
//   2  the FAQPage schema is the visible FAQ text, word for word
//   3  Tonight / Tomorrow is right for every night, either side of 7:00 PM
//      Bangkok time, whatever time zone the guest's device is set to
//   4  the nine internal links, the Book Tickets anchors, the WhatsApp link
//   5  no sideways scrolling at 1440, 1280, 860, 620 and 390, widget in place
//   6  contrast of every piece of text of the page's own
//   7  the phone bar, the order of the page, and the words that must never appear

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(HERE, '..', '..');
async function loadPlaywright() {
  try { return await import('playwright'); }
  catch {
    const root = execSync('npm root -g', { encoding: 'utf8' }).trim();
    return await import(pathToFileURL(path.join(root, 'playwright', 'index.js')).href);
  }
}
const pw = await loadPlaywright();
const chromium = pw.chromium ?? pw.default.chromium;

const C = JSON.parse(fs.readFileSync(path.join(HERE, 'copy.json'), 'utf8'));
const block = fs.readFileSync(path.join(HERE, 'muay-thai-bangkok-tonight-PASTE-INTO-TILDA.html'), 'utf8');
const header = fs.readFileSync(path.join(REPO, 'agent-tix', 'widget', 'paste-into-tilda-header.html'), 'utf8');
const night = JSON.parse(fs.readFileSync(path.join(REPO, 'agent-tix', 'widget', 'tests', 'night.json'), 'utf8'));
const events = JSON.parse(fs.readFileSync(path.join(REPO, 'agent-tix', 'widget', 'tests', 'calendar.json'), 'utf8'));
const brief = fs.readFileSync(path.join(HERE, 'brief.txt'), 'utf8');

let pass = 0, fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail ? '  -> ' + String(detail).slice(0, 400) : '')); }
};
const sec = (t) => console.log('\n' + t);
const one = (s, l) => C[s][l][0];
const norm = (s) => s.replace(/\s+/g, ' ').trim();

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});

// A frozen clock: new Date() and Date.now() answer the instant given.
const frozen = (ms) => `(() => { const R = Date, f = ${ms};
  class F extends R { constructor(...a) { if (a.length === 0) super(f); else super(...a); } static now() { return f; } }
  window.Date = F; })();`;
// Bangkok wall time to an instant. Bangkok is UTC+7 all year.
const bkk = (y, m, d, h, mi) => Date.UTC(y, m - 1, d, h, mi) - 7 * 3600000;

async function open({ width = 1280, height = 900, now = null, tz = 'Asia/Bangkok', widget = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, locale: 'en-GB', timezoneId: tz });
  if (now !== null) await ctx.addInitScript(frozen(now));
  await ctx.route('**/functions/v1/**', async (route) => {
    const body = JSON.parse(route.request().postData() || '{}');
    if (route.request().url().endsWith('/availability')) {
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify(body.action === 'events' ? events : night) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"warm":true}' });
  });
  await ctx.route('https://muaytix.test/**', (r) => r.fulfill({ status: 200, contentType: 'text/html',
    body: `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>T</title>${widget ? header : ''}</head>
      <body style="margin:0"><div id="allrecords">${block}</div></body></html>` }));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('https://muaytix.test/muay-thai-bangkok-tonight', { waitUntil: 'domcontentloaded' });
  if (widget) await page.waitForSelector('#mtx-booking .mtx-pick, #mtx-booking .mtx-cal, #mtx-booking .mtx-month, #mtx-booking button', { timeout: 15000 }).catch(() => {});
  return { ctx, page, errors };
}

// The page's own visible text, in order, with the widget out of the way.
async function pageText(page) {
  return page.evaluate(() => {
    document.querySelectorAll('#mtx-tn details').forEach((d) => { d.open = true; });
    const slot = document.getElementById('mtx-tn-book');
    const was = slot.style.display; slot.style.display = 'none';
    const t = document.getElementById('mtx-tn').innerText;
    slot.style.display = was;
    return t;
  });
}

// ---------------------------------------------------------------------------
sec('1. Every word of Part B is on the page, in order, and nothing else');
{
  const { ctx, page, errors } = await open({ now: bkk(2026, 10, 14, 10, 0) });         // a Wednesday morning in Bangkok
  const text = norm(await pageText(page));
  const rowsIn = C['5']['Table rows'].map((l) => l.split(' | '));
  const expected = [
    one('2', 'H1'), one('2', 'Subheadline'), one('2', 'Body'), one('2', 'Detail line'), one('2', 'Primary button'), one('2', 'Secondary button'),
    one('3', 'Label before 7:00 PM Bangkok time'), 'New Power. Doors open 5:00 PM. First bout 6:00 PM.',
    one('4', 'H2'), one('4', 'Intro'),
    ...[1, 2, 3, 4, 5].flatMap((n) => [one('4', `Block ${n} headline`), one('4', `Block ${n} body`)]),
    one('5', 'H2'), ...one('5', 'Table header').split(' | '), ...rowsIn.flat(), one('5', 'Note under table'),
    one('6', 'H2'), one('6', 'Intro'),
    ...[1, 2, 3, 4].flatMap((n) => [one('6', `Block ${n} headline`), one('6', `Block ${n} body`)]), one('6', 'Closing line for the section'),
    one('7', 'H2'), one('7', 'Intro'),
    ...['Ringside, from 2,500 THB', 'Club Class, from 1,800 THB', 'LEO Section, from 1,500 THB', 'Third Class, from 1,000 THB'].flatMap((l) => [l, one('7', l)]),
    one('7', 'Closing line'),
    one('8', 'H2'), ...[1, 2, 3].flatMap((n) => [one('8', `Step ${n} headline`), one('8', `Step ${n} body`)]), one('8', 'Support line'),
    one('9', 'H2'), ...[1, 2, 3, 4, 5, 6, 7, 8].flatMap((n) => [one('9', `Q${n}`), one('9', `A${n}`)]),
    one('10', 'Headline'), one('10', 'Button'),
  ].map(norm);
  let cursor = 0, missing = null, stray = null;
  for (const e of expected) {
    const at = text.indexOf(e, cursor);
    if (at < 0) { missing = e; break; }
    const between = text.slice(cursor, at).trim();
    if (between !== '') { stray = between; break; }
    cursor = at + e.length;
  }
  check(`all ${expected.length} pieces of copy are there, in order`, missing === null, 'missing or out of order: ' + missing);
  check('with no extra word between them', stray === null, 'stray text: ' + stray);
  check('and nothing after the last one', text.slice(cursor).trim() === '', text.slice(cursor, cursor + 200));
  check('the page threw no errors', errors.length === 0, errors.join(' | '));
  // Every line of Part B in the brief file is a line of the page (the brief is the source of truth, not copy.json).
  const partB = brief.slice(brief.indexOf('PART B. COPY (PASTE READY)'));
  const lines = partB.split('\n').map((l) => l.trim()).filter((l) => l && !/:$/.test(l) && !/^\d+\. [A-Z ]+/.test(l) && !/^=+$/.test(l) && !/^PART B/.test(l));
  const metaOnly = new Set([one('1', 'Title'), one('1', 'Meta description'), one('1', 'Social title'), one('1', 'Social description'),
    one('3', 'Label from 7:00 PM Bangkok time (shows the next night)'), one('3', 'Line, filled from the table for the current night')]);
  const tableLines = new Set([...C['5']['Table rows'], one('5', 'Table header')]);
  const notShown = lines.filter((l) => !metaOnly.has(l) && !tableLines.has(l) && !text.includes(norm(l)));
  check('every other line of Part B in brief.txt appears on the page', notShown.length === 0, notShown.join(' || '));
  await ctx.close();
}

// ---------------------------------------------------------------------------
sec('2. FAQPage schema is the visible FAQ, word for word');
{
  const { ctx, page } = await open({ widget: false });
  const got = await page.evaluate(() => {
    const ld = [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => JSON.parse(s.textContent));
    const dets = [...document.querySelectorAll('#mtx-tn .mtx-tn-det')].map((d) => ({
      q: d.querySelector('summary').textContent, a: d.querySelector('.mtx-tn-det-b p').textContent }));
    return { ld, dets };
  });
  const faq = got.ld.find((x) => x['@type'] === 'FAQPage');
  check('there is one FAQPage block', got.ld.length === 1 && !!faq);
  const pairs = faq.mainEntity.map((m) => [m.name, m.acceptedAnswer.text]);
  check('eight questions in the schema and eight on the page', pairs.length === 8 && got.dets.length === 8);
  check('every question matches character for character', pairs.every((p, i) => p[0] === got.dets[i].q), JSON.stringify(pairs.map((p, i) => p[0] === got.dets[i].q)));
  check('every answer matches character for character (links included)', pairs.every((p, i) => p[1] === got.dets[i].a), JSON.stringify(pairs.map((p, i) => p[1] === got.dets[i].a)));
  check('and both are exactly the brief', pairs.every((p, i) => p[0] === one('9', `Q${i + 1}`) && p[1] === one('9', `A${i + 1}`)));
  await ctx.close();
}

// ---------------------------------------------------------------------------
sec('3. Tonight, and Tomorrow from 7:00 PM, for every night, in any time zone');
{
  const rows = C['5']['Table rows'].map((l) => l.split(' | '));
  const NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const lineFor = (r) => one('3', 'Line, filled from the table for the current night').replace('[Event name]', r[1]).replace('[doors time]', r[2]).replace('[first bout time]', r[3]);
  // 12 to 18 October 2026 is Monday to Sunday.
  const week = [[12, 'Monday'], [13, 'Tuesday'], [14, 'Wednesday'], [15, 'Thursday'], [16, 'Friday'], [17, 'Saturday'], [18, 'Sunday']];
  let bad = [], n = 0;
  for (const [i, [d, name]] of week.entries()) {
    const next = rows.find((r) => r[0] === week[(i + 1) % 7][1]);
    const today = rows.find((r) => r[0] === name);
    for (const [h, mi, after] of [[0, 1, false], [10, 0, false], [18, 59, false], [19, 0, true], [23, 59, true]]) {
      // Day 18 + one more day is a Monday the 19th: week[(6+1)%7] is Monday, which is right.
      for (const tz of ['Asia/Bangkok', 'America/New_York', 'Pacific/Auckland']) {
        const { ctx, page } = await open({ widget: false, now: bkk(2026, 10, d, h, mi), tz });
        const got = await page.evaluate(() => ({
          shown: !document.querySelector('[data-mtx-tn-tonight]').hidden,
          label: document.querySelector('[data-tn-label]').textContent, line: document.querySelector('[data-tn-line]').textContent,
          now: [...document.querySelectorAll('#mtx-tn .mtx-tn-table tbody tr.is-now th')].map((t) => t.textContent),
          current: [...document.querySelectorAll('#mtx-tn tr[aria-current="date"]')].length }));
        const row = after ? next : today;
        const want = after ? one('3', 'Label from 7:00 PM Bangkok time (shows the next night)') : one('3', 'Label before 7:00 PM Bangkok time');
        n++;
        if (!(got.shown && got.label === want && got.line === lineFor(row) && got.now.length === 1 && got.now[0] === row[0] && got.current === 1)) {
          bad.push(`${name} ${h}:${String(mi).padStart(2, '0')} ${tz}: ${JSON.stringify(got)} wanted ${want} / ${lineFor(row)}`);
        }
        await ctx.close();
      }
    }
  }
  check(`all ${n} cases right (7 nights x 5 times x 3 time zones)`, bad.length === 0, bad.slice(0, 3).join('\n'));
  // The band is the first thing under the hero and is hidden without script.
  const { ctx, page } = await open({ widget: false, now: bkk(2026, 10, 17, 9, 0) });
  const first = await page.evaluate(() => ({ prev: document.querySelector('[data-mtx-tn-tonight]').previousElementSibling.className, line: document.querySelector('[data-tn-line]').textContent }));
  check('Saturday morning reads RWS with the 7:10 PM first bout', first.line === 'RWS Rajadamnern World Series. Doors open 6:00 PM. First bout 7:10 PM.', first.line);
  check('the band sits straight under the hero', first.prev.includes('mtx-tn-hero'), first.prev);
  await ctx.close();
}

// ---------------------------------------------------------------------------
sec('4. Links and anchors');
{
  const { ctx, page } = await open({ widget: false });
  const links = await page.evaluate(() => [...document.querySelectorAll('#mtx-tn a')].map((a) => [a.textContent.trim(), a.getAttribute('href')]));
  const want = [
    ['Rajadamnern Knockout', '/rajadamnern-knockout'], ['New Power', '/new-power-muay-thai'], ['Petchyindee', '/rajadamnern/petchyindee'],
    ['RWS Rajadamnern World Series', '/rws'], ['Kiatpetch', '/kiatpetch-muay-thai'],
    ['Rajadamnern Knockout nights', '/rajadamnern-knockout'], ['RWS Saturday schedule', '/rws/schedule'],
    ['seating guide', '/rajadamnern-stadium-seating'], ['RWS fight card', '/rws/fight-card'],
    ['Rajadamnern Knockout fight card', '/rajadamnern-knockout/fight-card/'], ['WhatsApp Us', 'https://wa.me/66922706095'],
  ];
  for (const [text, href] of want) check(`"${text}" goes to ${href}`, links.some((l) => l[0] === text && l[1] === href));
  const nine = ['/rws/schedule', '/rajadamnern-knockout', '/new-power-muay-thai', '/rajadamnern/petchyindee', '/rws', '/kiatpetch-muay-thai', '/rajadamnern-stadium-seating', '/rws/fight-card', '/rajadamnern-knockout/fight-card/'];
  check('all nine addresses in Part A are used', nine.every((h) => links.some((l) => l[1] === h)), nine.filter((h) => !links.some((l) => l[1] === h)).join(' '));
  check('every Book Tickets button goes to the widget', links.filter((l) => l[0] === one('2', 'Primary button') || l[0] === one('10', 'Button')).length === 3
    && links.filter((l) => l[0] === 'Book Tickets').every((l) => l[1] === '#mtx-tn-book'));
  check('See Start Times goes to the table', links.some((l) => l[0] === 'See Start Times' && l[1] === '#mtx-tn-times'));
  check('no link goes anywhere unexpected', links.every((l) => l[1].startsWith('/') || l[1].startsWith('#') || l[1] === 'https://wa.me/66922706095'), JSON.stringify(links.filter((l) => !(l[1].startsWith('/') || l[1].startsWith('#')))));
  await ctx.close();
}

// ---------------------------------------------------------------------------
sec('5. Layout at 1440, 1280, 860, 620 and 390, widget in place at the foot');
for (const width of [1440, 1280, 860, 620, 390]) {
  const { ctx, page, errors } = await open({ width, now: bkk(2026, 10, 14, 10, 0) });
  await page.waitForTimeout(500);
  const m = await page.evaluate(() => {
    const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { top: b.top + scrollY, bottom: b.bottom + scrollY }; };
    const over = [...document.querySelectorAll('#mtx-tn *')].filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.right > innerWidth + 1 && !e.closest('#mtx-booking'); }).slice(0, 3).map((e) => e.className || e.tagName);
    return { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, over,
      widget: r('#mtx-tn-book'), final: r('.mtx-tn-final'), faq: r('.mtx-tn-acc'), widgetMounted: !!document.querySelector('#mtx-tn-book #mtx-booking'),
      bodyH: document.documentElement.scrollHeight };
  });
  check(`${width}px: no sideways scroll`, m.sw <= m.cw, `${m.sw} > ${m.cw} ${m.over.join(',')}`);
  check(`${width}px: nothing of the page's own sticks out`, m.over.length === 0, m.over.join(','));
  check(`${width}px: the widget is mounted, after the final call and after the FAQ`, m.widgetMounted && m.widget.top > m.final.bottom - 2 && m.final.top > m.faq.bottom - 2, JSON.stringify(m));
  check(`${width}px: no script errors`, errors.length === 0, errors.join(' | '));
  if (process.env.SHOTS && (width === 1280 || width === 390)) {
    await page.screenshot({ path: path.join(process.env.SHOTS, `tonight-${width}.jpg`), type: 'jpeg', quality: 60, fullPage: true });
  }
  await ctx.close();
}

// ---------------------------------------------------------------------------
sec('6. Contrast of every piece of text the page sets itself');
for (const width of [1280, 390]) {
  const { ctx, page } = await open({ width, widget: false, now: bkk(2026, 10, 17, 9, 0) });
  const bad = await page.evaluate(() => {
    const lum = (c) => { const [r, g, b] = c.map((v) => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * r + .7152 * g + .0722 * b; };
    const parse = (s) => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(',').map((x) => parseFloat(x)); return { rgb: p.slice(0, 3), a: p.length > 3 ? p[3] : 1 }; };
    const bgOf = (el) => { for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c.a > 0.5) return c.rgb; } return [255, 255, 255]; };
    const out = [];
    const walker = document.createTreeWalker(document.getElementById('mtx-tn'), NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.textContent.trim()) continue;
      const el = n.parentElement;
      if (el.closest('script,style,#mtx-tn-book')) continue;
      const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const rect = el.getBoundingClientRect(); if (rect.width === 0 || rect.height === 0) continue;
      const fg = parse(cs.color).rgb, bg = bgOf(el);
      const a = lum(fg), b = lum(bg), ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
      const size = parseFloat(cs.fontSize), bold = parseInt(cs.fontWeight, 10) >= 700;
      const need = (size >= 24 || (size >= 18.66 && bold)) ? 3 : 4.5;
      if (ratio < need) out.push(`${n.textContent.trim().slice(0, 40)} | ${ratio.toFixed(2)} needs ${need} | ${el.className}`);
    }
    return out;
  });
  check(`${width}px: every text clears its contrast (4.5, or 3 for large type)`, bad.length === 0, bad.slice(0, 4).join('\n'));
  await ctx.close();
}

// ---------------------------------------------------------------------------
sec('7. Phone bar, page order, and words that must not appear');
{
  const { ctx, page } = await open({ width: 390, height: 780, widget: true, now: bkk(2026, 10, 14, 10, 0) });
  await page.waitForTimeout(400);
  const hidden = await page.evaluate(() => getComputedStyle(document.querySelector('[data-mtx-tn-bar]')).display);
  check('at the top the phone bar is off', hidden === 'none', hidden);
  await page.evaluate(() => window.scrollTo(0, 1600));
  await page.waitForTimeout(400);
  const on = await page.evaluate(() => { const b = document.querySelector('[data-mtx-tn-bar]'); return { d: getComputedStyle(b).display, t: b.textContent }; });
  check('down the page it comes on and says Book Tickets', on.d === 'flex' && on.t === 'Book Tickets', JSON.stringify(on));
  await page.click('#mtx-tn .mtx-tn-final a.mtx-tn-btn');
  await page.waitForTimeout(900);
  const y = await page.evaluate(() => { const s = document.getElementById('mtx-tn-book').getBoundingClientRect(); return { top: s.top, vh: innerHeight }; });
  check('a Book Tickets button brings the widget to the top of the screen', Math.abs(y.top) < 40, JSON.stringify(y));
  await ctx.close();

  const order = [...block.matchAll(/class="mtx-tn-(hero|tonight|sec mtx-tn-sec--(?:on|times|choose|tix|how|book|paper|white)|final)"/g)].map((m) => m[1]);
  const bodyOnly = block.replace(/<style>[\s\S]*?<\/style>/g, '');
  const idx = (s) => bodyOnly.indexOf(s);
  check('order: hero, tonight, what is on, start times, choosing, tickets, how to book, FAQ, final call, widget',
    [idx('mtx-tn-hero"'), idx('data-mtx-tn-tonight'), idx('mtx-tn-sec--on'), idx('id="mtx-tn-times"'), idx('mtx-tn-sec--choose'), idx('mtx-tn-sec--tix'), idx('mtx-tn-sec--how'), idx('mtx-tn-acc'), idx('mtx-tn-final"'), idx('id="mtx-tn-book"')]
      .every((v, i, a) => v > 0 && (i === 0 || v > a[i - 1])), order.join(' > '));

  const visible = block.replace(/<style>[\s\S]*?<\/style>/g, '').replace(/<script[\s\S]*?<\/script>/g, '');
  check('no "today" anywhere in the page (Part A item 10)', !/today/i.test(block), (block.match(/.{20}today.{20}/i) || [''])[0]);
  check('no scarcity or percentage-booked lines', !/(selling fast|hurry|% booked|booked up|last chance|only \d+ left|almost gone)/i.test(visible));
  check('no em dashes', !/—/.test(visible));
  check('no navy in the colours', !/#0A1640|#0a1640|navy/i.test(block));
  check('colours used are only the brief\'s five, white, greys and the four seat swatches', (() => {
    const found = new Set((block.match(/#[0-9A-Fa-f]{6}\b/g) || []).map((s) => s.toUpperCase()));
    const ok = new Set(['#1F5BFF', '#FF0000', '#55F21D', '#000000', '#F2F2F2', '#FFFFFF', '#1545CF', '#D6D6D6', '#444444', '#E3EBFF', '#1240B8', '#E6E6E6', '#4F4F55', '#00A651', '#27AAE1', '#FFF200', '#F7941E']);
    const extra = [...found].filter((c) => !ok.has(c));
    if (extra.length) console.log('       colours not on the list: ' + extra.join(' '));
    return extra.length === 0;
  })());
  check('the paste file has no html, head or body wrapper', !/<\/?(html|head|body)\b/i.test(block));
  check('and loads nothing from outside', !/<script[^>]+src=|<link[^>]+href=|@import|url\(/i.test(block));

  // For Jason, not a pass or fail: copy in Part B that the house style bans.
  const flags = [];
  for (const [re, why] of [[/\bofficial\b/i, 'official (banned)'], [/\bunassigned\b/i, 'unassigned (banned)'], [/\bassigned\b/i, 'assigned (banned)'],
    [/\blimited\b/i, 'limited (banned)'], [/sold out/i, 'sold out (banned)']]) {
    for (const l of brief.slice(brief.indexOf('PART B. COPY')).split('\n')) if (re.test(l)) flags.push(`${why}: ${l.trim().slice(0, 90)}`);
  }
  console.log('\n       Part B lines the house style bans (built as written, listed for Jason):');
  for (const f of flags) console.log('         ' + f);
}

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
