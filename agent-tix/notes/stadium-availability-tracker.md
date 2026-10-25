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
- `o` on each day: **1 = a normal show day, 0 = the stadium has marked the whole day Closed** (first seen 22 Oct 2026 13:42 Bangkok on Sun 21 Feb 2027). The log then carries `t: 'day'`, `s: 'C'`, with no zones. A closed day means no show: take that night off sale.
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

## Watching it

- Rebuild cycle about every 6 minutes, and an immediate rebuild when the stadium edits something (watched 22 Oct 2026).
- On 22 Oct the tracker grew from 365 days to 455 (1 Jan to 31 Mar 2027, all On Sale, Third Class Not Yet On Sale).

## Last Mondays of 2027 (22 October 2026)

The stadium's own programme shows the last Monday of each month in 2027 as Rajadamnern Knockout. Jason will check with the stadium whether they are loading those separately as All Star Elite Fighter by Buakaw. Until he says, 25 Jan, 22 Feb and 29 Mar 2027 are loaded as **Rajadamnern Knockout** (they were first loaded as All Star by the weekly rule in `0044_load_2027_q1.sql`, then switched back at his request; no sales on them). If the stadium confirms All Star, switch them back: series, name, event key `all_star_buakaw_YYYY_MM_DD`, and Club Class offer off.

## LEO Section's "safety net" (Jason, 22 October 2026, his explanation, numbers hypothetical)

LEO is an unassigned area, so it has some give that Ringside and Club Class do not.
When bookings arrive in a sudden surge, a **safety net** closes LEO (Stop Sale)
pending a check of the numbers. It sits roughly 50 below capacity (capacity about
300), so it tends to trip around 250 bookings, but only on a surge, not every time.
The stadium then checks what has really been booked; if they are still under the
upper limit they **reopen LEO for another batch** (his example: the next 35). So
**a LEO Stop Sale is not always a sell-out**: it can be a pause that reverses.
Seen once already: LEO on Tue 8 Dec went Stop Sale on 21 Oct (13:58) and back to On
Sale on 22 Oct (15:24). Matters for any automation: a LEO Stop Sale should be
reported to Jason as "paused, may reopen", not treated as final. Jason
confirmed that was the whole explanation: background only, it does not always happen.

## It now runs by itself (built and switched on 22 October 2026, evening)

Jason, going to bed after two nights without sleep: "you're going to make the change
based on what's coming out of the stadium data." So the tracker is followed
automatically, day and night, without any chat being open.

- **What runs:** the database's own clock (`pg_cron`, every 3 minutes) calls the
  `stadium-sync` edge function (`agent-tix/functions/stadium-sync/`), which reads the
  tracker, compares it with the previous read and hands every change to
  `stadium_apply_change()` (`schema/0045_stadium_sync.sql`), where the rules live.
- **The rules** act on changes the stadium makes, not on standing differences:
  A -> F on Ringside / Club / LEO / Third: close ours as Fully booked, unless it is on
  `stadium_hold` (stock Jason holds himself: left open, logged). F -> A: reopen only a
  class this automation closed and nobody has touched since. Third Class N -> A: open it
  at whatever total it carries (50). A whole day Closed: pause all four classes (Booking
  closed); reopening is Jason's. Everything else is logged. Quantities are never changed.
- **What to read to see what it did:** `stadium_changes` (rows with built = 'TEST'
  are the 22 Oct tests). Health: `stadium_sync_settings.last_run_at` and `last_error`.
- **Stop it:** `update stadium_sync_settings set enabled = false` (does nothing at all),
  or `dry_run = true` (logs what it would do, changes nothing).
- **Limits and safety:** a read with more than 25 changes applies none and says so;
  a page that does not parse as expected changes nothing; the call needs a shared
  token held in `stadium_sync_settings`.
- **Holds:** add a class to `stadium_hold` whenever Jason pre-buys stock for it. At setup
  it holds: 23 Oct Knockout LEO; RWS 24 Oct Ringside and LEO, 31 Oct LEO, 7 Nov Ringside
  and LEO, 14 Nov LEO, 21 Nov Club and LEO, 28 Nov Club.
- **Not built yet:** a message to Jason when something happens (he has not chosen a
  channel). Until then, read `stadium_changes`.
- The tracker address is stored in `stadium_sync_settings.tracker_url` in the database,
  never in git.

## 2027 Q1 paused (22 October 2026, Jason)

New stadium rates were issued for 2027. All four classes on all 90 nights, 1 Jan to 31 Mar 2027,
were set to `manual_status = 'booking_closed'` (356 rows changed; the four 21 Feb "Stadium Closed"
rows were already closed). Nothing else was touched: stock, prices and release status are as loaded.
Read back: all Ringside, Club Class and LEO rows show `booking_closed`; Third Class shows closed.
To reopen a night later: set `manual_status = null` for its classes. The stadium follower will not
reopen these (it only reopens classes it closed itself), so reopening is always by hand.

## Stop Sale against real seats, Sun 25 Oct 2026 (Jason's own look at the stadium's seat maps, 24 Oct about 15:10 Bangkok)

Tracker (build 15:06): Panoramic Balcony, Couple Suite and Presidential Box all Stop Sale for Sun 25 Oct.
What Jason saw on the seat maps, read out to me, not checked by me:
- Presidential Box (zones A and B): both fully booked. Agrees with Stop Sale.
- Panoramic Balcony: 14 sold, 1 available (the rate card says 15 seats).
- Couple Suite: 2 seats sold, 2 available.
So Stop Sale is not always sold out. Jason (24 Oct 2026): the stadium's own instructions to agents say
Stop Sale does not mean a section is fully booked; it is a buffer to stop agents overselling, and he is
fine with that. Unless a big group takes the whole section. Couple Suite is 4 suites of 2 seats, 2 suites
booked, so he thinks the trigger there is about 50 per cent, to be confirmed by him. Not one percentage
fits every zone: Panoramic Balcony was stopped with 1 of 15 left, Couple Suite with 2 of 4, and
Presidential Box Thu 12 Nov with about 27 of 44 left, so any buffer is probably set zone by zone.
Earlier example: Presidential Box Thu 12 Nov was on Stop Sale with about 27 of 44 seats still open;
by 24 Oct the tracker shows it On Sale again, after Jason's feedback to the stadium.

## Pushover alerts (built 25 October 2026, switched ON by Jason the same evening)

Phone alerts through Pushover (app "MuayTix Updates"). Keys are in `stadium_sync_settings`
(`pushover_user_key`, `pushover_app_token`, never in git). Switch: `pushover_enabled` (false = silent).
Built entirely in the database (`schema/0046` and `0047`), so the payment function and the follower
function are unchanged.
- **Every paid booking:** trigger on `checkout_reservations` when status becomes `completed`:
  "Sat 14 Nov, 2 x LEO Section, paid 3,000 THB". No name, email or card country (Jason's choice).
  A booking that becomes `paid_without_stock` sends a high-priority "PAID, NO TICKETS LEFT".
- **Follower actions:** trigger on `stadium_changes`: every row except `baseline` and `TEST`. Errors and
  "NOT APPLIED" are high priority. VIP zone changes are not logged, so they do not alert.
- Both triggers swallow every error so an alert can never stop a sale or a log row.
- To turn off: `update stadium_sync_settings set pushover_enabled = false where id = 1`.
- Tested 25 Oct: a plain test message, a sample booking message (an old booking, labelled TEST) and a
  fake follower row (marked TEST afterwards) all reached Pushover with status 1.
