/* Runs the brief's own checklist against the file Jason pastes, in a browser,
   so the counts are what a reader sees rather than what the source contains. */
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
import fs from 'fs';
const CH = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const raw = fs.readFileSync('homepage-live.txt', 'utf8');
const fonts = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;600;700&family=Barlow+Condensed:wght@700;800&display=swap">';
const doc = '<!doctype html><meta charset="utf-8"><meta name=viewport content="width=device-width,initial-scale=1">' + fonts + raw;

const br = await chromium.launch({ executablePath: CH });
const p = await br.newPage({ viewport: { width: 1280, height: 900 } });
await p.setContent(doc, { waitUntil: 'load' });

const r = await p.evaluate(() => {
  const clone = document.body.cloneNode(true);
  clone.querySelectorAll('script,style').forEach(n => n.remove());
  // innerText hides collapsed <details>; textContent is what is in the DOM,
  // which is what the brief counts and what a crawler reads.
  const text = clone.textContent.replace(/\s+/g, ' ').trim();
  const low = text.toLowerCase();
  const n = (s) => (low.match(new RegExp(s, 'g')) || []).length;

  const alts = [...document.querySelectorAll('.mtx-hp img')].map(i => i.alt);
  const altText = alts.join(' ').toLowerCase();

  const hs = [...document.querySelectorAll('.mtx-hp h1,.mtx-hp h2,.mtx-hp h3')]
    .map(h => h.tagName + ' ' + h.textContent.trim());

  const links = [...document.querySelectorAll('.mtx-hp a[href]')]
    .map(a => [a.textContent.trim().replace(/\s+/g, ' '), a.getAttribute('href')]);

  return {
    sections: document.querySelectorAll('.mtx-hp > section').length,
    headings: hs,
    h1: document.querySelectorAll('.mtx-hp h1').length,
    copy_RajadamnernStadium: n('rajadamnern stadium'),
    copy_Bangkok: n('bangkok'),
    copy_ticketPartner: n('international ticket partner'),
    copy_official: n('official'),
    alt_official: (altText.match(/official/g) || []).length,
    alt_RajadamnernStadium: (altText.match(/rajadamnern stadium/g) || []).length,
    alt_Bangkok: (altText.match(/bangkok/g) || []).length,
    emDash: (text.match(/—/g) || []).length,
    bookYourSeat: n('book your seat'),
    bookTickets: n('book tickets'),
    scarcity: ['selling fast', 'limited', '% booked', 'hurry', 'last few'].filter(w => low.includes(w)),
    timescales: ['within 60', 'within 24', 'by noon', 'within 15', 'minutes of'].filter(w => low.includes(w)),
    singhaInCopy: n('singha'),
    widget: document.querySelectorAll('#mtx-booking, .muaytix-ticket-selector, [data-mtx-event]').length,
    weekCards: document.querySelectorAll('[data-mtx-week] [data-mtx-date]').length,
    firstCardIsTonight: !!document.querySelector('[data-mtx-week] li:first-child .mtx-hp__tag'),
    firstCardName: (document.querySelector('[data-mtx-week] li:first-child h3') || {}).textContent,
    rwsButtons: document.querySelectorAll('.mtx-hp__btnrow .mtx-hp__btn').length,
    rwsTextLinks: document.querySelectorAll('.mtx-hp__aftercta a').length,
    promoterCards: document.querySelectorAll('.mtx-hp__evs .mtx-hp__ev').length,
    rwsCardInBlock6: [...document.querySelectorAll('.mtx-hp__evs h3')].some(h => /RWS|World Series/i.test(h.textContent)),
    seatCards: document.querySelectorAll('.mtx-hp__grid .mtx-hp__card').length,
    trustCards: document.querySelectorAll('.mtx-hp__trustcard').length,
    faqItems: document.querySelectorAll('.mtx-hp__faq details').length,
    faqOpenByDefault: document.querySelectorAll('.mtx-hp__faq details[open]').length,
    imagesLazy: [...document.querySelectorAll('.mtx-hp img')].every(i => i.loading === 'lazy'),
    jsonld: document.querySelectorAll('script[type="application/ld+json"]').length,
    links,
    whatsapp: links.filter(([, h]) => h.includes('wa.me')).map(([, h]) => h),
  };
});

// Every width the brief and the phones care about.
const widths = [];
for (const w of [1440, 1280, 1024, 860, 620, 390, 380]) {
  const pg = await br.newPage({ viewport: { width: w, height: 900 } });
  await pg.setContent(doc, { waitUntil: 'load' });
  const over = await pg.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  widths.push(w + 'px overflow=' + over);
  await pg.close();
}
r.overflow = widths;

console.log(JSON.stringify(r, null, 1));
await br.close();
