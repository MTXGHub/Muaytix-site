import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
import fs from 'fs';
const CH = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const fonts = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;600;700&family=Barlow+Condensed:wght@700;800&display=swap">';
const doc = '<!doctype html><meta charset="utf-8"><meta name=viewport content="width=device-width,initial-scale=1">' + fonts
  + fs.readFileSync('homepage-live.txt','utf8');
const br = await chromium.launch({ executablePath: CH });
for (const [name, width] of [['desk', 1440], ['laptop', 1280], ['phone', 390]]) {
  const p = await br.newPage({ viewport: { width, height: 900 } });
  await p.setContent(doc, { waitUntil: 'networkidle' });
  await p.screenshot({ path: `page-${name}.png`, fullPage: true });
  const h = await p.evaluate(() => document.documentElement.scrollHeight);
  console.log(name, width + 'px,', h + 'px tall');
  await p.close();
}
await br.close();
