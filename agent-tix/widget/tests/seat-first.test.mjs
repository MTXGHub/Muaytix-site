// Seat first, night second — <div class="muaytix-ticket-selector" data-start="seats">
//
// The order is the point: a guest says where they want to sit before any date
// exists on screen. What these checks defend is the rule that came out of the
// "No fight" blunder — a night is never removed and never disabled just because
// the guest's first choice is gone. It is dimmed, it still opens, and the other
// seats are still for sale on it.
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

const events =JSON.parse(fs.readFileSync(new URL('./calendar.json',import.meta.url),'utf8'));
const night  =JSON.parse(fs.readFileSync(new URL('./night.json',import.meta.url),'utf8'));
const classes=JSON.parse(fs.readFileSync(new URL('./classes.json',import.meta.url),'utf8'));
const widget =fs.readFileSync(new URL('../widget.js',import.meta.url),'utf8');

let pass=0, fail=0, asked=[];
const check=(n,ok,d='')=>{ ok?(pass++,console.log('  ok   '+n)):(fail++,console.log('  FAIL '+n+(d?'  -> '+d:''))); };

const b = await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});

async function page(mounts, w=1180){
  asked=[];
  const ctx=await b.newContext({viewport:{width:w,height:1000}});
  const p=await ctx.newPage();
  await p.route('**/functions/v1/**', r=>{
    const bd=JSON.parse(r.request().postData()||'{}');
    asked.push(bd);
    if(r.request().url().endsWith('/create-checkout'))
      return r.fulfill({status:200,contentType:'application/json',body:'{"checkoutUrl":"https://checkout.stripe.com/x"}'});
    const body = bd.action==='classes' ? classes : bd.action==='events' ? events : night;
    r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
  });
  p.on('pageerror',e=>{fail++;console.log('  FAIL page error -> '+e.message);});
  await p.setContent(`<!doctype html><html><head><meta charset="utf-8"><title>t</title>
    <style>body{text-align:center}#allrecords,#allrecords *{text-align:center}
    #allrecords button{color:#000;font-family:serif}</style></head>
    <body><div id="allrecords">${mounts}</div><script>${widget}<\/script></body></html>`,
    {waitUntil:'domcontentloaded'});
  return {p,ctx};
}

console.log('\nStep 1 — the seat classes, before any date');
{
  const {p,ctx}=await page('<div class="muaytix-ticket-selector" data-start="seats"></div>');
  await p.waitForSelector('[data-seat]',{timeout:8000});
  const names = await p.$$eval('[data-seat] .mtx-pick-name', n=>n.map(x=>x.textContent));
  check('all four seat classes offered',
        JSON.stringify(names)==='["Ringside","Club Class","LEO Section","Third Class"]', JSON.stringify(names));
  check('no calendar yet', await p.isHidden('[data-cal]'));
  check('no date has been asked for', asked.every(a=>a.action!=='events'), JSON.stringify(asked));
  const counts = await p.$$eval('[data-seat] .mtx-pill', n=>n.map(x=>x.textContent.trim()));
  check('each says how many nights it is on', counts[0]==='3 nights' && counts[1]==='4 nights', JSON.stringify(counts));
  check('a class on sale nowhere says so, rather than vanishing',
        counts[3]==='Not currently on sale', JSON.stringify(counts));
  await ctx.close();
}

console.log('\nStep 2 — the calendar, for that seat');
{
  const {p,ctx}=await page('<div class="muaytix-ticket-selector" data-start="seats"></div>');
  await p.waitForSelector('[data-seat]',{timeout:8000});
  await p.click('[data-seat="ringside"]');
  await p.waitForSelector('[data-grid] [data-date]',{timeout:8000});

  const ev = asked.find(a=>a.action==='events');
  check('the calendar is asked for that seat by name', ev && ev.classCode==='ringside', JSON.stringify(ev));

  const dates = await p.$$eval('[data-grid] [data-date]', n=>n.map(x=>x.dataset.date));
  check('every fight night is still on the calendar',
        JSON.stringify(dates)==='["2026-09-01","2026-09-02","2026-09-05"]', JSON.stringify(dates));
  const enabled = await p.$$eval('[data-grid] [data-date]', n=>n.every(x=>!x.disabled));
  check('and every one of them still opens', enabled);

  const dim = await p.$$eval('[data-grid] .mtx-off', n=>n.map(x=>x.dataset.date));
  check('nights without Ringside are dimmed, not removed',
        JSON.stringify(dim)==='["2026-09-01","2026-09-02"]', JSON.stringify(dim));

  check('it says which seat is being booked',
        (await p.textContent('[data-seatnote] b'))==='Ringside');
  check('and warns what dimmed means',
        (await p.textContent('[data-seatnote]')).includes('still open them and choose another'));
  await ctx.close();
}

console.log('\nStep 3 — the night opens on the seat already chosen');
{
  const {p,ctx}=await page('<div class="muaytix-ticket-selector" data-start="seats"></div>');
  await p.waitForSelector('[data-seat]',{timeout:8000});
  await p.click('[data-seat="ringside"]');
  await p.waitForSelector('[data-date="2026-09-05"]',{timeout:8000});
  await p.click('[data-date="2026-09-05"]');
  await p.waitForSelector('.mtx-detail',{timeout:8000});
  check('lands straight on Ringside, no second choosing',
        (await p.textContent('.mtx-detail-h'))==='Ringside');
  check('the night is named', (await p.textContent('.mtx-band-h'))==='RWS Rajadamnern World Series');
  check('the date can still be changed', (await p.$('[data-back-date]'))!==null);
  check('and so can the seat', (await p.$('[data-back-class]'))!==null);
  await ctx.close();
}

console.log('\nA dimmed night is a sale, not a dead end');
{
  const {p,ctx}=await page('<div class="muaytix-ticket-selector" data-start="seats"></div>');
  await p.waitForSelector('[data-seat]',{timeout:8000});
  await p.click('[data-seat="ringside"]');
  await p.waitForSelector('[data-date="2026-09-02"]',{timeout:8000});
  await p.click('[data-date="2026-09-02"]');           // Ringside sold out here
  await p.waitForSelector('.mtx-detail',{timeout:8000});
  check('it still opens on Ringside and says where it stands',
        (await p.textContent('.mtx-detail-h'))==='Ringside');
  await p.click('[data-back-class]');
  await p.waitForSelector('.mtx-picker',{timeout:8000});
  const others = await p.$$eval('.mtx-pick .mtx-pick-name', n=>n.map(x=>x.textContent));
  check('and every other seat is right there to buy instead',
        others.length===4 && others.includes('Club Class'), JSON.stringify(others));
  await ctx.close();
}

console.log('\nChanging seat class starts again cleanly');
{
  const {p,ctx}=await page('<div class="muaytix-ticket-selector" data-start="seats"></div>');
  await p.waitForSelector('[data-seat]',{timeout:8000});
  await p.click('[data-seat="ringside"]');
  await p.waitForSelector('[data-grid] [data-date]',{timeout:8000});
  await p.click('[data-back-seat]');
  await p.waitForSelector('[data-seat]',{timeout:8000});
  check('back to the seat classes', (await p.$$('[data-seat]')).length===4);
  check('the calendar is put away again', await p.isHidden('[data-cal]'));
  await p.click('[data-seat="club_class"]');
  await p.waitForSelector('[data-grid] [data-date]',{timeout:8000});
  const ev = asked.filter(a=>a.action==='events').pop();
  check('and the calendar is reloaded for the new seat', ev.classCode==='club_class', JSON.stringify(ev));
  check('the note follows it', (await p.textContent('[data-seatnote] b'))==='Club Class');
  await ctx.close();
}

console.log('\nIt does not disturb the other four modes');
{
  const {p,ctx}=await page('<div class="muaytix-ticket-selector"></div>');
  await p.waitForSelector('[data-grid] [data-date]',{timeout:8000});
  check('the plain calendar still opens on dates', (await p.$$('[data-grid] [data-date]')).length===3);
  check('nothing is dimmed when no seat was chosen', (await p.$$('[data-grid] .mtx-off')).length===0);
  const ev = asked.find(a=>a.action==='events');
  check('and no seat is sent with the request', ev.classCode===undefined, JSON.stringify(ev));
  await ctx.close();
}
{
  const {p,ctx}=await page('<div class="muaytix-ticket-selector" data-event-id="rws_2026_09_05" data-start="seats"></div>');
  await p.waitForSelector('.mtx-pick',{timeout:8000});
  check('a one-night page ignores seat-first — there is no calendar to lead to',
        (await p.$('[data-seat]'))===null);
  await ctx.close();
}

console.log('\nStock comes from the same place as every other widget');
{
  const {p,ctx}=await page('<div class="muaytix-ticket-selector" data-start="seats"></div>');
  await p.waitForSelector('[data-seat]',{timeout:8000});
  await p.click('[data-seat="ringside"]');
  await p.waitForSelector('[data-date="2026-09-05"]',{timeout:8000});
  await p.click('[data-date="2026-09-05"]');
  await p.waitForSelector('.mtx-detail',{timeout:8000});
  const night = asked.filter(a=>a.action==='availability').pop();
  check('the night is asked for by event alone, with no seat filter on the stock',
        night.eventKey==='rws_2026_09_05' && night.classCode===undefined, JSON.stringify(night));
  await ctx.close();
}

await b.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
