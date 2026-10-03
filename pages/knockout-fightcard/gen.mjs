/* Lays out the rolling Rajadamnern Knockout fight-card page. Presentation only:
 * every visible word is read from copy.json (which comes from brief.txt), and
 * the dates, card and recent cards come from nights.json, card.json,
 * recent.json and status.json.
 *
 *   node extract-copy.mjs && node gen.mjs && node build.mjs
 *
 * State A (cards not yet released) is built while card.json has no bouts.
 * State B (cards confirmed) is built as soon as it has some.
 *
 * Environment, for the checker only: CARD_FILE and OUT_DIR.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const OUT = process.env.OUT_DIR || '.';
mkdirSync(OUT, { recursive: true });
const C = JSON.parse(readFileSync('copy.json', 'utf8'));
const NIGHTS = JSON.parse(readFileSync('nights.json', 'utf8'));
const CARD = JSON.parse(readFileSync(process.env.CARD_FILE || 'card.json', 'utf8'));
const RECENT = JSON.parse(readFileSync('recent.json', 'utf8'));
const STATUS = JSON.parse(readFileSync('status.json', 'utf8'));

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const blocks = (sec, label) => { const b = C[sec] && C[sec][label]; if (!b || !b.length) throw new Error(`copy.json has no [${label}] in ${sec}`); return b; };
const lines = (sec, label, i = 0) => blocks(sec, label)[i];
const one = (sec, label, i = 0) => lines(sec, label, i).join(' ');

/* ---------------------------------------------------------------- dates --- */
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const parts = iso => { const [y, m, d] = iso.split('-').map(Number); return { y, m, d, dow: new Date(Date.UTC(y, m - 1, d)).getUTCDay() }; };
const shortDate = iso => { const p = parts(iso); return `${DAYS[p.dow]} ${p.d} ${MONTHS[p.m - 1]}`; };
const longDate = iso => `${shortDate(iso)} ${parts(iso).y}`;
const pageUrl = iso => `https://muaytix.com/rajadamnern-knockout/${iso}`;
const stamp = iso => {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/); const h = Number(m[4]);
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}, ${h % 12 === 0 ? 12 : h % 12}:${m[5]} ${h < 12 ? 'am' : 'pm'} Bangkok time`;
};

const nights = NIGHTS.nights.map(iso => ({ iso, short: shortDate(iso), long: longDate(iso), href: pageUrl(iso) }));
const next = nights[0];
const STATE_B = Array.isArray(CARD.bouts) && CARD.bouts.length > 0;
const cardIso = STATE_B ? CARD.date : null;

/* The locked copy names the first night in several places. If the data and the
   copy ever disagree, stop here rather than ship a page that contradicts itself. */
const expectCta = `Choose seats for ${next.short}`;
for (const [sec, label] of [['2 HERO', 'Primary CTA'], ['3 STATUS', 'Primary CTA'], ['4A CARD AREA STATE A', 'CTA'], ['7 BOOK THE NEXT EVENT', 'CTA'], ['9 FAQ', 'Link']])
  if (one(sec, label) !== expectCta) throw new Error(`${sec} ${label} says "${one(sec, label)}" but nights.json starts on ${next.short}`);
if (one('3 STATUS', 'Date') !== next.long) throw new Error('section 3 date differs from nights.json');
nights.forEach((n, i) => { if (one('4A CARD AREA STATE A', `Upcoming date ${i + 1}`) !== n.long) throw new Error('upcoming date ' + (i + 1) + ' differs from nights.json'); });

/* The words "Monday 5 October" sit inside a span the page script can replace
   when that night has finished. Everything around the span is the locked copy. */
const nextSpan = `<span data-mtx-next="short">${esc(next.short)}</span>`;
const withNext = text => { const at = text.indexOf(next.short); if (at < 0) throw new Error('no date in: ' + text); return esc(text.slice(0, at)) + nextSpan + esc(text.slice(at + next.short.length)); };
const ctaLink = (cls, text, extra = '') => `<a class="mtx-fc-btn ${cls}" href="${next.href}" data-mtx-cta${extra}><span class="mtx-fc-btn-t">${withNext(text)}</span></a>`;

const arrow = `<svg class="mtx-fc-arr" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M5 12h14M13 6l6 6-6 6"></path></svg>`;
const chev = `<svg class="mtx-fc-chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M6 9l6 6 6-6"></path></svg>`;

const IMG = { logo: { url: 'https://static.tildacdn.com/tild6532-3165-4665-a139-323436353633/1000029307.svg', w: 280, h: 80, alt: 'Rajadamnern Knockout logo' } };

/* ---------------------------------------------------------- 1. breadcrumbs */
const [homeT, hubT, hereT] = one('1 BREADCRUMBS', 'Text').split(' / ');
const crumbs = `  <nav class="mtx-fc-crumbs" aria-label="Breadcrumb"><ol class="mtx-fc-wrap">
    <li><a href="/">${esc(homeT)}</a></li><li aria-hidden="true" class="mtx-fc-slash"> / </li><li><a href="/rajadamnern-knockout">${esc(hubT)}</a></li><li aria-hidden="true" class="mtx-fc-slash"> / </li><li aria-current="page">${esc(hereT)}</li>
  </ol></nav>`;

/* --------------------------------------------------------------- 2. hero */
const S2 = '2 HERO';
const hero = `  <header class="mtx-fc-hero">
    <div class="mtx-fc-wrap mtx-fc-hero-in">
      <span class="mtx-fc-logo"><img src="${IMG.logo.url}" alt="${esc(IMG.logo.alt)}" width="${IMG.logo.w}" height="${IMG.logo.h}" loading="eager" decoding="async"></span>
      <h1 class="mtx-fc-h1">${esc(one(S2, 'H1'))}</h1>
      <p class="mtx-fc-lede">${esc(one(S2, 'Body'))}</p>
      <p class="mtx-fc-days">${esc(one(S2, 'Supporting line'))}</p>
      <p class="mtx-fc-cta-row">
        ${ctaLink('mtx-fc-btn--main', one(S2, 'Primary CTA'))}
        <a class="mtx-fc-btn mtx-fc-btn--ghost" href="${esc(one(S2, 'Secondary CTA destination'))}">${esc(one(S2, 'Secondary CTA'))}</a>
      </p>
    </div>
  </header>`;

/* ------------------------------------------------ 3. status and next event */
const S3 = '3 STATUS';
const factItems = lines(S3, 'Event facts').map(f => `<li class="mtx-fc-fact">${esc(f)}</li>`).join('\n          ');
const statusValue = STATE_B ? one('4B CARD AREA STATE B', 'Status value') : one(S3, 'Status value');
const updated = `<p class="mtx-fc-upd"><span class="mtx-fc-upd-l">${esc(one(S3, 'Last-updated label'))}</span> <time class="mtx-fc-upd-v" datetime="${esc(STATUS.lastUpdated)}">${esc(stamp(STATUS.lastUpdated))}</time></p>`;
const status = `  <section class="mtx-fc-sec mtx-fc-sec--paper mtx-fc-sec--status">
    <div class="mtx-fc-wrap">
      <div class="mtx-fc-panel">
        <h2 class="mtx-fc-h2">${esc(one(S3, 'H2'))}</h2>
        <p class="mtx-fc-date" data-mtx-next="long">${esc(next.long)}</p>
        <ul class="mtx-fc-facts">
          ${factItems}
        </ul>
        <p class="mtx-fc-state"><span class="mtx-fc-state-l">${esc(one(S3, 'Status label'))}</span> <strong class="mtx-fc-pill${STATE_B ? ' mtx-fc-pill--ok' : ''}">${esc(statusValue)}</strong></p>${STATE_B ? '' : `
        <p class="mtx-fc-body">${esc(one(S3, 'Body'))}</p>`}
        ${updated}
        <p class="mtx-fc-cta-row">
          ${ctaLink('mtx-fc-btn--main', one(S3, 'Primary CTA'))}
          <a class="mtx-fc-btn mtx-fc-btn--line" href="${esc(one(S3, 'Secondary CTA destination'))}">${esc(one(S3, 'Secondary CTA'))}</a>
        </p>
      </div>
    </div>
  </section>`;

/* --------------------------------------------------- 4. current card area */
let cardArea;
if (!STATE_B) {
  const S = '4A CARD AREA STATE A';
  cardArea = `  <section class="mtx-fc-sec mtx-fc-sec--white mtx-fc-sec--card" data-mtx-state="A">
    <div class="mtx-fc-wrap">
      <h2 class="mtx-fc-h2">${esc(one(S, 'H2'))}</h2>
      <p class="mtx-fc-body">${esc(one(S, 'Body'))}</p>
      <p class="mtx-fc-body" data-mtx-needs-next>${esc(one(S, 'Body 2'))}</p>
      <ul class="mtx-fc-nights">
${nights.map(n => `        <li class="mtx-fc-night" data-mtx-night="${n.iso}">${esc(n.long)}</li>`).join('\n')}
      </ul>
      <p class="mtx-fc-body">${esc(one(S, 'Supporting line'))}</p>
      <p class="mtx-fc-cta-row">${ctaLink('mtx-fc-btn--main', one(S, 'CTA'))}</p>
    </div>
  </section>`;
} else {
  const S = '4B CARD AREA STATE B';
  const bouts = CARD.bouts.map(b => `        <li class="mtx-fc-bout">
          <h3 class="mtx-fc-bout-h">Bout ${esc(b.n)}</h3>
          <div class="mtx-fc-vs">
            <p class="mtx-fc-f mtx-fc-f--a"><strong>${esc(b.a)}</strong>${b.ag ? `<span>${esc(b.ag)}</span>` : ''}</p>
            <span class="mtx-fc-v">vs</span>
            <p class="mtx-fc-f mtx-fc-f--b"><strong>${esc(b.b)}</strong>${b.bg ? `<span>${esc(b.bg)}</span>` : ''}</p>
          </div>
        </li>`).join('\n');
  const cardCta = `Choose seats for ${shortDate(cardIso)}`;
  cardArea = `  <section class="mtx-fc-sec mtx-fc-sec--white mtx-fc-sec--card" data-mtx-state="B">
    <div class="mtx-fc-wrap">
      <h2 class="mtx-fc-h2">${esc(one(S, 'H2'))}</h2>
      <div class="mtx-fc-cardtop${CARD.poster ? ' mtx-fc-cardtop--poster' : ''}">${CARD.poster ? `
        <img class="mtx-fc-poster" src="${esc(CARD.poster)}" alt="Rajadamnern Knockout fight card, ${esc(longDate(cardIso))}" width="900" height="1100" loading="eager" fetchpriority="high" decoding="async">` : ''}
        <div class="mtx-fc-cardinfo">
          <p class="mtx-fc-date">${esc(longDate(cardIso))}</p>
          <ul class="mtx-fc-facts">
            ${lines(S, 'Event facts').map(f => `<li class="mtx-fc-fact">${esc(f)}</li>`).join('\n            ')}
          </ul>
          <p class="mtx-fc-state"><span class="mtx-fc-state-l">${esc(one(S, 'Status label'))}</span> <strong class="mtx-fc-pill mtx-fc-pill--ok">${esc(one(S, 'Status value'))}</strong></p>
          <p class="mtx-fc-upd"><span class="mtx-fc-upd-l">${esc(one(S, 'Last-updated label'))}</span> <time class="mtx-fc-upd-v" datetime="${esc(STATUS.lastUpdated)}">${esc(stamp(STATUS.lastUpdated))}</time></p>
          <p class="mtx-fc-cta-row"><a class="mtx-fc-btn mtx-fc-btn--main" href="${pageUrl(cardIso)}" data-mtx-cta-fixed>${esc(cardCta)}</a></p>
        </div>
      </div>
      <ol class="mtx-fc-bouts">
${bouts}
      </ol>
    </div>
  </section>`;
}

/* ------------------------------------------------------ 5. accuracy note */
const note = `  <section class="mtx-fc-sec mtx-fc-sec--paper mtx-fc-sec--note">
    <div class="mtx-fc-wrap">
      <p class="mtx-fc-note">${esc(one('5 ACCURACY NOTE', 'Body'))}</p>
    </div>
  </section>`;

/* ----------------------------------------------------- 6. format context */
const S6 = '6 FORMAT CONTEXT';
const context = `  <section class="mtx-fc-sec mtx-fc-sec--white mtx-fc-sec--context">
    <div class="mtx-fc-wrap mtx-fc-read">
      <h2 class="mtx-fc-h2">${esc(one(S6, 'H2'))}</h2>
      <p class="mtx-fc-body">${esc(one(S6, 'Body'))}</p>
      <p class="mtx-fc-body">${esc(one(S6, 'Body 2'))}</p>
      <p class="mtx-fc-linkrow"><a class="mtx-fc-jump" href="${esc(one(S6, 'Link destination'))}">${esc(one(S6, 'Link'))}${arrow}</a></p>
    </div>
  </section>`;

/* ---------------------------------------------------- 7. book the next */
const S7 = '7 BOOK THE NEXT EVENT';
const book = `  <section class="mtx-fc-sec mtx-fc-conf">
    <div class="mtx-fc-wrap mtx-fc-read">
      <h2 class="mtx-fc-h2">${esc(one(S7, 'H2'))}</h2>
      <p class="mtx-fc-body" data-mtx-needs-next>${withNext(one(S7, 'Body'))}</p>
      <p class="mtx-fc-cta-row">${ctaLink('mtx-fc-btn--ghost', one(S7, 'CTA'))}</p>
    </div>
  </section>`;

/* ------------------------------------------------------ 8. recent cards */
const S8 = '8 RECENT CARDS';
const recent = RECENT.slice(0, 6);
const recentSec = `  <section class="mtx-fc-sec mtx-fc-sec--paper mtx-fc-sec--recent">
    <div class="mtx-fc-wrap">
      <h2 class="mtx-fc-h2">${esc(one(S8, 'H2'))}</h2>
      <p class="mtx-fc-body">${esc(one(S8, 'Body'))}</p>${recent.length ? `
      <ul class="mtx-fc-recent">
${recent.map(r => `        <li class="mtx-fc-rc">
          <img class="mtx-fc-rc-img" src="${esc(r.poster)}" alt="Rajadamnern Knockout fight card, ${esc(longDate(r.date))}" width="${r.w}" height="${r.h}" loading="lazy" decoding="async">
          <p class="mtx-fc-rc-d"><time datetime="${r.date}">${esc(longDate(r.date))}</time></p>
          <p class="mtx-fc-rc-l">Fight card</p>
        </li>`).join('\n')}
      </ul>` : ''}
    </div>
  </section>`;

/* ------------------------------------------------------------- 9. FAQ */
const S9 = '9 FAQ';
const faq = [1, 2, 3, 4, 5].map(n => ({ q: one(S9, `Question ${n}`), a: one(S9, `Answer ${n}`) }));
const faqSec = `  <section class="mtx-fc-sec mtx-fc-sec--white mtx-fc-sec--faq">
    <div class="mtx-fc-wrap mtx-fc-read">
      <h2 class="mtx-fc-h2">${esc(one(S9, 'H2'))}</h2>
      <div class="mtx-fc-acc">
${faq.map((f, i) => `        <details class="mtx-fc-det">
          <summary><span class="mtx-fc-q">${esc(f.q)}</span>${chev}</summary>
          <div class="mtx-fc-det-b"><p>${i === 4 ? `${esc(f.a)} <a class="mtx-fc-inline" href="${next.href}" data-mtx-cta>${withNext(one(S9, 'Link'))}</a>` : esc(f.a)}</p></div>
        </details>`).join('\n')}
      </div>
    </div>
  </section>`;

/* ------------------------------------------------------ 10. related links */
const S10 = '10 RELATED LINKS';
const rel = [1, 2, 3, 4].map(n => ({ text: one(S10, `Link ${n}`), dest: one(S10, `Destination ${n}`) }));
const related = `  <section class="mtx-fc-sec mtx-fc-sec--paper mtx-fc-related">
    <div class="mtx-fc-wrap">
      <h2 class="mtx-fc-h2">${esc(one(S10, 'H2'))}</h2>
      <ul class="mtx-fc-rel">
${rel.map(l => `        <li><a class="mtx-fc-jump" href="${esc(l.dest)}">${esc(l.text)}${arrow}</a></li>`).join('\n')}
      </ul>
    </div>
  </section>`;

/* ------------------------------------------------------------ phone bar */
const bar = `  <a class="mtx-fc-bar" href="${next.href}" data-mtx-cta data-mtx-fc-bar><span class="mtx-fc-btn-t">${withNext(one(S2, 'Primary CTA'))}</span></a>`;

/* The nights the page script chooses between. */
const embed = `  <script type="application/json" id="mtx-fc-nights">${JSON.stringify({ finishesAtBangkokHour: NIGHTS.finishesAtBangkokHour, schedule: one(S2, 'Secondary CTA destination'), scheduleText: one(S2, 'Secondary CTA'), nights })}</script>`;

writeFileSync(`${OUT}/body.html`, [crumbs, hero, status, cardArea, note, context, book, recentSec, faqSec, related, bar, embed].join('\n\n') + '\n\n');

/* ----------------------------------------------------------- structured data */
const URL = 'https://muaytix.com/rajadamnern-knockout/fight-card';
const META_DESC = 'See the latest Rajadamnern Knockout fight card at Rajadamnern Stadium, Bangkok. Confirmed bouts are updated when announced. Choose seats for the next event online.';
const schema = [
  { '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Rajadamnern Knockout Fight Card', url: URL, description: META_DESC,
    about: [{ '@type': 'Thing', name: 'Rajadamnern Knockout' }, { '@type': 'Thing', name: 'Rajadamnern Stadium' }],
    isPartOf: { '@type': 'WebSite', name: 'MuayTix', url: 'https://muaytix.com/' } },
];
if (recent.length) schema.push({ '@context': 'https://schema.org', '@type': 'ItemList', name: one(S8, 'H2'),
  itemListElement: recent.map((r, i) => ({ '@type': 'ListItem', position: i + 1, name: `Rajadamnern Knockout fight card, ${longDate(r.date)}`, image: r.poster })) });
schema.push({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
  { '@type': 'ListItem', position: 1, name: homeT, item: 'https://muaytix.com/' },
  { '@type': 'ListItem', position: 2, name: hubT, item: 'https://muaytix.com/rajadamnern-knockout' },
  { '@type': 'ListItem', position: 3, name: hereT, item: URL } ] });
writeFileSync(`${OUT}/schema.json`, JSON.stringify(schema, null, 2) + '\n');

if (!process.env.OUT_DIR) writeFileSync('TILDA-PAGE-SETTINGS.txt', `RAJADAMNERN KNOCKOUT FIGHT CARD
Paste these into the Tilda page settings for /rajadamnern-knockout/fight-card.
They are not part of the HTML block.

PAGE ADDRESS (keep as it is)
  /rajadamnern-knockout/fight-card

TITLE
  Rajadamnern Knockout Fight Card | Latest Bouts at Rajadamnern

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
  Title:        Rajadamnern Knockout Fight Card | Latest Confirmed Bouts
  Description:  See the latest confirmed Rajadamnern Knockout line-up at Rajadamnern Stadium. Fight cards are updated when announced. Choose seats for the next event.
  Image:        NOT SET. Needs a current approved card poster, or an approved generic Rajadamnern Knockout hero image, at least 1200 x 630.
  Image alt:    Rajadamnern Knockout fight card at Rajadamnern Stadium in Bangkok

X CARD
  Card:         summary_large_image
  Title:        Rajadamnern Knockout Fight Card | Latest Confirmed Bouts
  Description:  See the latest confirmed Rajadamnern Knockout line-up at Rajadamnern Stadium. Fight cards are updated when announced.
  Image:        NOT SET. Use the same image as Open Graph.

DO NOT ADD
  Meta keywords. "Tonight" in the title or description. A second title or canonical tag.
`);
console.log(`${STATE_B ? 'State B' : 'State A'}: body.html, schema.json written to ${OUT}`);
