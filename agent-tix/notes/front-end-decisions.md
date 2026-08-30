# Front-end decisions and parked items

Running record from the design reviews. The prototype lives at
`agent-tix/prototype/booking-flow.html`.

## Parked — agreed, not built yet

**Booking summary with a confirmation tickbox.** Before checkout, spell the whole
booking back to the guest in one sentence, then have them tick to confirm. Roughly:

> You are booking 2 x Ringside seats for Saturday 20 September 2026 for Rajadamnern
> Knockout at Rajadamnern Stadium, starting at 7pm.

Deliberately not built yet — raised 30 August 2026, to be designed later. Placement
within the flow is still open.

Everything it needs is already on the page: quantity and class from the card, and
date, event name, venue and start time from the selected event. No new data required.

It is the third guard against a guest booking the wrong night, after the month banner
above the calendar and the full date printed in the event band.

## Settled in review

- **Header** reads Book Tickets for / Rajadamnern Stadium / Bangkok. No logo.
- **Month buttons** replace arrow navigation, which was too faint to see. Four across on
  desktop, two by two on mobile, filled `#1f5bff`. The selected month reverses out:
  white fill, 3px blue border, blue type. Border width is 3px in every state so
  switching month does not resize the buttons.
- **Numbered steps** appear as labels where the guest is working — on the month picker,
  the calendar, the seat class heading, and the quantity and currency dropdowns. The
  separate 1-5 instruction strip at the top was removed as duplication.
- **Month banner** between "Choose your date" and the grid: "You are choosing dates for
  SEPTEMBER 2026". Four month buttons make it possible to pick a date while thinking
  you are in another month, and the grid itself never named the month.
- **One section at a time.** The accordion was tried and rejected: with a class open,
  the collapsed rows above and below kept their prices, colours and status pills, so
  three treatments competed and nothing said which one you were filling in. The widget
  now hands the screen from step to step. Choosing a date hides the month buttons and
  calendar and shows the event; choosing a class replaces the four choices with that
  class alone. Change date and Change seat class step back.
- **The four seat choices carry name, status and from-price only.** No description, no
  controls. Section 4 of the brief is still met: all four show for the date, sold-out
  and closed included, each with its status. A closed class stays clickable so its
  explanation is one tap away, but shows no purchase controls.
- **No ticket artwork in the widget.** This reverses Section 10 of the design brief,
  which asked for the graphics to be used prominently. A 1024px square per class costs
  a great deal of height for something the guest has already chosen, and the widget is
  to stay lean. The graphics keep their place elsewhere on the site and on social.
  Removing them took the desktop cards from roughly 1050px to 453px. Each class keeps
  its colour: a rule across the top of the card on desktop, a slim bar on the mobile row.
- **Event name.** "All Star Elite Fighter by Buakaw" is correct. Supabase currently
  holds "All-Star Fight by Buakaw" on three dates, which is wrong on both the name and
  the spelling of Buakaw. Not corrected in production; V2 is a fresh build.

- **Locked to the light theme.** The widget is embedded in a light Tilda page, so
  following the guest's phone would make it look foreign inside its own page. The dark
  theme blocks were removed rather than left unreachable.

## Outstanding

- **Currencies: six, and staying at six.** USD, EUR, GBP, AUD, CNY, THB. JPY and SGD
  were dropped on 30 August: a UK Stripe account cannot hold them as settlement
  currencies. CAD undecided. Adding one later is a data change, not a build.
- **Third Class needs a Stripe product per date.** Every one of the 371 rows in
  `ticket_inventory` carries its own `stripe_product_id` and `stripe_price_id` — 371
  rows, 371 distinct products. So a new Third Class row cannot take money until a
  Stripe product exists for it, and the Stripe connector is not authorised in this
  session. Agreed plan: 50 seats on every RWS Saturday, all held at `not_released`
  until instructed, with 5 September opened first.
- **Third Class prices** (from the database, not the widget's hardcoded copy):
  USD 31, EUR 27, GBP 23, CNY 210, AUD 44, THB 1000.

## Wired to the live database — 30 August 2026

The prototype is now a working widget at `agent-tix/widget/booking-widget.html`.
The design is unchanged; only where the numbers come from has changed.

- **Nothing about the schedule is hardcoded any more.** The prototype generated
  the fight nights from rules in JavaScript — Monday, Tuesday and Friday are
  Knockout, the last Monday is Buakaw, and so on — and carried its own copy of
  every promotion name, colour, seat class, price and currency. All of it now
  comes back from the database on load. The four month buttons are built from
  whichever months actually have nights on sale. Load 2027 and the widget sells
  2027 with no release.
- **Two new columns pairs made that possible.** `event_series.short_name` and
  `.accent_colour` carry what the calendar prints under each date;
  `ticket_classes.accent_colour` and `.accent_ink` carry the seat class colours.
  Two colour values per class rather than one, because the vibrant yellow that
  works as trim is unreadable as type — the same finding that produced the
  beige-looking compromise the widget had before.
- **The Bangkok date is worked out in the database, not the browser.** A guest
  in Los Angeles at 9pm is already on tomorrow's date at the stadium. The
  calendar view returns the local date as a plain string and the widget matches
  strings, so no timezone arithmetic happens on a phone at all.
- **Prices never travel from the browser.** The widget sends the night, the
  class, a quantity and a currency. What that costs is read server side.
- **Quantity is capped by what is genuinely left.** The dropdown offers six when
  six remain, not ten. The count itself is still never shown.

Two findings from the widget code review are now closed:

- **Every call has a timeout** — twelve seconds to read, twenty to check out.
  A hanging request now says so instead of spinning indefinitely.
- **A failed first load offers a retry.** Previously the widget would sit empty
  for good. It now names the problem and gives the guest a button.

Still open from that review: the single universal widget in three modes (full
month, filtered weekday, single event). This build is the full-month mode. The
other two reuse the same seat-class grid and are the next front-end job.
