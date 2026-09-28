/* Renders /rajadamnern-stadium-seating from document-a.txt and
 * dynamic-data.json.
 *
 *   node gen.mjs && node build.mjs
 *
 * Document B, task type: IMPLEMENTATION ONLY. There is deliberately not one
 * line of customer-facing prose in this file. Every visible string is looked
 * up from document-a.txt by key. If a key is missing the build stops rather
 * than substituting anything, because substituting is how approved copy gets
 * quietly rewritten.
 *
 * Document B section 3: zero independently authored customer-facing
 * sentences. Where a component appeared to need wording that Document A does
 * not contain, the component was changed instead, and the requirement is
 * reported in blockers.txt.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const DOC = (() => {
  const out = {};
  let key = null, buf = [];
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
const SEAT = data.seat_colours;
const blockers = [];

const CLASSES = ['ringside', 'club-class', 'leo-section', 'third-class'];

/* Prices are written into Document A and were checked against live inventory
   before this build. Document A section 5: if static prices are retained they
   must be checked. If one ever stops matching, the build stops. */
for (const k of CLASSES) {
  const p = data.prices_checked[k];
  if (!p || p.match !== true) throw new Error(`price for ${k} has not been checked against live inventory`);
}

function picture(k) {
  const img = IMG[k];
  if (!img) throw new Error(`dynamic-data.json has no image for "${k}"`);
  return `<img class="mtx-ss__shot" src="${esc(img.url)}" alt="${T('alt.' + k)}" loading="lazy" decoding="async">`;
}

/* ================================================================ HERO === */

/* The hero photograph is a real <img>, not a CSS background, so it carries
   the approved alt text from Document A section 7. It is covered by the
   gradient rather than replaced by it. */
const hero = `  <header class="mtx-ss__hero">
    <img class="mtx-ss__hero-media" src="${esc(IMG.hero.url)}" alt="${T('alt.hero')}" loading="eager" decoding="async">
    <div class="mtx-ss__hero-wash" aria-hidden="true"></div>
    <div class="mtx-ss__shell mtx-ss__hero-in">
      <h1>${T('hero.h1')}</h1>
      <p class="mtx-ss__lede">${T('hero.p1')}</p>
      <p class="mtx-ss__lede">${T('hero.p2')}</p>
      <p class="mtx-ss__lede">${T('hero.p3')}</p>
      <p class="mtx-ss__actions">
        <a class="mtx-ss__btn mtx-ss__btn--blue" href="${esc(D.booking_anchor)}">${T('hero.cta_primary')}</a>
        <a class="mtx-ss__btn mtx-ss__btn--ghost" href="${esc(D.seat_map)}">${T('hero.cta_secondary')}</a>
      </p>
    </div>
  </header>`;

/* ============================================================== ANSWER === */

const answer = `  <section class="mtx-ss__band mtx-ss__band--paper">
    <div class="mtx-ss__shell mtx-ss__answer">
      <h2>${T('answer.h2')}</h2>
      <p class="mtx-ss__answer-lead">${T('answer.p1')}</p>
      <ul class="mtx-ss__answer-list">
${CLASSES.map((k, i) => `        <li style="--seat:${esc(SEAT[k])}"><p>${T('answer.p' + (i + 2))}</p></li>`).join('\n')}
      </ul>
      <p class="mtx-ss__answer-close">${T('answer.p6')}</p>
    </div>
  </section>`;

/* =============================================================== CARDS === */

const cards = `  <section class="mtx-ss__band mtx-ss__band--white">
    <div class="mtx-ss__shell">
      <ul class="mtx-ss__cards">
${CLASSES.map(k => `        <li class="mtx-ss__card" style="--seat:${esc(SEAT[k])}">
          <figure class="mtx-ss__card-fig">${picture(k)}</figure>
          <div class="mtx-ss__card-body">
            <h2 class="mtx-ss__card-name">${T('cards.name.' + k)}</h2>
            <p class="mtx-ss__facts">
              <span class="mtx-ss__fact">${T('cards.sections.' + k)}</span>
              <span class="mtx-ss__fact mtx-ss__fact--price">${T('cards.price.' + k)}</span>
              <span class="mtx-ss__fact">${T('cards.seating.' + k)}</span>
            </p>
            <p class="mtx-ss__card-copy">${T('cards.p1.' + k)}</p>
            <p class="mtx-ss__card-copy">${T('cards.p2.' + k)}</p>
            <p class="mtx-ss__best">${T('cards.best.' + k)}</p>
            <p class="mtx-ss__card-go">
              <a class="mtx-ss__go" href="${esc(D[k])}">${T('cards.link.' + k)}</a>
            </p>
            <p class="mtx-ss__card-cta">
              <a class="mtx-ss__btn mtx-ss__btn--line" href="${esc(D.booking_anchor)}">${T('cards.cta.' + k)}</a>
            </p>
          </div>
        </li>`).join('\n\n')}
      </ul>
    </div>
  </section>`;

/* ============================================================ COMPARE === */

const compare = `  <section class="mtx-ss__band mtx-ss__band--ink">
    <div class="mtx-ss__shell">
      <h2>${T('compare.h2')}</h2>
      <div class="mtx-ss__tablewrap">
        <table class="mtx-ss__table">
          <thead>
            <tr>
              <th scope="col">${T('compare.th.class')}</th>
              <th scope="col">${T('compare.th.sections')}</th>
              <th scope="col">${T('compare.th.price')}</th>
              <th scope="col">${T('compare.th.seating')}</th>
              <th scope="col">${T('compare.th.experience')}</th>
            </tr>
          </thead>
          <tbody>
${CLASSES.map(k => `            <tr style="--seat:${esc(SEAT[k])}">
              <th scope="row"><span class="mtx-ss__swatch" aria-hidden="true"></span>${T('compare.name.' + k)}</th>
              <td data-label="${T('compare.th.sections')}">${T('compare.sections.' + k)}</td>
              <td data-label="${T('compare.th.price')}">${T('compare.price.' + k)}</td>
              <td data-label="${T('compare.th.seating')}">${T('compare.seating.' + k)}</td>
              <td data-label="${T('compare.th.experience')}">${T('compare.experience.' + k)}</td>
            </tr>`).join('\n')}
          </tbody>
        </table>
      </div>
      <p class="mtx-ss__table-note">${T('compare.note')}</p>
    </div>
  </section>`;

/* ============================================================== GUIDE === */

const guide = `  <section class="mtx-ss__band mtx-ss__band--paper">
    <div class="mtx-ss__shell">
      <h2>${T('guide.h2')}</h2>
      <div class="mtx-ss__guide">
${CLASSES.map(k => `        <article class="mtx-ss__choice" style="--seat:${esc(SEAT[k])}">
          <figure class="mtx-ss__choice-fig">${picture(k)}</figure>
          <div class="mtx-ss__choice-body">
            <h3>${T('guide.h3.' + k)}</h3>
            <p>${T('guide.p1.' + k)}</p>
            <p>${T('guide.p2.' + k)}</p>
          </div>
        </article>`).join('\n\n')}
      </div>
    </div>
  </section>`;

/* ================================================================ MAP === */

/* Document A section 8 requires a link to /rajadamnern-stadium and gives no
   anchor text for it, and Document B section 3 forbids writing any. The link
   is therefore placed on words already inside the approved sentence. The
   rendered text is unchanged: only the markup around part of it differs. */
const mapP1 = T('map.p1').replace('Rajadamnern Stadium',
  `<a class="mtx-ss__inline" href="${esc(D.stadium)}">Rajadamnern Stadium</a>`);

const map = `  <section class="mtx-ss__band mtx-ss__band--white">
    <div class="mtx-ss__shell">
      <h2>${T('map.h2')}</h2>
      <div class="mtx-ss__map">
        <figure class="mtx-ss__map-fig">
          <a href="${esc(D.seat_map)}">
            <img src="${esc(IMG.map.url)}" alt="${T('alt.map')}" loading="lazy" decoding="async">
          </a>
        </figure>
        <div class="mtx-ss__map-body">
          <p>${mapP1}</p>
          <ul class="mtx-ss__map-list">
${CLASSES.map(k => `            <li style="--seat:${esc(SEAT[k])}">${T('map.item.' + k)}</li>`).join('\n')}
          </ul>
          <p>${T('map.p2')}</p>
          <p class="mtx-ss__map-go"><a class="mtx-ss__go" href="${esc(D.seat_map)}">${T('map.link')}</a></p>
        </div>
      </div>
    </div>
  </section>`;

/* =========================================================== INCLUDES === */

/* Document A section 7 asks for four simple icon points and no large
   text-heavy box. The four points are the four approved paragraphs. No label,
   caption or heading has been invented for any of them. */
const includes = `  <section class="mtx-ss__band mtx-ss__band--ink">
    <div class="mtx-ss__shell">
      <h2>${T('includes.h2')}</h2>
      <ul class="mtx-ss__includes">
        <li>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 18v-6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v6"/><path d="M4 18h16"/><path d="M7 10V7a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v3"/></svg>
          <p>${T('includes.p1')}</p>
        </li>
        <li>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8h18"/><path d="M6 12v4"/><path d="M12 12v4"/><path d="M18 12v4"/><rect x="3" y="4" width="18" height="4" rx="1"/></svg>
          <p>${T('includes.p2')}</p>
        </li>
        <li>
          <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18"/><path d="M9 14h6"/></svg>
          <p>${T('includes.p3')}</p>
        </li>
        <li>
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><circle cx="17.5" cy="9.5" r="2.3"/><path d="M17.5 14.2c2.2 0 3.7 1.4 3.7 3.4"/></svg>
          <p>${T('includes.p4')}</p>
        </li>
      </ul>
    </div>
  </section>`;

/* ============================================================ BOOKING === */

/* Document A section 8 allows the booking widget or a booking entry point,
   and section 4 asks the primary CTA to open the seat-led journey with seat
   class before event date. The widget does that with data-start="seats". No
   URL exists that does, and none was invented, so the widget is mounted here
   and every booking CTA on the page anchors to it. */
const booking = `  <section class="mtx-ss__band mtx-ss__band--paper" id="mtx-ss-booking">
    <div class="mtx-ss__shell">
      <h2>${T('booking.h2')}</h2>
      <p class="mtx-ss__booking-copy">${T('booking.p1')}</p>
      <p class="mtx-ss__booking-copy">${T('booking.p2')}</p>
      <p class="mtx-ss__booking-copy">${T('booking.p3')}</p>
      <div class="mtx-ss__widget"><div class="muaytix-ticket-selector" data-start="seats"></div></div>
      <p class="mtx-ss__actions">
        <a class="mtx-ss__btn mtx-ss__btn--blue" href="${esc(D.tickets)}">${T('booking.cta')}</a>
      </p>
    </div>
  </section>`;

/* ================================================================ FAQ === */

const FAQN = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const faq = `  <section class="mtx-ss__band mtx-ss__band--white">
    <div class="mtx-ss__shell">
      <h2>${T('faq.h2')}</h2>
      <div class="mtx-ss__faq">
${FAQN.map(n => `        <details>
          <summary><h3>${T('faq.q' + n)}</h3></summary>
          <p>${T('faq.a' + n)}</p>
        </details>`).join('\n\n')}
      </div>
    </div>
  </section>`;

/* ============================================================== FINAL === */

const final = `  <section class="mtx-ss__band mtx-ss__band--ink mtx-ss__close">
    <div class="mtx-ss__shell">
      <h2>${T('final.h2')}</h2>
      <p class="mtx-ss__close-copy">${T('final.p1')}</p>
      <p class="mtx-ss__actions">
        <a class="mtx-ss__btn mtx-ss__btn--blue" href="${esc(D.booking_anchor)}">${T('final.cta')}</a>
      </p>
    </div>
  </section>`;

blockers.push('Document A section 8 requires a link to /rajadamnern-stadium but gives no anchor text for it, and '
  + 'Document B section 3 forbids writing any. The link sits on the words "Rajadamnern Stadium" inside the approved '
  + 'seat-map sentence, so no new words appear on the page. /rajadamnern-stadium-tickets is linked from the approved '
  + 'CTA "Book Your Rajadamnern Tickets". Supply anchor text for either and it will be used instead.');

blockers.push('Document A gives no destination for the four card booking buttons. They anchor to the seat-led booking '
  + 'section on this page rather than to an invented URL. Say the word and they will point at '
  + '/rajadamnern-stadium-tickets instead.');

blockers.push('Document A section 2 permits the line "There are no bad views at Rajadamnern Stadium, only different '
  + 'experiences" to appear once. It is not in the approved copy of section 4, so placing it would mean authoring a '
  + 'customer-facing sentence, which Document B section 3 forbids. It has been left out. Add it to Document A and it '
  + 'will be rendered.');

blockers.push('None of the six images can be opened from this environment, because static.tildacdn.com is blocked by '
  + 'the network policy. Every one is placed on the owner\'s instruction or his own published alt text, not on '
  + 'inspection. Whether the hero makes the seating look distant or empty, and whether any image crops away useful '
  + 'seating information, cannot be judged from here.');

writeFileSync('body.html', [hero, answer, cards, compare, guide, map, includes, booking, faq, final].join('\n\n') + '\n\n');

/* ---------- schema ----------
   Document A section 9: WebPage, BreadcrumbList, FAQPage for visible FAQs
   only, Organization where already established. No Event schema, no invented
   prices, availability, seat inventory or stadium claims. */
const schema = {
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'Organization', '@id': 'https://muaytix.com/#organisation',
      name: 'MuayTix', url: 'https://muaytix.com' },
    { '@type': 'WebPage', '@id': 'https://muaytix.com/rajadamnern-stadium-seating#webpage',
      url: 'https://muaytix.com/rajadamnern-stadium-seating',
      name: t('meta.seo_title'), description: t('meta.description'),
      isPartOf: { '@type': 'WebSite', '@id': 'https://muaytix.com/#website',
        name: 'MuayTix', url: 'https://muaytix.com',
        publisher: { '@id': 'https://muaytix.com/#organisation' } } },
    { '@type': 'BreadcrumbList', '@id': 'https://muaytix.com/rajadamnern-stadium-seating#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'MuayTix', item: 'https://muaytix.com' },
        { '@type': 'ListItem', position: 2, name: t('hero.h1'),
          item: 'https://muaytix.com/rajadamnern-stadium-seating' },
      ] },
    { '@type': 'FAQPage', '@id': 'https://muaytix.com/rajadamnern-stadium-seating#faq',
      mainEntity: FAQN.map(n => ({
        '@type': 'Question', name: t('faq.q' + n),
        acceptedAnswer: { '@type': 'Answer', text: t('faq.a' + n) } })) },
  ],
};
writeFileSync('schema.json', JSON.stringify(schema, null, 0));

writeFileSync('TILDA-PAGE-SETTINGS.txt',
`RAJADAMNERN STADIUM SEATING: what to paste into Tilda's page settings
=====================================================================
Page settings, not part of the HTML block. Every line is Document A, word for
word. Do not edit them here.


URL
/rajadamnern-stadium-seating

Document A section 3 and Document B section 5: retain this URL. It has Search
Console history and must not be changed without a migration decision.


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
console.log(`seat classes: ${CLASSES.length}, FAQ entries: ${FAQN.length}, prices checked against live inventory: 4/4`);
console.log(`\n${blockers.length} item(s) reported, not filled in:`);
blockers.forEach(b => console.log('  - ' + b));
