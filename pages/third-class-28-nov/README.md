# Third Class only, RWS Sat 28 Nov 2026 (27 Nov 2026, Jason)

Paste `third-class-28-nov-PASTE-INTO-TILDA.html` into a Tilda HTML block (T123) on a new page. One line. It needs the booking
widget already in the site head, as on every other page.

- Shows Third Class for RWS Sat 28 Nov only, then goes straight to the ticket picker.
- Prices that night (set in the database, 27 Nov): GBP 27, USD 36, EUR 33, AUD 55. Other nights are untouched (GBP only).
- Tested in a real browser with the real widget code and a test copy of the data (Third Class only, four currencies). **Not tested on
  the live site, which cannot be reached from here.**
- Stripe's back arrow: this page's address must be added to `KNOWN_PAGES` in `create-checkout/index.ts` (a deploy, so ask
  Jason first) or its guests land on /payment-failed when they go back.
- Database: migration 0059 (`extra_currency` flag on a night's own price row; the price view shows a switched-off currency only
  when that flag is on). Undo: delete the three override rows for class cbb1daf3-810c-4bd6-bc2c-449a4b30ca54 in usd, eur, aud.
