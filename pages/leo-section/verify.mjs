/* Part F of the brief, run against the built fragment, plus the layout checks
 * this project always runs.
 *
 *   node verify.mjs
 *
 * The copy is checked against brief.txt itself, not against copy.json, so the
 * extractor and the renderer cannot agree with each other and both be wrong.
 */
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
import { readFileSync, writeFileSync } from 'node:fs';

const frag = readFileSync('leo-live.txt', 'utf8');
const brief = readFileSync('brief.txt', 'utf8').split('\n');
const norm = s => s.replace(/\s+/g, ' ').replace(/ /g, ' ').trim();
let fails = 0;
const copyIssues = [];
const fail = m => { fails++; console.log('   FAIL  ' + m); };

/* The host: Tilda is not a blank page. It centres text and restyles links by
   matching elements directly, so the fragment is always tested inside it. */
const HOST = `
  #allrecords { font-family: Arial, Helvetica, sans-serif; }
  #allrecords * { text-align: center; }
  #allrecords a { text-decoration: none; color: inherit; }
  #allrecords img { max-width: 100%; }
  #allrecords ul, #allrecords ol { list-style: none; padding: 0; }`;
const doc = `<!doctype html><html lang="en-GB"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}${HOST}</style></head>
<body><div id="allrecords">${frag}</div></body></html>`;

/* static.tildacdn.com is blocked here, so pictures are served as stand-ins of
   their real shapes. */
const STAND = (w, h) => ({ status: 200, contentType: 'image/svg+xml',
  body: `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#566178"/></svg>` });
async function pictures(page) {
  await page.route('**static.tildacdn.com/**', r => r.fulfill(/1000034569/.test(r.request().url()) ? STAND(1690, 900) : STAND(1024, 1024)));
}
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
async function open(w, h, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: opts.reduce ? 'reduce' : 'no-preference' });
  const p = await ctx.newPage();
  await pictures(p);
  await p.setContent(doc, { waitUntil: 'load' });
  await p.evaluate(async () => { document.querySelectorAll('img').forEach(i => i.loading = 'eager');
    await Promise.all([...document.images].map(i => i.decode().catch(() => {}))); });
  return p;
}

/* ---- Part E, read straight from the brief ---- */
const a = brief.findIndex(l => l.startsWith('SECTION 1. '));
const z = brief.findIndex(l => l.startsWith('BUILD NOTES (not copy)'));
const LABELS = /^(Kicker|H1|Subheading|Intro|Fact strip|Primary CTA|Secondary link|H2|Urgency line|Trust line|CTA|Headline|Body|Detail|Photo captions|Link|Tile \d)$/;
const copyLines = [];
const h2s = [];
let lastLabel = null, secNo = 0;
for (const raw of brief.slice(a, z)) {
  const l = raw.trim();
  if (!l || /^=+$/.test(l) || l.startsWith('[BUILD')) continue;
  if (/^SECTION \d+\. /.test(l)) { secNo = +l.match(/^SECTION (\d+)/)[1]; lastLabel = null; continue; }
  if (LABELS.test(l)) { lastLabel = l; continue; }
  const t = l.replace(/^[QA]: /, '');
  if (lastLabel === 'H2') { h2s.push({ sec: secNo, text: t }); lastLabel = null; }
  copyLines.push(t);
}
const copySet = copyLines.map(norm);
const copyJoined = '\n' + copySet.join('\n') + '\n';

/* ---- 0. Structure ---- */
console.log('=== 0. STRUCTURE ===');
{
  const classes = new Set([...frag.matchAll(/\sclass="([^"]+)"/g)].flatMap(m => m[1].split(/\s+/)));
  const foreign = [...classes].filter(c => !c.startsWith('mtx-leo-') && c !== 'muaytix-ticket-selector' && c !== 'is-on' && c !== 'is-open');
  foreign.forEach(c => fail(`class outside the mtx-leo- namespace: ${c}`));
  if (/<(html|head|body)\b/i.test(frag)) fail('the fragment contains a document wrapper tag');
  if (/<link\b|<script[^>]*\ssrc=|@import|https?:\/\/(fonts|cdn|ajax|unpkg)/i.test(frag)) fail('the fragment loads something from outside');
  const scripts = [...frag.matchAll(/<script\b([^>]*)>/g)].map(m => m[1].trim());
  const js = scripts.filter(s => !/ld\+json/.test(s));
  if (js.length !== 1) fail(`expected one script block of behaviour, found ${js.length}`);
  const style = (frag.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || '';
  const bad = [...style.matchAll(/(^|\})\s*([^{}@]+)\{/g)].map(m => m[2].trim()).filter(sel =>
    sel.split(',').some(s => s.trim() && !/^(#mtx-leo\.mtx-leo-page|\.mtx-leo-page)\b/.test(s.trim()) && !/^(\d+%|from|to)$/.test(s.trim())));
  bad.slice(0, 5).forEach(s => fail(`CSS selector not scoped to the page: ${s.slice(0, 70)}`));
  console.log(`   ${classes.size} classes, all in the mtx-leo- namespace; ${js.length} behaviour script; no external loads; ${bad.length} unscoped selectors`);
}

/* ---- 1. Diff check ---- */
console.log('\n=== 1. DIFF CHECK: page text against Part E ===');
const page = await open(1440, 900);
const { nodes, full } = await page.evaluate(() => {
  const w = document.createTreeWalker(document.getElementById('mtx-leo'), NodeFilter.SHOW_TEXT);
  const nodes = []; let n;
  while ((n = w.nextNode())) {
    const e = n.parentElement;
    if (['STYLE', 'SCRIPT', 'NOSCRIPT'].includes(e.tagName)) continue;
    const t = n.textContent.replace(/\s+/g, ' ').trim();
    if (t) nodes.push(t);
  }
  /* Block level text, joined with a newline, so a line of copy can be looked
     for as a whole. */
  const blocks = [...document.querySelectorAll('#mtx-leo h1,#mtx-leo h2,#mtx-leo h3,#mtx-leo p,#mtx-leo li,#mtx-leo figcaption,#mtx-leo .mtx-leo-fact,#mtx-leo .mtx-leo-qbtn,#mtx-leo .mtx-leo-btn,#mtx-leo .mtx-leo-link')]
    .map(e => e.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean);
  return { nodes, full: blocks.join('\n') };
});
const fullN = '\n' + full.split('\n').map(norm).join('\n') + '\n';
const missing = copySet.filter(l => !fullN.includes(l) && !fullN.includes('\n' + l));
missing.forEach(l => fail(`line of copy not on the page: "${l.slice(0, 80)}"`));
const extra = [...new Set(nodes.filter(t => !copyJoined.includes(norm(t))))];
extra.forEach(t => fail(`text on the page that is not in Part E: "${t.slice(0, 80)}"`));
console.log(`   ${copySet.length} lines of copy in Part E; ${missing.length} missing from the page`);
console.log(`   ${nodes.length} text nodes on the page; ${extra.length} not traceable to Part E`);
console.log('   diff output: ' + (missing.length + extra.length === 0 ? 'none' : 'see failures above'));

/* ---- 2. Order check ---- */
console.log('\n=== 2. ORDER CHECK: H2s in DOM order against Part C ===');
const domH2 = await page.evaluate(() => [...document.querySelectorAll('#mtx-leo h2')].map(h => h.textContent.trim()));
const wantH2 = h2s.map(h => h.text);
domH2.forEach((t, i) => console.log(`   ${String(i + 1).padStart(2)}. ${t}`));
if (JSON.stringify(domH2.map(norm)) !== JSON.stringify(wantH2.map(norm))) fail('the H2s are not the Part E H2s in Part C order');
const heads = await page.evaluate(() => ({ h1: document.querySelectorAll('#mtx-leo h1').length, h2: document.querySelectorAll('#mtx-leo h2').length, h3: document.querySelectorAll('#mtx-leo h3').length }));
if (heads.h1 !== 1) fail(`the page has ${heads.h1} H1 elements`);
const secOrder = await page.evaluate(() => [...document.querySelectorAll('#mtx-leo > header, #mtx-leo > section, #mtx-leo > div.mtx-leo-sec')].map(e =>
  e.tagName === 'HEADER' ? 'hero' : (e.querySelector('[data-mtx-slot]') ? 'widget' : (e.querySelector('h2') ? e.querySelector('h2').textContent.slice(0, 28) : 'links'))));
console.log(`   H1 ${heads.h1}, H2 ${heads.h2}, H3 ${heads.h3} (4 + 5 tiles and 13 questions expected: 22)`);
if (heads.h3 !== 22) fail(`expected 22 H3 elements, found ${heads.h3}`);

/* ---- 3. Keyword check ---- */
console.log('\n=== 3. KEYWORD CHECK ===');
const visible = norm(await page.evaluate(() => document.getElementById('mtx-leo').textContent)).toLowerCase();
for (const k of ['leo section rajadamnern stadium', 'leo section rajadamnern', 'rajadamnern stadium leo section', 'rajadamnern leo section',
  'leo section muay thai', 'leo class', 'rajadamnern stadium section 10', 'section 10 rajadamnern stadium', 'second class']) {
  const n = visible.split(k).length - 1;
  console.log(`   ${n > 0 ? 'present' : 'MISSING'}  (${String(n).padStart(2)}x)  ${k}`);
  if (!n) copyIssues.push(`keyword string not in the rendered copy: "${k}"`);
}

/* ---- 4. Character check ---- */
console.log('\n=== 4. CHARACTER CHECK ===');
const ems = (frag.match(/[—–]/g) || []).length, bangs = (frag.match(/!/g) || []).length;
console.log(`   em or en dashes in the whole fragment: ${ems};  exclamation marks in the whole fragment: ${bangs}`);
if (ems) fail('a dash character is in the fragment');
if (bangs) fail('an exclamation mark is in the fragment');

/* ---- 5. Widget position ---- */
console.log('\n=== 5. WIDGET POSITION ===');
console.log('   blocks in DOM order: ' + secOrder.slice(0, 4).join(' | ') + ' | ...');
if (secOrder[2] !== 'widget') fail('the widget is not the third block');
{
  const links = await page.evaluate(() => [...document.querySelectorAll('#mtx-leo a')].filter(a => /Book LEO Tickets/.test(a.textContent)).map(a => a.getAttribute('href')));
  console.log(`   Book LEO Tickets links: ${links.length}, all to ${[...new Set(links)].join(', ')}`);
  if (links.some(h => h !== '#mtx-leo-book')) fail('a Book LEO Tickets button does not jump to the widget');
  for (const [w, h] of [[1440, 900], [390, 844]]) {
    const p = await open(w, h, { reduce: true });
    const tops = [];
    for (const sel of ['.mtx-leo-hero .mtx-leo-btn', '#mtx-leo > section:nth-of-type(7) .mtx-leo-btn', '.mtx-leo-final .mtx-leo-btn']) {
      await p.evaluate(() => scrollTo(0, 0));
      await p.evaluate(s => document.querySelector(s).scrollIntoView(), sel);
      await p.evaluate(s => document.querySelector(s).click(), sel);
      await p.waitForTimeout(300);
      tops.push(await p.evaluate(() => Math.round(document.getElementById('mtx-leo-book').getBoundingClientRect().top)));
    }
    console.log(`   ${w}px: after each button the widget is ${tops.join(', ')}px from the top of the screen`);
    if (tops.some(t => Math.abs(t - 14) > 2)) fail(`${w}px: a button does not land on the widget`);
    await p.context().close();
  }
}

/* ---- 6. Mobile check ---- */
console.log('\n=== 6. MOBILE CHECK (390 x 844) ===');
{
  const p = await open(390, 844);
  const m = await p.evaluate(() => {
    const b = document.querySelector('.mtx-leo-hero .mtx-leo-btn').getBoundingClientRect();
    const facts = [...document.querySelectorAll('.mtx-leo-fact')].map(f => Math.round(f.getBoundingClientRect().top));
    return { top: Math.round(b.top), bottom: Math.round(b.bottom), rows: new Set(facts).size, vh: innerHeight };
  });
  console.log(`   hero button: ${m.top}px to ${m.bottom}px of an ${m.vh}px screen; fact strip rows: ${m.rows}`);
  if (m.bottom > m.vh - 120) fail(`the hero button ends at ${m.bottom}px, too close to the fold once a site header is above it`);
  if (m.rows !== 2) fail(`the fact strip is ${m.rows} rows on a phone, not two`);
  await p.screenshot({ path: 'qa/mobile-1-hero-button-visible.jpg', type: 'jpeg', quality: 72 });
  const states = [];
  const bar = () => p.evaluate(() => { const b = document.querySelector('[data-mtx-leo-bar]'); const r = b.getBoundingClientRect(); return { shown: getComputedStyle(b).display !== 'none', h: Math.round(r.height), bottom: Math.round(r.bottom), vh: innerHeight }; });
  await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(150); states.push(['top', await bar()]);
  await p.evaluate(() => { const w = document.getElementById('mtx-leo-book'); scrollTo(0, w.getBoundingClientRect().top + scrollY - 20); }); await p.waitForTimeout(150); states.push(['widget in view', await bar()]);
  await p.evaluate(() => { const w = document.getElementById('mtx-leo-book'); scrollTo(0, w.getBoundingClientRect().bottom + scrollY + 400); }); await p.waitForTimeout(250); states.push(['past the widget', await bar()]);
  await p.screenshot({ path: 'qa/mobile-2-sticky-bar-after-widget.jpg', type: 'jpeg', quality: 72 });
  for (const [n, s] of states) console.log(`   ${n.padEnd(16)} bar shown: ${s.shown}  height ${s.h}px`);
  if (states[0][1].shown || states[1][1].shown) fail('the bar is showing when it should not be');
  if (!states[2][1].shown) fail('the bar does not show once the guest is past the widget');
  if (states[2][1].h !== 56) fail(`the bar is ${states[2][1].h}px tall, not 56`);
  const wide = await open(1024, 800);
  await wide.evaluate(() => { const w = document.getElementById('mtx-leo-book'); scrollTo(0, w.getBoundingClientRect().bottom + scrollY + 400); }); await wide.waitForTimeout(250);
  const ws = await wide.evaluate(() => getComputedStyle(document.querySelector('[data-mtx-leo-bar]')).display);
  console.log(`   at 1024px wide, past the widget: bar display ${ws}`);
  if (ws !== 'none') fail('the bar shows on a screen 768px or wider');
  await wide.context().close();
}

/* ---- 7. Schema check ---- */
console.log('\n=== 7. SCHEMA CHECK ===');
{
  const blocks = [...frag.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => m[1]);
  if (blocks.length !== 1) fail(`expected one JSON-LD block, found ${blocks.length}`);
  let j = null; try { j = JSON.parse(blocks[0]); } catch (e) { fail('the JSON-LD does not parse: ' + e.message); }
  if (j) {
    if (j['@context'] !== 'https://schema.org' || j['@type'] !== 'FAQPage') fail('the block is not a FAQPage');
    const qa = [];
    let q = null;
    for (const raw of brief.slice(a, z)) { const l = raw.trim(); if (l.startsWith('Q: ')) q = l.slice(3); else if (l.startsWith('A: ') && q) { qa.push([q, l.slice(3)]); q = null; } }
    if (j.mainEntity.length !== qa.length) fail(`schema has ${j.mainEntity.length} questions, Part E has ${qa.length}`);
    qa.forEach(([qq, aa], i) => {
      const e = j.mainEntity[i];
      if (!e || e['@type'] !== 'Question' || e.name !== qq) fail(`question ${i + 1} differs from Part E`);
      else if (e.acceptedAnswer['@type'] !== 'Answer' || e.acceptedAnswer.text !== aa) fail(`answer ${i + 1} differs from Part E`);
    });
    const bad = Object.keys(j).filter(k => !['@context', '@type', 'mainEntity'].includes(k));
    if (bad.length) fail(`unexpected schema fields: ${bad.join(', ')}`);
    console.log(`   one FAQPage block, ${j.mainEntity.length} questions, every question and answer identical to Part E, no other schema`);
    console.log('   structural validation only: Google\'s Rich Results Test is an external service and was not run from here');
  }
}

/* ---- 8. Meta check ---- */
console.log('\n=== 8. META CHECK ===');
{
  const settings = readFileSync('TILDA-PAGE-SETTINGS.txt', 'utf8');
  const titleBrief = brief[brief.findIndex(l => l.startsWith('Meta title (')) + 1].trim();
  const descBrief = brief[brief.findIndex(l => l.startsWith('Meta description (')) + 1].trim();
  const wantT = +brief.find(l => l.startsWith('Meta title (')).match(/\((\d+) characters/)[1];
  const wantD = +brief.find(l => l.startsWith('Meta description (')).match(/\((\d+) characters/)[1];
  console.log(`   title (${titleBrief.length} characters, brief says ${wantT}): ${titleBrief}`);
  console.log(`   description (${descBrief.length} characters, brief says ${wantD}): ${descBrief}`);
  if (titleBrief.length !== wantT) fail(`the title is ${titleBrief.length} characters, the brief says ${wantT}`);
  if (descBrief.length !== wantD) fail(`the description is ${descBrief.length} characters, the brief says ${wantD}`);
  if (!settings.includes(titleBrief) || !settings.includes(descBrief)) fail('TILDA-PAGE-SETTINGS.txt does not carry the exact title and description');
  if ((settings.match(new RegExp(titleBrief.replace(/[|]/g, '\\|'), 'g')) || []).length !== 2) fail('the Open Graph title is not identical to the title');
  if (!/CANONICAL\s+https:\/\/muaytix\.com\/rajadamnern-stadium-seating\/leo-section\s*$/.test(settings)) fail('the canonical is not the page URL');
}

/* ---- 9. The checks this project always runs ---- */
console.log('\n=== 9. LAYOUT, IMAGES, CONTRAST, ACCESSIBILITY ===');
for (const w of [1440, 1280, 1024, 860, 768, 620, 390]) {
  const p = await open(w, 1000);
  const r = await p.evaluate(() => ({
    over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    small: [...document.querySelectorAll('#mtx-leo a.mtx-leo-btn, #mtx-leo .mtx-leo-qbtn')].map(a => a.getBoundingClientRect()).filter(r => r.height > 0 && r.height < 44).length,
    flush: [...document.querySelectorAll('#mtx-leo h2, #mtx-leo h3')].filter(h => !h.classList.contains('mtx-leo-q')).map(h => { const n = h.nextElementSibling; if (!n) return null;
      const g = n.getBoundingClientRect().top - h.getBoundingClientRect().bottom; return g < 8 ? h.textContent.slice(0, 40) : null; }).filter(Boolean),
    body: parseFloat(getComputedStyle(document.querySelector('#mtx-leo .mtx-leo-body')).fontSize),
    tiny: [...document.querySelectorAll('#mtx-leo p:not(.mtx-leo-kicker), #mtx-leo li, #mtx-leo dd, #mtx-leo figcaption')].filter(e => parseFloat(getComputedStyle(e).fontSize) < 15).map(e => e.tagName + ' ' + parseFloat(getComputedStyle(e).fontSize) + 'px ' + e.textContent.trim().slice(0, 24)),
    cols4: [...new Set([...document.querySelectorAll('.mtx-leo-tiles--four .mtx-leo-tile')].map(t => Math.round(t.getBoundingClientRect().top)))].length,
    cols5: [...new Set([...document.querySelectorAll('.mtx-leo-tiles--five .mtx-leo-tile')].map(t => Math.round(t.getBoundingClientRect().top)))].length,
    maxw: Math.round(document.querySelector('.mtx-leo-wrap').getBoundingClientRect().width),
    h1: parseFloat(getComputedStyle(document.querySelector('.mtx-leo-h1')).fontSize),
    h2: parseFloat(getComputedStyle(document.querySelector('.mtx-leo-sec .mtx-leo-h2')).fontSize),
  }));
  console.log(`   ${String(w).padStart(5)}px  overflow ${r.over}  small taps ${r.small}  flush headings ${r.flush.length}  body ${r.body}px  H1 ${r.h1}px  H2 ${r.h2}px  rows of tiles: four-up ${r.cols4}, five-up ${r.cols5}  content width ${r.maxw}`);
  if (r.over > 0) fail(`${w}px scrolls sideways by ${r.over}px`);
  if (r.small) fail(`${w}px has ${r.small} button(s) under 44px tall`);
  r.flush.forEach(t => fail(`${w}px: "${t}" is flush against what follows`));
  if (r.body < 16) fail(`${w}px: body text is ${r.body}px`);
  r.tiny.forEach(t => fail(`${w}px: text under 15px: ${t}`));
  if (w >= 1200 && (r.cols4 !== 1 || r.cols5 !== 1)) fail(`${w}px: tiles are not a single row`);
  if (w >= 768 && w < 1200 && (r.cols4 !== 2 || r.cols5 !== 2)) fail(`${w}px: tiles are not 2x2 and 3+2`);
  if (w < 768 && (r.cols4 !== 4 || r.cols5 !== 5)) fail(`${w}px: tiles are not a single column`);
  if (w === 1440 && r.maxw > 1100) fail('the content is wider than 1100px');
  if (w === 390 && (r.h1 !== 40 || r.h2 !== 28)) fail('headings are not 40px and 28px on a phone');
  if (w === 1440 && (r.h1 !== 56 || r.h2 !== 36)) fail('headings are not 56px and 36px on desktop');
  await p.context().close();
}
{
  const imgs = await page.evaluate(() => [...document.querySelectorAll('#mtx-leo img')].map(i => ({ src: i.getAttribute('src').split('/').pop(), alt: i.getAttribute('alt'),
    w: i.getAttribute('width'), h: i.getAttribute('height'), lazy: i.getAttribute('loading') })));
  const wantAlt = ['LEO Section Rajadamnern Stadium, Section 10 seating', 'View from the front row of LEO Section Rajadamnern Stadium',
    'View from Row G in LEO Section at Rajadamnern Stadium', 'LEO Section bench seating, Section 10, Rajadamnern Stadium'];
  console.log(`   ${imgs.length} images; alt lines: ${imgs.map(i => i.alt === null ? 'none' : 'ok').join(' ')}`);
  for (const w of wantAlt) if (!imgs.some(i => i.alt === w)) fail(`image alt not as the brief gives it: ${w}`);
  const loading = [...frag.matchAll(/<img\b[^>]*loading="(\w+)"/g)].map(m => m[1]);
  imgs.forEach((i) => { if (!i.w || !i.h) fail(`image ${i.src} has no width and height`); });
  if (loading[0] !== 'eager' || loading.slice(1).some(x => x !== 'lazy') || loading.length !== 4) fail(`image loading in the fragment is ${loading.join(', ')}; the hero is eager and the rest lazy`);
  console.log(`   image loading as shipped: ${loading.join(', ')}`);
}
{
  /* FAQ. Every answer present at load, the first open, the rest closed. */
  const f = await page.evaluate(() => ({
    answers: document.querySelectorAll('#mtx-leo .mtx-leo-a').length,
    withText: [...document.querySelectorAll('#mtx-leo .mtx-leo-a')].filter(a => a.textContent.trim().length > 20).length,
    open: [...document.querySelectorAll('#mtx-leo .mtx-leo-qbtn')].map(b => b.getAttribute('aria-expanded')),
    hiddenOthers: [...document.querySelectorAll('#mtx-leo .mtx-leo-a')].slice(1).every(a => a.hidden),
  }));
  console.log(`   FAQ: ${f.answers} answers in the DOM at load (${f.withText} with text); first open: ${f.open[0]}; the rest closed: ${f.open.slice(1).every(x => x === 'false')}`);
  if (f.answers !== 13 || f.withText !== 13) fail('not every FAQ answer is in the DOM at load');
  if (f.open[0] !== 'true' || !f.open.slice(1).every(x => x === 'false') || !f.hiddenOthers) fail('the FAQ is not first-open, rest-closed at load');
  await page.click('#mtx-leo-q3');
  const after = await page.evaluate(() => ({ q3: document.getElementById('mtx-leo-q3').getAttribute('aria-expanded'), a3hidden: document.getElementById('mtx-leo-a3').hidden }));
  if (after.q3 !== 'true' || after.a3hidden) fail('clicking a question does not open its answer');
  await page.click('#mtx-leo-q3');
  const again = await page.evaluate(() => document.getElementById('mtx-leo-a3').hidden);
  if (!again) fail('clicking an open question does not close it');
  console.log('   FAQ click: opens, then closes, aria-expanded follows');
}
{
  const lum = c => { const v = c.map(x => x / 255).map(x => x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)); return .2126 * v[0] + .7152 * v[1] + .0722 * v[2]; };
  const bar = await open(390, 844);
  await bar.evaluate(() => { document.querySelector('[data-mtx-leo-bar]').classList.add('is-on'); });
  const nodesC = await bar.evaluate(() => {
    const out = []; const w = document.createTreeWalker(document.getElementById('mtx-leo'), NodeFilter.SHOW_TEXT); let n;
    while ((n = w.nextNode())) {
      const txt = n.textContent.trim(); if (!txt) continue;
      const e = n.parentElement; if (['STYLE', 'SCRIPT', 'NOSCRIPT'].includes(e.tagName)) continue;
      const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      if (e.closest('[hidden]')) continue;
      const parse = s => { const m = (s.match(/[\d.]+/g) || []).map(Number); return m.length ? [m[0] | 0, m[1] | 0, m[2] | 0, m.length > 3 ? m[3] : 1] : [0, 0, 0, 0]; };
      let stack = [], p = e;
      while (p) { const c = parse(getComputedStyle(p).backgroundColor); if (c[3] > 0) stack.push(c); if (c[3] >= 1) break; p = p.parentElement; }
      if (!stack.length || stack[stack.length - 1][3] < 1) stack.push([255, 255, 255, 1]);
      let acc = stack.pop().slice(0, 3);
      while (stack.length) { const c = stack.pop(); acc = acc.map((v, i) => Math.round(c[i] * c[3] + v * (1 - c[3]))); }
      out.push({ txt: txt.slice(0, 36), fg: cs.color, bg: acc, size: parseFloat(cs.fontSize), weight: Number(cs.fontWeight) || 400 });
    } return out;
  });
  let bad = 0;
  for (const n of nodesC) {
    const f = (n.fg.match(/\d+(\.\d+)?/g) || [0, 0, 0]).slice(0, 3).map(Number);
    const r = (Math.max(lum(f), lum(n.bg)) + .05) / (Math.min(lum(f), lum(n.bg)) + .05);
    const large = n.size >= 24 || (n.size >= 18.66 && n.weight >= 700);
    if (r < (large ? 3 : 4.5)) { bad++; fail(`contrast ${r.toFixed(2)} at ${n.size}px: "${n.txt}"`); }
  }
  console.log(`   contrast: ${nodesC.length} text nodes, ${bad} failing (AA)`);
  await bar.context().close();
}
{
  /* Keyboard focus is visible on every control. */
  const f = readFileSync('style.css', 'utf8');
  for (const sel of ['.mtx-leo-btn:focus-visible', '.mtx-leo-qbtn:focus-visible', '.mtx-leo-link:focus-visible', '.mtx-leo-bar:focus-visible'])
    if (!f.includes(sel)) fail(`no visible focus style for ${sel}`);
  console.log('   focus-visible styles present for buttons, links, FAQ rows and the bar');
}

/* ---- 10. Wide-face stress test ----
   Arial Black is not installed here, so every render above uses a lighter
   stand-in and is narrower than the real thing. This pass swaps the display
   face for one that is wider than Arial Black (DejaVu Sans Bold) so that a
   cell, a heading or a button that only fits in the narrow face shows up. */
console.log('\n=== 10. WIDE-FACE STRESS TEST (display face swapped for a wider one) ===');
for (const [w, h] of [[320, 640], [360, 740], [390, 844], [768, 1000], [1440, 900]]) {
  const p = await open(w, h);
  await p.addStyleTag({ content: '.mtx-leo-page { --display: "DejaVu Sans", sans-serif; } .mtx-leo-page .mtx-leo-h1, .mtx-leo-page .mtx-leo-h2, .mtx-leo-page .mtx-leo-h3, .mtx-leo-page .mtx-leo-fact dd, .mtx-leo-page .mtx-leo-btn, .mtx-leo-page .mtx-leo-headline, .mtx-leo-page .mtx-leo-qbtn { font-family: "DejaVu Sans", sans-serif; font-weight: 900; }' });
  await p.waitForTimeout(150);
  const r = await p.evaluate(() => ({
    over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    cellsOver: [...document.querySelectorAll('#mtx-leo .mtx-leo-fact dd, #mtx-leo .mtx-leo-fact dt, #mtx-leo .mtx-leo-btn, #mtx-leo .mtx-leo-tile h3')].filter(e => e.scrollWidth > e.clientWidth + 1).map(e => e.textContent.trim().slice(0, 24)),
    btn: Math.round(document.querySelector('.mtx-leo-hero .mtx-leo-btn').getBoundingClientRect().bottom),
  }));
  console.log(`   ${String(w).padStart(5)}px  overflow ${r.over}  cells wider than their box: ${r.cellsOver.length}  hero button ends at ${r.btn}px of ${h}px`);
  if (r.over > 0) fail(`wide face, ${w}px: the page scrolls sideways by ${r.over}px`);
  r.cellsOver.forEach(t => fail(`wide face, ${w}px: "${t}" is wider than its box`));
  if (w <= 430 && r.btn > h - 120) fail(`wide face, ${w}px: the hero button ends at ${r.btn}px of ${h}px`);
  await p.context().close();
}

/* ---- 11. The booking widget as it sits on this page ----
   The real widget file, run against the widget's own test data, inside this
   page and inside the hostile Tilda stand-in. */
console.log('\n=== 11. THE BOOKING WIDGET ON THIS PAGE ===');
{
  const WT = '../../agent-tix/widget/';
  const events = JSON.parse(readFileSync(WT + 'tests/calendar.json', 'utf8'));
  const night = JSON.parse(readFileSync(WT + 'tests/night.json', 'utf8'));
  const widgetJs = readFileSync(WT + 'widget.js', 'utf8');
  if (!/<div class="muaytix-ticket-selector" data-ticket-class="leo_section"><\/div>/.test(frag)) fail('the widget slot does not carry data-ticket-class="leo_section"');
  const lum = c => { const v = c.map(x => x / 255).map(x => x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)); return .2126 * v[0] + .7152 * v[1] + .0722 * v[2]; };
  for (const [w, h] of [[1180, 900], [390, 844], [320, 640]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const p = await ctx.newPage();
    await p.route('**/functions/v1/**', r => { const bd = JSON.parse(r.request().postData() || '{}');
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(bd.action === 'events' ? events : night) }); });
    await pictures(p);
    await p.setContent(doc.replace('#allrecords button{', '#allrecords button{').replace('</style>', '#allrecords button{color:#000;font-family:serif}</style>'), { waitUntil: 'load' });
    await p.addScriptTag({ content: widgetJs });
    await p.waitForSelector('#mtx-booking [data-grid] [data-date]', { timeout: 8000 });
    await p.click('#mtx-booking [data-grid] [data-date]');
    await p.waitForSelector('#mtx-booking .mtx-detail', { timeout: 8000 });
    await p.waitForTimeout(400);
    const before = await p.evaluate(() => {
      const go = document.querySelector('#mtx-booking [data-go]'); const r = go.getBoundingClientRect(); const cs = getComputedStyle(go);
      const det = document.querySelector('#mtx-booking .mtx-detail'); const af = getComputedStyle(det, '::after');
      const q = getComputedStyle(document.querySelector('#mtx-booking [data-qty]'));
      return { tiles: document.querySelectorAll('#mtx-booking .mtx-pick').length, heading: det.querySelector('.mtx-detail-h').textContent,
        change: !!det.querySelector('[data-back-class]'), disabled: go.disabled, bg: cs.backgroundColor, h: Math.round(r.height), w: Math.round(r.width),
        qty: document.querySelector('#mtx-booking [data-qty]').value, frame: getComputedStyle(det).borderTopColor, panelW: Math.round(det.getBoundingClientRect().width), thumb: af.backgroundImage, thumbW: parseFloat(af.width), qBorder: q.borderTopColor,
        over: document.documentElement.scrollWidth - innerWidth };
    });
    await p.waitForTimeout(250);
    const after = await p.evaluate(() => { const go = document.querySelector('#mtx-booking [data-go]'); const cs = getComputedStyle(go);
      return { disabled: go.disabled, bg: cs.backgroundColor, fg: cs.color, label: go.textContent.trim(), h: Math.round(go.getBoundingClientRect().height), arrow: getComputedStyle(go, '::after').content }; });
    const rgb = s => s.match(/\d+/g).slice(0, 3).map(Number);
    const ratio = (a, b) => (Math.max(lum(a), lum(b)) + .05) / (Math.min(lum(a), lum(b)) + .05);
    console.log(`   ${String(w).padStart(5)}px  LEO tiles offered ${before.tiles}; opened: ${before.heading}; thumbnail ${before.thumbW}px; button ${before.h}px tall, ${before.w} of ${before.panelW}px wide; ready: "${after.label}" ${after.h}px, contrast ${ratio(rgb(after.fg), rgb(after.bg)).toFixed(1)}:1; overflow ${before.over}`);
    if (before.tiles !== 0) fail(`${w}px: ${before.tiles} seat class tiles are offered, there should be none`);
    if (before.heading !== 'LEO Section') fail(`${w}px: the panel that opens is "${before.heading}", not LEO Section`);
    if (before.change) fail(`${w}px: a Change seat class button is offered with only one class`);
    if (!/1000033984\.webp/.test(before.thumb) || before.thumbW < 80) fail(`${w}px: the LEO graphic thumbnail is not showing (${before.thumb}, ${before.thumbW}px)`);
    if (before.qty !== '2') fail(`${w}px: tickets open on "${before.qty}", not 2`);
    if (before.disabled) fail(`${w}px: the booking button is grey when the panel opens`);
    if (before.frame !== 'rgb(0, 165, 80)') fail(`${w}px: the panel is not framed in the available green (${before.frame})`);
    if (before.h < 56) fail(`${w}px: the booking button is only ${before.h}px tall`);
    if (before.w < before.panelW * 0.8) fail(`${w}px: the booking button is ${before.w}px in a ${before.panelW}px panel`);
    if (after.disabled || after.bg !== 'rgb(31, 91, 255)' || after.fg !== 'rgb(255, 255, 255)') fail(`${w}px: the ready button is not the page blue with white type (${after.bg} / ${after.fg})`);
    if (after.label !== 'Book LEO Tickets') fail(`${w}px: the ready button says "${after.label}", not Book LEO Tickets`);
    if (after.h < 56) fail(`${w}px: the ready button is ${after.h}px tall`);
    if (!/2192/.test(JSON.stringify(after.arrow)) && after.arrow !== '"\u2192"') fail(`${w}px: the ready button has no arrow (${after.arrow})`);
    if (ratio(rgb(after.fg), rgb(after.bg)) < 4.5) fail(`${w}px: the ready button text is under 4.5:1`);
    if (before.over > 0) fail(`${w}px: the widget makes the page scroll sideways by ${before.over}px`);
    await ctx.close();
  }
}

await browser.close();
console.log('\n=== REPORTED, NOT BUILD FAILURES: the copy decides these ===');
for (const c of copyIssues) console.log('   ' + c);
if (!copyIssues.length) console.log('   none');
console.log(`\n   Failures: ${fails}`);
console.log(fails ? '\nNOT ACCEPTABLE: fix the failures above.' : '\nAll checks passed.');
process.exit(fails ? 1 : 0);
