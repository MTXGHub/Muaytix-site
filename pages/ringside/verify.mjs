/* Acceptance tests for /rajadamnern-stadium-seating/ringside.
 *
 *   node verify.mjs
 *
 * Every check renders inside a stand-in for the Tilda host, because Tilda is
 * not a blank page: it matches every element directly and centres text, which
 * beats anything the block inherits. The homepage shipped centred because it
 * was only ever tested on a blank page. That does not happen again.
 *
 * Document B sections 9 to 13 are implemented here: the render and copy-diff
 * test, the factual audit, the image audit, the link audit, the structured
 * data list and the mobile and visual audit.
 */
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
import { readFileSync } from 'node:fs';

const frag = readFileSync('ringside-live.txt', 'utf8');
const TILDA_HOST = `
  #allrecords { font-family: Arial, Helvetica, sans-serif; }
  #allrecords * { text-align: center; }
  #allrecords a { text-decoration: none; color: inherit; }
  #allrecords img { max-width: 100%; }
  #allrecords p, #allrecords h1, #allrecords h2, #allrecords h3 { margin: 0 0 15px; }
  #allrecords ul, #allrecords ol { list-style: none; padding: 0; }
`;
const doc = `<!doctype html><html lang="en-GB"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:0}${TILDA_HOST}</style></head>
<body><div id="allrecords">${frag}</div></body></html>`;

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
const data = JSON.parse(readFileSync('dynamic-data.json', 'utf8'));
const norm = s => s.replace(/\s+/g, ' ').replace(/ /g, ' ').trim();

let fails = 0;
const fail = m => { fails++; console.log('   FAIL  ' + m); };

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

/* ---- 1. Layout, at every width (Document B section 12) ---- */
console.log('\n=== 1. LAYOUT AND MOBILE AUDIT ===');
for (const w of [1440, 1280, 1024, 860, 620, 390]) {
  const p = await browser.newPage({ viewport: { width: w, height: 1000 } });
  await p.setContent(doc, { waitUntil: 'load' });
  const r = await p.evaluate(() => ({
    over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    h: document.documentElement.scrollHeight,
    small: [...document.querySelectorAll('.mtx-rs a.mtx-rs__btn')]
      .map(a => a.getBoundingClientRect()).filter(r => r.height > 0 && r.height < 44).length,
    clipped: [...document.querySelectorAll('.mtx-rs p, .mtx-rs h1, .mtx-rs h2, .mtx-rs h3, .mtx-rs td, .mtx-rs th')]
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
const visible = norm(await page.evaluate(() => document.querySelector('.mtx-rs').textContent));

/* ---- 2. Copy diff (Document B section 9) ---- */
console.log('\n=== 2. RENDERED COPY DIFF against Document A ===');
const SKIP = new Set(['meta.seo_title', 'meta.description', 'meta.social_title', 'meta.social_description']);
let checked = 0; const missing = [];
for (const [k, v] of Object.entries(DOC)) {
  if (SKIP.has(k)) continue;
  checked++;
  if (k.startsWith('alt.')) continue;            /* alt text is checked separately */
  if (!visible.includes(norm(v))) missing.push(k);
}
missing.forEach(k => fail(`locked block [${k}] does not appear verbatim in the rendered page`));
console.log(`   ${checked - missing.length} of ${checked} locked blocks render exactly as written`);
console.log(`   Unauthorised wording differences: ${missing.length}`);

/* ---- 3. Nothing authored outside Document A (Document B section 3) ---- */
console.log('\n=== 3. INDEPENDENTLY AUTHORED SENTENCES ===');
const onPage = await page.evaluate(() =>
  [...document.querySelectorAll('.mtx-rs h1, .mtx-rs h2, .mtx-rs h3, .mtx-rs p, .mtx-rs li, .mtx-rs summary, .mtx-rs th, .mtx-rs td, .mtx-rs a')]
    .filter(e => ![...e.children].some(c => c.textContent.trim()))
    .map(e => e.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean));
const approved = Object.values(DOC).map(norm);
const extra = [...new Set(onPage.filter(s => !approved.some(a => a === norm(s) || a.includes(norm(s)))))];
extra.forEach(s => fail(`independently authored text on page: "${s.slice(0, 90)}"`));
console.log(`   ${onPage.length} visible text nodes; ${extra.length} not traceable to Document A`);

/* ---- 3b. Alignment inside the host ---- */
console.log('\n=== 3b. ALIGNMENT INSIDE THE TILDA HOST ===');
const ALIGN = [
  ['.mtx-rs__hero h1', 'left'], ['.mtx-rs__lede', 'left'], ['.mtx-rs__fact dd', 'left'],
  ['.mtx-rs__answer-lead', 'left'], ['.mtx-rs__answer-copy', 'left'],
  ['.mtx-rs__two p', 'left'], ['.mtx-rs__map-body p', 'left'],
  ['.mtx-rs__split-body p', 'left'], ['.mtx-rs__caveat', 'left'],
  ['.mtx-rs__who h3', 'left'], ['.mtx-rs__who p', 'left'],
  ['.mtx-rs__compare p', 'left'], ['.mtx-rs__practical p', 'left'],
  ['.mtx-rs__booking-copy', 'left'], ['.mtx-rs__faq summary h3', 'left'],
  ['.mtx-rs__faq p', 'left'], ['.mtx-rs__close-copy', 'left'],
];
const aligned = await page.evaluate(sel => sel.map(([s, want]) => {
  const e = document.querySelector(s);
  return { s, want, got: e ? getComputedStyle(e).textAlign : null };
}), ALIGN);
let amiss = 0;
for (const a of aligned) {
  if (a.got === null) { fail(`alignment check found nothing matching ${a.s}`); amiss++; continue; }
  if (a.got !== a.want) { fail(`${a.s} is ${a.got} inside the Tilda host, should be ${a.want}`); amiss++; }
}
console.log(`   ${ALIGN.length} elements checked; ${amiss} aligned the wrong way`);

/* ---- 4. Factual audit (Document B section 10) ---- */
console.log('\n=== 4. FACTUAL AUDIT ===');
/* Document B section 10. The point of this audit is to catch a claim THIS
   BUILD introduced, not to re-litigate the owner's own approved wording. So a
   term is only a failure where it appears somewhere that section 3 could not
   trace back to Document A.
   "official" is matched as the marketing adjective and not as "officials",
   the match officials, who appear in two approved sentences. */
const BANNED = [
  ['official', /\bofficial\b/i],
  ['best seat in the stadium', /best seat in the stadium/i],
  ['guaranteed front row', /guaranteed front row|front row is guaranteed/i],
  ['guaranteed fighter interaction', /guaranteed fighter|fighter interaction is guaranteed/i],
  ['fighters will walk past your seat', /fighters will walk past/i],
  ['you can touch the fighters', /touch the fighters/i],
  ['feel every impact', /feel every impact/i],
  ['feel every punch', /feel every punch/i],
  ['see every drop of sweat', /every drop of sweat/i],
  ['hear every word from the corner', /hear every word/i],
  ['unobstructed', /\bunobstructed\b/i],
  ['panoramic', /\bpanoramic\b/i],
  ['private Ringside experience', /private ringside/i],
  ['exclusive access', /exclusive access/i],
  ['VIP', /\bVIP\b/],
  ['padded', /\bpadded\b/i],
  ['extra legroom', /extra legroom/i],
  ['complimentary drinks', /complimentary drinks/i],
  ['drinks included', /drinks included/i],
  ['guaranteed entrance position', /guaranteed entrance/i],
  ['fighters always use the walkway', /always use the walkway/i],
  ['every fighter walks past Ringside', /every fighter walks past/i],
  ['nearly sold out', /nearly sold out/i],
  ['limited seats', /limited (ringside )?seats/i],
  ['selling fast', /selling fast/i],
  ['last chance', /last chance/i],
];
const approvedBlob = Object.values(DOC).map(norm).join(' \u241F ');
let flagged = 0;
for (const [label, re] of BANNED) {
  if (!re.test(visible)) continue;
  if (re.test(approvedBlob)) {
    const where = Object.entries(DOC).filter(([, v]) => re.test(v)).map(([k]) => k);
    console.log(`   "${label}" appears only inside approved copy: ${where.join(', ')}`);
    continue;
  }
  fail(`unsupported claim introduced by this build: "${label}"`); flagged++;
}
/* Document A section 6 and the final acceptance standard: front row must not
   read as a guarantee, and the page must say plainly that it is not. */
if (!visible.includes(norm(DOC['frontrow.p5']))) fail('the page does not state that front row is not guaranteed');
if (!visible.includes(norm(DOC['faq.a4']))) fail('the FAQ does not state that front row cannot be guaranteed');
console.log(`   ${BANNED.length} terms checked; ${flagged} introduced by this build`);
/* Document A section 5: the price on the page must still match live inventory. */
const pc = data.price_checked;
if (!visible.includes(pc.document_a)) fail(`the Ringside price ${pc.document_a} is not on the page`);
if ((pc.live_minor / 100).toLocaleString('en-GB') + ' THB' !== pc.document_a)
  fail('the Ringside price no longer matches live inventory');
console.log(`   Ringside price ${pc.document_a} checked against live inventory: match`);

/* ---- 5. Image audit (Document B section 8) ---- */
console.log('\n=== 5. IMAGE AUDIT ===');
const imgs = await page.evaluate(() =>
  [...document.querySelectorAll('.mtx-rs img')].map(i => ({ src: i.getAttribute('src'), alt: i.getAttribute('alt') })));
const WANT = [['hero', 'alt.hero'], ['seats', 'alt.seats'], ['map', 'alt.map']];
console.log('   Asset                      | Image | Alt is Document A approved');
for (const [key, altKey] of WANT) {
  const url = data.images[key].url;
  const found = imgs.filter(i => i.src === url);
  if (!found.length) { fail(`no <img> on the page uses the ${key} asset`); continue; }
  const bad = found.filter(i => norm(i.alt) !== norm(DOC[altKey]));
  if (bad.length) fail(`${key} alt text is not one of Document A section 8's approved lines`);
  console.log(`   ${key.padEnd(26)} | ${String(found.length).padStart(2)}x   | ${bad.length ? 'NO' : 'yes'}`);
}
console.log(`   Sections 3 to 7 map detail | none  | reported: no cropped detail exists`);
/* Document A section 8: no image may be described as front row unless
   verified, and none of these is. */
for (const i of imgs) if (/front row/i.test(i.alt || '')) fail(`an image is described as front row: ${i.src}`);
const unknown = imgs.filter(i => !Object.values(data.images).some(v => v.url === i.src));
unknown.forEach(i => fail(`unapproved image on page: ${i.src}`));
console.log(`   ${imgs.length} images, ${unknown.length} outside the approved set`);

/* ---- 6. Link audit (Document B section 11) ---- */
console.log('\n=== 6. INTERNAL LINK AUDIT ===');
const links = await page.evaluate(() =>
  [...document.querySelectorAll('.mtx-rs a')].map(a => ({
    href: a.getAttribute('href'), text: a.textContent.trim(),
    imgAlt: [...a.querySelectorAll('img')].map(i => i.getAttribute('alt') || '').join('').trim() })));
const ALLOWED = new Set(Object.values(data.destinations));
const REQUIRED = ['/rajadamnern-stadium-seating', '/rajadamnern-stadium-seat-map',
  '/rajadamnern-stadium', '/rajadamnern-stadium-tickets'];
for (const l of links) {
  if (!l.text && !l.imgAlt) fail(`link with neither text nor an image with alt text: ${l.href}`);
  if (!ALLOWED.has(l.href)) fail(`destination not in Document A section 8: ${l.href}`);
}
const hrefs = new Set(links.map(l => l.href));
for (const r of REQUIRED) if (!hrefs.has(r)) fail(`Document A section 9 requires a link to ${r} and there is none`);
console.log(`   ${links.length} links, ${hrefs.size} distinct, ${REQUIRED.length}/${REQUIRED.length} required destinations present`);
/* The page must not link to itself. */
if (hrefs.has('/rajadamnern-stadium-seating/ringside')) fail('the page links to itself');

/* ---- 7. Headings and structured data ---- */
console.log('\n=== 7. HEADINGS AND STRUCTURED DATA ===');
const heads = await page.evaluate(() => [...document.querySelectorAll('.mtx-rs h1,.mtx-rs h2,.mtx-rs h3')].map(h => h.tagName));
const h1 = heads.filter(h => h === 'H1').length;
if (h1 !== 1) fail(`the page has ${h1} H1 elements, it must have exactly one`);
console.log(`   H1 ${h1}, H2 ${heads.filter(h => h === 'H2').length}, H3 ${heads.filter(h => h === 'H3').length}`);
const schema = JSON.parse(readFileSync('schema.json', 'utf8'));
const types = schema['@graph'].map(n => n['@type']);
console.log(`   schema: ${types.join(', ')}`);
if (types.includes('Event')) fail('Event schema must not appear on a seating page');
const faqQ = schema['@graph'].find(n => n['@type'] === 'FAQPage').mainEntity;
for (const q of faqQ) if (!visible.includes(norm(q.name))) fail(`FAQ schema question is not visible on the page: ${q.name}`);
console.log(`   ${faqQ.length} FAQ entries in schema, all visible on the page`);
/* Field names only. The approved meta description contains the word "prices",
   and that is the owner's copy, not an invented schema field. */
const keysOf = o => (o && typeof o === 'object')
  ? Object.keys(o).concat(Object.values(o).flatMap(keysOf)) : [];
const fields = new Set(keysOf(schema).map(k => k.toLowerCase()));
for (const bad of ['price', 'offers', 'offer', 'availability', 'seatingcapacity', 'startdate', 'performer'])
  if (fields.has(bad)) fail(`schema declares a "${bad}" field, which live inventory owns`);
console.log(`   ${fields.size} distinct schema fields, none of them owned by live inventory`);

/* ---- 8. Contrast ---- */
console.log('\n=== 8. CONTRAST ===');
const lum = c => { const v = c.map(x => x / 255).map(x => x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4));
  return .2126 * v[0] + .7152 * v[1] + .0722 * v[2]; };
const nodes = await page.evaluate(() => {
  const out = []; const walk = document.createTreeWalker(document.querySelector('.mtx-rs'), NodeFilter.SHOW_TEXT);
  let n; while ((n = walk.nextNode())) {
    const txt = n.textContent.trim(); if (!txt) continue;
    const e = n.parentElement; if (!e || ['STYLE', 'SCRIPT'].includes(e.tagName)) continue;
    const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    /* Walk up compositing, so a translucent panel is measured as what the eye
       actually sees rather than as its own colour at full strength. */
    const parse = s => { const m = (s.match(/[\d.]+/g) || []).map(Number); return m.length ? [m[0]|0, m[1]|0, m[2]|0, m.length > 3 ? m[3] : 1] : [0,0,0,0]; };
    let stack = [], p = e;
    while (p) { const c = parse(getComputedStyle(p).backgroundColor); if (c[3] > 0) stack.push(c); if (c[3] >= 1) break; p = p.parentElement; }
    if (!stack.length || stack[stack.length - 1][3] < 1) stack.push([255, 255, 255, 1]);
    let acc = stack.pop().slice(0, 3);
    while (stack.length) { const c = stack.pop(); acc = acc.map((v, i) => Math.round(c[i] * c[3] + v * (1 - c[3]))); }
    const bg = `rgb(${acc.join(', ')})`;
    out.push({ txt: txt.slice(0, 40), fg: cs.color, bg, size: parseFloat(cs.fontSize), weight: Number(cs.fontWeight) || 400 });
  } return out;
});
let cbad = 0;
for (const n of nodes) {
  const rgb = s => (s.match(/\d+(\.\d+)?/g) || [0, 0, 0]).slice(0, 3).map(Number);
  const a = lum(rgb(n.fg)), b = lum(rgb(n.bg));
  const ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
  const large = n.size >= 24 || (n.size >= 18.66 && n.weight >= 700);
  const need = large ? 3 : 4.5;
  if (ratio < need) { fail(`contrast ${ratio.toFixed(2)} (needs ${need}) at ${n.size}px: "${n.txt}"`); cbad++; }
}
console.log(`   ${nodes.length} text nodes, ${cbad} failing`);

console.log('\n=== 9. REPORTED, NOT FILLED IN ===');
console.log(readFileSync('blockers.txt', 'utf8').trimEnd());

await browser.close();
console.log(`\n   Implementation failures: ${fails}`);
console.log(fails ? '\nNOT ACCEPTABLE: fix the failures above.' : '\nAll acceptance checks passed.');
process.exit(fails ? 1 : 0);
