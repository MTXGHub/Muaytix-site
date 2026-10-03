/* Reads the locked production copy out of brief.txt into copy.json.
 *
 *   node extract-copy.mjs
 *
 * Nothing is retyped. gen.mjs renders copy.json by key, and verify.mjs diffs the
 * built page against brief.txt directly.
 */
import { readFileSync, writeFileSync } from 'node:fs';

/* A label is a short line that ends in a colon and has no full stop in it. */
const LABEL = /^[A-Z][A-Za-z0-9\- ]{0,40}:$/;
const out = {};
let sec = null, label = null, block = [];
const flush = () => { if (sec && label && block.length) (out[sec][label] = out[sec][label] || []).push(block); block = []; };

for (const raw of readFileSync('brief.txt', 'utf8').split('\n')) {
  const l = raw.trimEnd();
  const h = l.match(/^## (.+)$/);
  if (h) { flush(); sec = h[1]; label = null; out[sec] = {}; continue; }
  if (!sec) continue;
  if (l.trim() === '') { flush(); continue; }
  if (LABEL.test(l.trim())) { flush(); label = l.trim().slice(0, -1); continue; }
  if (sec === '1 BREADCRUMBS') { out[sec].Text = [[l.trim()]]; continue; }
  if (label === null) throw new Error('text before a label in ' + sec + ': ' + l);
  block.push(l.trim());
}
flush();
writeFileSync('copy.json', JSON.stringify(out, null, 2) + '\n');
console.log('sections:', Object.keys(out).length);
