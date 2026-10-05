// Agent Tix — the widget loaded from the site header
//
//   node agent-tix/widget/tests/header-block.test.mjs
//
// The header block goes in <head> once; pages carry only the div. This is the
// arrangement that gives one place to update without hosting anything.

import fs from 'node:fs'; import path from 'node:path';
import { execSync } from 'node:child_process'; import { pathToFileURL } from 'node:url';
const r=execSync('npm root -g',{encoding:'utf8'}).trim();
const pw=await import(pathToFileURL(path.join(r,'playwright','index.js')).href);
const chromium=pw.chromium??pw.default.chromium;
const events=JSON.parse(fs.readFileSync(new URL('./calendar.json',import.meta.url),'utf8'));
const night =JSON.parse(fs.readFileSync(new URL('./night.json',import.meta.url),'utf8'));
const block=fs.readFileSync(new URL('../paste-into-tilda-header.html',import.meta.url),'utf8');
let pass=0,fail=0;
const check=(n,ok,d='')=>{ok?(pass++,console.log('  ok   '+n)):(fail++,console.log('  FAIL '+n+(d?'  -> '+d:'')));};
const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH});

async function tilda(extraDiv=''){
  const ctx=await b.newContext({viewport:{width:1180,height:1000}});
  const p=await ctx.newPage();
  await p.route('**/functions/v1/**',rt=>{
    const bd=JSON.parse(rt.request().postData()||'{}');
    if(rt.request().url().endsWith('/create-checkout'))
      return rt.fulfill({status:200,contentType:'application/json',body:'{"checkoutUrl":"https://checkout.stripe.com/x"}'});
    rt.fulfill({status:200,contentType:'application/json',body:JSON.stringify(bd.action==='events'?events:night)});
  });
  p.on('pageerror',e=>{fail++;console.log('  FAIL page error -> '+e.message);});
  // A Tilda page: their wrapper, their stylesheet, our block dropped inside it.
  await p.setContent(`<!doctype html><html><head><meta charset="utf-8"><title>MuayTix</title>
    <style>body{text-align:center;font-family:Arial}#allrecords,#allrecords *{text-align:center}
    #allrecords button{color:#000;font-family:serif}</style>
    ${block}</head>
    <body><div id="allrecords"><div class="t123"><div class="t-container">
    <div class="muaytix-ticket-selector"></div>${extraDiv}
    </div></div></div></body></html>`,{waitUntil:'domcontentloaded'});
  return {p,ctx};
}

console.log('\nLoaded from the site header, page carries only the div');
{
  const {p,ctx}=await tilda();
  await p.waitForSelector('[data-grid] [data-date]',{timeout:9000});
  check('the widget appears', await p.isVisible('.mtx-card'));
  check('calendar drawn from the data', (await p.$$('[data-grid] [data-date]')).length===3);
  check('card panel painted', (await p.$eval('.mtx-card',e=>getComputedStyle(e).backgroundColor))==='rgb(255, 255, 255)');
  await p.click('[data-date="2026-09-05"]');
  await p.waitForSelector('.mtx-pick',{timeout:9000});
  check('night opens', (await p.textContent('.mtx-band-h'))==='RWS Rajadamnern World Series');
  check('all four classes', (await p.$$('.mtx-pick')).length===4);
  await p.click('[data-pick="leo_section"]');
  await p.selectOption('[data-qty]','2');
  check('price shown', (await p.textContent('[data-unit]'))==='$46');
  check('total shown', (await p.textContent('[data-total]'))==='$92');
  const cta=await p.evaluate(()=>{const s=getComputedStyle(document.querySelector('[data-go]'));
    const v=c=>c.match(/\d+/g).slice(0,3).map(Number); const l=x=>0.2126*x[0]+0.7152*x[1]+0.0722*x[2];
    return {d:Math.abs(l(v(s.color))-l(v(s.backgroundColor))), f:s.fontFamily,
            a:getComputedStyle(document.querySelector('.mtx-detail-d')).textAlign};});
  check('reserve button readable', cta.d>100);
  check('our typeface survives', /Barlow/.test(cta.f), cta.f);
  check('text reads left', cta.a==='left', cta.a);
  let went=null;
  await p.route('https://checkout.stripe.com/**', rt=>{went=rt.request().url(); rt.fulfill({status:200,contentType:'text/html',body:'ok'});});
  await p.click('[data-go]');
  await p.waitForURL(/checkout\.stripe\.com/,{timeout:9000});
  check('hands over to Stripe', went!==null);
  await ctx.close();
}

console.log('\nSame block, pointed at one night');
{
  const {p,ctx}=await tilda('<div class="muaytix-ticket-selector" data-event-id="rws_2026_09_05" data-ticket-class="Third Class"></div>');
  await p.waitForSelector('.mtx-detail',{timeout:9000});
  const heads=await p.$$eval('.mtx-detail-h',n=>n.map(x=>x.textContent));
  check('the single-class widget opens on its class', heads.includes('Third Class'), JSON.stringify(heads));
  check('the calendar widget still works alongside it', (await p.$$('[data-grid] [data-date]')).length===3);
  await ctx.close();
}
console.log('\nWhat has to be true of the file itself, before it ever reaches Tilda');
{
  // 5 October 2026: a header that passed every test here, in a real browser, went
  // into the site head and the widget did not appear on any page, while the page
  // around it was untouched. We could not see the live page, so we do not know
  // why. Two things were different about that file from every one we had pasted
  // before, and both are now ruled out for good rather than left to chance:
  // it held a pattern with a double slash in it (a simple tool that tidies
  // scripts can read that as the start of a comment and cut the line short), and
  // it was 67 KB, bigger than anything pasted before. Neither is proven to be the
  // cause. Both are cheap to avoid.
  const vm = await import('node:vm');
  const script = block.slice(block.indexOf('<script>') + 8, block.lastIndexOf('</script>'));
  let parses = true, why = '';
  try { new vm.Script(script); } catch (e) { parses = false; why = e.message; }
  check('the script parses', parses, why);
  check('no double slash inside a pattern (read as a comment by simple tools)',
    !/\\\/\\\//.test(script), 'found an escaped double slash');
  check('the block is under 63,000 bytes (it was 67,345 when it failed, 58,664 when it last worked)',
    Buffer.byteLength(block) < 63000, Buffer.byteLength(block) + ' bytes');
  check('nothing in the block can end the script early', !/<\/script/i.test(script));

  // The shrunk copy must be the same program as widget.js: same tokens in the
  // same order. Needs a JavaScript parser; eslint ships one. Skipped, loudly, if
  // it is not installed.
  let espree = null;
  try {
    const { createRequire } = await import('node:module');
    espree = createRequire(path.join(r, 'eslint', 'index.js'))('espree');
  } catch { /* handled below */ }
  if (!espree) {
    console.log('  skip the shrunk copy is the same program as widget.js (no parser installed)');
  } else {
    const src = fs.readFileSync(new URL('../widget.js', import.meta.url), 'utf8');
    const norm = (t) => t.type + ':' + (t.type === 'String' ? (t.value.includes('#mtx-booking{') ? t.value.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\\n/g, ' ').replace(/\s+/g, ' ').trim() : t.value) : t.value);
    const a = espree.tokenize(src, { ecmaVersion: 'latest' }).map(norm);
    const c = espree.tokenize(script, { ecmaVersion: 'latest' }).map(norm);
    const same = a.length === c.length && a.every((x, i) => x === c[i]);
    check('the shrunk copy is the same program as widget.js, token for token', same,
      same ? '' : 'first difference near token ' + a.findIndex((x, i) => x !== c[i]));
  }
}
await b.close();
console.log('\n'+pass+' passed, '+fail+' failed');
process.exit(fail?1:0);
