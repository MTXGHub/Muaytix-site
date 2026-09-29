/* Acceptance test for the Rajadamnern Stadium Seats TRIAL.
 *
 *   node verify.mjs
 *
 * Section 0 of the spec is explicit and is reproduced here rather than
 * paraphrased: "extract every text node from the HTML (excluding the widget
 * embed and the nav and footer, which are site-wide), strip whitespace, and
 * confirm each one appears in section 4 of this file. Print the list of any
 * string that does not match. The task is not complete until that list is
 * empty."
 *
 * This does exactly that, against document-a.txt (the verbatim transcript
 * of section 4), plus the ordinary render checks CLAUDE.md section 10 asks
 * for on every page: layout at six widths, contrast on every text node.
 */
import { readFileSync } from 'node:fs';
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;

const frag = readFileSync('seating-trial-live.txt', 'utf8');
const docA = readFileSync('document-a.txt', 'utf8');

const norm = s => s.replace(/\s+/g, ' ').trim();

/* The approved set: every value in document-a.txt, by key. */
const DOC = (() => {
  const out = {}; let key = null, buf = [];
  for (const raw of docA.split('\n')) {
    const m = raw.match(/^\[([a-z0-9._-]+)\]\s*$/i);
    if (m) { if (key) out[key] = buf.join('\n').trim(); key = m[1]; buf = []; continue; }
    if (raw.startsWith('#')) continue;
    if (key) buf.push(raw);
  }
  if (key) out[key] = buf.join('\n').trim();
  return out;
})();
const approved = new Set(Object.values(DOC).map(norm));

/* The hostile Tilda host, same as every other page in this repository:
   #allrecords * { text-align:center } and #allrecords a { color:inherit }
   both match directly and would beat this page's own rules if it did not
   defend against them. */
const TILDA_HOST = `
  #allrecords * { text-align: center; }
  #allrecords a { text-decoration: none; color: inherit; }
  #allrecords img { max-width: 100%; }
`;
const doc = `<!doctype html><html lang="en-GB"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:0}${TILDA_HOST}</style></head>
<body><div id="allrecords">${frag}</div></body></html>`;

const STAND = (w, h) => ({ status: 200, contentType: 'image/svg+xml',
  body: `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="#6f6f78"/></svg>` });

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
let failed = 0;
const fail = msg => { console.log('   FAIL  ' + msg); failed++; };

/* ---- 1. Layout at six widths ---- */
console.log('\n=== 1. LAYOUT ===');
for (const w of [1440, 1280, 1024, 860, 620, 390]) {
  const p = await browser.newPage({ viewport: { width: w, height: 900 } });
  await p.route('**static.tildacdn.com/**', r => r.fulfill(STAND(1200, 900)));
  await p.setContent(doc, { waitUntil: 'load' });
  await p.evaluate(async () => {
    document.querySelectorAll('img[loading="lazy"]').forEach(i => i.loading = 'eager');
    await Promise.all([...document.images].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })));
  });
  const r = await p.evaluate(() => ({
    over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    height: document.body.scrollHeight,
  }));
  if (r.over > 0) fail(`${w}px: ${r.over}px of horizontal overflow`);
  console.log(`   ${String(w).padStart(4)}px  overflow ${r.over}px  height ${r.height}px`);
  await p.close();
}

/* ---- 2. Every text node traces to document-a.txt ---- */
console.log('\n=== 2. TEXT-NODE AUDIT (spec section 0) ===');
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.route('**static.tildacdn.com/**', r => r.fulfill(STAND(1200, 900)));
await page.setContent(doc, { waitUntil: 'load' });

const onPage = await page.evaluate(() => {
  const root = document.querySelector('.mtx-rss');
  const out = [];
  const skip = el => el.closest('.muaytix-ticket-selector') || el.tagName === 'SCRIPT' || el.tagName === 'STYLE';
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  let node = walker.currentNode;
  do {
    if (skip(node)) continue;
    const hasElementChild = [...node.children].some(c => !skip(c));
    if (hasElementChild) continue;
    const text = node.textContent.replace(/\s+/g, ' ').trim();
    if (text) out.push(text);
  } while ((node = walker.nextNode()));
  return out;
});

const mismatches = onPage.filter(s => !approved.has(s));
console.log(`   ${onPage.length} text nodes checked (widget embed, nav and footer excluded)`);
console.log(`   Strings not found in document-a.txt: ${mismatches.length}`);
mismatches.forEach(s => fail(`unmatched text on page: "${s.slice(0, 90)}"`));

/* ---- 3. Contrast on every text node ---- */
console.log('\n=== 3. CONTRAST ===');
const con = await page.evaluate(() => {
  function lum(rgb) {
    const m = rgb.match(/[\d.]+/g); if (!m) return null;
    const c = m.slice(0, 3).map(Number).map(v => v / 255)
      .map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function bgOf(el) {
    let n = el;
    while (n) {
      const cs = getComputedStyle(n);
      const m = cs.backgroundColor.match(/[\d.]+/g);
      if (m && (m.length < 4 || +m[3] > 0)) return cs.backgroundColor;
      n = n.parentElement;
    }
    return 'rgb(255,255,255)';
  }
  const root = document.querySelector('.mtx-rss');
  const out = [];
  root.querySelectorAll('*').forEach(el => {
    if (![...el.children].every(c => !c.textContent.trim())) return;
    const text = el.textContent.trim();
    if (!text) return;
    const cs = getComputedStyle(el);
    const fg = lum(cs.color), bg = lum(bgOf(el));
    if (fg === null || bg === null) return;
    const ratio = (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
    const px = parseFloat(cs.fontSize);
    const bold = parseInt(cs.fontWeight, 10) >= 700;
    const large = px >= 24 || (px >= 18.66 && bold);
    const need = large ? 3.0 : 4.5;
    if (ratio < need) out.push({ t: text.slice(0, 44), ratio: ratio.toFixed(2), need, px: Math.round(px) });
  });
  return out;
});
con.forEach(c => fail(`contrast ${c.ratio} (needs ${c.need}) at ${c.px}px: "${c.t}"`));
console.log(`   ${con.length} failing`);

await browser.close();
console.log(`\n${failed === 0 ? 'ALL CHECKS PASSED' : 'NOT ACCEPTABLE: ' + failed + ' failure(s)'}`);
console.log('\nMismatch list (per spec section 0, printed even if empty):');
console.log(mismatches.length ? mismatches.map(s => '  - ' + s).join('\n') : '  (empty)');
process.exit(failed === 0 ? 0 : 1);
