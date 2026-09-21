# muaytix.com — the Webflow rebuild

Written 21 September 2026, at the end of the session that settled the template
decision. Read this before touching the new site; it is here so the next thread
does not have to be told any of it twice.

---

## What this is, and what it is not

**This is the new muaytix.com.** A fresh Webflow site, built from the Avoora
template, replacing the current Tilda site. Second attempt at the rebuild.

**It is NOT `MTX Tonight`** (site id `6a852790915d21261647d825`). That is a
separate, parked concept — a one-pager advertising whatever Muay Thai is on in
Bangkok tonight. It may happen one day. It is not this. Do not read its
`README.md` as though it describes this project; read it only for the Webflow
API lessons, which are real and still apply.

---

## The template: Avoora

- Avoora, by Anova Flow, $79, from the Webflow marketplace
- Listed under `/templates/html/` — it ships **without** CMS collections
- Live preview: `avoora.webflow.io` (blocked from the agent sandbox, see below)

**That it ships without collections is not a constraint.** CMS Collections are a
site-plan feature, not a template feature. Any site on a CMS or Business plan can
have collections built in it. Events and Venues were always going to be built
from scratch.

An earlier note in this session described Avoora as "dark-first" and warned its
structure would not map. **Both were wrong**, and the second was stated with more
confidence than a search-result summary deserved. The template is light — white
and pale grey, black type, orange accent. And three of its homepage components
map almost one-to-one onto the hardest blocks of an event page:

| Avoora component | Becomes |
|---|---|
| **Featured Work** — numbered cards 01-04, image, name left, category right, "View all work" | The fight-night listing. `(01) RWS — Saturday 26 September — Rajadamnern`. Implies an index + detail page pair already exists. |
| **Our Expertise** — 01-05 accordion, each opening to image + description + outlined tag chips | The four seat classes. The chips are "Best for: first visits, couples". |
| **How We Work** — Step 01-04, heading + line of text | The evening schedule: doors, first fight, interval, dome show, finish. |

Also usable: the stats band becomes the facts strip; Client Stories becomes real
reviews. Delete the membership plans, the agency service copy, and the client
logo row unless they become stadium partners.

**Two real costs, both accepted by Jason knowingly:**

1. **It is light; the brand is dark.** The current Knockout page, seat map and
   hero are near-black with red and blue. Avoora is white with orange. Decision:
   **going light.** The orange still has to become MuayTix red/blue.
2. **It is hungry for photographs.** Almost every section wants a strong image.
   The photo library is the known weak point — a whole evening stalled over five
   pictures. Decision: **feeding the hunger**, a real library is being built.

---

## Why an agency template and not a ticketing one

Jason's words, and they settle the question: the booking widget is the ticketing
engine and it drops into any page we design. So the template only has to be a
good frame. An events/ticketing template would have brought a booking system we
would then have to rip out.

This was also not a snap decision. A previous Claude Code thread ran an exercise
picking the best candidate templates; Jason ran his own. Avoora came out of both.

---

## Build order

1. **Homepage**
2. **Rajadamnern Stadium tickets** (the biggest converter on the current site)
3. Everything else

---

## CMS structure

Two collections, built by us:

- **Events** — one item per fight night
- **Venues** — one item per stadium

### The event page blueprint

Ten blocks. Only four change per event; five come from Venues and are written
once; one builds itself. That ratio is the whole point — adding next Saturday is
filling about six fields, not writing a page.

| # | Block | Heading | Source |
|---|---|---|---|
| 1 | Hero + key facts | H1: `<Event> at <Venue> — <Date>` | Per event |
| 2 | Booking widget | — | Per event |
| 3 | Fight card | H2: Tonight's fight card | Per event |
| 4 | Seat classes | H2: Where you'll sit | Venue |
| 5 | The stadium | H2: About Rajadamnern Stadium | Venue |
| 6 | Transport | H2: Getting there | Venue |
| 7 | First-timers | H2: What to expect on the night | Venue |
| 8 | Questions | H2: Frequently asked questions | Venue |
| 9 | Other nights | H2: Other fight nights this week | Automatic |
| 10 | Trust strip | — | Shared |

One H1 per page — event name, venue, date. Block 07 is the longest (200-300
words) and the one that converts: the advance buyer is quietly wondering whether
they will feel out of place. Answer that honestly.

There is a fuller written blueprint from the earlier thread
(`event-page-blueprint.html`) with word counts, example copy and the field list.
Ask Jason for it if it is not to hand.

### The widget binds to a CMS field

This is the mechanism the whole plan rests on. Webflow lets a CMS field value be
inserted **inside an HTML Embed**. So on the event template:

```html
<div class="muaytix-ticket-selector" data-event-id="[Event ID]"></div>
```

`[Event ID]` is a field on the Events collection, not typed per page. Add a night
to the collection and its page comes out with the widget already pointed at the
right event. No per-page editing, no risk of a page selling the wrong night.

The embed is a div and a script tag, so the 10,000-character embed cap is
irrelevant here. That cap only mattered when we considered pasting a whole Tilda
page in — which we are not doing.

Event keys follow the Agent Tix convention: series slug, hyphens to underscores,
then the date — `rajadamnern-knockout` → `rajadamnern_knockout_2026_09_22`.

### Event schema is the cheapest real advantage

Google has a results format for events: date, venue, price and availability shown
before anyone clicks. It is driven by JSON-LD structured data. Most Thai agents
and the big OTAs do not bother for individual fight nights. It is also what AI
assistants read when someone asks what Muay Thai is on this Saturday.

Generated from the Events fields, so it is built once and every night gets it
free. The Webflow API supports it directly — see below.

---

## Webflow MCP — version 2.1.0

Pulled from `webflow_guide_tool` on 21 September. Materially more than the
August build had. The three that change how we work:

**Variables.** A real design-token system: colour, size, number, percentage and
font-family variables in collections, with modes. Recolouring Avoora's orange to
MuayTix red is a token change that propagates, not a hunt through styles. The
August build had none of this, which is part of why restyling was such a slog.

**Element snapshots.** `element_snapshot_tool` returns a PNG of any element on
the canvas. We can see our own work instead of building blind. This was the
single biggest handicap in the Tilda work.

**Schema markup.** `data_pages_tool > bulk_update_pages_schema_markup` writes
JSON-LD to up to 25 pages a call, and `query_pages_schema_markup` reads it back.
The event schema plan is directly supported, not a bodge into a head tag.

Also available and not previously: the full component system (components, props,
variants, slots — seat-class cards and bout rows become real components);
**Collection List configuration** via element settings (source, filters, sort,
limit, offset, pagination, queryMode — so "upcoming nights, soonest first, 12 per
page" is set through the API); interactions and animations (IX3); site analytics;
sitemap control; form submissions; asset management with image compression;
custom fonts; freeform head/footer code; agent instructions.

### Constraints that still hold

- **WHTML builder**: one root element per insert, no `<style>` tags (CSS goes in
  the `css` field), no `@keyframes`, no custom media queries
- **Breakpoints are fixed**: main, 991, 767, 479, plus min-width 1280/1440/1920.
  Nothing between. A design that switches at 860px gets remapped to 991.
- **Inline scripts**: 2,000 characters. Longer ones must be hosted.
- **Branching is Enterprise-only.** Confirm with `list_branches` before ever
  mentioning it; a 403 `not_enterprise_plan_site` is final for the whole site.
  We edit directly — but Webflow separates editing from publishing, so nothing
  reaches the live site until Publish is pressed.
- **Custom code needs a paid site plan.** On a free plan, registered scripts
  return `404 Custom code block not found` when applied.
- **CMS item limits**: CMS plan 2,000, Business 10,000. 150 nights plus venues is
  comfortably inside CMS.

### The combo-class trap — still the most expensive mistake available

From the August build, and it made the first attempt render badly. Webflow treats
a second class on an element as a **combo class**, and the WHTML builder creates
every combo **empty**:

```
.button--black          background #18181d   <- global class, holds the styles
.button.button--black   {}                   <- combo, what the element resolves to
```

Any element written `class="base modifier"` renders with base styles only. It hit
~30 elements: buttons lost their fill, cards were the wrong colour, horizontal
cards were not horizontal.

Fix: populate each combo with `data_style_tool > update_style`, passing
`parent_style_names` as the parent chain. Three-class chains need the full chain.

**Better: give each element exactly one class carrying complete styles**, or plan
a second pass. The builder will not do it for you.

### Other things verified the hard way

- `var()` custom properties do **not** survive a WHTML insert. Inline literal hex
  values before inserting.
- External image URLs are **silently skipped**. Assets must be uploaded first.
- Fonts **can** be installed via the API, despite an earlier note saying
  otherwise. Fetch the woff2 from Google Fonts with a browser User-Agent, keep
  only the `latin` subset blocks, MD5 as 32-char lowercase hex, `create_font`,
  then POST to the presigned URL. Register in a batch, upload in a batch — the
  presigned URLs expire together, ~15 minutes.
- Survives the parser: `clip-path`, layered gradients, `position: sticky`,
  `backdrop-filter`, `aspect-ratio`, `clamp()`, `transform`, CSS grid with
  `minmax()`.

---

## What the agent sandbox cannot reach

Tested directly on 21 September, all refused by the egress proxy:

```
webflow.com          blocked    (marketplace, docs)
avoora.webflow.io    blocked    (the template preview)
share.google         blocked
muaytix.com          blocked    (the live site)
static.tildacdn.com  blocked    (every image on the current site)
images.unsplash.com  blocked
manus.im             blocked
```

**But the Webflow API works fine** — it goes through the connector, not the web.
So the template cannot be browsed, but the moment it is a site in the account
every page, collection, style and element can be read.

Practical consequences: ask Jason for screenshots when something on the open web
matters, and never describe a page you have not read. An earlier answer in this
session characterised Avoora from a two-line search summary and got it wrong.

---

## Working with Jason

- Not a developer. Plain English, no jargon. If a constraint is named, say what
  it means for him and whether it affects him at all.
- Give the action, not the diagnostics. Short answers.
- Do not explain things he has already told you. Do not re-litigate decided
  questions.
- Ask, then **wait**. Do not run ahead of an unanswered question.
- Never use his past mistakes as leverage in a design argument.
- He corrects errors directly and expects the same back. If the data contradicts
  him, say so with the numbers. If he is right and you were wrong, say that
  plainly and move on — no grovelling.
- He works consecutive night shifts, UK time, business in Bangkok (UTC+7).
- Deploying is not the same as committing. Nothing is "done" until it is live and
  read back.
- Nothing gets deployed or published without his explicit go-ahead.

---

## Still open when this was written

- Template purchased and site created — not yet done at time of writing
- Paid site plan needed (CMS or Business) before custom code or the countdown
- **Bulk redirect job**: day-dated pages on the current site are still live after
  their night, pulling traffic to dead ends. Jason has a spreadsheet. It is a 301
  in **Cloudflare**, not Tilda. Bulk Redirects is the right home for it. Worth
  automating with a Worker that reads the date out of the URL, since the pattern
  will repeat ~13 times a month.
- The Cloudflare connector is attached to the session but **not authorised**, so
  the agent cannot make those redirects. Jason authorises it in claude.ai
  connector settings.
- Photo library
- Content writing — the five Venue blocks carry all 150 event pages, so they are
  where the value is
