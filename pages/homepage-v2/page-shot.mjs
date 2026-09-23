/* Full-page screenshots of the single block, at desktop and phone width. */
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
import fs from 'fs';
const CH = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const doc = '<!doctype html><meta charset="utf-8"><meta name=viewport content="width=device-width,initial-scale=1">'
  + `<style>${fs.readFileSync('_shared.css','utf8')}</style>`
  + fs.readFileSync('homepage-FULL-live.txt','utf8');
const br = await chromium.launch({ executablePath: CH });
for (const [name, width, scale] of [['full-desk', 1280, 1], ['full-phone', 390, 1]]) {
  const p = await br.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: scale });
  await p.setContent(doc, { waitUntil: 'load' });
  await p.screenshot({ path: `${name}.png`, fullPage: true });
  const h = await p.evaluate(() => document.documentElement.scrollHeight);
  console.log(name, width + 'px wide,', h + 'px tall');
  await p.close();
}
await br.close();
