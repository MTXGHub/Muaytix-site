/* Reads Part B of brief.txt into copy.json. Nothing is typed by hand: every
 * string the page shows comes out of the brief through this file.
 *
 *   node extract-copy.mjs && node gen.mjs && node build.mjs
 *
 * Part B is a numbered list of sections ("4. WHAT IS ON"). Inside a section a
 * line that ends with a colon is a label and the lines after it, up to the next
 * label, are its text. No sentence of copy ends with a colon, and this stops
 * the build if one ever does.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const raw = readFileSync('brief.txt', 'utf8').replace(/\r\n/g, '\n');
const at = raw.indexOf('PART B. COPY (PASTE READY)');
if (at < 0) throw new Error('Part B was not found in brief.txt');
const partB = raw.slice(at).split('\n').slice(2);          // drop the heading and its rule

const copy = {};
let sec = null, label = null;
for (const line of partB) {
  const head = line.match(/^(\d+)\. ([A-Z][A-Z ]+)(?: \(.*\))?$/);
  if (head) { sec = head[1]; copy[sec] = { _name: head[2].trim() }; label = null; continue; }
  if (sec === null || line.trim() === '') continue;
  if (line.trimEnd().endsWith(':')) { label = line.trimEnd().slice(0, -1); copy[sec][label] = []; continue; }
  if (label === null) throw new Error(`Text before any label in section ${sec}: ${line}`);
  copy[sec][label].push(line.trimEnd());
}
writeFileSync('copy.json', JSON.stringify(copy, null, 2) + '\n');
console.log('copy.json written:', Object.keys(copy).length, 'sections,', Object.values(copy).reduce((n, s) => n + Object.keys(s).length - 1, 0), 'labels');
