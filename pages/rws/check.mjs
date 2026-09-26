import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw; import { readFileSync } from 'node:fs';
const frag = readFileSync('rws-2026-10-03-live.txt','utf8');
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
for (const w of [1440,1280,1024,860,620,390]) {
  const p = await b.newPage({ viewport:{width:w,height:900} });
  await p.route('**/static.tildacdn.com/**', r=>r.fulfill({status:200,contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"/>'}));
  await p.setContent(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0">${frag}</body></html>`,{waitUntil:'load'});
  await p.waitForTimeout(250);
  const r = await p.evaluate(() => {
    const over = Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth);
    const small = [...document.querySelectorAll('.mtx-rws a, .mtx-rws button, .mtx-rws summary')]
      .filter(e => e.offsetParent !== null && e.getBoundingClientRect().height > 0 && e.getBoundingClientRect().height < 44).length;
    return { over, small, h: Math.round(document.body.scrollHeight) };
  });
  console.log(`${String(w).padStart(5)}px  overflow ${r.over}px  height ${r.h}px  small taps ${r.small}`);
  await p.close();
}
const p = await b.newPage({ viewport:{width:1440,height:900} });
await p.setContent(`<!doctype html><meta charset="utf-8"><body>${frag}</body>`,{waitUntil:'load'});
const ld = await p.$$eval('script[type="application/ld+json"]', n => n.map(x => x.textContent));
ld.forEach(t => { const j = JSON.parse(t); console.log('schema:', j['@type'], '|', j.name || '', '|', j.startDate || ''); });
console.log('widget mount:', await p.$eval('.muaytix-ticket-selector', n => n.getAttribute('data-event-id')));
await b.close();
