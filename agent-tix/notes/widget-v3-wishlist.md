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
