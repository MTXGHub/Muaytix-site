# Widget V3 wishlist (Jason, October 2026)

Nothing here is built. It is what Jason has said he wants looked at when the
guest-facing widget is reviewed and possibly rewritten as a V3. He is reviewing
the workings himself first (19 October 2026). Do not start shrinking or
rewriting until he says go.

## 1. Statuses are not enough, and the wrong word is shown (19 October 2026)

When he asks for a class to be closed "as a precaution" (to take stock, check
the stadium, then maybe reopen), it is set to `fully_booked`. A guest then sees
"Fully booked", reads it as a sell-out, and may book something else instead of
coming back. That is wrong: the class is only paused.

- What exists today: `manual_status` accepts `available`, `limited`,
  `fully_booked`, `booking_closed` or NULL. `booking_closed` already shows as a
  grey "Booking closed" tile. Until now every closure on request has used
  `fully_booked`.
- What he wants: a small set of statuses that say what is actually true
  (for example a temporary pause that is not a sell-out), with guest wording he
  writes. His own rule on "Sold out" and "Limited" still stands.
- Open: the wording, and whether the temporary pause should look different from
  both Fully booked (red) and Closed (grey).

## 2. Other things already raised

- MTX Shields (refund protection product): stage one first, a second proposition
  later. Not insurance, legal side handled by Jason. Likely home: inside the
  widget, before Reserve.
- Presidential Box seat class: details to come from Jason.
- Head code size: 61,640 characters now; the 63,000 limit is ours, not Tilda's.
  Real ceiling untested.
- Possible simplifications noted: one card for photo and plain tiles; one
  pattern for the special screens (closed, fully booked, offer, held);
  fewer ways to start the widget. No dead code found (19 October check).

## 3. Seat cards and photos (19 October 2026, thinking aloud, nothing decided)

- Photos per class today (database, read 19 Oct): Club Class 5, LEO 4, Ringside 4,
  Third Class 4. Selling lines: 5 each. Photos are links to Tilda-hosted images,
  so they use no head code; they only affect page speed (not checked whether
  they load all at once).
- Jason asked whether the four (soon five, with Presidential Box) seat cards
  could merge into one card with a selection step. Trade-off: guests lose the
  side-by-side comparison; Club Class is about 55% of bookings. Middle option
  noted: four compact tiles, tap to expand one at a time. Decide after looking at
  how guests use the cards now (Rybbit has the clicks on each class).

## 4. A proper "Stadium Closed" day (22 October 2026)

The stadium's tracker can mark a whole day Closed (first: Sun 21 Feb 2027). Jason
wants that date to stay visible on the calendar, marked Stadium Closed, with no
event. Done for now as data only: that night's event is renamed "Stadium Closed",
detached from its series, all classes Booking closed. Known rough edges: it still
carries a 6:00 pm start time and shows four Booking closed tiles. A real closed-day
state in the widget (date marked, no classes, no time) belongs in V3.

## 5. "On request" booking for a class that is nearly gone (7 November 2026)

Jason's idea, while checking VIP availability on the stadium's site: when a class is
down to its last seats (for example Presidential Box, or when the stadium puts it on
Stop Sale), flip the widget from a normal sale to a booking request. The guest asks,
the team checks with the stadium, and only then is the guest charged.

**Chosen option (Jason, 7 Nov 2026): reserve the card, charge on confirmation.**
- The guest enters card details in checkout, which is their commitment. The card is
  authorised, not charged.
- The guest ticks a box saying, in effect: if your seats are available, we will charge
  your card and book them. **Wording is Jason's to write; not drafted.**
- The team checks the stadium. Seats there: capture the payment, booking completes
  as normal. No seats: release the card, nothing is charged.
- The other option, a plain request form followed by a payment link, was set aside.

**Not yet checked (guesses, not findings):** Stripe's card authorisations expire
after about 7 days, which needs testing against last-minute nights; whether the
existing webhook and stock logic can handle a booking that is authorised first and
captured later; how a request appears to the team (phone alert like a booking alert,
and a list to work through). No stock should be taken until the capture.

**Switch:** a per-class, per-night "on request" setting beside Available and Fully
booked. It could be set by hand, or by the stadium follower on Stop Sale. The
follower currently ignores the VIP zones (it only records them), so an automatic
switch for VIP needs a small change first.

**Risks to weigh (said to Jason, not yet decided):** guests who must wait for a
confirmation may buy elsewhere. Any line telling the guest when to expect a reply is
a delivery timescale Jason has not set, so none is promised.
