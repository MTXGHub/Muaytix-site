/* Builds the four seat cards.
 *
 *   node gen-seats.mjs   (writes seat-cards.html)
 *
 * The straplines are Jason's own, from the seat class artwork, and they also
 * live in ticket_classes.tagline so the widget and the pages cannot drift.
 * They are not rewritten here.
 *
 * The graphic is optional. A class with no url in seat-images.json renders
 * exactly as it does today, without a broken image and without a gap. That is
 * deliberate: the page has to be pasteable before the images are hosted.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const img = JSON.parse(readFileSync('seat-images.json', 'utf8'));

const CLASSES = [
  { key: 'ringside', name: 'Ringside', anchor: 'ringside',
    tagline: 'Closest to the ring',
    body: 'Floor level, sections 3 to 7. Close enough to hear the corner shouting instructions. Your seat number is printed on your ticket.',
    cta: 'See Ringside seating' },
  { key: 'club_class', name: 'Club Class', anchor: 'club-class',
    tagline: 'Elevated view of the entire ring',
    body: 'Sections 8 and 9, one tier up. You see the whole ring and the whole crowd. Your seat number is printed on your ticket, and a group booked in one order sits together.',
    cta: 'See Club Class seating' },
  { key: 'leo_section', name: 'LEO Section', anchor: 'leo-section',
    tagline: 'Where the atmosphere lives',
    body: 'Section 10, the same tier as Club Class. This is where the Thai regulars sit and where the noise comes from. Seating is open within the section.',
    cta: 'See the LEO Section' },
  { key: 'third_class', name: 'Third Class', anchor: 'third-class',
    tagline: '360 degree view of the action',
    body: 'Section 11, the upper tier, and normally the lowest-priced seat on sale. Seating is open within the section. Third Class opens on selected nights only.',
    cta: 'See Third Class seating' },
];

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const cards = CLASSES.map(c => {
  const gfx = img[c.key];
  if (!gfx) throw new Error(`seat-images.json has no entry for "${c.key}"`);
  /* loading="lazy" on all four: none is above the fold, and four graphics is
     a lot of weight to make a phone fetch before it has drawn anything. */
  const figure = gfx.url
    ? `          <img class="mtx-hp__seatgfx" src="${esc(gfx.url)}" alt="${esc(gfx.alt)}" loading="lazy" decoding="async">\n`
    : '';
  const withGfx = gfx.url ? ' mtx-hp__card--gfx' : '';
  return `        <li class="mtx-hp__card${withGfx}">
${figure}          <h3>${c.name}</h3>
          <p class="mtx-hp__standfirst">${c.tagline}</p>
          <p>${c.body}</p>
          <p class="mtx-hp__cardbtn"><a class="mtx-hp__btn mtx-hp__btn--outline" href="/rajadamnern-stadium-seating#${c.anchor}">${c.cta}</a></p>
        </li>`;
});

writeFileSync('seat-cards.html', cards.join('\n\n') + '\n');
const live = CLASSES.filter(c => img[c.key].url).length;
console.log(`4 seat cards, ${live} with a graphic, ${4 - live} waiting on a Tilda URL`);
