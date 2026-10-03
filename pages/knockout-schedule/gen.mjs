/* Lays out the Rajadamnern Knockout schedule page. Presentation only: every
 * visible word is read from copy.json (which comes from brief.txt) and the
 * dates come from data.json, which mirrors the booking calendar.
 *
 *   node extract-copy.mjs && node gen.mjs && node build.mjs
 *
 * Environment, for the checker only: OUT_DIR.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const OUT = process.env.OUT_DIR || '.';
mkdirSync(OUT, { recursive: true });
const C = JSON.parse(readFileSync('copy.json', 'utf8'));
const D = JSON.parse(readFileSync('data.json', 'utf8'));

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const blocks = (sec, label) => { const b = C[sec] && C[sec][label]; if (!b || !b.length) throw new Error(`copy.json has no [${label}] in ${sec}`); return b; };
const lines = (sec, label, i = 0) => blocks(sec, label)[i];
const one = (sec, label, i = 0) => lines(sec, label, i).join(' ');

/* ---------------------------------------------------------------- dates --- */
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const parts = iso => { const [y, m, d] = iso.split('-').map(Number); return { y, m, d, dow: new Date(Date.UTC(y, m - 1, d)).getUTCDay() }; };
const wd = iso => DAYS[parts(iso).dow];
const dm = iso => { const p = parts(iso); return `${p.d} ${MONTHS[p.m - 1]} ${p.y}`; };
const longDate = iso => `${wd(iso)} ${dm(iso)}`;
const shortDate = iso => { const p = parts(iso); return `${wd(iso)} ${p.d} ${MONTHS[p.m - 1]}`; };
const koUrl = iso => `https://muaytix.com/rajadamnern-knockout/${iso}`;
const spUrl = iso => `${D.specialUrlBase}${iso}`;

const entries = [
  ...D.knockout.map(iso => ({ iso, kind: 'knockout' })),
  ...D.special.map(iso => ({ iso, kind: 'special' })),
].filter(e => e.iso >= D.builtOn).sort((a, b) => a.iso.localeCompare(b.iso));
for (const e of entries) {
  const dow = parts(e.iso).dow;
  if (e.kind === 'knockout' && ![1, 2, 5].includes(dow)) throw new Error(`${e.iso} is a ${DAYS[dow]}, not a Knockout night`);
  if (e.kind === 'special' && dow !== 1) throw new Error(`${e.iso} is a ${DAYS[dow]}: a special replacement is a Monday`);
}
const first = entries.find(e => e.kind === 'knockout');
const [fh, fm] = D.firstFightBangkok.split(':').map(Number);
const closeMin = fh * 60 + fm - D.bookingCutoffMinutes;
const closesAt = `${String(Math.floor(closeMin / 60)).padStart(2, '0')}:${String(closeMin % 60).padStart(2, '0')}`;

/* The locked copy names the first night in the next-event button. If the data
   and the copy disagree, stop rather than ship a page that contradicts itself. */
if (one('3 NEXT EVENT', 'Primary CTA') !== `Book tickets for ${shortDate(first.iso)}`) throw new Error(`the next-event button says "${one('3 NEXT EVENT', 'Primary CTA')}" but the first Knockout night is ${shortDate(first.iso)}`);

const arrow = `<svg class="mtx-ks-arr" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M5 12h14M13 6l6 6-6 6"></path></svg>`;
const chev = `<svg class="mtx-ks-chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M6 9l6 6 6-6"></path></svg>`;
const LOGO = { url: 'https://static.tildacdn.com/tild3636-6563-4066-b361-313038626261/1000035222.svg', w: 480, h: 240, alt: 'Rajadamnern Knockout logo' };

/* ---------------------------------------------------------- 1. breadcrumbs */
const [homeT, hubT, hereT] = one('1 BREADCRUMBS', 'Text').split(' / ');
const crumbs = `  <nav class="mtx-ks-crumbs" aria-label="Breadcrumb"><ol class="mtx-ks-wrap">
    <li><a href="/">${esc(homeT)}</a></li><li aria-hidden="true" class="mtx-ks-slash"> / </li><li><a href="/rajadamnern-knockout">${esc(hubT)}</a></li><li aria-hidden="true" class="mtx-ks-slash"> / </li><li aria-current="page">${esc(hereT)}</li>
  </ol></nav>`;

/* --------------------------------------------------------------- 2. hero */
const S2 = '2 HERO';
const hero = `  <header class="mtx-ks-hero">
    <div class="mtx-ks-wrap mtx-ks-hero-in">
      <span class="mtx-ks-logo"><img src="${LOGO.url}" alt="${esc(LOGO.alt)}" width="${LOGO.w}" height="${LOGO.h}" loading="eager" fetchpriority="high" decoding="async"></span>
      <div class="mtx-ks-hero-t">
        <h1 class="mtx-ks-h1">${esc(one(S2, 'H1'))}</h1>
        <p class="mtx-ks-lede">${esc(one(S2, 'Body', 0))}</p>
        <p class="mtx-ks-lede">${esc(one(S2, 'Body', 1))}</p>
        <p class="mtx-ks-days">${esc(one(S2, 'Supporting line'))}</p>
        <p class="mtx-ks-cta-row">
          <a class="mtx-ks-btn mtx-ks-btn--main" href="#mtx-ks-dates" data-mtx-jump>${esc(one(S2, 'Primary CTA'))}</a>
          <a class="mtx-ks-btn mtx-ks-btn--ghost" href="${esc(one(S2, 'Secondary CTA destination'))}">${esc(one(S2, 'Secondary CTA'))}</a>
        </p>
      </div>
    </div>
  </header>`;

/* ---------------------------------------------------- 3. next-event feature */
const S3 = '3 NEXT EVENT';
const ctaText = one(S3, 'Primary CTA'), at = ctaText.indexOf(shortDate(first.iso));
const next = `  <section class="mtx-ks-sec mtx-ks-sec--paper mtx-ks-sec--next" data-mtx-next>
    <div class="mtx-ks-wrap">
      <div class="mtx-ks-feat">
        <h2 class="mtx-ks-h2">${esc(one(S3, 'H2'))}</h2>
        <p class="mtx-ks-fdate" data-mtx-next-date>${esc(longDate(first.iso))}</p>
        <p class="mtx-ks-tonight" data-mtx-tonight hidden>${esc(one('3B TONIGHT (only shown when it is true)', 'Tonight line'))}</p>
        <p class="mtx-ks-fname">${esc(one(S3, 'Event name'))}</p>
        <p class="mtx-ks-body">${esc(one(S3, 'Body'))}</p>
        <ul class="mtx-ks-facts">
${lines(S3, 'Event facts').map(f => `          <li class="mtx-ks-fact">${esc(f)}</li>`).join('\n')}
        </ul>
        <p class="mtx-ks-cta-row"><a class="mtx-ks-btn mtx-ks-btn--main" href="${koUrl(first.iso)}" data-mtx-next-cta><span class="mtx-ks-btn-t">${esc(ctaText.slice(0, at))}<span data-mtx-next-short>${esc(shortDate(first.iso))}</span></span></a></p>
      </div>
    </div>
  </section>`;

/* ------------------------------------------------------------- 4. dates */
const S4 = '4 DATES';
const tabs = lines(S4, 'Month tabs').map(label => { const [m, y] = label.split(' '); return { label, key: `${y}-${String(MONTHS.indexOf(m) + 1).padStart(2, '0')}` }; });
const row = e => {
  const sp = e.kind === 'special';
  const label = longDate(e.iso);
  return `        <li class="mtx-ks-row${sp ? ' mtx-ks-row--special' : ''}" data-date="${e.iso}" data-kind="${e.kind}">
          <p class="mtx-ks-d"><span class="mtx-ks-wd">${wd(e.iso)}</span> <span class="mtx-ks-dm">${esc(dm(e.iso))}</span></p>
          <div class="mtx-ks-ev">${sp ? `
            <p class="mtx-ks-tag">${esc(one(S4, 'Special label'))}</p>` : ''}
            <p class="mtx-ks-name">${esc(sp ? one(S4, 'Special event name') : one(S4, 'Event name'))}</p>
            <p class="mtx-ks-sub">${esc(sp ? one(S4, 'Special supporting line') : one(S4, 'Supporting line'))}</p>
          </div>${sp ? '' : `
          <p class="mtx-ks-time">${esc(one(S4, 'Time line'))}</p>`}
          <a class="mtx-ks-btn mtx-ks-btn--row" href="${sp ? spUrl(e.iso) : koUrl(e.iso)}" aria-label="${esc(`${sp ? one(S4, 'Special CTA') : one(S4, 'CTA')} for ${label}`)}">${esc(sp ? one(S4, 'Special CTA') : one(S4, 'CTA'))}</a>
        </li>`;
};
const panels = tabs.map(t => {
  const rows = entries.filter(e => e.iso.startsWith(t.key));
  return `      <div class="mtx-ks-panel" id="mtx-ks-m-${t.key}" data-month="${t.key}">
        <p class="mtx-ks-mlabel">${esc(t.label)}</p>
        <ul class="mtx-ks-rows">
${rows.map(row).join('\n')}
        </ul>
      </div>`;
}).join('\n');
const dates = `  <section class="mtx-ks-sec mtx-ks-sec--white mtx-ks-sec--dates" id="mtx-ks-dates">
    <div class="mtx-ks-wrap">
      <h2 class="mtx-ks-h2">${esc(one(S4, 'H2'))}</h2>
      <p class="mtx-ks-body">${esc(one(S4, 'Intro'))}</p>
      <ul class="mtx-ks-tabs" data-mtx-tabs>
${tabs.map((t, i) => `        <li><a class="mtx-ks-tab${i === 0 ? ' is-on' : ''}" href="#mtx-ks-m-${t.key}" data-month="${t.key}"${i === 0 ? ' aria-current="true"' : ''}>${esc(t.label)}</a></li>`).join('\n')}
      </ul>
${panels}
    </div>
  </section>`;

/* ---------------------------------------------------------------- 5. plan */
const S5 = '5 PLAN';
const plan = `  <section class="mtx-ks-sec mtx-ks-sec--paper mtx-ks-sec--plan">
    <div class="mtx-ks-wrap mtx-ks-read">
      <h2 class="mtx-ks-h2">${esc(one(S5, 'H2'))}</h2>
      <p class="mtx-ks-body">${esc(one(S5, 'Paragraph 1'))}</p>
      <p class="mtx-ks-body">${esc(one(S5, 'Paragraph 2'))}</p>
      <p class="mtx-ks-body">${esc(one(S5, 'Paragraph 3'))}</p>
      <h3 class="mtx-ks-h3">${esc(one(S5, 'H3'))}</h3>
      <p class="mtx-ks-body">${esc(one(S5, 'Body'))}</p>
      <p class="mtx-ks-body">${esc(one(S5, 'Body 2'))}</p>
      <h3 class="mtx-ks-h3">${esc(one(S5, 'H3 2'))}</h3>
      <p class="mtx-ks-body">${esc(one(S5, 'Body 3'))}</p>
      <p class="mtx-ks-linkrow"><a class="mtx-ks-jump" href="${esc(one(S5, 'Link destination'))}">${esc(one(S5, 'Link'))}${arrow}</a></p>
    </div>
  </section>`;

/* ----------------------------------------------------------------- 6. FAQ */
const S6 = '6 FAQ';
const faq = [1, 2, 3, 4, 5].map(n => ({ q: one(S6, `Question ${n}`), a: one(S6, `Answer ${n}`) }));
const faqSec = `  <section class="mtx-ks-sec mtx-ks-sec--white mtx-ks-sec--faq">
    <div class="mtx-ks-wrap mtx-ks-read">
      <h2 class="mtx-ks-h2">${esc(one(S6, 'H2'))}</h2>
      <div class="mtx-ks-acc">
${faq.map((f, i) => `        <div class="mtx-ks-fq">
          <button class="mtx-ks-fqb" type="button" id="mtx-ks-q${i + 1}" aria-expanded="true" aria-controls="mtx-ks-a${i + 1}"><span class="mtx-ks-q">${esc(f.q)}</span>${chev}</button>
          <div class="mtx-ks-fqp" id="mtx-ks-a${i + 1}" role="region" aria-labelledby="mtx-ks-q${i + 1}"><p>${esc(f.a)}${i === 4 ? ` <a class="mtx-ks-inline" href="${esc(one(S6, 'Link destination'))}">${esc(one(S6, 'Link'))}</a>` : ''}</p></div>
        </div>`).join('\n')}
      </div>
    </div>
  </section>`;

/* ------------------------------------------------------------ 7. related */
const S7 = '7 RELATED LINKS';
const rel = [1, 2, 3, 4].map(n => ({ text: one(S7, `Link ${n}`), dest: one(S7, `Destination ${n}`) }));
const related = `  <section class="mtx-ks-sec mtx-ks-sec--paper mtx-ks-related">
    <div class="mtx-ks-wrap">
      <h2 class="mtx-ks-h2">${esc(one(S7, 'H2'))}</h2>
      <ul class="mtx-ks-rel">
${rel.map(l => `        <li><a class="mtx-ks-jump" href="${esc(l.dest)}">${esc(l.text)}${arrow}</a></li>`).join('\n')}
      </ul>
    </div>
  </section>`;

const bar = `  <a class="mtx-ks-bar" href="#mtx-ks-dates" data-mtx-jump data-mtx-ks-bar>${esc(one(S2, 'Primary CTA'))}</a>`;
const embed = `  <script type="application/json" id="mtx-ks-data">${JSON.stringify({ finishesAtBangkokHour: D.finishesAtBangkokHour, bookingClosesAtBangkok: closesAt })}</script>`;

writeFileSync(`${OUT}/body.html`, [crumbs, hero, next, dates, plan, faqSec, related, bar, embed].join('\n\n') + '\n\n');

/* ----------------------------------------------------------- structured data */
const URL = 'https://muaytix.com/rajadamnern-knockout/schedule';
const META_DESC = 'See upcoming Rajadamnern Knockout dates at Rajadamnern Stadium, Bangkok. Live Muay Thai every Monday, Tuesday and Friday. Book tickets for your date online.';
const SCHEMA_DESC = 'See upcoming Rajadamnern Knockout dates at Rajadamnern Stadium, Bangkok. Live Muay Thai every Monday, Tuesday and Friday.';
const schema = [
  { '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Rajadamnern Knockout Schedule', url: URL, description: SCHEMA_DESC,
    about: [{ '@type': 'Thing', name: 'Rajadamnern Knockout' }, { '@type': 'Thing', name: 'Rajadamnern Stadium' }, { '@type': 'Thing', name: 'Muay Thai' }] },
  { '@context': 'https://schema.org', '@type': 'ItemList', name: 'Rajadamnern Knockout dates',
    itemListElement: entries.map((e, i) => ({ '@type': 'ListItem', position: i + 1,
      name: e.kind === 'special' ? `${one(S4, 'Special event name')}, ${longDate(e.iso)}` : `${one(S4, 'Event name')}, ${longDate(e.iso)}`,
      url: e.kind === 'special' ? spUrl(e.iso) : koUrl(e.iso) })) },
  { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: homeT, item: 'https://muaytix.com/' },
    { '@type': 'ListItem', position: 2, name: hubT, item: 'https://muaytix.com/rajadamnern-knockout' },
    { '@type': 'ListItem', position: 3, name: hereT, item: URL } ] },
];
writeFileSync(`${OUT}/schema.json`, JSON.stringify(schema, null, 2) + '\n');

if (!process.env.OUT_DIR) writeFileSync('TILDA-PAGE-SETTINGS.txt', `RAJADAMNERN KNOCKOUT SCHEDULE
Paste these into the Tilda page settings for /rajadamnern-knockout/schedule.
They are not part of the HTML block.

PAGE ADDRESS (keep as it is)
  /rajadamnern-knockout/schedule

TITLE
  Rajadamnern Knockout Schedule | Monday, Tuesday & Friday

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
  Title:        Rajadamnern Knockout Schedule | Upcoming Bangkok Fight Nights
  Description:  Find upcoming Rajadamnern Knockout dates at Rajadamnern Stadium. Live Muay Thai every Monday, Tuesday and Friday. Book tickets online.
  Image:        NOT SET. Needs an approved Rajadamnern Knockout schedule or event visual, at least 1200 x 630.
  Image alt:    Rajadamnern Knockout schedule at Rajadamnern Stadium in Bangkok

X CARD
  Card:         summary_large_image
  Title:        Rajadamnern Knockout Schedule | Upcoming Bangkok Fight Nights
  Description:  Find upcoming Rajadamnern Knockout dates at Rajadamnern Stadium. Live Muay Thai every Monday, Tuesday and Friday.
  Image:        NOT SET. Use the same image as Open Graph.

DO NOT ADD
  Meta keywords. "Tonight" in the title or description. A second title or canonical tag.
`);
console.log(`${entries.length} rows (${entries.filter(e => e.kind === 'special').length} special): body.html, schema.json written to ${OUT}`);
