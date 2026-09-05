# When a seat class is sold out, offer tomorrow

Agreed with Jason, 5 September 2026. Not built yet.

## What the guest sees

A guest taps a seat class that is fully booked tonight. Instead of a dead end,
they are told the same seat class is on sale tomorrow, with a button to that
night's page.

> Ringside is fully booked tonight.
> Ringside seats are available for Kiatpetch Traditional Muay Thai
> tomorrow night, Sunday 6 September.

## The rule

**Only ever tomorrow.** Never two nights out, never "the next Saturday". If
tomorrow is no good, the guest hears nothing.

**Same seat class only.** The offer is Ringside → Ringside. We are answering
the question they actually asked, not upselling them into a different seat.

**If tomorrow is full too, stay quiet.** No message, no button. A second dead
end is worse than one.

## Where each night sends them

| Tonight sold out | Offer | Page |
|---|---|---|
| Saturday — RWS | Sunday, Kiatpetch | `https://muaytix.com/kiatpetch-muay-thai` |
| Sunday — Kiatpetch | Monday, Knockout | `https://muaytix.com/rajadamnern-knockout` |
| Monday — Knockout | Tuesday, Knockout | same page — the guest just picks the date |
| Tuesday — Knockout | Wednesday, New Power | `https://muaytix.com/new-power-muay-thai` |
| Wednesday — New Power | Thursday, Petchyindee | `https://muaytix.com/rajadamnern/petchyindee` |
| Thursday — Petchyindee | Friday, Knockout | `https://muaytix.com/rajadamnern-knockout` |
| Friday — Knockout | Saturday, RWS | `https://muaytix.com/rws` |

Monday is the one that stays put: Monday and Tuesday are both Rajadamnern
Knockout, so the guest never leaves the page — the widget just moves to the
next date.

## The addresses

Confirmed by Jason, including `/rajadamnern/petchyindee` — the extra slash is
correct and not a slip, so leave it alone.

**Correct for now, and expected to change.** The site is moving to Webflow, and
these addresses move with it.

So they do not get written into the widget. They belong in the database against
each promotion, where changing one is a single edit rather than a rebuild and a
re-paste across every page on the site. A wrong address here sends a paying
guest to a dead page, and it fails silently — nobody finds out until someone
happens to click it.

## What already exists

The availability service can answer "which nights is this seat class on sale
for" in a single request — added for the seat-first widget. So working out
whether tomorrow has that class is a question the widget can already ask; the
work is the message, the button, and this table.
