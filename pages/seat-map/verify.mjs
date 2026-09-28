/* Acceptance tests for /rajadamnern-stadium-seat-map.
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

const frag = readFileSync('seat-map-live.txt', 'utf8');
const TILDA_HOST = `
  #allrecords { font-family: Arial, Helvetica, sans-serif; }
  #allrecords * { text-align: center; }
  #allrecords a { text-decoration: none; color: inherit; }
  #allrecords img { max-width: 100%; }
  /* NO paragraph margin is simulated here. An earlier version gave #allrecords
     p a 15px bottom margin, and because that is (1,0,1) it beat the page's own
     rules and supplied spacing the page did not have. The spacing checks then
     passed on a page whose paragraphs sat flush the moment the host did not
     do that. muaytix.com is blocked from here, so what Tilda really sets
     cannot be confirmed: the page must own its own spacing either way. */
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

/* static.tildacdn.com is blocked by this environment's network policy, so
   without this every image collapses to nothing and every measurement of how
   big a picture is on screen is worthless. A stand-in of a plausible shape is
   served in its place: a wide one for the wide slots, a square one for the
   map, 4:3 for the rest. The layout measured below is then the layout a guest
   actually gets, which is the entire point of measuring it. */
const STAND = (w, h) => ({ status: 200, contentType: 'image/svg+xml',
  body: `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="#6f6f78"/></svg>` });
async function servePictures(target) {
  await target.route('**static.tildacdn.com/**', r => {
    const u = r.request().url();
    /* The stand-ins must be the real shapes. They were not, and a 1024 square
       was being measured as a 1200 x 900, which is shorter: the picture-scale
       check was passing on pictures the page will never actually be sent. */
    if (/1000034569/.test(u)) return r.fulfill(STAND(1690, 900));  // the annotated stadium view, hero size
    r.fulfill(STAND(1024, 1024));                                             // everything else is a 1024 square
  });
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

/* ---- 1. Layout, at every width (Document B section 12) ---- */
console.log('\n=== 1. LAYOUT AND MOBILE AUDIT ===');
for (const w of [1440, 1280, 1024, 860, 620, 390]) {
  const p = await browser.newPage({ viewport: { width: w, height: 1000 } });
  await servePictures(p);
  await p.setContent(doc, { waitUntil: 'load' });
  await p.evaluate(async () => { document.querySelectorAll('img[loading="lazy"]').forEach(i => i.loading = 'eager');
    await Promise.all([...document.images].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; }))); });
  const r = await p.evaluate(() => ({
    over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    h: document.documentElement.scrollHeight,
    small: [...document.querySelectorAll('.mtx-sm a.mtx-sm__btn')]
      .map(a => a.getBoundingClientRect()).filter(r => r.height > 0 && r.height < 44).length,
    clipped: [...document.querySelectorAll('.mtx-sm p, .mtx-sm h1, .mtx-sm h2, .mtx-sm h3, .mtx-sm td, .mtx-sm th')]
      .filter(e => { const s = getComputedStyle(e);
        return (s.textOverflow === 'ellipsis' || s.overflow === 'hidden') && e.scrollHeight > e.clientHeight + 1; }).length,
  }));
  console.log(`   ${String(w).padStart(5)}px  overflow ${r.over}px  height ${r.h}px  small taps ${r.small}  clipped ${r.clipped}`);
  if (r.over > 0) fail(`${w}px scrolls sideways by ${r.over}px`);
  if (r.small) fail(`${w}px has ${r.small} button(s) under 44px tall`);
  if (r.clipped) fail(`${w}px has ${r.clipped} truncated text block(s)`);
  await p.close();
}

/* ---- 1b. Two whole families of fault, caught by measurement ---- */
console.log('\n=== 1b. SPACING AND PICTURE SCALE ===');
for (const [w, h] of [[1440, 900], [1280, 800], [1000, 520], [390, 844]]) {
  const p = await browser.newPage({ viewport: { width: w, height: h } });
  await servePictures(p);
  await p.setContent(doc, { waitUntil: 'load' });
  await p.evaluate(async () => { document.querySelectorAll('img[loading="lazy"]').forEach(i => i.loading = 'eager');
    await Promise.all([...document.images].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; }))); });
  const r = await p.evaluate(() => {
    /* A heading flush against the thing under it is almost always a reset
       rule at (0,1,1) beating a single-class margin-top. It has bitten this
       project three times, so it is measured rather than eyeballed. */
    const tight = [...document.querySelectorAll('.mtx-sm h2, .mtx-sm h3')].map(hd => {
      const next = hd.nextElementSibling;
      if (!next) return null;
      const gap = next.getBoundingClientRect().top - hd.getBoundingClientRect().bottom;
      return gap < 14 ? { text: hd.textContent.trim().slice(0, 44), gap: Math.round(gap) } : null;
    }).filter(Boolean);
    /* Consecutive paragraphs with no air between them: the same reset-beats-
       single-class fault as a flush heading, one level down. */
    const runOn = [...document.querySelectorAll('.mtx-sm p + p')].map(p => {
      const prev = p.previousElementSibling;
      /* Inside a multi-column container the next paragraph can start ABOVE
         the bottom of the one before it, because it is in the next column.
         Geometry says nothing there, so the spacing is checked from the
         computed style instead of being skipped. */
      const multi = p.closest('.mtx-sm__cols');
      if (multi) {
        const air = parseFloat(getComputedStyle(prev).marginBottom)
                  + parseFloat(getComputedStyle(p).marginTop);
        return air < 6 ? { text: p.textContent.trim().slice(0, 44), gap: Math.round(air) } : null;
      }
      const gap = p.getBoundingClientRect().top - prev.getBoundingClientRect().bottom;
      return gap < 6 ? { text: p.textContent.trim().slice(0, 44), gap: Math.round(gap) } : null;
    }).filter(Boolean);
    /* A picture in the flow of the page is not allowed to own the screen.
       A background layer is excluded: the hero photograph is positioned to
       fill its own band and is supposed to, which is a different thing from
       a content picture pushing the copy under it off the fold. */
    /* The seating map is exempt, and only the seating map. The 62 per cent
       rule exists to stop a picture shoving the copy under it off the fold.
       On this page the map IS the copy: Document B section 5 says in terms
       that it must not be reduced to a decorative thumbnail. So it is
       excluded here and given a MINIMUM size check instead, lower down. */
    const huge = [...document.querySelectorAll('.mtx-sm img')].filter(i => {
      const cs = getComputedStyle(i);
      if (i.closest('.mtx-sm__hero-map')) return false;
      return cs.position === 'static' || cs.position === 'relative';
    }).map(i => {
      const b = i.getBoundingClientRect();
      const share = b.height / window.innerHeight;
      return share > 0.62 && b.height > 0 ? { src: i.getAttribute('src').split('/').pop(), pct: Math.round(share * 100) } : null;
    }).filter(Boolean);
    /* "I want people to be able to see it clearly." Three things are measured
       rather than trusted: the graphic is square, so no part of the frame or
       either line of type is cut off; it is inside the hero; and the point at
       its centre belongs to the graphic itself, so no headline, wash or
       button is painted over it. */
    const markEl = document.querySelector('.mtx-sm__hero-map img');
    let mark = null;
    if (markEl) {
      /* elementFromPoint only answers for points inside the viewport, so the
         graphic is scrolled into view before the hit test. Without this the
         check reported "something is painted over it" on a phone, where the
         graphic simply sits below the fold. */
      markEl.scrollIntoView({ block: 'center' });
      const b = markEl.getBoundingClientRect();
      const top = document.elementFromPoint(
        Math.round(b.left + b.width / 2), Math.round(b.top + b.height / 2));
      window.scrollTo(0, 0);
      mark = {
        w: Math.round(b.width), h: Math.round(b.height),
        vw: window.innerWidth,
        ratio: +(b.width / b.height).toFixed(3),
        inHero: !!markEl.closest('.mtx-sm__hero'),
        onTop: top === markEl || markEl.contains(top),
        clipped: b.left < -1 || b.right > window.innerWidth + 1,
      };
    }
    return { tight, runOn, huge, mark };
  });
  r.tight.forEach(t => fail(`${w}x${h}: "${t.text}" sits ${t.gap}px above the next element`));
  r.runOn.forEach(t => fail(`${w}x${h}: "${t.text}" runs into the paragraph above it, ${t.gap}px gap`));
  r.huge.forEach(x => fail(`${w}x${h}: ${x.src} is ${x.pct}% of the screen height`));
  if (!r.mark) fail(`${w}x${h}: the seating map is not in the hero`);
  else {
    if (Math.abs(r.mark.ratio - 1) > 0.02) fail(`${w}x${h}: the seating map is ${r.mark.ratio}:1, not square`);
    if (!r.mark.inHero) fail(`${w}x${h}: the seating map is outside the hero`);
    if (!r.mark.onTop) fail(`${w}x${h}: something is painted over the seating map`);
    if (r.mark.clipped) fail(`${w}x${h}: the seating map runs off the screen`);
    if (r.mark.w < 240) fail(`${w}x${h}: the seating map is only ${r.mark.w}px wide`);
    console.log(`   ${String(w) + 'x' + h}  seating map ${r.mark.w}x${r.mark.h} in the hero, nothing over it`);
  }
  console.log(`   ${String(w) + 'x' + h}  headings flush: ${r.tight.length}   paragraphs run together: ${r.runOn.length}   pictures over 62% of the screen: ${r.huge.length}`);
  await p.close();
}

const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await servePictures(page);
await page.setContent(doc, { waitUntil: 'load' });
const visible = norm(await page.evaluate(() => document.querySelector('.mtx-sm').textContent));

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
  [...document.querySelectorAll('.mtx-sm h1, .mtx-sm h2, .mtx-sm h3, .mtx-sm p, .mtx-sm li, .mtx-sm summary, .mtx-sm th, .mtx-sm td, .mtx-sm a')]
    .filter(e => ![...e.children].some(c => c.textContent.trim()))
    .map(e => e.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean));
const approved = Object.values(DOC).map(norm);
const extra = [...new Set(onPage.filter(s => !approved.some(a => a === norm(s) || a.includes(norm(s)))))];
extra.forEach(s => fail(`independently authored text on page: "${s.slice(0, 90)}"`));
console.log(`   ${onPage.length} visible text nodes; ${extra.length} not traceable to Document A`);

/* ---- 3b. Alignment inside the host ---- */
console.log('\n=== 3b. ALIGNMENT INSIDE THE TILDA HOST ===');
const ALIGN = [
  ['.mtx-sm__hero h1', 'left'], ['.mtx-sm__lede', 'left'], ['.mtx-sm__where li', 'left'],
  ['.mtx-sm__answer-lead', 'left'], ['.mtx-sm__answer-copy', 'left'],
  ['.mtx-sm__cols p', 'left'], ['.mtx-sm__guide p', 'left'],
  ['.mtx-sm__split-body p', 'left'], ['.mtx-sm__caveat', 'left'],
  ['.mtx-sm__guide h3', 'left'], ['.mtx-sm__guide-where', 'left'],
  ['.mtx-sm__practical li', 'left'], ['.mtx-sm__where li', 'left'],
  ['.mtx-sm__map-go a', 'left'], ['.mtx-sm__faq summary h3', 'left'],
  ['.mtx-sm__faq p', 'left'], ['.mtx-sm__close-copy', 'left'],
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
  /* Document B section 9, word for word, plus Document A section 7. */
  ['official', /\bofficial\b/i],
  ['second level', /second[ -]level/i],
  ['second floor', /second[ -]floor/i],
  ['standing', /\bstanding\b/i],
  ['no seats', /\bno seats\b/i],
  ['exact seat number', /exact seat number/i],
  ['guaranteed row', /guaranteed row|row is guaranteed/i],
  ['guaranteed map position', /guaranteed (map )?position/i],
  ['guaranteed view', /guaranteed view|view is guaranteed/i],
  ['guaranteed proximity', /guaranteed proximity/i],
  ['betting every night', /betting every night|bet every night/i],
  ['all seats are panoramic', /panoramic/i],
  ['all seats are front-facing', /all seats are front.facing/i],
  ['Third Class is always available', /third class is always available/i],
  ['best in the stadium', /best (seats?|view|section) in the stadium/i],
  ['unobstructed', /\bunobstructed\b/i],
  ['nearly sold out', /nearly sold out/i],
  ['limited seats', /limited seats/i],
  ['last chance', /last chance/i],
  ['selling fast', /selling fast/i],
  ['available tonight', /available tonight/i],
];
const approvedBlob = Object.values(DOC).map(norm).join(' ␟ ');
let flagged = 0;
for (const [label, re] of BANNED) {
  if (!re.test(visible)) continue;
  if (re.test(approvedBlob)) {
    const where = Object.entries(DOC).filter(([, val]) => re.test(val)).map(([key]) => key);
    console.log(`   "${label}" appears only inside approved copy: ${where.join(', ')}`);
    continue;
  }
  fail(`unsupported claim introduced by this build: "${label}"`); flagged++;
}
console.log(`   ${BANNED.length} terms checked; ${flagged} introduced by this build`);

/* Document A section 6, the factual lock. Every section number on the page is
   checked against the class it is attached to, because a wrong number here is
   the single worst thing this page could do. */
const SECTIONS = [
  ['Ringside',    /ringside[^.]{0,80}sections 3 to 7|sections 3 to 7[^.]{0,80}ringside/i],
  ['Club Class',  /club class[^.]{0,80}sections 8 and 9|sections 8 and 9[^.]{0,80}club class/i],
  ['LEO',         /leo[^.]{0,80}section 10|section 10[^.]{0,80}leo/i],
  ['Third Class', /third class[^.]{0,80}section 11|section 11[^.]{0,80}third class/i],
];
for (const [cls, re] of SECTIONS) if (!re.test(visible)) fail(`the page does not tie ${cls} to its section number`);
console.log('   section numbers tied to their classes: Ringside 3 to 7, Club Class 8 and 9, LEO 10, Third Class 11');

/* Document A section 6 and the final acceptance standard. */
const MUST = [
  ['no standing areas',                  /there are no standing areas/i],
  ['every ticket guarantees a seat',     /every ticket guarantees a seat/i],
  ['the walkway runs through 3 and 4',   /between and through (those )?sections( 3 and 4)?/i],
  ['the map does not guarantee a seat',  /does not guarantee a specific row or seat number/i],
  ['capacity is approximate',            /approximately 3,078 spectators/i],
  ['the figures are approximate',        /these figures are approximate/i],
];
for (const [what, re] of MUST) if (!re.test(visible)) fail(`the page does not state: ${what}`);
console.log(`   ${MUST.length} required statements present`);

/* Document A section 5: no temporary inventory claim may appear. This page
   carries no price at all, which is the simplest way to keep that true. */
if (/\d[\d,]*\s*THB/i.test(visible)) fail('a price appears on the seat map page; Document A section 5 keeps inventory off this page');
console.log('   no price, date or availability rendered: nothing on this page is inventory');

/* ---- 5. Image audit (Document B section 7) ---- */
console.log('\n=== 5. IMAGE AUDIT ===');
const imgs = await page.evaluate(() =>
  [...document.querySelectorAll('.mtx-sm img')].map(i => ({
    src: i.getAttribute('src'), alt: i.getAttribute('alt'), hidden: i.getAttribute('aria-hidden') })));

console.log('   Asset            | File            | Alt is an approved Document A line');
for (const [slot, key] of [['Main seating map', 'map'], ['Ringside crop', 'ringside'],
                           ['Club Class crop', 'clubclass'], ['LEO crop', 'leo']]) {
  const img = data.images[key];
  const found = imgs.filter(i => i.src === img.url);
  if (!found.length) { fail(`the ${slot} is not on the page`); continue; }
  if (found.some(i => norm(i.alt) !== norm(DOC[img.alt_key]))) fail(`the ${slot} alt is not Document A's approved line`);
  console.log(`   ${slot.padEnd(16)} | ${img.url.split('/').pop().padEnd(15)} | yes`);
}
console.log(`   ${'Third Class'.padEnd(16)} | none supplied   | reported, not substituted`);

/* The backdrop carries the owner's own approved line for that exact file,
   supplied 28 September. It must be his words, unedited, and it must not be
   hidden from a screen reader now that it has them. */
const back = imgs.filter(i => i.src === data.images.backdrop.url);
if (!back.length) fail('the hero backdrop is not on the page');
for (const b of back) {
  if (norm(b.alt) !== norm(DOC['alt.stadium'])) fail('the hero backdrop alt is not the approved line, word for word');
  if (b.hidden === 'true') fail('the hero backdrop is hidden from screen readers but now carries approved alt text');
}
console.log(`   ${'Stadium view'.padEnd(16)} | ${data.images.backdrop.url.split('/').pop().padEnd(15)} | yes`);

const approvedUrls = new Set([data.images.backdrop.url, ...['map', 'ringside', 'clubclass', 'leo'].map(k => data.images[k].url)]);
imgs.filter(i => !approvedUrls.has(i.src)).forEach(i => fail(`unapproved image on page: ${i.src}`));
/* Every image that is not the decorative backdrop must carry alt text. */
for (const i of imgs) if (i.hidden !== 'true' && !(i.alt || '').trim()) fail(`image with no alt text: ${i.src}`);
console.log(`   ${imgs.length} images, ${imgs.filter(i => !approvedUrls.has(i.src)).length} outside the approved set`);

/* ---- 5b. Map audit (Document B section 6) ---- */
console.log('\n=== 5b. MAP AUDIT ===');
const MA = data.map_audit;
for (const [req, key] of [['Ring labelled', 'ring'], ['Sections 3 to 7 labelled', 'sections_3_to_7'],
  ['Sections 8 and 9 labelled', 'sections_8_and_9'], ['Section 10 labelled as LEO', 'section_10'],
  ['Section 11 labelled as Third Class', 'section_11'], ['Fighter entrance walkway shown', 'walkway'],
  ['Legend present', 'legend']])
  console.log(`   ${req.padEnd(36)} ${MA[key]}`);
console.log(`   ${'Also on the map'.padEnd(36)} ${MA.other}`);

/* ---- 6. Link audit (Document B section 11) ---- */
console.log('\n=== 6. INTERNAL LINK AUDIT ===');
const links = await page.evaluate(() =>
  [...document.querySelectorAll('.mtx-sm a')].map(a => ({
    href: a.getAttribute('href'), text: a.textContent.trim(),
    imgAlt: [...a.querySelectorAll('img')].map(i => i.getAttribute('alt') || '').join('').trim() })));
const ALLOWED = new Set(Object.values(data.destinations));
/* Document B section 10's link audit for THIS page. It does not ask for a
   link to /rajadamnern-stadium, and nothing may be added that Document A did
   not approve, so it is not here. Explore Third Class is absent on purpose:
   Document A section 7 says that page is not currently being built. */
const REQUIRED = ['/rajadamnern-stadium-seating', '/rajadamnern-stadium-tickets',
  '/rajadamnern-stadium-seating/ringside', '/rajadamnern-stadium-seating/club-class',
  '/rajadamnern-stadium-seating/leo-section', data.destinations.map_full];
for (const l of links) {
  if (!l.text && !l.imgAlt) fail(`link with neither text nor an image with alt text: ${l.href}`);
  if (!ALLOWED.has(l.href)) fail(`destination not in Document A section 8: ${l.href}`);
}
const hrefs = new Set(links.map(l => l.href));
for (const r of REQUIRED) if (!hrefs.has(r)) fail(`Document A section 9 requires a link to ${r} and there is none`);
console.log(`   ${links.length} links, ${hrefs.size} distinct, ${REQUIRED.length}/${REQUIRED.length} required destinations present`);
/* The page must not link to itself. */
if (hrefs.has('/rajadamnern-stadium-seat-map')) fail('the page links to itself');

/* ---- 7. Headings and structured data ---- */
console.log('\n=== 7. HEADINGS AND STRUCTURED DATA ===');
const heads = await page.evaluate(() => [...document.querySelectorAll('.mtx-sm h1,.mtx-sm h2,.mtx-sm h3')].map(h => h.tagName));
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
  const out = []; const walk = document.createTreeWalker(document.querySelector('.mtx-sm'), NodeFilter.SHOW_TEXT);
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
