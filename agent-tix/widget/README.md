# The booking widget

`booking-widget.html` is the whole thing. Paste it into a Tilda HTML block
(T123) on a page at muaytix.com. There is nothing else to install.

## It has to be served from muaytix.com

Both Edge Functions check the browser's `Origin` header against
`tenants.allowed_origins` and refuse anything else. Today that list holds:

    https://muaytix.com
    https://www.muaytix.com

A Tilda *preview* runs on a `.tilda.ws` address, so the widget will report that
it cannot load the fight nights there. Publish the page and open it on the real
domain. To test somewhere else, add that origin to the tenant row first —
nothing in the code needs changing.

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
| Most tickets one guest may buy | `max_per_order`, capped by what is actually left |

So adding January 2027, a new promoter, a fifth seat class or a seventh
currency is a data change. This file does not move.

The month buttons are built from whatever months actually have nights on sale,
starting from today in Bangkok. Nothing is hardcoded to September–December.

## What it never does

- It never shows a remaining count. The database exposes a status, not a number.
- It never sends a price. The browser says which night, which class, how many
  and which currency; the price is read server-side from the database. A guest
  editing the page cannot change what they are charged.
- It never lets the seating warning be skipped. The widget blocks the button,
  and `create-checkout` refuses the order again on its own.

## Running the tests

    node agent-tix/widget/tests/booking-widget.test.mjs

Drives the widget through a real browser with both functions stubbed, covering
the calendar, all four statuses, quantity and currency, the seating warning, the
handover to Stripe, a sold-out clash, a server error, retry, and a request that
never answers. Set `CHROMIUM_PATH` if Playwright cannot find a browser.

## Standing rule: payment methods

`create-checkout` must never set `payment_method_types`. Stripe's payment method
configuration decides, and it is set up deliberately — Alipay and WeChat Pay for
Chinese visitors, the European methods for Europe, and so on. Setting that field
does not narrow the list, it replaces the configuration and switches all of it
off at once. Stripe already filters by currency and country, so a short list on
one session is not a restriction to copy.

`agent-tix/functions/tests/checkout-guards.test.mjs` enforces this.
