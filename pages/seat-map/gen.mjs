/* Renders /rajadamnern-stadium-seat-map from document-a.txt and
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

/* Document A section 5: this page carries no price, no date and no
   availability. The map must not display temporary inventory claims, so
   nothing on it is read from live inventory at all: it links out to the
   pages that are. */
/* The four photographs carry the owner's own note as alt. The seating map has
   no note from him, so it takes Document A section 8's approved line. A null
   alt is never rendered as the string "null". */
/* Every alt string on this page is an approved line from Document A section 4,
   looked up by key. Nothing here is written by this build. The backdrop is the
   one exception and is handled on its own: Document A supplies no line for it,
   so it is marked decorative rather than given words. */
const ALT = k => t(IMG[k].alt_key);
const fig = (k, cls, swatch) =>
  `<figure class="mtx-sm__${cls}"${swatch ? ` style="--swatch: ${esc(swatch)}"` : ''}><img src="${esc(IMG[k].url)}" alt="${esc(ALT(k))}" loading="lazy" decoding="async"></figure>`;

/* ================================================================ HERO === */

/* Document A section 3: the approved seating map is the principal asset and
   must be visible immediately on desktop and mobile. It sits beside the words
   on a desktop screen and directly under them on a phone, at its own 1:1
   shape, never cropped. The annotated stadium view behind is a backdrop only. */
const hero = `  <header class="mtx-sm__hero">
    <img class="mtx-sm__hero-media" src="${esc(IMG.backdrop.url)}" alt="" aria-hidden="true" loading="eager" decoding="async">
    <div class="mtx-sm__hero-wash" aria-hidden="true"></div>
    <div class="mtx-sm__shell mtx-sm__hero-in">
      <div class="mtx-sm__hero-copy">
        <h1>${T('hero.h1')}</h1>
        <p class="mtx-sm__lede">${T('hero.p1')}</p>
        <p class="mtx-sm__lede">${T('hero.p2')}</p>
        <p class="mtx-sm__lede">${T('hero.p3')}</p>
        <p class="mtx-sm__actions">
          <a class="mtx-sm__btn mtx-sm__btn--blue" href="${esc(D.seating)}">${T('hero.cta_primary')}</a>
          <a class="mtx-sm__btn mtx-sm__btn--ghost" href="${esc(D.tickets)}">${T('hero.cta_secondary')}</a>
        </p>
      </div>
      <figure class="mtx-sm__hero-map">
        <img src="${esc(IMG.map.url)}" alt="${esc(ALT('map'))}" width="1024" height="1024" loading="eager" decoding="async">
      </figure>
    </div>
  </header>`;

/* ============================================================== ANSWER === */

const ANSN = [1, 2, 3, 4];
const answer = `  <section class="mtx-sm__band mtx-sm__band--paper">
    <div class="mtx-sm__shell mtx-sm__answer">
      <h2>${T('answer.h2')}</h2>
      <p class="mtx-sm__answer-lead">${T('answer.p1')}</p>
      <ul class="mtx-sm__where">
${ANSN.map(n => `        <li>${T('answer.list.' + n)}</li>`).join('\n')}
      </ul>
      <p class="mtx-sm__answer-close">${T('answer.p2')}</p>
    </div>
  </section>`;

/* ========================================================== MAP  BLOCK === */

/* Document A section 3's map block. The map itself is one screen above, in
   the hero, rather than repeated here; the full-size link is here, where
   Document A puts it. Reported in blockers.txt. */
const mapblock = `  <section class="mtx-sm__band mtx-sm__band--white">
    <div class="mtx-sm__shell">
      <h2>${T('map.h2')}</h2>
      <div class="mtx-sm__cols">
        <p>${T('map.p1')}</p>
        <p>${T('map.p2')}</p>
      </div>
      <p class="mtx-sm__caveat">${T('map.p3')}</p>
      <p class="mtx-sm__map-go">
        <a class="mtx-sm__go" href="${esc(D.map_full)}" target="_blank" rel="noopener">${T('map.link')}</a>
      </p>
    </div>
  </section>`;

/* ============================================================ SECTIONS === */

/* Document A sections 4, 5 and 6: a map crop beside the copy, one per class.
   Section 7, Third Class, has no approved photograph and no built page, so it
   carries its copy, no picture and no link. Document A section 7 and the
   owner's own instruction to park Third Class. */
const place = (key, img, href, linkKey, flip, swatch) => `  <section class="mtx-sm__band mtx-sm__band--${flip ? 'paper' : 'white'}">
    <div class="mtx-sm__shell">
      <h2>${T(key + '.h2')}</h2>
      <div class="mtx-sm__split${flip ? ' mtx-sm__split--flip' : ''}">
        ${img ? fig(img, 'split-fig', swatch) : ''}
        <div class="mtx-sm__split-body">
${[1, 2, 3, 4, 5].filter(n => DOC[key + '.p' + n]).map(n => `          <p>${T(key + '.p' + n)}</p>`).join('\n')}
${href ? `          <p class="mtx-sm__map-go"><a class="mtx-sm__go" href="${esc(href)}">${T(linkKey)}</a></p>` : ''}
        </div>
      </div>
    </div>
  </section>`;

/* Each crop carries its own class colour as the bar under it, taken from the
   sampled values so the bar matches the colour picked out in the crop above
   it. LEO's is the yellow even on a pale band here, because it is reading as
   a label for a yellow area of the map rather than as a rule. */
const C = data.seat_colour;
const ringside  = place('ringside',  'ringside',  D.ringside,  'ringside.link',  false, C.ringside);
const clubclass = place('clubclass', 'clubclass', D.clubclass, 'clubclass.link', true,  C.club_class);
const leo       = place('leo',       'leo',       D.leo,       'leo.link',       false, C.leo_section);
const third     = place('third',     null,        null,        null,             true,  null);

/* =============================================================== GUIDE === */

/* Document A section 8: a simple four-item guide, not the full comparison
   cards from the seating page. It sits on the dark band because one of the
   four swatches is the LEO yellow, which is not visible on a pale one. */
const GUIDEN = [1, 2, 3, 4];
const CLASS_COLOUR = ['ringside', 'club_class', 'leo_section', 'third_class'];
const guide = `  <section class="mtx-sm__band mtx-sm__band--ink">
    <div class="mtx-sm__shell">
      <h2>${T('guide.h2')}</h2>
      <ul class="mtx-sm__guide">
${GUIDEN.map(n => `        <li style="--swatch: ${esc(data.seat_colour[CLASS_COLOUR[n - 1]])}">
          <h3>${T('guide.q' + n)}</h3>
          <p class="mtx-sm__guide-where">${T('guide.w' + n)}</p>
          <p>${T('guide.a' + n)}</p>
        </li>`).join('\n')}
      </ul>
      <p class="mtx-sm__map-go"><a class="mtx-sm__go" href="${esc(D.seating)}">${T('guide.cta')}</a></p>
    </div>
  </section>`;

/* ============================================================ CAPACITY === */

/* Document A section 9: concise and factual, and not the main sales message,
   so it is a short band rather than a feature. Every figure is rendered from
   document-a.txt, including the word approximately. */
const CAPN = [1, 2, 3];
const capacity = `  <section class="mtx-sm__band mtx-sm__band--paper">
    <div class="mtx-sm__shell mtx-sm__answer">
      <h2>${T('capacity.h2')}</h2>
      <p class="mtx-sm__answer-lead">${T('capacity.p1')}</p>
      <p class="mtx-sm__answer-copy">${T('capacity.p2')}</p>
      <ul class="mtx-sm__where">
${CAPN.map(n => `        <li>${T('capacity.list.' + n)}</li>`).join('\n')}
      </ul>
      <p class="mtx-sm__caveat">${T('capacity.p3')}</p>
    </div>
  </section>`;

/* ============================================================= SEATING === */

const SEATN = [1, 2, 3, 4, 5];
const seating = `  <section class="mtx-sm__band mtx-sm__band--white">
    <div class="mtx-sm__shell">
      <h2>${T('seating.h2')}</h2>
      <ul class="mtx-sm__practical">
${SEATN.map(n => `        <li>${T('seating.' + n)}</li>`).join('\n')}
      </ul>
    </div>
  </section>`;

/* ============================================================= BOOKING === */

/* Document A section 11: the booking action comes after the visitor has
   understood the map, and its destination is the seating page. */
const booking = `  <section class="mtx-sm__band mtx-sm__band--ink" id="mtx-sm-booking">
    <div class="mtx-sm__shell">
      <h2>${T('booking.h2')}</h2>
      <p class="mtx-sm__lede">${T('booking.p1')}</p>
      <p class="mtx-sm__lede">${T('booking.p2')}</p>
      <p class="mtx-sm__actions">
        <a class="mtx-sm__btn mtx-sm__btn--blue" href="${esc(D.seating)}">${T('booking.cta')}</a>
      </p>
    </div>
  </section>`;

/* ================================================================= FAQ === */

const FAQN = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const faq = `  <section class="mtx-sm__band mtx-sm__band--paper">
    <div class="mtx-sm__shell">
      <h2>${T('faq.h2')}</h2>
      <div class="mtx-sm__faq">
${FAQN.map(n => `        <details>
          <summary><h3>${T('faq.q' + n)}</h3></summary>
          ${P('faq.a' + n)}
        </details>`).join('\n\n')}
      </div>
    </div>
  </section>`;

/* =============================================================== FINAL === */

const final = `  <section class="mtx-sm__band mtx-sm__band--ink mtx-sm__close">
    <div class="mtx-sm__shell">
      <h2>${T('final.h2')}</h2>
      <p class="mtx-sm__close-copy">${T('final.p1')}</p>
      <p class="mtx-sm__actions">
        <a class="mtx-sm__btn mtx-sm__btn--blue" href="${esc(D.seating)}">${T('final.cta')}</a>
      </p>
      <p class="mtx-sm__elsewhere">
        <a class="mtx-sm__go" href="${esc(D.ringside)}">${T('ringside.link')}</a>
        <a class="mtx-sm__go" href="${esc(D.clubclass)}">${T('clubclass.link')}</a>
        <a class="mtx-sm__go" href="${esc(D.leo)}">${T('leo.link')}</a>
        <a class="mtx-sm__go" href="${esc(D.tickets)}">${T('hero.cta_secondary')}</a>
      </p>
    </div>
  </section>`;

writeFileSync('body.html',
  [hero, answer, mapblock, ringside, clubclass, leo, third, guide, capacity, seating, booking, faq, final].join('\n\n') + '\n\n');

/* ============================================================== SCHEMA === */

/* Document A section 10 equivalent: WebPage, BreadcrumbList, FAQPage for the
   twelve visible questions, Organization. No Event schema, no prices, no
   availability, no seat numbers, no capacity claims. */
const SITE = 'https://muaytix.com';
const HERE = SITE + '/rajadamnern-stadium-seat-map';
writeFileSync('schema.json', JSON.stringify({
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'Organization', '@id': SITE + '#org', name: 'MuayTix', url: SITE },
    { '@type': 'WebPage', '@id': HERE, url: HERE, name: t('meta.social_title'),
      description: t('meta.description'), isPartOf: { '@id': SITE + '#org' },
      primaryImageOfPage: { '@type': 'ImageObject', url: IMG.map.url, caption: t('alt.map') } },
    { '@type': 'BreadcrumbList', '@id': HERE + '#crumbs', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Seating', item: SITE + D.seating },
      { '@type': 'ListItem', position: 2, name: t('hero.h1'), item: HERE },
    ] },
    { '@type': 'FAQPage', '@id': HERE + '#faq',
      mainEntity: FAQN.map(n => ({ '@type': 'Question', name: t('faq.q' + n),
        acceptedAnswer: { '@type': 'Answer', text: t('faq.a' + n) } })) },
  ],
}, null, 2));

/* ============================================================ HANDOVER === */

writeFileSync('TILDA-PAGE-SETTINGS.txt',
`RAJADAMNERN STADIUM SEAT MAP
Tilda page settings. These are NOT in the HTML block. Paste them into the
page's own settings in Tilda.

URL
  /rajadamnern-stadium-seat-map

TITLE
  ${t('meta.seo_title')}

DESCRIPTION
  ${t('meta.description')}

SOCIAL TITLE (Open Graph)
  ${t('meta.social_title')}

SOCIAL DESCRIPTION (Open Graph)
  ${t('meta.social_description')}

SOCIAL IMAGE
  ${IMG.map.url}

CANONICAL
  https://muaytix.com/rajadamnern-stadium-seat-map
`);

writeFileSync('blockers.txt', data.blockers.map(b => '- ' + b).join('\n\n') + '\n');
console.log('body.html, schema.json, TILDA-PAGE-SETTINGS.txt, blockers.txt written');
