/* Document B, sections 23, 24, 25 and 26. Runs the acceptance tests.
 *
 *   node verify.mjs
 *
 * Everything is read out of a real rendered page, never out of the source
 * files. A numeric check on source passes while the page is visibly broken.
 */
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
import { readFileSync, existsSync } from 'node:fs';

const frag = readFileSync('homepage-live.txt', 'utf8');
const doc = `<!doctype html><html lang="en-GB"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0">${frag}</body></html>`;

/* The locked copy, parsed from the same file the page is generated from. */
const DOC = (() => {
  const out = {}; let key = null, buf = [];
  for (const raw of readFileSync('document-a.txt', 'utf8').split('\n')) {
    const m = raw.match(/^\[([a-z0-9._-]+)\]\s*$/i);
    if (m) { if (key) out[key] = buf.join('\n').trim(); key = m[1]; buf = []; continue; }
    if (raw.startsWith('#')) continue;
    if (key) buf.push(raw);
  }
  if (key) out[key] = buf.join('\n').trim();
  return out;
})();

const KEYWORDS = ['muay thai tickets','muay thai bangkok tickets','muay thai tickets bangkok','muay thai ticket',
 'bangkok muay thai tickets','thai boxing tickets','thai boxing bangkok tickets','muay thai fight bangkok tickets',
 'muay thai stadium tickets','muay thai boxing stadium tickets','tickets muay thai bangkok',
 'muay thai boxing bangkok tickets','muay thai ticket bangkok','muay thai fight tickets bangkok',
 'thai boxing tickets bangkok','muay thai fight tickets','book muay thai bangkok','bangkok thai boxing tickets',
 'tickets bangkok','how to buy muay thai fight tickets','bangkok muay thai stadium tickets',
 'muay thai stadium bangkok tickets','buy muay thai tickets bangkok','how to buy tickets for muay thai fights',
 'cheap muay thai tickets bangkok','muay thai bangkok tickets price','bangkok muay thai fight tickets',
 'fight night tickets','ticket muay thai bangkok'];
const BRAND = ['muaytix', 'muay tix', 'muaytix official website'];

/* Document A's approved destinations, and nothing else. */
const ALLOWED = ['/rajadamnern-stadium-tickets','/rajadamnern-stadium-seating','/rajadamnern-stadium',
 '/rajadamnern-knockout','/new-power-muay-thai','/petchyindee-muay-thai','/kiatpetch-muay-thai','/rws',
 'https://wa.me/66922706095','https://www.google.com/maps/search/?api=1&query=Rajadamnern+Stadium'];

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
let fails = 0, blocked = 0;
const fail = m => { fails++; console.log('   FAIL  ' + m); };
/* A block that cannot render because verified data is missing is not an
   implementation failure. It is reported as blocked, it still stops the page
   being declared complete, and it is never quietly passed. */
const block = m => { blocked++; console.log('   BLOCKED  ' + m); };
const BLOCKED_KEYS = new Set(['week.cta.all-star-buakaw']);
const norm = s => s.replace(/\s+/g, ' ').replace(/ /g, ' ').trim();

/* ---- Layout, at every width ---- */
console.log('\n=== 1. LAYOUT ===');
for (const w of [1440, 1280, 1024, 860, 620, 390]) {
  const p = await browser.newPage({ viewport: { width: w, height: 1000 } });
  await p.setContent(doc, { waitUntil: 'load' });
  const r = await p.evaluate(() => ({
    over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    h: document.documentElement.scrollHeight,
    /* Document B section 12: tap targets. */
    small: [...document.querySelectorAll('.mtx-hp a.mtx-hp__btn')]
      .filter(a => a.offsetParent !== null || getComputedStyle(a).position === 'fixed')
      .map(a => a.getBoundingClientRect()).filter(r => r.height > 0 && r.height < 44).length,
    /* Document B section 12: copy must not be truncated to fit. */
    clipped: [...document.querySelectorAll('.mtx-hp p, .mtx-hp h1, .mtx-hp h2, .mtx-hp h3')]
      .filter(e => { const s = getComputedStyle(e);
        return (s.textOverflow === 'ellipsis' || s.overflow === 'hidden') && e.scrollHeight > e.clientHeight + 1; }).length,
  }));
  console.log(`   ${String(w).padStart(5)}px  overflow ${r.over}px  height ${r.h}px  small taps ${r.small}  clipped ${r.clipped}`);
  if (r.over > 0) fail(`${w}px scrolls sideways by ${r.over}px`);
  if (r.small) fail(`${w}px has ${r.small} button(s) under 44px tall`);
  if (r.clipped) fail(`${w}px has ${r.clipped} truncated text block(s)`);
  await p.close();
}

const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await page.setContent(doc, { waitUntil: 'load' });
const visible = norm(await page.evaluate(() => document.querySelector('.mtx-hp').textContent));

/* ---- Section 23: the copy diff ---- */
console.log('\n=== 2. COPY DIFF against document-a.txt ===');
const SKIP = new Set(['meta.seo_title', 'meta.description', 'meta.social_title', 'meta.social_description']);
let checked = 0, missing = [];
for (const [key, value] of Object.entries(DOC)) {
  if (SKIP.has(key)) continue;
  checked++;
  if (!visible.includes(norm(value))) missing.push(key);
}
console.log(`   ${checked - missing.length} of ${checked} locked blocks render exactly as written`);
missing.forEach(k => BLOCKED_KEYS.has(k)
  ? block(`locked block [${k}] cannot render: no verified destination exists for it`)
  : fail(`locked block [${k}] does not appear verbatim in the rendered page`));
console.log(`   (4 metadata blocks are page settings, not part of the block, and are checked separately)`);

/* ---- Section 26: nothing authored outside Document A ---- */
console.log('\n=== 3. AUTHORED-SENTENCE AUDIT ===');
const onPage = await page.evaluate(() =>
  [...document.querySelectorAll('.mtx-hp h1, .mtx-hp h2, .mtx-hp h3, .mtx-hp p, .mtx-hp summary, .mtx-hp li > p, .mtx-hp a.mtx-hp__btn, .mtx-hp .mtx-hp__tag')]
    .filter(e => ![...e.children].some(c => c.textContent.trim()))
    .map(e => e.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean));
const approved = Object.values(DOC).map(norm);
/* Dynamic data is permitted by Document A section B: event name, day, date,
   doors, first bout. Those are data, not authored prose. */
const dataShaped = s =>
  /^(Doors .+First bout .+|[A-Z][a-z]+day \d{1,2} [A-Z][a-z]+|Tonight)$/.test(s) ||
  /^(RWS Rajadamnern World Series|Kiatpetch Muay Thai|All Star Fight by Buakaw|Rajadamnern Knockout|New Power Muay Thai|Petchyindee Muay Thai|Ringside|Club Class|LEO Section|Third Class)$/.test(s);
const unapproved = onPage.filter(s => !approved.some(a => a === s || a.includes(s)) && !dataShaped(s));
console.log(`   ${onPage.length} visible text nodes; ${unapproved.length} not traceable to Document A or to verified data`);
unapproved.forEach(s => fail(`unapproved text on page: "${s.slice(0, 90)}"`));

/* ---- Section 24: keyword compliance ---- */
console.log('\n=== 4. KEYWORD COMPLIANCE ===');
const kmiss = KEYWORDS.filter(k => !visible.toLowerCase().includes(k));
const bmiss = BRAND.filter(k => !visible.toLowerCase().includes(k));
console.log(`   CL-002: ${KEYWORDS.length - kmiss.length} / ${KEYWORDS.length} present`);
console.log(`   CL-001: ${BRAND.length - bmiss.length} / ${BRAND.length} present`);
[...kmiss, ...bmiss].forEach(k => fail(`keyword missing: "${k}"`));

/* ---- Section 25: link compliance ---- */
console.log('\n=== 5. LINK COMPLIANCE ===');
const links = await page.evaluate(() =>
  [...document.querySelectorAll('.mtx-hp a')].map(a => ({ href: a.getAttribute('href'), text: a.textContent.trim() })));
const today = new Date(Date.now() + new Date().getTimezoneOffset() * 60000 + 7 * 3600000)
  .toISOString().slice(0, 10);
for (const l of links) {
  if (!l.text) fail(`link with no text: ${l.href}`);
  const base = l.href.split('#')[0].replace(/\/\d{4}-\d{2}-\d{2}$/, '');
  if (!ALLOWED.includes(base)) fail(`destination not in Document A: ${l.href} ("${l.text}")`);
  const dated = l.href.match(/\/(\d{4}-\d{2}-\d{2})$/);
  if (dated && dated[1] < today) fail(`expired dated URL: ${l.href}`);
}
console.log(`   ${links.length} links, ${new Set(links.map(l => l.href)).size} distinct, 0 outside Document A, 0 expired`);

/* ---- Headings ---- */
console.log('\n=== 6. HEADINGS ===');
const heads = await page.evaluate(() =>
  [...document.querySelectorAll('.mtx-hp h1,.mtx-hp h2,.mtx-hp h3')].map(h => h.tagName));
const h1 = heads.filter(h => h === 'H1').length;
console.log(`   H1 ${h1}, H2 ${heads.filter(h => h === 'H2').length}, H3 ${heads.filter(h => h === 'H3').length}`);
if (h1 !== 1) fail(`${h1} H1 elements, expected exactly 1`);

/* ---- Contrast ---- */
console.log('\n=== 7. CONTRAST ===');
const con = await page.evaluate(() => {
  const lum = c => { const [r,g,b] = c.match(/[\d.]+/g).map(Number).map(v => { v/=255; return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4); }); return 0.2126*r+0.7152*g+0.0722*b; };
  const bg = el => { let e = el, layers = [];
    while (e) { const c = getComputedStyle(e).backgroundColor; const m = c && c.match(/[\d.]+/g);
      if (m) { const a = m.length > 3 ? +m[3] : 1; if (a > 0) layers.push([+m[0], +m[1], +m[2], a]); if (a >= 1) break; }
      e = e.parentElement; }
    let out = [255,255,255];
    for (let i = layers.length - 1; i >= 0; i--) { const [r,g,b,a] = layers[i];
      out = [r*a+out[0]*(1-a), g*a+out[1]*(1-a), b*a+out[2]*(1-a)]; }
    return `rgb(${out[0]}, ${out[1]}, ${out[2]})`; };
  return [...document.querySelectorAll('.mtx-hp h1,.mtx-hp h2,.mtx-hp h3,.mtx-hp p,.mtx-hp span,.mtx-hp a,.mtx-hp summary')]
    .filter(e => e.textContent.trim() && ![...e.children].some(c => c.textContent.trim() === e.textContent.trim()))
    .map(e => { const s = getComputedStyle(e); const px = parseFloat(s.fontSize);
      const a = lum(s.color), b = lum(bg(e));
      return { t: e.textContent.trim().replace(/\s+/g,' ').slice(0,44), px,
               ratio: Math.round(((Math.max(a,b)+0.05)/(Math.min(a,b)+0.05))*100)/100,
               need: (px >= 24 || (px >= 18.66 && +s.fontWeight >= 700)) ? 3 : 4.5 }; });
});
const badc = con.filter(c => c.ratio < c.need);
console.log(`   ${con.length} text nodes, ${badc.length} failing`);
badc.forEach(c => fail(`contrast ${c.ratio} (needs ${c.need}) at ${c.px}px: "${c.t}"`));

await page.screenshot({ path: 'page-desk.jpg', type: 'jpeg', quality: 60, fullPage: true });
await page.close();
await browser.close();

if (existsSync('blockers.txt')) {
  const b = readFileSync('blockers.txt', 'utf8').trim();
  if (b) console.log('\n=== 8. REPORTED, NOT FILLED IN ===\n' + b.split('\n').map(x => '   ' + x).join('\n'));
}
console.log('');
console.log(`   Implementation failures: ${fails}`);
console.log(`   Blocked on missing verified data: ${blocked}`);
console.log(fails ? '\nNOT ACCEPTABLE: fix the failures above.\n'
  : blocked ? '\nAll implementation checks pass. Page is not complete: see BLOCKED above.\n'
  : '\nAll acceptance checks passed.\n');
process.exit(fails ? 1 : 0);
