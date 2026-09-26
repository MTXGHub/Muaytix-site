import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw; import { readFileSync } from 'node:fs';
const frag = readFileSync('rws-2026-10-03-live.txt','utf8');
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
// Freeze the clock either side of the night: the page picks its own wording.
for (const [label, iso] of [['before','2026-09-29T12:00:00+07:00'],
                            ['tonight','2026-10-03T16:00:00+07:00'],
                            ['after','2026-10-05T12:00:00+07:00']]) {
  const ctx = await b.newContext({ viewport:{width:1440,height:1000} });
  await ctx.addInitScript(`{
    const fixed = new Date(${JSON.stringify(iso)}).getTime();
    const R = Date; class D extends R {
      constructor(...a){ if(!a.length) super(fixed); else super(...a); }
      static now(){ return fixed; }
      getTimezoneOffset(){ return 0; }   // pretend UTC so the Bangkok maths is clean
    }
    Date = D;
  }`);
  const p = await ctx.newPage();
  // The three posters are the real files the owner supplied, so the section
  // renders truthfully. Everything else on tildacdn gets a stand-in.
  const POST = { '1000034441':'8b6be2e9', '1000034440':'efb1dcb0', '1000034439':'dbe4a58e' };
  const UP = '/root/.claude/uploads/92c34b20-70db-5c31-9f25-d0116bc68d3c/';
  await p.route('**/static.tildacdn.com/**', r => {
    const id = (r.request().url().match(/(\d{10})\.jpg/) || [])[1];
    if (POST[id]) return r.fulfill({ status:200, contentType:'image/jpeg',
      body: readFileSync(UP + POST[id] + '-image.jpg') });
    r.fulfill({status:200,contentType:'image/svg+xml',
      body:'<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="#1b1b1f"/><text x="60" y="420" font-family="Arial" font-size="64" fill="#777">photo</text></svg>'});
  });
  await p.setContent(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0">${frag}</body></html>`,{waitUntil:'load'});
  await p.waitForTimeout(400);
  const state = await p.$eval('.mtx-rws[data-night]', n => n.getAttribute('data-state'));
  const say = await p.$eval('[data-mtx-countdown]', n => n.textContent.trim()).catch(()=>'-');
  console.log(label.padEnd(8), 'state=' + state, '| countdown:', say);
  if (label === 'before') {
    const nodes = await p.$$('.mtx-rws > section, .mtx-rws > header');
    for (let i=0;i<nodes.length;i++) await nodes[i].screenshot({path:`oct03-${i+1}.jpg`,type:'jpeg',quality:62});
    console.log('         ', nodes.length, 'sections shot');
  }
  await ctx.close();
}
await b.close();
