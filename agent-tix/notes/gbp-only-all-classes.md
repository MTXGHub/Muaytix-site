# GBP only for every class (23 November 2026, Jason)

Jason: "amend the payment options so that all payments go through on GBP".

Done: USD, EUR and AUD switched off in `ticket_class_prices` (active = false) for Ringside, Club Class and LEO Section. Third Class was already GBP only (18 Nov). CNY and THB were already off. The figures stay in the table.
Read back: every class on all 212 nights offers GBP and nothing else (view `event_ticket_prices`). Per-night overrides in other currencies only apply when the standing price is active, so they are hidden too.

Undo (puts the three currencies back on every class except Third Class, which was off before):
update public.ticket_class_prices p set active = true from public.ticket_classes tc where tc.id = p.ticket_class_id and tc.code <> 'third_class' and p.currency in ('usd','eur','aud');

Not checked: how the live widget looks with one currency on classes other than Third Class (the one-currency sentence is built from the class name and says "X tickets are charged in GBP only. No booking fee.").
