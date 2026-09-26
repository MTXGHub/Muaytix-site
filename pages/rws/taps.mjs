import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw; import { readFileSync } from 'node:fs';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
for (const f of ['rws-2026-10-03-live.txt','rws-2026-09-26-live.txt']) {
  const p = await b.newPage({ viewport:{width:390,height:900} });
  await p.setContent(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0">${readFileSync(f,'utf8')}</body>`,{waitUntil:'load'});
  console.log('==', f);
  console.log(await p.evaluate(()=>[...document.querySelectorAll('.mtx-rws a,.mtx-rws button,.mtx-rws summary')]
    .filter(e=>e.offsetParent!==null && e.getBoundingClientRect().height>0 && e.getBoundingClientRect().height<44)
    .map(e=>`${Math.round(e.getBoundingClientRect().height)}px  ${e.className||e.tagName}  "${e.textContent.trim().slice(0,40)}"`).join('\n')));
  await p.close();
}
await b.close();
