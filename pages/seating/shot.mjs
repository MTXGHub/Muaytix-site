import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw; import fs from 'fs';
const fonts = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;600;700&family=Barlow+Condensed:wght@700;800&display=swap">';
const doc = '<!doctype html><meta charset="utf-8"><meta name=viewport content="width=device-width,initial-scale=1">' + fonts + fs.readFileSync('seats-live.txt','utf8');
const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

for (const [name,w] of [['desk',1440],['phone',390]]) {
  const p = await br.newPage({ viewport:{width:w,height:900} });
  await p.setContent(doc, { waitUntil:'load' });
  await p.screenshot({ path:`seats-${name}.jpg`, fullPage:true, type:'jpeg', quality:72 });
  console.log(name, w+'px,', await p.evaluate(()=>document.documentElement.scrollHeight)+'px tall');
  await p.close();
}

// The sticky button must be away above the widget, away while the widget is on
// screen, and only there once the widget has gone past.
const p = await br.newPage({ viewport:{width:390,height:844} });
await p.setContent(doc, { waitUntil:'load' });
const state = async () => p.evaluate(() => {
  const el = document.querySelector('.mtx-ss__sticky');
  const r = el.getBoundingClientRect();
  return document.querySelector('.mtx-ss').getAttribute('data-sticky') + '  (on screen: '
    + (r.top < window.innerHeight - 4 ? 'yes' : 'no') + ')';
});
console.log('\nsticky button:');
console.log('  at the top of the page        ', await state());
await p.evaluate(() => document.getElementById('book').scrollIntoView());
await p.waitForTimeout(350);
console.log('  with the widget on screen     ', await state());
await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await p.waitForTimeout(350);
console.log('  at the foot, widget passed    ', await state());
await br.close();
