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
reports.push('Three bouts were supplied for 3 October, not the whole card, so the page shows the three posters and states no bout count anywhere. The alt text is yours, word for word.');
reports.push('Your poster reads AMURLEN TUGUROV. The alt text you sent spells it Tuguurov, with a double u. It is published exactly as you sent it. Tell me which is right and I will correct it.');
reports.push('The link to the RWS Fight Card page was inside the old headline bout section and is not put back, because I cannot see whether that page carries the 3 October card. Say the word and it goes in.');


/* ---- the 3 October posters ---------------------------------------------- */
/* URLs, fighter names, bout types and alt text all supplied by the owner on
 * 26 September. The alt text is his, word for word, not rewritten here. */
const POSTERS = [
  { url: 'https://static.tildacdn.com/tild3165-3563-4139-a463-356132623134/1000034441.jpg', w: 985, h: 1229,
    alt: 'RWS Muay Thai fight poster featuring Thananchai vs ThanuPetch in a middleweight bout at Rajadamnern Stadium, Bangkok, on Saturday 3 October 2026.' },
  { url: 'https://static.tildacdn.com/tild6235-6437-4161-b663-336531643663/1000034440.jpg', w: 988, h: 1229,
    alt: 'RWS Muay Thai fight poster featuring Singburi vs Amurlen Tuguurov in a 113 lb catchweight bout at Rajadamnern Stadium, Bangkok, on Saturday 3 October 2026.' },
  { url: 'https://static.tildacdn.com/tild6634-6438-4130-a663-393938633465/1000034439.jpg', w: 995, h: 1226,
    alt: 'RWS Muay Thai fight poster featuring Anastasia Tikhonova vs Taylor McClatchie in a female featherweight bout at Rajadamnern Stadium, Bangkok, on Saturday 3 October 2026.' },
];

/* Dimensions are measured off the three supplied files, not guessed, so the
 * browser reserves the right box and the row does not jump as they load.
 * The heading is the page's own removed heading with one letter changed, and
 * the closing note is the page's own note, moved across word for word. Three
 * bouts have been supplied, not the whole card, so no count is stated. */
const bouts = `  <section class="mtx-rws__band">
    <div class="mtx-rws__shell">
      <span class="mtx-rws__kicker"><span class="mtx-rws-v-tonight">Tonight</span><span class="mtx-rws-v-default">This Saturday</span> &middot; Sat 3 Oct 2026</span>
      <h2>Saturday's headline bouts</h2>

      <ul class="mtx-rws__posters">
${POSTERS.map(x => `        <li><img src="${x.url}" alt="${x.alt.replace(/"/g, '&quot;')}" width="${x.w}" height="${x.h}" loading="lazy" decoding="async"></li>`).join('\n')}
      </ul>

      <p class="mtx-rws__note">Fighters and running order are as announced by Rajadamnern Stadium and may be subject to late change.</p>
    </div>
  </section>

`;
s = s.replace('  <!-- The headline bout section is removed: no fight card has been supplied\n' +
              '       for 3 October, and last week\u2019s fighters are not this week\u2019s. -->\n\n', bouts);
applied.push('1x  three supplied bout posters put in where the old headline bout was');

/* The poster grid. Doubled class on the image because .mtx-rws img is set
 * elsewhere, and the width/height attributes above arrive as presentational
 * hints that beat a weaker rule. */
sub('.mtx-rws__grid { display: grid;',
    `.mtx-rws__posters { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; margin-top: 30px; padding-left: 0; list-style: none; align-items: start; }
.mtx-rws__posters li { margin: 0; }
.mtx-rws .mtx-rws__posters img { display: block; width: 100%; max-width: 100%; height: auto; border: 1px solid rgba(255,255,255,.14); }
@media (max-width: 860px) { .mtx-rws__posters { grid-template-columns: 1fr; max-width: 460px; } }
.mtx-rws__grid { display: grid;`,
    'poster grid styles');

/* The bouts section above is a plain band, so seating stays on paper exactly
 * as the 26 September page had it. Nothing to re-alternate. */

writeFileSync(OUT, s);
writeFileSync(PASTE, s);
console.log(applied.join('\n'));
console.log(`\n${(s.length/1024).toFixed(1)} KB -> ${OUT} and ${PASTE}`);
console.log('\nREPORTED:');
reports.forEach(r => console.log('  - ' + r));
writeFileSync('reports-03-oct.txt', reports.join('\n') + '\n');
