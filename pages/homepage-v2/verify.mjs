/* Checks the LIVE blocks — the exact text Jason pastes — not the sources. */
import { chromium } from 'playwright';
import fs from 'fs';
const CH = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const shared = fs.readFileSync('_shared.css','utf8');
const doc = '<!doctype html><meta charset="utf-8"><meta name=viewport content="width=device-width,initial-scale=1">'
  + `<style>${shared}</style>`
  + fs.readFileSync('homepage-block-A-live.txt','utf8')
  + fs.readFileSync('homepage-block-B-live.txt','utf8');

const br = await chromium.launch({ executablePath: CH });
const p = await br.newPage({ viewport:{width:390,height:844}, deviceScaleFactor:2 });
await p.setContent(doc, { waitUntil:'load' });

const r = await p.evaluate(() => {
  const vis = (el) => el.offsetParent !== null || el.getClientRects().length;
  // Body words a guest actually reads: no JSON-LD, no alt text, no code.
  const clone = document.body.cloneNode(true);
  clone.querySelectorAll('script,style').forEach(n => n.remove());
  const text = clone.innerText.replace(/\s+/g,' ').trim();
  const count = (s) => (text.toLowerCase().match(new RegExp(s,'g')) || []).length;

  // Any button label that wrapped onto a second line.
  const wrapped = [...document.querySelectorAll('.mtx-hp__btn')].filter(b => {
    const lh = parseFloat(getComputedStyle(b).fontSize) * 1.3;
    return b.getBoundingClientRect().height > 52 + lh * 0.5;
  }).map(b => b.textContent.trim());

  // Every destination, to catch two CTAs pointing at the same page.
  const hrefs = [...document.querySelectorAll('.mtx-hp a[href]')].map(a => a.getAttribute('href'));
  const dupes = hrefs.filter((h,i) => hrefs.indexOf(h) !== i);

  return {
    words: text.split(' ').length,
    rajadamnernStadium: count('rajadamnern stadium'),
    bangkok: count('bangkok'),
    ticketPartner: count('international ticket partner'),
    emDash: (text.match(/—/g)||[]).length,
    official: count('official'),
    allStar: count('all star'),
    whatsapp: count('whatsapp'),
    widget: document.querySelectorAll('#mtx-booking, [data-mtx]').length,
    cards: document.querySelectorAll('.mtx-hp__ev').length,
    cardBtns: document.querySelectorAll('.mtx-hp__evcta .mtx-hp__btn').length,
    wrappedBtns: wrapped,
    dupeHrefs: [...new Set(dupes)],
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
});
console.log(JSON.stringify(r, null, 2));
await br.close();
