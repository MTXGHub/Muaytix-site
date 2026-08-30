# Putting a real booking through

Three things need doing in a browser. None of them are code, and none of them
can be done from here.

## 1. The Stripe signing secret — required

Without this, a payment goes through but the seats are never marked as sold.
Money in, stock unchanged. So this one is not optional.

**In Stripe** (Developers → Webhooks → Add endpoint):

- Endpoint URL:
  `https://jlwopomkqeawrxlapwpc.supabase.co/functions/v1/stripe-webhook-v2`
- Events to send — these four, nothing else:
  - `checkout.session.completed`
  - `checkout.session.async_payment_succeeded`
  - `checkout.session.async_payment_failed`
  - `checkout.session.expired`
- Save it, then reveal the **signing secret**. It starts `whsec_`.

**In Supabase** (agent-tix-build → Edge Functions → Secrets → Add):

- Name: `STRIPE_WEBHOOK_SECRET`
- Value: the `whsec_...` you just copied

This is a different secret from the one already added. The API key lets us talk
to Stripe; the signing secret lets us prove a message really came from Stripe
and is not somebody pretending.

Leave the existing V1 webhook endpoint exactly as it is. Both endpoints will
receive every event and each ignores the other's bookings — that is deliberate,
and explained in `current-state.md`.

## 2. The widget on a page

Put `agent-tix/widget/booking-widget.html` into a Tilda HTML block on a page at
muaytix.com. An unlisted page is fine. It must be **published on the real
domain** — a Tilda preview runs on a `.tilda.ws` address and the widget will
refuse to load there, by design.

## 3. Then buy a ticket

Only the first week of September is loaded, so the calendar will show 1–7
September and nothing else. That is expected.

Watch for:

- **Stripe**: a payment on the MuayTix LTD account, with the seat class and the
  fight night named on the line item. Metadata should say `source: agent_tix_v2`.
- **Supabase** → `checkout_reservations`: the row goes to `completed`, and your
  name and email land on it.
- **Supabase** → `event_ticket_classes`: `sold_quantity` goes up by however many
  you bought, and `reserved_quantity` goes back down.

If the last two do not happen, the signing secret in step 1 is wrong or missing.

## Afterwards

To put the stock back where it was, set `sold_quantity` back to 0 on the rows
you bought from. Refund in Stripe as normal — the refund does not currently put
stock back on its own, which is fine while it is only us testing.
