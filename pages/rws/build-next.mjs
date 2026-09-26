/* Builds the next RWS dated page from the 26 September one.
 *   node build-next.mjs
 *
 * Every change is listed here, so the diff against the source page is
 * auditable line by line. Nothing is rewritten by hand in a 46 KB file.
 *
 * Two things on the 26 September page are specific to that night and were NOT
 * supplied for 3 October: the bout count ("seven") and the headline bout.
 * Neither is invented. Both are removed and reported, and the removals are the
 * minimum edit that leaves the owner's own sentence standing. */
import { readFileSync, writeFileSync } from 'node:fs';

const SRC = 'rws-2026-09-26-live.txt';
const OUT = 'rws-2026-10-03-live.txt';
const PASTE = 'RWS-03-OCT-PASTE-INTO-TILDA.html';

let s = readFileSync(SRC, 'utf8');
const reports = [];
const applied = [];

function sub(from, to, why) {
  const before = s;
  s = s.split(from).join(to);
  const n = (before.length - s.length) / (from.length - to.length) || 0;
  const count = before.split(from).length - 1;
  if (count === 0) throw new Error(`Nothing matched: ${from}`);
  applied.push(`${count}x  ${why}`);
}

/* ---- the date itself ---------------------------------------------------- */
sub('data-night="2026-09-26"', 'data-night="2026-10-03"', 'the night the page drives itself from');
sub('rws_2026_09_26', 'rws_2026_10_03', 'the booking widget event key');
sub('Saturday 26 September 2026', 'Saturday 3 October 2026', 'long date');
sub('Saturday 26 September', 'Saturday 3 October', 'long date, no year');
sub('Sat 26 Sep 2026', 'Sat 3 Oct 2026', 'short date');
sub('26 September', '3 October', 'bare date');
sub('2026-09-26T19:10:00+07:00', '2026-10-03T19:10:00+07:00', 'schema start');
sub('2026-09-26T22:00:00+07:00', '2026-10-03T22:00:00+07:00', 'schema end');
sub('2026-09-26T18:00:00+07:00', '2026-10-03T18:00:00+07:00', 'schema doors');
sub('/rws/2026-09-26', '/rws/2026-10-03', 'schema and canonical URLs');

/* ---- the bout count ----------------------------------------------------- */
/* "Seven professional bouts" is a fact about 26 September. No count has been
 * supplied for 3 October, so each mention is cut and the sentence closed up
 * using the owner's own words from elsewhere on the page. */
sub('3 October at Rajadamnern Stadium brings seven professional Muay Thai bouts under the RWS format, with',
    '3 October at Rajadamnern Stadium runs under the RWS format, with',
    'hero: the unverified bout count removed');
sub('<li><strong>Seven professional bouts</strong><span>Scores shown after every round</span></li>',
    '<li><strong>Regular bouts three rounds</strong><span>Championship contests five</span></li>',
    'facts tile: bout count replaced with the round format already stated on the page');
sub('Rajadamnern Stadium hosts seven professional bouts with Thai and international fighters on the same card.',
    'Rajadamnern Stadium hosts Thai and international fighters on the same card.',
    'event section: the unverified bout count removed');
sub('Every seat class watches the same seven bouts.',
    'Every seat class watches the same card.',
    'seating section: the unverified bout count removed');
sub('"description": "Seven professional Muay Thai bouts at Rajadamnern Stadium, Bangkok. Doors 6:00 PM, first bout 7:10 PM. Scores shown after every round.",',
    '"description": "Rajadamnern World Series at Rajadamnern Stadium, Bangkok. Doors 6:00 PM, first bout 7:10 PM. Scores shown after every round.",',
    'schema description: the unverified bout count removed');
sub("// 2026-09-26", "// 2026-10-03", 'the comment in the script that names the night');
reports.push('No bout count was supplied for 3 October, so the four "seven professional bouts" claims are gone. Send me the number and they go back in.');

/* ---- the headline bout -------------------------------------------------- */
/* Marie Ruumet v Desiree Wodicker was 26 September's bout. Nothing has been
 * supplied for 3 October, so the whole section goes rather than carrying last
 * week's fighters, or a placeholder, onto a new date. */
const h2 = s.indexOf("<h2>Saturday's headline bout</h2>");
if (h2 === -1) throw new Error('Headline bout section not found.');
const start = s.lastIndexOf('  <section', h2);
const end = s.indexOf('  </section>', h2) + '  </section>\n'.length;
if (start === -1 || end < start) throw new Error('Could not bound the headline bout section.');
s = s.slice(0, start) +
    '  <!-- The headline bout section is removed: no fight card has been supplied\n' +
    '       for 3 October, and last week\u2019s fighters are not this week\u2019s. -->\n\n' +
    s.slice(end);
applied.push('1x  headline bout section removed');
reports.push('No fight card supplied for 3 October, so the headline bout section is removed. Last week’s fighters are not carried over and no placeholder is invented. Send the card and it goes back.');

/* Removing the headline bout left the timeline and the seating sections both
 * on paper, running together as one band with no break between them. */
sub('<section class="mtx-rws__band mtx-rws__band--paper" id="seating">',
    '<section class="mtx-rws__band" id="seating">',
    'seating band re-alternated after the removal above');

writeFileSync(OUT, s);
writeFileSync(PASTE, s);
console.log(applied.join('\n'));
console.log(`\n${(s.length/1024).toFixed(1)} KB -> ${OUT} and ${PASTE}`);
console.log('\nREPORTED:');
reports.forEach(r => console.log('  - ' + r));
writeFileSync('reports-03-oct.txt', reports.join('\n') + '\n');
