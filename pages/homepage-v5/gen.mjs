/* Renders the homepage from document-a.txt and dynamic-data.json.
 *
 *   node gen.mjs
 *
 * Document B, task type: IMPLEMENTATION ONLY. There is deliberately not one
 * line of customer-facing prose in this file. Every visible string is looked
 * up from document-a.txt by key. If a key is missing the build stops rather
 * than substituting anything, because substituting is how approved copy gets
 * quietly rewritten.
 */
import { readFileSync, writeFileSync } from 'node:fs';

/* ---------- the locked copy ---------- */
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

/* Every read goes through here. A typo in a key fails the build; it never
   silently renders an empty element or an invented stand-in. */
function t(key) {
  const v = DOC[key];
  if (v === undefined || v === '') throw new Error(`document-a.txt has no copy for [${key}]`);
  return v;
}
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const T = key => esc(t(key));

const data = JSON.parse(readFileSync('dynamic-data.json', 'utf8'));
const week = JSON.parse(readFileSync('week.json', 'utf8'));
const D = data.destinations;

/* Anything the implementation could not complete from verified data. Reported
   at the end of the build and in the completion response, never patched over. */
const blockers = [];

/* ---------- Section 2: the dated cards ---------- */
const NIGHT_SHOW = 5;
const weekCards = week.map(r => {
  const ev = data.events[r.series_slug];
  if (!ev) throw new Error(`dynamic-data.json has no event for series "${r.series_slug}"`);
  const doors = data.doors[r.series_slug];
  if (!doors) throw new Error(`dynamic-data.json has no doors entry for "${r.series_slug}"`);

  /* Document B section 6: never infer a missing value, never guess a time
     from another event. A night with no published doors time simply does not
     show one. */
  const times = doors.time
    ? `          <p class="mtx-hp__times">Doors ${esc(doors.time)} &middot; First bout ${esc(r.bell)}</p>\n`
    : '';
  if (!doors.time) blockers.push(`Doors time for ${ev.name} (${r.local_date}) is not published anywhere. The card shows the first bout only.`);

  /* Document B section 10: do not invent a URL and do not redirect an
     approved anchor to a similar page. No page, no button. */
  let cta = '';
  if (ev.path) {
    cta = `          <p class="mtx-hp__nightcta"><a class="mtx-hp__btn mtx-hp__btn--outline" href="${esc(ev.path)}/${esc(r.local_date)}">${T('week.cta.' + r.series_slug)}</a></p>\n`;
  } else {
    blockers.push(`No destination exists for ${ev.name} (${r.local_date}). Document A gives the CTA "${t('week.cta.' + r.series_slug)}" but no URL, so the card renders without a button.`);
  }

  return `        <li class="mtx-hp__night" data-mtx-date="${esc(r.local_date)}" data-mtx-cutoff="${esc(r.cutoff_utc)}">
          <h3>${esc(ev.name)}</h3>
          <p class="mtx-hp__when">${esc(r.weekday)} ${esc(r.day_label)}</p>
${times}          <p class="mtx-hp__evbody">${T('week.desc.' + r.series_slug)}</p>
${cta}        </li>`;
}).join('\n');

/* ---------- Section 3: the five event cards ---------- */
const NIGHT_ORDER = ['rajadamnern-knockout', 'new-power', 'petchyindee', 'rws', 'kiatpetch'];
const nightCards = NIGHT_ORDER.map(k => {
  const ev = data.events[k];
  const rws = k === 'rws' ? ' mtx-hp__ev--rws' : '';
  const btn = k === 'rws' ? 'mtx-hp__btn--blue' : 'mtx-hp__btn--outline';
  return `        <li class="mtx-hp__ev${rws}">
          <h3>${esc(ev.name)}</h3>
          <p class="mtx-hp__hook">${T('nights.hook.' + k)}</p>
          <p class="mtx-hp__evbody">${T('nights.copy.' + k)}</p>
          <p class="mtx-hp__evwhen">${T('nights.schedule.' + k)}</p>
          <p class="mtx-hp__evcta"><a class="mtx-hp__btn ${btn}" href="${esc(ev.path)}">${T('nights.cta.' + k)}</a></p>
        </li>`;
}).join('\n\n');

/* ---------- Section 4: the seat cards ---------- */
const SEATS = ['ringside', 'club-class', 'leo-section', 'third-class'];
const img = JSON.parse(readFileSync('seat-images.json', 'utf8'));
const seatCards = SEATS.map(k => {
  const gfx = img[k] || {};
  /* Document B section 16: alt text describes the image and introduces no
     claim. It is supplied, not composed here. */
  const figure = gfx.url
    ? `          <img class="mtx-hp__seatgfx" src="${esc(gfx.url)}" alt="${esc(gfx.alt)}" loading="lazy" decoding="async">\n`
    : '';
  if (!gfx.url) blockers.push(`Seat graphic for ${t('seats.name.' + k)} has no hosted URL yet, so that card renders without an image.`);
  return `        <li class="mtx-hp__card${gfx.url ? ' mtx-hp__card--gfx' : ''}">
${figure}          <h3>${T('seats.name.' + k)}</h3>
          <p class="mtx-hp__standfirst">${T('seats.descriptor.' + k)}</p>
          <p>${T('seats.copy.' + k)}</p>
          <p class="mtx-hp__cardbtn"><a class="mtx-hp__btn mtx-hp__btn--outline" href="${D.seating}#${k}">${T('seats.cta.' + k)}</a></p>
        </li>`;
}).join('\n\n');

/* ---------- Section 5: trust ---------- */
const TRUST = [
  ['official', '<path d="M12 2.8l7.5 3v6.1c0 4.3-3 8.2-7.5 9.3-4.5-1.1-7.5-5-7.5-9.3V5.8z"/><path d="M8.8 12.2l2.3 2.3 4.2-4.6"/>'],
  ['groups',   '<circle cx="9" cy="8" r="3.2"/><path d="M2.8 20c0-3.4 2.8-5.6 6.2-5.6s6.2 2.2 6.2 5.6"/><circle cx="17.6" cy="9.2" r="2.4"/><path d="M17.6 14c2.2 0 3.6 1.4 3.6 3.4"/>'],
  ['currency', '<rect x="2.5" y="5.5" width="19" height="13" rx="2"/><path d="M2.5 10h19"/><path d="M6 14.6h3.5"/>'],
  ['qr',       '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v3M17 20h4M14 20h1"/>'],
  ['support',  '<path d="M20.5 12a8.5 8.5 0 1 1-3.4-6.8"/><path d="M8.8 12.3l2.4 2.4 5.3-5.6"/>'],
];
const trustCards = TRUST.map(([k, svg]) => {
  const extra = k === 'qr' ? `\n          <p>${T('trust.copy.qr2')}</p>` : '';
  const cta = k === 'support'
    ? `\n          <p class="mtx-hp__cardbtn"><a class="mtx-hp__btn mtx-hp__btn--outline" href="${esc(D.whatsapp)}" rel="noopener">${T('trust.cta.support')}</a></p>` : '';
  return `        <li class="mtx-hp__trustcard${k === 'qr' ? ' mtx-hp__trustcard--wide' : ''}">
          <svg viewBox="0 0 24 24" aria-hidden="true">${svg}</svg>
          <h3>${T('trust.name.' + k)}</h3>
          <p>${T('trust.copy.' + k)}</p>${extra}${cta}
        </li>`;
}).join('\n\n');

/* ---------- Section 6: the five steps ---------- */
const steps = [1, 2, 3, 4, 5].map(n =>
  `          <li class="mtx-hp__step"><p>${T('guide.step' + n)}</p></li>`).join('\n');
const support = [1, 2, 3, 4, 5, 6, 7].map(n =>
  `      <p>${T('guide.support' + n)}</p>`).join('\n');

/* ---------- Section 7: the questions ---------- */
const faq = [1, 2, 3, 4, 5, 6].map(n =>
  `        <details>
          <summary><h3>${T('faq.q' + n)}</h3></summary>
          <p>${T('faq.a' + n)}</p>
        </details>`).join('\n\n');

const body = `  <header class="mtx-hp__hero">
    <div class="mtx-hp__shell">
      <h1>${T('hero.h1')}</h1>
      <p class="mtx-hp__lede">${T('hero.body1')}</p>
      <p class="mtx-hp__lede">${T('hero.body2')}</p>
      <p class="mtx-hp__actions">
        <a class="mtx-hp__btn mtx-hp__btn--blue" href="${esc(D.tickets)}">${T('hero.cta_primary')}</a>
        <a class="mtx-hp__btn mtx-hp__btn--ghost" href="@@TONIGHT@@" data-mtx-tonight>${T('hero.cta_secondary')}</a>
      </p>
    </div>
  </header>

  <section class="mtx-hp__band mtx-hp__band--paper">
    <div class="mtx-hp__shell">
      <span class="mtx-hp__kicker">${T('week.eyebrow')}</span>
      <h2>${T('week.h2')}</h2>
      <p>${T('week.intro')}</p>
      <ul class="mtx-hp__nights" data-mtx-week>
${weekCards}
      </ul>
      <p class="mtx-hp__ctarow">
        <a class="mtx-hp__btn mtx-hp__btn--outline" href="${esc(D.tickets)}">${T('week.section_cta')}</a>
      </p>
    </div>
  </section>

  <section class="mtx-hp__band">
    <div class="mtx-hp__shell">
      <h2>${T('nights.h2')}</h2>
      <p>${T('nights.intro')}</p>
      <ul class="mtx-hp__evs">
${nightCards}
      </ul>
    </div>
  </section>

  <section class="mtx-hp__band mtx-hp__band--paper">
    <div class="mtx-hp__shell">
      <h2>${T('seats.h2')}</h2>
      <p>${T('seats.intro')}</p>
      <ul class="mtx-hp__grid">
${seatCards}
      </ul>
      <p class="mtx-hp__ctarow">
        <a class="mtx-hp__btn mtx-hp__btn--outline" href="${esc(D.seating)}">${T('seats.section_cta')}</a>
      </p>
    </div>
  </section>

  <section class="mtx-hp__band">
    <div class="mtx-hp__shell">
      <h2>${T('trust.h2')}</h2>
      <ul class="mtx-hp__trustgrid">
${trustCards}
      </ul>
    </div>
  </section>

  <section class="mtx-hp__band mtx-hp__band--paper">
    <div class="mtx-hp__shell">
      <h2>${T('guide.h2')}</h2>
      <p>${T('guide.intro')}</p>
      <ol class="mtx-hp__steps">
${steps}
      </ol>
${support}
      <p class="mtx-hp__ctarow">
        <a class="mtx-hp__btn mtx-hp__btn--blue" href="${esc(D.tickets)}">${T('guide.cta')}</a>
      </p>
    </div>
  </section>

  <section class="mtx-hp__band">
    <div class="mtx-hp__shell">
      <h2>${T('faq.h2')}</h2>
      <div class="mtx-hp__faq">
${faq}
      </div>
    </div>
  </section>

  <section class="mtx-hp__band mtx-hp__band--dark">
    <div class="mtx-hp__shell">
      <h2>${T('stadium.h2')}</h2>
      <div class="mtx-hp__venue">
        <div>
          <p>${T('stadium.copy1')}</p>
          <p>${T('stadium.copy2')}</p>
          <p>${T('stadium.copy3')}</p>
        </div>
        <div class="mtx-hp__where">
          <p class="mtx-hp__ctastack">
            <a class="mtx-hp__btn mtx-hp__btn--ghost" href="${esc(D.stadium)}">${T('stadium.cta1')}</a>
            <a class="mtx-hp__btn mtx-hp__btn--ghost" href="${esc(D.seating)}">${T('stadium.cta2')}</a>
            <a class="mtx-hp__btn mtx-hp__btn--ghost" href="${esc(D.maps)}" target="_blank" rel="noopener">${T('stadium.cta3')}</a>
          </p>
        </div>
      </div>
    </div>
  </section>

  <section class="mtx-hp__band mtx-hp__band--paper mtx-hp__close">
    <div class="mtx-hp__shell">
      <h2>${T('final.h2')}</h2>
      <p>${T('final.copy1')}</p>
      <p>${T('final.copy2')}</p>
      <p class="mtx-hp__ctarow">
        <a class="mtx-hp__btn mtx-hp__btn--blue" href="${esc(D.tickets)}">${T('final.cta')}</a>
      </p>
      <p class="mtx-hp__brand">${T('brand.line')}</p>
    </div>
  </section>
`;

writeFileSync('body.html', body);

/* The hero's second CTA before any script runs. Document A: a verified current
   dated-event page, never a hard-coded expired URL. It is the first night in
   the verified schedule, written at build time. */
const first = week[0];
const firstPath = data.events[first.series_slug].path;
if (!firstPath) {
  blockers.push(`The soonest night (${first.local_date}) has no destination, so the hero's secondary CTA cannot be pointed at it.`);
}
writeFileSync('tonight.txt', firstPath ? `${firstPath}/${first.local_date}` : D.tickets);

/* ---------- schema ----------
   Built from the same locked copy, so the FAQ answers a machine reads and the
   ones a guest reads cannot drift apart. Nothing is invented to fill a field:
   no logo, no sameAs, no Event, no offers, no prices. */
const schema = {
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'Organization', '@id': 'https://muaytix.com/#organisation',
      name: 'MuayTix', url: 'https://muaytix.com',
      description: t('trust.copy.official'),
      areaServed: { '@type': 'Country', name: 'Thailand' },
      contactPoint: [{ '@type': 'ContactPoint', contactType: 'customer support',
        url: D.whatsapp, availableLanguage: 'English' }] },
    { '@type': 'WebPage', '@id': 'https://muaytix.com/#webpage',
      url: 'https://muaytix.com', name: t('meta.seo_title'),
      description: t('meta.description'),
      isPartOf: { '@type': 'WebSite', '@id': 'https://muaytix.com/#website',
        name: 'MuayTix', url: 'https://muaytix.com',
        publisher: { '@id': 'https://muaytix.com/#organisation' } } },
    { '@type': 'FAQPage', '@id': 'https://muaytix.com/#faq',
      mainEntity: [1, 2, 3, 4, 5, 6].map(n => ({
        '@type': 'Question', name: t('faq.q' + n),
        acceptedAnswer: { '@type': 'Answer', text: t('faq.a' + n) } })) },
  ],
};
writeFileSync('schema.json', JSON.stringify(schema, null, 0));

/* Page settings, written from the same locked source so the metadata a
   crawler sees and the copy in document-a.txt cannot drift apart. */
writeFileSync('TILDA-PAGE-SETTINGS.txt',
`MUAYTIX HOMEPAGE: what to paste into Tilda's page settings
==========================================================
These are page settings, not part of the HTML block. Page settings for "/".
Every line below is Document A, word for word. Do not edit them here.


SEO TITLE
${t('meta.seo_title')}


META DESCRIPTION
${t('meta.description')}


SOCIAL TITLE (Open Graph)
${t('meta.social_title')}


SOCIAL DESCRIPTION (Open Graph)
${t('meta.social_description')}


CANONICAL
Keep the existing homepage URL. Do not create a new homepage slug.


H1
Already in the block, and there is exactly one. Do not add another in Tilda.
`);

writeFileSync('blockers.txt', blockers.length ? blockers.map(b => '- ' + b).join('\n') + '\n' : '');
console.log(`body.html written from ${Object.keys(DOC).length} locked copy blocks`);
console.log(`week cards: ${week.length} (${NIGHT_SHOW} shown), event cards: ${NIGHT_ORDER.length}, seat cards: ${SEATS.length}`);
if (blockers.length) { console.log(`\n${blockers.length} item(s) reported, not filled in:`); blockers.forEach(b => console.log('  - ' + b)); }
