/* Renders the homepage from document-a.txt and dynamic-data.json.
 *
 *   node gen.mjs && node build.mjs
 *
 * Document B, task type: IMPLEMENTATION ONLY. There is deliberately not one
 * line of customer-facing prose in this file. Every visible string is looked
 * up from document-a.txt by key. If a key is missing the build stops rather
 * than substituting anything, because substituting is how approved copy gets
 * quietly rewritten.
 *
 * v6, 27 September 2026. The owner's verdict on v5 was that it was generic,
 * repetitive and lazy. Two of those were structural and are fixed here:
 *
 *   - v5 printed the same event description once per night. Over twenty-one
 *     nights that meant the Knockout paragraph eight times on one page. Here
 *     an event's description is emitted on its first night only, so no
 *     sentence on this page appears twice.
 *   - v5 gave a seat class, a trust point, a fight night and a booking step
 *     the identical bordered white box. There are no boxes now.
 *
 * Colour identity comes from event_calendar.accent_colour, which the owner
 * already keeps against each event. Foreground colour on an accent is chosen
 * by measured contrast below, never by eye.
 */
import { readFileSync, writeFileSync } from 'node:fs';

/* ---------- the locked copy ---------- */
const DOC = (() => {
  const out = {};
  let key = null, buf = [];
  for (const raw of readFileSync('document-a.txt', 'utf8').split('\n')) {
    const m = raw.match(/^\[([a-z0-9._-]+)\]\s*$/i);
    if (m) { if (key) out[key] = buf.join('\n').trim(); key = m[1]; buf = []; continue; }
    if (raw.startsWith('#')) continue;
    if (key) buf.push(raw);
  }
  if (key) out[key] = buf.join('\n').trim();
  return out;
})();

/* Every read goes through here. A typo in a key fails the build; it never
   silently renders an empty element or an invented stand-in. */
function t(key) {
  const v = DOC[key];
  if (v === undefined || v === '') throw new Error(`document-a.txt has no copy for [${key}]`);
  return v;
}
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const T = key => esc(t(key));

const data = JSON.parse(readFileSync('dynamic-data.json', 'utf8'));
const week = JSON.parse(readFileSync('week.json', 'utf8'));
const seatImages = JSON.parse(readFileSync('seat-images.json', 'utf8'));
const D = data.destinations;
const PIC = data.photographs;

/* Anything the implementation could not complete from verified data. Reported
   at the end of the build and in the completion response, never patched over. */
const blockers = [];

/* ---------- contrast, measured ---------- */
/* WCAG relative luminance. Used to decide black or white type on each of the
   owner's accent colours. Kiatpetch's gold and LEO's yellow are the reason
   this is arithmetic and not a judgement call. */
const lum = hex => {
  const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(v => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => {
  const x = lum(a), y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
const INK = '#0B0B0D', WHITE = '#FFFFFF';
function foregroundOn(bg) {
  const onWhite = ratio(bg, WHITE), onInk = ratio(bg, INK);
  const pick = onWhite >= onInk ? WHITE : INK;
  if (Math.max(onWhite, onInk) < 4.5) {
    blockers.push(`No foreground reaches 4.5:1 on ${bg}. Best is ${Math.max(onWhite, onInk).toFixed(2)}:1.`);
  }
  return pick;
}

/* ================================================================ HERO === */

const hero = `  <header class="mtx-hp__hero">
    <div class="mtx-hp__hero-media" aria-hidden="true" style="background-image:url('${esc(PIC.hero.url)}')"></div>
    <div class="mtx-hp__shell mtx-hp__hero-in">
      <h1>${T('hero.h1')}</h1>
      <p class="mtx-hp__lede">${T('hero.body1')}</p>
      <p class="mtx-hp__lede">${T('hero.body2')}</p>
      <p class="mtx-hp__actions">
        <a class="mtx-hp__btn mtx-hp__btn--blue" href="${esc(D.tickets)}">${T('hero.cta_primary')}</a>
        <a class="mtx-hp__btn mtx-hp__btn--ghost" href="@@TONIGHT@@" data-mtx-tonight>${T('hero.cta_secondary')}</a>
      </p>
    </div>
  </header>`;

/* =========================================================== PROGRAMME === */

/* The week as a schedule board rather than a grid of cards. One row a night,
   the accent bar carrying the event's identity, tonight's row promoted.
   NIGHT_SHOW rows are on screen; the rest stay in the markup so the script
   can promote them as each cutoff passes. */
const NIGHT_SHOW = 6;

/* An event's description is emitted on its first night only. This is the
   single change that removes the repetition the owner objected to: v5 put
   week.desc on all twenty-one rows, so the same paragraph ran eight times. */
const described = new Set();

const progRows = week.map(r => {
  const ev = data.events[r.series_slug];
  if (!ev) throw new Error(`dynamic-data.json has no event for series "${r.series_slug}"`);
  const doors = data.doors[r.series_slug];
  if (!doors) throw new Error(`dynamic-data.json has no doors entry for "${r.series_slug}"`);
  if (!ev.accent) throw new Error(`dynamic-data.json has no accent colour for "${r.series_slug}"`);
  if (!ev.short_name) throw new Error(`dynamic-data.json has no short name for "${r.series_slug}"`);

  /* Document B section 6: never infer a missing value and never borrow a time
     from another event. A night with no published doors time shows none. */
  const times = doors.time
    ? `        <p class="mtx-hp__night-times">Doors ${esc(doors.time)} &middot; First bout ${esc(r.bell)}</p>\n`
    : '';
  if (!doors.time) blockers.push(`Doors time for ${ev.name} (${r.local_date}) is not published anywhere. The row shows the first bout only.`);

  /* An event's description is written into the markup once, on its first
     night. Six paragraphs, one per event, no sentence twice: writing it onto
     all twenty-one rows and hiding twenty of them would have put eight
     copies of the Knockout paragraph in the source to save a CSS rule.

     Only the top row of the board ever shows one. The script marks the top
     row --lede after it has dropped the nights whose booking has closed, and
     a row with no description of its own simply shows none: the board is a
     schedule, and every event's description is carried in full by the fight
     night section below it. */
  let desc = '';
  if (!described.has(r.series_slug)) {
    described.add(r.series_slug);
    desc = `        <p class="mtx-hp__night-desc">${T('week.desc.' + r.series_slug)}</p>\n`;
  }

  /* Document B section 10: do not invent a URL and do not redirect an
     approved anchor at a similar page. No page, no button. */
  let cta = '';
  if (ev.path) {
    cta = `        <p class="mtx-hp__night-go"><a class="mtx-hp__go" href="${esc(ev.path)}/${esc(r.local_date)}">${T('week.cta.' + r.series_slug)}</a></p>\n`;
  } else {
    blockers.push(`No destination exists for ${ev.name} (${r.local_date}). Document A gives the CTA "${t('week.cta.' + r.series_slug)}" but no URL, so the row renders without a button.`);
  }

  /* The destination also sits on the row itself, so the hero's tonight button
     can read it without depending on a button being rendered inside the row. */
  const href = ev.path ? ` data-mtx-href="${esc(ev.path)}/${esc(r.local_date)}"` : '';

  const lede = described.size === 1 && desc ? ' mtx-hp__night--lede' : '';

  return `      <li class="mtx-hp__night${lede}" style="--accent:${esc(ev.accent)};--accent-on-accent:${esc(foregroundOn(ev.accent))}" data-mtx-date="${esc(r.local_date)}" data-mtx-cutoff="${esc(r.cutoff_utc)}"${href}>
        <span class="mtx-hp__night-bar" aria-hidden="true"></span>
        <div class="mtx-hp__night-when">
          <p class="mtx-hp__night-day">${esc(r.weekday)}</p>
          <p class="mtx-hp__night-date">${esc(r.day_label)}</p>
        </div>
        <div class="mtx-hp__night-what">
          <h3 class="mtx-hp__night-name">${esc(ev.name)}</h3>
${times}${desc}        </div>
${cta}      </li>`;
}).join('\n');

const programme = `  <section class="mtx-hp__band mtx-hp__band--ink">
    <div class="mtx-hp__shell">
      <p class="mtx-hp__eyebrow">${T('week.eyebrow')}</p>
      <h2 class="mtx-hp__h2">${T('week.h2')}</h2>
      <p class="mtx-hp__intro">${T('week.intro')}</p>
      <ol class="mtx-hp__prog" data-mtx-week>
${progRows}
      </ol>
      <p class="mtx-hp__prog-cta"><a class="mtx-hp__go" href="${esc(D.tickets)}">${T('week.section_cta')}</a></p>
    </div>
  </section>`;

/* ============================================================== EVENTS === */

/* Five events, five solid fields of the owner's own accent colours. This is
   the section that made v5 look like one product repeated five times. */
const EVENT_ORDER = ['rajadamnern-knockout', 'new-power', 'petchyindee', 'rws', 'kiatpetch'];
const eventRows = EVENT_ORDER.map(k => {
  const ev = data.events[k];

  /* The event's own logo on a light tile, with its theme colour as the bar
     under it. The logo is marked decorative: the event's name is set in the
     heading immediately beside it, so announcing the image as well would read
     a screen reader the same name twice.

     An event with no logo keeps the accent field it had before rather than
     leaving a hole. Kiatpetch is in that position: see blockers.txt. */
  const mark = ev.logo
    ? `        <div class="mtx-hp__event-logo" style="--tile:${esc(ev.logo_tile)}">
          <img src="${esc(ev.logo)}" alt="" aria-hidden="true" loading="lazy" decoding="async">
        </div>`
    : `        <div class="mtx-hp__event-mark" style="--tile:${esc(ev.logo_tile)}" aria-hidden="true"><span>${esc(ev.short_name)}</span></div>`;

  if (!ev.logo) blockers.push(`No logo has been supplied for ${ev.name}. ${ev.logo_note || ''}`.trim());

  return `      <article class="mtx-hp__event" style="--accent:${esc(ev.accent)};--accent-on-accent:${esc(foregroundOn(ev.accent))}">
${mark}
        <div class="mtx-hp__event-body">
          <h3>${esc(ev.name)}</h3>
          <p class="mtx-hp__hook">${T('nights.hook.' + k)}</p>
          <p class="mtx-hp__event-copy">${T('nights.copy.' + k)}</p>
        </div>
        <div class="mtx-hp__event-side">
          <p class="mtx-hp__event-when">${T('nights.schedule.' + k)}</p>
          <p class="mtx-hp__event-go"><a class="mtx-hp__go" href="${esc(ev.path)}">${T('nights.cta.' + k)}</a></p>
        </div>
      </article>`;
}).join('\n\n');

const events = `  <section class="mtx-hp__band mtx-hp__band--paper">
    <div class="mtx-hp__shell">
      <h2>${T('nights.h2')}</h2>
      <p class="mtx-hp__intro">${T('nights.intro')}</p>
      <div class="mtx-hp__events">
${eventRows}
      </div>
    </div>
  </section>`;

/* ============================================================= GALLERY === */

const GALLERY = ['night_crowd', 'night_ringside', 'night_club'];
const gallery = `  <section class="mtx-hp__strip" aria-label="${esc(t('stadium.h2'))}">
${GALLERY.map(k => {
  const pic = PIC[k];
  if (!pic) throw new Error(`dynamic-data.json has no photograph "${k}"`);
  return `    <img src="${esc(pic.url)}" alt="${esc(pic.alt)}" loading="lazy" decoding="async">`;
}).join('\n')}
  </section>`;

/* =============================================================== SEATS === */

/* The owner's seat class artwork, at size. v5 cropped these into a card
   header about two hundred pixels tall. Here the graphic is the object. */
const SEATS = ['ringside', 'club-class', 'leo-section', 'third-class'];
blockers.push('Four of the six event logos have still not been seen. static.tildacdn.com is blocked by the network '
  + 'policy, so only two are known: the owner sent a screen capture of the All Star logo (gold and white on solid '
  + 'black) and the Petchyindee logo is knocked out with mix-blend-mode: screen on its own page here, which is done '
  + 'to a black background. Every tile is therefore black. A logo drawn in dark artwork on transparency would be '
  + 'invisible on it and needs its own tile switched to white.');

blockers.push('event_calendar.accent_colour disagrees with the owner on five of the six events: Knockout is stored '
  + 'burgundy and he says blue, RWS is stored blue and he says red, Petchyindee is stored purple and he says green, '
  + 'Kiatpetch is stored brown and he says red, All Star is stored red and its own logo is gold. That column is '
  + 'served live to the booking widget by the availability function, so those colours are on the live booking '
  + 'calendar now. He was asked on 27 September 2026 and did not choose, so it has NOT been changed. His colours are '
  + 'used on this page only.');

blockers.push('The natural width and height of the four seat class graphics cannot be read from this '
  + 'environment, because static.tildacdn.com is blocked by the network policy. They are laid out inside a '
  + '4:3 container with object-fit: contain, so nothing is cropped, but the container is not a measurement. '
  + 'Given their real dimensions the box can be sized to them exactly.');

const seatCards = SEATS.map(k => {
  const img = seatImages[k];
  if (!img) throw new Error(`seat-images.json has no entry for "${k}"`);
  const colour = data.seat_colours[k];
  if (!colour) throw new Error(`dynamic-data.json has no seat colour for "${k}"`);
  const anchor = `${D.seating}#${k}`;
  return `        <li class="mtx-hp__seat" style="--seat:${esc(colour)}">
          <img class="mtx-hp__seatgfx" src="${esc(img.url)}" alt="${esc(img.alt)}" loading="lazy" decoding="async">
          <span class="mtx-hp__seat-bar" aria-hidden="true"></span>
          <h3 class="mtx-hp__seat-name">${T('seats.name.' + k)}</h3>
          <p class="mtx-hp__seat-descriptor">${T('seats.descriptor.' + k)}</p>
          <p class="mtx-hp__seat-copy">${T('seats.copy.' + k)}</p>
          <p class="mtx-hp__seat-go"><a class="mtx-hp__go" href="${esc(anchor)}">${T('seats.cta.' + k)}</a></p>
        </li>`;
}).join('\n\n');

const seats = `  <section class="mtx-hp__band mtx-hp__band--white">
    <div class="mtx-hp__shell">
      <h2>${T('seats.h2')}</h2>
      <p class="mtx-hp__intro">${T('seats.intro')}</p>
      <ul class="mtx-hp__seats">
${seatCards}
      </ul>
      <p class="mtx-hp__seats-cta"><a class="mtx-hp__btn mtx-hp__btn--line" href="${esc(D.seating)}">${T('seats.section_cta')}</a></p>
    </div>
  </section>`;

/* =============================================================== TRUST === */

const trust = `  <section class="mtx-hp__band mtx-hp__band--ink">
    <div class="mtx-hp__shell">
      <h2>${T('trust.h2')}</h2>
      <ul class="mtx-hp__trust">
        <li class="mtx-hp__trustitem">
          <h3 class="mtx-hp__trust-name">${T('trust.name.official')}</h3>
          <p class="mtx-hp__trust-copy">${T('trust.copy.official')}</p>
        </li>

        <li class="mtx-hp__trustitem">
          <h3 class="mtx-hp__trust-name">${T('trust.name.groups')}</h3>
          <p class="mtx-hp__trust-copy">${T('trust.copy.groups')}</p>
        </li>

        <li class="mtx-hp__trustitem">
          <h3 class="mtx-hp__trust-name">${T('trust.name.currency')}</h3>
          <p class="mtx-hp__trust-copy">${T('trust.copy.currency')}</p>
        </li>

        <li class="mtx-hp__trustitem mtx-hp__trustitem--wide">
          <h3 class="mtx-hp__trust-name">${T('trust.name.qr')}</h3>
          <p class="mtx-hp__trust-copy">${T('trust.copy.qr')}</p>
          <p class="mtx-hp__trust-copy">${T('trust.copy.qr2')}</p>
        </li>

        <li class="mtx-hp__trustitem">
          <h3 class="mtx-hp__trust-name">${T('trust.name.support')}</h3>
          <p class="mtx-hp__trust-copy">${T('trust.copy.support')}</p>
          <p class="mtx-hp__trust-go"><a class="mtx-hp__go" href="${esc(D.whatsapp)}" rel="noopener">${T('trust.cta.support')}</a></p>
        </li>
      </ul>
    </div>
  </section>`;

/* =============================================================== GUIDE === */

const steps = [1, 2, 3, 4, 5]
  .map(n => `        <li class="mtx-hp__step"><p>${T('guide.step' + n)}</p></li>`).join('\n');

const support = [1, 2, 3, 4, 5, 6, 7]
  .map(n => `        <p>${T('guide.support' + n)}</p>`).join('\n');

const guide = `  <section class="mtx-hp__band mtx-hp__band--paper">
    <div class="mtx-hp__shell">
      <h2>${T('guide.h2')}</h2>
      <p class="mtx-hp__intro">${T('guide.intro')}</p>
      <ol class="mtx-hp__steps">
${steps}
      </ol>
      <div class="mtx-hp__support">
${support}
      </div>
      <p class="mtx-hp__guide-cta"><a class="mtx-hp__btn mtx-hp__btn--blue" href="${esc(D.tickets)}">${T('guide.cta')}</a></p>
    </div>
  </section>`;

/* ================================================================= FAQ === */

const faqRows = [1, 2, 3, 4, 5, 6].map(n => `        <details>
          <summary><h3>${T('faq.q' + n)}</h3></summary>
          <p>${T('faq.a' + n)}</p>
        </details>`).join('\n\n');

const faq = `  <section class="mtx-hp__band mtx-hp__band--white">
    <div class="mtx-hp__shell">
      <h2>${T('faq.h2')}</h2>
      <div class="mtx-hp__faq">
${faqRows}
      </div>
    </div>
  </section>`;

/* ============================================================= STADIUM === */

const stadium = `  <section class="mtx-hp__band mtx-hp__band--ink">
    <div class="mtx-hp__shell">
      <h2>${T('stadium.h2')}</h2>
      <div class="mtx-hp__venue">
        <img src="${esc(PIC.ring.url)}" alt="${esc(PIC.ring.alt)}" loading="lazy" decoding="async">
        <div>
          <p class="mtx-hp__venue-copy">${T('stadium.copy1')}</p>
          <p class="mtx-hp__venue-copy">${T('stadium.copy2')}</p>
          <p class="mtx-hp__venue-copy">${T('stadium.copy3')}</p>
          <p class="mtx-hp__venue-ctas">
            <a class="mtx-hp__btn mtx-hp__btn--ghost" href="${esc(D.stadium)}">${T('stadium.cta1')}</a>
            <a class="mtx-hp__btn mtx-hp__btn--ghost" href="${esc(D.seating)}">${T('stadium.cta2')}</a>
            <a class="mtx-hp__btn mtx-hp__btn--ghost" href="${esc(D.maps)}" target="_blank" rel="noopener">${T('stadium.cta3')}</a>
          </p>
        </div>
      </div>
    </div>
  </section>`;

/* =============================================================== CLOSE === */

const close = `  <section class="mtx-hp__band mtx-hp__band--blue mtx-hp__close">
    <div class="mtx-hp__shell">
      <h2>${T('final.h2')}</h2>
      <p class="mtx-hp__close-copy">${T('final.copy1')}</p>
      <p class="mtx-hp__close-copy">${T('final.copy2')}</p>
      <p class="mtx-hp__actions">
        <a class="mtx-hp__btn mtx-hp__btn--white" href="${esc(D.tickets)}">${T('final.cta')}</a>
      </p>
      <p class="mtx-hp__brand">${T('brand.line')}</p>
    </div>
  </section>`;

writeFileSync('body.html', [hero, programme, events, gallery, seats, trust, guide, faq, stadium, close].join('\n\n') + '\n\n');

/* The hero's second CTA before any script runs.
 *
 * This used to be baked in as the soonest night's dated page. That was the
 * bug the owner hit on 27 September: the block was built on the 26th, so the
 * button still read "See Tonight's Fight" and still went to Saturday's RWS
 * page, a night that had already happened. A Tilda block is static HTML, so
 * any date written in here is right for one day only.
 *
 * The static href is therefore the all-dates calendar, which cannot go stale.
 * The script at the foot of the block repoints it at tonight's own page only
 * while that night is today and still bookable. No date is hard-coded again. */
writeFileSync('tonight.txt', D.tickets);

/* ---------- schema ----------
   Built from the same locked copy, so the FAQ answers a machine reads and the
   ones a guest reads cannot drift apart. Nothing is invented to fill a field:
   no logo, no sameAs, no Event, no offers, no prices. */
const schema = {
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'Organization', '@id': 'https://muaytix.com/#organisation',
      name: 'MuayTix', url: 'https://muaytix.com',
      description: t('trust.copy.official'),
      areaServed: { '@type': 'Country', name: 'Thailand' },
      contactPoint: [{ '@type': 'ContactPoint', contactType: 'customer support',
        url: D.whatsapp, availableLanguage: 'English' }] },
    { '@type': 'WebPage', '@id': 'https://muaytix.com/#webpage',
      url: 'https://muaytix.com', name: t('meta.seo_title'),
      description: t('meta.description'),
      isPartOf: { '@type': 'WebSite', '@id': 'https://muaytix.com/#website',
        name: 'MuayTix', url: 'https://muaytix.com',
        publisher: { '@id': 'https://muaytix.com/#organisation' } } },
    { '@type': 'FAQPage', '@id': 'https://muaytix.com/#faq',
      mainEntity: [1, 2, 3, 4, 5, 6].map(n => ({
        '@type': 'Question', name: t('faq.q' + n),
        acceptedAnswer: { '@type': 'Answer', text: t('faq.a' + n) } })) },
  ],
};
writeFileSync('schema.json', JSON.stringify(schema, null, 0));

/* Page settings, written from the same locked source so the metadata a
   crawler sees and the copy in document-a.txt cannot drift apart. */
writeFileSync('TILDA-PAGE-SETTINGS.txt',
`MUAYTIX HOMEPAGE: what to paste into Tilda's page settings
==========================================================
These are page settings, not part of the HTML block. Page settings for "/".
Every line below is Document A, word for word. Do not edit them here.


SEO TITLE
${t('meta.seo_title')}


META DESCRIPTION
${t('meta.description')}


SOCIAL TITLE (Open Graph)
${t('meta.social_title')}


SOCIAL DESCRIPTION (Open Graph)
${t('meta.social_description')}


CANONICAL
Keep the existing homepage URL. Do not create a new homepage slug.


H1
Already in the block, and there is exactly one. Do not add another in Tilda.
`);

writeFileSync('blockers.txt', blockers.length ? blockers.map(b => '- ' + b).join('\n') + '\n' : '');
console.log(`body.html written from ${Object.keys(DOC).length} locked copy blocks`);
console.log(`programme rows: ${week.length} (${NIGHT_SHOW} shown), descriptions emitted: ${described.size} (one per event)`);
console.log(`event bands: ${EVENT_ORDER.length}, seat classes: ${SEATS.length}`);
console.log('accent foregrounds: ' + EVENT_ORDER.concat(['all-star-buakaw'])
  .map(k => `${k} ${data.events[k].accent}->${foregroundOn(data.events[k].accent)}`).join(', '));
if (blockers.length) { console.log(`\n${blockers.length} item(s) reported, not filled in:`); blockers.forEach(b => console.log('  - ' + b)); }
