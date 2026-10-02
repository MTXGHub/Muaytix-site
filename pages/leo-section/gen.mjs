/* Renders the LEO Section page from copy.json.
 *
 *   node extract-copy.mjs && node gen.mjs && node build.mjs
 *
 * Brief rule 1: the copy is final. Not one word of it is typed in this file.
 * Every visible string is looked up in copy.json, which extract-copy.mjs
 * reads out of brief.txt, and a missing key stops the build rather than being
 * filled in. What this file decides is presentation: structure, classes,
 * order within a section's own blocks, and nothing else.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const C = JSON.parse(readFileSync('copy.json', 'utf8'));
const S = C.sections;

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function blocks(sec, label) {
  const b = S[sec] && S[sec][label];
  if (!b || !b.length) throw new Error(`copy.json has no [${label}] in section ${sec}`);
  return b;
}
const one = (sec, label) => blocks(sec, label)[0][0];
const paras = (sec, label) => blocks(sec, label).map(b => b.join(' '));
const tile = (sec, n) => { const b = blocks(sec, `Tile ${n}`)[0]; return { head: b[0], text: b[1] }; };

/* Where the destinations are. All of them already exist on the live site. */
const DEST = {
  book: '#mtx-leo-book',
  seatMap: '/rajadamnern-stadium-seat-map',
  tickets: '/rajadamnern-stadium-tickets',
  seating: '/rajadamnern-stadium-seating',
  club: '/rajadamnern-stadium-seating/club-class',
  ringside: '/rajadamnern-stadium-seating/ringside',
  third: '/rajadamnern-stadium-seating/third-class',
};

/* Pictures. All four are already on the Tilda CDN from the earlier LEO page.
   The alt text is the brief's own, build note 4, word for word. */
const IMG = {
  hero:  { url: 'https://static.tildacdn.com/tild6537-3330-4365-b135-643437306534/1000034569.jpg', w: 1690, h: 900,
           alt: 'LEO Section Rajadamnern Stadium, Section 10 seating' },
  front: { url: 'https://static.tildacdn.com/tild6339-6239-4433-b062-343862316332/1000033687.jpg', w: 1024, h: 1024,
           alt: 'View from the front row of LEO Section Rajadamnern Stadium' },
  back:  { url: 'https://static.tildacdn.com/tild6530-3266-4262-b265-633965366163/1000008588.jpg', w: 1024, h: 1024,
           alt: 'View from Row G in LEO Section at Rajadamnern Stadium' },
  bench: { url: 'https://static.tildacdn.com/tild3136-6363-4533-b935-633230626564/1000008294.jpg', w: 1024, h: 1024,
           alt: 'LEO Section bench seating, Section 10, Rajadamnern Stadium' },
};
/* Brief rule 5 and the alt-text rule: the brief's alt lines must be the ones
   in brief.txt. Checked here so a drift stops the build. */
const briefText = readFileSync('brief.txt', 'utf8');
for (const [k, v] of Object.entries(IMG))
  if (!briefText.includes(`"${v.alt}"`)) throw new Error(`alt text for ${k} is not the brief's own line`);

const img = (k, { eager = false } = {}) =>
  `<img class="mtx-leo-img" src="${esc(IMG[k].url)}" alt="${esc(IMG[k].alt)}" width="${IMG[k].w}" height="${IMG[k].h}" ${eager ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"'} decoding="async">`;

const BOOK_LABEL_1 = one('1', 'Primary CTA');
const btn = (label, cls = '') =>
  `<a class="mtx-leo-btn${cls ? ' ' + cls : ''}" href="${DEST.book}">${esc(label)}</a>`;

/* ============================== 1. HERO ============================== */

const facts = blocks('1', 'Fact strip')[0].map(l => {
  const i = l.indexOf(': ');
  if (i < 0) throw new Error(`fact line has no colon: ${l}`);
  return { label: l.slice(0, i), value: l.slice(i + 2) };
});
if (facts.length !== 5) throw new Error('the fact strip must have five cells');

/* The colon belongs to the copy, so it is in the text and hidden from the eye
   rather than dropped. */
const hero = `  <header class="mtx-leo-hero">
    ${img('hero', { eager: true }).replace('mtx-leo-img', 'mtx-leo-hero-img')}
    <div class="mtx-leo-hero-wash" aria-hidden="true"></div>
    <div class="mtx-leo-wrap mtx-leo-hero-in">
      <p class="mtx-leo-kicker">${esc(one('1', 'Kicker'))}</p>
      <h1 class="mtx-leo-h1">${esc(one('1', 'H1'))}</h1>
      <p class="mtx-leo-sub">${esc(one('1', 'Subheading'))}</p>
      <div class="mtx-leo-intro">
${paras('1', 'Intro').map(p => `        <p>${esc(p)}</p>`).join('\n')}
      </div>
      <dl class="mtx-leo-facts">
${facts.map(f => `        <div class="mtx-leo-fact"><dt>${esc(f.label)}<span class="mtx-leo-sr">:</span></dt> <dd>${esc(f.value)}</dd></div>`).join('\n')}
      </dl>
      <p class="mtx-leo-cta-row">${btn(BOOK_LABEL_1)}</p>
      <p class="mtx-leo-link-row"><a class="mtx-leo-link" href="${DEST.seatMap}">${esc(one('1', 'Secondary link'))}</a></p>
    </div>
  </header>`;

/* ============================ 2. WHY LEO ============================ */

const tiles = (sec, n) => Array.from({ length: n }, (_, i) => {
  const t = tile(sec, i + 1);
  return `        <li class="mtx-leo-tile">
          <h3 class="mtx-leo-h3">${esc(t.head)}</h3>
          <p>${esc(t.text)}</p>
        </li>`;
}).join('\n');

const why = `  <section class="mtx-leo-sec mtx-leo-sec--off">
    <div class="mtx-leo-wrap">
      <h2 class="mtx-leo-h2">${esc(one('2', 'H2'))}</h2>
      <ul class="mtx-leo-tiles mtx-leo-tiles--four">
${tiles('2', 4)}
      </ul>
    </div>
  </section>`;

/* ============================ 3. BOOKING ============================ */

/* The widget is not rebuilt here. This is the slot the existing MuayTix
   booking widget mounts into. The wrapper carries the anchor every Book LEO
   Tickets button jumps to. data-ticket-class is the widget's own option: the
   calendar stays date-led, and once a night is chosen the guest is shown LEO
   already open, with no other seat class offered. */
const lock = `<svg class="mtx-leo-lock" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="4" y="11" width="16" height="10" rx="2"></rect><path d="M8 11V7a4 4 0 0 1 8 0v4"></path></svg>`;

const booking = `  <section class="mtx-leo-sec mtx-leo-sec--white">
    <div class="mtx-leo-wrap">
      <h2 class="mtx-leo-h2">${esc(one('3', 'H2'))}</h2>
      <p class="mtx-leo-urgency">${esc(one('3', 'Urgency line'))}</p>
      <p class="mtx-leo-lead">${esc(one('3', 'Intro'))}</p>
      <div class="mtx-leo-widget" id="mtx-leo-book" data-mtx-slot="booking-widget"><div class="muaytix-ticket-selector" data-ticket-class="leo_section"></div></div>
      <p class="mtx-leo-trust">${lock}<span>${esc(one('3', 'Trust line'))}</span></p>
      <p class="mtx-leo-cta-row">${btn(one('3', 'CTA'))}</p>
    </div>
  </section>`;

/* ====================== 4 to 8. THE LONG READ ====================== */

/* Headline, body, detail. The headline is a paragraph set large, not a
   heading: the brief names the heading levels and this is not one of them. */
function longRead({ sec, tone, extra = '', after = '', border = false }) {
  return `  <section class="mtx-leo-sec mtx-leo-sec--${tone}${border ? ' mtx-leo-sec--ruled' : ''}">
    <div class="mtx-leo-wrap mtx-leo-read">
      <h2 class="mtx-leo-h2">${esc(one(sec, 'H2'))}</h2>
      <p class="mtx-leo-headline">${esc(one(sec, 'Headline'))}</p>
${paras(sec, 'Body').map(p => `      <p class="mtx-leo-body">${esc(p)}</p>`).join('\n')}
      <p class="mtx-leo-detail">${esc(one(sec, 'Detail'))}</p>${extra}${after}
    </div>
  </section>`;
}

const caps = blocks('4', 'Photo captions')[0];
const view = longRead({
  sec: '4', tone: 'white', border: true,
  extra: `
      <div class="mtx-leo-photos">
        <figure class="mtx-leo-fig">${img('front')}<figcaption>${esc(caps[0])}</figcaption></figure>
        <figure class="mtx-leo-fig">${img('back')}<figcaption>${esc(caps[1])}</figcaption></figure>
      </div>`,
});
const atmosphere = longRead({ sec: '5', tone: 'off' });
const seating = longRead({
  sec: '6', tone: 'white',
  extra: `
      <figure class="mtx-leo-fig mtx-leo-fig--single">${img('bench')}</figure>`,
});
const food = longRead({ sec: '7', tone: 'off' });
const availability = longRead({
  sec: '8', tone: 'white',
  after: `
      <p class="mtx-leo-cta-row">${btn(one('8', 'CTA'))}</p>`,
});

/* ============================ 9. WHO ============================ */

const who = `  <section class="mtx-leo-sec mtx-leo-sec--off">
    <div class="mtx-leo-wrap">
      <h2 class="mtx-leo-h2">${esc(one('9', 'H2'))}</h2>
      <ul class="mtx-leo-tiles mtx-leo-tiles--five">
${tiles('9', 5)}
      </ul>
    </div>
  </section>`;

/* ========================= 10. OTHER SEAT CLASSES ========================= */

/* Four plain lines. The class name in each is set in the display face; the
   words around it are untouched. */
const lines10 = blocks('10', 'Body')[0];
if (lines10.length !== 4) throw new Error('section 10 must have four lines');
const named = l => {
  const m = l.match(/^(Choose )(LEO|Club Class|Ringside|Third Class)( .*)$/);
  if (!m) throw new Error(`section 10 line does not start with "Choose <class> ": ${l}`);
  return `${esc(m[1])}<strong class="mtx-leo-cls">${esc(m[2])}</strong>${esc(m[3])}`;
};
const other = `  <section class="mtx-leo-sec mtx-leo-sec--white">
    <div class="mtx-leo-wrap">
      <h2 class="mtx-leo-h2">${esc(one('10', 'H2'))}</h2>
      <ul class="mtx-leo-lines">
${lines10.map(l => `        <li>${named(l)}</li>`).join('\n')}
      </ul>
      <p class="mtx-leo-cta-row"><a class="mtx-leo-btn mtx-leo-btn--line" href="${DEST.seating}">${esc(one('10', 'Link'))}</a></p>
    </div>
  </section>`;

/* ============================== 11. FAQ ============================== */

const faq = S['11'].faq;
const faqHtml = `  <section class="mtx-leo-sec mtx-leo-sec--off">
    <div class="mtx-leo-wrap mtx-leo-read">
      <h2 class="mtx-leo-h2">${esc(one('11', 'H2'))}</h2>
      <div class="mtx-leo-faq">
${faq.map((f, i) => {
  const open = i === 0;
  return `        <div class="mtx-leo-qa${open ? ' is-open' : ''}">
          <h3 class="mtx-leo-q"><button type="button" class="mtx-leo-qbtn" id="mtx-leo-q${i + 1}" aria-expanded="${open}" aria-controls="mtx-leo-a${i + 1}"><span>${esc(f.q)}</span><svg class="mtx-leo-chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M6 9l6 6 6-6"></path></svg></button></h3>
          <div class="mtx-leo-a" id="mtx-leo-a${i + 1}" role="region" aria-labelledby="mtx-leo-q${i + 1}"${open ? '' : ' hidden'}><p>${esc(f.a)}</p></div>
        </div>`;
}).join('\n')}
      </div>
    </div>
  </section>`;

/* ============================ 12. FINAL CTA ============================ */

const final = `  <section class="mtx-leo-sec mtx-leo-sec--blue mtx-leo-final">
    <div class="mtx-leo-wrap">
      <h2 class="mtx-leo-h2">${esc(one('12', 'H2'))}</h2>
      <p class="mtx-leo-final-body">${esc(one('12', 'Body'))}</p>
      <p class="mtx-leo-cta-row"><a class="mtx-leo-btn mtx-leo-btn--ghost" href="${DEST.book}">${esc(one('12', 'CTA'))}</a></p>
    </div>
  </section>`;

/* ============================ 13. RELATED ============================ */

const links13 = S['13'].links;
const hrefs13 = [DEST.tickets, DEST.seatMap, DEST.seating, DEST.club, DEST.ringside, DEST.third];
if (links13.length !== hrefs13.length) throw new Error('related links and destinations differ in number');
const related = `  <div class="mtx-leo-sec mtx-leo-sec--white mtx-leo-related">
    <div class="mtx-leo-wrap">
      <ul class="mtx-leo-rel">
${links13.map((t, i) => `        <li><a class="mtx-leo-link mtx-leo-link--dark" href="${hrefs13[i]}">${esc(t)}</a></li>`).join('\n')}
      </ul>
    </div>
  </div>`;

/* ============================ STICKY BAR ============================ */

/* Phones only. The two strings are the brief's own: the CTA label and the
   price from the fact strip. The script shows it once the guest has scrolled
   past the widget. */
const priceFact = facts.find(f => f.label === 'Price');
const bar = `  <a class="mtx-leo-bar" href="${DEST.book}" data-mtx-leo-bar><span class="mtx-leo-bar-l">${esc(BOOK_LABEL_1)}</span><span class="mtx-leo-bar-r">${esc(priceFact.value)}</span></a>`;

writeFileSync('body.html',
  [hero, why, booking, view, atmosphere, seating, food, availability, who, other, faqHtml, final, related, bar].join('\n\n') + '\n\n');

/* ============================== SCHEMA ============================== */

/* Part D: one FAQPage block, every question and answer, text copied from
   Part E. Nothing else on this page. */
writeFileSync('schema.json', JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faq.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
}, null, 2));

/* ============================ PAGE SETTINGS ============================ */

/* The brief's URL line is /rajadamnern-stadium-seats/leo-section. The owner
   confirmed on 2 October 2026 that this was a mistake in the brief: the
   page keeps the address it already has. */
const URL_PATH = '/rajadamnern-stadium-seating/leo-section';
const title = C.seo['Meta title'], desc = C.seo['Meta description'];
writeFileSync('TILDA-PAGE-SETTINGS.txt',
`LEO SECTION AT RAJADAMNERN STADIUM
Tilda page settings. These are NOT in the HTML block. Paste them into the
page's own settings in Tilda.

URL (unchanged)
  ${URL_PATH}

TITLE (${title.length} characters)
  ${title}

DESCRIPTION (${desc.length} characters)
  ${desc}

SOCIAL TITLE (Open Graph), identical to the title
  ${title}

SOCIAL DESCRIPTION (Open Graph), identical to the description
  ${desc}

SOCIAL IMAGE
  ${IMG.hero.url}

CANONICAL
  https://muaytix.com${URL_PATH}
`);
console.log('body.html, schema.json, TILDA-PAGE-SETTINGS.txt written');
