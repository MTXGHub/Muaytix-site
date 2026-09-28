/* Renders /rajadamnern-stadium-seating/ringside from document-a.txt and
 * dynamic-data.json.
 *
 *   node gen.mjs && node build.mjs
 *
 * Document B, task type: IMPLEMENTATION ONLY. Not one line of customer-facing
 * prose is written here. Every visible string is looked up from
 * document-a.txt by key, and a missing key stops the build rather than being
 * substituted, because substituting is how approved copy gets quietly
 * rewritten.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const DOC = (() => {
  const out = {}; let key = null, buf = [];
  for (const raw of readFileSync('document-a.txt', 'utf8').split('\n')) {
    const m = raw.match(/^\[([a-z0-9._-]+)\]\s*$/i);
    if (m) { if (key) out[key] = buf.join('\n').trim(); key = m[1]; buf = []; continue; }
    if (raw.startsWith('#')) continue;
    if (key) buf.push(raw);
  }
  if (key) out[key] = buf.join('\n').trim();
  return out;
})();

function t(key) {
  const v = DOC[key];
  if (v === undefined || v === '') throw new Error(`document-a.txt has no copy for [${key}]`);
  return v;
}
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const T = key => esc(t(key));

const data = JSON.parse(readFileSync('dynamic-data.json', 'utf8'));
const D = data.destinations;
const IMG = data.images;
const RING = data.seat_colour.ringside;
const blockers = [];

/* Document A section 5: the standard Ringside price is 2,500 THB, and if the
   live booking system shows a different verified price the live system takes
   precedence. So the static price is checked before it is ever rendered. */
if (data.price_checked.match !== true) {
  throw new Error('the Ringside price in Document A no longer matches live inventory');
}

/* ================================================================ HERO === */

const FACTS = ['sections', 'price', 'seating', 'location'];

const hero = `  <header class="mtx-rs__hero">
    <img class="mtx-rs__hero-media" src="${esc(IMG.hero.url)}" alt="${T('alt.hero')}" loading="eager" decoding="async">
    <div class="mtx-rs__hero-wash" aria-hidden="true"></div>
    <div class="mtx-rs__shell mtx-rs__hero-in">
      <h1>${T('hero.h1')}</h1>
      <p class="mtx-rs__lede">${T('hero.p1')}</p>
      <p class="mtx-rs__lede">${T('hero.p2')}</p>
      <p class="mtx-rs__lede">${T('hero.p3')}</p>
      <dl class="mtx-rs__facts">
${FACTS.map(k => `        <div class="mtx-rs__fact">
          <dt>${T('facts.label.' + k)}</dt>
          <dd>${T('facts.value.' + k)}</dd>
        </div>`).join('\n')}
      </dl>
      <p class="mtx-rs__actions">
        <a class="mtx-rs__btn mtx-rs__btn--blue" href="${esc(D.booking_anchor)}">${T('hero.cta_primary')}</a>
        <a class="mtx-rs__btn mtx-rs__btn--ghost" href="${esc(D.seat_map)}">${T('hero.cta_secondary')}</a>
      </p>
    </div>
  </header>`;

/* ============================================================== ANSWER === */

const answer = `  <section class="mtx-rs__band mtx-rs__band--paper">
    <div class="mtx-rs__shell mtx-rs__answer">
      <h2>${T('answer.h2')}</h2>
      <p class="mtx-rs__answer-lead">${T('answer.p1')}</p>
      <p class="mtx-rs__answer-copy">${T('answer.p2')}</p>
      <p class="mtx-rs__answer-copy">${T('answer.p3')}</p>
      <p class="mtx-rs__answer-close">${T('answer.p4')}</p>
    </div>
  </section>`;

/* ========================================================== EXPERIENCE === */

/* Document A section 3 allows a wide image OR a two-column section. It is
   built as two columns with no photograph, because Document A section 8
   supplies three approved alt lines and all three are already used
   accurately elsewhere on this page. See blockers.txt. */
const experience = `  <section class="mtx-rs__band mtx-rs__band--ink">
    <div class="mtx-rs__shell">
      <h2>${T('experience.h2')}</h2>
      <div class="mtx-rs__two">
        <div>
          <p>${T('experience.p1')}</p>
          <p>${T('experience.p2')}</p>
        </div>
        <div>
          <p>${T('experience.p3')}</p>
          <p>${T('experience.p4')}</p>
        </div>
      </div>
    </div>
  </section>`;

/* ============================================================ SECTIONS === */

const sections = `  <section class="mtx-rs__band mtx-rs__band--white">
    <div class="mtx-rs__shell">
      <h2>${T('sections.h2')}</h2>
      <div class="mtx-rs__map">
        <figure class="mtx-rs__map-fig">
          <a href="${esc(D.seat_map)}">
            <img src="${esc(IMG.map.url)}" alt="${T('alt.map')}" loading="lazy" decoding="async">
          </a>
        </figure>
        <div class="mtx-rs__map-body">
          <p>${T('sections.p1')}</p>
          <p>${T('sections.p2')}</p>
          <p>${T('sections.p3')}</p>
          <p class="mtx-rs__map-go"><a class="mtx-rs__go" href="${esc(D.seat_map)}">${T('sections.link')}</a></p>
        </div>
      </div>
    </div>
  </section>`;

/* ============================================================ FRONT ROW === */

/* Document A section 5 asks for a close Ringside image and says not to label
   it front row unless verified. The photograph here is the owner's own shot
   of the Ringside seats in Section 6, and nothing on the page calls it the
   front row. Document A section 7 forbids "guaranteed front row": the copy
   states the opposite and the last line of the section says so plainly. */
const frontrow = `  <section class="mtx-rs__band mtx-rs__band--paper">
    <div class="mtx-rs__shell">
      <h2>${T('frontrow.h2')}</h2>
      <div class="mtx-rs__split">
        <figure class="mtx-rs__split-fig">
          <img src="${esc(IMG.seats.url)}" alt="${T('alt.seats')}" loading="lazy" decoding="async">
        </figure>
        <div class="mtx-rs__split-body">
          <p>${T('frontrow.p1')}</p>
          <p>${T('frontrow.p2')}</p>
          <p>${T('frontrow.p3')}</p>
          <p>${T('frontrow.p4')}</p>
          <p class="mtx-rs__caveat">${T('frontrow.p5')}</p>
        </div>
      </div>
    </div>
  </section>`;

/* ================================================================= WHO === */

const WHO = ['close', 'sound', 'entrances', 'assigned'];
const who = `  <section class="mtx-rs__band mtx-rs__band--white">
    <div class="mtx-rs__shell">
      <h2>${T('who.h2')}</h2>
      <ul class="mtx-rs__who">
${WHO.map(k => `        <li>
          <h3>${T('who.h3.' + k)}</h3>
          <p>${T('who.p.' + k)}</p>
        </li>`).join('\n')}
      </ul>
    </div>
  </section>`;

/* ============================================================= COMPARE === */

const CLASSES = ['ringside', 'club-class', 'leo-section', 'third-class'];
const compare = `  <section class="mtx-rs__band mtx-rs__band--ink">
    <div class="mtx-rs__shell">
      <h2>${T('compare.h2')}</h2>
      <ul class="mtx-rs__compare">
${CLASSES.map(k => `        <li${k === 'ringside' ? ' class="mtx-rs__compare--this"' : ''}><p>${T('compare.' + k)}</p></li>`).join('\n')}
      </ul>
      <p class="mtx-rs__compare-go"><a class="mtx-rs__go" href="${esc(D.seating)}">${T('compare.link')}</a></p>
    </div>
  </section>`;

/* =========================================================== PRACTICAL === */

const practical = `  <section class="mtx-rs__band mtx-rs__band--white">
    <div class="mtx-rs__shell">
      <h2>${T('practical.h2')}</h2>
      <ul class="mtx-rs__practical">
${[1, 2, 3, 4, 5].map(n => `        <li><p>${T('practical.p' + n)}</p></li>`).join('\n')}
      </ul>
    </div>
  </section>`;

/* ============================================================= BOOKING === */

/* The universal booking widget, mounted exactly as on
   /rajadamnern-stadium-tickets and on the parent seating page: a bare mount,
   no attributes, so the guest chooses the month, then the night, then the
   seat class. Document A section 9's own copy says "Select your event date,
   choose Ringside", which is date first. */
const booking = `  <section class="mtx-rs__band mtx-rs__band--paper" id="mtx-rs-booking">
    <div class="mtx-rs__shell">
      <h2>${T('booking.h2')}</h2>
      <p class="mtx-rs__booking-copy">${T('booking.p1')}</p>
      <p class="mtx-rs__booking-copy">${T('booking.p2')}</p>
      <p class="mtx-rs__booking-copy">${T('booking.p3')}</p>
      <p class="mtx-rs__booking-copy">${T('booking.p4')}</p>
      <div class="mtx-rs__widget"><div class="muaytix-ticket-selector"></div></div>
      <p class="mtx-rs__actions">
        <a class="mtx-rs__btn mtx-rs__btn--blue" href="${esc(D.tickets)}">${T('booking.cta')}</a>
      </p>
    </div>
  </section>`;

/* ================================================================= FAQ === */

const FAQN = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
const faq = `  <section class="mtx-rs__band mtx-rs__band--white">
    <div class="mtx-rs__shell">
      <h2>${T('faq.h2')}</h2>
      <div class="mtx-rs__faq">
${FAQN.map(n => `        <details>
          <summary><h3>${T('faq.q' + n)}</h3></summary>
          <p>${T('faq.a' + n)}</p>
        </details>`).join('\n\n')}
      </div>
    </div>
  </section>`;

/* =============================================================== FINAL === */

const final = `  <section class="mtx-rs__band mtx-rs__band--ink mtx-rs__close">
    <div class="mtx-rs__shell">
      <h2>${T('final.h2')}</h2>
      <p class="mtx-rs__close-copy">${T('final.p1')}</p>
      <p class="mtx-rs__actions">
        <a class="mtx-rs__btn mtx-rs__btn--blue" href="${esc(D.booking_anchor)}">${T('final.cta')}</a>
      </p>
      <p class="mtx-rs__elsewhere">
        <a class="mtx-rs__go" href="${esc(D.stadium)}">${T('links.stadium')}</a>
        <a class="mtx-rs__go" href="${esc(D.tickets)}">${T('links.tickets')}</a>
      </p>
    </div>
  </section>`;

/* ---------- reported, not filled in ---------- */

const unused = data.photographs_supplied.filter(p => !p.used);
blockers.push(`Six Ringside photographs were supplied and two are on the page. Document A section 8 gives three `
  + `approved alt lines and Document B section 3 forbids writing any, so only images that one of those three `
  + `describes accurately could be placed. Four are unused: ${unused.map(p => p.id).join(', ')}. Supply alt text and `
  + `they go in. The one that is missed most is 1000033703, the corner of Section 4 with the fighter walkway, which `
  + `belongs beside "Where are the Ringside sections?".`);

blockers.push('No cropped Sections 3 to 7 map detail exists. Document A section 4 permits the seating map OR a '
  + 'cropped detail, so the full seating map is used, which is the option Document A allows. A cropped detail would '
  + 'be better and needs its own approved alt line.');

blockers.push('Document A section 3 asks for a wide image or a two-column section for the Ringside experience. It is '
  + 'built as two columns with no photograph, for the same reason: no approved alt line is left. One of the four '
  + 'unused photographs belongs here.');

blockers.push('None of the images can be opened from this environment, because static.tildacdn.com is blocked by the '
  + 'network policy. Each is placed on the owner\'s own note about where it was taken, not on inspection. Whether the '
  + 'hero reads as close enough, and whether any crop hides useful seating information, cannot be judged from here.');

writeFileSync('body.html',
  [hero, answer, experience, sections, frontrow, who, compare, practical, booking, faq, final].join('\n\n') + '\n\n');

/* ---------- schema ----------
   Document A section 10: WebPage, BreadcrumbList, FAQPage for visible FAQs
   only, Organization. No Event schema on an evergreen Ringside page. No
   prices, availability, seat numbers or guaranteed experiences. */
const BASE = 'https://muaytix.com';
const HERE = BASE + '/rajadamnern-stadium-seating/ringside';
const schema = {
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'Organization', '@id': BASE + '/#organisation', name: 'MuayTix', url: BASE },
    { '@type': 'WebPage', '@id': HERE + '#webpage', url: HERE,
      name: t('meta.seo_title'), description: t('meta.description'),
      isPartOf: { '@type': 'WebSite', '@id': BASE + '/#website', name: 'MuayTix', url: BASE,
        publisher: { '@id': BASE + '/#organisation' } } },
    { '@type': 'BreadcrumbList', '@id': HERE + '#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'MuayTix', item: BASE },
        { '@type': 'ListItem', position: 2, name: 'Rajadamnern Stadium Seating', item: BASE + '/rajadamnern-stadium-seating' },
        { '@type': 'ListItem', position: 3, name: t('hero.h1'), item: HERE },
      ] },
    { '@type': 'FAQPage', '@id': HERE + '#faq',
      mainEntity: FAQN.map(n => ({ '@type': 'Question', name: t('faq.q' + n),
        acceptedAnswer: { '@type': 'Answer', text: t('faq.a' + n) } })) },
  ],
};
writeFileSync('schema.json', JSON.stringify(schema, null, 0));

writeFileSync('TILDA-PAGE-SETTINGS.txt',
`RAJADAMNERN STADIUM RINGSIDE SEATS: what to paste into Tilda's page settings
============================================================================
Page settings, not part of the HTML block. Every line is Document A, word for
word. Do not edit them here.


URL
/rajadamnern-stadium-seating/ringside

Checked against the whole repository on 28 September 2026: no other Ringside
child URL exists, and the parent seating page already links to this one.


SEO TITLE
${t('meta.seo_title')}


META DESCRIPTION
${t('meta.description')}


SOCIAL TITLE (Open Graph)
${t('meta.social_title')}


SOCIAL DESCRIPTION (Open Graph)
${t('meta.social_description')}


H1
Already in the block, and there is exactly one. Do not add another in Tilda.
`);

writeFileSync('blockers.txt', blockers.map(b => '- ' + b).join('\n') + '\n');
console.log(`body.html written from ${Object.keys(DOC).length} locked copy blocks`);
console.log(`FAQ entries: ${FAQN.length}, quick facts: ${FACTS.length}, photographs used: 2 of 6`);
console.log(`Ringside price checked against live inventory: ${data.price_checked.document_a} = ${data.price_checked.live_minor} minor THB`);
console.log(`\n${blockers.length} item(s) reported, not filled in:`);
blockers.forEach(b => console.log('  - ' + b));
