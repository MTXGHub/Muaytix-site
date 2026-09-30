/* Renders both New Power pages from document-a.txt.
 *   node gen.mjs
 * Document B: IMPLEMENTATION ONLY. No customer-facing prose in this file. */
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
const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const data = JSON.parse(readFileSync('dynamic-data.json', 'utf8'));
const D = data.destinations;
const reports = [];

/* Four identical black-outline buttons stacked in a row read as one grey
   wall, not four different destinations -- flagged directly from a live
   screenshot, 30 September 2026. Same labels, same links, no new copy:
   just a card each, with a plain line icon so the eye can tell them apart
   before reading the text. Icons are decorative (aria-hidden) and generic,
   not brand marks. */
const ICONS = {
  info:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16.5"/><circle cx="12" cy="7.5" r="1.1" fill="currentColor" stroke="none"/></svg>',
  seat:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 18v-6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v6"/><path d="M6 18h12v2a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1z"/><path d="M8 10V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v4"/></svg>',
  pin:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-6.3 7-11.5A7 7 0 0 0 5 9.5C5 14.7 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.4"/></svg>',
  ticket:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v1.5a1.75 1.75 0 0 0 0 3.5V16a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a1.75 1.75 0 0 0 0-3.5z"/><line x1="10" y1="7" x2="10" y2="17" stroke-dasharray="2.4 2.4"/></svg>',
};
function quickLinks(rows) {
  return `      <ul class="mtx-np__quicklinks">
${rows.map(([icon, href, label]) => `        <li><a class="mtx-np__quicklink" href="${esc(href)}">` +
    `<span class="mtx-np__quicklink-i" aria-hidden="true">${ICONS[icon]}</span>` +
    `<span class="mtx-np__quicklink-t">${esc(label)}</span></a></li>`).join('\n')}
      </ul>`;
}

/* Document B section 12: a missing asset stops and is reported, never substituted. */
if (!data.logo) reports.push('No New Power logo exists anywhere in this project, so neither page shows one. Document B section 12: stop and report the missing asset, do not substitute other imagery.');

function seatCards(page, keys) {
  return keys.map(k => {
    const g = data.seat_images[k];
    if (!g || !g.url) throw new Error(`Seat image missing for "${k}". Document B section 12: STOP.`);
    if (!g.alt) throw new Error(`Seat image "${k}" has no alt text.`);
    const extra = DOC[`${page}.seats.copy2.${k}`] ? `\n          <p>${esc(DOC[`${page}.seats.copy2.${k}`])}</p>` : '';
    const link = data.seat_links && data.seat_links[k]
      ? `\n          <p class="mtx-np__cardgo"><a class="mtx-np__btn mtx-np__btn--outline" href="${esc(data.seat_links[k].href)}">${esc(data.seat_links[k].label)}</a></p>`
      : '';
    return `        <li class="mtx-np__card mtx-np__card--gfx">
          <img class="mtx-np__seatgfx" src="${esc(g.url)}" alt="${esc(g.alt)}" loading="lazy" decoding="async">
          <h3>${esc(t(page, 'seats.name.' + k))}</h3>
          <p class="mtx-np__standfirst">${esc(t(page, 'seats.descriptor.' + k))}</p>
          <p>${esc(t(page, 'seats.copy.' + k))}</p>${extra}${link}
        </li>`;
  }).join('\n\n');
}
function t(page, k) {
  const v = DOC[`${page}.${k}`];
  if (v === undefined || v === '') throw new Error(`document-a.txt has no copy for [${page}.${k}]`);
  return v;
}
const mapFigure = `        <p class="mtx-np__maplayout">
          <img src="${esc(data.seat_map.url)}" alt="${esc(data.seat_map.alt)}" loading="lazy" decoding="async">
        </p>`;

/* The hero photo is a CSS background (style.css), which has no alt attribute
   of its own. This carries the owner-supplied alt text into the DOM anyway,
   visually hidden but readable to a screen reader or a crawler. */
if (!data.hero_image || !data.hero_image.url) throw new Error('hero_image missing from dynamic-data.json. Document B section 12: STOP.');
if (!data.hero_image.alt) throw new Error('hero_image has no alt text.');
const heroAlt = `      <p class="mtx-np__plain">${esc(data.hero_image.alt)}</p>`;

/* ---------------- EVERGREEN ---------------- */
const H = k => esc(t('hub', k));
const dateCards = data.dates.map(d => {
  let cta = '';
  if (d.path) cta = `\n          <p class="mtx-np__cardbtn"><a class="mtx-np__btn mtx-np__btn--blue" href="${esc(d.path)}">${H('hero.cta_primary')}</a></p>`;
  else reports.push(`No dated page exists yet for ${d.label}, so that card carries no link. Document B section 24: no invented URLs.`);
  return `        <li class="mtx-np__datecard" data-mtx-cutoff="${esc(d.cutoff_utc)}">
          <h3>${esc(d.label)}</h3>
          <p class="mtx-np__times">${H('facts.2')} &middot; ${H('facts.3')}</p>${cta}
        </li>`;
}).join('\n\n');

const hub = `  <header class="mtx-np__hero">
${heroAlt}
    <div class="mtx-np__shell">
      <h1>${H('h1')}</h1>
      <p class="mtx-np__lede">${H('hero.p1')}</p>
      <p class="mtx-np__lede">${H('hero.p2')}</p>
      <ul class="mtx-np__factlist">
${[1,2,3,4,5,6].map(n => `        <li>${H('facts.' + n)}</li>`).join('\n')}
      </ul>
      <p class="mtx-np__actions">
        <a class="mtx-np__btn mtx-np__btn--blue" href="${esc(D.dated)}">${H('hero.cta_primary')}</a>
        <a class="mtx-np__btn mtx-np__btn--ghost" href="${esc(D.seating)}">${H('hero.cta_secondary')}</a>
      </p>
    </div>
  </header>

  <!-- The evergreen booking widget. Every other recurring-series page in this
       project (Petchyindee, and per Jason directly on 30 September 2026,
       Knockout and RWS) carries this on its evergreen page, filtered to that
       series with data-series so only New Power Wednesdays are offered. This
       page never had it: confirmed against the full git history of every
       branch in this repository, not just this file, with zero trace of a
       data-series (or any dateless) mount ever existing here. Added now. -->
  <section class="mtx-np__band mtx-np__band--paper" id="book">
    <div class="mtx-np__shell">
      <div class="muaytix-ticket-selector" data-series="${esc(data.series_slug)}"></div>
      <p class="mtx-np__ctarow">
        <a class="mtx-np__btn mtx-np__btn--outline" href="${esc(D.tickets)}">${H('dates.cta_secondary')}</a>
      </p>
    </div>
  </section>

  <section class="mtx-np__band">
    <div class="mtx-np__shell">
      <h2>${H('what.h2')}</h2>
${[1,2,3,4].map(n => `      <p>${H('what.p' + n)}</p>`).join('\n')}
    </div>
  </section>

  <section class="mtx-np__band mtx-np__band--paper">
    <div class="mtx-np__shell">
      <h2>${H('long.h2')}</h2>
${[1,2,3,4,5].map(n => `      <p>${H('long.p' + n)}</p>`).join('\n')}
    </div>
  </section>

  <section class="mtx-np__band">
    <div class="mtx-np__shell">
      <h2>${H('wed.h2')}</h2>
${[1,2,3,4].map(n => `      <p>${H('wed.p' + n)}</p>`).join('\n')}
      <div class="mtx-np__faq">
        <details open>
          <summary><h3>${H('wed.h3a')}</h3></summary>
          <p>${H('wed.a3a')}</p>
        </details>
        <details open>
          <summary><h3>${H('wed.h3b')}</h3></summary>
          <p>${H('wed.a3b')}</p>
        </details>
      </div>
    </div>
  </section>

  <section class="mtx-np__band mtx-np__band--paper">
    <div class="mtx-np__shell">
      <h2>${H('seats.h2')}</h2>
      <ul class="mtx-np__grid">
${seatCards('hub', ['ringside','club-class','leo-section','third-class'])}
      </ul>
${mapFigure}
      <p class="mtx-np__ctarow">
        <a class="mtx-np__btn mtx-np__btn--outline" href="${esc(D.seating)}">${H('seats.cta')}</a>
      </p>
    </div>
  </section>

  <section class="mtx-np__band">
    <div class="mtx-np__shell">
      <h2>${H('dates.h2')}</h2>
      <ul class="mtx-np__dates" data-mtx-dates>
${dateCards}
      </ul>
      <h3>${H('dates.h3')}</h3>
${[1,2,3,4,5].map(n => `      <p>${H('dates.p' + n)}</p>`).join('\n')}
      <p class="mtx-np__ctarow">
        <a class="mtx-np__btn mtx-np__btn--blue" href="${esc(D.dated)}">${H('dates.cta_primary')}</a>
        <a class="mtx-np__btn mtx-np__btn--outline" href="${esc(D.tickets)}">${H('dates.cta_secondary')}</a>
      </p>
    </div>
  </section>

  <section class="mtx-np__band mtx-np__band--paper">
    <div class="mtx-np__shell">
      <h2>${H('faq.h2')}</h2>
      <div class="mtx-np__faq">
${[1,2,3,4,5,6,7,8].map(n => `        <details>
          <summary><h3>${H('faq.q' + n)}</h3></summary>
          <p>${H('faq.a' + n)}</p>
        </details>`).join('\n\n')}
      </div>
      <!-- Document A: the approved placement for the awkward search wording is
           a discreet naming note. It is not repeated anywhere else. -->
      <p class="mtx-np__note">${H('naming.note')}</p>
    </div>
  </section>
`;
writeFileSync('hub-body.html', hub);

/* ---------------- DATED ---------------- */
const T = k => esc(t('dated', k));
const dd = data.dated;
const shown = Object.entries(dd.seat_classes).filter(([, v]) => v !== 'closed').map(([k]) => k);
for (const [k, v] of Object.entries(dd.seat_classes)) {
  if (v === 'closed') reports.push(`${dd.url}: ${t('dated', 'seats.name.' + k)} is not released for this date, so its card is omitted. Document A block 4 and Document B section 11.`);
}
reports.push(`${dd.url}: no verified fight card supplied, so the approved waiting message is shown and no fighter is named.`);

const dated = `  <header class="mtx-np__hero">
${heroAlt}
    <div class="mtx-np__shell">
      <h1>${T('h1')}</h1>
      <p class="mtx-np__lede">${T('hero.body')}</p>
      <dl class="mtx-np__facts">
${['date','venue','doors','starts','format','programme'].map(k =>
  `        <div class="mtx-np__fact"><dt>${T('facts.label.' + k)}</dt><dd>${T('facts.value.' + k)}</dd></div>`).join('\n')}
      </dl>
      <p class="mtx-np__actions">
        <a class="mtx-np__btn mtx-np__btn--blue" href="#book">${T('hero.cta_primary')}</a>
        <a class="mtx-np__btn mtx-np__btn--ghost" href="${esc(D.seating)}">${T('hero.cta_secondary')}</a>
      </p>
    </div>
  </header>

  <!-- Document B section 23: booking directly beneath the event facts. -->
  <section class="mtx-np__band mtx-np__band--paper" id="book">
    <div class="mtx-np__shell">
      <div class="muaytix-ticket-selector" data-event-id="${esc(dd.event_key)}"></div>
    </div>
  </section>

  <section class="mtx-np__band">
    <div class="mtx-np__shell">
      <h2>${T('expect.h2')}</h2>
${[1,2,3,4,5].map(n => `      <p>${T('expect.p' + n)}</p>`).join('\n')}
    </div>
  </section>

  <section class="mtx-np__band mtx-np__band--paper">
    <div class="mtx-np__shell">
      <h2>${T('atmos.h2')}</h2>
${[1,2,3,4].map(n => `      <p>${T('atmos.p' + n)}</p>`).join('\n')}
    </div>
  </section>

  <!-- Document B section 10: no verified card, so the approved waiting
       message only. No placeholder bouts and nothing from another date. -->
  <section class="mtx-np__band">
    <div class="mtx-np__shell">
      <h2>${T('card.h2')}</h2>
      <p class="mtx-np__note">${T('card.notice')}</p>
    </div>
  </section>

  <section class="mtx-np__band mtx-np__band--paper">
    <div class="mtx-np__shell">
      <h2>${T('seats.h2')}</h2>
      <ul class="mtx-np__grid">
${seatCards('dated', shown)}
      </ul>
${mapFigure}
      <p>${T('source.intro')}</p>
      <ul class="mtx-np__bullets">
${[1,2,3,4,5].map(n => `        <li>${T('source.' + n)}</li>`).join('\n')}
      </ul>
      <p class="mtx-np__ctarow">
        <a class="mtx-np__btn mtx-np__btn--outline" href="${esc(D.seating)}">${T('seats.cta')}</a>
      </p>
    </div>
  </section>

  <section class="mtx-np__band">
    <div class="mtx-np__shell">
      <h2>${T('plan.h2')}</h2>
${[1,2,3,4,5,6].map(n => `      <p>${T('plan.p' + n)}</p>`).join('\n')}
${quickLinks([
  ['info',   D.hub,      t('dated', 'link.hub')],
  ['seat',   D.seating,  t('dated', 'link.seating')],
  ['pin',    D.stadium,  t('dated', 'link.stadium')],
  ['ticket', D.tickets,  t('dated', 'link.tickets')],
])}
    </div>
  </section>

  <section class="mtx-np__band mtx-np__band--paper">
    <div class="mtx-np__shell">
      <h2>${T('faq.h2')}</h2>
      <div class="mtx-np__faq">
${[1,2,3,4,5,6,7,8].map(n => {
  const extra = DOC[`dated.faq.a${n}b`] ? `\n          <p>${esc(DOC[`dated.faq.a${n}b`])}</p>` : '';
  return `        <details>
          <summary><h3>${T('faq.q' + n)}</h3></summary>
          <p>${T('faq.a' + n)}</p>${extra}
        </details>`;
}).join('\n\n')}
      </div>
    </div>
  </section>

  <section class="mtx-np__band mtx-np__close">
    <div class="mtx-np__shell">
      <h2>${T('final.h2')}</h2>
      <p>${T('final.copy')}</p>
      <p class="mtx-np__ctarow">
        <a class="mtx-np__btn mtx-np__btn--blue" href="#book">${T('final.cta')}</a>
      </p>
    </div>
  </section>
`;
writeFileSync('dated-body.html', dated);

/* ---------------- schema ---------------- */
writeFileSync('hub-schema.json', JSON.stringify({ '@context': 'https://schema.org', '@graph': [
  { '@type': 'WebPage', '@id': 'https://muaytix.com/new-power-muay-thai#webpage',
    url: 'https://muaytix.com/new-power-muay-thai', name: t('hub','meta.seo_title'), description: t('hub','meta.description') },
  { '@type': 'BreadcrumbList', itemListElement: [
    { '@type':'ListItem', position:1, name:'MuayTix', item:'https://muaytix.com/' },
    { '@type':'ListItem', position:2, name:t('hub','h1'), item:'https://muaytix.com/new-power-muay-thai' } ] },
  { '@type': 'FAQPage', mainEntity: [1,2,3,4,5,6,7,8].map(n => ({ '@type':'Question', name:t('hub','faq.q'+n),
    acceptedAnswer:{ '@type':'Answer', text:t('hub','faq.a'+n) } })) },
]}));
/* Document B section 25: only verified fields. No performers, no end time,
   no price range, no availability, no rankings. */
writeFileSync('dated-schema.json', JSON.stringify({ '@context': 'https://schema.org', '@graph': [
  { '@type': 'SportsEvent', '@id': `https://muaytix.com${dd.url}#event`, name: t('dated','h1'),
    startDate: dd.start_iso, eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    description: t('dated','hero.body'),
    location: { '@type':'Place', name:'Rajadamnern Stadium',
      address:{ '@type':'PostalAddress', streetAddress:'Ratchadamnoen Nok Road', addressLocality:'Bangkok', addressCountry:'TH' } },
    image: data.seat_map.url, url: `https://muaytix.com${dd.url}` },
  { '@type': 'BreadcrumbList', itemListElement: [
    { '@type':'ListItem', position:1, name:'MuayTix', item:'https://muaytix.com/' },
    { '@type':'ListItem', position:2, name:t('hub','h1'), item:'https://muaytix.com/new-power-muay-thai' },
    { '@type':'ListItem', position:3, name:t('dated','h1'), item:`https://muaytix.com${dd.url}` } ] },
  { '@type': 'FAQPage', mainEntity: [1,2,3,4,5,6,7,8].map(n => ({ '@type':'Question', name:t('dated','faq.q'+n),
    acceptedAnswer:{ '@type':'Answer', text:t('dated','faq.a'+n) } })) },
]}));

for (const [page, url] of [['hub','/new-power-muay-thai'], ['dated','/new-power-muay-thai/2026-09-30']]) {
  writeFileSync(`TILDA-PAGE-SETTINGS-${page}.txt`,
`NEW POWER MUAY THAI: Tilda page settings for ${url}
${'='.repeat(56)}
Page settings, not part of the HTML block. Every line is Document A, word for
word. Do not edit them here.

SEO TITLE
${t(page,'meta.seo_title')}

META DESCRIPTION
${t(page,'meta.description')}

SOCIAL TITLE (Open Graph)
${t(page,'meta.social_title')}

SOCIAL DESCRIPTION (Open Graph)
${t(page,'meta.social_description')}

URL
${url}

H1
Already in the block, exactly one. Do not add another in Tilda.
`);
}

writeFileSync('reports.txt', reports.map(r => '- ' + r).join('\n') + '\n');
console.log(`2 pages from ${Object.keys(DOC).length} locked blocks. Hub: 4 seat cards, ${data.dates.length} dates, 8 FAQs. Dated: ${shown.length} seat cards, 8 FAQs.`);
reports.forEach(r => console.log('  - ' + r));
