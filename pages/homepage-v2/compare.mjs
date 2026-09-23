/* Proves the single block renders the same as the two blocks it replaces.
   Every element is fingerprinted by its computed styles, so a rule lost in
   the stylesheet merge shows up as a difference rather than passing quietly. */
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
import fs from 'fs';
const CH = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const shared = fs.readFileSync('_shared.css','utf8');
const head = '<!doctype html><meta charset="utf-8"><meta name=viewport content="width=device-width,initial-scale=1">'
  + `<style>${shared}</style>`;

const two = head + fs.readFileSync('homepage-block-A-live.txt','utf8')
                 + fs.readFileSync('homepage-block-B-live.txt','utf8');
const one = head + fs.readFileSync('homepage-FULL-live.txt','utf8');

const PROPS = ['display','color','backgroundColor','fontSize','fontWeight','fontFamily',
  'textTransform','letterSpacing','lineHeight','marginTop','marginBottom','paddingTop',
  'paddingBottom','paddingLeft','paddingRight','gridTemplateColumns','width','minHeight','borderColor'];

async function fingerprint(page, doc) {
  await page.setContent(doc, { waitUntil: 'load' });
  return page.evaluate((PROPS) => {
    const out = [];
    // The block wrappers themselves are skipped: two blocks carry two of
    // them and the merged block carries one, which is the whole point of
    // the merge and would otherwise knock every later element out of step.
    for (const el of document.querySelectorAll('.mtx-hp *')) {
      if (el.tagName === 'STYLE' || el.tagName === 'SCRIPT') continue;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      out.push([
        el.tagName + '.' + (el.className || ''),
        (el.textContent || '').trim().slice(0, 40).replace(/\s+/g, ' '),
        PROPS.map(p => cs[p]).join('|'),
        Math.round(r.width) + 'x' + Math.round(r.height),
      ].join(' ~ '));
    }
    return out;
  }, PROPS);
}

const br = await chromium.launch({ executablePath: CH });
let bad = 0;
for (const w of [1280, 860, 620, 390]) {
  const p = await br.newPage({ viewport: { width: w, height: 900 } });
  const a = await fingerprint(p, two);
  const b = await fingerprint(p, one);
  // "On this week" is deliberately gone from the one-block build.
  const aKept = a.filter(l => !/on-this-week|On this week|Every night is a different event/.test(l));
  const diffs = [];
  for (let i = 0; i < Math.max(aKept.length, b.length); i++) {
    if (aKept[i] !== b[i]) diffs.push(`  @${i}\n    two: ${aKept[i]}\n    one: ${b[i]}`);
  }
  console.log(`${w}px  elements two=${aKept.length} one=${b.length}  diffs=${diffs.length}`);
  if (diffs.length) { bad++; console.log(diffs.slice(0, 6).join('\n')); }
  await p.close();
}
await br.close();
console.log(bad ? 'MISMATCH' : 'identical at every width');
