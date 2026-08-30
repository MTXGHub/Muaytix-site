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
- **Mobile layout is an accordion**, which is the answer to the scroll-length problem
  the brief left open. All four classes fit one screen with status and price visible,
  so a sold-out class reads at a glance; tapping one opens its artwork and controls,
  and only one opens at a time. Still to be judged by the business owner.
- **Event name.** "All Star Elite Fighter by Buakaw" is correct. Supabase currently
  holds "All-Star Fight by Buakaw" on three dates, which is wrong on both the name and
  the spelling of Buakaw. Not corrected in production; V2 is a fresh build.

## Outstanding

- **Ticket artwork.** The four class graphics are stand-ins. The real files are needed
  as attachments; they arrived in conversation as images, which cannot be embedded.
- **Currencies.** Six are priced (GBP, USD, EUR, THB, AUD, CNY). JPY and SGD are
  confirmed for 1 September but have no prices yet; CAD is unconfirmed.
- **Third Class has no stock from 1 September.** It exists in `ticket_inventory` for
  August only. The current calendar widget fabricates the card in JavaScript when the
  database returns nothing, which is why its prices are hardcoded there.
