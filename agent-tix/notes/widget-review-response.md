# Widget code review — what V2 already answers, and what it doesn't

A review of the three live widget files was supplied on 30 August 2026. This maps its
ten findings against the V2 design, and adds what the review could not see: it had the
widget files only, not the Edge Functions or the database.

## The ten findings

| # | Finding | V2 |
|---|---|---|
| 1 | All-or-nothing ticket loading — one missing type kills the whole grid | **Designed out.** The availability view returns a row per class per event; a class with no row simply shows as closed. No all-or-nothing fetch. |
| 2 | Missing description prints "undefined" | **Designed out.** Descriptions come from `ticket_classes.description`, not a lookup map in the widget. |
| 3 | No "not yet released" status; anything unknown shows as FULLY BOOKED | **Designed out, and enforced.** `closed` is distinct from `booking_closed`, and a CHECK constraint refuses to save a closed class without an explanation. |
| 4 | One shared ticket-type list for a whole month | **Designed out.** Stock is per event per class in `event_ticket_classes`. Opening one date changes one row. |
| 5 | No HTML escaping on API data | **Done.** Everything from data goes through `esc()`. |
| 6 | No timeout on the availability check | **Open.** Carry into the real Edge Function call. |
| 7 | No retry on a failed first load | **Open.** Needs a "try again" rather than demanding a page refresh. |
| 8 | Currency formatting differs between widgets | **Done.** One `en-GB` formatter throughout. |
| 9 | Quantity cap differs between widgets | **Done, and enforced.** Capped at 10 in the widget and by a CHECK constraint on `max_per_order`. |
| 10 | Font loading blocks rendering | **Done.** Preconnect plus a plain stylesheet link. |

Eight of ten are already answered. Six and seven are real and still to do.

## New requirement the review adds

**One widget, three modes** — full month, filtered weekday, single event — sharing one
ticket-class grid. The prototype is full-month only. This is the main outstanding
front-end job, and it removes the "jump to" link between the tickets page and a month's
widget, which is a plausible drop-off point.

## One correction

The review says under *Backend gap* that none of the three files ask Supabase for event
data and that all event names and times are typed into the widget. That is true of the
two month widgets but not of `muaytix-master-widget.js`, which reads event name, start,
end and venue from `get_inventory`. The review's own *what's working well* section says
so. Worth being precise, because it changes which file is the better starting point.

## What the review could not see

It had the widget files only. Reading the Edge Functions and the database adds these:

- **There is no events table.** Event identity is copied onto every `ticket_inventory`
  row and held together by an `event_key` string. So the review's question — can Supabase
  answer "give me events between these two dates" — is answered: not today, other than by
  a `select distinct` over inventory. V2's `events` table is exactly this fix.
- **Every inventory row has its own Stripe product.** 371 rows, 371 distinct
  `stripe_product_id` values. This is the real reason Third Class has to be added by hand:
  a new date needs a new Stripe object before it can take money. V2 should use one product
  per class with the price set per booking, which removes the problem permanently.
- **Third Class has no rows at all from 1 September.** The August rows are the last. This
  is the root cause of findings 1 to 4: the widget fabricates a Third Class card in
  JavaScript, with hardcoded prices, precisely because the database returns nothing.
- **Automatic ticket sending is switched off** (`AUTO_SEND_ENABLED = false`), and 157
  draft jobs sit queued and unprocessed since 11 August. Tickets are going out by hand.
  V2 does not have to solve automated delivery to match what is live today.
- **Buakaw nights have no email template.** `eventPresentation()` recognises five event
  names and throws on anything else. "All-Star Fight by Buakaw" matches none, so 31
  August, 28 September, 26 October and 30 November would fail to produce a ticket email
  the moment sending is switched back on. Harmless while it is off; a live failure the
  day it is not.

## Confirmed as worth keeping

The review's list stands: the stale-response guard when switching dates quickly, the
dynamic currency dropdown, never showing exact counts, and locking the controls while
checkout opens. All four are in the prototype.
