import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
import { readFileSync } from 'node:fs';
const block = readFileSync('homepage-live.txt', 'utf8');
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0">${block}</body></html>`;
const stand = (l) => `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="#6f6f78"/><g fill="#c9c9d2" font-family="sans-serif" font-size="34" text-anchor="middle"><text x="600" y="390">${l}</text><text x="600" y="440" font-size="24" fill="#a6a6b0">(photograph, not loadable here)</text></g></svg>`;
const W = Number(process.argv[2] || 1280);
const WHEN = Date.parse(process.env.MTX_WHEN || '2026-09-28T07:00:00Z');
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await browser.newContext({ viewport: { width: W, height: 1000 }, timezoneId: 'Asia/Bangkok' });
await ctx.addInitScript(`(() => { const F=${WHEN}, _D=Date;
  function D(...a){ if(!(this instanceof D)) return new _D(F).toString(); return a.length===0?new _D(F):new _D(...a); }
  D.prototype=_D.prototype; D.now=()=>F; D.parse=_D.parse; D.UTC=_D.UTC; window.Date=D; })()`);
await ctx.route('**static.tildacdn.com/**', r => {
  const u = r.request().url();
  const l = /10000075/.test(u) ? 'Hero photograph' : /1000033717/.test(u) ? 'Stadium seating map'
    : /1000033985/.test(u) ? 'Ringside graphic' : /1000033982/.test(u) ? 'Club Class graphic'
    : /1000033984/.test(u) ? 'LEO Section graphic' : /1000033983/.test(u) ? 'Third Class graphic'
    : /1000033703/.test(u) ? 'View of the ring' : 'Photograph';
  r.fulfill({ status: 200, contentType: 'image/svg+xml', body: stand(l) });
});
const p = await ctx.newPage();
await p.setContent(html, { waitUntil: 'load' });
await p.evaluate(async () => {
  document.querySelectorAll('img[loading="lazy"]').forEach(i => i.loading = 'eager');
  window.scrollTo(0, document.body.scrollHeight); window.scrollTo(0, 0);
  await Promise.all([...document.images].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })));
});
const targets = [['hero', '.mtx-hp__hero'], ...['1','2','3','4','5','6','7','8'].map((n,i) => [`s${i+1}`, `.mtx-hp__band:nth-of-type(${i+1})`])];
for (const [name, sel] of targets) {
  const el = await p.$(sel);
  if (!el) { console.log(name, 'MISSING', sel); continue; }
  const box = await el.boundingBox();
  await el.screenshot({ path: `sec-${W}-${name}.jpg`, type: 'jpeg', quality: 60 });
  console.log(`${name.padEnd(5)} ${sel.padEnd(40)} ${Math.round(box.height)}px tall`);
}
await browser.close();
