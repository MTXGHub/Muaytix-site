/* Renders the Muay Thai Bangkok Tonight page from copy.json.
 *
 *   node extract-copy.mjs && node gen.mjs && node build.mjs
 *
 * Not one word of visible copy is typed in this file. Every string is looked up
 * in copy.json, which extract-copy.mjs reads out of brief.txt. A missing key
 * stops the build rather than being filled in. This file decides presentation
 * only: structure, classes, which words of a sentence carry a link, and the
 * page address each link goes to.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const C = JSON.parse(readFileSync('copy.json', 'utf8'));
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const all = (sec, label) => { const b = C[sec] && C[sec][label]; if (!b || !b.length) throw new Error(`copy.json has no [${label}] in section ${sec}`); return b; };
const one = (sec, label) => { const b = all(sec, label); if (b.length !== 1) throw new Error(`[${label}] in section ${sec} should be one line`); return b[0]; };

const BOOK = '#mtx-tn-book';
const TIMES = '#mtx-tn-times';
const URL = 'https://muaytix.com/muay-thai-bangkok-tonight';
const WHATSAPP = 'https://wa.me/66922706095';          // the number every other page already links to

/* Which words of a line are a link, and where it goes. The visible text is the
   brief's, untouched: a link only wraps words that are already there, and
   `within` limits the search to one sentence so the same words earlier in the
   line are not caught by mistake. The brief's address list is used in full:
   /rws/schedule /rajadamnern-knockout /new-power-muay-thai /rajadamnern/petchyindee
   /rws /kiatpetch-muay-thai /rajadamnern-stadium-seating /rws/fight-card
   /rajadamnern-knockout/fight-card/ */
function linked(text, rules, cls) {
  let out = '', rest = text;
  const placed = [];
  for (const r of rules) {
    const from = r.within ? text.indexOf(r.within) : 0;
    if (from < 0) throw new Error(`link context not found: ${r.within}`);
    const start = text.indexOf(r.words, from);
    if (start < 0 || (r.within && start >= from + r.within.length)) throw new Error(`link words not found: ${r.words}`);
    placed.push({ start, end: start + r.words.length, href: r.href });
  }
  placed.sort((a, b) => a.start - b.start);
  let at = 0;
  for (const p of placed) {
    if (p.start < at) throw new Error('overlapping links in: ' + text);
    out += esc(text.slice(at, p.start)) + `<a class="${cls}" href="${esc(p.href)}">${esc(text.slice(p.start, p.end))}</a>`;
    at = p.end;
  }
  return out + esc(text.slice(at));
}

const chev = `<svg class="mtx-tn-chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M6 9l6 6 6-6"></path></svg>`;

/* ------------------------------------------------------------------ 2. hero */
const hero = `  <header class="mtx-tn-hero">
    <div class="mtx-tn-wrap mtx-tn-hero-in">
      <h1 class="mtx-tn-h1">${esc(one('2', 'H1'))}</h1>
      <p class="mtx-tn-sub">${esc(one('2', 'Subheadline'))}</p>
      <p class="mtx-tn-hero-body">${esc(one('2', 'Body'))}</p>
      <p class="mtx-tn-detail">${esc(one('2', 'Detail line'))}</p>
      <p class="mtx-tn-cta-row">
        <a class="mtx-tn-btn" href="${BOOK}">${esc(one('2', 'Primary button'))}</a>
        <a class="mtx-tn-btn mtx-tn-btn--ghost" href="${TIMES}">${esc(one('2', 'Secondary button'))}</a>
      </p>
    </div>
  </header>`;

/* ----------------------------------------------------- 5. the table (data) */
const header = one('5', 'Table header').split(' | ');
const rows = all('5', 'Table rows').map(l => {
  const c = l.split(' | ');
  if (c.length !== 5) throw new Error('table row is not five cells: ' + l);
  return c;
});
if (header.length !== 5 || rows.length !== 7) throw new Error('the table should be five columns and seven nights');
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const data = {
  tonight: one('3', 'Label before 7:00 PM Bangkok time'),
  tomorrow: one('3', 'Label from 7:00 PM Bangkok time (shows the next night)'),
  line: one('3', 'Line, filled from the table for the current night'),
  rows: rows.map(r => {
    const day = DAYS.indexOf(r[0]);
    if (day < 0) throw new Error('unknown night: ' + r[0]);
    return { day, night: r[0], event: r[1], doors: r[2], first: r[3] };
  }),
};
/* All Star Monday. The name is read from the brief's own sentence, and the build
   stops if it is not the confirmed one. The rule itself (the last Monday of the
   month, on the Bangkok date of the night shown) runs in the page's script. */
const extraNote = one('5', 'Extra note under table (All Star Monday)');
const allStar = (extraNote.match(/ is (.+?) instead of /) || [])[1];
if (allStar !== 'All Star Fight by Buakaw') throw new Error('All Star name not found in the extra note: ' + allStar);
data.allStar = allStar;
for (const t of ['[Event name]', '[doors time]', '[first bout time]']) if (!data.line.includes(t)) throw new Error('the tonight line has no ' + t);

/* ------------------------------------------------------ 3. the tonight band */
const tonight = `  <section class="mtx-tn-tonight" data-mtx-tn-tonight hidden>
    <div class="mtx-tn-wrap mtx-tn-tonight-in">
      <p class="mtx-tn-t-label"><span class="mtx-tn-dot" aria-hidden="true"></span><span data-tn-label></span></p>
      <p class="mtx-tn-t-line" data-tn-line></p>
    </div>
  </section>`;

/* --------------------------------------------------------- 4. what is on */
const nightLinks = [
  { name: 'Rajadamnern Knockout', href: '/rajadamnern-knockout', cls: '' },
  { name: 'New Power', href: '/new-power-muay-thai', cls: '' },
  { name: 'Petchyindee', href: '/rajadamnern/petchyindee', cls: '' },
  { name: 'RWS Rajadamnern World Series', href: '/rws', cls: ' mtx-tn-night--rws' },
  { name: 'Kiatpetch', href: '/kiatpetch-muay-thai', cls: '' },
];
const on = `  <section class="mtx-tn-sec mtx-tn-sec--paper mtx-tn-sec--on">
    <div class="mtx-tn-wrap">
      <h2 class="mtx-tn-h2">${esc(one('4', 'H2'))}</h2>
      <p class="mtx-tn-lead">${esc(one('4', 'Intro'))}</p>
      <ul class="mtx-tn-nights">
${nightLinks.map((n, i) => {
  const k = i + 1, head = one('4', `Block ${k} headline`);
  return `        <li class="mtx-tn-night${n.cls}"><h3 class="mtx-tn-h3">${linked(head, [{ words: n.name, href: n.href }], 'mtx-tn-link')}</h3><p>${esc(one('4', `Block ${k} body`))}</p></li>`;
}).join('\n')}
      </ul>
    </div>
  </section>`;

/* ----------------------------------------------------------- 5. start times */
const table = `  <section class="mtx-tn-sec mtx-tn-sec--white mtx-tn-sec--times" id="mtx-tn-times">
    <div class="mtx-tn-wrap">
      <h2 class="mtx-tn-h2">${esc(one('5', 'H2'))}</h2>
      <div class="mtx-tn-tablewrap">
        <table class="mtx-tn-table">
          <thead><tr>${header.map(h => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead>
          <tbody>
${rows.map(r => `            <tr data-day="${DAYS.indexOf(r[0])}"><th scope="row">${esc(r[0])}</th>${r.slice(1).map((c, i) => `<td data-label="${esc(header[i + 1])}">${esc(c)}</td>`).join('')}</tr>`).join('\n')}
          </tbody>
        </table>
      </div>
      <p class="mtx-tn-note">${esc(one('5', 'Note under table'))}</p>
      <p class="mtx-tn-note mtx-tn-note--next">${esc(extraNote)}</p>
    </div>
  </section>`;

/* --------------------------------------------------------- 6. choosing a night */
const pickRules = [
  [{ within: 'See the Rajadamnern Knockout nights', words: 'Rajadamnern Knockout nights', href: '/rajadamnern-knockout' }],
  [{ within: 'See New Power and Petchyindee', words: 'New Power', href: '/new-power-muay-thai' },
   { within: 'See New Power and Petchyindee', words: 'Petchyindee', href: '/rajadamnern/petchyindee' }],
  [{ within: 'See the RWS Saturday schedule', words: 'RWS Saturday schedule', href: '/rws/schedule' }],
  [{ within: 'See Kiatpetch', words: 'Kiatpetch', href: '/kiatpetch-muay-thai' }],
];
const choose = `  <section class="mtx-tn-sec mtx-tn-sec--white mtx-tn-sec--choose">
    <div class="mtx-tn-wrap">
      <h2 class="mtx-tn-h2">${esc(one('6', 'H2'))}</h2>
      <p class="mtx-tn-lead">${esc(one('6', 'Intro'))}</p>
      <ul class="mtx-tn-picks">
${pickRules.map((r, i) => {
  const k = i + 1;
  return `        <li class="mtx-tn-pick"><h3 class="mtx-tn-h3">${esc(one('6', `Block ${k} headline`))}</h3><p>${linked(one('6', `Block ${k} body`), r, 'mtx-tn-link')}</p></li>`;
}).join('\n')}
      </ul>
      <p class="mtx-tn-close">${esc(one('6', 'Closing line for the section'))}</p>
    </div>
  </section>`;

/* ----------------------------------------------------------- 7. tickets */
const tix = [['Ringside, from 2,500 THB', 'ringside'], ['Club Class, from 1,800 THB', 'club'], ['LEO Section, from 1,500 THB', 'leo'], ['Third Class, from 1,000 THB', 'third']];
const tickets = `  <section class="mtx-tn-sec mtx-tn-sec--paper mtx-tn-sec--tix">
    <div class="mtx-tn-wrap">
      <h2 class="mtx-tn-h2">${esc(one('7', 'H2'))}</h2>
      <p class="mtx-tn-lead">${esc(one('7', 'Intro'))}</p>
      <ul class="mtx-tn-tix">
${tix.map(([label, key]) => `        <li class="mtx-tn-tick mtx-tn-tick--${key}"><h3 class="mtx-tn-h3">${esc(label)}</h3><p>${esc(one('7', label))}</p></li>`).join('\n')}
      </ul>
      <p class="mtx-tn-close">${linked(one('7', 'Closing line'), [{ words: 'seating guide', href: '/rajadamnern-stadium-seating' }], 'mtx-tn-inline')}</p>
    </div>
  </section>`;

/* ---------------------------------------------------------- 8. how to book */
const how = `  <section class="mtx-tn-sec mtx-tn-sec--white mtx-tn-sec--how">
    <div class="mtx-tn-wrap">
      <h2 class="mtx-tn-h2">${esc(one('8', 'H2'))}</h2>
      <ol class="mtx-tn-steps">
${[1, 2, 3].map(n => `        <li class="mtx-tn-step"><h3 class="mtx-tn-h3">${esc(one('8', `Step ${n} headline`))}</h3><p>${esc(one('8', `Step ${n} body`))}</p></li>`).join('\n')}
      </ol>
      <p class="mtx-tn-support">${linked(one('8', 'Support line'), [{ words: 'WhatsApp Us', href: WHATSAPP }], 'mtx-tn-inline')}</p>
    </div>
  </section>`;

/* --------------------------------------------------------------- 9. FAQs */
const faqs = [1, 2, 3, 4, 5, 6, 7, 8].map(n => ({ q: one('9', `Q${n}`), a: one('9', `A${n}`) }));
const answerRules = {
  4: [{ words: 'RWS fight card', href: '/rws/fight-card' }, { words: 'Rajadamnern Knockout fight card', href: '/rajadamnern-knockout/fight-card/' }],
};
const faq = `  <section class="mtx-tn-sec mtx-tn-sec--paper">
    <div class="mtx-tn-wrap">
      <h2 class="mtx-tn-h2">${esc(one('9', 'H2'))}</h2>
      <div class="mtx-tn-acc">
${faqs.map((f, i) => `        <details class="mtx-tn-det">
          <summary><span class="mtx-tn-q">${esc(f.q)}</span>${chev}</summary>
          <div class="mtx-tn-det-b"><p>${answerRules[i + 1] ? linked(f.a, answerRules[i + 1], 'mtx-tn-inline') : esc(f.a)}</p></div>
        </details>`).join('\n')}
      </div>
    </div>
  </section>`;

/* --------------------------------------------------- 10. final call + widget */
const final = `  <section class="mtx-tn-final">
    <div class="mtx-tn-wrap">
      <h2 class="mtx-tn-h2">${esc(one('10', 'Headline'))}</h2>
      <p class="mtx-tn-cta-row"><a class="mtx-tn-btn mtx-tn-btn--white" href="${BOOK}">${esc(one('10', 'Button'))}</a></p>
    </div>
  </section>`;

const widget = `  <section class="mtx-tn-sec mtx-tn-sec--white mtx-tn-sec--book">
    <div class="mtx-tn-wrap">
      <div class="mtx-tn-widget" id="mtx-tn-book" data-mtx-slot="booking-widget"><div class="muaytix-ticket-selector"></div></div>
    </div>
  </section>`;

const bar = `  <a class="mtx-tn-bar" href="${BOOK}" data-mtx-tn-bar>${esc(one('2', 'Primary button'))}</a>`;

writeFileSync('body.html', [hero, tonight, on, table, choose, tickets, how, faq, final, widget, bar].join('\n\n') + '\n\n');
writeFileSync('tonight-data.json', JSON.stringify(data));

/* ------------------------------------------------------------- FAQPage schema
   Built from the same strings as the visible questions and answers, so the two
   cannot differ. verify.mjs reads the page back and checks it anyway. */
writeFileSync('schema.json', JSON.stringify({
  '@context': 'https://schema.org', '@type': 'FAQPage',
  mainEntity: faqs.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
}, null, 2));

/* ----------------------------------------------------------- page settings */
writeFileSync('TILDA-PAGE-SETTINGS.txt',
`MUAY THAI BANGKOK TONIGHT
Tilda page settings. These are NOT in the HTML block (a block has no head).
Paste them into the page's own settings in Tilda. The text is the brief's, exact.

PAGE ADDRESS (the original address, restored)
  /muay-thai-bangkok-tonight
  Before this is published, check that no redirect still points away from it:
  Cloudflare (Rules, Redirect Rules and Bulk Redirects) and Tilda (the page's own
  settings and Site Settings, Redirects). A leftover redirect stops the page loading.

CANONICAL
  ${URL}

DOCUMENT TITLE
  ${one('1', 'Title')}

META DESCRIPTION
  ${one('1', 'Meta description')}

ROBOTS
  index,follow

OPEN GRAPH
  type        website
  site name   MuayTix
  url         ${URL}
  title       ${one('1', 'Social title')}
  description ${one('1', 'Social description')}
  image       NOT SET. The brief names none. Send the image and I will fill it in.
              I cannot see Tilda's pictures from here.

X (TWITTER) CARD
  card        summary_large_image
  title       ${one('1', 'Social title')}
  description ${one('1', 'Social description')}
  image       NOT SET. Same image as the Open Graph one.

DO NOT ADD: meta keywords, a second title tag, a second canonical, any "today" metadata.
`);
console.log('body.html, tonight-data.json, schema.json, TILDA-PAGE-SETTINGS.txt written');
