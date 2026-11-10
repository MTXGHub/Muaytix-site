# Widget V3: Claude's view (10 November 2026)

Jason asked, while writing the V3 brief, what I would improve now that V2 has run in real life. This is
input for the brief, not a decision. Nothing here is built. Each point says where it comes from:
**[Data]** read from the database or a report, **[Seen]** something that happened in our sessions,
**[Guess]** my opinion, not tested. Windows are the 30 days to 10 November 2026 unless stated.

## The numbers behind it

- **[Data]** 2,116 looks at a night, of which 369 (17.4%) were dead ends (a night with nothing to buy).
  On Sat 7 Nov alone it was 41%.
- **[Data]** 374 guests reached checkout and 188 paid: **half of the people sent to Stripe do not pay.**
  We cannot see why. Stripe does not tell us whether the page was even opened.
- **[Data]** Phones: 148 of 192 paid bookings (77%). Phones convert best (58% of phone checkouts paid);
  desktop worst (39%). **[Guess]** desktop guests are comparing prices.
- **[Data]** Paid share by currency (before baht and yuan were removed): AUD 61%, EUR 55%, USD 53%,
  GBP 50%, THB 50%, CNY 38%.
- Google Analytics is not used. Rybbit is the source of truth, and it needs reconnecting before I can read it.

## What a guest sees (in the order I would do them)

1. **Dead ends should lead somewhere.** When a night has nothing buyable, show the next nights that do
   have tickets (same series first), one tap away. This is about pointing guests at nights we can sell, not
   about RWS demand. Today a guest gets a grey screen or the stadium link.
2. **Measure the steps before redesigning them.** Today we know "looked" and "checkout started". V3 should
   record each step (class chosen, number, currency, Reserve pressed) to Rybbit, so we can see where the
   half who do not pay actually leave. Without this, every fix is a guess.
3. **Design for the phone first** and test desktop properly. Three in four bookings come from phones.
4. **Currency and the reference price.** Guests now see USD, EUR, GBP or AUD only. Option for Jason: a small
   "Stadium price: 2,500 THB" line as a reference, not a currency to pay in. It restores what guests are used
   to seeing elsewhere, but it could make some ask why they cannot pay in baht. His call.
5. **Language.** About half of guests do not have English as a first language and the widget is English only.
   Top countries on 8 Nov: US, Singapore, Germany, UK, Thailand, Netherlands, Brazil. **[Guess]** a handful of
   languages for the fixed text (not the database copy) would help, but I have no evidence of the size.
6. **The "not seated together" warning is a tick box guests do not read** (Jason, 9 Oct). Replace the tick with
   a plain choice screen. Wording is his.
7. **Honest statuses.** "Fully booked" is used for pauses and timers, which is wrong (his wishlist item 1).
   V3 needs a paused state that is not a sell-out, and a per-class "book at the stadium" link, not only per night.
8. **Same-day nights as a mode.** He is close to leaving the last-minute market because of the WhatsApp load.
   A per-night "same day" switch (request only, or send to the stadium) is better than changing classes by hand.

## Behind the scenes (where I think the biggest gains are)

1. **A trading screen for Jason.** Everything he does (close a class, set a count, max together, timers,
   open Third Class, divert, per-night prices) goes through me, as SQL. He works on a tablet at night.
   One password-protected page: nights, the four classes, buttons, timers. **[Seen]** It would also add a
   **change log**: the database keeps no history of ticket counts, which is why the 6 Oct mistake could not
   be traced to anyone.
2. **Stock honesty built in.** Each class on each night should say whether its number is *held* or a *working
   number*. **[Seen]** On 6 Oct a placeholder on an RWS night was sold. Rule for V3: an RWS night cannot open to
   guests until a real count is entered, and the screen shows "working number" in plain sight otherwise.
3. **Payment links and manual sales should take stock.** Today a payment link sells tickets the system never
   hears about, and I add them by hand. **[Seen]** The 7 Nov link carried night, class and ticket count in
   its metadata, so a Stripe webhook can record it. Refund of part of a booking already exists (migration 0050).
4. **A "tickets to send" list.** Jason sends tickets by hand. A list per night (name, email, class, number,
   sent or not) with a template email would cut the drain. Sending stays his call. **[Guess]** only part of
   this can be automatic, because non-RWS tickets are bought after the booking arrives.
5. **How the widget reaches the site.** It is pasted into the Tilda head with a size ceiling we set at 63,000
   bytes. Every change means a re-paste that affects every page. **[Seen]** On 5 Oct a 67 KB header made the
   widget vanish and the cause was never found. V3 could use a few lines in Tilda that load the real file from a
   place we control, with a test flag and a one-line rollback. **[Guess]** This should work in Tilda, but I
   cannot test the live site from here.
6. **Reports that tell the truth.** Every `widget_looks.page_path` is "/" (the browser strips the path), so
   `widget_looks_by_page` is useless. V3 sends the path itself, and sends the funnel steps to Rybbit.
7. **Prices per night and currencies per night as a real feature.** I built it on 8 Nov for the R81 night
   (`event_ticket_price_overrides`, `withdrawn`). It works, but it is SQL only. Put it on the trading screen.
8. **Tests that run anywhere.** Two function test files need a scratch Postgres that this environment does not
   have, so they were not run on 8 Nov. V3 should ship a test database that starts with one command,
   and a hidden staging night.
9. **Guest copy in one place.** It is spread over `widget.js`, the database and hand-built Tilda pages (the
   thank-you page needed rewriting this month). One source would stop them drifting.
10. **Remove dead weight.** The Club Class offer was switched off on 8 Nov; its code, reports and baht
    handling are still there. Decide whether to keep it before V3 carries it forward. **[Guess]** I have not
    checked whether it paid for itself (`fallback_offer_by_day` would say).

## VIP classes (Presidential Box, Panoramic Balcony, Couple Suite)

- **Unit.** Some are sold by the suite or box, not by the seat (Jason on 7 Nov: Couple Suite 5 of 6 left,
  Panoramic Balcony 8 of 15, Presidential 18 of 44). Each class needs: unit (seat or suite), allowed party
  sizes, and price per unit or per seat.
- **Visibility.** The stadium shows exact VIP seats; we only see On Sale or Stop Sale. So VIP probably wants
  request mode, with the card reserved and charged on confirmation (his decision of 8 Nov, V3 wishlist item 5).
- **Higher stakes.** A Panoramic RWS seat is about 10,000 baht. Phone number and special requests belong on
  the request, and these guests will ask more questions before paying.
- **Watcher.** It records VIP statuses but ignores them. V3 should let a Stop Sale on a VIP class switch it
  to request mode, with an alert.
- **No seat map, no counts.** Photos and selling lines work as they do now.

## What works and should be kept

The 5-minute hold with countdown; the back button stepping through the widget; one database as the single
truth; the status order (cutoff beats manual status); the stadium watcher with phone alerts; per-night prices;
the divert-to-stadium screen; and the simple "within 24 hours" thank-you page.

## Questions only Jason can answer for the brief

1. Is the trading screen in V3, and will anyone besides Jason use it?
2. Show the baht reference price, yes or no?
3. Which languages, if any?
4. VIP: instant sale or request mode (or both, by class)?
5. Is a same-day mode wanted, and what should a same-day guest see?
6. Does the Club Class offer come back or stay off?
