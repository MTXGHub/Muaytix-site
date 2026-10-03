/* Lays out the Rajadamnern Knockout tickets page. Presentation only: every
 * visible word is read from copy.json (which comes from brief.txt). The
 * calendar is the live booking widget, mounted in series mode, so the dates it
 * shows are the booking calendar's own. data.json is used only for the
 * structured-data list.
 *
 *   node extract-copy.mjs && node gen.mjs && node build.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';

const C = JSON.parse(readFileSync('copy.json', 'utf8'));
const D = JSON.parse(readFileSync('data.json', 'utf8'));

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const blocks = (sec, label) => { const b = C[sec] && C[sec][label]; if (!b || !b.length) throw new Error(`copy.json has no [${label}] in ${sec}`); return b; };
const lines = (sec, label, i = 0) => blocks(sec, label)[i];
const one = (sec, label, i = 0) => lines(sec, label, i).join(' ');

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const longDate = iso => { const [y, m, d] = iso.split('-').map(Number); return `${DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d} ${MONTHS[m - 1]} ${y}`; };

const arrow = `<svg class="mtx-tk-arr" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M5 12h14M13 6l6 6-6 6"></path></svg>`;
const chev = `<svg class="mtx-tk-chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M6 9l6 6 6-6"></path></svg>`;
const tick = `<svg class="mtx-tk-tick" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M5 12.5l4.5 4.5L19 7.5"></path></svg>`;
const LOGO = { url: 'https://static.tildacdn.com/tild3636-6563-4066-b361-313038626261/1000035222.svg', w: 480, h: 240, alt: 'Rajadamnern Knockout logo' };

/* 1. breadcrumbs */
const [homeT, hubT, hereT] = one('1 BREADCRUMBS', 'Text').split(' / ');
const crumbs = `  <nav class="mtx-tk-crumbs" aria-label="Breadcrumb"><ol class="mtx-tk-wrap">
    <li><a href="/">${esc(homeT)}</a></li><li aria-hidden="true" class="mtx-tk-slash"> / </li><li><a href="/rajadamnern-knockout">${esc(hubT)}</a></li><li aria-hidden="true" class="mtx-tk-slash"> / </li><li aria-current="page">${esc(hereT)}</li>
  </ol></nav>`;

/* 2. hero */
const S2 = '2 HERO';
const hero = `  <header class="mtx-tk-hero">
    <div class="mtx-tk-wrap mtx-tk-hero-in">
      <span class="mtx-tk-logo"><img src="${LOGO.url}" alt="${esc(LOGO.alt)}" width="${LOGO.w}" height="${LOGO.h}" loading="eager" fetchpriority="high" decoding="async"></span>
      <div class="mtx-tk-hero-t">
        <h1 class="mtx-tk-h1">${esc(one(S2, 'H1'))}</h1>
        <p class="mtx-tk-lede">${esc(one(S2, 'Body', 0))}</p>
        <p class="mtx-tk-lede">${esc(one(S2, 'Body', 1))}</p>
        <p class="mtx-tk-days">${esc(one(S2, 'Supporting line'))}</p>
        <p class="mtx-tk-cta-row">
          <a class="mtx-tk-btn mtx-tk-btn--main" href="#mtx-tk-dates" data-mtx-jump>${esc(one(S2, 'Primary CTA'))}</a>
          <a class="mtx-tk-btn mtx-tk-btn--ghost" href="${esc(one(S2, 'Secondary CTA destination'))}">${esc(one(S2, 'Secondary CTA'))}</a>
        </p>
      </div>
    </div>
  </header>`;

/* 3. the calendar: the live booking widget, Knockout nights only */
const S3 = '3 DATE';
const dates = `  <section class="mtx-tk-sec mtx-tk-sec--paper mtx-tk-sec--dates" id="mtx-tk-dates">
    <div class="mtx-tk-wrap">
      <h2 class="mtx-tk-h2">${esc(one(S3, 'H2'))}</h2>
      <p class="mtx-tk-body">${esc(one(S3, 'Intro'))}</p>
      <div class="mtx-tk-widget" data-mtx-slot="booking-widget"><div class="muaytix-ticket-selector" data-series="rajadamnern-knockout"></div></div>
    </div>
  </section>`;

/* 4. book in advance */
const S4 = '4 ADVANCE';
const advance = `  <section class="mtx-tk-sec mtx-tk-sec--white mtx-tk-sec--adv">
    <div class="mtx-tk-wrap mtx-tk-read">
      <h2 class="mtx-tk-h2">${esc(one(S4, 'H2'))}</h2>
      <p class="mtx-tk-body">${esc(one(S4, 'Paragraph 1'))}</p>
      <p class="mtx-tk-body">${esc(one(S4, 'Paragraph 2'))}</p>
      <p class="mtx-tk-body">${esc(one(S4, 'Paragraph 3'))}</p>
    </div>
  </section>`;

/* 5. ticket options. The four names and their straplines are the ones already
   approved in the booking widget (ticket_classes.tagline). Nothing else. */
const S5 = '5 OPTIONS';
const CLASSES = ['ringside', 'club', 'leo', 'third'];
const options = `  <section class="mtx-tk-sec mtx-tk-sec--paper mtx-tk-sec--opts">
    <div class="mtx-tk-wrap">
      <h2 class="mtx-tk-h2">${esc(one(S5, 'H2'))}</h2>
      <p class="mtx-tk-body">${esc(one(S5, 'Intro'))}</p>
      <ul class="mtx-tk-opts">
${[1, 2, 3, 4].map(n => `        <li class="mtx-tk-opt mtx-tk-opt--${CLASSES[n - 1]}"><h3 class="mtx-tk-h3">${esc(one(S5, `Ticket option ${n} heading`))}</h3><p>${esc(one(S5, `Ticket option ${n} strapline`))}</p></li>`).join('\n')}
      </ul>
      <p class="mtx-tk-body mtx-tk-after">${esc(one(S5, 'Text'))}</p>
      <p class="mtx-tk-cta-row"><a class="mtx-tk-btn mtx-tk-btn--line" href="${esc(one(S5, 'CTA destination'))}">${esc(one(S5, 'CTA'))}</a></p>
    </div>
  </section>`;

/* 6. how booking works: exactly four steps */
const S6 = '6 BOOKING';
const booking = `  <section class="mtx-tk-sec mtx-tk-sec--white mtx-tk-sec--how">
    <div class="mtx-tk-wrap">
      <h2 class="mtx-tk-h2">${esc(one(S6, 'H2'))}</h2>
      <p class="mtx-tk-body">${esc(one(S6, 'Intro'))}</p>
      <ol class="mtx-tk-steps">
${[1, 2, 3, 4].map(n => `        <li class="mtx-tk-step"><h3 class="mtx-tk-h3">${esc(one(S6, `Step ${n} heading`))}</h3><p>${esc(one(S6, `Step ${n} body`))}</p></li>`).join('\n')}
      </ol>
    </div>
  </section>`;

/* 7. e-ticket and entry */
const S7 = '7 ENTRY';
const entry = `  <section class="mtx-tk-sec mtx-tk-sec--paper mtx-tk-sec--entry">
    <div class="mtx-tk-wrap mtx-tk-read">
      <h2 class="mtx-tk-h2">${esc(one(S7, 'H2'))}</h2>
      <p class="mtx-tk-body">${esc(one(S7, 'Paragraph 1'))}</p>
      <p class="mtx-tk-body">${esc(one(S7, 'Paragraph 2'))}</p>
      <p class="mtx-tk-body">${esc(one(S7, 'Paragraph 3'))}</p>
      <ul class="mtx-tk-list">
${lines(S7, 'Supporting list').map(t => `        <li>${tick}<span>${esc(t)}</span></li>`).join('\n')}
      </ul>
    </div>
  </section>`;

/* 8. the event */
const S8 = '8 EVENT';
const event = `  <section class="mtx-tk-sec mtx-tk-sec--white mtx-tk-sec--event">
    <div class="mtx-tk-wrap mtx-tk-read">
      <h2 class="mtx-tk-h2">${esc(one(S8, 'H2'))}</h2>
      <p class="mtx-tk-body">${esc(one(S8, 'Paragraph 1'))}</p>
      <p class="mtx-tk-body">${esc(one(S8, 'Paragraph 2'))}</p>
      <p class="mtx-tk-body">${esc(one(S8, 'Paragraph 3'))}</p>
      <h3 class="mtx-tk-h3 mtx-tk-sub">${esc(one(S8, 'H3'))}</h3>
      <p class="mtx-tk-body">${esc(one(S8, 'Body'))}</p>
      <p class="mtx-tk-body">${esc(one(S8, 'Body 2'))}</p>
      <h3 class="mtx-tk-h3 mtx-tk-sub">${esc(one(S8, 'H3 2'))}</h3>
      <p class="mtx-tk-body">${esc(one(S8, 'Body 3'))}</p>
      <p class="mtx-tk-body">${esc(one(S8, 'Body 4'))}</p>
      <p class="mtx-tk-linkrow"><a class="mtx-tk-jump" href="${esc(one(S8, 'CTA destination'))}">${esc(one(S8, 'CTA'))}${arrow}</a></p>
    </div>
  </section>`;

/* 9. FAQ: answers are plain text in the page; buttons fold them with the script on */
const S9 = '9 FAQ';
const faq = [1, 2, 3, 4, 5, 6, 7].map(n => ({ q: one(S9, `Question ${n}`), a: one(S9, `Answer ${n}`), link: C[S9][`Link ${n}`] ? { t: one(S9, `Link ${n}`), h: one(S9, `Link ${n} destination`) } : null }));
const faqSec = `  <section class="mtx-tk-sec mtx-tk-sec--paper mtx-tk-sec--faq">
    <div class="mtx-tk-wrap mtx-tk-read">
      <h2 class="mtx-tk-h2">${esc(one(S9, 'H2'))}</h2>
      <div class="mtx-tk-acc">
${faq.map((f, i) => `        <div class="mtx-tk-fq">
          <button class="mtx-tk-fqb" type="button" id="mtx-tk-q${i + 1}" aria-expanded="true" aria-controls="mtx-tk-a${i + 1}"><span class="mtx-tk-q">${esc(f.q)}</span>${chev}</button>
          <div class="mtx-tk-fqp" id="mtx-tk-a${i + 1}" role="region" aria-labelledby="mtx-tk-q${i + 1}"><p>${esc(f.a)}${f.link ? ` <a class="mtx-tk-inline" href="${esc(f.link.h)}">${esc(f.link.t)}</a>` : ''}</p></div>
        </div>`).join('\n')}
      </div>
    </div>
  </section>`;

/* 10. related links */
const S10 = '10 RELATED LINKS';
const rel = [1, 2, 3, 4].map(n => ({ text: one(S10, `Link ${n}`), dest: one(S10, `Destination ${n}`) }));
const related = `  <section class="mtx-tk-sec mtx-tk-sec--white mtx-tk-related">
    <div class="mtx-tk-wrap">
      <h2 class="mtx-tk-h2">${esc(one(S10, 'H2'))}</h2>
      <ul class="mtx-tk-rel">
${rel.map(l => `        <li><a class="mtx-tk-jump" href="${esc(l.dest)}">${esc(l.text)}${arrow}</a></li>`).join('\n')}
      </ul>
    </div>
  </section>`;

writeFileSync('body.html', [crumbs, hero, dates, advance, options, booking, entry, event, faqSec, related].join('\n\n') + '\n\n');

/* structured data */
const URL = 'https://muaytix.com/rajadamnern-knockout/tickets';
const META_DESC = 'Book Rajadamnern Knockout tickets for live Muay Thai at Rajadamnern Stadium, Bangkok. Events every Monday, Tuesday and Friday. Choose your date and book online.';
const entries = [...D.knockout.map(iso => ({ iso, special: false })), ...D.special.map(iso => ({ iso, special: true }))]
  .filter(e => e.iso >= D.builtOn).sort((a, b) => a.iso.localeCompare(b.iso));
const schema = [
  { '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Rajadamnern Knockout Tickets', url: URL,
    description: 'Book Rajadamnern Knockout tickets for live Muay Thai at Rajadamnern Stadium, Bangkok. Events take place every Monday, Tuesday and Friday.',
    about: ['Rajadamnern Knockout', 'Rajadamnern Stadium', 'Muay Thai', 'Bangkok'].map(name => ({ '@type': 'Thing', name })) },
  { '@context': 'https://schema.org', '@type': 'ItemList', name: 'Rajadamnern Knockout dates',
    itemListElement: entries.map((e, i) => ({ '@type': 'ListItem', position: i + 1,
      name: `${e.special ? D.specialName : 'Rajadamnern Knockout'}, ${longDate(e.iso)}`,
      url: e.special ? `${D.specialUrlBase}${e.iso}` : `https://muaytix.com/rajadamnern-knockout/${e.iso}` })) },
  { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: homeT, item: 'https://muaytix.com/' },
    { '@type': 'ListItem', position: 2, name: hubT, item: 'https://muaytix.com/rajadamnern-knockout' },
    { '@type': 'ListItem', position: 3, name: hereT, item: URL } ] },
];
writeFileSync('schema.json', JSON.stringify(schema, null, 2) + '\n');

writeFileSync('TILDA-PAGE-SETTINGS.txt', `RAJADAMNERN KNOCKOUT TICKETS
Paste these into the Tilda page settings for /rajadamnern-knockout/tickets.
They are not part of the HTML block.

PAGE ADDRESS (keep as it is)
  /rajadamnern-knockout/tickets

TITLE
  Rajadamnern Knockout Tickets | Muay Thai Bangkok

META DESCRIPTION
  ${META_DESC}

CANONICAL
  ${URL}

ROBOTS
  index,follow

OPEN GRAPH
  Type:         website
  Site name:    MuayTix
  URL:          ${URL}
  Title:        Rajadamnern Knockout Tickets | Live Muay Thai in Bangkok
  Description:  Book Rajadamnern Knockout tickets for Monday, Tuesday and Friday Muay Thai at Rajadamnern Stadium in Bangkok.
  Image:        NOT SET. Needs one approved Rajadamnern Knockout event or ticket-page visual, at least 1200 x 630.
  Image alt:    Rajadamnern Knockout tickets at Rajadamnern Stadium in Bangkok

X CARD
  Card:         summary_large_image
  Title:        Rajadamnern Knockout Tickets | Live Muay Thai in Bangkok
  Description:  Book Rajadamnern Knockout tickets for Monday, Tuesday and Friday Muay Thai at Rajadamnern Stadium in Bangkok.
  Image:        NOT SET. Use the same image as Open Graph.

DO NOT ADD
  Meta keywords. A second title or canonical tag.
`);
console.log(`${entries.length} dates in the structured data; body.html, schema.json written`);
