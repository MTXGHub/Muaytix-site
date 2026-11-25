# Whole-site pause (Jason, 14 November 2026, 16:26 Bangkok)

Jason asked for all bookings on the website to be blocked and sent to the stadium's own site.

## What was done (read back from the database)

- Every class on every night from 14 Nov 2026 onwards (138 nights, 552 class rows) set to `booking_closed`.
- Every one of those nights given `divert_url = https://rajadamnern.com/tickets/` (no note, so the standard wording shows).
- Read back: 0 class rows still buyable, 0 nights without the link.
- Nothing was deleted. Before the change, each class's old `manual_status` and each night's old divert link and note were saved
  in the table `site_pause_backup` (taken 14 Nov 2026 about 16:26 Bangkok; service role only).

## What a guest sees

Choosing a night shows "Booking closed with us" and a button to the stadium's page. The calendar itself still lists the nights.
**Not checked on the live site** (muaytix.com cannot be reached from here).

## What is NOT blocked

- Checkouts already started: a guest on Stripe's page can still pay for up to 31 minutes after starting.
- Stripe sessions and payment links made by hand: the VIP ones for 29 Dec (Panoramic and Couple Suite) and 2 Jan, until they expire.
- The stadium watcher cannot undo this: it only reopens a class it closed itself, and only from Fully booked, and Third Class
  opening keeps any pause (migration 0049). It will log changes but not reopen anything.

## How to undo

Do it only on Jason's word, and for the nights he names. A blind restore of everything would overwrite counts and statuses
changed after 14 Nov 16:26. The old values are in `site_pause_backup`:

```sql
-- statuses (kind 'class'):
update public.event_ticket_classes etc set manual_status = b.manual_status
  from public.site_pause_backup b where b.kind = 'class' and b.event_ticket_class_id = etc.id;
-- divert link and note (kind 'event'):
update public.events e set divert_url = b.divert_url, divert_note = b.divert_note
  from public.site_pause_backup b where b.kind = 'event' and b.event_id = e.id;
```
Add `and etc.event_id in (...)` to limit it to chosen nights, then read the four classes back for each.

## Reopened since the pause

- 14 Nov 2026 ~16:35 Bangkok: RWS Sat 21 Nov, Third Class (Jason). Status restored from the backup (open). Read back: 34 total, 6 sold, 28 left, Available. The other three classes that night and the night's stadium link were left as the pause set them (Ringside shows Booking closed; Club Class and LEO are sold out and show Fully booked).
- 14 Nov 2026 ~16:40 Bangkok: RWS Sat 28 Nov, Third Class and LEO Section (Jason). Statuses restored from the backup (open). Read back: Third Class 10 total, 0 sold, 10 left; LEO 26 total, 19 sold, 7 left (12 left when Jason confirmed it on 12 Nov; three bookings since, 5 tickets). Club Class sold out (shows Fully booked); Ringside still shows Booking closed from the pause.
- 14 Nov 2026 ~16:45 Bangkok: RWS Sat 5 Dec, Ringside and LEO Section (Jason). Statuses restored from the backup (open). Read back: Ringside 9 total, 3 sold, 6 left; LEO 35 total, 7 sold, 28 left. **LEO 35 is still the unchecked figure: Jason said on 12 Nov he would check Ticketmelon (the 25 plus 10 may have been 25 in all) and has not come back with the answer.** Club Class and Third Class for 5 Dec remain paused.

## Pause lifted (Jason, 16 November 2026, about 07:45 Bangkok)

- All 552 class rows and 138 nights restored from `site_pause_backup`: old statuses back, stadium links removed. Read back: 0 future nights still diverted, 130 classes on sale, 281 still Booking closed (the 2027 nights paused before the pause, awaiting pricing).
- **Stop Sales that happened during the pause were re-applied.** The watcher had logged them as "already paused, left as is", so a plain restore would have left those classes open against a stadium Stop Sale. 12 classes closed as Fully booked and logged as automation closes (so a stadium reopening will undo them): 16 Nov LEO; 17 Nov Ringside, Club, LEO; 18 Nov Ringside, Club, LEO; 19 Nov Ringside, Club; 20 Nov LEO; 22 Nov Ringside, Club. Held-list classes were left open, as the watcher does.
- Third Class opened by the stadium during the pause (16, 17, 18, 19, 22 Nov) is now open at the 50 working number.
- The backup table is kept in case it is needed again.

## Second pause (Jason, 23 November 2026, about 11:00 Bangkok)

Jason: "put the redirects on all bookings... redirect them into the Stadium website".
- Every class on every night from 23 Nov 2026 onwards (129 nights, 516 class rows) set to `booking_closed`; each night given `divert_url = https://rajadamnern.com/tickets/`. Read back: 0 classes still buyable, 129 of 129 nights with the link.
- Fresh backup of the old statuses and links is in `site_pause_backup` (taken 23 Nov). The first pause's backup is kept as `site_pause_backup_14nov`. The undo SQL above works on the new backup unchanged.
- Not blocked: checkouts already started (31 minutes) and the hand-made Stripe link for 4 Third Class, Kiatpetch 22 Nov (expires 17:00 Bangkok).
- The timer `close-club-allstar-30nov-1700bkk` is still set; it would change Club Class 30 Nov from Booking closed to Fully booked at 17:00.
- On lifting: re-apply any stadium Stop Sale the watcher logged as "already paused" during this pause (see the 16 Nov note), or those classes reopen against a Stop Sale.
- 23 Nov 2026 ~11:15 Bangkok: RWS Sat 28 Nov (all classes) and Sat 5 Dec (Club, LEO, Ringside) reopened by Jason; statuses restored from the 23 Nov backup and the stadium link removed from both nights. 5 Dec Third Class deliberately left Booking closed (working number 50, no real count). Other nights still paused.

## Second pause lifted (Jason, 25 November 2026, about 22:35 Bangkok)

- Restored from the 23 Nov backup, only for classes still marked Booking closed on nights from 25 Nov onwards (139 class rows). Classes changed since the backup (28 Nov and 5 Dec reopened, Club Class 30 Nov closed by its timer) were left as they were. Stadium link removed from every night from 25 Nov. Read back: 0 future nights diverted, 102 classes on sale, 360 still Booking closed (the 2027 nights awaiting pricing, as before). 6 past nights keep the link, which does nothing.
- Stadium cross-check: the watcher logged Stop Sales as "already paused" during the pause for 25 Nov Ringside and Club (night over), 30 Nov Ringside and Club (both closed anyway) and **25 Dec Ringside**. 25 Dec Ringside re-applied as Fully booked (logged as an automation close). Then compared the stadium's latest snapshot with ours for every future night: the only classes open against a stadium Stop Sale are 28 Nov Third Class, 5 Dec LEO and Ringside and 12 Dec Club Class, all on the held list on purpose.
