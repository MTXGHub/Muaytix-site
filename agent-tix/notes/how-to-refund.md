# Putting a seat back after a refund

Refunds run at one or two a month, so this is a two-minute job done by hand, not
something the system does on its own. That is deliberate — see the bottom of
this page for why.

## The two steps

**1. Refund the money in Stripe**, the way you always have.

**2. Put the seat back.** Supabase dashboard → **agent-tix-build** → SQL Editor.
Paste this, replacing the reference with the booking's, and run it:

```sql
select public.refund_reservation('paste-the-booking-reference-here');
```

That is the whole job. The seat goes straight back on sale.

## Finding the booking reference

It is in Stripe, on the payment, under **Metadata** → `v2_reservation_id`.

Or look it up by the guest's email:

```sql
select r.id, r.status, r.quantity, r.currency, r.unit_amount,
       r.guest_name, r.guest_email, t.name as seat_class, e.name as fight_night,
       (e.starts_at at time zone 'Asia/Bangkok')::date as night
from public.checkout_reservations r
join public.event_ticket_classes etc on etc.id = r.event_ticket_class_id
join public.ticket_classes t on t.id = etc.ticket_class_id
join public.events e on e.id = etc.event_id
where r.guest_email = 'guest@example.com'
order by r.created_at desc;
```

## What it will tell you

| It says | It means |
|---|---|
| `refunded` | Done. The seat is back on sale. |
| `already_refunded` | You have already done this one. Nothing changed — no seat was given back twice. |
| `not_sold_held` | That booking never completed, so no seat is being held against it. Nothing to do. |
| `not_sold_expired` | Same — the guest never paid. Nothing to do. |
| `not_found` | Wrong reference. Check it in Stripe. |

Running it twice is safe. It will not free the same seat twice, whatever you do.

## Checking it worked

```sql
select e.name as fight_night,
       (e.starts_at at time zone 'Asia/Bangkok')::date as night,
       t.name as seat_class,
       etc.total_quantity, etc.sold_quantity, etc.quantity_available
from public.event_ticket_classes etc
join public.events e on e.id = etc.event_id
join public.ticket_classes t on t.id = etc.ticket_class_id
order by e.starts_at, etc.display_order;
```

## Why this is not automatic

A refund does not always mean a free seat, and no rule can tell the difference:

- A guest cancels and you refund → **the seat should go back on sale**
- You refund a guest as a goodwill gesture and they still come → **the seat must
  stay sold**, or you sell it twice and turn somebody away at the door
- A partial refund → the guest is still coming

Getting that wrong either oversells a night or quietly loses a seat, and at one
or two refunds a month there is no volume argument for guessing. You decide;
the command does the arithmetic.

If refunds ever become frequent enough that this is a chore, the piece to build
is a `charge.refunded` webhook that returns the seat only on a **full** refund
and leaves partials alone. It is roughly an hour's work.
