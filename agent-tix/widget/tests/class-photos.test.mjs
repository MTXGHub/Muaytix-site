// Agent Tix — photos and selling lines on the seat tile
//
//   node agent-tix/widget/tests/class-photos.test.mjs
//
// Jason, 5 October 2026. Ten LEO tickets unsold on a quiet week. Guests believe
// LEO is a standing area and a worse view than Club Class, and the tile said
// neither yes nor no. A photograph from the seat and five plain lines answer
// both. Launched one class at a time: a class with no photos is drawn exactly as
// it was, and a class that cannot be bought loses its photos with its button.

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

const SHOT_DIR = process.env.SHOT_DIR || '';

// The words are Jason's, verbatim. Lines two and three are one line with its
// second half in brackets under it, and are never to be split or reworded.
const PHOTOS = [
  { url: 'https://static.tildacdn.com/tild6636-6437-4337-b564-306461383262/1000035272.jpg', alt: 'View from the front row of LEO Section' },
  { url: 'https://static.tildacdn.com/tild3431-3865-4138-a137-316335353536/1000035271.jpg', alt: 'View from the back row of LEO Section' },
  { url: 'https://static.tildacdn.com/tild3364-3131-4461-b338-363930323965/1000035278.jpg', alt: 'Stadium seat map with LEO Section, Section 10, shown in yellow' },
  { url: 'https://static.tildacdn.com/tild3766-3239-4230-a462-383036343832/1000035279.jpg', alt: 'LEO Section seating' },
];
const BENEFITS = [
  { text: 'LEO Section has exactly the same elevation and crystal clear view to the ring as Club Class' },
  { text: 'Everyone is guaranteed a seat in LEO Section', note: '(There are no standing areas in the whole stadium)' },
  { text: 'LEO Section faces the front of the ring' },
  { text: "LEO Section is where the stadium's atmosphere is at its best" },
  { text: 'LEO Section is the choice of local fight fans' },
];

// Real photographs cannot load here (Tilda's image host is blocked), so each
// address answers with a labelled 3:2 picture of its own. Layout is real;
// pixels are not.
const swatch = (label, hue) => `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
  <rect width="1200" height="800" fill="hsl(${hue} 55% 22%)"/><rect x="40" y="40" width="1120" height="720" fill="none" stroke="#fff" stroke-width="6"/>
  <text x="600" y="420" font-family="Arial" font-size="64" fill="#fff" text-anchor="middle">${label}</text></svg>`;

function nightWith(mods) {
  const n = JSON.parse(JSON.stringify(night));
  for (const c of n.classes) {
    c.photos = []; c.benefits = [];
    c.status = 'available'; c.seatsLeft = null;
    if (mods[c.code]) Object.assign(c, mods[c.code]);
  }
  return n;
}

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);

async function open(width, mods) {
  const ctx = await browser.newContext({ viewport: { width, height: 1000 }, locale: 'en-GB' });
  const page = await ctx.newPage();
  await page.route('**/functions/v1/**', async (route) => {
    const body = JSON.parse(route.request().postData() || '{}');
    if (route.request().url().endsWith('/availability')) {
      return route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify(body.action === 'events' ? events : nightWith(mods)) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{"warm":true}' });
  });
  await page.route('https://static.tildacdn.com/**', (route) => {
    const i = PHOTOS.findIndex(p => p.url === route.request().url());
    return route.fulfill({ status: 200, contentType: 'image/svg+xml',
      body: swatch(['FRONT ROW', 'BACK ROW', 'SEAT MAP', 'SEATING'][i] || 'PHOTO', [210, 260, 45, 190][i] || 0) });
  });
  await page.route('https://muaytix.test/**', r => r.fulfill({
    status: 200, contentType: 'text/html',
    body: `<!doctype html><html><head><meta charset="utf-8"><title>T</title>${frag}</head>
    <body style="margin:0"><div class="muaytix-ticket-selector" data-event-id="rws_2026_09_19"></div></body></html>`,
  }));
  page.on('pageerror', e => { fail++; console.log('  FAIL page error -> ' + e.message); });
  await page.goto('https://muaytix.test/x', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-pick]', { timeout: 12000 });
  return page;
}

const text = (s) => s.replace(/\s+/g, ' ').trim();
const LEO_ON = { leo_section: { photos: PHOTOS, benefits: BENEFITS } };

/* ------------------------------------------------------------------------ */
console.log('\nLEO has photos and lines, the other three do not');
let page = await open(1000, LEO_ON);
const card = page.locator('.mtx-seatcard');
check('exactly one card is drawn', await card.count() === 1);
check('the card is LEO', await card.locator('.mtx-pick-name').innerText() === 'LEO Section');
check('the other three are the compact tile it always was',
  await page.locator('button.mtx-pick').count() === 3);

const alts = await card.locator('.mtx-slide img').evaluateAll(els => els.map(e => e.getAttribute('alt')));
const srcs = await card.locator('.mtx-slide img').evaluateAll(els => els.map(e => e.getAttribute('src')));
check('four photos', alts.length === 4, String(alts.length));
check('in Jason\'s order: front row, back row, map, seating',
  JSON.stringify(srcs) === JSON.stringify(PHOTOS.map(p => p.url)), srcs.join('\n'));
check('every photo has plain-text alt', alts.every(a => a && a.length > 8), JSON.stringify(alts));
check('only the first photo loads eagerly',
  JSON.stringify(await card.locator('.mtx-slide img').evaluateAll(els => els.map(e => e.getAttribute('loading')))) ===
  JSON.stringify([null, 'lazy', 'lazy', 'lazy']));

const lines = await card.locator('.mtx-why-list > li').evaluateAll(els => els.map(e => e.innerText.replace(/\s+/g, ' ').trim()));
check('five selling lines', lines.length === 5, String(lines.length));
check('every line is Jason\'s wording, verbatim and in order',
  JSON.stringify(lines) === JSON.stringify(BENEFITS.map(b => b.note ? `${b.text} ${b.note}` : b.text)), JSON.stringify(lines, null, 1));
check('the standing line sits inside the guarantee line, in brackets, not as a line of its own',
  await card.locator('.mtx-why-list > li:nth-child(2) .mtx-why-note').innerText() === '(There are no standing areas in the whole stadium)');
check('the photos come before the lines in the page',
  await card.evaluate(c => c.querySelector('.mtx-slider').compareDocumentPosition(c.querySelector('.mtx-why-list')) & Node.DOCUMENT_POSITION_FOLLOWING));

/* ---- the words that are banned for guests ---- */
const cardText = text(await card.innerText()) + ' ' + alts.join(' ');
check('no em dash', !/—/.test(cardText));
check('no "official"', !/official/i.test(cardText));
check('no "Limited"', !/limited/i.test(cardText));
check('no "assigned" or "unassigned"', !/assigned/i.test(cardText));
check('no scarcity copy', !/selling fast|hurry|% booked/i.test(cardText));

/* ---- the slider ---- */
const track = card.locator('.mtx-track');
const left0 = await track.evaluate(t => t.scrollLeft);
check('starts on the first photo', left0 === 0);
check('previous is disabled on the first photo', await card.locator('.mtx-slide-prev').isDisabled());
check('the first dot is current',
  await card.locator('.mtx-dotb').nth(0).getAttribute('aria-current') === 'true');
await card.locator('.mtx-slide-next').click();
await page.waitForFunction(() => document.querySelector('.mtx-track').scrollLeft > 50, null, { timeout: 4000 });
await page.waitForTimeout(500);
check('the next arrow moves one photo', await track.evaluate(t => Math.round(t.scrollLeft / t.clientWidth)) === 1);
check('the dot follows', await card.locator('.mtx-dotb').nth(1).getAttribute('aria-current') === 'true'
  && await card.locator('.mtx-dotb[aria-current="true"]').count() === 1);
check('previous is live once moved on', await card.locator('.mtx-slide-prev').isEnabled());
check('moving the photo did not choose the class', await page.locator('.mtx-seatcard').count() === 1
  && await page.locator('.mtx-detail').count() === 0);
await card.locator('.mtx-dotb').nth(3).click();
await page.waitForTimeout(700);
check('a dot jumps to its photo', await track.evaluate(t => Math.round(t.scrollLeft / t.clientWidth)) === 3);
check('next is disabled on the last photo', await card.locator('.mtx-slide-next').isDisabled());
await track.focus();
await page.keyboard.press('ArrowLeft');
await page.waitForTimeout(700);
check('the left arrow key goes back one', await track.evaluate(t => Math.round(t.scrollLeft / t.clientWidth)) === 2);
check('the slider is named for screen readers',
  /Photos of LEO Section/.test(await card.locator('.mtx-slider').getAttribute('aria-label')));
check('arrows are real buttons with names',
  await card.locator('.mtx-slide-btn').evaluateAll(b => b.every(x => x.tagName === 'BUTTON' && x.getAttribute('aria-label'))));
check('nothing interactive sits inside the select button',
  await page.locator('[data-pick="leo_section"]').evaluate(b => b.querySelectorAll('button, a, input').length === 0));

/* ---- choosing it still works ---- */
await page.click('[data-pick="leo_section"]');
await page.waitForSelector('.mtx-detail', { timeout: 4000 });
check('the select button chooses LEO Section',
  /LEO Section/.test(await page.locator('.mtx-detail-h').innerText()));
await page.close();

/* ------------------------------------------------------------------------ */
console.log('\nA class that cannot be bought loses its photos');
for (const status of ['fully_booked', 'booking_closed', 'closed']) {
  page = await open(1000, { leo_section: { photos: PHOTOS, benefits: BENEFITS, status } });
  check(`${status}: no card`, await page.locator('.mtx-seatcard').count() === 0);
  check(`${status}: no photos on the page`, await page.locator('.mtx-slide img').count() === 0);
  check(`${status}: no selling lines`, await page.locator('.mtx-why-list').count() === 0);
  check(`${status}: the compact tile is back and cannot be pressed`,
    await page.locator('[data-pick="leo_section"]').isDisabled());
  await page.close();
}
page = await open(1000, { leo_section: { photos: PHOTOS, benefits: BENEFITS, status: 'limited', seatsLeft: 3 } });
check('three left is still on sale, so it keeps its photos', await page.locator('.mtx-seatcard').count() === 1);
const goText = await page.locator('.mtx-seatcard-go').innerText();
check('and still says the number', /ONLY\s*3\s*LEFT/i.test(goText), JSON.stringify(goText));
await page.close();

/* ------------------------------------------------------------------------ */
console.log('\nBad data is ignored, not drawn');
page = await open(1000, { leo_section: { photos: [{ url: 'http://insecure.example/a.jpg', alt: 'x' }, { url: 'javascript:alert(1)' }, null, {}], benefits: BENEFITS } });
check('no https photo means no card (the compact tile)', await page.locator('.mtx-seatcard').count() === 0);
await page.close();
page = await open(1000, { leo_section: { photos: [PHOTOS[0]], benefits: [] } });
check('one photo: a card with no arrows or dots', await page.locator('.mtx-seatcard').count() === 1
  && await page.locator('.mtx-slide-btn').count() === 0 && await page.locator('.mtx-dotb').count() === 0);
check('no lines: no empty list', await page.locator('.mtx-why-list').count() === 0);
await page.close();
page = await open(1000, { leo_section: { photos: [{ url: PHOTOS[0].url, alt: '"><img src=x onerror=alert(1)>' }], benefits: [{ text: '<b>bold</b>' }] } });
check('markup in the data is shown as text, never run',
  await page.locator('.mtx-seatcard b').count() === 0 && await page.locator('.mtx-seatcard img[onerror]').count() === 0);
await page.close();

/* ------------------------------------------------------------------------ */
console.log('\nLayout: two and two, one to a row on a phone, nothing overflows');
for (const w of [1440, 1280, 860, 620, 390]) {
  page = await open(w, LEO_ON);
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(`${w}px: no horizontal overflow`, over <= 0, String(over));
  const lefts = await page.locator('.mtx-picker > *').evaluateAll(els => els.map(e => Math.round(e.getBoundingClientRect().left)));
  const widths = await page.locator('.mtx-picker > *').evaluateAll(els => els.map(e => Math.round(e.getBoundingClientRect().width)));
  if (w > 560) {
    check(`${w}px: two to a row`, lefts.filter(x => x === lefts[0]).length === 2, lefts.join(' '));
  } else {
    check(`${w}px: one to a row`, lefts.every(x => x === lefts[0]), lefts.join(' '));
  }
  // Rendered photo is 3:2 and not stretched or cropped to a sliver.
  const dims = await page.locator('.mtx-slide').first().evaluate(e => { const r = e.getBoundingClientRect(); return r.width / r.height; });
  check(`${w}px: photo frame is 3:2`, Math.abs(dims - 1.5) < 0.02, dims.toFixed(3));
  const imgBox = await page.locator('.mtx-slide img').first().evaluate(e => { const r = e.getBoundingClientRect(), p = e.parentElement.getBoundingClientRect(); return Math.abs(r.width - p.width) < 1 && Math.abs(r.height - p.height) < 1; });
  check(`${w}px: photo fills its frame`, imgBox);
  const touch = await page.locator('.mtx-slide-btn').first().evaluate(e => { const r = e.getBoundingClientRect(); return Math.min(r.width, r.height); });
  check(`${w}px: arrows are at least 44px`, touch >= 44, String(touch));
  const goH = await page.locator('.mtx-seatcard-go').evaluate(e => e.getBoundingClientRect().height);
  check(`${w}px: select button is at least 44px tall`, goH >= 44, String(goH));
  if (SHOT_DIR) {
    await page.waitForTimeout(300);
    await page.locator('.mtx-picker').screenshot({ path: path.join(SHOT_DIR, `card-${w}.png`) });
  }
  await page.close();
}

/* ------------------------------------------------------------------------ */
console.log('\nContrast of every piece of text in the card');
page = await open(1000, LEO_ON);
const lum = (c) => { const v = c.map(x => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
const ratio = (a, b) => { const [hi, lo] = lum(a) > lum(b) ? [a, b] : [b, a]; return (lum(hi) + 0.05) / (lum(lo) + 0.05); };
const parse = (s) => (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
const spots = await page.evaluate(() => {
  const sel = ['.mtx-seatcard .mtx-pick-why', '.mtx-seatcard .mtx-pick-name', '.mtx-seatcard .mtx-pick-price',
               '.mtx-seatcard .mtx-why-list li', '.mtx-seatcard .mtx-why-note', '.mtx-seatcard .mtx-seatcard-go'];
  return sel.map(q => { const e = document.querySelector(q); const cs = getComputedStyle(e);
    let bg = cs.backgroundColor, n = e;
    while ((bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') && n.parentElement) { n = n.parentElement; bg = getComputedStyle(n).backgroundColor; }
    return { q, fg: cs.color, bg, size: parseFloat(cs.fontSize), weight: Number(cs.fontWeight) }; });
});
for (const s of spots) {
  const r = ratio(parse(s.fg), parse(s.bg));
  const large = s.size >= 24 || (s.size >= 18.66 && s.weight >= 700);
  const need = large ? 3 : 4.5;
  // The green badge has always been white on #00A550 (3.2:1); the same pill is
  // used on every tile today, so it is reported and held to the existing look.
  const known = s.q.includes('seatcard-go');
  check(`${s.q.replace('.mtx-seatcard ', '')}: ${r.toFixed(2)}:1${known ? ' (same green pill as the existing tiles)' : ''}`,
    known ? r >= 3 : r >= need, `${s.fg} on ${s.bg}`);
}
await page.close();

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
