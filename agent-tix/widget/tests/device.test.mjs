// What the guest is booking on is sent with every checkout, so the report can
// split phone, tablet and computer even for guests who arrived with no advert.
//
//   node agent-tix/widget/tests/device.test.mjs
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
const events = JSON.parse(fs.readFileSync(new URL('./calendar.json',import.meta.url),'utf8'));
const night  = JSON.parse(fs.readFileSync(new URL('./night.json',import.meta.url),'utf8'));
const widget = fs.readFileSync(new URL('../widget.js',import.meta.url),'utf8');
let fail = 0;
const check=(n,ok,d='')=>{ ok?console.log('  ok   '+n):(fail++,console.log('  FAIL '+n+(d?'  -> '+d:''))); };
const b = await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});

const UA = {
  iphone:  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36',
  atablet: 'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
  ipad:    'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  ipados:  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  mac:     'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  windows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'
};

async function booked(ua, { touch = 0, stored = null, consent = true } = {}){
  const ctx = await b.newContext({ userAgent: ua, viewport: { width: 1000, height: 900 } });
  const p = await ctx.newPage();
  if (touch) await p.addInitScript(`Object.defineProperty(navigator,'maxTouchPoints',{get:()=>${touch}})`);
  if (stored) await p.addInitScript(`try{localStorage.setItem('mtx_attr', ${JSON.stringify(JSON.stringify(stored))})}catch(e){}`);
  if (!consent) await p.addInitScript('window.mtxAttributionConsent = false');
  let sent = null;
  await p.route('**/functions/v1/**', r => {
    const bd = JSON.parse(r.request().postData() || '{}');
    if (r.request().url().endsWith('/create-checkout')) {
      if (bd.action !== 'warm') sent = bd;
      return r.fulfill({ status:200, contentType:'application/json', body:'{"checkoutUrl":"about:blank#paid"}' });
    }
    r.fulfill({ status:200, contentType:'application/json', body: JSON.stringify(bd.action==='events'?events:night) });
  });
  p.on('pageerror', e => { fail++; console.log('  FAIL page error -> ' + e.message); });
  await p.route('https://muaytix.test/**', r => r.fulfill({ status:200, contentType:'text/html', body:
    `<!doctype html><html><head><meta charset="utf-8"><title>t</title></head><body>
    <div class="muaytix-ticket-selector" data-event-id="rws_2026_09_05" data-ticket-class="Ringside"></div><script>${widget}<\/script></body></html>` }));
  await p.goto('https://muaytix.test/tickets', { waitUntil:'domcontentloaded' });
  await p.waitForSelector('[data-go]:not([disabled])', { timeout: 8000 });
  await p.click('[data-go]');
  await p.waitForTimeout(600);
  await ctx.close();
  return sent;
}

console.log('\nThe device is sent with every booking');
check('iPhone is a phone',            (await booked(UA.iphone))?.attribution?.device === 'm');
check('Android phone is a phone',     (await booked(UA.android))?.attribution?.device === 'm');
check('Android tablet is a tablet',   (await booked(UA.atablet))?.attribution?.device === 't');
check('iPad is a tablet',             (await booked(UA.ipad))?.attribution?.device === 't');
check('iPad asking for the desktop site is still a tablet', (await booked(UA.ipados, { touch: 5 }))?.attribution?.device === 't');
check('a Mac with no touch screen is a computer', (await booked(UA.mac))?.attribution?.device === 'd');
check('Windows is a computer',        (await booked(UA.windows))?.attribution?.device === 'd');

console.log('\nAn advert that already said what the device was is not overruled');
const adStored = { clickId:'Cj0_test', clickIdKind:'gclid', source:'google', medium:'cpc', campaign:'c1', term:null, content:null, adGroupId:null, matchType:null, device:'m', at:new Date().toISOString() };
const ad = await booked(UA.windows, { stored: adStored });
check('the advert\'s device is kept', ad?.attribution?.device === 'm', JSON.stringify(ad?.attribution));
check('and its click id is still sent', ad?.attribution?.clickId === 'Cj0_test');
const adNoDevice = await booked(UA.iphone, { stored: { ...adStored, device: null } });
check('an advert with no device gets the browser\'s', adNoDevice?.attribution?.device === 'm' && adNoDevice?.attribution?.clickId === 'Cj0_test', JSON.stringify(adNoDevice?.attribution));

console.log('\nThe site\'s consent switch is respected');
const refused = await booked(UA.iphone, { consent: false });
check('no device is sent when consent is refused', !refused?.attribution?.device, JSON.stringify(refused?.attribution));
check('the booking still goes through', refused?.eventKey === night.event.eventKey);

console.log(fail ? `\n${fail} failed` : '\nall passed');
await b.close();
process.exit(fail ? 1 : 0);
