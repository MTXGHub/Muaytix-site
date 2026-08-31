import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
async function loadPlaywright(){
  try { return await import('playwright'); }
  catch { const r = execSync('npm root -g',{encoding:'utf8'}).trim();
    return await import(pathToFileURL(path.join(r,'playwright','index.js')).href); }
}
const pw = await loadPlaywright();
const chromium = pw.chromium ?? pw.default.chromium;

const events=JSON.parse(fs.readFileSync(new URL('./calendar.json',import.meta.url),'utf8'));
const night =JSON.parse(fs.readFileSync(new URL('./night.json',import.meta.url),'utf8'));
const widget=fs.readFileSync(new URL('../widget.js',import.meta.url),'utf8');

let pass=0, fail=0;
const check=(n,ok,d='')=>{ ok?(pass++,console.log('  ok   '+n)):(fail++,console.log('  FAIL '+n+(d?'  -> '+d:''))); };

const b = await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});

async function page(mounts, w=1180){
  const ctx=await b.newContext({viewport:{width:w,height:1000}});
  const p=await ctx.newPage();
  await p.route('**/functions/v1/**', r=>{
    const bd=JSON.parse(r.request().postData()||'{}');
    if(r.request().url().endsWith('/create-checkout'))
      return r.fulfill({status:200,contentType:'application/json',body:'{"checkoutUrl":"https://checkout.stripe.com/x"}'});
    r.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify(bd.action==='events'?events:night)});
  });
  p.on('pageerror',e=>{fail++;console.log('  FAIL page error -> '+e.message);});
  // Hostile host, as the live Tilda page turned out to be.
  await p.setContent(`<!doctype html><html><head><meta charset="utf-8"><title>t</title>
    <style>body{text-align:center}#allrecords,#allrecords *{text-align:center}
    #allrecords button{color:#000;font-family:serif}</style></head>
    <body><div id="allrecords">${mounts}</div><script>${widget}<\/script></body></html>`,
    {waitUntil:'domcontentloaded'});
  return {p,ctx};
}

console.log('\nMode 1 — the full calendar (no attributes)');
{
  const {p,ctx}=await page('<div class="muaytix-ticket-selector"></div>');
  await p.waitForSelector('[data-grid] [data-date]',{timeout:8000});
  check('calendar drawn', (await p.$$('[data-grid] [data-date]')).length===3);
  check('masthead shown', await p.isVisible('.mtx-mast'));
  check('month buttons shown', (await p.$$('[data-months] button')).length===2);
  const card = await p.$eval('.mtx-card', el=>getComputedStyle(el).backgroundColor);
  check('the card panel is painted', card==='rgb(255, 255, 255)', card);
  await ctx.close();
}

console.log('\nMode 2 — one night (data-event-id)');
{
  const {p,ctx}=await page('<div class="muaytix-ticket-selector" data-event-id="rws_2026_09_05"></div>');
  await p.waitForSelector('.mtx-pick',{timeout:8000});
  check('no calendar', await p.isHidden('[data-cal]'));
  check('no masthead', (await p.$('.mtx-mast'))===null);
  check('the night is named', (await p.textContent('.mtx-band-h'))==='RWS Rajadamnern World Series');
  check('no "change date" — there is nowhere to go', (await p.$('[data-back-date]'))===null);
  check('all four classes offered', (await p.$$('.mtx-pick')).length===4);
  await ctx.close();
}

console.log('\nMode 3 — one night, one seat class');
{
  const {p,ctx}=await page('<div class="muaytix-ticket-selector" data-event-id="rws_2026_09_05" data-ticket-class="Third Class"></div>');
  await p.waitForSelector('.mtx-detail',{timeout:8000});
  check('opens straight onto the class', (await p.textContent('.mtx-detail-h'))==='Third Class');
  check('not offered as a choice', (await p.$('.mtx-picker'))===null);
  check('no "change seat class"', (await p.$('[data-back-class]'))===null);
  check('closed class explains itself',
    (await p.textContent('.mtx-note')).includes('usually opened by the stadium'));
  await ctx.close();
}

console.log('\nMode 4 — one promotion only (data-series)');
{
  const {p,ctx}=await page('<div class="muaytix-ticket-selector" data-series="rws"></div>');
  await p.waitForSelector('[data-grid] [data-date]',{timeout:8000});
  const dates = await p.$$eval('[data-grid] [data-date]', b=>b.map(x=>x.dataset.date));
  check('only that promotion is bookable', JSON.stringify(dates)==='["2026-09-05"]', JSON.stringify(dates));
  const months = await p.$$eval('[data-months] button', b=>b.map(x=>x.textContent.trim()));
  check('months without one of its nights are not offered',
        JSON.stringify(months)==='["Sep 2026"]', JSON.stringify(months));
  check('the calendar is still a calendar', await p.isVisible('[data-grid]'));
  await p.click('[data-date="2026-09-05"]');
  await p.waitForSelector('.mtx-pick',{timeout:8000});
  check('the night still opens normally', (await p.textContent('.mtx-band-h'))==='RWS Rajadamnern World Series');
  check('and can be changed', (await p.$('[data-back-date]'))!==null);
  await ctx.close();
}

console.log('\nA promotion with nothing on sale says so');
{
  const ctx=await b.newContext({viewport:{width:1180,height:900}});
  const p=await ctx.newPage();
  await p.route('**/functions/v1/**',r=>r.fulfill({status:200,contentType:'application/json',
    body:JSON.stringify(events)}));
  p.on('pageerror',e=>{fail++;console.log('  FAIL page error -> '+e.message);});
  await p.setContent(`<!doctype html><html><head><meta charset="utf-8"><title>t</title></head>
    <body><div class="muaytix-ticket-selector" data-series="kiatpetch"></div><script>${widget}<\/script></body></html>`,
    {waitUntil:'domcontentloaded'});
  await p.waitForSelector('.mtx-state',{timeout:8000});
  check('told plainly, not left blank',
    (await p.textContent('.mtx-state h3')).includes('No dates on sale for this event'),
    await p.textContent('.mtx-state h3'));
  await ctx.close();
}

console.log('\nTwo widgets on one page keep their own state');
{
  const {p,ctx}=await page(
    '<div class="muaytix-ticket-selector" data-event-id="rws_2026_09_05" data-ticket-class="Ringside"></div>'+
    '<div class="muaytix-ticket-selector" data-event-id="rws_2026_09_05" data-ticket-class="LEO Section"></div>');
  await p.waitForSelector('.mtx-detail',{timeout:8000});
  const names = await p.$$eval('.mtx-detail-h', n=>n.map(x=>x.textContent));
  check('each shows its own class', JSON.stringify(names)==='["Ringside","LEO Section"]', JSON.stringify(names));
  await p.selectOption('.muaytix-ticket-selector:nth-of-type(1) [data-qty]','2');
  const totals = await p.$$eval('[data-total]', n=>n.map(x=>x.textContent));
  check('one does not move the other', totals[0]!=='—' && totals[1]==='—', JSON.stringify(totals));
  await ctx.close();
}

console.log('\nStill survives the host page');
{
  const {p,ctx}=await page('<div class="muaytix-ticket-selector" data-event-id="rws_2026_09_05" data-ticket-class="LEO Section"></div>');
  await p.waitForSelector('.mtx-detail',{timeout:8000});
  await p.selectOption('[data-qty]','2');
  const cta = await p.evaluate(()=>{
    const s=getComputedStyle(document.querySelector('[data-go]'));
    const v=c=>c.match(/\d+/g).slice(0,3).map(Number);
    const lum=x=>0.2126*x[0]+0.7152*x[1]+0.0722*x[2];
    return {c:lum(v(s.color)), b:lum(v(s.backgroundColor)), f:s.fontFamily,
            a:getComputedStyle(document.querySelector('.mtx-detail-d')).textAlign};
  });
  check('reserve button readable', Math.abs(cta.c-cta.b)>100);
  check('keeps its own typeface', /Barlow/.test(cta.f), cta.f);
  check('description reads left', cta.a==='left', cta.a);
  await ctx.close();
}

await b.close();
console.log('\n'+pass+' passed, '+fail+' failed');
process.exit(fail?1:0);
