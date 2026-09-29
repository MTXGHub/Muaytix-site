/* Renders the Rajadamnern Stadium Seats TRIAL page from document-a.txt and
 * dynamic-data.json.
 *
 *   node gen.mjs && node build.mjs
 *
 * This is a trial, built from a self-contained page spec supplied 29
 * September 2026. Section 0 of that spec: "You have no say in the copy...
 * If you believe a line is wrong, stop and report it. Do not fix it." So,
 * as with every other page in this repository: not one line of
 * customer-facing prose is written here. Every visible string is looked up
 * from document-a.txt by key, and a missing key stops the build rather than
 * being substituted.
 *
 * It does not touch pages/seating-v2, the live page. Nothing here is live
 * until it is pasted into Tilda, and this is a trial Jason asked to look at
 * first, not a replacement.
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
const A = data.accent;

const blockers = [];

/* ================================================================ TILE 1 === */

const tile1 = `  <header class="mtx-rss__hero">
    <div class="mtx-rss__shell mtx-rss__hero-in">
      <div class="mtx-rss__hero-copy">
        <p class="mtx-rss__eyebrow">${T('t1.eyebrow')}</p>
        <h1>${T('t1.h1')}</h1>
        <p class="mtx-rss__lede">${T('t1.lede')}</p>
        <p class="mtx-rss__detail">${T('t1.detail')}</p>
        <p class="mtx-rss__actions">
          <a class="mtx-rss__btn mtx-rss__btn--primary" href="${esc(D.booking_anchor)}">${T('t1.btn_primary')}</a>
          <a class="mtx-rss__btn mtx-rss__btn--secondary-dark" href="${esc(D.compare_anchor)}">${T('t1.btn_secondary')}</a>
        </p>
      </div>
      <figure class="mtx-rss__hero-fig">
        <img src="${esc(IMG.hero.url)}" alt="${T('t1.alt')}" loading="eager" decoding="async">
      </figure>
    </div>
  </header>`;

/* ================================================================ TILE 2 === */

const ROWS2 = [
  ['row1', 'ringside'], ['row2', 'club_class'], ['row3', 'leo_section'], ['row4', 'third_class'],
];
const tile2 = `  <section class="mtx-rss__band mtx-rss__band--off" id="compare">
    <div class="mtx-rss__shell">
      <p class="mtx-rss__eyebrow">${T('t2.eyebrow')}</p>
      <h2>${T('t2.h2')}</h2>
      <p class="mtx-rss__body">${T('t2.body')}</p>
      <div class="mtx-rss__tablewrap">
        <table class="mtx-rss__table">
          <thead>
            <tr>
              <th scope="col">${T('t2.th.class')}</th>
              <th scope="col">${T('t2.th.sections')}</th>
              <th scope="col">${T('t2.th.price')}</th>
              <th scope="col">${T('t2.th.seat')}</th>
              <th scope="col">${T('t2.th.best')}</th>
            </tr>
          </thead>
          <tbody>
${ROWS2.map(([row, accentKey]) => `            <tr style="--seat:${esc(A[accentKey])}">
              <th scope="row" data-label="${T('t2.th.class')}"><span class="mtx-rss__swatch" aria-hidden="true"></span>${T('t2.' + row + '.class')}</th>
              <td data-label="${T('t2.th.sections')}">${T('t2.' + row + '.sections')}</td>
              <td data-label="${T('t2.th.price')}">${T('t2.' + row + '.price')}</td>
              <td data-label="${T('t2.th.seat')}">${T('t2.' + row + '.seat')}</td>
              <td data-label="${T('t2.th.best')}">${T('t2.' + row + '.best')}</td>
            </tr>`).join('\n')}
          </tbody>
        </table>
      </div>
      <p class="mtx-rss__detail">${T('t2.detail')}</p>
    </div>
  </section>`;

/* ================================================================ TILE 3 === */

const tile3 = `  <section class="mtx-rss__band mtx-rss__band--white">
    <div class="mtx-rss__shell">
      <p class="mtx-rss__eyebrow">${T('t3.eyebrow')}</p>
      <h2>${T('t3.h2')}</h2>
      <div class="mtx-rss__callout">
        <p>${T('t3.lede')}</p>
      </div>
      <p class="mtx-rss__body">${T('t3.body')}</p>
      <p class="mtx-rss__linkrow"><a class="mtx-rss__link" href="${esc(D.booking_anchor)}">${T('t3.link')}</a></p>
    </div>
  </section>`;

/* ============================================================ TILES 4-7 === */

/* Tiles 4 to 7 share one shape: image one side, a coloured card the other,
   mirrored class by class exactly as the spec lays out (image left on 4 and
   6, right on 5 and 7). Third Class (Tile 7) has only the primary button --
   the spec gives it no secondary, because its own page does not exist yet. */
function classTile(n, key, accentKey, mirror, secondary) {
  const img = `        <figure class="mtx-rss__class-fig">
          <img src="${esc(IMG[key].url)}" alt="${T('t' + n + '.alt')}" loading="lazy" decoding="async">
        </figure>`;
  const body = `        <div class="mtx-rss__class-body" style="--seat:${esc(A[accentKey])}">
          <p class="mtx-rss__eyebrow">${T('t' + n + '.eyebrow')}</p>
          <h3>${T('t' + n + '.h3')}</h3>
          <p class="mtx-rss__stats">
            <span class="mtx-rss__stat">${T('t' + n + '.stat1')}</span>
            <span class="mtx-rss__stat">${T('t' + n + '.stat2')}</span>
          </p>
          <p class="mtx-rss__body">${T('t' + n + '.body1')}</p>
          <p class="mtx-rss__body">${T('t' + n + '.body2')}</p>
          <p class="mtx-rss__detail">${T('t' + n + '.detail')}</p>
          <p class="mtx-rss__actions">
            <a class="mtx-rss__btn mtx-rss__btn--primary" href="${esc(D.booking_anchor)}">${T('t' + n + '.btn_primary')}</a>
${secondary ? `            <a class="mtx-rss__btn mtx-rss__btn--secondary-light" href="${esc(secondary.href)}">${T(secondary.key)}</a>\n` : ''}          </p>
        </div>`;
  return `  <section class="mtx-rss__band mtx-rss__band--${mirror ? 'white' : 'off'}">
    <div class="mtx-rss__shell">
      <div class="mtx-rss__class${mirror ? ' mtx-rss__class--mirror' : ''}">
${mirror ? [body, img].join('\n') : [img, body].join('\n')}
      </div>
    </div>
  </section>`;
}

const tile4 = classTile(4, 'ringside',   'ringside',    false, { href: D.ringside,   key: 't4.btn_secondary' });
const tile5 = classTile(5, 'club-class', 'club_class',  true,  { href: D['club-class'], key: 't5.btn_secondary' });
const tile6 = classTile(6, 'leo-section','leo_section', false, { href: D['leo-section'], key: 't6.btn_secondary' });
if (!data.third_class_page_exists)
  blockers.push('Third Class has no page yet, so Tile 7 has no secondary button, exactly as the spec\'s own layout note for that tile asks for ("one primary button only, because Third Class opens on demand"). Its primary button anchors to #booking, matching the spec\'s Tile 7 button.');
const tile7 = classTile(7, 'third-class', 'third_class', true,  null);

/* ================================================================ TILE 8 === */

/* The widget mount. Its own month-selection logic (checked in widget.js
   before this was written) already opens on the first month that actually
   has a bookable night, sorted from state.months, not blindly on today's
   calendar month. So the spec's Tile 8 note is already satisfied by the
   existing embed; nothing here works around anything. */
const tile8 = `  <section class="mtx-rss__band mtx-rss__band--off" id="booking">
    <div class="mtx-rss__shell">
      <p class="mtx-rss__eyebrow">${T('t8.eyebrow')}</p>
      <h2>${T('t8.h2')}</h2>
      <p class="mtx-rss__body">${T('t8.body')}</p>
      <div class="mtx-rss__widget"><div class="muaytix-ticket-selector"></div></div>
      <p class="mtx-rss__detail">${T('t8.detail')}</p>
    </div>
  </section>`;

/* ================================================================ TILE 9 === */

const BULLETS9 = [
  ['t9.bullet1', 'ringside'], ['t9.bullet2', 'club_class'],
  ['t9.bullet3', 'leo_section'], ['t9.bullet4', 'third_class'],
];
const tile9 = `  <section class="mtx-rss__band mtx-rss__band--white">
    <div class="mtx-rss__shell">
      <div class="mtx-rss__around">
        <div class="mtx-rss__around-copy">
          <p class="mtx-rss__eyebrow">${T('t9.eyebrow')}</p>
          <h2>${T('t9.h2')}</h2>
          <p class="mtx-rss__body">${T('t9.body')}</p>
          <ul class="mtx-rss__bullets">
${BULLETS9.map(([key, accentKey]) => `            <li style="--seat:${esc(A[accentKey])}">${T(key)}</li>`).join('\n')}
          </ul>
          <p class="mtx-rss__detail">${T('t9.detail')}</p>
          <p class="mtx-rss__actions">
            <a class="mtx-rss__btn mtx-rss__btn--secondary-light" href="${esc(D.seat_map)}">${T('t9.btn')}</a>
          </p>
        </div>
        <figure class="mtx-rss__around-fig">
          <img src="${esc(IMG.map.url)}" alt="${T('t9.alt')}" loading="lazy" decoding="async">
        </figure>
      </div>
    </div>
  </section>`;

/* =============================================================== TILE 10 === */

const CARDS10 = [1, 2, 3, 4];
const tile10 = `  <section class="mtx-rss__band mtx-rss__band--off">
    <div class="mtx-rss__shell">
      <p class="mtx-rss__eyebrow">${T('t10.eyebrow')}</p>
      <h2>${T('t10.h2')}</h2>
      <ul class="mtx-rss__includes">
${CARDS10.map(n => `        <li>
          <h3>${T('t10.card' + n + '.h3')}</h3>
          <p>${T('t10.card' + n + '.body')}</p>
        </li>`).join('\n')}
      </ul>
    </div>
  </section>`;

/* =============================================================== TILE 11 === */

const POINTS11 = [1, 2, 3, 4];
const tile11 = `  <section class="mtx-rss__band mtx-rss__band--white mtx-rss__trust">
    <div class="mtx-rss__shell">
      <h2>${T('t11.h2')}</h2>
      <ul class="mtx-rss__trustgrid">
${POINTS11.map(n => `        <li>${T('t11.point' + n)}</li>`).join('\n')}
      </ul>
    </div>
  </section>`;

/* =============================================================== TILE 12 === */

const FAQN = Array.from({ length: 12 }, (_, i) => i + 1);
const tile12 = `  <section class="mtx-rss__band mtx-rss__band--off">
    <div class="mtx-rss__shell">
      <p class="mtx-rss__eyebrow">${T('t12.eyebrow')}</p>
      <h2>${T('t12.h2')}</h2>
      <div class="mtx-rss__faq">
${FAQN.map(n => `        <details>
          <summary><h3>${T('t12.q' + n)}</h3></summary>
          <p>${T('t12.a' + n)}</p>
        </details>`).join('\n\n')}
      </div>
    </div>
  </section>`;

/* =============================================================== TILE 13 === */

const tile13 = `  <section class="mtx-rss__band mtx-rss__band--ink mtx-rss__close">
    <div class="mtx-rss__shell">
      <h2>${T('t13.h2')}</h2>
      <p class="mtx-rss__lede">${T('t13.lede')}</p>
      <p class="mtx-rss__actions">
        <a class="mtx-rss__btn mtx-rss__btn--primary" href="${esc(D.booking_anchor)}">${T('t13.btn')}</a>
      </p>
    </div>
  </section>`;

writeFileSync('body.html',
  [tile1, tile2, tile3, tile4, tile5, tile6, tile7, tile8, tile9, tile10, tile11, tile12, tile13]
    .join('\n\n') + '\n\n');

/* ==================================================================== SCHEMA === */

/* Section 5: one FAQPage block containing all twelve questions, verbatim.
   No other schema on this page beyond whatever Organization schema the site
   template already carries, which this fragment does not touch. */
const SITE = 'https://muaytix.com';
const HERE = SITE + '/rajadamnern-stadium-seating';
writeFileSync('schema.json', JSON.stringify({
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'FAQPage', '@id': HERE + '#faq',
      mainEntity: FAQN.map(n => ({ '@type': 'Question', name: t('t12.q' + n),
        acceptedAnswer: { '@type': 'Answer', text: t('t12.a' + n) } })) },
  ],
}, null, 2));

/* ================================================================ HANDOVER === */

writeFileSync('TILDA-PAGE-SETTINGS.txt',
`RAJADAMNERN STADIUM SEATS -- TRIAL
This is a trial build, not a replacement. Jason asked to see it before any
decision is made. Do not paste this over the live seating page.

If it is approved and pasted:

TITLE
  ${t('meta.title')}

DESCRIPTION
  ${t('meta.description')}

SOCIAL TITLE / DESCRIPTION
  Same as above (the spec says og:title and og:description are identical).

CANONICAL
  https://muaytix.com/rajadamnern-stadium-seating
`);

writeFileSync('blockers.txt', blockers.map(b => '- ' + b).join('\n\n') + '\n');
console.log('body.html, schema.json, TILDA-PAGE-SETTINGS.txt, blockers.txt written');
