import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw; import { readFileSync } from 'node:fs';
const frag = readFileSync('live.txt','utf8');
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
for (const [tag, w] of [['d',1440],['m',390]]) {
  const p = await b.newPage({ viewport:{width:w,height:1000} });
  await p.route('**/static.tildacdn.com/**', r=>r.fulfill({status:200,contentType:'image/svg+xml',
    body:'<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900"><rect width="1200" height="900" fill="#ddd"/><text x="60" y="470" font-family="Arial" font-size="70" fill="#888">seat map</text></svg>'}));
  await p.setContent(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0">${frag}</body></html>`,{waitUntil:'load'});
  await p.waitForTimeout(300);
  const nodes = await p.$$('.mtx-rt > section, .mtx-rt > header');
  for (let i=0;i<nodes.length;i++) {
    await nodes[i].scrollIntoViewIfNeeded(); await p.waitForTimeout(120);
    await nodes[i].screenshot({ path:`${tag}-${i+1}.jpg`, type:'jpeg', quality:60 });
  }
  console.log(tag, nodes.length, 'sections at', w+'px');
  await p.close();
}
await b.close();
