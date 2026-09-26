/* Renders both dated Rajadamnern Knockout pages from document-a.txt.
 *
 *   node gen.mjs
 *
 * Document B: IMPLEMENTATION ONLY. No customer-facing prose in this file.
 * Every visible string is a lookup; a missing key stops the build.
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
const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

const data = JSON.parse(readFileSync('dynamic-data.json', 'utf8'));
const D = data.destinations;
const reports = [];

for (const [id, page] of Object.entries(data.pages)) {
  /* Look-up that prefers the page's own block and falls back to the shared
     one. A key missing from both stops the build rather than rendering blank. */
  const t = k => {
    const v = DOC[`${id}.${k}`] ?? DOC[`common.${k}`];
    if (v === undefined || v === '') throw new Error(`document-a.txt has no copy for [${id}.${k}] or [common.${k}]`);
    return v;
  };
  const T = k => esc(t(k));

  const facts = ['date','venue','doors','first','bouts','rounds','finish'].map(k =>
    `          <div class="mtx-kd__fact"><dt>${T('facts.label.' + k)}</dt><dd>${T('facts.value.' + k)}</dd></div>`).join('\n');

  const sched = [1,2,3,4,5,6].map(n =>
    `        <li class="mtx-kd__step">
          <p class="mtx-kd__steptime">${T('sched.time' + n)}</p>
          <h3>${T('sched.title' + n)}</h3>
          <p>${T('sched.body' + n)}</p>
        </li>`).join('\n\n');

  const shown = Object.entries(page.seat_classes).filter(([, v]) => v !== 'closed').map(([k]) => k);
  for (const [k, v] of Object.entries(page.seat_classes)) {
    if (v === 'closed') reports.push(`${page.url}: ${t('seats.name.' + k)} is not released for this date, so its card is omitted. Document A section 5 and Document B section 12.`);
  }
  const seats = shown.map(k => {
    const g = data.seat_images[k];
    /* Document B section 10: a missing asset stops the build, never a substitute. */
    if (!g || !g.url) throw new Error(`Seat image missing for "${k}". Document B section 10: STOP and report.`);
    if (!g.alt) throw new Error(`Seat image "${k}" has no alt text.`);
    return `        <li class="mtx-kd__card mtx-kd__card--gfx">
          <img class="mtx-kd__seatgfx" src="${esc(g.url)}" alt="${esc(g.alt)}" loading="lazy" decoding="async">
          <h3>${T('seats.name.' + k)}</h3>
          <p class="mtx-kd__standfirst">${T('seats.descriptor.' + k)}</p>
          <p>${T('seats.copy.' + k)}</p>
        </li>`;
  }).join('\n\n');

  const sources = [1,2,3,4,5].map(n => `          <li>${T('booking.source' + n)}</li>`).join('\n');

  const mtx = [['together', 1], ['live', 1], ['payment', 1], ['qr', 3], ['whatsapp', 1]].map(([k, n]) => {
    const body = n === 3 ? [1,2,3].map(i => `          <p>${T(`mtx.copy.${k}${i}`)}</p>`).join('\n')
                         : `          <p>${T('mtx.copy.' + k)}</p>`;
    const cta = k === 'whatsapp'
      ? `\n          <p class="mtx-kd__cardbtn"><a class="mtx-kd__btn mtx-kd__btn--outline" href="${esc(D.whatsapp)}" rel="noopener">${T('mtx.cta')}</a></p>` : '';
    return `        <li class="mtx-kd__trustcard${n === 3 ? ' mtx-kd__trustcard--wide' : ''}">
          <h3>${T('mtx.h3.' + k)}</h3>
${body}${cta}
        </li>`;
  }).join('\n\n');

  const faq = [1,2,3,4,5,6,7].map(n =>
    `        <details>
          <summary><h3>${T('faq.q' + n)}</h3></summary>
          <p>${T('faq.a' + n)}</p>
        </details>`).join('\n\n');

  /* Document B section 9: no verified card for either date. */
  reports.push(`${page.url}: no verified fight card supplied, so the approved waiting message is shown and no fighter is named.`);

  const body = `  <header class="mtx-kd__hero">
    <div class="mtx-kd__shell">
      <h1>${T('h1')}</h1>
      <p class="mtx-kd__lede">${T('hero.body')}</p>
      <dl class="mtx-kd__facts">
${facts}
      </dl>
      <p class="mtx-kd__actions">
        <a class="mtx-kd__btn mtx-kd__btn--blue" href="#book">${T('hero.cta_primary')}</a>
        <a class="mtx-kd__btn mtx-kd__btn--ghost" href="#schedule">${T('hero.cta_secondary')}</a>
      </p>
    </div>
  </header>

  <!-- Document B section 19: the booking route sits directly beneath the
       opening event facts, with nothing between the visitor and the tickets. -->
  <section class="mtx-kd__band mtx-kd__band--paper" id="book">
    <div class="mtx-kd__shell">
      <div class="muaytix-ticket-selector" data-event-id="${esc(page.event_key)}"></div>
    </div>
  </section>

  <section class="mtx-kd__band">
    <div class="mtx-kd__shell">
      <h2>${T('explain.h2')}</h2>
      <p>${T('explain.p1')}</p>
      <p>${T('explain.p2')}</p>
      <p>${T('explain.p3')}</p>
    </div>
  </section>

  <section class="mtx-kd__band mtx-kd__band--paper" id="schedule">
    <div class="mtx-kd__shell">
      <h2>${T('sched.h2')}</h2>
      <ol class="mtx-kd__steps">
${sched}
      </ol>
      <p class="mtx-kd__note">${T('sched.note')}</p>
    </div>
  </section>

  <!-- Document B section 9: no fighter names. Nothing is carried over from the
       22 September card. -->
  <section class="mtx-kd__band">
    <div class="mtx-kd__shell">
      <h2>${T('card.h2')}</h2>
      <p class="mtx-kd__note">${T('card.notice')}</p>
    </div>
  </section>

  <section class="mtx-kd__band mtx-kd__band--paper">
    <div class="mtx-kd__shell">
      <h2>${T('seats.h2')}</h2>
      <ul class="mtx-kd__grid">
${seats}
      </ul>
      <p class="mtx-kd__ctarow">
        <a class="mtx-kd__btn mtx-kd__btn--outline" href="${esc(D.seating)}">${T('seats.cta')}</a>
      </p>
    </div>
  </section>

  <section class="mtx-kd__band">
    <div class="mtx-kd__shell">
      <h2>${T('booking.h2')}</h2>
      <p>${T('booking.copy')}</p>
      <p>${T('booking.source_intro')}</p>
      <ul class="mtx-kd__bullets">
${sources}
      </ul>
      <p class="mtx-kd__ctarow">
        <a class="mtx-kd__btn mtx-kd__btn--blue" href="#book">${T('booking.cta')}</a>
      </p>
    </div>
  </section>

  <section class="mtx-kd__band mtx-kd__band--paper">
    <div class="mtx-kd__shell">
      <h2>${T('mtx.h2')}</h2>
      <ul class="mtx-kd__trustgrid">
${mtx}
      </ul>
    </div>
  </section>

  <section class="mtx-kd__band">
    <div class="mtx-kd__shell">
      <h2>${T('faq.h2')}</h2>
      <div class="mtx-kd__faq">
${faq}
      </div>
    </div>
  </section>

  <section class="mtx-kd__band mtx-kd__band--paper mtx-kd__close">
    <div class="mtx-kd__shell">
      <h2>${T('final.h2')}</h2>
      <p>${T('final.copy')}</p>
      <p class="mtx-kd__ctarow">
        <a class="mtx-kd__btn mtx-kd__btn--blue" href="#book">${T('final.cta')}</a>
      </p>
      <p class="mtx-kd__ctarow">
        <a class="mtx-kd__btn mtx-kd__btn--outline" href="${esc(D.knockout)}">${esc(data.document_b_anchors.knockout)}</a>
      </p>
    </div>
  </section>
`;
  writeFileSync(`${id}-body.html`, body);

  /* Document B section 22: only verified fields. No performers (none
     confirmed), no exact end time, no price range, no availability, no
     championship status, no organiser. */
  const schema = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'SportsEvent', '@id': `https://muaytix.com${page.url}#event`,
      name: t('h1'), startDate: page.start_iso,
      eventStatus: 'https://schema.org/EventScheduled',
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      description: t('hero.body'),
      location: { '@type': 'Place', name: 'Rajadamnern Stadium',
        address: { '@type': 'PostalAddress', streetAddress: 'Ratchadamnoen Nok Road', addressLocality: 'Bangkok', addressCountry: 'TH' } },
      image: data.seat_images['ringside'].url,
      url: `https://muaytix.com${page.url}` },
    { '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'MuayTix', item: 'https://muaytix.com/' },
      { '@type': 'ListItem', position: 2, name: data.document_b_anchors.knockout, item: `https://muaytix.com${D.knockout}` },
      { '@type': 'ListItem', position: 3, name: t('h1'), item: `https://muaytix.com${page.url}` } ] },
    { '@type': 'FAQPage', mainEntity: [1,2,3,4,5,6,7].map(n => ({
      '@type': 'Question', name: t('faq.q' + n),
      acceptedAnswer: { '@type': 'Answer', text: t('faq.a' + n) } })) },
  ]};
  writeFileSync(`${id}-schema.json`, JSON.stringify(schema));

  writeFileSync(`TILDA-PAGE-SETTINGS-${id}.txt`,
`RAJADAMNERN KNOCKOUT: Tilda page settings for ${page.url}
${'='.repeat(56)}
Page settings, not part of the HTML block. Every line is Document A, word for
word. Do not edit them here.

SEO TITLE
${t('meta.seo_title')}

META DESCRIPTION
${t('meta.description')}

SOCIAL TITLE (Open Graph)
${t('meta.social_title')}

SOCIAL DESCRIPTION (Open Graph)
${t('meta.social_description')}

URL
${page.url}

H1
Already in the block, exactly one. Do not add another in Tilda.
`);
  console.log(`${id}: ${shown.length} seat cards, 7 FAQs, widget ${page.event_key}`);
}

writeFileSync('reports.txt', reports.map(r => '- ' + r).join('\n') + '\n');
console.log(`\nRendered 2 pages from ${Object.keys(DOC).length} locked copy blocks`);
reports.forEach(r => console.log('  - ' + r));
