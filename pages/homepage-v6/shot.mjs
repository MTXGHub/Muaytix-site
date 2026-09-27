/* Renders the block and photographs it.
 *
 * static.tildacdn.com is blocked by this environment's network policy, so the
 * owner's photographs cannot load here. Rather than shoot a page full of
 * empty boxes and guess at the composition, every Tilda image request is
 * intercepted and answered with a plain grey stand-in of the same shape,
 * labelled with what the real picture is. Layout, spacing and cropping in
 * these shots are real. The photographs are not.
 */
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
import { readFileSync } from 'node:fs';

const block = readFileSync('homepage-live.txt', 'utf8');
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0">${block}</body></html>`;

const stand = (label) => `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800">
  <rect width="1200" height="800" fill="#6f6f78"/>
  <g fill="#c9c9d2" font-family="sans-serif" font-size="34" text-anchor="middle">
    <text x="600" y="380">${label}</text>
    <text x="600" y="430" font-size="24" fill="#a6a6b0">(the owner's photograph, not loadable here)</text>
  </g></svg>`;

const WHEN = process.env.MTX_WHEN ? Date.parse(process.env.MTX_WHEN) : null;

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const widths = process.argv.slice(2).map(Number);
for (const w of (widths.length ? widths : [1440, 1280, 860, 620, 390])) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 1200 }, timezoneId: 'Asia/Bangkok', deviceScaleFactor: 1 });
  if (WHEN) await ctx.addInitScript(`(() => { const F=${WHEN}, _D=Date;
    function D(...a){ if(!(this instanceof D)) return new _D(F).toString(); return a.length===0?new _D(F):new _D(...a); }
    D.prototype=_D.prototype; D.now=()=>F; D.parse=_D.parse; D.UTC=_D.UTC; window.Date=D; })()`);
  await ctx.route('**static.tildacdn.com/**', route => {
    const u = route.request().url();
    const label = /10000075/.test(u) ? 'Hero photograph'
      : /1000033717/.test(u) ? 'Rajadamnern Stadium seating map'
      : /1000033985/.test(u) ? 'Ringside seat graphic'
      : /1000033982/.test(u) ? 'Club Class seat graphic'
      : /1000033984/.test(u) ? 'LEO Section seat graphic'
      : /1000033983/.test(u) ? 'Third Class seat graphic'
      : /1000033703/.test(u) ? 'View of the ring from Ringside'
      : 'Photograph';
    route.fulfill({ status: 200, contentType: 'image/svg+xml', body: stand(label) });
  });
  const p = await ctx.newPage();
  await p.setContent(html, { waitUntil: 'load' });
  await p.evaluate(async () => {
    // pull every lazy image in before shooting
    document.querySelectorAll('img[loading="lazy"]').forEach(i => i.loading = 'eager');
    window.scrollTo(0, document.body.scrollHeight); window.scrollTo(0, 0);
    await Promise.all([...document.images].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })));
  });
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const height = await p.evaluate(() => document.body.scrollHeight);
  await p.screenshot({ path: `v6-${w}.jpg`, type: 'jpeg', quality: 62, fullPage: true });
  console.log(`${w}px  overflow ${overflow}px  height ${height}px  ->  v6-${w}.jpg`);
  await ctx.close();
}
await browser.close();
