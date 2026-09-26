/* Acceptance tests for /rajadamnern-stadium-tickets, against the rendered page. */
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
import { readFileSync } from 'node:fs';

const DOC = (() => { const o={}; let k=null,b=[];
  for (const r of readFileSync('document-a.txt','utf8').split('\n')) {
    const m=r.match(/^\[([a-z0-9._-]+)\]\s*$/i);
    if(m){ if(k)o[k]=b.join('\n').trim(); k=m[1]; b=[]; continue; }
    if(r.startsWith('#'))continue; if(k)b.push(r);
  } if(k)o[k]=b.join('\n').trim(); return o; })();
const data = JSON.parse(readFileSync('dynamic-data.json','utf8'));
const frag = readFileSync('live.txt','utf8');
let bad = 0;
const fail = m => { bad++; console.log('   FAIL  ' + m); };

/* Brief section 4: the standing copy rules, as regexes. */
const BANNED = [
  [/choose your seats|select your seats|pick your seats/i, 'seat-selection language'],
  [/instant (ticket|e-ticket) delivery/i, 'an instant-delivery claim'],
  [/\btourists?\b/i, '"tourists"'],
  [/\bgenuine\b/i, '"genuine"'],
  [/\bauthentic\b/i, '"authentic"'],
  [/world-class/i, '"world-class"'],
  [/\bseamless\b/i, '"seamless"'],
  [/\becosystem\b/i, '"ecosystem"'],
  [/\bcustomers?\b/i, '"customers", which should be "guests"'],
  [/free[- ]flow|free beer/i, 'free-flow beer'],
  [/third class[^.]{0,40}\b(budget|standing|first come)/i, 'Third Class called budget, standing or first come first served'],
  [/leo[^.]{0,30}second level/i, 'LEO called second level'],
  [/—|–/, 'an em dash or en dash'],
  [/!/, 'an exclamation mark'],
  [/muay thai tickets bangkok/i, "the homepage's keyword cluster"],
  [/Radjadamnern|Ratchadamnoen Stadium/i, 'a misspelling of the venue name'],
  [/[฀-๿]/, 'Thai script'],
];

const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport:{width:1440,height:1000} });
await p.route('**/static.tildacdn.com/**', r=>r.fulfill({status:200,contentType:'image/svg+xml',
  body:'<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900"><rect width="1200" height="900" fill="#e8e8ea"/></svg>'}));
await p.setContent(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0">${frag}</body></html>`,{waitUntil:'load'});
await p.evaluate(()=>document.querySelectorAll('.mtx-rt details').forEach(d=>d.open=true));
await p.waitForTimeout(250);

console.log('\n-- copy is Document A, word for word --');
const visible = (await p.$eval('.mtx-rt', n => {
  const c = n.cloneNode(true);
  c.querySelectorAll('style,script').forEach(e => e.remove());
  return c.textContent;          // not innerText: CSS uppercases the headings
})).replace(/\s+/g,' ');
const alts = await p.$$eval('.mtx-rt img', n => n.map(i => i.getAttribute('alt') || ''));
let verbatim = 0, missing = [];
for (const [k,v] of Object.entries(DOC)) {
  if (k.startsWith('meta.')) continue;
  const want = v.replace(/\s+/g,' ');
  if (visible.includes(want) || alts.some(a => a.replace(/\s+/g,' ') === want)) verbatim++;
  else missing.push(k);
}
console.log(`   ${verbatim} of ${verbatim+missing.length} locked blocks verbatim`);
missing.forEach(k => fail(`[${k}] is not on the page word for word`));

console.log('\n-- nothing on the page that is not in Document A or verified data --');
const approved = Object.values(DOC).map(v=>v.replace(/\s+/g,' '));
const dyn = [...data.nights.flatMap(n=>[n.day,n.event,n.doors,n.first,n.finish]), '1','2','3','4'];
const nodes = await p.evaluate(() => [...document.querySelectorAll('.mtx-rt *')]
  .filter(e => !['STYLE','SCRIPT'].includes(e.tagName))
  .filter(e => e.textContent.trim() && ![...e.children].some(c => c.textContent.trim()))
  .map(e => e.textContent.trim()));
let stray = 0;
for (const n of nodes) {
  const s = n.replace(/\s+/g,' ');
  if (approved.some(a => a.includes(s)) || dyn.includes(s)) continue;
  stray++; fail(`text on the page that is in neither: "${s.slice(0,70)}"`);
}
console.log(`   ${nodes.length} text nodes, ${stray} untraceable`);

console.log('\n-- the brief\'s banned list --');
let hits = 0;
for (const [re, why] of BANNED) { const m = visible.match(re); if (m) { hits++; fail(`${why}: "${m[0]}"`); } }
console.log(`   ${BANNED.length} rules checked, ${hits} broken`);

console.log('\n-- metadata character counts --');
for (const [k, max] of [['meta.title', 65], ['meta.description', 93]]) {
  const n = DOC[k].length;
  console.log(`   ${k.padEnd(17)} ${n} characters (brief says ${max})`);
  if (n !== max) fail(`${k} is ${n} characters, the brief says ${max}`);
}

console.log('\n-- keywords the page must own --');
for (const kw of ['rajadamnern stadium tickets','rajadamnern stadium ticket prices',
                  'rajadamnern stadium','what time does muay thai start at rajadamnern stadium']) {
  const inBody = visible.toLowerCase().includes(kw) ||
                 (DOC['faq.q4']+DOC['meta.title']+DOC['prices.h2']).toLowerCase().includes(kw);
  console.log(`   ${inBody ? 'present ' : 'MISSING '} ${kw}`);
  if (!inBody) fail(`keyword absent: ${kw}`);
}

console.log('\n-- tables are real tables, not pictures --');
const tables = await p.$$eval('.mtx-rt table', ts => ts.map(t => ({
  head: t.querySelectorAll('thead th').length, rows: t.querySelectorAll('tbody tr').length })));
console.log(`   ${tables.length} tables: ${tables.map(t=>`${t.rows} rows x ${t.head} columns`).join(', ')}`);
if (tables.length !== 2) fail(`expected 2 tables, found ${tables.length}`);
if (tables[0] && tables[0].rows !== 4) fail(`price table has ${tables[0].rows} rows, expected 4`);
if (tables[1] && tables[1].rows !== 7) fail(`schedule table has ${tables[1].rows} rows, expected 7`);

console.log('\n-- links --');
const links = await p.$$eval('.mtx-rt a[href]', as => as.map(a => a.getAttribute('href')));
const allowed = new Set([...Object.values(data.destinations), ...data.nights.map(n=>n.href),
  ...data.nights.filter(n=>n.extra_href).map(n=>n.extra_href), '#booking', '#prices']);
const badLinks = [...new Set(links)].filter(h => !allowed.has(h));
console.log(`   ${links.length} links, ${new Set(links).size} distinct`);
badLinks.forEach(h => fail(`link not in the brief: ${h}`));
if (links.some(h => h === '/' || h === 'https://muaytix.com/')) fail('body copy links to the homepage, which the brief forbids');

console.log('\n-- schema --');
const ld = await p.$$eval('script[type="application/ld+json"]', n => n.map(x => x.textContent));
if (ld.length !== 1) fail(`expected 1 schema block, found ${ld.length}`);
const j = JSON.parse(ld[0]);
console.log(`   ${j['@type']} with ${j.mainEntity.length} questions`);
if (j['@type'] !== 'FAQPage') fail('schema is not FAQPage');
if (j.mainEntity.length !== 12) fail(`schema has ${j.mainEntity.length} questions, the brief says 12`);
if (/"@type"\s*:\s*"Event"/.test(ld[0])) fail('Event schema is on this page and the brief forbids it');
j.mainEntity.forEach((q,i) => {
  if (q.name !== DOC['faq.q'+(i+1)]) fail(`schema question ${i+1} is not the Document A wording`);
  if (q.acceptedAnswer.text !== DOC['faq.a'+(i+1)]) fail(`schema answer ${i+1} is not the Document A wording`);
});

console.log('\n-- contrast --');
const con = await p.evaluate(() => {
  const lum = c => { const [r,g,bl] = c.match(/[\d.]+/g).map(Number).map(v => { v/=255; return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4); }); return 0.2126*r+0.7152*g+0.0722*bl; };
  const bg = el => { let e=el, L=[];
    while (e) { const c=getComputedStyle(e).backgroundColor, m=c&&c.match(/[\d.]+/g);
      if (m) { const a=m.length>3?+m[3]:1; if(a>0)L.push([+m[0],+m[1],+m[2],a]); if(a>=1)break; } e=e.parentElement; }
    let o=[255,255,255];
    for (let i=L.length-1;i>=0;i--){const [r,g,bl,a]=L[i]; o=[r*a+o[0]*(1-a),g*a+o[1]*(1-a),bl*a+o[2]*(1-a)];}
    return `rgb(${o[0]}, ${o[1]}, ${o[2]})`; };
  return [...document.querySelectorAll('.mtx-rt h1,.mtx-rt h2,.mtx-rt h3,.mtx-rt p,.mtx-rt a,.mtx-rt li,.mtx-rt th,.mtx-rt td,.mtx-rt summary')]
    .filter(e => e.textContent.trim() && ![...e.children].some(c => c.textContent.trim() === e.textContent.trim()))
    .map(e => { const s = getComputedStyle(e);
      const L1 = lum(s.color), L2 = lum(bg(e));
      const ratio = (Math.max(L1,L2)+0.05)/(Math.min(L1,L2)+0.05);
      const px = parseFloat(s.fontSize), bold = parseInt(s.fontWeight,10) >= 700;
      const need = (px >= 24 || (px >= 18.66 && bold)) ? 3.0 : 4.5;
      return { t: e.textContent.trim().slice(0,42), ratio: +ratio.toFixed(2), need, px };
    }).filter(x => x.ratio < x.need);
});
console.log(`   ${con.length} failing`);
con.forEach(c => fail(`contrast ${c.ratio}:1 needs ${c.need}:1 at ${c.px}px on "${c.t}"`));

console.log('\n-- overflow and tap targets --');
for (const w of [1440,1280,1024,860,620,390]) {
  await p.setViewportSize({ width:w, height:900 });
  await p.waitForTimeout(160);
  const r = await p.evaluate(() => ({
    over: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
    small: [...document.querySelectorAll('.mtx-rt a, .mtx-rt summary')]
      .filter(e => e.offsetParent !== null && e.getBoundingClientRect().height > 0 && e.getBoundingClientRect().height < 44).length,
    h: Math.round(document.body.scrollHeight) }));
  console.log(`   ${String(w).padStart(5)}px  overflow ${r.over}px  height ${r.h}px  small taps ${r.small}`);
  if (r.over > 0) fail(`${r.over}px of horizontal overflow at ${w}px`);
}

console.log('\n-- headings --');
const hs = await p.$$eval('.mtx-rt h1,.mtx-rt h2,.mtx-rt h3', n => n.map(x => x.tagName));
const h1 = hs.filter(h=>h==='H1').length;
console.log(`   H1 ${h1}, H2 ${hs.filter(h=>h==='H2').length}, H3 ${hs.filter(h=>h==='H3').length}`);
if (h1 !== 1) fail(`${h1} H1 elements`);

console.log('\n=== REPORTED, NOT FILLED IN ===');
console.log(readFileSync('reports.txt','utf8').trimEnd());
console.log(`\n   Failures: ${bad}`);
console.log(bad ? '\nNOT READY.' : '\nAll acceptance checks passed.');
await b.close();
process.exit(bad ? 1 : 0);
