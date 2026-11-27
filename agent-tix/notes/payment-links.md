# Payment links

**Standing rule (Jason, 6 November 2026): every payment link from now on is made in GBP only**, to keep
processing costs down. No THB, USD or EUR links. Guests who book on the website still get the currency
choice; only payment links are GBP. Convert the stadium price to pounds and round down to a whole number
(Jason does the conversion and gives the figure). Links are single use and collect name and phone.

Made through the Stripe connector (account MuayTix LTD). A payment link does not take stock off in our
system, so the booking has to be recorded by hand.

| Date made | For | Amount | Notes |
|---|---|---|---|
| 29 Oct 2026 | 4 Panoramic Balcony, Thu 29 Oct | 530 USD | before the GBP rule; the THB link was switched off |
| 3 Nov 2026 | none made | n/a | Stripe was signed out |
| 5 Nov 2026 | 4 Ringside, RWS Sat 5 Dec | 10,000 THB and 300 USD | before the GBP rule; send only one |
| 6 Nov 2026 | Couple Suite, RWS Sat 20 Mar 2027 | 200 GBP (9,000 THB, rounded down) | first GBP-only link |
| 7 Nov 2026 | 2 Third Class, RWS Sat 7 Nov | 60 USD (30 each) | Jason asked for USD, an exception to the GBP-only rule. Single use. https://buy.stripe.com/28E4gAbj91yn5TNcOy4Ja2k . Not yet paid: when it pays, add 2 to sold_quantity by hand. |
| 14 Nov 2026 | 2 VIP Panoramic Balcony, RWS Sat 2 Jan 2027 | 446 GBP (2 x 223; stadium price 10,000 THB each) | **Made as a Stripe Checkout Session, not a payment link, so Adaptive Pricing is switched off (GBP only, no euro option).** Expires Sun 15 Nov 14:58 Bangkok (Stripe allows 24 hours at most). Single use, collects name and phone, ticket details in the metadata (source payment_link, event_key rws_2027_01_02, class, quantity). The first version was a normal payment link (plink_1UbcIpLIQoPqkuKbB5J8gx8z), switched off after Jason saw a euro option. Not paid yet. **Not recorded in our database:** no VIP Panoramic class yet and the webhook ignores these sales. |
| 14 Nov 2026 | 2 VIP Panoramic Balcony, Rajadamnern Knockout Tue 29 Dec 2026 | 200.78 GBP (2 x 100.39; stadium price 4,500 THB each) | Replaces the 2 Jan link after the stadium moved the date. Checkout session, Adaptive Pricing off (GBP only). Expires Sun 15 Nov 15:05 Bangkok. Single use, name and phone collected, ticket details in metadata (event_key rajadamnern_knockout_2026_12_29). The 2 Jan session (cs_live_accEwsB2...) is still open until Sun 14:58 Bangkok unless expired. Not paid yet. **Not recorded in our database** (no VIP Panoramic class yet, webhook ignores these sales). |
| 14 Nov 2026 | 1 VIP Lounge Couple Suite, Rajadamnern Knockout Tue 29 Dec 2026 | 200.78 GBP (stadium price 9,000 THB for the suite) | Made after Jason said Panoramic Balcony is not available that night. Checkout session, Adaptive Pricing off (GBP only). Expires Sun 15 Nov 15:10 Bangkok. Single use, name and phone collected, ticket details in metadata (event_key rajadamnern_knockout_2026_12_29, class_code couple_suite, quantity 1). Quantity read as 1 suite. Not paid yet. **Not recorded in our database** (no VIP classes loaded, webhook ignores these sales). **The Panoramic sessions for 29 Dec and 2 Jan may still be open and payable until Sun 15 Nov 14:58 / 15:05 Bangkok unless expired.** |
| 15 Nov 2026 | 3 LEO Section, RWS Sat 28 Nov 2026 | 100.39 GBP in total (shown as one line; our booking row holds 3 tickets at 33.46, 1p short, cosmetic) | **First link that records itself like a website booking.** Checkout session, Adaptive Pricing off (GBP only), expires Mon 16 Nov 08:07 Bangkok. A held reservation (id 11818eaf-a439-4829-9c71-26ce858bd3e8) was made first, taking 3 LEO tickets off (7 left to 4), and the session carries source agent_tix_v2 and that id, so the payment webhook completes it when paid: sold count, guest details, card country, settled amount, reports, phone alert. If unpaid, the session expiry releases the 3 tickets. Attribution fields: page_path /payment-link, utm_source payment_link, utm_medium manual. Not paid yet. |

Finding (14 Nov 2026, Jason saw a euro option on a GBP link): a payment link cannot switch Adaptive Pricing off through the API; it is an account setting in the Stripe dashboard. A Checkout Session can (adaptive_pricing disabled, as the website does), but lasts 24 hours at most. Use a session link when a GBP-only price matters. Earlier open question: whether Stripe's Adaptive Pricing is on for payment links. If it is, a guest may be shown their
own currency on the link. It cannot be read from here; check in Stripe settings.


## How to make a payment link that appears in the reports (worked out 15 Nov 2026)

Why the old ones are blank: the reports read the booking table, and the payment webhook only records a Stripe session that
carries `source = agent_tix_v2` and a `v2_reservation_id`. A hand-made payment link has neither, so the sale is paid but never
recorded. Metadata alone does not fix that; the booking row has to exist first.

Recipe for a night and class that exist in the database:
1. `reserve_tickets(class_row_id, quantity, hold_until)` with the hold running about an hour past the session expiry. This takes
   the tickets off sale straight away and returns a reservation id.
2. Make a Checkout Session (not a payment link: Adaptive Pricing can only be switched off on a session, and a session lasts 24 hours
   at most) with GBP, name and phone collected, and metadata `source = agent_tix_v2`, `v2_reservation_id`, `event_key`, `event_name`,
   `ticket_class`, `quantity`, `currency`, `unit_amount`, `price_is_override`, `seating_acknowledged`, `sold_via = payment_link`.
3. Write the session id, currency, unit amount, `page_path = /payment-link`, `utm_source = payment_link`, `utm_medium = manual`
   onto the reservation row.
Paid: the webhook completes it. Unpaid: the session's expiry event releases the tickets.
VIP classes cannot use this until they exist in the database.
| 21 Nov 2026 | 2 LEO, Knockout Mon 23 Nov, USD 90 | CANCELLED by Jason (guest booked on the website). Hold d01598ff released. Stripe session cs_live_aguu83ys... could not be expired from here (no expire operation in the Stripe tool); left to lapse Sun 22 Nov 10:53 Bangkok. Session id was never written to the reservation row. |
| 22 Nov 2026 | 4 Third Class, Kiatpetch Sun 22 Nov, GBP 100 (4 x 25) | Checkout session cs_live_agkOP776... (adaptive pricing off, name and phone collected), expires 17:00 Bangkok. Self-recording: reservation 326f7a7b held, page_path /payment-link, utm payment_link/manual. Third Class was closed by hand (fully_booked) on this night; link sold it deliberately at Jason request. |
| 25 Nov 2026 | Third Class, RWS Sat 28 Nov | Price GBP 25 -> **GBP 26** for that night only (per-night override). Bookings already paid at 25 are untouched. Undo: delete the override row for class cbb1daf3-810c-4bd6-bc2c-449a4b30ca54, currency gbp. |
| 25 Nov 2026 | Third Class, RWS Sat 28 Nov | **PLANNED price steps (Jason, for information only; do nothing until he says "go" for each):** Thu 26 Nov 12:00 -> GBP 26; Fri 27 Nov 00:00 -> GBP 27; Fri 27 Nov 12:00 -> GBP 28; Sat 28 Nov 00:00 -> GBP 29; Sat 28 Nov 12:00 -> GBP 30 (if any left). All Bangkok time. Note: the price was already set to GBP 26 on 25 Nov at his request that evening. Change = update the per-night override row (class cbb1daf3-810c-4bd6-bc2c-449a4b30ca54, gbp). |
| 25 Nov 2026 | Third Class, RWS Sat 28 Nov | **CORRECTED price plan (supersedes the row above; Jason, for information only, do nothing until he says "go" for each step):** now GBP 26 (already set); Thu 26 Nov 12:00 -> GBP 27; Fri 27 Nov 00:00 -> GBP 28; Fri 27 Nov 12:00 -> GBP 29; Sat 28 Nov 00:00 -> GBP 30. All Bangkok time. |
| 26 Nov 2026 | Third Class, RWS Sat 28 Nov | **PRICE PLAN IN UK TIME (supersedes the two rows above; Jason: every 12 hours, UK time; do nothing until he says "go" for each step):** GBP 26 set at 00:00 UK Thu 26 Nov (= 07:00 Bangkok, the change made 25 Nov Bangkok evening). Next: Thu 26 Nov 12:00 UK (19:00 Bangkok) -> GBP 27; Fri 27 Nov 00:00 UK (07:00 Bangkok) -> GBP 28; Fri 27 Nov 12:00 UK (19:00 Bangkok) -> GBP 29; Sat 28 Nov 00:00 UK (07:00 Bangkok) -> GBP 30. UK is on GMT in November, so UK time = UTC. |
| 27 Nov 2026, ~07:30 Bangkok (00:30 UK) | Third Class, RWS Sat 28 Nov | **Price set to GBP 27** (Jason: "27, please. Pounds."). It had stayed at GBP 26 since 25 Nov because the 12:00 UK Thu step was never given the go. Plan steps now: next 28 at 12:00 UK Fri 27 Nov (19:00 Bangkok) only on his go; the 00:00 UK Fri step (28) is skipped by his choice of 27. Asked him about a Third-Class-only widget with GBP 27, USD 36, EUR 33, AUD 55; waiting for his go on the multi-currency part. |
| 27 Nov 2026 | Third Class, RWS Sat 28 Nov | **Four currencies for this night only (Jason):** GBP 27, USD 36, EUR 33, AUD 55, via migration 0059 (extra_currency flag). No other night or class changed (checked: this is the only class with more than one currency). Standalone Third-Class-only widget block in pages/third-class-28-nov/. |
| 27 Nov 2026, ~16:15 Bangkok | Third Class, RWS Sat 28 Nov | **Price raised for the last tickets (Jason): GBP 30, USD 40, EUR 36, AUD 60.** Read back: 70 total, 42 sold, 1 held in checkout, 27 left. Already-paid bookings untouched. Undo: set the four override rows back to 2700 / 3600 / 3300 / 5500. |
| 28 Nov 2026 | 1 Third Class, RWS Sat 28 Nov, USD 40 | The 71st ticket, for an American customer. Checkout session cs_live_agxAbsAt... (adaptive pricing off, name and phone collected), expires 17:00 Bangkok today. Self-recording: reservation 4eea0f3a held, page_path /payment-link, utm payment_link/manual, USD 4000, price_is_override true (the night price is a per-night override, same as the website). Webhook completion path still untested on a real payment. |
