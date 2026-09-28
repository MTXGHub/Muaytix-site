/* Renders /rajadamnern-stadium-seating/leo-section from document-a.txt and
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
/* Some approved answers are two paragraphs. They are split on the blank line
   the owner put there, never rewritten into one. */
const P = (key, cls) => t(key).split(/\n\s*\n/).map(s =>
  `<p${cls ? ` class="${cls}"` : ''}>${esc(s.trim())}</p>`).join('\n          ');

const data = JSON.parse(readFileSync('dynamic-data.json', 'utf8'));
const D = data.destinations;
const IMG = data.images;

/* Document A section 5: live inventory is the source of truth for the price,
   and if it disagrees with Document A the live figure wins. So the static
   price is checked against the read-back before it is ever rendered. */
if (data.price_checked.match !== true)
  throw new Error('the LEO Section price in Document A no longer matches live inventory');

/* The four photographs carry the owner's own note as alt. The seating map has
   no note from him, so it takes Document A section 8's approved line. A null
   alt is never rendered as the string "null". */
const ALT = k => IMG[k].alt ?? t('alt.' + k);
const fig = (k, cls) =>
  `<figure class="mtx-leo__${cls}"><img src="${esc(IMG[k].url)}" alt="${esc(ALT(k))}" loading="lazy" decoding="async"></figure>`;

/* ================================================================ HERO === */

const FACTS = ['section', 'price', 'seating', 'view'];

const hero = `  <header class="mtx-leo__hero">
    <img class="mtx-leo__hero-media" src="${esc(IMG.hero.url)}" alt="${esc(IMG.hero.alt)}" loading="eager" decoding="async">
    <div class="mtx-leo__hero-wash" aria-hidden="true"></div>
    <div class="mtx-leo__shell mtx-leo__hero-in">
      <div class="mtx-leo__hero-copy">
        <h1>${T('hero.h1')}</h1>
        <p class="mtx-leo__lede">${T('hero.p1')}</p>
        <p class="mtx-leo__lede">${T('hero.p2')}</p>
        <p class="mtx-leo__lede">${T('hero.p3')}</p>
      </div>
      <figure class="mtx-leo__hero-mark">
        <img src="${esc(IMG.mark.url)}" alt="${esc(IMG.mark.alt)}" width="1024" height="1024" loading="eager" decoding="async">
      </figure>
      <div class="mtx-leo__hero-base">
        <dl class="mtx-leo__facts">
${FACTS.map(k => `          <div class="mtx-leo__fact">
            <dt>${T('facts.label.' + k)}</dt>
            <dd>${T('facts.value.' + k)}</dd>
          </div>`).join('\n')}
        </dl>
        <p class="mtx-leo__actions">
          <a class="mtx-leo__btn mtx-leo__btn--blue" href="${esc(D.booking_anchor)}">${T('hero.cta_primary')}</a>
          <a class="mtx-leo__btn mtx-leo__btn--ghost" href="${esc(D.seat_map)}">${T('hero.cta_secondary')}</a>
        </p>
      </div>
    </div>
  </header>`;

/* ============================================================== ANSWER === */

/* Document A section 2: directly below the hero, concise, easy to extract. */
const answer = `  <section class="mtx-leo__band mtx-leo__band--paper">
    <div class="mtx-leo__shell mtx-leo__answer">
      <h2>${T('answer.h2')}</h2>
      <p class="mtx-leo__answer-lead">${T('answer.p1')}</p>
      <p class="mtx-leo__answer-copy">${T('answer.p2')}</p>
      <p class="mtx-leo__answer-copy">${T('answer.p3')}</p>
      <p class="mtx-leo__answer-close">${T('answer.p4')}</p>
    </div>
  </section>`;

/* ================================================================ VIEW === */

/* Document A section 3 asks for a wide view photograph. None was supplied:
   all four are squares. Two of them are placed side by side instead, which
   fills the width without cropping either and shows the elevated perspective
   from two heights. Reported in blockers.txt, not silently substituted. */
const view = `  <section class="mtx-leo__band mtx-leo__band--ink">
    <div class="mtx-leo__shell">
      <h2>${T('view.h2')}</h2>
      <div class="mtx-leo__pair">
        ${fig('view_front', 'square')}
        ${fig('view_back', 'square')}
      </div>
      <div class="mtx-leo__cols">
        <p>${T('view.p1')}</p>
        <p>${T('view.p2')}</p>
        <p>${T('view.p3')}</p>
        <p>${T('view.p4')}</p>
        <p class="mtx-leo__caveat">${T('view.p5')}</p>
      </div>
    </div>
  </section>`;

/* ========================================================== ATMOSPHERE === */

/* Document A section 4 asks for an atmosphere image showing the section or the
   wider stadium crowd. None was supplied. Document A section 4 forbids a
   generic photograph of gamblers and section 8 says to report a missing asset
   rather than substitute one, so this section carries its copy and no
   picture. Reported in blockers.txt.

   Document A section 4 also draws a hard line that must survive the layout:
   the betting atmosphere belongs to three named nights and a guest does not
   have to take part. Those two sentences are set as the section's strongest
   lines, not its quietest. */
const atmosphere = `  <section class="mtx-leo__band mtx-leo__band--white">
    <div class="mtx-leo__shell">
      <h2>${T('atmosphere.h2')}</h2>
      <div class="mtx-leo__cols">
        <p>${T('atmosphere.p1')}</p>
        <p>${T('atmosphere.p2')}</p>
        <p>${T('atmosphere.p4')}</p>
      </div>
      <p class="mtx-leo__caveat">${T('atmosphere.p3')}</p>
      <p class="mtx-leo__caveat">${T('atmosphere.p5')}</p>
    </div>
  </section>`;

/* ============================================================ POSITION === */

/* Document A section 5: a visual showing the LEO tier or seating position.
   The bench seating photograph is that tier. */
const position = `  <section class="mtx-leo__band mtx-leo__band--paper">
    <div class="mtx-leo__shell">
      <h2>${T('position.h2')}</h2>
      <div class="mtx-leo__split mtx-leo__split--flip">
        ${fig('seating', 'split-fig')}
        <div class="mtx-leo__split-body">
          <p>${T('position.p1')}</p>
          <p>${T('position.p2')}</p>
          <p>${T('position.p3')}</p>
          <p>${T('position.p4')}</p>
        </div>
      </div>
    </div>
  </section>`;

/* ================================================================= WHO === */

const WHON = [1, 2, 3, 4];
const who = `  <section class="mtx-leo__band mtx-leo__band--white">
    <div class="mtx-leo__shell">
      <h2>${T('who.h2')}</h2>
      <ul class="mtx-leo__who">
${WHON.map(n => `        <li>
          <h3>${T('who.q' + n)}</h3>
          <p>${T('who.a' + n)}</p>
        </li>`).join('\n')}
      </ul>
    </div>
  </section>`;

/* ============================================================= COMPARE === */

/* Document A section 7: concise. The main seating page owns the full
   comparison, so this is four lines and a link out to it, with the seating
   map beside them. */
const compare = `  <section class="mtx-leo__band mtx-leo__band--ink">
    <div class="mtx-leo__shell">
      <h2>${T('compare.h2')}</h2>
      <div class="mtx-leo__map">
        ${fig('map', 'map-fig')}
        <div class="mtx-leo__map-body">
          <ul class="mtx-leo__compare">
            <li class="mtx-leo__compare--this">${T('compare.p1')}</li>
            <li>${T('compare.p2')}</li>
            <li>${T('compare.p3')}</li>
            <li>${T('compare.p4')}</li>
          </ul>
          <p class="mtx-leo__map-go"><a class="mtx-leo__go" href="${esc(D.seating)}">${T('compare.link')}</a></p>
        </div>
      </div>
    </div>
  </section>`;

/* =========================================================== PRACTICAL === */

const PRACN = [1, 2, 3, 4, 5, 6];
const practical = `  <section class="mtx-leo__band mtx-leo__band--paper">
    <div class="mtx-leo__shell">
      <h2>${T('practical.h2')}</h2>
      <ul class="mtx-leo__practical">
${PRACN.map(n => `        <li>${T('practical.' + n)}</li>`).join('\n')}
      </ul>
    </div>
  </section>`;

/* ============================================================= BOOKING === */

/* Document A section 8: the booking action appears before the FAQs. The
   widget is the universal date-first one already live on the other pages: a
   guest picks the night, then the seat class. It is never told what is on
   sale by this page; the database decides. */
const booking = `  <section class="mtx-leo__band mtx-leo__band--white" id="mtx-leo-booking">
    <div class="mtx-leo__shell">
      <h2>${T('booking.h2')}</h2>
      <p class="mtx-leo__booking-copy">${T('booking.p1')}</p>
      <p class="mtx-leo__booking-copy">${T('booking.p2')}</p>
      <p class="mtx-leo__booking-copy">${T('booking.p3')}</p>
      <p class="mtx-leo__booking-copy">${T('booking.p4')}</p>
      <div class="mtx-leo__widget"><div class="muaytix-ticket-selector"></div></div>
      <p class="mtx-leo__actions">
        <a class="mtx-leo__btn mtx-leo__btn--blue" href="${esc(D.tickets)}">${T('booking.cta')}</a>
      </p>
    </div>
  </section>`;

/* ================================================================= FAQ === */

const FAQN = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
const faq = `  <section class="mtx-leo__band mtx-leo__band--paper">
    <div class="mtx-leo__shell">
      <h2>${T('faq.h2')}</h2>
      <div class="mtx-leo__faq">
${FAQN.map(n => `        <details>
          <summary><h3>${T('faq.q' + n)}</h3></summary>
          ${P('faq.a' + n)}
        </details>`).join('\n\n')}
      </div>
    </div>
  </section>`;

/* =============================================================== FINAL === */

const final = `  <section class="mtx-leo__band mtx-leo__band--ink mtx-leo__close">
    <div class="mtx-leo__shell">
      <h2>${T('final.h2')}</h2>
      <p class="mtx-leo__close-copy">${T('final.p1')}</p>
      <p class="mtx-leo__actions">
        <a class="mtx-leo__btn mtx-leo__btn--blue" href="${esc(D.booking_anchor)}">${T('final.cta')}</a>
      </p>
      <p class="mtx-leo__elsewhere">
        <a class="mtx-leo__go" href="${esc(D.stadium)}">${T('link.stadium')}</a>
        <a class="mtx-leo__go" href="${esc(D.tickets)}">${T('link.tickets')}</a>
        <a class="mtx-leo__go" href="${esc(D.seat_map)}">${T('link.seat_map')}</a>
        <a class="mtx-leo__go" href="${esc(D.seating)}">${T('link.seating')}</a>
      </p>
    </div>
  </section>`;

writeFileSync('body.html',
  [hero, answer, view, atmosphere, position, who, compare, practical, booking, faq, final].join('\n\n') + '\n\n');

/* ============================================================== SCHEMA === */

/* Document A section 10: WebPage, BreadcrumbList, FAQPage for the visible
   questions, Organization. No Event schema, no prices, no availability and no
   seat numbers, because live inventory owns those. */
const SITE = 'https://muaytix.com';
const HERE = SITE + '/rajadamnern-stadium-seating/leo-section';
writeFileSync('schema.json', JSON.stringify({
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'Organization', '@id': SITE + '#org', name: 'MuayTix', url: SITE },
    { '@type': 'WebPage', '@id': HERE, url: HERE, name: t('meta.social_title'),
      description: t('meta.description'), isPartOf: { '@id': SITE + '#org' },
      primaryImageOfPage: { '@type': 'ImageObject', url: IMG.hero.url, caption: IMG.hero.alt } },
    { '@type': 'BreadcrumbList', '@id': HERE + '#crumbs', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Rajadamnern Stadium', item: SITE + D.stadium },
      { '@type': 'ListItem', position: 2, name: 'Seating', item: SITE + D.seating },
      { '@type': 'ListItem', position: 3, name: t('hero.h1'), item: HERE },
    ] },
    { '@type': 'FAQPage', '@id': HERE + '#faq',
      mainEntity: FAQN.map(n => ({ '@type': 'Question', name: t('faq.q' + n),
        acceptedAnswer: { '@type': 'Answer', text: t('faq.a' + n) } })) },
  ],
}, null, 2));

/* ============================================================ HANDOVER === */

writeFileSync('TILDA-PAGE-SETTINGS.txt',
`RAJADAMNERN STADIUM LEO SECTION SEATS
Tilda page settings. These are NOT in the HTML block. Paste them into the
page's own settings in Tilda.

URL
  /rajadamnern-stadium-seating/leo-section
  Confirmed against the repository: the seating page already links here.

TITLE
  ${t('meta.seo_title')}

DESCRIPTION
  ${t('meta.description')}

SOCIAL TITLE (Open Graph)
  ${t('meta.social_title')}

SOCIAL DESCRIPTION (Open Graph)
  ${t('meta.social_description')}

SOCIAL IMAGE
  ${IMG.hero.url}

CANONICAL
  https://muaytix.com/rajadamnern-stadium-seating/leo-section
`);

writeFileSync('blockers.txt', data.blockers.map(b => '- ' + b).join('\n\n') + '\n');
console.log('body.html, schema.json, TILDA-PAGE-SETTINGS.txt, blockers.txt written');
