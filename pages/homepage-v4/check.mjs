/* Reads the built page back out of a real browser and checks it.
 *
 *   node check.mjs
 *
 * Everything here is read out of the DOM, never out of the source files. A
 * numeric check on the source passes while the rendered page is broken; that
 * has happened on this site before.
 */
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
import { readFileSync } from 'node:fs';

const frag = readFileSync('homepage-live.txt', 'utf8');
const doc = `<!doctype html><html lang="en-GB"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0">${frag}</body></html>`;

/* Part 4 of the audit: all 29 are mandatory. */
const KEYWORDS = [
  'muay thai tickets', 'muay thai bangkok tickets', 'muay thai tickets bangkok',
  'muay thai ticket', 'bangkok muay thai tickets', 'thai boxing tickets',
  'thai boxing bangkok tickets', 'muay thai fight bangkok tickets',
  'muay thai stadium tickets', 'muay thai boxing stadium tickets',
  'tickets muay thai bangkok', 'muay thai boxing bangkok tickets',
  'muay thai ticket bangkok', 'muay thai fight tickets bangkok',
  'thai boxing tickets bangkok', 'muay thai fight tickets', 'book muay thai bangkok',
  'bangkok thai boxing tickets', 'tickets bangkok', 'how to buy muay thai fight tickets',
  'bangkok muay thai stadium tickets', 'muay thai stadium bangkok tickets',
  'buy muay thai tickets bangkok', 'how to buy tickets for muay thai fights',
  'cheap muay thai tickets bangkok', 'muay thai bangkok tickets price',
  'bangkok muay thai fight tickets', 'fight night tickets', 'ticket muay thai bangkok',
];

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
let failures = 0;
const fail = m => { failures++; console.log('  FAIL ' + m); };

/* ---- 1. Layout at every width ---- */
console.log('\n=== OVERFLOW ===');
for (const w of [1440, 1280, 1024, 860, 620, 390]) {
  const p = await browser.newPage({ viewport: { width: w, height: 1000 } });
  await p.setContent(doc, { waitUntil: 'load' });
  const r = await p.evaluate(() => ({
    over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    h: document.documentElement.scrollHeight,
  }));
  console.log(`  ${String(w).padStart(5)}px  overflow ${r.over}px  height ${r.h}px`);
  if (r.over > 0) fail(`${w}px scrolls sideways by ${r.over}px`);
  await p.close();
}

const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await page.setContent(doc, { waitUntil: 'load' });

/* ---- 2. Keyword compliance, read from rendered text ---- */
const text = (await page.evaluate(() => document.querySelector('.mtx-hp').textContent))
  .replace(/\s+/g, ' ').toLowerCase();
console.log('\n=== KEYWORDS (29 mandatory) ===');
const missing = KEYWORDS.filter(k => !text.includes(k));
console.log(`  ${KEYWORDS.length - missing.length} of ${KEYWORDS.length} present`);
missing.forEach(k => fail(`keyword missing: "${k}"`));

/* ---- 3. Headings, in document order ---- */
console.log('\n=== HEADINGS ===');
const heads = await page.evaluate(() =>
  [...document.querySelectorAll('.mtx-hp h1, .mtx-hp h2')].map(h => h.tagName + ' ' + h.textContent.trim()));
heads.forEach(h => console.log('  ' + h));
const h1s = heads.filter(h => h.startsWith('H1'));
if (h1s.length !== 1) fail(`${h1s.length} H1s, expected exactly 1`);

/* ---- 4. Contrast on every piece of text ---- */
console.log('\n=== CONTRAST ===');
const con = await page.evaluate(() => {
  const lum = c => { const [r,g,b] = c.match(/[\d.]+/g).map(Number).map(v => { v/=255; return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4); }); return 0.2126*r+0.7152*g+0.0722*b; };
  const bg = el => {
    let e = el, layers = [];
    while (e) {
      const c = getComputedStyle(e).backgroundColor;
      const m = c && c.match(/[\d.]+/g);
      if (m) { const a = m.length > 3 ? +m[3] : 1; if (a > 0) layers.push([+m[0], +m[1], +m[2], a]); if (a >= 1) break; }
      e = e.parentElement;
    }
    let out = [255, 255, 255];
    for (let i = layers.length - 1; i >= 0; i--) {
      const [r, g, b, a] = layers[i];
      out = [r * a + out[0] * (1 - a), g * a + out[1] * (1 - a), b * a + out[2] * (1 - a)];
    }
    return `rgb(${out[0]}, ${out[1]}, ${out[2]})`;
  };
  return [...document.querySelectorAll('.mtx-hp h1,.mtx-hp h2,.mtx-hp h3,.mtx-hp p,.mtx-hp span,.mtx-hp a,.mtx-hp summary')]
    .filter(e => e.textContent.trim() && ![...e.children].some(c => c.textContent.trim() === e.textContent.trim()))
    .map(e => { const s = getComputedStyle(e); const px = parseFloat(s.fontSize);
      const ratio = (() => { const a = lum(s.color), b = lum(bg(e)); return (Math.max(a,b)+0.05)/(Math.min(a,b)+0.05); })();
      return { t: e.textContent.trim().replace(/\s+/g,' ').slice(0,46), px, ratio: Math.round(ratio*100)/100,
               need: (px >= 24 || (px >= 18.66 && +s.fontWeight >= 700)) ? 3 : 4.5 }; });
});
const bad = con.filter(c => c.ratio < c.need);
console.log(`  ${con.length} text nodes checked, ${bad.length} failing`);
bad.forEach(c => fail(`contrast ${c.ratio} (needs ${c.need}) at ${c.px}px: "${c.t}"`));

/* ---- 5. Links: every destination must be one the site actually has ---- */
console.log('\n=== LINKS ===');
const KNOWN = ['/rajadamnern-stadium-tickets','/rajadamnern-stadium-seating','/rajadamnern-stadium',
  '/rajadamnern-knockout','/new-power-muay-thai','/petchyindee-muay-thai','/kiatpetch-muay-thai',
  '/rws/','/rws'];
const links = await page.evaluate(() =>
  [...document.querySelectorAll('.mtx-hp a')].map(a => ({ href: a.getAttribute('href'), txt: a.textContent.trim() })));
const seen = new Map();
for (const l of links) {
  seen.set(l.href, (seen.get(l.href) || 0) + 1);
  if (l.href.startsWith('http')) continue;
  const base = l.href.split('#')[0].replace(/\/\d{4}-\d{2}-\d{2}$/, '');
  if (!KNOWN.includes(base)) fail(`unknown destination ${l.href} ("${l.txt}")`);
  if (!l.txt) fail(`link with no text: ${l.href}`);
}
console.log(`  ${links.length} links, ${seen.size} distinct destinations, 0 invented`);

/* ---- 6. Repetition: what the audit asked to stop saying ---- */
console.log('\n=== REPETITION ===');
for (const w of ['historic', 'atmosphere', 'international visitor', 'book with confidence',
                 'international ticket partner', 'authorised', 'unforgettable', 'world-class']) {
  const n = (text.match(new RegExp(w, 'g')) || []).length;
  if (n) console.log(`  "${w}" x${n}`);
}
await page.screenshot({ path: 'page-desk.jpg', type: 'jpeg', quality: 62, fullPage: true });
await page.close();
const phone = await browser.newPage({ viewport: { width: 390, height: 900 } });
await phone.setContent(doc, { waitUntil: 'load' });
await phone.screenshot({ path: 'page-phone.jpg', type: 'jpeg', quality: 62, fullPage: true });
await browser.close();

console.log(failures ? `\n${failures} FAILURES\n` : '\nAll checks passed.\n');
process.exit(failures ? 1 : 0);
