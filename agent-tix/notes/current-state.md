# What is actually live today

Read directly from the `muaytix-stripe-elements` Supabase project on 29 August 2026.
Nothing here is from the design documents; where it contradicts them, that is noted.

## The path a guest takes

```
Tilda page  →  muaytix-master-widget   (serves the widget JS)
            →  clever-responder        (get_inventory, create_checkout)
            →  ticket_inventory        (+ ticket_currency_prices)
            →  Stripe hosted checkout
            →  stripe-webhook          (→ gmail_draft_jobs, ticket_pool)
```

Nine Edge Functions are ACTIVE, not the four named in conversation:
`clever-responder`, `stripe-webhook`, `muaytix-master-widget`, `booking-cutoff-closer`,
`tilda-inspector`, `muaytix-august-calendar`, `muaytix-august-scroll-fix`,
`ticket-intake`, `resend-inbound-intake`.

There is no application code in git. The widget frontends are string constants inside
Edge Functions — one as a plain template literal, one gzipped and base64'd into the
source. That is the single largest process risk here: there is no diff, no history, and
no review on the code that takes money.

## The urgent one: the calendar widget runs out on 31 August

`muaytix-august-calendar` carries a hardcoded `EVENTS` array covering **11–31 August 2026
and nothing else**. The month heading is the literal string `August 2026`, and the weekday
header row is fixed Monday–Sunday.

Today is 29 August. After Monday 31 August that widget renders an August 2026 calendar
with no selectable dates.

This is worth confirming against which pages actually embed it (the function is ACTIVE and
was last updated 11 August). If it is live anywhere customer-facing, 1 September is not a
target date — it is the date the current calendar stops working.

## Open Gap 7 (hardcoded event data) — confirmed, and wider than described

Two widgets, and they differ:

- **`muaytix-master-widget`** does *not* hardcode event data. It reads event name, start,
  end and venue from `get_inventory`. What it does hardcode is a `DESCRIPTIONS` map of the
  four ticket-class blurbs.
- **`muaytix-august-calendar`** hardcodes a great deal:
  - 21 dated events: key, title, formatted date string, time string, and the cutoff
    hour/minute, for six distinct event types
  - `EVENT_DESCRIPTIONS` — the "format of the night" copy, keyed by event title
  - `DESCRIPTIONS` — the four class blurbs again, a near-duplicate of the master widget's
    copy that has already drifted ("from the elevated seating" vs "from elevated seating")
  - `CLOSED_THIRD_MESSAGE` — the Third Class explanation
  - `THIRD_CLASS_IMAGE` and `THIRD_CLASS_PRICES` — a six-currency price list in JavaScript

  The hardcoded prices are display-only: `closedThirdTicket` returns `status:'closed'` and
  `maxPerOrder:0`, so a guest cannot check out against them. They can still be *shown* a
  price from a JS constant that nothing keeps in step with Stripe.

`muaytix-august-scroll-fix` is a third, similarly compressed bundle. Not decoded — the
name and version history suggest another variant of the same widget.

## Six event types, not one

The calendar's own data shows the weekly shape:

| Event | Days | Time |
|---|---|---|
| Rajadamnern Knockout | Mon, Tue, Fri | 7:00–9:00 PM |
| New Power Traditional Muay Thai | Wed | 6:00–10:00 PM |
| Petchyindee Traditional Muay Thai | Thu | 6:00–10:00 PM |
| RWS Rajadamnern World Series | Sat | 7:10–10:00 PM |
| Kiatpetch Traditional Muay Thai | Sun | 6:00–10:00 PM |
| All-Star Fight by Buakaw | Mon 31 Aug only | 7:00–9:00 PM |

Five recurring patterns plus a one-off, which is exactly the hybrid the Phase 0 decision
describes. It also answers Open Gap 6 in practice: `EVENT_DESCRIPTIONS` is keyed by event
*title*, so today the format-of-the-night paragraph is already written once per recurring
event, not per date.

## What the design documents under-credit

The calendar widget already implements more of Phase 2 than the plan assumes:

- Date is selected first, from a calendar, and selecting one triggers a live
  `get_inventory` call
- All four classes render for the chosen date in a fixed display order
- A `closed` status exists with its own grey status bar and an explanation note
- A sticky "change date" bar

So Phase 2 is not a green-field build. It is largely promoting that widget's mechanic to
data-driven, and redesigning the layout. The 2×2 desktop grid and single-column mobile
stack that Section 10 complains about are both there in the CSS.

The schema is also further along than the plan implies. `ticket_inventory` already carries
`release_status`, `manual_status`, `limited_threshold`, `show_seating_notice`,
`maximum_seats_together`, `display_order` and `max_per_order`. The four-status system and
the manual Third Class release both have real columns behind them.

## What is genuinely missing

- **No events table.** Event identity — name, start, end, venue, image — is copied onto
  every `ticket_inventory` row and held together by an `event_key` string. Four classes for
  one night means the event name is stored four times.
- **No description column anywhere in the database.** The format-of-the-night paragraph has
  nowhere to live, which is why it is in JavaScript.
- **No recurrence model.** Nothing expresses "RWS, Saturdays".
- **No guest details before Stripe.** Stripe collects name and phone at checkout
  (`name_collection`, `phone_number_collection`), so nothing is captured on abandonment.
- **No tenant concept.** The CORS allowlist is two hardcoded muaytix.com origins.

## Behaviour worth preserving

Read off `clever-responder`, since a rebuild has to match it or regress:

- **Status precedence**: inactive/hidden → not released → past cutoff → sold out →
  manual override → at/below threshold → available. An override is checked *after*
  sold-out, so it can never claim stock that does not exist. Worth keeping deliberately.
- **Booking cutoff** is 30 minutes before start, hardcoded.
- **Reservations** are held 30 minutes via a `reserve_ticket_inventory` RPC, matched to the
  Stripe session expiry, and released via `release_ticket_reservation` if Stripe fails.
- **Seating acknowledgement** is enforced server-side, not just in the widget: a quantity
  above `maximum_seats_together` without acknowledgement returns 409 `seating_ack_required`.
- **Quantity is capped at 10** in three places independently.
- **Currency selection** sets `adaptive_pricing: false` and uses a fixed `price_data`
  amount; falling back to the legacy `stripe_price_id` re-enables adaptive pricing.

## Two things to raise separately

- **Currency sits above quantity in the card markup**, exactly as Section 4 complains. In
  the current layout it is the first control a guest meets.
- **Two font stacks across the estate.** The booking widgets load Montserrat; the
  muaytixtonight.com Webflow build uses Barlow and Barlow Condensed.
