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
| 14 Nov 2026 | 2 VIP Panoramic Balcony, RWS Sat 2 Jan 2027 | 446 GBP (2 x 223; stadium price 10,000 THB each) | GBP only, single use, collects name and phone. Ticket details are in the link and payment metadata (source payment_link, event_key rws_2027_01_02, class, quantity). https://buy.stripe.com/14A4gA4ULb8X4PJ15Q4Ja2l . Not paid yet. **Not recorded in our database:** there is no VIP Panoramic class yet and the webhook ignores payment-link sales. |

Open question: whether Stripe's Adaptive Pricing is on for payment links. If it is, a guest may be shown their
own currency on the link. It cannot be read from here; check in Stripe settings.
