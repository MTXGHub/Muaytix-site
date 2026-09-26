/* Document B sections 28 to 33. Runs against rendered pages, never sources. */
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
import { readFileSync } from 'node:fs';

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

const CL037 = ['buakaw next fight 2026','all star fight rajadamnern','buakaw banchamek next fight 2026',
  'buakaw fight 2026','buakaw next fight','all star fight','all star fight buakaw'];
const DATED_EXTRA = ['rajadamnern muay thai 28 september 2026','muay thai bangkok 28 september 2026',
  'all star fight elite fighter 28 september 2026','rajadamnern knockout x all star fight by buakaw'];
const FOREIGN = ['apakah buakaw sudah pensiun','buakaw apakah sudah pensiun','buakaw sekarang'];
const CONDITIONAL = 'regian eersel next fight';

/* Document B section 32: the specific claims to hunt for. */
const FORBIDDEN = [
  [/buakaw (is )?(fight(s|ing)?|compet(e|ing)|headlin)/i, 'implies Buakaw is fighting'],
  [/\bchampionship\b/i, 'championship claim'],
  [/guaranteed knockout|every fight is explosive|non-stop action|knockout card/i, 'guaranteed action claim'],
  [/hear the (corner|trainer)|feel every strike|feel the impact|see the sweat/i, 'sensory seat claim'],
  [/seat number is printed|printed on your ticket/i, 'ticket-printing claim'],
  [/instant ticket|tickets instantly/i, 'instant fulfilment claim'],
  [/selling fast|almost sold out|last chance|limited seats|book now before|secure your place/i, 'scarcity'],
  [/arrive \d+ (to \d+ )?minutes early/i, 'unapproved arrival recommendation'],
  [/\bevent ends\b|finishes at \d/i, 'event end time'],
  [/where thai regulars|the loudest section|best seats in the house|unrestricted (view|sightline)/i, 'seat embellishment'],
  [/\bofficial\b/i, 'the word "official" (Document B section 3 forbids it on these pages)'],
  [/every last monday|always the last monday|guaranteed monthly/i, 'absolute monthly schedule claim'],
];

const ALLOWED = ['/all-star-fight-by-buakaw','/all-star-fight-by-buakaw/2026-09-28','/rajadamnern-stadium-seating',
  '/rajadamnern-stadium-tickets','/rajadamnern-stadium','/rajadamnern-knockout','#book',
  'https://www.google.com/maps/search/?api=1&query=Rajadamnern+Stadium'];

const norm = s => s.replace(/\s+/g,' ').replace(/ /g,' ').trim();
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
let fails = 0, omitted = 0;
const fail = m => { fails++; console.log('   FAIL  ' + m); };
/* Document A: Third Class on the dated page is shown only if released for the
   event. It is not released for 28 September, so its blocks are intentionally
   absent. That is compliance, not a mismatch, and it is never passed silently. */
const INTENTIONALLY_OMITTED = new Set(
  Object.entries(data.dated_seat_classes).filter(([k, v]) => k !== '_note' && v === 'closed')
    .flatMap(([k]) => [`dated.seats.name.${k}`, `dated.seats.descriptor.${k}`, `dated.seats.copy.${k}`]));
const omit = m => { omitted++; console.log('   OMITTED  ' + m); };

for (const P of [{ key: 'hub', prefix: 'hub', faqs: 7, kw: CL037 },
                 { key: 'dated', prefix: 'dated', faqs: 6, kw: [...CL037, ...DATED_EXTRA] }]) {
  console.log(`\n${'='.repeat(58)}\nPAGE: ${P.key}\n${'='.repeat(58)}`);
  const frag = readFileSync(`${P.key}-live.txt`, 'utf8');
  const doc = `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0">${frag}</body></html>`;

  console.log('\n-- layout --');
  for (const w of [1440, 1280, 1024, 860, 620, 390]) {
    const p = await browser.newPage({ viewport: { width: w, height: 1000 } });
    await p.setContent(doc, { waitUntil: 'load' });
    const r = await p.evaluate(() => ({
      over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      h: document.documentElement.scrollHeight,
      small: [...document.querySelectorAll('.mtx-as a.mtx-as__btn')].filter(a => a.offsetParent !== null)
        .map(a => a.getBoundingClientRect()).filter(r => r.height > 0 && r.height < 44).length,
    }));
    console.log(`   ${String(w).padStart(5)}px  overflow ${r.over}px  height ${r.h}px  small taps ${r.small}`);
    if (r.over > 0) fail(`${P.key} ${w}px scrolls sideways by ${r.over}px`);
    if (r.small) fail(`${P.key} ${w}px has ${r.small} button(s) under 44px`);
    await p.close();
  }

  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.setContent(doc, { waitUntil: 'load' });
  const visible = norm(await page.evaluate(() => document.querySelector('.mtx-as').textContent));
  const low = visible.toLowerCase();

  console.log('\n-- copy diff --');
  const keys = Object.keys(DOC).filter(k => k.startsWith(P.prefix + '.') && !k.includes('.meta.'));
  const miss = keys.filter(k => !visible.includes(norm(DOC[k])));
  console.log(`   ${keys.length - miss.length} of ${keys.length} locked blocks verbatim`);
  miss.forEach(k => INTENTIONALLY_OMITTED.has(k)
    ? omit(`[${k}] intentionally absent: that class is not released for this event`)
    : fail(`[${k}] not rendered verbatim`));

  console.log('\n-- authored-text audit --');
  const nodes = await page.evaluate(() =>
    [...document.querySelectorAll('.mtx-as h1,.mtx-as h2,.mtx-as h3,.mtx-as p,.mtx-as summary,.mtx-as dt,.mtx-as dd,.mtx-as a')]
      .filter(e => ![...e.children].some(c => c.textContent.trim()))
      .map(e => e.textContent.replace(/\s+/g,' ').trim()).filter(Boolean));
  const approved = Object.values(DOC).map(norm);
  const bAnchors = Object.values(data.document_b_anchors).filter(v => typeof v === 'string');
  const dataShaped = s => data.dates.some(d => d.label === s) || /^(18:00|19:00|Doors 18:00 · Event starts 19:00)$/.test(s);
  const extra = nodes.filter(s => !approved.some(a => a === s || a.includes(s)) && !bAnchors.includes(s) && !dataShaped(s));
  console.log(`   ${nodes.length} text nodes; ${extra.length} not from Document A, Document B anchors or verified data`);
  extra.forEach(s => fail(`unapproved text: "${s.slice(0,90)}"`));

  console.log('\n-- keywords --');
  const kmiss = P.kw.filter(k => !low.includes(k));
  console.log(`   ${P.kw.length - kmiss.length} / ${P.kw.length} present`);
  kmiss.forEach(k => fail(`keyword missing: "${k}"`));
  const leaked = FOREIGN.filter(k => low.includes(k));
  leaked.forEach(k => fail(`excluded foreign-language query present: "${k}"`));
  console.log(`   foreign-language exclusions honoured: ${FOREIGN.length - leaked.length} / ${FOREIGN.length}`);
  console.log(`   "${CONDITIONAL}": ${low.includes(CONDITIONAL) ? 'PRESENT (must be justified)' : 'absent, as intended'}`);

  console.log('\n-- factual audit --');
  let hits = 0;
  for (const [re, why] of FORBIDDEN) {
    const m = visible.match(re);
    /* "Is Buakaw fighting" and "Buakaw is the promoter, not one of the fighters"
       are Document A's own wording, so a raw regex hit is only a failure when
       the sentence is not in Document A. */
    if (m && !approved.some(a => a.includes(m[0]))) { hits++; fail(`${why}: "${m[0]}"`); }
  }
  console.log(`   ${FORBIDDEN.length} claim patterns checked, ${hits} unauthorised`);

  console.log('\n-- links --');
  const links = await page.evaluate(() =>
    [...document.querySelectorAll('.mtx-as a')].map(a => ({ href: a.getAttribute('href'), text: a.textContent.trim() })));
  for (const l of links) {
    if (!l.text) fail(`link with no text: ${l.href}`);
    if (!ALLOWED.includes(l.href.split('#')[0] || '#book') && !ALLOWED.includes(l.href)) fail(`destination not approved: ${l.href}`);
    const d = l.href.match(/(\d{4}-\d{2}-\d{2})/);
    if (d && d[1] < '2026-09-26') fail(`expired dated URL: ${l.href}`);
  }
  console.log(`   ${links.length} links, ${new Set(links.map(l => l.href)).size} distinct, 0 invented`);

  console.log('\n-- images --');
  const imgs = await page.evaluate(() =>
    [...document.querySelectorAll('.mtx-as img')].map(i => ({ src: i.getAttribute('src'), alt: i.getAttribute('alt'),
      card: i.closest('li')?.querySelector('h3')?.textContent.trim() })));
  for (const i of imgs) {
    const id = (i.src.match(/(\d{10})\.webp/) || [])[1];
    const expect = Object.entries(data.seat_images).find(([, v]) => v.url.includes(id));
    const cls = expect && DOC[`${P.prefix}.seats.name.${expect[0]}`];
    console.log(`   ${String(i.card).padEnd(13)} ${id}  ${cls === i.card ? 'MATCH' : 'MISMATCH'}`);
    if (cls !== i.card) fail(`seat image ${id} is on the "${i.card}" card but belongs to "${cls}"`);
    if (!i.alt) fail(`image ${id} has no alt text`);
  }

  console.log('\n-- headings --');
  const hs = await page.evaluate(() => [...document.querySelectorAll('.mtx-as h1,.mtx-as h2,.mtx-as h3')].map(h => h.tagName));
  const h1 = hs.filter(h => h === 'H1').length;
  console.log(`   H1 ${h1}, H2 ${hs.filter(h=>h==='H2').length}, H3 ${hs.filter(h=>h==='H3').length}`);
  if (h1 !== 1) fail(`${P.key}: ${h1} H1 elements`);

  console.log('\n-- contrast --');
  const con = await page.evaluate(() => {
    const lum = c => { const [r,g,b] = c.match(/[\d.]+/g).map(Number).map(v => { v/=255; return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4); }); return 0.2126*r+0.7152*g+0.0722*b; };
    const bg = el => { let e = el, L = [];
      while (e) { const c = getComputedStyle(e).backgroundColor, m = c && c.match(/[\d.]+/g);
        if (m) { const a = m.length>3?+m[3]:1; if (a>0) L.push([+m[0],+m[1],+m[2],a]); if (a>=1) break; } e = e.parentElement; }
      let o = [255,255,255];
      for (let i=L.length-1;i>=0;i--) { const [r,g,b,a]=L[i]; o=[r*a+o[0]*(1-a),g*a+o[1]*(1-a),b*a+o[2]*(1-a)]; }
      return `rgb(${o[0]}, ${o[1]}, ${o[2]})`; };
    return [...document.querySelectorAll('.mtx-as h1,.mtx-as h2,.mtx-as h3,.mtx-as p,.mtx-as a,.mtx-as dt,.mtx-as dd,.mtx-as summary')]
      .filter(e => e.textContent.trim() && ![...e.children].some(c => c.textContent.trim() === e.textContent.trim()))
      .map(e => { const s = getComputedStyle(e), px = parseFloat(s.fontSize), a = lum(s.color), b = lum(bg(e));
        return { t: e.textContent.trim().slice(0,40), px, ratio: Math.round(((Math.max(a,b)+0.05)/(Math.min(a,b)+0.05))*100)/100,
                 need: (px>=24||(px>=18.66&&+s.fontWeight>=700))?3:4.5 }; });
  });
  const bad = con.filter(c => c.ratio < c.need);
  console.log(`   ${con.length} text nodes, ${bad.length} failing`);
  bad.forEach(c => fail(`contrast ${c.ratio} (needs ${c.need}) at ${c.px}px: "${c.t}"`));

  await page.screenshot({ path: `${P.key}-page.jpg`, type: 'jpeg', quality: 58, fullPage: true });
  await page.close();
}
await browser.close();
const rep = readFileSync('reports.txt', 'utf8').trim();
if (rep) console.log('\n=== REPORTED, NOT FILLED IN ===\n' + rep.split('\n').map(x => '   ' + x).join('\n'));
console.log('');
console.log(`   Implementation failures: ${fails}`);
console.log(`   Intentionally omitted under Document A: ${omitted}`);
console.log(fails ? '\nNOT ACCEPTABLE: fix the failures above.\n' : '\nAll acceptance checks passed.\n');
process.exit(fails ? 1 : 0);
