/* Renders the RWS Knocktoberfest page from copy.json.
 *
 *   node gen.mjs && node build.mjs
 *
 * Every visible string is looked up in copy.json. A missing key stops the
 * build. This file decides presentation only: structure, classes, order.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const C = JSON.parse(readFileSync('copy.json', 'utf8'));
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const need = (o, k) => { if (o[k] === undefined) throw new Error('copy.json is missing ' + k); return o[k]; };

const BOOK = '#mtx-kt-book';
const EVENT_KEY = 'rws_2026_10_10';

const img = (k, cls, { eager = false } = {}) => {
  const i = need(C.images, k);
  return `<img class="${cls}" src="${esc(i.url)}" alt="${esc(i.alt)}" width="${i.w}" height="${i.h}" ${eager ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"'} decoding="async">`;
};

const chev = `<svg class="mtx-kt-chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M6 9l6 6 6-6"></path></svg>`;
const tick = `<svg class="mtx-kt-tick" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M5 12.5l4.5 4.5L19 7.5"></path></svg>`;
const lock = `<svg class="mtx-kt-tick" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="4" y="11" width="16" height="10" rx="2"></rect><path d="M8 11V7a4 4 0 0 1 8 0v4"></path></svg>`;

/* -------------------------------------------------------- utility bar -- */
const utility = `  <div class="mtx-kt-util"><ul class="mtx-kt-wrap mtx-kt-util-in">
${need(C, 'utility').map(t => `    <li>${esc(t)}</li>`).join('\n')}
  </ul></div>`;

/* ---------------------------------------------------------------- hero -- */
const H = need(C, 'hero');
const hero = `  <header class="mtx-kt-hero">
    <div class="mtx-kt-wrap mtx-kt-hero-in">
      <div class="mtx-kt-hero-text">
        <h1 class="mtx-kt-h1">${esc(H.h1)}</h1>
        <p class="mtx-kt-when"><span>${esc(H.date)}</span><span>${esc(H.venue)}</span></p>
        <p class="mtx-kt-cta-row"><a class="mtx-kt-btn" href="${BOOK}">${esc(H.cta)}</a></p>
        <ul class="mtx-kt-facts">
${H.facts.map(f => `          <li class="mtx-kt-fact">${f.label ? `<span class="mtx-kt-fact-l">${esc(f.label)}</span> ` : ''}<span class="mtx-kt-fact-v">${esc(f.value)}</span></li>`).join('\n')}
        </ul>
        <p class="mtx-kt-avail">${esc(H.availability)}</p>
      </div>
      <div class="mtx-kt-hero-art">${img('hero', 'mtx-kt-poster', { eager: true })}</div>
    </div>
  </header>`;

/* ------------------------------------------------------------- booking -- */
const B = need(C, 'book');
/* Each card goes to that seat class's own page, which holds the full detail. */
const seatCards = need(C, 'seats').map(s => `        <li class="mtx-kt-seat">
          <a class="mtx-kt-seat-a" href="${esc(need(s, 'href'))}">
            ${img(s.name, 'mtx-kt-seat-img')}
            <span class="mtx-kt-seat-t"><span class="mtx-kt-h3">${esc(s.name)}</span><span class="mtx-kt-seat-line">${esc(s.line)}</span></span>
          </a>
        </li>`).join('\n');

const booking = `  <section class="mtx-kt-sec mtx-kt-sec--white">
    <div class="mtx-kt-wrap">
      <h2 class="mtx-kt-h2">${esc(B.h2)}</h2>
      <p class="mtx-kt-lead">${esc(B.lead)}</p>
      <div class="mtx-kt-widget" id="mtx-kt-book" data-mtx-slot="booking-widget" data-label="${esc(B.checkout_label)}"><div class="muaytix-ticket-selector" data-event-id="${EVENT_KEY}"></div></div>
      <ul class="mtx-kt-trust">
${B.trust.map(t => `        <li>${lock}<span>${esc(t)}</span></li>`).join('\n')}
      </ul>
      <p class="mtx-kt-guarantee">${esc(B.guarantee)}</p>
    </div>
  </section>

  <section class="mtx-kt-sec mtx-kt-sec--off">
    <div class="mtx-kt-wrap">
      <ul class="mtx-kt-seats">
${seatCards}
      </ul>
      <p class="mtx-kt-notsure">${esc(B.notsure_text)} <a class="mtx-kt-link mtx-kt-link--dark" href="/rajadamnern-stadium-seating">${esc(B.notsure_link)}</a></p>
    </div>
  </section>`;

/* ----------------------------------------------------------------- why -- */
const W = need(C, 'why');
const why = `  <section class="mtx-kt-sec mtx-kt-sec--white">
    <div class="mtx-kt-wrap">
      <h2 class="mtx-kt-h2">${esc(W.h2)}</h2>
      <div class="mtx-kt-why">
        <ul class="mtx-kt-cards">
${W.cards.map(c => `          <li class="mtx-kt-card"><h3 class="mtx-kt-h3">${esc(c.head)}</h3><p>${esc(c.text)}</p></li>`).join('\n')}
        </ul>
        <div class="mtx-kt-posters">
          ${img('egor', 'mtx-kt-poster mtx-kt-poster--g')}
          ${img('petchdej', 'mtx-kt-poster mtx-kt-poster--g')}
        </div>
      </div>
    </div>
  </section>`;

/* ------------------------------------------------------------- fighters -- */
const F = need(C, 'fighters');
const fighters = `  <section class="mtx-kt-sec mtx-kt-sec--off">
    <div class="mtx-kt-wrap">
      <h2 class="mtx-kt-h2">${esc(F.h2)}</h2>
      <div class="mtx-kt-acc mtx-kt-acc--two">
${F.items.map(f => `        <details class="mtx-kt-det">
          <summary><span class="mtx-kt-sum"><strong class="mtx-kt-name">${esc(f.name)}</strong><span class="mtx-kt-ttl">${esc(f.title)}</span></span>${chev}</summary>
          <div class="mtx-kt-det-b"><p>${esc(f.text)}</p></div>
        </details>`).join('\n')}
      </div>
    </div>
  </section>`;

/* ----------------------------------------------------------------- plan -- */
const P = need(C, 'plan');
const plan = `  <section class="mtx-kt-sec mtx-kt-sec--white">
    <div class="mtx-kt-wrap">
      <h2 class="mtx-kt-h2">${esc(P.h2)}</h2>
      <div class="mtx-kt-plan">
        <div class="mtx-kt-plan-c">
          <h3 class="mtx-kt-h3">${esc(P.details_h)}</h3>
          <dl class="mtx-kt-dl">
${P.details.map(d => `            <div><dt>${esc(d.label)}</dt> <dd>${esc(d.value)}</dd></div>`).join('\n')}
          </dl>
        </div>
        <div class="mtx-kt-plan-c">
          <h3 class="mtx-kt-h3">${esc(P.expect_h)}</h3>
          <ul class="mtx-kt-list">
${P.expect.map(t => `            <li>${tick}<span>${esc(t)}</span></li>`).join('\n')}
          </ul>
          <h3 class="mtx-kt-h3 mtx-kt-h3--gap">${esc(P.links_h)}</h3>
          <ul class="mtx-kt-linklist">
${P.links.map(l => `            <li><a class="mtx-kt-link mtx-kt-link--dark" href="${esc(l.href)}">${esc(l.text)}</a></li>`).join('\n')}
          </ul>
        </div>
      </div>
    </div>
  </section>`;

/* ----------------------------------------------------------- confidence -- */
const K = need(C, 'confidence');
const confidence = `  <section class="mtx-kt-sec mtx-kt-sec--blue mtx-kt-conf">
    <div class="mtx-kt-wrap">
      <h2 class="mtx-kt-h2">${esc(K.h2)}</h2>
      <p class="mtx-kt-conf-body">${esc(K.body)}</p>
      <ul class="mtx-kt-points">
${K.points.map(t => `        <li>${tick}<span>${esc(t)}</span></li>`).join('\n')}
      </ul>
      <p class="mtx-kt-cta-row"><a class="mtx-kt-btn mtx-kt-btn--ghost" href="${BOOK}">${esc(K.cta)}</a></p>
    </div>
  </section>`;

/* ------------------------------------------------------------------ faq -- */
const Q = need(C, 'faq');
const faq = `  <section class="mtx-kt-sec mtx-kt-sec--off">
    <div class="mtx-kt-wrap mtx-kt-read">
      <h2 class="mtx-kt-h2">${esc(Q.h2)}</h2>
      <div class="mtx-kt-acc">
${Q.items.map(f => `        <details class="mtx-kt-det">
          <summary><span class="mtx-kt-sum"><strong class="mtx-kt-name">${esc(f.q)}</strong></span>${chev}</summary>
          <div class="mtx-kt-det-b"><p>${esc(f.a).replace('Rajadamnern seating guide', '<a class="mtx-kt-link mtx-kt-link--dark" href="/rajadamnern-stadium-seating">Rajadamnern seating guide</a>')}</p></div>
        </details>`).join('\n')}
      </div>
    </div>
  </section>`;

/* -------------------------------------------------------------- related -- */
const R = need(C, 'related');
const related = `  <div class="mtx-kt-sec mtx-kt-sec--white mtx-kt-related">
    <div class="mtx-kt-wrap">
      <h2 class="mtx-kt-h3">${esc(R.h2)}</h2>
      <ul class="mtx-kt-rel">
${R.links.map(l => `        <li><a class="mtx-kt-link mtx-kt-link--dark" href="${esc(l.href)}">${esc(l.text)}</a></li>`).join('\n')}
      </ul>
    </div>
  </div>`;

/* ----------------------------------------------------------- sticky bar -- */
const bar = `  <a class="mtx-kt-bar" href="${BOOK}" data-mtx-kt-bar><span>${esc(C.bar.price)}</span><span class="mtx-kt-bar-r">${esc(C.bar.label)}</span></a>`;

writeFileSync('body.html', [hero, utility, booking, why, fighters, plan, confidence, faq, related, bar].join('\n\n') + '\n\n');

/* --------------------------------------------------------------- schema -- */
const url = 'https://muaytix.com' + C.seo.path;
writeFileSync('schema.json', JSON.stringify({
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Event',
      name: H.h1,
      description: C.seo.event_description,
      startDate: '2026-10-10T19:10:00+07:00',
      endDate: '2026-10-10T22:00:00+07:00',
      eventStatus: 'https://schema.org/EventScheduled',
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      location: { '@type': 'Place', name: 'Rajadamnern Stadium',
        address: { '@type': 'PostalAddress', streetAddress: 'Ratchadamnoen Nok Road', addressLocality: 'Bangkok', addressCountry: 'TH' } },
      image: [C.images.hero.url],
      url,
      offers: { '@type': 'AggregateOffer', priceCurrency: 'THB', lowPrice: '1000', availability: 'https://schema.org/InStock', url },
    },
    {
      '@type': 'FAQPage',
      mainEntity: Q.items.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    },
  ],
}, null, 2));

writeFileSync('TILDA-PAGE-SETTINGS.txt',
`RWS KNOCKTOBERFEST, SATURDAY 10 OCTOBER 2026
Tilda page settings. These are NOT in the HTML block. Paste them into the
page's own settings in Tilda.

These are my draft. The brief gave no meta text, so please read them before
you paste. Every fact in them is on the page.

PAGE ADDRESS (follows the 3 October page's pattern)
  ${C.seo.path}

TITLE (${C.seo.title.length} characters)
  ${C.seo.title}

DESCRIPTION (${C.seo.description.length} characters)
  ${C.seo.description}

SOCIAL TITLE (Open Graph), identical to the title
  ${C.seo.title}

SOCIAL DESCRIPTION (Open Graph), identical to the description
  ${C.seo.description}

SOCIAL IMAGE
  ${C.images.hero.url}

CANONICAL
  ${url}
`);
console.log('body.html, schema.json, TILDA-PAGE-SETTINGS.txt written');
