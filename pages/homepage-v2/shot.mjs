import fs from 'node:fs'; import path from 'node:path';
import { execSync } from 'node:child_process'; import { pathToFileURL } from 'node:url';
const D='/tmp/claude-0/-home-user-Muaytix-site/92c34b20-70db-5c31-9f25-d0116bc68d3c/scratchpad/hp2';
async function lp(){try{return await import('playwright');}catch{const r=execSync('npm root -g',{encoding:'utf8'}).trim();return await import(pathToFileURL(path.join(r,'playwright','index.js')).href);}}
const pw=await lp(); const chromium=pw.chromium??pw.default.chromium;
const a=fs.readFileSync(path.join(D,'homepage-a.html'),'utf8');
const b=fs.readFileSync(path.join(D,'homepage-b.html'),'utf8');
// A stand-in for Jason's existing rotating cards block, so the two pieces are
// checked with something between them, the way they will sit on the page.
const gap=`<div style="background:#111;color:#666;font:14px/1.6 sans-serif;padding:40px 20px;text-align:center">[ your existing rotating fight night cards sit here ]</div>`;
const browser=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
for(const [name,w,h,dsf] of [['phone',412,900,2],['desk',1280,900,1]]){
  const ctx=await browser.newContext({viewport:{width:w,height:h},deviceScaleFactor:dsf});
  const page=await ctx.newPage();
  await page.route('https://muaytix.test/**', r=>r.fulfill({status:200,contentType:'text/html',
    body:`<!doctype html><html><head><meta charset="utf-8"><title>MuayTix</title><style>body{margin:0}</style></head><body>${a}${gap}${b}</body></html>`}));
  await page.goto('https://muaytix.test/');
  await page.waitForTimeout(400);
  const m=await page.evaluate(()=>({
    overflow: document.documentElement.scrollWidth-document.documentElement.clientWidth,
    h1: document.querySelectorAll('h1').length,
    h2: document.querySelectorAll('h2').length,
    sections: document.querySelectorAll('section').length,
    nightRows: document.querySelectorAll('.mtx-hp__nights li').length,
    rwsLinks: document.querySelectorAll('.mtx-hp__links li').length,
    widget: document.querySelectorAll('.muaytix-ticket-selector').length,
    jsonld: document.querySelectorAll('script[type="application/ld+json"]').length,
  }));
  console.log(name, JSON.stringify(m));
  await page.screenshot({path:path.join(D,`shot-${name}.png`),fullPage:true});
  await ctx.close();
}
await browser.close();
