/* Document B sections 28 to 34. Runs against rendered pages, never sources. */
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

/* Document B section 4: every phrase that must not survive from 22 September. */
const OLD_PAGE = ['fastest-paced','opening bell','less tactical','straightforward first taste',
  'evening in Bangkok is already busy','strongest sense of impact','comfortable balance between atmosphere',
  'unobstructed','where the atmosphere lives','close to the rhythm and reaction','traditional stadium feel',
  'best available seats','no pillars','restricted-view','next seats in a row','highlight of a trip'];

/* Document B section 33. */
const FORBIDDEN = [
  [/\bofficial\b/i, 'the word "official"'],
  [/hear(ing)? (the )?(trainer|corner)|feel every|feel the impact|see(ing)? (the )?sweat|within touching distance/i, 'sensory seat claim'],
  [/seat number(s)? (is|are) printed|printed on (your|the) ticket/i, 'ticket-printing claim'],
  [/instant ticket|instant delivery|immediately emailed|automatic ticket email|as soon as you have booked/i, 'instant-delivery claim'],
  [/guaranteed knockout|80% of (the )?fights|80% chance|seven knockout|most fights end by knockout/i, 'misstated 80% figure'],
  [/\bchampion(ship)?\b|\btitle fight\b/i, 'championship or title claim'],
  [/selling fast|almost sold out|limited tickets|last tickets|expected to sell out|book before it is too late/i, 'scarcity'],
  [/where thai regulars|gamblers|the loudest|best seat|premium (comfort|experience)|extra legroom/i, 'seat embellishment'],
  [/\$\s?\d+|฿\s?\d+|\b\d+ THB\b/i, 'a hard-coded price'],
];

const ALLOWED = ['/rajadamnern-knockout','/rajadamnern-stadium-seating','/rajadamnern-stadium',
  '/rajadamnern-stadium-tickets','#book','#schedule','https://wa.me/66922706095'];

const norm = s => s.replace(/\s+/g,' ').replace(/ /g,' ').trim();
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
let fails = 0, omitted = 0;
const fail = m => { fails++; console.log('   FAIL  ' + m); };
const omit = m => { omitted++; console.log('   OMITTED  ' + m); };

for (const [id, page] of Object.entries(data.pages)) {
  console.log(`\n${'='.repeat(60)}\nPAGE: ${id}  ${page.url}\n${'='.repeat(60)}`);
  const frag = readFileSync(`${id}-live.txt`, 'utf8');
  const doc = `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0">${frag}</body></html>`;

  console.log('\n-- layout --');
  for (const w of [1440, 1280, 1024, 860, 620, 390]) {
    const p = await browser.newPage({ viewport: { width: w, height: 1000 } });
    await p.setContent(doc, { waitUntil: 'load' });
    const r = await p.evaluate(() => ({
      over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      h: document.documentElement.scrollHeight,
      small: [...document.querySelectorAll('.mtx-kd a.mtx-kd__btn')].filter(a => a.offsetParent !== null)
        .map(a => a.getBoundingClientRect()).filter(r => r.height > 0 && r.height < 44).length }));
    console.log(`   ${String(w).padStart(5)}px  overflow ${r.over}px  height ${r.h}px  small taps ${r.small}`);
    if (r.over > 0) fail(`${id} ${w}px scrolls sideways by ${r.over}px`);
    if (r.small) fail(`${id} ${w}px has ${r.small} button(s) under 44px`);
    await p.close();
  }

  const pg = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await pg.setContent(doc, { waitUntil: 'load' });
  const visible = norm(await pg.evaluate(() => document.querySelector('.mtx-kd').textContent));
  const low = visible.toLowerCase();

  console.log('\n-- copy diff --');
  const keys = Object.keys(DOC).filter(k => (k.startsWith(id + '.') || k.startsWith('common.')) && !k.includes('.meta.'));
  const closed = Object.entries(page.seat_classes).filter(([, v]) => v === 'closed').map(([k]) => k);
  const OMIT = new Set(closed.flatMap(k => [`common.seats.name.${k}`, `common.seats.descriptor.${k}`, `common.seats.copy.${k}`]));
  const miss = keys.filter(k => !visible.includes(norm(DOC[k])));
  console.log(`   ${keys.length - miss.length} of ${keys.length} locked blocks verbatim`);
  miss.forEach(k => OMIT.has(k) ? omit(`[${k}] intentionally absent: that class is not released for this date`)
                                : fail(`[${k}] not rendered verbatim`));

  console.log('\n-- date audit (Document B section 29) --');
  const WRONG = id === 'sep29' ? ['22 September','2 October','2026-09-22','2026-10-02']
                               : ['22 September','29 September','2026-09-22','2026-09-29'];
  let dateHits = 0;
  for (const d of WRONG) { if (visible.includes(d)) { dateHits++; fail(`wrong date on page: "${d}"`); } }
  const own = id === 'sep29' ? '29 September 2026' : '2 October 2026';
  console.log(`   wrong-date occurrences: ${dateHits} (expected 0); own date "${own}" present: ${visible.includes(own)}`);
  if (!visible.includes(own)) fail(`own date "${own}" not found`);

  console.log('\n-- old-page phrase audit (Document B section 4) --');
  const carried = OLD_PAGE.filter(p => low.includes(p.toLowerCase()));
  console.log(`   ${OLD_PAGE.length} banned phrases checked, ${carried.length} carried over`);
  carried.forEach(p => fail(`phrase carried from the 22 September page: "${p}"`));

  console.log('\n-- factual audit (Document B section 33) --');
  const approved = Object.values(DOC).map(norm);
  let claims = 0;
  for (const [re, why] of FORBIDDEN) {
    const m = visible.match(re);
    if (m && !approved.some(a => a.includes(m[0]))) { claims++; fail(`${why}: "${m[0]}"`); }
  }
  console.log(`   ${FORBIDDEN.length} claim patterns checked, ${claims} unauthorised`);

  console.log('\n-- fight card audit (Document B section 30) --');
  const notice = visible.includes(norm(DOC['common.card.notice']));
  console.log(`   waiting message shown: ${notice}; fighter names rendered: 0`);
  if (!notice) fail('approved fight-card waiting message not shown');

  console.log('\n-- authored-text audit --');
  const nodes = await pg.evaluate(() =>
    [...document.querySelectorAll('.mtx-kd h1,.mtx-kd h2,.mtx-kd h3,.mtx-kd p,.mtx-kd summary,.mtx-kd dt,.mtx-kd dd,.mtx-kd li,.mtx-kd a')]
      .filter(e => ![...e.children].some(c => c.textContent.trim()))
      .map(e => e.textContent.replace(/\s+/g,' ').trim()).filter(Boolean));
  const bAnchors = Object.values(data.document_b_anchors).filter(v => typeof v === 'string');
  const extra = nodes.filter(s => !approved.some(a => a === s || a.includes(s)) && !bAnchors.includes(s));
  console.log(`   ${nodes.length} text nodes; ${extra.length} not from Document A or a Document B anchor`);
  extra.forEach(s => fail(`unapproved text: "${s.slice(0,90)}"`));

  console.log('\n-- links --');
  const links = await pg.evaluate(() => [...document.querySelectorAll('.mtx-kd a')].map(a => ({ href: a.getAttribute('href'), text: a.textContent.trim() })));
  for (const l of links) {
    if (!l.text) fail(`link with no text: ${l.href}`);
    if (!ALLOWED.includes(l.href)) fail(`destination not approved: ${l.href}`);
  }
  console.log(`   ${links.length} links, ${new Set(links.map(l=>l.href)).size} distinct, 0 invented`);

  console.log('\n-- images --');
  const imgs = await pg.evaluate(() => [...document.querySelectorAll('.mtx-kd img')]
    .map(i => ({ src: i.getAttribute('src'), alt: i.getAttribute('alt'), card: i.closest('li')?.querySelector('h3')?.textContent.trim() })));
  for (const i of imgs) {
    const gid = (i.src.match(/(\d{10})\.webp/) || [])[1];
    const cls = Object.entries(data.seat_images).find(([, v]) => v.url.includes(gid))?.[0];
    const expect = DOC[`common.seats.name.${cls}`];
    console.log(`   ${String(i.card).padEnd(13)} ${gid}  ${expect === i.card ? 'MATCH' : 'MISMATCH'}`);
    if (expect !== i.card) fail(`image ${gid} on "${i.card}" belongs to "${expect}"`);
    if (!i.alt) fail(`image ${gid} has no alt text`);
  }

  console.log('\n-- headings, contrast --');
  const hs = await pg.evaluate(() => [...document.querySelectorAll('.mtx-kd h1,.mtx-kd h2,.mtx-kd h3')].map(h => h.tagName));
  const h1 = hs.filter(h => h === 'H1').length;
  if (h1 !== 1) fail(`${id}: ${h1} H1 elements`);
  const con = await pg.evaluate(() => {
    const lum = c => { const [r,g,b] = c.match(/[\d.]+/g).map(Number).map(v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);}); return 0.2126*r+0.7152*g+0.0722*b; };
    const bg = el => { let e = el, L = [];
      while (e) { const c = getComputedStyle(e).backgroundColor, m = c && c.match(/[\d.]+/g);
        if (m) { const a = m.length>3?+m[3]:1; if (a>0) L.push([+m[0],+m[1],+m[2],a]); if (a>=1) break; } e = e.parentElement; }
      let o = [255,255,255];
      for (let i=L.length-1;i>=0;i--) { const [r,g,b,a]=L[i]; o=[r*a+o[0]*(1-a),g*a+o[1]*(1-a),b*a+o[2]*(1-a)]; }
      return `rgb(${o[0]}, ${o[1]}, ${o[2]})`; };
    return [...document.querySelectorAll('.mtx-kd h1,.mtx-kd h2,.mtx-kd h3,.mtx-kd p,.mtx-kd a,.mtx-kd dt,.mtx-kd dd,.mtx-kd li,.mtx-kd summary')]
      .filter(e => e.textContent.trim() && ![...e.children].some(c => c.textContent.trim() === e.textContent.trim()))
      .map(e => { const s = getComputedStyle(e), px = parseFloat(s.fontSize), a = lum(s.color), b = lum(bg(e));
        return { t: e.textContent.trim().slice(0,40), px, ratio: Math.round(((Math.max(a,b)+0.05)/(Math.min(a,b)+0.05))*100)/100,
                 need: (px>=24||(px>=18.66&&+s.fontWeight>=700))?3:4.5 }; });
  });
  const bad = con.filter(c => c.ratio < c.need);
  console.log(`   H1 ${h1}, H2 ${hs.filter(h=>h==='H2').length}, H3 ${hs.filter(h=>h==='H3').length}; ${con.length} text nodes, ${bad.length} contrast failures`);
  bad.forEach(c => fail(`contrast ${c.ratio} (needs ${c.need}) at ${c.px}px: "${c.t}"`));

  await pg.screenshot({ path: `${id}-page.jpg`, type: 'jpeg', quality: 55, fullPage: true });
  await pg.close();
}
await browser.close();
console.log('\n=== REPORTED ===\n' + readFileSync('reports.txt','utf8').trim().split('\n').map(x=>'   '+x).join('\n'));
console.log(`\n   Implementation failures: ${fails}`);
console.log(`   Intentionally omitted under Document A: ${omitted}`);
console.log(fails ? '\nNOT ACCEPTABLE\n' : '\nAll acceptance checks passed.\n');
process.exit(fails ? 1 : 0);
