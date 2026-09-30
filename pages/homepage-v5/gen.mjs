/* Renders the homepage from document-a.txt and dynamic-data.json.
 *
 *   node gen.mjs
 *
 * Document B, task type: IMPLEMENTATION ONLY. There is deliberately not one
 * line of customer-facing prose in this file. Every visible string is looked
 * up from document-a.txt by key. If a key is missing the build stops rather
 * than substituting anything, because substituting is how approved copy gets
 * quietly rewritten.
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
const D = data.destinations;

/* The hero photo has no native alt attribute because it is a CSS
   background-image, not an <img>: this hidden paragraph is how a screen
   reader or a crawler gets the description instead. Document B section 12:
   a missing entry stops the build rather than shipping a silent, undescribed
   photo. */
if (!data.hero_image || !data.hero_image.url) throw new Error('hero_image missing from dynamic-data.json. Document B section 12: STOP.');
if (!data.hero_image.alt) throw new Error('hero_image has no alt text.');
const heroAlt = `      <p class="mtx-hp__plain">${esc(data.hero_image.alt)}</p>`;

/* Anything the implementation could not complete from verified data. Reported
   at the end of the build and in the completion response, never patched over. */
const blockers = [];

/* ---------- contrast, measured ---------- */
/* WCAG relative luminance, used to decide black or white type on each of the
   owner's own event colours rather than guessing. All-Star's gold and RWS's
   red sit close enough to the middle that a guess would get one of them
   wrong. Ported from pages/homepage-v6/gen.mjs, where it was built and
   already checked against all six colours below. */
const lum = hex => {
  const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(v => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => {
  const x = lum(a), y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
const INK = '#0b0b0d', WHITE = '#FFFFFF';
function foregroundOn(bg) {
  const onWhite = ratio(bg, WHITE), onInk = ratio(bg, INK);
  const pick = onWhite >= onInk ? WHITE : INK;
  if (Math.max(onWhite, onInk) < 4.5) {
    blockers.push(`No foreground reaches 4.5:1 on ${bg}. Best is ${Math.max(onWhite, onInk).toFixed(2)}:1.`);
  }
  return pick;
}

/* ---------- Section 2: the dated schedule ----------
 *
 * Jason, 28 September 2026, looking at this block live: "these all look the
 * same to me... there's nothing about this block that makes me want to press
 * a button... how can we bring this block alive and give it the personality
 * it should have for each of these events?"
 *
 * Two things were actually wrong, not one. Five identical white cards is the
 * one he named. The other is underneath it: the same event's own paragraph
 * was being printed twice in the same five cards whenever it appeared twice
 * in the coming week (Knockout on both Tuesday and Friday), which reads as
 * the block having nothing to say rather than having said it once well.
 * pages/homepage-v6 diagnosed and fixed both of these in the same building
 * block; that work is reused here rather than invented twice.
 *
 * Each event carries its own colour, already verified for that build:
 * dynamic-data.json now has an accent hex per event. It runs as a bar down
 * the left of its row and as the fill on that row's own button, so a guest
 * reads which fight night is which by colour before they read a word, and
 * every row has a real, differently-coloured button to press rather than
 * five identical black outlines.
 *
 * The description is written into the markup once, on an event's first
 * appearance in the week only -- never twice, however many nights it has
 * coming up. A row with no description of its own simply carries none; the
 * event's full paragraph still exists in Section 5 further down the page.
 */
const NIGHT_SHOW = 5;
const weekCards = week.map(r => {
  const ev = data.events[r.series_slug];
  if (!ev) throw new Error(`dynamic-data.json has no event for series "${r.series_slug}"`);
  if (!ev.accent) throw new Error(`dynamic-data.json has no accent colour for "${r.series_slug}"`);
  const doors = data.doors[r.series_slug];
  if (!doors) throw new Error(`dynamic-data.json has no doors entry for "${r.series_slug}"`);

  /* Document B section 6: never infer a missing value, never guess a time
     from another event. A night with no published doors time simply does not
     show one. */
  const times = doors.time
    ? `          <p class="mtx-hp__night-times">Doors ${esc(doors.time)} &middot; First bout ${esc(r.bell)}</p>\n`
    : '';
  if (!doors.time) blockers.push(`Doors time for ${ev.name} (${r.local_date}) is not published anywhere. The row shows the first bout only.`);

  /* On every row, not once per event. The description is hidden by CSS on
     every row but the one on top, and the script decides which row that is
     at the moment a guest loads the page, not at build time. Baking it onto
     only an event's first occurrence in the 21-day list broke the moment
     that occurrence's own cutoff passed and the row was removed outright:
     Kiatpetch's earliest night carried its only copy, that night closed, and
     Kiatpetch was left on the board with no description at all even though
     two more of its nights were still showing. Every occurrence now carries
     its own copy so any of them can be the one revealed. */
  const desc = `          <p class="mtx-hp__night-desc">${T('week.desc.' + r.series_slug)}</p>\n`;

  /* Document B section 10: do not invent a URL and do not redirect an
     approved anchor to a similar page. No page, no button. */
  let cta = '';
  if (ev.path) {
    cta = `          <p class="mtx-hp__night-go"><a class="mtx-hp__btn" href="${esc(ev.path)}/${esc(r.local_date)}">${T('week.cta.' + r.series_slug)}</a></p>\n`;
  } else {
    blockers.push(`No destination exists for ${ev.name} (${r.local_date}). Document A gives the CTA "${t('week.cta.' + r.series_slug)}" but no URL, so the row renders without a button.`);
  }

  /* The row's destination also lives on the <li>, so the hero's "tonight"
     button can read it without depending on a button being rendered inside
     the row. That dependency is why a card with no CTA silently left the
     hero pointing at whatever was hard-coded in the markup. */
  const href = ev.path ? ` data-mtx-href="${esc(ev.path)}/${esc(r.local_date)}"` : '';

  return `        <li class="mtx-hp__night" style="--accent:${esc(ev.accent)};--accent-on-accent:${esc(foregroundOn(ev.accent))}" data-mtx-date="${esc(r.local_date)}" data-mtx-cutoff="${esc(r.cutoff_utc)}"${href}>
          <span class="mtx-hp__night-bar" aria-hidden="true"></span>
          <div class="mtx-hp__night-when">
            <!-- One paragraph, not two. verify.mjs's authored-sentence audit
                 recognises "Weekday DD Month" as verified data only as a
                 single combined string, matching how the data actually
                 arrives from week.json; splitting weekday and date into
                 separate elements made both unrecognisable and failed the
                 build against the site's own check, found and fixed the same
                 day this was built. -->
            <p class="mtx-hp__night-date">${esc(r.weekday)} ${esc(r.day_label)}</p>
          </div>
          <div class="mtx-hp__night-what">
            <h3 class="mtx-hp__night-name">${esc(ev.name)}</h3>
${times}${desc}          </div>
${cta}        </li>`;
}).join('\n');

/* ---------- Section 3: the five event cards ----------
 * Jason, 30 September 2026, marking up the preview: RWS was the only card
 * with any colour, every other card was plain. Each card now carries its
 * own event's accent as a custom property, the same system already built
 * for the This Week schedule, so the top trim and the button both take the
 * event's own colour and foregroundOn() still picks whichever of black or
 * white actually clears 4.5:1 on it. */
const NIGHT_ORDER = ['rajadamnern-knockout', 'new-power', 'petchyindee', 'rws', 'kiatpetch'];
const nightCards = NIGHT_ORDER.map(k => {
  const ev = data.events[k];
  const logo = ev.logo
    ? `\n          <img class="mtx-hp__evlogo" src="${esc(ev.logo)}" alt="${esc(ev.logo_alt)}" loading="lazy" decoding="async">`
    : '';
  /* Doors, first bell and, on four of the five nights, when it ends: three
     facts Jason dictated card by card so a visitor can tell before they
     travel whether they will make it in time, not three lines of prose. */
  const tm = ev.times;
  /* A non-breaking space before AM/PM stops the line wrapping a time in two,
     e.g. "7:00" stranded from "PM" on the line below it. */
  const nb = s => esc(s).replace(' ', ' ');
  let when = `${T('nights.label.doors')} ${nb(tm.doors)} · ${T('nights.label.first_bell')} ${nb(tm.first_bell)}`;
  if (tm.event_end) when += ` · ${T('nights.label.event_end')} ${nb(tm.event_end)}`;
  else blockers.push(`No event-end time on file for ${ev.name}: card shows doors and first bell only.`);
  return `        <li class="mtx-hp__ev" style="--accent:${esc(ev.accent)};--accent-on-accent:${esc(foregroundOn(ev.accent))}">${logo}
          <h3>${esc(ev.name)}</h3>
          <p class="mtx-hp__hook">${T('nights.hook.' + k)}</p>
          <p class="mtx-hp__evbody">${T('nights.copy.' + k)}</p>
          <p class="mtx-hp__evday">${T('nights.days.' + k)}</p>
          <p class="mtx-hp__evwhen">${when}</p>
          <p class="mtx-hp__evcta"><a class="mtx-hp__btn" href="${esc(ev.path)}">${T('nights.cta.' + k)}</a></p>
        </li>`;
}).join('\n\n');

/* ---------- Section 4: the seat cards ---------- */
const SEATS = ['ringside', 'club-class', 'leo-section', 'third-class'];
const img = JSON.parse(readFileSync('seat-images.json', 'utf8'));
const seatCards = SEATS.map(k => {
  /* A key that does not match must stop the build. The previous version fell
     back to an empty object, so a mistyped key rendered a card with no image
     and reported it as "waiting on a URL" rather than as the fault it was. */
  const gfx = img[k];
  if (gfx === undefined) throw new Error(`seat-images.json has no entry for "${k}"`);
  if (gfx.url && !gfx.alt) throw new Error(`seat-images.json: "${k}" has a url but no alt text`);
  if (gfx.url && !/^https:\/\/static\.tildacdn\.com\//.test(gfx.url)) {
    throw new Error(`seat-images.json: "${k}" url is not on static.tildacdn.com (${gfx.url})`);
  }
  /* Document B section 16: alt text describes the image and introduces no
     claim. It is supplied, not composed here. */
  const figure = gfx.url
    ? `          <img class="mtx-hp__seatgfx" src="${esc(gfx.url)}" alt="${esc(gfx.alt)}" loading="lazy" decoding="async">\n`
    : '';
  if (!gfx.url) blockers.push(`Seat graphic for ${t('seats.name.' + k)} has no hosted URL yet, so that card renders without an image.`);
  return `        <li class="mtx-hp__card${gfx.url ? ' mtx-hp__card--gfx' : ''}">
${figure}          <h3>${T('seats.name.' + k)}</h3>
          <p class="mtx-hp__standfirst">${T('seats.descriptor.' + k)}</p>
          <p>${T('seats.copy.' + k)}</p>
          <p class="mtx-hp__cardbtn"><a class="mtx-hp__btn mtx-hp__btn--outline" href="${D.seating}#${k}">${T('seats.cta.' + k)}</a></p>
        </li>`;
}).join('\n\n');

/* ---------- Section 5: trust ---------- */
const TRUST = [
  ['official', '<path d="M12 2.8l7.5 3v6.1c0 4.3-3 8.2-7.5 9.3-4.5-1.1-7.5-5-7.5-9.3V5.8z"/><path d="M8.8 12.2l2.3 2.3 4.2-4.6"/>'],
  ['groups',   '<circle cx="9" cy="8" r="3.2"/><path d="M2.8 20c0-3.4 2.8-5.6 6.2-5.6s6.2 2.2 6.2 5.6"/><circle cx="17.6" cy="9.2" r="2.4"/><path d="M17.6 14c2.2 0 3.6 1.4 3.6 3.4"/>'],
  ['currency', '<rect x="2.5" y="5.5" width="19" height="13" rx="2"/><path d="M2.5 10h19"/><path d="M6 14.6h3.5"/>'],
  ['qr',       '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v3M17 20h4M14 20h1"/>'],
  ['support',  '<path d="M20.5 12a8.5 8.5 0 1 1-3.4-6.8"/><path d="M8.8 12.3l2.4 2.4 5.3-5.6"/>'],
];
const trustCards = TRUST.map(([k, svg]) => {
  const extra = k === 'qr' ? `\n          <p>${T('trust.copy.qr2')}</p>` : '';
  const cta = k === 'support'
    ? `\n          <p class="mtx-hp__cardbtn"><a class="mtx-hp__btn mtx-hp__btn--outline" href="${esc(D.whatsapp)}" rel="noopener">${T('trust.cta.support')}</a></p>` : '';
  return `        <li class="mtx-hp__trustcard${k === 'qr' ? ' mtx-hp__trustcard--wide' : ''}">
          <svg viewBox="0 0 24 24" aria-hidden="true">${svg}</svg>
          <h3>${T('trust.name.' + k)}</h3>
          <p>${T('trust.copy.' + k)}</p>${extra}${cta}
        </li>`;
}).join('\n\n');

/* ---------- Section 6: the five steps ---------- */
const steps = [1, 2, 3, 4, 5].map(n =>
  `          <li class="mtx-hp__step"><p>${T('guide.step' + n)}</p></li>`).join('\n');
const support = [1, 2, 3, 4, 5, 6, 7].map(n =>
  `      <p>${T('guide.support' + n)}</p>`).join('\n');

/* ---------- Section 7: the questions ---------- */
const faq = [1, 2, 3, 4, 5, 6].map(n =>
  `        <details>
          <summary><h3>${T('faq.q' + n)}</h3></summary>
          <p>${T('faq.a' + n)}</p>
        </details>`).join('\n\n');

const body = `  <header class="mtx-hp__hero">
${heroAlt}
    <div class="mtx-hp__shell">
      <h1>${T('hero.h1')}</h1>
      <p class="mtx-hp__lede">${T('hero.body1')}</p>
      <p class="mtx-hp__lede">${T('hero.body2')}</p>
      <p class="mtx-hp__actions">
        <a class="mtx-hp__btn mtx-hp__btn--blue" href="${esc(D.tickets)}">${T('hero.cta_primary')}</a>
        <a class="mtx-hp__btn mtx-hp__btn--ghost" href="@@TONIGHT@@" data-mtx-tonight>${T('hero.cta_secondary')}</a>
      </p>
    </div>
  </header>

  <section class="mtx-hp__band mtx-hp__band--dark">
    <div class="mtx-hp__shell">
      <span class="mtx-hp__kicker">${T('week.eyebrow')}</span>
      <h2>${T('week.h2')}</h2>
      <p>${T('week.intro')}</p>
      <ol class="mtx-hp__prog" data-mtx-week>
${weekCards}
      </ol>
      <p class="mtx-hp__ctarow">
        <a class="mtx-hp__btn mtx-hp__btn--blue" href="${esc(D.tickets)}">${T('week.section_cta')}</a>
      </p>
    </div>
  </section>

  <section class="mtx-hp__band">
    <div class="mtx-hp__shell">
      <h2>${T('nights.h2')}</h2>
      <p>${T('nights.intro')}</p>
      <ul class="mtx-hp__evs">
${nightCards}
      </ul>
    </div>
  </section>

  <section class="mtx-hp__band mtx-hp__band--paper">
    <div class="mtx-hp__shell">
      <h2>${T('seats.h2')}</h2>
      <p>${T('seats.intro')}</p>
      <ul class="mtx-hp__grid">
${seatCards}
      </ul>
      <p class="mtx-hp__ctarow">
        <a class="mtx-hp__btn mtx-hp__btn--outline" href="${esc(D.seating)}">${T('seats.section_cta')}</a>
      </p>
    </div>
  </section>

  <section class="mtx-hp__band">
    <div class="mtx-hp__shell">
      <h2>${T('trust.h2')}</h2>
      <ul class="mtx-hp__trustgrid">
${trustCards}
      </ul>
    </div>
  </section>

  <section class="mtx-hp__band mtx-hp__band--paper">
    <div class="mtx-hp__shell">
      <h2>${T('guide.h2')}</h2>
      <p>${T('guide.intro')}</p>
      <ol class="mtx-hp__steps">
${steps}
      </ol>
${support}
      <p class="mtx-hp__ctarow">
        <a class="mtx-hp__btn mtx-hp__btn--blue" href="${esc(D.tickets)}">${T('guide.cta')}</a>
      </p>
    </div>
  </section>

  <section class="mtx-hp__band">
    <div class="mtx-hp__shell">
      <h2>${T('faq.h2')}</h2>
      <div class="mtx-hp__faq">
${faq}
      </div>
    </div>
  </section>

  <section class="mtx-hp__band mtx-hp__band--dark">
    <div class="mtx-hp__shell">
      <h2>${T('stadium.h2')}</h2>
      <div class="mtx-hp__venue">
        <div>
          <p>${T('stadium.copy1')}</p>
          <p>${T('stadium.copy2')}</p>
          <p>${T('stadium.copy3')}</p>
        </div>
        <div class="mtx-hp__where">
          <p class="mtx-hp__ctastack">
            <a class="mtx-hp__btn mtx-hp__btn--ghost" href="${esc(D.stadium)}">${T('stadium.cta1')}</a>
            <a class="mtx-hp__btn mtx-hp__btn--ghost" href="${esc(D.seating)}">${T('stadium.cta2')}</a>
            <a class="mtx-hp__btn mtx-hp__btn--ghost" href="${esc(D.maps)}" target="_blank" rel="noopener">${T('stadium.cta3')}</a>
          </p>
        </div>
      </div>
    </div>
  </section>

  <section class="mtx-hp__band mtx-hp__band--paper mtx-hp__close">
    <div class="mtx-hp__shell">
      <h2>${T('final.h2')}</h2>
      <p>${T('final.copy1')}</p>
      <p>${T('final.copy2')}</p>
      <p class="mtx-hp__ctarow">
        <a class="mtx-hp__btn mtx-hp__btn--blue" href="${esc(D.tickets)}">${T('final.cta')}</a>
      </p>
      <p class="mtx-hp__brand">${T('brand.line')}</p>
    </div>
  </section>
`;

writeFileSync('body.html', body);

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
 * while tonight's event is genuinely still bookable, and leaves it on the
 * calendar the rest of the time. No date is ever hard-coded again. */
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
console.log(`week cards: ${week.length} (${NIGHT_SHOW} shown), event cards: ${NIGHT_ORDER.length}, seat cards: ${SEATS.length}`);
if (blockers.length) { console.log(`\n${blockers.length} item(s) reported, not filled in:`); blockers.forEach(b => console.log('  - ' + b)); }
