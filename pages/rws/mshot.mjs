import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw; import { readFileSync } from 'node:fs';
const frag = readFileSync('rws-2026-10-03-live.txt','utf8');
const POST = { '1000034441':'8b6be2e9', '1000034440':'efb1dcb0', '1000034439':'dbe4a58e' };
const UP = '/root/.claude/uploads/92c34b20-70db-5c31-9f25-d0116bc68d3c/';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport:{width:390,height:900} });
await p.route('**/static.tildacdn.com/**', r => {
  const id = (r.request().url().match(/(\d{10})\.jpg/)||[])[1];
  if (POST[id]) return r.fulfill({status:200,contentType:'image/jpeg',body:readFileSync(UP+POST[id]+'-image.jpg')});
  r.fulfill({status:200,contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="#1b1b1f"/></svg>'});
});
await p.setContent(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0">${frag}</body></html>`,{waitUntil:'load'});
await p.waitForTimeout(500);
const nodes = await p.$$('.mtx-rws > section');
await nodes[3].scrollIntoViewIfNeeded();
await p.waitForTimeout(1200);
console.log('images complete:', await p.evaluate(() =>
  [...document.querySelectorAll('.mtx-rws__posters img')].map(i => i.complete + '/' + i.naturalWidth).join(' ')));
await nodes[3].screenshot({path:'m-oct03-bouts.jpg',type:'jpeg',quality:58});
console.log('mobile bouts section shot');
await b.close();
