import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
import fs from 'fs';
const CH = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const fonts = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;600;700&family=Barlow+Condensed:wght@700;800&display=swap">';
const doc = '<!doctype html><meta charset="utf-8"><meta name=viewport content="width=device-width,initial-scale=1">' + fonts
  + fs.readFileSync('homepage-live.txt','utf8');
const br = await chromium.launch({ executablePath: CH });
const p = await br.newPage({ viewport: { width: 1440, height: 900 } });
await p.setContent(doc, { waitUntil: 'networkidle' });
const want = process.argv.slice(2);
for (const sel of want) {
  const el = await p.$(sel);
  if (!el) { console.log('MISSING', sel); continue; }
  const name = sel.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');
  await el.screenshot({ path: `x-${name}.png` });
  const b = await el.boundingBox();
  console.log(sel, Math.round(b.width) + 'x' + Math.round(b.height));
}
await br.close();
