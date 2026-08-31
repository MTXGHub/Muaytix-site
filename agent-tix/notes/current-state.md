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

---

## V2 as at 30 August 2026

### What is now live in `agent-tix-build`

| Piece | State |
|---|---|
| Schema | 7 migrations, all applied |
| Data | 1–7 September 2026, 7 nights, 22 inventory rows, 24 standing prices |
| `availability` | v3, deployed |
| `create-checkout` | v3, deployed |
| `stripe-webhook-v2` | v1, deployed — needs its signing secret |
| Widget | `agent-tix/widget/booking-widget.html`, 46 browser tests passing |

### The one thing that keeps the two systems apart

V1 and V2 share a single Stripe account, so **both webhook endpoints receive
every event for the account**. Each has to recognise its own work and ignore the
rest.

V1 decides a session is its own purely by the presence of `reservation_id` in
the session metadata. If V2 had used the same key — and it did, until this was
caught — then every V2 booking would have reached V1's webhook, which would have
looked the reservation up in the V1 database, not found it, thrown, and returned
500. Stripe would then have retried it for hours. No money lost and no ticket
sent, but a stream of failures against the live endpoint and precisely the kind
of cross-talk that is supposed to be impossible.

V2 therefore writes `v2_reservation_id` and `source: agent_tix_v2`. V1 sees no
`reservation_id` and drops the event as "not a MuayTix session". V2 requires
both keys and drops everything else. Neither can act on the other's bookings.

This is worth remembering before any change to Stripe metadata on either side.

### Still not done

- `expire_stale_reservations()` has nothing calling it on a schedule. Seats do
  come back on their own — Stripe fires `checkout.session.expired` about 31
  minutes after an abandoned checkout and the webhook releases them — so this is
  a backstop for the case where that event never arrives, not the main path.
  Still worth a cron before this carries real volume.
- Ticket fulfilment is out of scope by instruction and remains manual.
- Only the first week of September is loaded. The rest of September through
  December is a data job, not a build.
- The three widget modes (full month, filtered weekday, single event) — this is
  the full-month mode only.

---

## What the first live test showed — 31 August 2026

Five checkouts, two real payments, and four things worth fixing. The booking
path itself did what it was built to do: the row lock held, no seat was ever
double-sold, and the sale that reached the webhook was recorded correctly.

### A paid booking that the database never heard about

The second attempt succeeded. Visa debit, GBP 34.00, LEO Section on 4 September,
charge `ch_3UAIgmLIQoPqkuKb0LQ2O6p4`, captured and not refunded. Our reservation
row still said `held`.

The webhook endpoint was created at 08:13 UTC. That session was paid at 00:03
UTC. Stripe had nobody to tell, and does not replay events to an endpoint
created afterwards. Reconciled by hand on 31 August by calling
`complete_reservation` with the real session and payment intent, which is
exactly what the webhook would have done.

Two other reservations from the same window were released as `expired`; both
were genuinely unpaid and long expired in Stripe.

Nothing about this recurs now the endpoint exists. It is recorded because it is
the one failure mode that loses money quietly: everything looks fine, the guest
is charged, and the stock never moves.

### The slowness was the CORS preflight, not Stripe

From the edge logs, the first attempt of the day:

| | OPTIONS | POST |
|---|---|---|
| Attempt 1, cold | 3,615 ms | 4,648 ms |
| Attempt 2, warm | 595 ms | 2,103 ms |
| Attempt 3, cold again after 8 hours idle | 3,618 ms | 1,488 ms |

Sending `Content-Type: application/json` is not a CORS-safelisted value, so the
browser sent a separate OPTIONS request and waited for the answer before sending
anything real — and that preflight woke a cold function, so the boot was paid
twice. The widget now sends `text/plain;charset=UTF-8` with the same JSON body,
which the browser treats as a simple request and sends straight out. `req.json()`
does not care what the header says.

On top of that, the widget wakes `create-checkout` the moment a seat class is
chosen, so the boot happens while the guest is still picking a quantity rather
than after they commit.

### Payment methods — a mistake, corrected the same day

Read this before touching `payment_method_types`.

Two V1 sessions were sampled, both priced in THB, and both listed
`payment_method_types: ["card", "link"]`. That was read as "V1 restricts itself
to card and Link", and V2 was changed to match. It was wrong, and it was
reverted within the hour on the operator's correction.

THB simply does not support most methods, so Stripe had filtered them out. A V1
session in EUR from the same week lists eleven: card, bancontact, eps, ideal,
multibanco, link, mb_way, amazon_pay, bizum, satispay and scalapay. The V2 GBP
sessions from the live test list card, afterpay, alipay, klarna, pay_by_bank,
wechat_pay, link, revolut_pay, amazon_pay and billie.

The account's payment method configuration (`pmc_1SFMQ8LIQoPqkuKbQ0cTntoD`) has
Alipay, WeChat Pay, KakaoPay, Naver Pay, Payco, KR Card, Pix, iDEAL, Bancontact,
EPS, Bizum, Satispay, Scalapay, MB Way, Multibanco, Klarna, Afterpay, Billie,
Revolut Pay, pay_by_bank, Amazon Pay, Apple Pay and Google Pay all switched on
and available. That breadth is the entire point of the platform: the methods are
geo-targeted, Alipay and WeChat Pay were added for Chinese visitors with
marketing behind them, and bookings from that market are up 400%.

So the payment methods were never a V1-versus-V2 difference. Both read the same
configuration. Setting `payment_method_types` does not narrow a list — it
replaces the configuration entirely, switching off every geo-specific method at
once, with no error and no failing test.

`agent-tix/functions/tests/checkout-guards.test.mjs` now fails the build if the
field reappears.

The Revolut and RBS problems from the live test are therefore not a V2 fault and
not fixable in our code: V1 offers exactly the same methods through the same
configuration and would behave identically. Standing instruction: no payment
method is to be switched off.

### No customer name

V1 passes `name_collection: { individual: { enabled: true, optional: false } }`.
V2 did not, so Stripe returned an email and no name, and the ticket emails
address the guest by first name. Added, with a fallback: if the pinned API
version rejects the parameter, the session is created again without it rather
than the whole checkout failing.


---

## Second live test — 31 August 2026, 09:35 and 09:37 UTC

Two bookings, one desktop and one mobile. Both landed correctly end to end.

| | Booking A | Booking B |
|---|---|---|
| Night | New Power, 2 September | Rajadamnern Knockout, 4 September |
| Class | LEO Section | Club Class |
| Price | EUR 40.00 | GBP 41.00 |
| Paid with | Link | **Revolut Pay** |
| Reservation to sale | 72 seconds | 119 seconds |
| Name captured | MuayTix Ltd | Jason Mclellan |

Reconciliation is exact: `sold_quantity` equals the sum of completed
reservations on every row, and `reserved_quantity` is zero everywhere. Nothing
stuck. One webhook delivery each, 200 in about 1.4 seconds, no retries.

Three of the fixes proved themselves in live data.

- **The preflight is gone.** From 09:34 onwards the edge log shows only POSTs.
  The OPTIONS entries before that are the previous copy of the widget, still
  embedded until the page was republished.
- **The pre-warm works exactly as designed.** Booking A: a warm ping at 09:35:02
  took 3,409 ms — that was the cold boot — and the real call 26 seconds later
  took 1,960 ms. The guest never saw the boot. Booking B: warm ping 478 ms, real
  call 1,625 ms.
- **Revolut Pay completed cleanly**, which is the direct vindication of not
  switching payment methods off. The earlier failure was the bank, not the
  method: the same payment intent carries a failed `pay_by_bank` attempt
  ("The customer cancelled the payment flow") followed by a successful one.

### The gap this test exposed: a refund does not return the seat

The accidental 4 September LEO Section booking was refunded in Stripe
(`ch_3UAIgmLIQoPqkuKb0LQ2O6p4`, `amount_refunded` 3400, `refunded` true). Our
reservation is still `completed` and `sold_quantity` is still 1. That seat is
paid for by nobody and cannot be sold.

The webhook listens for four events, all of them about the checkout session.
Nothing listens for `charge.refunded`, so a refund is invisible to the stock.

Settled on 31 August: refunds run at one or two a month, so this stays a manual
job. Nothing listens for `charge.refunded` and nothing should — a refund does
not always free a seat, and no rule can tell a cancellation from a goodwill
refund to a guest who still turns up. Guess wrong and you either oversell the
night or lose a seat, and at that volume there is no case for guessing.

What was actually missing was a safe way to do it by hand. `release_reservation`
refuses anything that is not `held`, so returning a sold seat meant editing
`sold_quantity` directly. `refund_reservation(reservation_id)` now does that job
in one call: it returns the seat, marks the booking `refunded`, and refuses to
do it twice. See `how-to-refund.md`.

The 4 September LEO Section seat has been returned; that night is back to 25 of
25 available.
