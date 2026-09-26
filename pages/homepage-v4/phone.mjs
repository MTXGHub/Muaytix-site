import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
import { readFileSync } from 'node:fs';
const frag = readFileSync('homepage-live.txt','utf8');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: 390, height: 900 } });
await p.setContent(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0">${frag}</body></html>`);
const h = await p.evaluate(() => document.documentElement.scrollHeight);
const slice = 2600;
for (let i = 0, y = 0; y < h; i++, y += slice) {
  await p.setViewportSize({ width: 390, height: Math.min(slice, h - y) });
  await p.evaluate(top => window.scrollTo(0, top), y);
  await p.screenshot({ path: `phone-${i + 1}.jpg`, type: 'jpeg', quality: 58 });
}
console.log('phone height', h, '->', Math.ceil(h / slice), 'slices');
await b.close();
