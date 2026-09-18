# "Sold out" sends them away. "Fully booked" keeps them here.

Jason, 19 September 2026. Not built. Left as **SOLD OUT** for now at his call.

## The distinction

The two phrases mean different things to a guest, and only one of them is about
us:

| | What the guest hears | What they do |
|---|---|---|
| **Sold out** | *These people haven't got any.* | Go and look elsewhere |
| **Fully booked** | *The section is full at the stadium.* | Stay — there is nothing to find |

Ringside on a full night genuinely is gone at the stadium. You cannot buy one at
the box office, the OTAs do not pre-buy, and the Thai agents who might hold a
few are not advertising them. Short of a hotel concierge with a pair in his
pocket, there is nothing out there.

## What it costs us

A guest who reads SOLD OUT opens two or three other sites. They find nothing,
because there is nothing. **They do not come back.** They either book a
different class on the third site or they give up and book nothing at all.

Two segments lost:

- **Ringside or nothing.** They will not trade down. Once they leave, they are
  gone, and we never had a chance either way — but only if they leave.
- **The ones who would have traded down.** These are the real loss. Had they
  stayed thirty more seconds they would have taken Club Class. They left because
  the screen gave them a reason to.

## The message already exists — in the wrong place

This is the same shape as the seat-class taglines, which sat under the widget
where nobody scrolled. `classDetail()` in widget.js already says, on the panel
behind a sold-out class:

> Ringside is now officially **Fully Booked**. Click the Change seat class
> button below to check alternative section availability.

The headline and the nudge to the alternatives, both written, both correct. No
guest ever reads it: the tile is disabled, so there is nothing to tap through.

## So the build is smaller than it sounds

Move that message onto the tile, and put the live numbers in it. The widget
already holds every class for the night, so it knows what is still on sale
without asking the server anything:

> **Fully booked**
> 5 Club Class and 10 LEO Section left tonight

No new endpoint, no new column, no new data. `seatsLeft` and the per-class
status are already in the availability response.

## Open questions for whoever builds it

- **Does the claim hold every time?** "Officially fully booked at the stadium"
  is true for Ringside on a sold-out night and must not be printed on a class
  that is merely out of *our* allocation. Only say it where it is true, and
  Jason is the one who knows which is which.
- **Where does the alternative sit** — inside the sold-out tile, or as one line
  under the four tiles? A tile that grows changes the height of its row.
- **Which alternative to name.** The cheapest, the most popular, or the nearest
  in price to the one they wanted. Nearest in price is the likely answer for
  someone who wanted Ringside.
