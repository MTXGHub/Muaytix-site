# The stadium's availability tracker (beta, first read 22 October 2026)

The stadium gave Jason, as one of its top agents, a read-only availability page
built on Google Apps Script. **The address is not stored here on purpose**: it is
his link, ask him for it. Reading it needs `script.google.com` allowed in the
cloud environment's network settings (Jason added it on 22 October 2026).

## What it is (read and checked 22 October 2026)

- A plain GET (no login, no key) returns an HTML page of about 82 KB. The page
  carries its whole data set inside it as a JavaScript object:
  `const DATA = {zones, events, log, generated, today}` (inside the
  `userHtml` string; it must be un-escaped first).
- `zones`: PANORAMIC, COUPLE, PRESIDENTIAL, RINGSIDE, CLUB, LEO, THIRD, in that
  order. Ours are RINGSIDE (3 to 7), CLUB (8 and 9), LEO (10), THIRD (11).
- `events`: one row per calendar day, all of 2026 (365 rows when read), each
  `{d: "2026-10-22", o: 1, z: "AAAAAAN"}`. `z` is one letter per zone in the
  order above: **A = On Sale, F = Stop Sale, N = Not Yet On Sale.**
- `log`: the latest changes, 39 entries when read (the page itself shows only
  the 20 most recent): `{at, t, d, s, z}` = when, kind, the night, new status
  letter, which zones.
- `generated`: when the data was built (read 22 October 11:33 Bangkok; the page
  footer said "Updated 10:08" a little earlier on a phone). How often the
  stadium refreshes its sheet is not known: ask them.
- The page is a viewer, not a documented API. If the stadium changes its layout
  the reading code breaks; ask them for a plain data address.

## How it compares with ours (22 October 2026)

Across all 71 upcoming nights, Ringside, Club Class, LEO and Third Class, the
only differences were deliberate: 14 Nov LEO (stadium Stop Sale, ours reopened
by Jason because MuayTix holds its own tickets) and 28 Nov Ringside and Club
(ours paused by Jason, stadium On Sale). So **a stadium Stop Sale must never
close a class automatically without a way for Jason to say "I hold these"**.

Third Class: the stadium shows it On Sale for 24 Oct and 14 Nov only.
