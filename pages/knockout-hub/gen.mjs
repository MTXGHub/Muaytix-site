/* Renders the Rajadamnern Knockout hub from copy.json.
 *
 *   node extract-copy.mjs && node gen.mjs && node build.mjs
 *
 * Not one word of visible copy is typed in this file. Every string is looked
 * up in copy.json, which extract-copy.mjs reads out of brief.txt. A missing key
 * stops the build rather than being filled in. This file decides presentation
 * only: structure, classes, order within a section's own blocks.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const C = JSON.parse(readFileSync('copy.json', 'utf8'));
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const blocks = (sec, label) => { const b = C[sec] && C[sec][label]; if (!b || !b.length) throw new Error(`copy.json has no [${label}] in ${sec}`); return b; };
const one = (sec, label) => blocks(sec, label)[0];
const BOOK = '#mtx-kh-book';
const URL = 'https://muaytix.com/rajadamnern-knockout';

/* ---- Assets. Hero and logo are already on the Tilda CDN from earlier pages.
   The Dome picture has not been supplied: a placeholder stands in until it is. ---- */
const IMG = {
  hero: { url: 'https://static.tildacdn.com/tild6364-3165-4631-a135-656136313164/1000007575.jpg', w: 1600, h: 900,
          alt: 'Rajadamnern Knockout live Muay Thai at Rajadamnern Stadium in Bangkok' },
  logo: { url: 'https://static.tildacdn.com/tild6532-3165-4665-a139-323436353633/1000029307.svg', w: 280, h: 80,
          alt: 'Rajadamnern Knockout logo' },
};
const SEATS = [
  { name: 'Ringside', href: '/rajadamnern-stadium-seating/ringside', url: 'https://static.tildacdn.com/tild3263-3037-4933-b536-393332643465/1000033705.jpg', alt: 'Ringside seating at Rajadamnern Stadium, Bangkok' },
  { name: 'Club Class', href: '/rajadamnern-stadium-seating/club-class', url: 'https://static.tildacdn.com/tild3063-6461-4462-b734-383032326530/1000033694.jpg', alt: 'Club Class seating at Rajadamnern Stadium, Bangkok' },
  { name: 'LEO Section', href: '/rajadamnern-stadium-seating/leo-section', url: 'https://static.tildacdn.com/tild6339-6239-4433-b062-343862316332/1000033687.jpg', alt: 'LEO Section at Rajadamnern Stadium, Bangkok' },
  { name: 'Third Class', href: '/rajadamnern-stadium-seating#third-class', url: 'https://static.tildacdn.com/tild6236-3161-4463-a563-623231633836/1000012609.jpg', alt: 'Third Class seating at Rajadamnern Stadium, Bangkok' },
];

const tick = `<svg class="mtx-kh-tick" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M5 12.5l4.5 4.5L19 7.5"></path></svg>`;
const arrow = `<svg class="mtx-kh-arr" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M5 12h14M13 6l6 6-6 6"></path></svg>`;
const chev = `<svg class="mtx-kh-chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M6 9l6 6 6-6"></path></svg>`;

/* ----------------------------------------------------------- 1. breadcrumbs */
const crumbs = one('BREADCRUMBS', 'Text');
const [homeText, hereText] = crumbs.split(' / ');
if (!homeText || !hereText) throw new Error('breadcrumb text is not "A / B"');
const breadcrumbs = `  <nav class="mtx-kh-crumbs" aria-label="Breadcrumb"><ol class="mtx-kh-wrap">
    <li><a href="/">${esc(homeText)}</a></li><li aria-hidden="true" class="mtx-kh-slash"> / </li><li aria-current="page">${esc(hereText)}</li>
  </ol></nav>`;

/* ------------------------------------------------------------------ 2. hero */
const heroBody = blocks('HERO', 'Body');
const hero = `  <header class="mtx-kh-hero">
    <img class="mtx-kh-hero-img" src="${esc(IMG.hero.url)}" alt="${esc(IMG.hero.alt)}" width="${IMG.hero.w}" height="${IMG.hero.h}" loading="eager" fetchpriority="high" decoding="async">
    <div class="mtx-kh-hero-wash" aria-hidden="true"></div>
    <div class="mtx-kh-wrap mtx-kh-hero-in">
      <span class="mtx-kh-logo"><img src="${esc(IMG.logo.url)}" alt="${esc(IMG.logo.alt)}" width="${IMG.logo.w}" height="${IMG.logo.h}" loading="eager" decoding="async"></span>
      <h1 class="mtx-kh-h1">${esc(one('HERO', 'H1'))}</h1>
      <p class="mtx-kh-lede">${esc(heroBody[0])}</p>
      <p class="mtx-kh-days">${esc(heroBody[1])}</p>
      <p class="mtx-kh-cta-row">
        <a class="mtx-kh-btn" href="${BOOK}">${esc(one('HERO', 'Primary CTA'))}</a>
        <a class="mtx-kh-btn mtx-kh-btn--ghost" href="https://muaytix.com/rajadamnern-knockout/fight-card">${esc(one('HERO', 'Secondary CTA'))}</a>
      </p>
    </div>
  </header>`;

/* ------------------------------------------------------------- 3. fact cards */
const F = 'ESSENTIAL FACT CARDS';
const facts = [1, 2, 3, 4, 5, 6].map(n => ({ label: one(F, `Card ${n} label`), value: one(F, `Card ${n} value`) }));
const factSec = `  <section class="mtx-kh-sec mtx-kh-sec--paper mtx-kh-sec--facts">
    <div class="mtx-kh-wrap">
      <h2 class="mtx-kh-h2">${esc(one(F, 'Section heading'))}</h2>
      <ul class="mtx-kh-facts">
${facts.map(f => `        <li class="mtx-kh-fact"><span class="mtx-kh-fact-l">${esc(f.label)}</span> <span class="mtx-kh-fact-v">${esc(f.value)}</span></li>`).join('\n')}
      </ul>
    </div>
  </section>`;

/* ----------------------------------------------------------- 4. the widget */
const W = 'BOOKING WIDGET';
const trust = one(W, 'Trust row').split(' · ');
if (trust.length !== 3) throw new Error('the trust row must have three parts');
const widget = `  <section class="mtx-kh-sec mtx-kh-sec--white mtx-kh-sec--book">
    <div class="mtx-kh-wrap">
      <h2 class="mtx-kh-h2">${esc(one(W, 'H2'))}</h2>
      <p class="mtx-kh-lead">${esc(one(W, 'Body'))}</p>
      <p class="mtx-kh-helper"><span class="mtx-kh-swatch" aria-hidden="true"></span>${esc(one(W, 'Helper text'))}</p>
      <div class="mtx-kh-widget" id="mtx-kh-book" data-mtx-slot="booking-widget"><div class="muaytix-ticket-selector" data-series="rajadamnern-knockout"></div></div>
      <ul class="mtx-kh-trust">
${trust.map((t, i) => `        <li>${tick}<span>${esc(t)}</span>${i < 2 ? '<span class="mtx-kh-dot" aria-hidden="true"> · </span>' : ''}</li>`).join('\n')}
      </ul>
    </div>
  </section>`;

/* ------------------------------------------------------------- 5. what is */
const S5 = 'WHAT IS RAJADAMNERN KNOCKOUT?';
const what = `  <section class="mtx-kh-sec mtx-kh-sec--white mtx-kh-sec--what">
    <div class="mtx-kh-wrap mtx-kh-read">
      <h2 class="mtx-kh-h2">${esc(one(S5, 'H2'))}</h2>
      <p class="mtx-kh-body">${esc(one(S5, 'Paragraph 1'))}</p>
      <p class="mtx-kh-body">${esc(one(S5, 'Paragraph 2'))}</p>
    </div>
  </section>`;

/* ----------------------------------------------------------- 6. first time */
const S6 = 'FIRST-TIME GUESTS';
const first = `  <section class="mtx-kh-sec mtx-kh-sec--paper">
    <div class="mtx-kh-wrap">
      <h2 class="mtx-kh-h2">${esc(one(S6, 'H2'))}</h2>
      <p class="mtx-kh-lead">${esc(one(S6, 'Body'))}</p>
      <ul class="mtx-kh-cards">
${[1, 2, 3].map(n => `        <li class="mtx-kh-card"><h3 class="mtx-kh-h3">${esc(one(S6, `Card ${n} heading`))}</h3><p>${esc(one(S6, `Card ${n} body`))}</p></li>`).join('\n')}
      </ul>
    </div>
  </section>`;

/* ----------------------------------------------------------- 7. what to expect */
const S7 = 'WHAT TO EXPECT';
const expect = `  <section class="mtx-kh-sec mtx-kh-sec--white mtx-kh-sec--expect">
    <div class="mtx-kh-wrap mtx-kh-read">
      <h2 class="mtx-kh-h2">${esc(one(S7, 'H2'))}</h2>
${[1, 2, 3].map(n => `      <p class="mtx-kh-body">${esc(one(S7, `Paragraph ${n}`))}</p>`).join('\n')}
      <p class="mtx-kh-note">${esc(one(S7, 'Operational note'))}</p>
    </div>
  </section>`;

/* --------------------------------------------------------------- 8. dome */
const S8 = 'DOME EXPERIENCE';
const dome = `  <section class="mtx-kh-sec mtx-kh-sec--dome">
    <div class="mtx-kh-wrap mtx-kh-dome">
      <div class="mtx-kh-dome-art" data-placeholder="dome-image" aria-hidden="true"></div>
      <div class="mtx-kh-dome-t">
        <h2 class="mtx-kh-h2">${esc(one(S8, 'H2'))}</h2>
        <p class="mtx-kh-body">${esc(one(S8, 'Body'))}</p>
        <p class="mtx-kh-dome-note">${esc(one(S8, 'Note'))}</p>
      </div>
    </div>
  </section>`;

/* ---------------------------------------------------------- 9. chooser */
const S9 = 'EVENT CHOOSER';
const chooseLinks = [1, 2, 3].map(n => ({ text: one(S9, `Link ${n} visible anchor`), dest: one(S9, `Link ${n} destination`) }));
const chooser = `  <section class="mtx-kh-sec mtx-kh-sec--paper">
    <div class="mtx-kh-wrap mtx-kh-read">
      <h2 class="mtx-kh-h2">${esc(one(S9, 'H2'))}</h2>
      <p class="mtx-kh-lead">${esc(one(S9, 'Body'))}</p>
      <ul class="mtx-kh-list">
${[1, 2, 3, 4].map(n => `        <li>${tick}<span>${esc(one(S9, `Bullet ${n}`))}</span></li>`).join('\n')}
      </ul>
      <h3 class="mtx-kh-h3 mtx-kh-sub">${esc(one(S9, 'Subheading'))}</h3>
      <ul class="mtx-kh-jumps">
${chooseLinks.map(l => /^\[CONFIGURE/.test(l.dest)
  /* The brief says not to invent this address. Until it is supplied the words
     are shown but are not a link. */
  ? `        <li><span class="mtx-kh-jump mtx-kh-jump--pending" data-needs-destination="true">${esc(l.text)}</span></li>`
  : `        <li><a class="mtx-kh-jump" href="${esc(l.dest)}">${esc(l.text)}${arrow}</a></li>`).join('\n')}
      </ul>
    </div>
  </section>`;

/* ---------------------------------------------------- 10. confidence */
const S10 = 'BOOKING CONFIDENCE';
const confidence = `  <section class="mtx-kh-sec mtx-kh-sec--blue mtx-kh-conf">
    <div class="mtx-kh-wrap mtx-kh-read">
      <h2 class="mtx-kh-h2">${esc(one(S10, 'H2'))}</h2>
      <p class="mtx-kh-body">${esc(one(S10, 'Body'))}</p>
      <p class="mtx-kh-cta-row"><a class="mtx-kh-btn mtx-kh-btn--ghost" href="${BOOK}">${esc(one(S10, 'CTA'))}</a></p>
    </div>
  </section>`;

/* ------------------------------------------------------------ 11. FAQ */
const S11 = 'FAQ';
const faqs = [1, 2, 3, 4, 5].map(n => ({ q: one(S11, `Question ${n}`), a: one(S11, `Answer ${n}`) }));
const answer = (a) => {
  const m = a.match(/^\[LINK: (.+)\]$/);
  if (!m) return esc(a);
  return `<a class="mtx-kh-inline" href="${esc(one(S11, 'Link destination'))}">${esc(m[1])}</a>`;
};
const faq = `  <section class="mtx-kh-sec mtx-kh-sec--white">
    <div class="mtx-kh-wrap mtx-kh-read">
      <h2 class="mtx-kh-h2">${esc(one(S11, 'H2'))}</h2>
      <div class="mtx-kh-acc">
${faqs.map(f => `        <details class="mtx-kh-det">
          <summary><span class="mtx-kh-q">${esc(f.q)}</span>${chev}</summary>
          <div class="mtx-kh-det-b"><p>${answer(f.a)}</p></div>
        </details>`).join('\n')}
      </div>
    </div>
  </section>`;

/* ------------------------------------------------------ 12. related */
const S12 = 'RELATED LINKS';
const rel = [1, 2, 3, 4].map(n => ({ text: one(S12, `Link ${n} visible anchor`), dest: one(S12, `Link ${n} destination`) }));
const related = `  <section class="mtx-kh-sec mtx-kh-sec--paper mtx-kh-related">
    <div class="mtx-kh-wrap">
      <h2 class="mtx-kh-h2">${esc(one(S12, 'H2'))}</h2>
      <ul class="mtx-kh-rel">
${rel.map(l => `        <li><a class="mtx-kh-jump" href="${esc(l.dest)}">${esc(l.text)}${arrow}</a></li>`).join('\n')}
      </ul>
      <ul class="mtx-kh-seats">
${SEATS.map(s => `        <li><a class="mtx-kh-seat" href="${esc(s.href)}" aria-label="${esc(s.name)}"><img src="${esc(s.url)}" alt="${esc(s.alt)}" width="1024" height="1024" loading="lazy" decoding="async"></a></li>`).join('\n')}
      </ul>
    </div>
  </section>`;

/* ------------------------------------------------------------ sticky bar */
const bar = `  <a class="mtx-kh-bar" href="${BOOK}" data-mtx-kh-bar>${esc(one('HERO', 'Primary CTA'))}</a>`;

writeFileSync('body.html', [breadcrumbs, hero, factSec, widget, what, first, expect, dome, chooser, confidence, faq, related, bar].join('\n\n') + '\n\n');

/* ----------------------------------------------------------- structured data */
const heroDesc = 'Rajadamnern Knockout brings fast three-round Muay Thai to Rajadamnern Stadium every Monday, Tuesday and Friday.';
writeFileSync('schema.json', JSON.stringify([
  { '@context': 'https://schema.org', '@type': 'WebPage', name: 'Rajadamnern Knockout', url: URL, description: heroDesc,
    about: [{ '@type': 'Thing', name: 'Rajadamnern Knockout' }, { '@type': 'Thing', name: 'Muay Thai' }, { '@type': 'Thing', name: 'Rajadamnern Stadium' }],
    isPartOf: { '@type': 'WebSite', name: 'MuayTix', url: 'https://muaytix.com/' } },
  { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://muaytix.com/' },
    { '@type': 'ListItem', position: 2, name: 'Rajadamnern Knockout', item: URL } ] },
], null, 2));

/* ----------------------------------------------------------- page settings */
writeFileSync('TILDA-PAGE-SETTINGS.txt',
`RAJADAMNERN KNOCKOUT, EVERGREEN HUB
Tilda page settings. These are NOT in the HTML block (a block has no head).
Paste them into the page's own settings in Tilda. The text is the brief's, exact.

PAGE ADDRESS (unchanged, no redirect)
  /rajadamnern-knockout

CANONICAL
  https://muaytix.com/rajadamnern-knockout

DOCUMENT TITLE
  Rajadamnern Knockout | Fast Muay Thai in Bangkok

META DESCRIPTION
  Rajadamnern Knockout brings fast three-round Muay Thai to Rajadamnern Stadium every Monday, Tuesday and Friday. Choose your date and book seats online.

ROBOTS
  index,follow

OPEN GRAPH
  type        website
  site name   MuayTix
  url         https://muaytix.com/rajadamnern-knockout
  title       Rajadamnern Knockout | Muay Thai at Rajadamnern Stadium
  description Seven fast three-round Muay Thai fights at Rajadamnern Stadium, Bangkok. Choose a Monday, Tuesday or Friday and book your seats online.
  image       NOT SET. The brief says: current approved Rajadamnern Knockout hero or event
              image, canonical https URL, at least 1200 x 630 px, text-safe crop.
              Send the image and I will fill it in. I cannot see Tilda's pictures from here.
  image alt   Rajadamnern Knockout live Muay Thai at Rajadamnern Stadium in Bangkok

X (TWITTER) CARD
  card        summary_large_image
  title       Rajadamnern Knockout | Muay Thai at Rajadamnern Stadium
  description Seven fast three-round Muay Thai fights at Rajadamnern Stadium, Bangkok. Choose a Monday, Tuesday or Friday and book your seats online.
  image       NOT SET. Same image as the Open Graph one.

DO NOT ADD: meta keywords, "tonight" metadata, a second title tag, a second canonical.
`);
console.log('body.html, schema.json, TILDA-PAGE-SETTINGS.txt written');
