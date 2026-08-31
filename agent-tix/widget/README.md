# The booking widget

`widget.js` is the whole thing. It is served from one address and every page
points at that address, so changing the widget changes every page at once.
Nothing is pasted into a page and nothing needs re-pasting when it changes.

## Putting it on a page

At the bottom of the page, once:

```html
<script src="https://jlwopomkqeawrxlapwpc.supabase.co/functions/v1/widget"></script>
```

Then wherever the widget should appear:

**The full calendar** — pick a month, then a date, then a seat class.

```html
<div class="muaytix-ticket-selector"></div>
```

**One fight night** — no calendar, no month buttons, straight to the seats.

```html
<div class="muaytix-ticket-selector" data-event-id="rws_2026_09_05"></div>
```

**One fight night, one seat class** — opened, not offered as a choice.

```html
<div class="muaytix-ticket-selector"
     data-event-id="rws_2026_09_05"
     data-ticket-class="Third Class"></div>
```

Seat classes may be listed with commas, and either the name or the code works:
`data-ticket-class="Ringside, Club Class"`.

More than one may sit on the same page; each keeps its own state.

The attribute names are the same ones already on the site, so a page moves
across by changing which script tag it loads and nothing else.

## It has to be served from muaytix.com

The widget file itself will load anywhere, but the two functions it calls check
where the request came from and answer only muaytix.com and www.muaytix.com. A
Tilda *preview* runs on a `.tilda.ws` address, so publish the page and open it
on the real domain. To test somewhere else, add that origin to the tenant row —
no code change.

## What is data and what is code

Everything a guest sees comes from the database:

| On screen | Comes from |
|---|---|
| Which nights are on | `events`, via `event_calendar` |
| Promotion name and colour | `event_series.name`, `.short_name`, `.accent_colour` |
| Start and end times | `events.starts_at` / `ends_at`, converted to Bangkok in the view |
| Seat class names, descriptions, colours | `ticket_classes` |
| Available / Limited / Fully booked / Closed | `ticket_availability_status()` |
| The closed explanation | `event_ticket_classes.closed_explanation` |
| Prices and currencies | `ticket_class_prices`, overridden per night by `event_ticket_price_overrides` |
| Largest block of seats together | `event_ticket_classes.maximum_seats_together` |
| Most tickets one guest may buy | `max_per_order`, capped by what is left |

Adding a month, a new promoter, a fifth seat class or a seventh currency is a
data change. This file does not move.

## What it never does

- Never shows a remaining count. The database exposes a status, not a number.
- Never sends a price. The browser says which night, which class, how many and
  which currency; the price is read server side. A guest editing the page
  cannot change what they are charged.
- Never lets the seating warning be skipped. The widget blocks the button and
  `create-checkout` refuses the order again on its own.

## Running the tests

```
node agent-tix/widget/tests/booking-widget.test.mjs   # the flow, 59 checks
node agent-tix/widget/tests/widget-modes.test.mjs     # the three modes, 18 checks
node agent-tix/functions/tests/checkout-guards.test.mjs
```

Both browser suites drive the widget inside a page that does what the live
Tilda page did — centring everything, blacking out button text, changing the
typeface — and check the rendered result, not the markup. Set `CHROMIUM_PATH`
if Playwright cannot find a browser.

## Why every rule carries `#mtx-booking`

The widget lives inside somebody else's page, and that page has its own
stylesheet. On the first live embed Tilda won two fights it should never have
been in: the reserve button rendered as a solid black rectangle because the
host's rule beat ours on `color`, and every description came out centred
because Tilda centres the text in its blocks.

Both were specificity. The class names are all prefixed `mtx-`, which stops the
host matching our elements by accident, but a rule like
`#allrecords button{color:#000}` outranks a bare `.mtx-go` and wins anyway. So
every rule is scoped to `#mtx-booking`, and every mount point carries that id.

A repeated id is not valid HTML and that is a deliberate trade: an id selector
is the only thing that reliably outranks a page builder, and nothing here looks
an element up by id — each widget is handed its own root and searches within it.

Alignment needed one more step. A host rule like `#allrecords *{text-align:
center}` matches each element **directly**, and a direct match beats an
inherited value however specific the ancestor is. So every element inside the
card is told explicitly, and the few that genuinely centre are told back again
one level up.

## The served copy

`build-served-copy.mjs` strips the comments for the version that goes down the
wire. `widget.js` stays the source of truth and keeps every comment.

## Standing rule: payment methods

`create-checkout` must never set `payment_method_types`. Stripe's payment method
configuration decides, and it is set up deliberately — Alipay and WeChat Pay for
Chinese visitors, the European methods for Europe. Setting that field does not
narrow the list, it replaces the configuration and switches all of it off at
once. `agent-tix/functions/tests/checkout-guards.test.mjs` enforces this.
