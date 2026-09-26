/* Renders /rajadamnern-stadium-tickets from document-a.txt.
 *   node gen.mjs
 * Master Copy Brief, 27 September 2026. No guest-facing prose in this file. */
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
function t(k) {
  const v = DOC[k];
  if (v === undefined || v === '') throw new Error(`document-a.txt has no copy for [${k}]`);
  return v;
}
const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const T = k => esc(t(k));
const data = JSON.parse(readFileSync('dynamic-data.json', 'utf8'));
const D = data.destinations;
const reports = [];

/* The brief marks these [VERIFY] and says do not publish them unguessed. */
reports.push('The VIP line and the nearest MRT station are both off the page, confirmed by the owner on 27 September. Nothing outstanding on either.');
reports.push('FAQ 5 reads "just over half of MuayTix guests choose it", the owner\'s wording of 27 September, in place of the brief\'s 39 per cent. The booking record supports it: 57.4 per cent of tickets and 54.8 per cent of bookings are Club Class.');
reports.push('Knockout on Monday, Tuesday and Friday reads "9:00 to 9:30 PM", the owner\'s range of 27 September. The brief said 9:30 PM flat and event_calendar holds a 21:00 end.');
reports.push('Four event names on the page are the brief\'s, and the database spells them differently: "All Star Fight by Buakaw" against "All Star Elite Fighter by Buakaw", and New Power, Petchyindee and Kiatpetch "Muay Thai" against "Traditional Muay Thai" in the database. The brief\'s names are published. Worth making the two agree so the widget and the page say the same thing.');
reports.push('Stadium capacity of about 3,078, no pillars and no restricted-view seats comes from your fact sheet. I have no way to check it from here and have published it as supplied.');
reports.push('The sell-out guide in Block 5 and the "can sell out by midday" line are published word for word from the brief. They are the scarcity-style claims I flagged on /rws/tickets and I still cannot verify them from the booking data. Your call, published as written.');
reports.push('Sections 7 and 8 of the brief, the footer anchor change and the redirects, are Tilda jobs. They are listed separately in tilda-jobs.txt because I cannot do them from here.');

const rows = data.nights.map(n => {
  const ev = `<a class="mtx-rt__tlink" href="${esc(n.href)}">${esc(n.event)}</a>` +
    (n.extra_href ? ` <a class="mtx-rt__tlink" href="${esc(n.extra_href)}">${T('nights.rws_link')}</a>` : '');
  return `          <tr>
            <th scope="row">${esc(n.day)}</th>
            <td>${ev}</td>
            <td>${esc(n.doors)}</td>
            <td>${esc(n.first)}</td>
            <td>${esc(n.finish)}</td>
          </tr>`;
}).join('\n');

const SEATS = ['ringside','club-class','leo-section','third-class'];
const priceRows = SEATS.map(k => `          <tr>
            <th scope="row">${T('prices.row.' + k + '.name')}</th>
            <td>${T('prices.row.' + k + '.sections')}</td>
            <td>${T('prices.row.' + k + '.price')}</td>
            <td>${T('prices.row.' + k + '.seating')}</td>
          </tr>`).join('\n');

const FAQ = [1,2,3,4,5,6,7,8,9,10,11,12];

const page = `  <header class="mtx-rt__hero">
    <div class="mtx-rt__shell">
      <h1>${T('hero.h1')}</h1>
      <p class="mtx-rt__lede">${T('hero.body')}</p>
      <p class="mtx-rt__detail">${T('hero.detail')}</p>
      <p class="mtx-rt__ctarow">
        <a class="mtx-rt__btn mtx-rt__btn--red" href="#booking">${T('hero.cta_primary')}</a>
        <a class="mtx-rt__btn mtx-rt__btn--ghost" href="#prices">${T('hero.cta_secondary')}</a>
      </p>
    </div>
  </header>

  <section class="mtx-rt__band mtx-rt__band--paper" id="prices">
    <div class="mtx-rt__shell">
      <h2>${T('prices.h2')}</h2>
      <p>${T('prices.body')}</p>
      <div class="mtx-rt__tablewrap">
        <table class="mtx-rt__table">
          <thead><tr>
            <th scope="col">${T('prices.th.class')}</th>
            <th scope="col">${T('prices.th.sections')}</th>
            <th scope="col">${T('prices.th.price')}</th>
            <th scope="col">${T('prices.th.seating')}</th>
          </tr></thead>
          <tbody>
${priceRows}
          </tbody>
        </table>
      </div>
      <p class="mtx-rt__note">${T('prices.note')}</p>
      <p class="mtx-rt__detail">${T('prices.detail')}</p>
    </div>
  </section>

  <section class="mtx-rt__band">
    <div class="mtx-rt__shell">
      <h2>${T('nights.h2')}</h2>
      <p>${T('nights.body')}</p>
      <div class="mtx-rt__tablewrap">
        <table class="mtx-rt__table">
          <thead><tr>
            <th scope="col">${T('nights.th.night')}</th>
            <th scope="col">${T('nights.th.event')}</th>
            <th scope="col">${T('nights.th.doors')}</th>
            <th scope="col">${T('nights.th.first')}</th>
            <th scope="col">${T('nights.th.finish')}</th>
          </tr></thead>
          <tbody>
${rows}
          </tbody>
        </table>
      </div>
      <p class="mtx-rt__note">${T('nights.allstar')}</p>
      <p class="mtx-rt__detail">${T('nights.detail')}</p>
    </div>
  </section>

  <section class="mtx-rt__band mtx-rt__band--paper" id="booking">
    <div class="mtx-rt__shell">
      <h2>${T('book.h2')}</h2>
      <p>${T('book.body')}</p>
      <div class="muaytix-ticket-selector"></div>
      <p class="mtx-rt__detail">${T('book.note')}</p>
    </div>
  </section>

  <section class="mtx-rt__band">
    <div class="mtx-rt__shell">
      <h2>${T('door.h2')}</h2>
      <p>${T('door.body')}</p>
      <ul class="mtx-rt__bullets">
${[1,2,3,4].map(n => `        <li>${T('door.sellout.' + n)}</li>`).join('\n')}
      </ul>
      <p class="mtx-rt__detail">${T('door.detail')}</p>
    </div>
  </section>

  <section class="mtx-rt__band mtx-rt__band--paper">
    <div class="mtx-rt__shell">
      <h2>${T('map.h2')}</h2>
      <p>${T('map.body')}</p>
      <figure class="mtx-rt__maplayout">
        <img src="${esc(data.seat_map.url)}" alt="${T('map.alt')}" loading="lazy" decoding="async">
      </figure>
      <p class="mtx-rt__ctarow">
        <a class="mtx-rt__btn mtx-rt__btn--outline" href="${esc(D.seating)}">${T('map.link_compare')}</a>
        <a class="mtx-rt__btn mtx-rt__btn--outline" href="${esc(D.seat_map)}">${T('map.link_map')}</a>
      </p>
      <p class="mtx-rt__detail">${T('map.detail')}</p>
    </div>
  </section>

  <section class="mtx-rt__band">
    <div class="mtx-rt__shell">
      <h2>${T('how.h2')}</h2>
      <ol class="mtx-rt__steps">
${[1,2,3,4].map(n => `        <li>
          <span class="mtx-rt__stepno">${n}</span>
          <h3>${T('how.' + n + '.h')}</h3>
          <p>${T('how.' + n + '.p')}</p>
        </li>`).join('\n')}
      </ol>
      <p class="mtx-rt__detail">${T('how.detail')}</p>
    </div>
  </section>

  <section class="mtx-rt__band mtx-rt__band--paper">
    <div class="mtx-rt__shell">
      <h2>${T('who.h2')}</h2>
      <p>${T('who.body')}</p>
      <ul class="mtx-rt__grid">
${[1,2,3,4].map(n => `        <li class="mtx-rt__card">
          <h3>${T('who.' + n + '.h')}</h3>
          <p>${T('who.' + n + '.p')}</p>
        </li>`).join('\n')}
      </ul>
    </div>
  </section>

  <section class="mtx-rt__band">
    <div class="mtx-rt__shell">
      <h2>${T('go.h2')}</h2>
      <p>${T('go.body')}</p>
      <p class="mtx-rt__detail">${T('go.detail')}</p>
      <p class="mtx-rt__ctarow">
        <a class="mtx-rt__btn mtx-rt__btn--outline" href="${esc(D.stadium)}">${T('go.link')}</a>
      </p>
    </div>
  </section>

  <section class="mtx-rt__band mtx-rt__band--paper">
    <div class="mtx-rt__shell">
      <h2>${T('faq.h2')}</h2>
      <div class="mtx-rt__faq">
${FAQ.map(n => `        <details>
          <summary><h3>${T('faq.q' + n)}</h3></summary>
          <p>${T('faq.a' + n)}</p>
        </details>`).join('\n\n')}
      </div>
    </div>
  </section>

  <section class="mtx-rt__band mtx-rt__close">
    <div class="mtx-rt__shell">
      <h2>${T('close.h2')}</h2>
      <p class="mtx-rt__lede">${T('close.body')}</p>
      <p class="mtx-rt__ctarow">
        <a class="mtx-rt__btn mtx-rt__btn--red" href="#booking">${T('close.cta')}</a>
      </p>
    </div>
  </section>
`;
writeFileSync('body.html', page);

/* FAQPage schema: all twelve questions and answers, verbatim, as the brief
 * requires. No Event schema on this page: that belongs on the dated pages. */
const schema = { '@context': 'https://schema.org', '@type': 'FAQPage',
  mainEntity: FAQ.map(n => ({ '@type': 'Question', name: t('faq.q' + n),
    acceptedAnswer: { '@type': 'Answer', text: t('faq.a' + n) } })) };
writeFileSync('schema.json', JSON.stringify(schema));

writeFileSync('reports.txt', reports.map(r => '- ' + r).join('\n') + '\n');
console.log(`${Object.keys(DOC).length} locked blocks. 4 price rows, ${data.nights.length} night rows, ${FAQ.length} FAQs.`);
reports.forEach(r => console.log('  - ' + r));
