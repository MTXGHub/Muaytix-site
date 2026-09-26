/* Renders /rajadamnern-stadium-tickets from document-a.txt.
 *   node gen.mjs
 * Corrections brief, 27 September 2026, rule 1: this file has no say in the
 * copy. Every visible string comes from document-a.txt, which is section 4 of
 * that brief transcribed. Nothing here rewrites, shortens or corrects a word. */
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
const D = data.destinations, L = data.night_links;
const reports = [];

/* Rule 1 and rule 5: report, do not fix. */
reports.push('Rule 5 says British English. FAQ answer 5 reads "about 55 percent". British English is "per cent". Published exactly as you wrote it.');
reports.push('Rule 5 says no "choose your seats". The page says "Choose your fight night", "Choose your seat class" and "choose your seat class". None of them is the banned phrase, so all are published as written. Flagging only so you know I looked.');
reports.push('Your own house rule bans "assigned" and "unassigned" as guest copy. This brief uses both, in four table cells and two FAQ answers. The brief is newer and more specific, so they are published as written. This is the thing I failed to flag last time.');
reports.push('The Getting There section has no nearest station, as before. Nothing is invented.');
reports.push('No VIP row. The brief does not ask for one.');
reports.push('Sections 7 and 8 of the original brief, the footer anchor and the redirects, are still Tilda jobs. They are in tilda-jobs.txt and are unchanged.');

const priceRows = [1,2,3,4].map(r => `          <tr>
            <th scope="row">${T(`prices.r${r}.c1`)}</th>
            <td>${T(`prices.r${r}.c2`)}</td>
            <td>${T(`prices.r${r}.c3`)}</td>
            <td>${T(`prices.r${r}.c4`)}</td>
          </tr>`).join('\n');

const nightRows = [1,2,3,4,5,6,7].map(r => {
  let ev = `<a class="mtx-rt__tlink" href="${esc(L['r'+r])}">${T(`nights.r${r}.c2`)}</a>`;
  if (DOC[`nights.r${r}.c2b`]) ev += `<a class="mtx-rt__tlink mtx-rt__tlink--small" href="${esc(L['r'+r+'b'])}">${T(`nights.r${r}.c2b`)}</a>`;
  return `          <tr>
            <th scope="row">${T(`nights.r${r}.c1`)}</th>
            <td>${ev}</td>
            <td>${T(`nights.r${r}.c3`)}</td>
            <td>${T(`nights.r${r}.c4`)}</td>
            <td>${T(`nights.r${r}.c5`)}</td>
          </tr>`;
}).join('\n');

const FAQ = [1,2,3,4,5,6,7,8,9,10,11,12];

const page = `  <header class="mtx-rt__hero">
    <div class="mtx-rt__shell">
      <h1>${T('hero.h1')}</h1>
      <p class="mtx-rt__lede">${T('hero.lede')}</p>
      <p class="mtx-rt__detail">${T('hero.detail')}</p>
      <p class="mtx-rt__ctarow">
        <a class="mtx-rt__btn mtx-rt__btn--blue" href="#booking">${T('hero.btn1')}</a>
        <a class="mtx-rt__btn mtx-rt__btn--ondark" href="#prices">${T('hero.btn2')}</a>
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
            <th scope="col">${T('prices.th.1')}</th>
            <th scope="col">${T('prices.th.2')}</th>
            <th scope="col">${T('prices.th.3')}</th>
            <th scope="col">${T('prices.th.4')}</th>
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
            <th scope="col">${T('nights.th.1')}</th>
            <th scope="col">${T('nights.th.2')}</th>
            <th scope="col">${T('nights.th.3')}</th>
            <th scope="col">${T('nights.th.4')}</th>
            <th scope="col">${T('nights.th.5')}</th>
          </tr></thead>
          <tbody>
${nightRows}
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
      <p class="mtx-rt__detail">${T('book.detail')}</p>
    </div>
  </section>

  <section class="mtx-rt__band">
    <div class="mtx-rt__shell">
      <h2>${T('door.h2')}</h2>
      <p>${T('door.body')}</p>
      <ul class="mtx-rt__bullets">
${[1,2,3,4].map(n => `        <li>${T('door.b' + n)}</li>`).join('\n')}
      </ul>
      <p class="mtx-rt__detail">${T('door.detail')}</p>
    </div>
  </section>

  <section class="mtx-rt__band mtx-rt__band--paper">
    <div class="mtx-rt__shell">
      <h2>${T('map.h2')}</h2>
      <p>${T('map.body')}</p>
      <figure class="mtx-rt__maplayout">
        <img src="${esc(data.seat_map_url)}" alt="${T('map.alt')}" loading="lazy" decoding="async">
      </figure>
      <p class="mtx-rt__ctarow">
        <a class="mtx-rt__btn mtx-rt__btn--outline" href="${esc(D.seating)}">${T('map.btn')}</a>
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
        <a class="mtx-rt__btn mtx-rt__btn--outline" href="${esc(D.stadium)}">${T('go.btn')}</a>
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
      <p class="mtx-rt__lede">${T('close.lede')}</p>
      <p class="mtx-rt__ctarow">
        <a class="mtx-rt__btn mtx-rt__btn--blue" href="#booking">${T('close.btn')}</a>
      </p>
    </div>
  </section>
`;
writeFileSync('body.html', page);

const schema = { '@context': 'https://schema.org', '@type': 'FAQPage',
  mainEntity: FAQ.map(n => ({ '@type': 'Question', name: t('faq.q' + n),
    acceptedAnswer: { '@type': 'Answer', text: t('faq.a' + n) } })) };
writeFileSync('schema.json', JSON.stringify(schema));

writeFileSync('reports.txt', reports.map(r => '- ' + r).join('\n') + '\n');
console.log(`${Object.keys(DOC).length} locked blocks. 4 price rows, 7 night rows, ${FAQ.length} FAQs.`);
