/* Builds the dated night cards for block 2 straight from week.json, which is
   pulled from event_calendar + events.
   node gen-week.mjs   (writes week-cards.html)

   The cutoff written onto each card is the real one: the first bout minus
   events.booking_cutoff_minutes. It is an absolute UTC instant, so the page
   drops a night the moment booking closes rather than at midnight. A guest is
   never offered a night nobody can buy for.

   Doors are not in the database. The day-dated pages carry them and the
   offsets there are exact: RWS opens 70 minutes before the first bout, every
   other promoter 60. Those two numbers reproduce every published doors time,
   so they are used rather than a vague "about an hour". */
import { readFileSync, writeFileSync } from 'node:fs';

const DOORS_OFFSET = { rws: 70 };
const DOORS_DEFAULT = 60;

/* Series slug -> the page a card links to, and the name on the card.
   All Star has no page of its own yet, so it goes to the live calendar
   rather than to a guessed URL. A guessed URL is a broken link. */
const EVENT = {
  'rws':                  { name: 'RWS Rajadamnern World Series', path: '/rws' },
  'kiatpetch':            { name: 'Kiatpetch Muay Thai',          path: '/kiatpetch-muay-thai' },
  'all-star-buakaw':      { name: 'All Star Fight by Buakaw',     path: null },
  'rajadamnern-knockout': { name: 'Rajadamnern Knockout',         path: '/rajadamnern-knockout' },
  'new-power':            { name: 'New Power Muay Thai',          path: '/new-power-muay-thai' },
  'petchyindee':          { name: 'Petchyindee Muay Thai',        path: '/petchyindee-muay-thai' },
};
const CALENDAR = '/rajadamnern-stadium-tickets';

function clock(label) {
  const [, h, m, ap] = label.match(/^(\d{1,2}):(\d{2}) (AM|PM)$/);
  let hours = Number(h) % 12;
  if (ap === 'PM') hours += 12;
  return hours * 60 + Number(m);
}
function label(mins) {
  const h24 = Math.floor(mins / 60), m = mins % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${h24 < 12 ? 'AM' : 'PM'}`;
}

const rows = JSON.parse(readFileSync('week.json', 'utf8'));
const cards = rows.map(r => {
  const ev = EVENT[r.series_slug];
  if (!ev) throw new Error(`No event mapped for series "${r.series_slug}"`);
  const bell = clock(r.bell);
  const doors = label(bell - (DOORS_OFFSET[r.series_slug] ?? DOORS_DEFAULT));
  const href = ev.path ? `${ev.path}/${r.local_date}` : CALENDAR;
  return `        <li class="mtx-hp__night" data-mtx-date="${r.local_date}" data-mtx-cutoff="${r.cutoff_utc}">
          <h3>${ev.name}</h3>
          <p class="mtx-hp__when">${r.weekday} ${r.day_label}</p>
          <p class="mtx-hp__times">Doors ${doors} &middot; First bout ${r.bell}</p>
          <p class="mtx-hp__nightcta"><a class="mtx-hp__btn mtx-hp__btn--outline" href="${href}">Book Tickets</a></p>
        </li>`;
});

writeFileSync('week-cards.html', cards.join('\n') + '\n');

/* The hero's Tonight button before any script runs, which is what a crawler
   and a reader with no JavaScript get. It is the first night in the schedule,
   so it is a real bookable night rather than a fixed date that goes stale.
   The script at the foot of the page repoints it for everyone else. */
const first = rows[0];
const firstEvent = EVENT[first.series_slug];
const heroHref = firstEvent.path ? `${firstEvent.path}/${first.local_date}` : CALENDAR;
writeFileSync('hero-tonight.txt', heroHref);

console.log(`${cards.length} night cards, ${rows[0].local_date} to ${rows.at(-1).local_date}`);
console.log(`hero Tonight button -> ${heroHref}`);
