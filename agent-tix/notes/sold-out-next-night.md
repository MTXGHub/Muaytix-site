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

## Open before building

- **Check the Petchyindee address.** `/rajadamnern/petchyindee` carries a slash
  the other six do not. Confirm it resolves before it goes in front of anyone.
- The addresses above are hard facts about the website, not something to infer.
  If a page is renamed, this table is what needs changing.

## What already exists

The availability service can answer "which nights is this seat class on sale
for" in a single request — added for the seat-first widget. So working out
whether tomorrow has that class is a question the widget can already ask; the
work is the message, the button, and this table.
