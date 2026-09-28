/* Renders the block inside the same hostile stand-in for Tilda that
 * verify.mjs uses, with grey stand-ins for the owner's photographs, which
 * cannot load here. Layout and cropping in these shots are real. The
 * photographs are not. */
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
import { readFileSync } from 'node:fs';
const block = readFileSync('seating-live.txt', 'utf8');
const TILDA = `#allrecords{font-family:Arial,Helvetica,sans-serif}#allrecords *{text-align:center}
#allrecords a{text-decoration:none;color:inherit}#allrecords img{max-width:100%}
#allrecords p,#allrecords h1,#allrecords h2,#allrecords h3{margin:0 0 15px}
#allrecords ul,#allrecords ol{list-style:none;padding:0}`;
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}${TILDA}</style></head><body><div id="allrecords">${block}</div></body></html>`;
const stand = l => `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="#6f6f78"/><g fill="#cfcfd6" font-family="sans-serif" font-size="34" text-anchor="middle"><text x="600" y="395">${l}</text><text x="600" y="442" font-size="22" fill="#a8a8b2">your photograph, blocked from loading here</text></g></svg>`;
const W = Number(process.argv[2] || 1280);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await b.newContext({ viewport: { width: W, height: 1000 } });
await ctx.route('**static.tildacdn.com/**', r => {
  const u = r.request().url();
  const l = /1000034569/.test(u) ? 'Hero' : /1000033703/.test(u) ? 'Ringside view'
    : /1000033693/.test(u) ? 'Club Class view' : /1000008294/.test(u) ? 'LEO Section view'
    : /1000012609/.test(u) ? 'Third Class view' : /1000033717/.test(u) ? 'Seat map' : 'Photograph';
  r.fulfill({ status: 200, contentType: 'image/svg+xml', body: stand(l) });
});
const p = await ctx.newPage();
await p.setContent(html, { waitUntil: 'load' });
await p.evaluate(async () => { document.querySelectorAll('img[loading="lazy"]').forEach(i => i.loading = 'eager');
  window.scrollTo(0, document.body.scrollHeight); window.scrollTo(0, 0);
  await Promise.all([...document.images].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; }))); });
const targets = [['hero', '.mtx-ss__hero'], ...['1','2','3','4','5','6','7','8','9'].map((n, i) => [`s${i+1}`, `.mtx-ss__band:nth-of-type(${i+1})`])];
for (const [name, sel] of targets) {
  const el = await p.$(sel); if (!el) continue;
  const box = await el.boundingBox();
  await el.screenshot({ path: `ss-${W}-${name}.jpg`, type: 'jpeg', quality: 58 });
  console.log(`${name.padEnd(5)} ${Math.round(box.height)}px`);
}
await b.close();
