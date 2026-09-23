/* Freezes the clock at real moments and reads back what the page shows.
   The moments that matter are the ones either side of a booking cutoff. */
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
import fs from 'fs';
const CH = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const page = fs.readFileSync('homepage-live.txt', 'utf8');

// [label, UTC instant]. Bangkok is UTC+7.
const MOMENTS = [
  ['Wed 23 Sep 17:29 BKK, one minute before New Power shuts', '2026-09-23T10:29:00Z'],
  ['Wed 23 Sep 17:31 BKK, one minute after New Power shuts',  '2026-09-23T10:31:00Z'],
  ['Wed 23 Sep 20:13 BKK, right now',                          '2026-09-23T13:13:00Z'],
  ['Thu 24 Sep 09:00 BKK, morning of Petchyindee',             '2026-09-24T02:00:00Z'],
  ['Sat 26 Sep 18:41 BKK, one minute after RWS shuts',         '2026-09-26T11:41:00Z'],
  ['Mon 28 Sep 12:00 BKK, All Star day',                       '2026-09-28T05:00:00Z'],
];

const br = await chromium.launch({ executablePath: CH });
for (const [label, iso] of MOMENTS) {
  const ctx = await br.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(`{
    const FIXED = new Date(${JSON.stringify(iso)}).valueOf();
    const R = Date;
    Date = class extends R {
      constructor(...a) { return a.length ? new R(...a) : new R(FIXED); }
      static now() { return FIXED; }
    };
    Date.prototype = R.prototype;
  }`);
  const p = await ctx.newPage();
  await p.setContent('<!doctype html><meta charset=utf-8>' + page, { waitUntil: 'load' });
  const r = await p.evaluate(() => {
    const vis = [...document.querySelectorAll('[data-mtx-week] li')]
      .filter(li => li.offsetParent !== null);
    return {
      shown: vis.map(li => li.querySelector('h3').textContent + ' ' +
        li.querySelector('.mtx-hp__when').textContent.replace(/\s+/g,' ')),
      tonight: (document.querySelector('.mtx-hp__night--now .mtx-hp__tag') || {}).textContent || null,
      hero: (document.querySelector('[data-mtx-tonight]') || {}).textContent,
      heroHref: (document.querySelector('[data-mtx-tonight]') || {}).getAttribute?.('href'),
      sat: (document.querySelector('[data-mtx-saturday]') || {}).getAttribute?.('href'),
    };
  });
  console.log('\n== ' + label);
  console.log('   hero button : ' + r.hero + '  ->  ' + r.heroHref);
  console.log('   this sat    : ' + r.sat);
  console.log('   tonight tag : ' + (r.tonight || 'none'));
  r.shown.forEach((s, i) => console.log('   ' + (i === 0 ? '1st' : '   ') + ' ' + s));
  await ctx.close();
}
await br.close();
