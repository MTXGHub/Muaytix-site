/* Renders both All Star pages from document-a.txt and dynamic-data.json.
 *
 *   node gen.mjs
 *
 * Document B, task type: IMPLEMENTATION ONLY. There is deliberately no
 * customer-facing prose in this file. Every visible string is looked up by
 * key. A missing key stops the build rather than substituting anything.
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
const T = k => esc(t(k));

const data = JSON.parse(readFileSync('dynamic-data.json', 'utf8'));
const D = data.destinations;
const A = data.document_b_anchors;
const reports = [];

/* ---------- shared: seat cards ---------- */
function seatCards(page, keys) {
  return keys.map(k => {
    const gfx = data.seat_images[k];
    /* Document B section 8: if an expected image cannot be located, stop. */
    if (!gfx) throw new Error(`No seat image supplied for "${k}". Document B section 8: stop, do not substitute.`);
    if (!gfx.url) throw new Error(`Seat image for "${k}" has no url.`);
    if (!gfx.alt) throw new Error(`Seat image for "${k}" has no alt text.`);
    return `        <li class="mtx-as__card mtx-as__card--gfx">
          <img class="mtx-as__seatgfx" src="${esc(gfx.url)}" alt="${esc(gfx.alt)}" loading="lazy" decoding="async">
          <h3>${T(`${page}.seats.name.${k}`)}</h3>
          <p class="mtx-as__standfirst">${T(`${page}.seats.descriptor.${k}`)}</p>
          <p>${T(`${page}.seats.copy.${k}`)}</p>
        </li>`;
  }).join('\n\n');
}

function faq(page, n) {
  return Array.from({ length: n }, (_, i) => i + 1).map(i => {
    const extra = ['a3b', 'a3c', 'a4b']
      .filter(x => DOC[`${page}.faq.${x}`] && x.startsWith('a' + i))
      .map(x => `\n          <p>${T(`${page}.faq.${x}`)}</p>`).join('');
    return `        <details>
          <summary><h3>${T(`${page}.faq.q${i}`)}</h3></summary>
          <p>${T(`${page}.faq.a${i}`)}</p>${extra}
        </details>`;
  }).join('\n\n');
}

function factsRow(page, keys) {
  return keys.map(k => `          <div class="mtx-as__fact">
            <dt>${T(`${page}.facts.label.${k}`)}</dt>
            <dd>${T(`${page}.facts.value.${k}`)}</dd>
          </div>`).join('\n');
}

/* ================= PAGE 1: EVERGREEN HUB ================= */
const dateCards = data.dates.map(d => {
  let cta = '';
  if (d.path) {
    cta = `\n          <p class="mtx-as__cardbtn"><a class="mtx-as__btn mtx-as__btn--outline" href="${esc(d.path)}">${T('hub.dates.cta')}</a></p>`;
  } else {
    reports.push(`No dated page exists yet for ${d.label}, so that card carries no "${t('hub.dates.cta')}" link. Document B section 12: no invented URLs.`);
  }
  return `        <li class="mtx-as__datecard" data-mtx-cutoff="${esc(d.cutoff_utc)}">
          <h3>${esc(d.label)}</h3>
          <p class="mtx-as__times">${T('hub.facts.label.doors')} ${esc(d.doors)} &middot; ${T('dated.facts.label.starts')} ${esc(d.starts)}</p>${cta}
        </li>`;
}).join('\n\n');

const hub = `  <header class="mtx-as__hero">
    <div class="mtx-as__shell">
      <h1>${T('hub.h1')}</h1>
      <p class="mtx-as__lede">${T('hub.hero.body')}</p>
      <p class="mtx-as__actions">
        <a class="mtx-as__btn mtx-as__btn--blue" href="${esc(D.dated)}">${T('hub.hero.cta_primary')}</a>
        <a class="mtx-as__btn mtx-as__btn--ghost" href="${esc(D.seating)}">${T('hub.hero.cta_secondary')}</a>
      </p>
    </div>
  </header>

  <section class="mtx-as__band mtx-as__band--paper">
    <div class="mtx-as__shell">
      <h2>${T('hub.facts.h2')}</h2>
      <dl class="mtx-as__facts">
${factsRow('hub', ['event', 'venue', 'schedule', 'format', 'rounds', 'doors'])}
      </dl>
      <p class="mtx-as__note">${T('hub.facts.note')}</p>
    </div>
  </section>

  <section class="mtx-as__band">
    <div class="mtx-as__shell">
      <h2>${T('hub.what.h2')}</h2>
      <p>${T('hub.what.p1')}</p>
      <p>${T('hub.what.p2')}</p>
      <p>${T('hub.what.p3')}</p>
      <p>${T('hub.what.p4')}</p>
      <p>${T('hub.what.p5')}</p>
    </div>
  </section>

  <section class="mtx-as__band mtx-as__band--paper">
    <div class="mtx-as__shell">
      <h2>${T('hub.diff.h2')}</h2>
      <p>${T('hub.diff.p1')}</p>
      <p>${T('hub.diff.p2')}</p>
      <p>${T('hub.diff.p3')}</p>
      <p>${T('hub.diff.p4')}</p>
      <p>${T('hub.diff.p5')}</p>
    </div>
  </section>

  <section class="mtx-as__band">
    <div class="mtx-as__shell">
      <h2>${T('hub.intl.h2')}</h2>
      <p>${T('hub.intl.p1')}</p>
      <p>${T('hub.intl.p2')}</p>
      <p>${T('hub.intl.p3')}</p>
      <p>${T('hub.intl.p4')}</p>
    </div>
  </section>

  <section class="mtx-as__band mtx-as__band--paper">
    <div class="mtx-as__shell">
      <h2>${T('hub.format.h2')}</h2>
      <p>${T('hub.format.p1')}</p>
      <p>${T('hub.format.p2')}</p>
      <p>${T('hub.format.p3')}</p>
    </div>
  </section>

  <section class="mtx-as__band">
    <div class="mtx-as__shell">
      <h2>${T('hub.role.h2')}</h2>
      <p>${T('hub.role.p1')}</p>
      <p>${T('hub.role.p2')}</p>
      <p>${T('hub.role.p3')}</p>
      <p>${T('hub.role.p4')}</p>
    </div>
  </section>

  <section class="mtx-as__band mtx-as__band--paper">
    <div class="mtx-as__shell">
      <h2>${T('hub.versus.h2')}</h2>
      <p>${T('hub.versus.p1')}</p>
      <p>${T('hub.versus.p2')}</p>
      <p>${T('hub.versus.p3')}</p>
      <p>${T('hub.versus.p4')}</p>
      <p>${T('hub.versus.p5')}</p>
      <p class="mtx-as__ctarow">
        <a class="mtx-as__btn mtx-as__btn--outline" href="${esc(D.knockout)}">${T('hub.versus.cta')}</a>
      </p>
    </div>
  </section>

  <section class="mtx-as__band">
    <div class="mtx-as__shell">
      <h2>${T('hub.seats.h2')}</h2>
      <ul class="mtx-as__grid">
${seatCards('hub', ['ringside', 'club-class', 'leo-section', 'third-class'])}
      </ul>
      <p class="mtx-as__ctarow">
        <a class="mtx-as__btn mtx-as__btn--outline" href="${esc(D.seating)}">${T('hub.seats.cta')}</a>
      </p>
    </div>
  </section>

  <section class="mtx-as__band mtx-as__band--paper">
    <div class="mtx-as__shell">
      <h2>${T('hub.dates.h2')}</h2>
      <ul class="mtx-as__dates" data-mtx-dates>
${dateCards}
      </ul>
      <p class="mtx-as__ctarow">
        <a class="mtx-as__btn mtx-as__btn--outline" href="${esc(D.tickets)}">${esc(A.tickets)}</a>
      </p>
    </div>
  </section>

  <section class="mtx-as__band">
    <div class="mtx-as__shell">
      <h2>${T('hub.faq.h2')}</h2>
      <div class="mtx-as__faq">
${faq('hub', 7)}
      </div>
    </div>
  </section>

  <section class="mtx-as__band mtx-as__band--paper mtx-as__close">
    <div class="mtx-as__shell">
      <h2>${T('hub.final.h2')}</h2>
      <p>${T('hub.final.copy')}</p>
      <p class="mtx-as__ctarow">
        <a class="mtx-as__btn mtx-as__btn--blue" href="${esc(D.dated)}">${T('hub.final.cta')}</a>
      </p>
    </div>
  </section>
`;
writeFileSync('hub-body.html', hub);

/* ================= PAGE 2: DATED EVENT ================= */
const shown = Object.entries(data.dated_seat_classes)
  .filter(([k, v]) => v !== 'closed' && k !== '_note').map(([k]) => k);
for (const [k, v] of Object.entries(data.dated_seat_classes)) {
  if (k === '_note') continue;
  if (v === 'closed') reports.push(`${t(`dated.seats.name.${k}`)} is not released for 28 September, so its card is omitted from the dated page. Document B section 10.`);
}

const dated = `  <header class="mtx-as__hero">
    <div class="mtx-as__shell">
      <h1>${T('dated.h1')}</h1>
      <p class="mtx-as__lede">${T('dated.hero.body')}</p>
      <dl class="mtx-as__facts mtx-as__facts--hero">
${factsRow('dated', ['date', 'venue', 'doors', 'starts', 'bouts', 'rounds'])}
      </dl>
      <p class="mtx-as__actions">
        <a class="mtx-as__btn mtx-as__btn--blue" href="#book">${T('dated.hero.cta')}</a>
      </p>
    </div>
  </header>

  <!-- Document B section 23: the booking component sits immediately beneath the
       opening event facts, with no informational material between the visitor
       and the tickets. -->
  <section class="mtx-as__band mtx-as__band--paper" id="book">
    <div class="mtx-as__shell">
      <div class="muaytix-ticket-selector" data-event-id="${esc(data.event_key)}"></div>
    </div>
  </section>

  <section class="mtx-as__band">
    <div class="mtx-as__shell">
      <h2>${T('dated.explain.h2')}</h2>
      <p>${T('dated.explain.p1')}</p>
      <p>${T('dated.explain.p2')}</p>
      <p>${T('dated.explain.p3')}</p>
      <p>${T('dated.explain.link_intro')} <a href="${esc(D.hub)}">${T('dated.explain.link_anchor')}</a></p>
      <p>${T('dated.explain.p4')}</p>
    </div>
  </section>

  <section class="mtx-as__band mtx-as__band--paper">
    <div class="mtx-as__shell">
      <h2>${T('dated.expect.h2')}</h2>
      <p>${T('dated.expect.p1')}</p>
      <p>${T('dated.expect.p2')}</p>
      <p>${T('dated.expect.p3')}</p>
    </div>
  </section>

  <!-- Document B section 7: no confirmed card, so the approved waiting message
       is shown. No placeholder fighters and no names taken from artwork. -->
  <section class="mtx-as__band">
    <div class="mtx-as__shell">
      <h2>${T('dated.card.h2')}</h2>
      <p class="mtx-as__note">${T('dated.card.notice')}</p>
    </div>
  </section>

  <section class="mtx-as__band mtx-as__band--paper">
    <div class="mtx-as__shell">
      <h2>${T('dated.why.h2')}</h2>
      <p>${T('dated.why.p1')}</p>
      <p>${T('dated.why.p2')}</p>
      <p>${T('dated.why.p3')}</p>
      <p class="mtx-as__ctarow">
        <a class="mtx-as__btn mtx-as__btn--blue" href="#book">${T('dated.why.cta')}</a>
      </p>
    </div>
  </section>

  <section class="mtx-as__band">
    <div class="mtx-as__shell">
      <h2>${T('dated.seats.h2')}</h2>
      <ul class="mtx-as__grid">
${seatCards('dated', shown)}
      </ul>
      <p class="mtx-as__ctarow">
        <a class="mtx-as__btn mtx-as__btn--outline" href="${esc(D.seating)}">${T('dated.seats.cta')}</a>
      </p>
    </div>
  </section>

  <section class="mtx-as__band mtx-as__band--paper">
    <div class="mtx-as__shell">
      <h2>${T('dated.arrival.h2')}</h2>
      <p>${T('dated.arrival.p1')}</p>
      <p>${T('dated.arrival.p2')}</p>
      <p>${T('dated.arrival.p3')}</p>
      <p>${T('dated.arrival.p4')}</p>
      <p class="mtx-as__ctarow">
        <a class="mtx-as__btn mtx-as__btn--outline" href="${esc(D.maps)}" target="_blank" rel="noopener">${T('dated.arrival.cta')}</a>
      </p>
    </div>
  </section>

  <section class="mtx-as__band">
    <div class="mtx-as__shell">
      <h2>${T('dated.faq.h2')}</h2>
      <div class="mtx-as__faq">
${faq('dated', 6)}
      </div>
    </div>
  </section>

  <section class="mtx-as__band mtx-as__band--paper">
    <div class="mtx-as__shell">
      <h2>${T('dated.search.h2')}</h2>
      <p>${T('dated.search.p1')}</p>
      <p>${T('dated.search.p2')}</p>
    </div>
  </section>

  <section class="mtx-as__band mtx-as__close">
    <div class="mtx-as__shell">
      <h2>${T('dated.final.h2')}</h2>
      <p>${T('dated.final.copy')}</p>
      <p class="mtx-as__ctarow">
        <a class="mtx-as__btn mtx-as__btn--blue" href="#book">${T('dated.final.cta')}</a>
      </p>
    </div>
  </section>
`;
writeFileSync('dated-body.html', dated);

/* ---------- schema ---------- */
const hubSchema = { '@context': 'https://schema.org', '@graph': [
  { '@type': 'WebPage', '@id': 'https://muaytix.com/all-star-fight-by-buakaw#webpage',
    url: 'https://muaytix.com/all-star-fight-by-buakaw', name: t('hub.meta.seo_title'),
    description: t('hub.meta.description') },
  { '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'MuayTix', item: 'https://muaytix.com/' },
    { '@type': 'ListItem', position: 2, name: t('hub.h1'), item: 'https://muaytix.com/all-star-fight-by-buakaw' } ] },
  { '@type': 'FAQPage', mainEntity: [1,2,3,4,5,6,7].map(n => ({
    '@type': 'Question', name: t(`hub.faq.q${n}`),
    acceptedAnswer: { '@type': 'Answer', text: t(`hub.faq.a${n}`) } })) },
]};
/* Document B section 20: only verified fields. No performers (none confirmed),
   no end time, no price range, no availability, no championships. */
const datedSchema = { '@context': 'https://schema.org', '@graph': [
  { '@type': 'SportsEvent', '@id': 'https://muaytix.com/all-star-fight-by-buakaw/2026-09-28#event',
    name: t('dated.h1'), startDate: '2026-09-28T19:00:00+07:00',
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    description: t('dated.hero.body'),
    location: { '@type': 'Place', name: 'Rajadamnern Stadium',
      address: { '@type': 'PostalAddress', streetAddress: 'Ratchadamnoen Nok Road',
        addressLocality: 'Bangkok', addressCountry: 'TH' } },
    image: data.seat_images['ringside'].url,
    url: 'https://muaytix.com/all-star-fight-by-buakaw/2026-09-28' },
  { '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'MuayTix', item: 'https://muaytix.com/' },
    { '@type': 'ListItem', position: 2, name: t('hub.h1'), item: 'https://muaytix.com/all-star-fight-by-buakaw' },
    { '@type': 'ListItem', position: 3, name: t('dated.h1'), item: 'https://muaytix.com/all-star-fight-by-buakaw/2026-09-28' } ] },
  { '@type': 'FAQPage', mainEntity: [1,2,3,4,5,6].map(n => ({
    '@type': 'Question', name: t(`dated.faq.q${n}`),
    acceptedAnswer: { '@type': 'Answer', text: t(`dated.faq.a${n}`) } })) },
]};
writeFileSync('hub-schema.json', JSON.stringify(hubSchema));
writeFileSync('dated-schema.json', JSON.stringify(datedSchema));

/* ---------- page settings ---------- */
for (const [page, url] of [['hub', '/all-star-fight-by-buakaw'], ['dated', '/all-star-fight-by-buakaw/2026-09-28']]) {
  writeFileSync(`TILDA-PAGE-SETTINGS-${page}.txt`,
`ALL STAR FIGHT: Tilda page settings for ${url}
${'='.repeat(50)}
Page settings, not part of the HTML block. Every line is Document A, word for
word. Do not edit them here.

SEO TITLE
${t(`${page}.meta.seo_title`)}

META DESCRIPTION
${t(`${page}.meta.description`)}

SOCIAL TITLE (Open Graph)
${t(`${page}.meta.social_title`)}

SOCIAL DESCRIPTION (Open Graph)
${t(`${page}.meta.social_description`)}

URL
${url}

H1
Already in the block, exactly one. Do not add another in Tilda.
`);
}

writeFileSync('reports.txt', reports.length ? reports.map(r => '- ' + r).join('\n') + '\n' : '');
console.log(`Rendered 2 pages from ${Object.keys(DOC).length} locked copy blocks`);
console.log(`Hub: 4 date cards (${data.dates.filter(d => d.path).length} linked), 4 seat cards, 7 FAQs`);
console.log(`Dated: ${shown.length} seat cards, 6 FAQs, booking widget for ${data.event_key}`);
if (reports.length) { console.log(`\n${reports.length} item(s) reported:`); reports.forEach(r => console.log('  - ' + r)); }
