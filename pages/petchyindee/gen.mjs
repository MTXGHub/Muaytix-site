/* Renders both Petchyindee pages from document-a.txt.
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

/* Document B section 12: a missing asset stops and is reported, never substituted. */
if (!data.logo || !data.logo.url) throw new Error('No Petchyindee logo in dynamic-data.json. Document B section 12: STOP.');
if (!data.logo.alt) throw new Error('The Petchyindee logo has no alt text.');
reports.push('The logo alt text reads "' + data.logo.alt + '". It is the promotion name and nothing more, because no alt text was supplied for it. Change it and I will rebuild.');
/* The evergreen booking widget, per the owner, 26 September 2026: the same
   widget the page carried before, showing Petchyindee Thursdays. The widget
   marks this promotion's nights out and opens on the month holding the next
   one, but by its own design it never hides another promotion's night. */
reports.push('The evergreen page carries the promotion mount data-series="petchyindee", which opens the calendar on the month holding the next Petchyindee Thursday and marks the Thursdays out. By design the widget never hides another promotion\'s night, so a guest can still book a different night from that calendar. Making Thursdays the only bookable dates would be a change to the widget itself, which is pasted once into the site head and affects every page.');

/* The supplied logo is artwork centred in a square of solid black padding.
 * Dropped in as-is it sits inset from the heading and shows a black box on the
 * hero. The content box was measured off the file (see dynamic-data.json) and
 * the mark is cropped back to it, so the logo's left edge lines up with the h1
 * and the height below is the height of the mark itself, not of the padding.
 * Replace the file and the numbers get re-measured, not guessed. */
const LG = data.logo;
const cw = LG.content_box.right - LG.content_box.left + 1;
const ch = LG.content_box.bottom - LG.content_box.top + 1;
const boxH = LG.mark_height_px * LG.natural.h / ch;                 // rendered image height
const boxW = boxH * LG.natural.w / LG.natural.h;
const r = n => Math.round(n * 10) / 10;
const logoMark = `      <p class="mtx-pi__logo" style="height:${r(LG.mark_height_px)}px;width:${r(boxW * cw / LG.natural.w)}px">` +
  `<img class="mtx-pi__logoimg" src="${esc(LG.url)}" alt="${esc(LG.alt)}" width="${LG.natural.w}" height="${LG.natural.h}" loading="eager" decoding="async" ` +
  `style="height:${r(boxH)}px;margin:${r(-boxH * LG.content_box.top / LG.natural.h)}px 0 0 ${r(-boxW * LG.content_box.left / LG.natural.w)}px"></p>`;

function seatCards(page, keys) {
  return keys.map(k => {
    const g = data.seat_images[k];
    if (!g || !g.url) throw new Error(`Seat image missing for "${k}". Document B section 12: STOP.`);
    if (!g.alt) throw new Error(`Seat image "${k}" has no alt text.`);
    const extra = DOC[`${page}.seats.copy2.${k}`] ? `\n          <p>${esc(DOC[`${page}.seats.copy2.${k}`])}</p>` : '';
    return `        <li class="mtx-pi__card mtx-pi__card--gfx">
          <img class="mtx-pi__seatgfx" src="${esc(g.url)}" alt="${esc(g.alt)}" loading="lazy" decoding="async">
          <h3>${esc(t(page, 'seats.name.' + k))}</h3>
          <p class="mtx-pi__standfirst">${esc(t(page, 'seats.descriptor.' + k))}</p>
          <p>${esc(t(page, 'seats.copy.' + k))}</p>${extra}
        </li>`;
  }).join('\n\n');
}
function t(page, k) {
  const v = DOC[`${page}.${k}`];
  if (v === undefined || v === '') throw new Error(`document-a.txt has no copy for [${page}.${k}]`);
  return v;
}
const mapFigure = `        <p class="mtx-pi__maplayout">
          <img src="${esc(data.seat_map.url)}" alt="${esc(data.seat_map.alt)}" loading="lazy" decoding="async">
        </p>`;

/* ---------------- EVERGREEN ---------------- */
const H = k => esc(t('hub', k));
const dateCards = data.dates.map(d => {
  let cta = '';
  if (d.path) cta = `\n          <p class="mtx-pi__cardbtn"><a class="mtx-pi__btn mtx-pi__btn--blue" href="${esc(d.path)}">${H('hero.cta_primary')}</a></p>`;
  else reports.push(`No dated page exists yet for ${d.label}, so that card carries no link. Document B section 24: no invented URLs.`);
  return `        <li class="mtx-pi__datecard" data-mtx-cutoff="${esc(d.cutoff_utc)}">
          <h3>${esc(d.label)}</h3>
          <p class="mtx-pi__times">${H('facts.2')} &middot; ${H('facts.3')}</p>${cta}
        </li>`;
}).join('\n\n');

const hub = `  <header class="mtx-pi__hero">
    <div class="mtx-pi__shell">
${logoMark}
      <h1>${H('h1')}</h1>
      <p class="mtx-pi__lede">${H('hero.p1')}</p>
      <p class="mtx-pi__lede">${H('hero.p2')}</p>
      <ul class="mtx-pi__factlist">
${[1,2,3,4,5].map(n => `        <li>${H('facts.' + n)}</li>`).join('\n')}
      </ul>
      <p class="mtx-pi__actions">
        <a class="mtx-pi__btn mtx-pi__btn--blue" href="${esc(D.dated)}">${H('hero.cta_primary')}</a>
        <a class="mtx-pi__btn mtx-pi__btn--ghost" href="${esc(D.seating)}">${H('hero.cta_secondary')}</a>
      </p>
    </div>
  </header>

  <!-- The evergreen booking widget, per the owner, 26 September 2026. The
       promotion mount opens on the month holding the next Petchyindee
       Thursday and marks this promotion's nights out. -->
  <section class="mtx-pi__band mtx-pi__band--paper" id="book">
    <div class="mtx-pi__shell">
      <div class="muaytix-ticket-selector" data-series="${esc(data.series_slug)}"></div>
    </div>
  </section>

  <section class="mtx-pi__band">
    <div class="mtx-pi__shell">
      <h2>${H('what.h2')}</h2>
${[1,2,3,4,5].map(n => `      <p>${H('what.p' + n)}</p>`).join('\n')}
      <p class="mtx-pi__note">${H('exact.line')}</p>
    </div>
  </section>

  <section class="mtx-pi__band mtx-pi__band--paper">
    <div class="mtx-pi__shell">
      <h2>${H('tech.h2')}</h2>
${[1,2,3,4,5].map(n => `      <p>${H('tech.p' + n)}</p>`).join('\n')}
    </div>
  </section>

  <section class="mtx-pi__band">
    <div class="mtx-pi__shell">
      <h2>${H('thu.h2')}</h2>
${[1,2,3,4].map(n => `      <p>${H('thu.p' + n)}</p>`).join('\n')}
      <div class="mtx-pi__faq">
        <details open>
          <summary><h3>${H('thu.h3a')}</h3></summary>
          <p>${H('thu.a3a')}</p>
        </details>
        <details open>
          <summary><h3>${H('thu.h3b')}</h3></summary>
          <p>${H('thu.a3b')}</p>
        </details>
      </div>
    </div>
  </section>

  <section class="mtx-pi__band mtx-pi__band--paper">
    <div class="mtx-pi__shell">
      <h2>${H('seats.h2')}</h2>
      <ul class="mtx-pi__grid">
${seatCards('hub', ['ringside','club-class','leo-section','third-class'])}
      </ul>
${mapFigure}
      <p class="mtx-pi__ctarow">
        <a class="mtx-pi__btn mtx-pi__btn--outline" href="${esc(D.seating)}">${H('seats.cta')}</a>
      </p>
    </div>
  </section>

  <section class="mtx-pi__band">
    <div class="mtx-pi__shell">
      <h2>${H('dates.h2')}</h2>
      <ul class="mtx-pi__dates" data-mtx-dates>
${dateCards}
      </ul>
      <h3>${H('dates.h3')}</h3>
${[1,2,3,4,5].map(n => `      <p>${H('dates.p' + n)}</p>`).join('\n')}
      <p class="mtx-pi__ctarow">
        <a class="mtx-pi__btn mtx-pi__btn--blue" href="${esc(D.dated)}">${H('dates.cta_primary')}</a>
        <a class="mtx-pi__btn mtx-pi__btn--outline" href="${esc(D.tickets)}">${H('dates.cta_secondary')}</a>
      </p>
    </div>
  </section>

  <section class="mtx-pi__band mtx-pi__band--paper">
    <div class="mtx-pi__shell">
      <h2>${H('faq.h2')}</h2>
      <div class="mtx-pi__faq">
${[1,2,3,4,5,6,7].map(n => `        <details>
          <summary><h3>${H('faq.q' + n)}</h3></summary>
          <p>${H('faq.a' + n)}</p>
        </details>`).join('\n\n')}
      </div>
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

const dated = `  <header class="mtx-pi__hero">
    <div class="mtx-pi__shell">
${logoMark}
      <h1>${T('h1')}</h1>
      <p class="mtx-pi__lede">${T('hero.body')}</p>
      <dl class="mtx-pi__facts">
${['date','venue','doors','starts'].map(k =>
  `        <div class="mtx-pi__fact"><dt>${T('facts.label.' + k)}</dt><dd>${T('facts.value.' + k)}</dd></div>`).join('\n')}
      </dl>
      <p class="mtx-pi__actions">
        <a class="mtx-pi__btn mtx-pi__btn--blue" href="#book">${T('hero.cta_primary')}</a>
        <a class="mtx-pi__btn mtx-pi__btn--ghost" href="${esc(D.seating)}">${T('hero.cta_secondary')}</a>
      </p>
    </div>
  </header>

  <!-- Document B section 23: booking directly beneath the event facts. -->
  <section class="mtx-pi__band mtx-pi__band--paper" id="book">
    <div class="mtx-pi__shell">
      <div class="muaytix-ticket-selector" data-event-id="${esc(dd.event_key)}"></div>
    </div>
  </section>

  <section class="mtx-pi__band">
    <div class="mtx-pi__shell">
      <h2>${T('expect.h2')}</h2>
${[1,2,3,4].map(n => `      <p>${T('expect.p' + n)}</p>`).join('\n')}
    </div>
  </section>

  <section class="mtx-pi__band mtx-pi__band--paper">
    <div class="mtx-pi__shell">
      <h2>${T('thu.h2')}</h2>
${[1,2,3,4].map(n => `      <p>${T('thu.p' + n)}</p>`).join('\n')}
    </div>
  </section>

  <!-- Owner's instruction, 26 September 2026: no mention of a fight card on
       either page. The section and its two copy blocks are removed. -->

  <!-- The bands alternate paper and plain. Removing the fight card section
       flipped the rhythm from here down, so these four are re-alternated. -->
  <section class="mtx-pi__band">
    <div class="mtx-pi__shell">
      <h2>${T('seats.h2')}</h2>
      <!-- Three released classes sit in three columns. In a two-column grid the
           odd card left an empty cell that read as a seat class gone missing. -->
      <ul class="mtx-pi__grid${shown.length === 3 ? ' mtx-pi__grid--3' : ''}">
${seatCards('dated', shown)}
      </ul>
${mapFigure}
      <p>${T('source.intro')}</p>
      <ul class="mtx-pi__bullets">
${[1,2,3,4,5].map(n => `        <li>${T('source.' + n)}</li>`).join('\n')}
      </ul>
      <p class="mtx-pi__ctarow">
        <a class="mtx-pi__btn mtx-pi__btn--outline" href="${esc(D.seating)}">${T('seats.cta')}</a>
      </p>
    </div>
  </section>

  <section class="mtx-pi__band mtx-pi__band--paper">
    <div class="mtx-pi__shell">
      <h2>${T('plan.h2')}</h2>
${[1,2,3,4,5].map(n => `      <p>${T('plan.p' + n)}</p>`).join('\n')}
      <p class="mtx-pi__ctarow">
        <a class="mtx-pi__btn mtx-pi__btn--outline" href="${esc(D.hub)}">${T('link.hub')}</a>
        <a class="mtx-pi__btn mtx-pi__btn--outline" href="${esc(D.seating)}">${T('link.seating')}</a>
        <a class="mtx-pi__btn mtx-pi__btn--outline" href="${esc(D.stadium)}">${T('link.stadium')}</a>
        <a class="mtx-pi__btn mtx-pi__btn--outline" href="${esc(D.tickets)}">${T('link.tickets')}</a>
      </p>
    </div>
  </section>

  <section class="mtx-pi__band">
    <div class="mtx-pi__shell">
      <h2>${T('faq.h2')}</h2>
      <div class="mtx-pi__faq">
${[1,2,3,4,5,6].map(n => {
  const extra = DOC[`dated.faq.a${n}b`] ? `\n          <p>${esc(DOC[`dated.faq.a${n}b`])}</p>` : '';
  return `        <details>
          <summary><h3>${T('faq.q' + n)}</h3></summary>
          <p>${T('faq.a' + n)}</p>${extra}
        </details>`;
}).join('\n\n')}
      </div>
    </div>
  </section>

  <section class="mtx-pi__band mtx-pi__band--paper mtx-pi__close">
    <div class="mtx-pi__shell">
      <h2>${T('final.h2')}</h2>
      <p>${T('final.copy')}</p>
      <p class="mtx-pi__ctarow">
        <a class="mtx-pi__btn mtx-pi__btn--blue" href="#book">${T('final.cta')}</a>
      </p>
    </div>
  </section>
`;
writeFileSync('dated-body.html', dated);

/* ---------------- schema ---------------- */
writeFileSync('hub-schema.json', JSON.stringify({ '@context': 'https://schema.org', '@graph': [
  { '@type': 'WebPage', '@id': 'https://muaytix.com/petchyindee-muay-thai#webpage',
    url: 'https://muaytix.com/petchyindee-muay-thai', name: t('hub','meta.seo_title'), description: t('hub','meta.description') },
  { '@type': 'BreadcrumbList', itemListElement: [
    { '@type':'ListItem', position:1, name:'MuayTix', item:'https://muaytix.com/' },
    { '@type':'ListItem', position:2, name:t('hub','h1'), item:'https://muaytix.com/petchyindee-muay-thai' } ] },
  { '@type': 'FAQPage', mainEntity: [1,2,3,4,5,6,7].map(n => ({ '@type':'Question', name:t('hub','faq.q'+n),
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
    { '@type':'ListItem', position:2, name:t('hub','h1'), item:'https://muaytix.com/petchyindee-muay-thai' },
    { '@type':'ListItem', position:3, name:t('dated','h1'), item:`https://muaytix.com${dd.url}` } ] },
  { '@type': 'FAQPage', mainEntity: [1,2,3,4,5,6].map(n => ({ '@type':'Question', name:t('dated','faq.q'+n),
    acceptedAnswer:{ '@type':'Answer', text:t('dated','faq.a'+n) } })) },
]}));

for (const [page, url] of [['hub','/petchyindee-muay-thai'], ['dated','/petchyindee-muay-thai/2026-10-01']]) {
  writeFileSync(`TILDA-PAGE-SETTINGS-${page}.txt`,
`PETCHYINDEE MUAY THAI: Tilda page settings for ${url}
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
console.log(`2 pages from ${Object.keys(DOC).length} locked blocks. Hub: 4 seat cards, ${data.dates.length} dates, 7 FAQs. Dated: ${shown.length} seat cards, 6 FAQs.`);
reports.forEach(r => console.log('  - ' + r));
