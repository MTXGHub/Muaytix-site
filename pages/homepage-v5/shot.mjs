import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
import { readFileSync } from 'node:fs';
const frag = readFileSync('homepage-live.txt', 'utf8');
const doc = `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0">${frag}</body></html>`;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
await p.setContent(doc, { waitUntil: 'load' });
const secs = [
  ['.mtx-hp__hero', 'shot-1-hero.jpg'],
  ['.mtx-hp__band--paper:nth-of-type(1)', null],
];
// One shot per section, so each is small enough to upload and big enough to read.
const nodes = await p.$$('.mtx-hp > section, .mtx-hp > header');
for (let i = 0; i < nodes.length; i++) {
  await nodes[i].screenshot({ path: `shot-${i + 1}.jpg`, type: 'jpeg', quality: 66 });
}
console.log(nodes.length, 'sections shot');
await b.close();
