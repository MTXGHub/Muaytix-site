/* Reads the locked production copy out of brief.txt into copy.json.
 *
 *   node extract-copy.mjs
 *
 * The copy is not retyped anywhere. gen.mjs renders copy.json by key, and
 * verify.mjs diffs the built page against brief.txt directly.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const LABEL = /^(H1|H2|H3|Body|Primary CTA|Secondary CTA|Section heading|Helper text|Trust row|Operational note|Note|Subheading|CTA|Action|Link destination|(?:Card|Paragraph|Bullet|Question|Answer|Link|Seat line) \d+(?: label| value| heading| body| visible anchor| destination)?):$/;
const out = {};
let sec = null, label = null, block = [];
const flush = () => { if (sec && label && block.length) { (out[sec][label] = out[sec][label] || []).push(block.join(' ')); } block = []; };

for (const raw of readFileSync('brief.txt', 'utf8').split('\n')) {
  const l = raw.trimEnd();
  const h = l.match(/^## (.+)$/);
  if (h) { flush(); sec = h[1]; label = null; out[sec] = {}; continue; }
  if (!sec) continue;
  if (l.trim() === '') { flush(); continue; }
  if (LABEL.test(l.trim())) { flush(); label = l.trim().slice(0, -1); continue; }
  if (/^\[INSERT /.test(l)) { out[sec]._component = l; continue; }
  if (sec === 'BREADCRUMBS') { out[sec]['Text'] = [l]; continue; }
  if (label === null) throw new Error('text before a label in ' + sec + ': ' + l);
  block.push(l.trim());
}
flush();
writeFileSync('copy.json', JSON.stringify(out, null, 2) + '\n');
console.log('sections:', Object.keys(out).length);
