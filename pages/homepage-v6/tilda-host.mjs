/* Renders the block the way Tilda actually serves it.
 *
 * Every render until now has been the block on a blank page, where nothing
 * was fighting it. Tilda is not a blank page: it applies its own rules to
 * everything inside a zero block, and the one that matters is that it centres
 * text by matching each element directly, which beats any inherited value
 * however specific the ancestor rule is.
 *
 * widget.js already carries the fix and the note explaining it. The page
 * blocks never got either.
 */
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
import { readFileSync } from 'node:fs';

const TILDA = `
  #allrecords { font-family: Arial, sans-serif; }
  #allrecords * { text-align: center; }
  #allrecords a { text-decoration: none; }
  #allrecords img { max-width: 100%; }
`;
const block = readFileSync('homepage-live.txt', 'utf8');
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:0}${TILDA}</style></head><body><div id="allrecords">${block}</div></body></html>`;

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await p.setContent(html, { waitUntil: 'load' });

const r = await p.evaluate(() => {
  const check = (sel, want) => {
    const e = document.querySelector(sel);
    if (!e) return `${sel}  MISSING`;
    const got = getComputedStyle(e).textAlign;
    return `${got === want ? 'ok  ' : 'WRONG'}  ${sel.padEnd(34)} ${got} (should be ${want})`;
  };
  return [
    check('.mtx-hp__hero h1', 'left'),
    check('.mtx-hp__lede', 'left'),
    check('.mtx-hp__night-name', 'left'),
    check('.mtx-hp__night-times', 'left'),
    check('.mtx-hp__hook', 'left'),
    check('.mtx-hp__event-copy', 'left'),
    check('.mtx-hp__trust-copy', 'left'),
    check('.mtx-hp__step p', 'left'),
    check('.mtx-hp__support p', 'left'),
    check('.mtx-hp__faq summary h3', 'left'),
    check('.mtx-hp__close h2', 'center'),
  ];
});
r.forEach(l => console.log('  ' + l));
const bad = r.filter(l => l.startsWith('WRONG')).length;
console.log(`\n  ${bad} of ${r.length} elements are aligned the wrong way once Tilda's own rules apply.`);
await p.screenshot({ path: 'tilda-1280.jpg', type: 'jpeg', quality: 55, fullPage: false });
await browser.close();
