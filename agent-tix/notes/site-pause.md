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
