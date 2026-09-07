# Muay Thai Bangkok tonight: Tilda page blocks

These are self-contained HTML embeds for the "Muay Thai Bangkok tonight" page
on **Tilda** (not Webflow, which is a separate rebuild under `webflow/`).
Each file pastes into a Tilda HTML block as-is.

| File | Block |
|---|---|
| `block1-hero-embed.html` | Hero: badge, headline, tagline, meta line, ticket button |
| `block2-timeline-embed.html` | Tonight's running order and event facts |

## How the night is chosen

Both blocks read the Bangkok calendar day and pick that night's event, then
roll over to the next night once the current one has started. They use the
same rule, so they always agree on which night is showing.

The booking widget in block `#rec3588158203` is swapped by hand at first bell.
The blocks flip themselves at the same moment, so make the swap then and the
page stays in step.

## Things to fill in

| Placeholder | Where | What to paste |
|---|---|---|
| `PASTE-TILDA-HERO-IMAGE-URL-HERE` | `src` on `.bg-image` in block 1 | The hero photo, uploaded to the Tilda image library |

The ticket link is a single `href` on the hero button, shared by all seven
nights. Change it there and it applies to the whole week.

Block 2 has full running orders and facts for Monday, Tuesday and Friday
(all Rajadamnern Knockout). Sunday, Wednesday, Thursday and Saturday only have
doors, start and close, carried over from the hero data, and no facts line.
Their interval, dome and main card times still need supplying.

## Clock icons

Block 2 derives each clock face from the time itself, rounded to the nearest
half hour, so no icon has to be chosen by hand when adding a night. The rule
was checked against the six icons in the original copy and reproduces them
exactly.
