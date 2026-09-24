/* Checks the file Jason pastes against Part 5 and Part 13 of the brief. */
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw; import fs from 'fs';
const fonts = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;600;700&family=Barlow+Condensed:wght@700;800&display=swap">';
const doc = '<!doctype html><meta charset="utf-8"><meta name=viewport content="width=device-width,initial-scale=1">' + fonts
  + fs.readFileSync('seats-live.txt','utf8');

const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await br.newPage({ viewport: { width: 1280, height: 900 } });
await p.setContent(doc, { waitUntil: 'load' });

const r = await p.evaluate(() => {
  const clone = document.body.cloneNode(true);
  clone.querySelectorAll('script,style').forEach(n => n.remove());
  const text = clone.textContent.replace(/\s+/g,' ').trim();
  const low = text.toLowerCase();
  const hs = [...document.querySelectorAll('.mtx-ss h1,.mtx-ss h2,.mtx-ss h3')].map(h => h.tagName + ' ' + h.textContent.trim());
  const links = [...document.querySelectorAll('.mtx-ss a[href]')].map(a => [a.textContent.trim().replace(/\s+/g,' '), a.getAttribute('href')]);
  const imgs = [...document.querySelectorAll('.mtx-ss img')];
  return {
    h1: document.querySelectorAll('.mtx-ss h1').length,
    h1text: (document.querySelector('.mtx-ss h1')||{}).textContent,
    sections: document.querySelectorAll('.mtx-ss > section').length,
    headings: hs,
    anchors: ['compare','book','rows'].map(a => a + '=' + (document.getElementById(a) ? 'yes' : 'NO')),
    cards: document.querySelectorAll('.mtx-ss__card').length,
    views: document.querySelectorAll('.mtx-ss__view').length,
    picks: document.querySelectorAll('.mtx-ss__pick').length,
    rowLines: document.querySelectorAll('.mtx-ss__rows li').length,
    knowBullets: document.querySelectorAll('.mtx-ss__know li').length,
    faqs: document.querySelectorAll('.mtx-ss__faq details').length,
    faqOpen: document.querySelectorAll('.mtx-ss__faq details[open]').length,
    faqTextInHtml: [...document.querySelectorAll('.mtx-ss__faq details p')].every(x => x.textContent.trim().length > 40),
    widget: document.querySelectorAll('.muaytix-ticket-selector').length,
    widgetSeatsFirst: (document.querySelector('.muaytix-ticket-selector')||{}).getAttribute?.('data-start'),
    official: (low.match(/official/g)||[]).length,
    emDash: (text.match(/—/g)||[]).length,
    alcoholBrand: ['singha','chang beer','leo beer'].filter(w => low.includes(w)),
    bookYourSeat: (low.match(/book your seat/g)||[]).length,
    imgsWithDims: imgs.filter(i => i.getAttribute('width') && i.getAttribute('height')).length,
    imgsTotal: imgs.length,
    imgsLazy: imgs.filter(i => i.loading === 'lazy').length,
    crumbs: document.querySelectorAll('.mtx-ss__crumbs li').length,
    links,
    jsonld: document.querySelectorAll('script[type="application/ld+json"]').length,
    stickyHidden: getComputedStyle(document.querySelector('.mtx-ss__sticky')).display,
  };
});

const widths = [];
for (const w of [1440,1280,1024,860,620,390,380]) {
  const pg = await br.newPage({ viewport: { width: w, height: 900 } });
  await pg.setContent(doc, { waitUntil: 'load' });
  widths.push(w + ':' + await pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth));
  await pg.close();
}
r.overflow = widths.join('  ');
console.log(JSON.stringify(r, null, 1));
await br.close();
