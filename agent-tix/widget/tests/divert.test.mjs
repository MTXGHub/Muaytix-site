// Sending a guest to the stadium when we are not selling the night ourselves.
//
// The rule being defended is a commercial one: the way out appears ONLY when
// there is nothing at all left to buy on that night. A night with even one
// class still on sale is a night we are selling, and putting another ticket
// seller in front of that guest would be giving away our own booking.
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
const base  =JSON.parse(fs.readFileSync(new URL('./night.json',import.meta.url),'utf8'));
const widget=fs.readFileSync(new URL('../widget.js',import.meta.url),'utf8');

let pass=0, fail=0;
const check=(n,ok,d='')=>{ ok?(pass++,console.log('  ok   '+n)):(fail++,console.log('  FAIL '+n+(d?'  -> '+d:''))); };

const b = await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});

// A night shaped however the test needs: which classes are live, and whether
// the night carries a way out.
function night({statuses, divertUrl=null, divertNote=null}){
  const n = JSON.parse(JSON.stringify(base));
  n.event.divertUrl = divertUrl;
  n.event.divertNote = divertNote;
  n.classes.forEach((c,i)=>{ c.status = statuses[i] ?? 'booking_closed'; });
  return n;
}

async function page(fixture){
  const ctx=await b.newContext({viewport:{width:1180,height:1000}});
  const p=await ctx.newPage();
  await p.route('**/functions/v1/**', r=>{
    const bd=JSON.parse(r.request().postData()||'{}');
    if(r.request().url().endsWith('/create-checkout'))
      return r.fulfill({status:200,contentType:'application/json',body:'{"checkoutUrl":"https://checkout.stripe.com/x"}'});
    r.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify(bd.action==='events'?events:fixture)});
  });
  p.on('pageerror',e=>{fail++;console.log('  FAIL page error -> '+e.message);});
  await p.setContent(`<!doctype html><html><head><meta charset="utf-8"><title>t</title></head>
    <body><div class="muaytix-ticket-selector" data-event-id="rws_2026_09_05"></div>
    <script>${widget}<\/script></body></html>`,{waitUntil:'domcontentloaded'});
  return {p,ctx};
}

console.log('\nNothing left to sell, and somewhere to send them');
{
  const {p,ctx}=await page(night({
    statuses:['booking_closed','booking_closed','booking_closed','closed'],
    divertUrl:'https://rajadamnern.com/tickets',
    divertNote:'We have closed our own sales for tonight. The stadium is still selling on the door and online.'}));
  await p.waitForSelector('.mtx-divert',{timeout:8000});
  check('the way out is offered', await p.isVisible('.mtx-divert-go'));
  check('it goes where it was told',
    (await p.getAttribute('.mtx-divert-go','href'))==='https://rajadamnern.com/tickets');
  check('it opens in a new tab', (await p.getAttribute('.mtx-divert-go','target'))==='_blank');
  check('and cannot reach back into our page',
    (await p.getAttribute('.mtx-divert-go','rel')).includes('noopener'));
  check('the reason is in the guest’s words, not ours',
    (await p.textContent('.mtx-divert-d')).includes('still selling on the door'));
  check('and it says the tab will change',
    (await p.textContent('.mtx-divert-n')).includes('new tab'));
  check('four dead seat buttons are not shown as well', (await p.$('.mtx-picker'))===null);
  await ctx.close();
}

console.log('\nOne seat still on sale — we sell it, we do not give it away');
{
  const {p,ctx}=await page(night({
    statuses:['booking_closed','available','booking_closed','closed'],
    divertUrl:'https://rajadamnern.com/tickets'}));
  await p.waitForSelector('.mtx-picker',{timeout:8000});
  check('no way out is offered', (await p.$('.mtx-divert'))===null);
  check('the seats are offered instead', (await p.$$('.mtx-pick')).length===4);
  await ctx.close();
}
{
  const {p,ctx}=await page(night({
    statuses:['booking_closed','booking_closed','limited','closed'],
    divertUrl:'https://rajadamnern.com/tickets'}));
  await p.waitForSelector('.mtx-picker',{timeout:8000});
  check('a merely limited class still counts as ours to sell', (await p.$('.mtx-divert'))===null);
  await ctx.close();
}

console.log('\nClosed, but nowhere to send them');
{
  const {p,ctx}=await page(night({
    statuses:['booking_closed','booking_closed','booking_closed','closed']}));
  await p.waitForSelector('.mtx-picker',{timeout:8000});
  check('it behaves exactly as it did before, no empty button',
    (await p.$('.mtx-divert'))===null && (await p.$$('.mtx-pick')).length===4);
  await ctx.close();
}

console.log('\nA night we are selling normally is untouched');
{
  const {p,ctx}=await page(night({
    statuses:['available','available','limited','available'],
    divertUrl:'https://rajadamnern.com/tickets'}));
  await p.waitForSelector('.mtx-picker',{timeout:8000});
  check('no way out on a night that is selling', (await p.$('.mtx-divert'))===null);
  await p.click('[data-pick="ringside"]');
  await p.waitForSelector('.mtx-detail',{timeout:8000});
  check('and the ordinary booking still runs', await p.isVisible('[data-go]'));
  await ctx.close();
}

await b.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
