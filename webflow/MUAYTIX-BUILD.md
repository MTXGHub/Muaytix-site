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

---

# Session log — 21 September 2026 (evening)

## The site now exists

**MuayTix.com V2** — site id `6ab1813b1cd693d8bed0aa8c`, workspace
`6a82f5092013c8f17470e956`, created 19:10. 25 pages. Time zone came out of the
template as Asia/Dhaka; it should be Asia/Bangkok.

`MTX Tonight` is archived and no longer returned by the API at all.

**Connector note.** The Webflow connection has to be re-authorised after a new
site is created, otherwise `list_sites` keeps serving the old grant — it showed
the archived MTX Tonight and not the new site. Reconnecting fixed it. Worth
checking first whenever the site list looks wrong.

## Two corrections to the notes above

**1. Avoora does ship with CMS collections.** Four of them, each with a working
detail page:

| Collection | id |
|---|---|
| Featured Works | `6ab1813d1cd693d8bed0ab24` |
| Blogs | `6ab1813d1cd693d8bed0ab43` |
| Case Studies | `6ab1813d1cd693d8bed0ab6a` |
| Services | `6ab1813d1cd693d8bed0ab8d` |

The earlier note said it ships without any. It does not. Events and Venues may
still be better built fresh, but there is existing structure to reuse.

**2. It is not a light-only template.** Two homepage sections ship dark:
Featured Work and Case Studies. The near-black brand look is not a fight with
the template, it is already half there.

## Homepage running order

Read off the site, not guessed:

| # | Section | Type | Note |
|---|---|---|---|
| 1 | Navbar | component | |
| 2 | Hero | section | background video, empty Services collection list |
| 3 | About band | section | four stat figures |
| 4 | Featured Work | section | **dark** |
| 5 | Our Expertise | section | |
| 6 | Membership Plan | section | to be deleted |
| 7 | Client Stories | component | |
| 8 | Awards Achievement | component | to be deleted |
| 9 | How We Work | component | |
| 10 | Case Studies | section | **dark**, parked for now |
| 11 | FAQ | component | |
| 12 | Latest Article | section | kept, becomes Bangkok guides |
| 13 | Let's Talk | component | closing CTA |
| 14 | Footer | component | |

## Brand colours

Sampled from `webflow/assets/muaytix-logo.png` rather than guessed — 13,487
fully opaque pixels, two dominant clusters:

| Colour | Hex |
|---|---|
| Red (the "muay" half and the dot) | `#F4201B` |
| Blue (the "tix" half) | `#004DF2` |

The template has **one** accent token, which is the whole recolouring job:

- `Color/Color Primary` — was `#ff5911` (orange), now `#f4201b`
- `Color/Color Secondary` — new, `#004df2`

Both live in the `Colors` variable collection
(`collection-01293dfa-5791-d605-b52b-9d2000beda0d`). There are two other
collections, `Base collection` and `Spacing (Responsiveness)`, both with
Tablet / Mobile (L) / Mobile (P) modes.

## Working techniques learned tonight

**Text in a Div Block cannot be set on the block.** `set_text` against a `Block`
element returns `This element doesn't support text`. Target the `String` child
node directly and it works. Headings take `set_text` on the heading itself.

**Setting text on a heading destroys any child span.** The hero H1 held an
`®` inside a `.Brand Mark` span; rewriting the heading removed it. Fine here,
but on an element whose span matters, set the String child instead.

**Buttons carry two text layers.** `.Primary Button Text.Is Absolute` and
`.Is Relative` — the hover swap. Both have to be changed or the label flips back
to the old text on hover. This pattern repeats across the template.

**`element_snapshot_tool` needs the Designer open** in a browser. With it closed
it fails with `status: false` and no useful message. Nothing else needs it.

**Element IDs must be copied whole.** Truncating them produces
`Element not found`. Child String ids are usually the parent id with the last
character incremented, but do not rely on that — read them.

## Hero copy now in place

| Slot | Was | Now |
|---|---|---|
| H1 | "Avoora ®" | "Muay Thai" |
| Second display line | "Studio" (a second H1) | "Bangkok", demoted to H2 |
| Eyebrow | "Award-Winning Creative Digital Studio" | "Official Tickets · Rajadamnern Stadium" |
| Subtitle | "We Build Digital Service with" | "Bangkok's original stadiums, booked direct" |
| Body | agency boilerplate | "Book real seats at Bangkok's original Muay Thai stadiums. Pick your night, pick your seat, confirmed in minutes." |
| Button (both layers) | "LET'S TALK" | "BOOK TICKETS" |

The page had **two H1s**, which is an SEO fault. Now one.

## Deliberately left alone — these need real facts, not invention

- **Hero trust line**, currently "24+ Years of Creative Excellence"
- **Hero profile cards** (×2), currently "Mitchel Jonson / Founder & CEO" and
  "Michek Jonson / Founder & CEO" — the second is a typo in the template itself
- **About band figures**: `$74M`, `95%`, `225+`, `92%`, each with a caption
- **Which venues we actually sell.** Only Rajadamnern is confirmed from these
  notes, so the eyebrow names only Rajadamnern. Lumpinee, RWS and the rest need
  confirming before they go on the page.

## Still to do on the homepage

1. Delete Membership Plan and Awards Achievement
2. Featured Work → fight-night listing
3. Our Expertise → seat classes
4. How We Work → the evening, doors to last fight
5. About band → facts strip, once the real numbers exist
6. Client Stories → real reviews
7. Navbar and footer rebrand, logo upload

---

# Session log — 23 September 2026

## Images: the route that works

**Google Drive → site is a working pipeline**, proven end to end. The shared
folder is `1PT7enA_GR6BRtY9JrY00T2N31f4ON7JG`. Jason drops files in, and:

1. `mcp__Google_Drive__search_files` with `parentId = '<folder id>'` lists them
2. `download_file_content` returns base64 — it is too big for the context window,
   so it lands in a tool-results file on disk. Decode from there, never inline
3. MD5 the bytes as 32-char lowercase hex
4. `data_assets_tool > create_asset` returns a presigned S3 target
5. POST the bytes as multipart/form-data: every `uploadDetails` key as a form
   field first, the binary last under `file`. HTTP 201 means success
6. `data_element_tool > set_image_asset` binds it to the slot

Same shape as the font upload. It works.

### The Designer bridge app

`element_snapshot_tool` and `asset_tool > upload_image_by_url` are Designer-side:
they need the Webflow MCP Bridge app running in a **foreground** browser tab.
Jason works from a phone, so the tab sleeps the moment he switches to Claude and
the bridge dies. **Treat both tools as unavailable.** Everything else — text,
styles, colours, structure, CMS, assets via the S3 route — works without it.
Webflow's own notice in the bridge panel says most actions no longer need it.

Consequence: **work cannot be checked visually.** Read the element tree and the
styles before changing anything, and expect Jason's screenshots to be the only
eyes on the result.

## What "check the layout first" actually means here

Two avoidable messes in two days, both the same root cause — content changed
without reading the box it goes in:

**The headline.** "Avoora" is six characters, "Muay Thai" is nine. Dropped in
blind, it overflowed and collided with the line below. The template's hero is a
two-part lockup of two short words. `MuayTix` fits; anything longer does not.
Ended up removing the second word and the divider line entirely — the hero H1 is
now just `MuayTix`.

**The logo.** The nav logo container is a **fixed 40×40 square** with
`object-fit: cover`. The MuayTix wordmark is 3.2:1. Bound straight in, it would
have been cropped to a square slice of the middle of the word. Fixed by setting
the container to `width: auto`, height 36px (28px at tiny), and the image to
`object-fit: contain`.

**Rule: read the target style before binding an asset or setting text.** The
template was built around specific proportions and they are not forgiving.

## Logo preparation

The file in Drive is `1200 × 1200`, **RGB with no alpha**, solid white
background, and the wordmark occupies only 27% of the canvas height. Unusable as
supplied — in a 40px nav slot the wordmark would render about a quarter size in
a white box, and a white box on the dark footer.

Prepared version saved at `webflow/assets/muaytix-logo-web.png`:

- cropped to the artwork with a 12px margin → `1114 × 345`, ratio 3.23:1
- white knocked out to transparent, **un-premultiplied** so the anti-aliased
  edges stay clean on any background (`alpha = 255 - min(r,g,b)`, then
  `colour = (pixel - white × (1 - alpha)) / alpha`)
- 62% transparent, all four corners clear

Uploaded as asset `6ab3d5be4e46211564f6b0aa`, alt text "MuayTix", bound to the
navbar logo.

## Hero photograph — placed the back way, needs redoing

`bangkok-muay-thai-stadium-knockout.jpg` is on the hero, but **not as an asset**.

The hero background is a `BackgroundVideoWrapper` playing a template MP4 — the
rainbow gradient. There is no image slot in it. The photo went on as a
`background-image` on `.Home 1 Hero Overlay`, the absolutely-positioned element
already covering that area, layered under its existing dark tint:

```
background-image: linear-gradient(to bottom, rgba(0,0,0,0.35), rgba(0,0,0,0.55)),
                  url('<s3 url>')
```

It works and reads well. But it is a raw URL, not a library asset, so it gets no
compression, no alt text, and cannot be swapped without editing CSS.

That first upload's asset record **404'd** and never appeared in the library,
which is why it was done this way. The logo upload minutes later, identical
method, registered fine. Cause unknown. **Re-check the hero asset and redo it
properly when convenient.**

## Homepage state

Done: brand colours, hero headline (`MuayTix`), hero copy, hero button, hero
photograph, navbar logo.

Still template: service cards (UI UX Design, Web Development, Brand Identity),
logo strip (ImgCompress, Galileo, Europa), Membership Plan, Awards Achievement,
"Creative studio based in NY" and "Accepting Projects" in the nav, "Buy Now"
button pointing at the Webflow marketplace, and every nav menu link pointing at
template pages.

## Social accounts

The real accounts:

| Network | URL |
|---|---|
| Instagram | `https://www.instagram.com/muaytix` |
| Facebook | `https://www.facebook.com/muaytix` |
| X | `https://x.com/muaytix` |
| Pinterest | `https://www.pinterest.com/MuayTix` |

**There is no LinkedIn.** The template ships four slots everywhere — Instagram,
LinkedIn, Facebook, X — so the LinkedIn slot became Pinterest. The link alone was
not enough; the icon had to change too, or it would have been a LinkedIn glyph
pointing at Pinterest.

### Where the social links live — four places, not one

| Place | How it is set |
|---|---|
| Nav menu | `Social Media 01`-`04` component instances, `Link` prop each |
| Hero, desktop row | four `Link` elements, `set_link` |
| Hero, mobile row | four more `Link` elements, same again |
| Closing "Let's Talk" block | `CTA` component instance, props `Link 1`-`Link 4` |

The footer has 29 links but **no social links at all**, so nothing to do there.

**Two Facebook links in the hero had no href at all** in the template — dead on
both the desktop and mobile rows. Worth assuming other template links are dead
until checked.

### Icons are editable, which is the useful discovery

Social icons are `HtmlEmbed` elements holding inline SVG. `data_element_settings_tool`
reads and writes them:

- read: `get_settings` with `type: "query_settings"`, `key: "code"`
- write: `set_settings`, `key: "code"`, `static_text.value` = the SVG

The template's icons use `viewBox="0 0 23 23"`, `fill="currentColor"` and
`width/height 100%`, so they inherit size and colour from their container. Any
replacement must keep that shape. The Pinterest glyph's native art is 384×512,
so it is wrapped in `<g transform="translate(2.87,0) scale(0.04492)">` to sit
correctly inside the 23×23 box rather than changing the viewBox.

Icons had to be replaced in **three** places, because the CTA does not reuse the
shared component:

| Icon location | Element |
|---|---|
| Shared `Social Media 02` component (used by the nav) | `5352bc11-…8082` |
| Hero desktop | `1cdf43e0-…d506454f0851` |
| Hero mobile | `182375b2-…d2b22fa600eb` |
| CTA block, its own four embeds | `ce0e4fc7-…6b7ddf76490c` |

`aria-label` was "Linkedin" on the shared component and on the hero links; all
updated to "Pinterest". Every social link now opens in a new tab.

**Check the icon before replacing it.** The CTA's four embeds are in DOM order,
not labelled, so the second one was read back and confirmed as the LinkedIn path
before being overwritten.

### Rate limits are real

`query_elements` returned `429` twice while working through this. Batch actions
into single calls where possible and expect to retry.

---

# Homepage build brief — progress, 23 September 2026

Working to the written brief. This section records what is done, what the API
refused, and what is left.

## Two rule breaches found and fixed

Both were mine, introduced before the brief arrived:

- **"Official Tickets"** in the hero eyebrow. The brief bans the word outright
  because it trips ad and search filters. Now "Rajadamnern Stadium · Bangkok".
- **"pick your seat"** in the hero body. The brief says tickets, never seats, in
  CTAs and copy. Replaced with the brief's own body text.

## The brief's meta description fails its own rule

The brief says to verify lengths by running code rather than estimating. Done,
and the supplied description is **180 characters against its own 155 limit**. It
also contains "seat", which section 2 bans.

Shortened to 143 characters, checked by script for length, banned words and em
dashes:

> Book Muay Thai tickets in Bangkok with MuayTix, international ticket partner
> for Rajadamnern Stadium. Secure checkout and instant confirmation.

Title is fine at 35 characters.

## What the Webflow API will not do

Three jobs in the brief cannot be done through the API. They are Designer work:

| Brief item | Why not |
|---|---|
| Rename collections (Featured Works → Events etc.) | No rename action exists. Only fields and items can be changed. Creating fresh collections instead would break every homepage binding, which the brief forbids |
| Delete the template-info pages | No delete-page action. They are set to draft instead, so they will not publish |
| Remove the Made in Webflow badge | Site settings, not exposed |

**Also found: `bulk_update_pages` silently ignores the `draft` flag.** It
accepts the field, returns success, and leaves `draft: false`. `update_page_settings`
one page at a time works correctly. Nine pages were redone individually.

## CMS, done

Collections reshaped in place. Display names still say the template's words
until renamed by hand.

| Collection | ID | New fields | Items |
|---|---|---|---|
| Featured Works → **Events** | `6ab1813d1cd693d8bed0ab24` | nights, start-time, short-description, ticket-page-link, sort-order, event-brand-colour, show-on-homepage | 6 real, 7 template deleted |
| Services → **Seat Classes** | `6ab1813d1cd693d8bed0ab8d` | short-description, assigned-seating, from-price-thb, row-guidance, class-colour, sort-order, seating-page-link | 5 real, 5 template deleted |
| Case Studies → **RWS Links** | `6ab1813d1cd693d8bed0ab6a` | link-url, sort-order, short-description | 4 real, 5 template deleted |
| **Stadiums** (new) | `6ab3e0f75eaf8a3dcb94c873` | city, opened-year, short-description, image, link | 1, Rajadamnern |
| Blogs | `6ab1813d1cd693d8bed0ab43` | none | **template items not yet cleared** |

**Seat class colours are my choice, not supplied.** The brief names colours but
gives no hex values except RWS red. Set to Ringside `#1E9E52`, Club Class
`#1F5BFF` (the company blue), LEO `#E8A400`, Third Class `#F26B21`, VIP
`#7B3FA0`. Change freely; they are one CMS field each.

**Event brand colour is set only on RWS** (`#FF1828`). The others are blank
rather than invented.

## Pages, done

- Homepage SEO title, description and Open Graph replaced
- Organization and FAQPage JSON-LD written to the homepage as one `@graph`
  object. The tool rejects a bare array; it takes an object or a raw string
- 9 pages set to draft: Home B, About B, Service B, Pricing B, Blog B,
  Instruction, Changelog, License, Style Guide
- 11 static pages retitled to "… | MuayTix" with placeholder descriptions

**CMS template pages were left alone deliberately.** Their SEO is bound to CMS
fields, so overwriting with static text would destroy the binding. Their
descriptions now resolve empty because the template items are gone; fill
`meta-description` per item instead.

## Hero, done

| Slot | Now reads |
|---|---|
| H1 | Muay Thai Tickets in Bangkok |
| Eyebrow | Rajadamnern Stadium · Bangkok |
| Overlay headline on the photo | Muay Thai Tickets You Can Trust. |
| Body | MuayTix sells tickets for Muay Thai at Rajadamnern Stadium in Bangkok, seven nights a week, as the stadium's international ticket partner. Book online, pay in your own currency and show the QR code on your phone at the gate. |
| Button | BOOK TICKETS |

## Decisions taken, on the record

- **Socials**: Instagram, Facebook, X, Pinterest kept, WhatsApp to be added.
  This overrides section 6.15, which said to remove X and never mentioned
  Pinterest. Confirmed directly.
- **Hero H1**: the big display slot is reused for the H1 rather than deleted, so
  the page keeps a top level heading for the SEO section to work with.

## Still to do

Section 6 is largely untouched below the hero. Outstanding:

1. Nav links and WhatsApp button
2. Hero: remove the five avatars, rebuild the two scrolling cards, secondary
   text link, move the social row to the footer
3. Logo strip, promotions as text
4. About statement, stats block (four figures are supplied and true)
5. Bind Fight Nights to Events, headings and button
6. Bind Where to Sit to Seat Classes, seating map image
7. Hide Pricing, Client Stories, Blog
8. RWS Saturdays section, theme `#FF1828`
9. The Venue, How Booking Works, First Time? questions
10. Talk to Us, footer four columns, copyright
11. Clear the Blogs collection
12. Alt text pass across every image

## Blocked on assets or answers

- **Seating map**: the Tilda CDN is refused by this sandbox, so the image cannot
  be fetched. Put it in the Drive folder instead
- **Contact email**: the brief says read it from the live site. muaytix.com is
  also refused by the sandbox, and it is obfuscated in the HTML. Needs supplying
- **Promotion logos** for the strip, and fight photos for events and the two
  hero cards
- **Fonts**: Arial Black and Calibri not applied. Keeping the template fonts per
  the brief's default, flagged as agreed

## Second pass, same day

**Decision 4 closed: keeping the template fonts.** Arial Black and Calibri are
not applied. Confirmed directly, and it matches the brief's own default.

Done in this pass:

| Section | What changed |
|---|---|
| Stats band | All four template figures replaced with the real ones: 7 fight nights, 1945, 60 min, 7 days |
| About statement | Agency lines replaced with the briefed MuayTix statement, both copies (the line is duplicated for the scrolling effect) |
| Fight Nights | Heading now "Five nights, five different fights" |
| Where to Sit | Heading now "Four seat classes, one ring" |
| RWS Saturdays | Heading now "Rajadamnern World Series" |
| How Booking Works | Three steps written in, heading "Three steps to fight night", eyebrow "HOW IT WORKS" |
| First Time? | All six questions and answers written in, eyebrow "FIRST TIME?", button now WhatsApp Us pointing at wa.me/66922706095 |
| Pricing, Latest Article | Hidden, not deleted |

The six questions on the page are **word for word the same** as the FAQPage
JSON-LD written earlier. If one is edited, edit the other.

### Client Stories will not hide through the API

`set_visibility` returns `Element does not support setVisibility` on a
ComponentInstance. Pricing and Latest Article are plain Sections and hid fine.
**Client Stories has to be hidden by hand in the Designer**, or the section
wrapped in a Div first.

### The stats band has prefix and suffix slots

Each figure is three separate text nodes: prefix, number, suffix. The template
used them for `$ 74 M` and `95 %`. Blanked the unused ones with a single space
rather than an empty string. So `60` carries the suffix ` min`, and `7` carries
` days`.

### Step 4 still shows

The template's process block has four steps and the brief gives three. Steps 1
to 3 are written. **Step 4 still carries template copy** ("Build website") and
needs hiding or removing.

## Collection list ordering — the thing that bites

The template's collection lists ship with **an empty sort**, which Webflow falls
back to newest-first. Every list built from new CMS items therefore appears in
reverse creation order. The hero seat classes read VIP, Third Class, LEO, Club
Class, Ringside for exactly this reason. Adding a sort-order field does nothing
on its own; the list has to be told to use it.

Set on the wrapper (`DynamoWrapper`), not the list, via
`data_element_settings_tool > set_settings`, key `sort`:

```
[{"fieldSlug":"sort-order","direction":"ascending"}]
```

**The key names are not guessable and the errors walk you there one at a time:**

| Tried | Error |
|---|---|
| `fieldId` | `Invalid sort: expected fieldSlug.` |
| `fieldSlug` + `order: asc` | `Invalid sort direction: expected "ascending" or "descending".` |
| `fieldSlug` + `order: ascending` | same error again — the key itself is wrong |
| `fieldSlug` + `direction: ascending` | accepted |

So: **`fieldSlug` and `direction`**. Verified by reading the setting back.

Applied to six lists: the hero seat classes, Fight Nights, and the four RWS
carousel lists. The two blog lists were left alone as that section is hidden.

The wrapper also exposes `source`, `filters`, `filterMatch`, `limit`, `offset`,
`pagination`, `queryMode` and `curatedItemIds` — worth knowing for "upcoming
nights, soonest first, 12 per page" later.

## Seat class order, as requested

Club Class, Ringside, LEO Section, Third Class. VIP Options set to **draft**
rather than deleted, so it comes back with one toggle when the VIP content is
ready.

| Order | Class | Number badge |
|---|---|---|
| 1 | Club Class | (01) |
| 2 | Ringside | (02) |
| 3 | LEO Section | (03) |
| 4 | Third Class | (04) |
| — | VIP Options | draft, off the site |

## Navigation and the closing block

### Nav, done

Six links, replacing the template's 25:

| # | Label | Target |
|---|---|---|
| 01 | Book Tickets | `/rajadamnern-stadium-tickets` |
| 02 | Tonight | `/muay-thai-bangkok-tonight` |
| 03 | Rajadamnern Stadium Tickets | `/rajadamnern-stadium-tickets` |
| 04 | RWS Tickets | `/rws/tickets` |
| 05 | Seating | `/rajadamnern-stadium-seating` |
| 06 | Contact | the Webflow Contact page |

The template's other 19 links sat in three groups. The surplus three in Main
Pages and the whole Inner Pages and Utility Pages groups are **hidden, not
deleted**, so nothing is lost if the menu grows back.

Also changed: the "Buy Now" button pointed at the Webflow template shop; it is
now **WhatsApp Us** → `wa.me/66922706095`. The stock photo of three people in an
office is hidden. The three strapline cards now read "Bangkok based, seven
nights a week", "Rajadamnern Stadium" and "Booking now" instead of "Creative
studio based in NY", "Est. 2026" and "Accepting Projects".

The group label "Main Pages" is now "Menu".

### Talk to Us, mostly done

Heading is "Talk to us". The "What we offer" list is now "Fight nights" and
carries five promotions. **The list has five slots and there are six events**,
so All Star Fight is not in it. Either drop one or add a sixth row by hand.

Office address replaced: "Bangkok, Thailand." / "MuayTix Ltd, registered in the
UK."

### The email address is a guess and needs confirming

The brief says read it from the live site. muaytix.com is refused by this
sandbox and the address is obfuscated in the HTML, so that was not possible.

Set to **`tickets@muaytix.com`**, which is the account that owns the shared
Google Drive folder, so it is a real MuayTix address. It is **not confirmed as
the public contact address.** Replace it or confirm it before this page goes
anywhere near a live domain.

### Still open in this block

- The contact **form is still there**. The brief says remove it and put two
  large buttons in its place, WhatsApp and Email. Left alone for now because
  deleting a form element is structural, not content
- The five fight night names in the list are text only; their **links are not
  set yet**

## Footer, done

The template footer has **three** link columns; the brief asks for four.
Mapped as:

| Column | Links |
|---|---|
| Home | All Muay Thai Tickets, Tickets for Tonight, Rajadamnern Stadium, Rajadamnern Knockout |
| Tickets | RWS Muay Thai Hub, All RWS Tickets, RWS Schedule, RWS Fight Card |
| Legal | Privacy Policy, Terms, Refund Policy |

All eleven point at the live Tilda URLs, as the brief instructs until the
Webflow legal pages are rewritten. The other 14 template links are hidden.

**The Social column has no home.** There is no fourth group in the footer, so
WhatsApp, Facebook and Instagram are not there yet. A fourth column has to be
duplicated in by hand. The social icons do already appear in the Talk to Us
block directly above it.

Copyright now reads "Copyright 2025 to 2026 MuayTix Ltd. All rights reserved."
The "Designed by Anova Flow / Powered by Webflow" credits are hidden.
**Check the template licence before publishing** — Avoora's licence page is on
the site at `/template-info/license`, currently drafted. Paid Webflow templates
usually do not require footer attribution, but that has not been verified.

"BACK TO HOME" is now "BACK TO TOP", which is what the button actually does.

## Remaining on the homepage

1. **The Venue** — Awards block still carries template award content
2. **Logo strip** — still ImgCompress, Galileo, Europa
3. **Hero** — five stock avatars still there, two scrolling cards still template,
   secondary text link not added, social row not moved to the footer
4. **Section eyebrows and sub lines** for Fight Nights, Where to Sit, RWS
5. **Step 4** of the booking block still says "Build website"
6. **Contact form** still present in Talk to Us
7. **Blogs collection** still holds template items
8. **Alt text** pass across every image
9. **Seating map** image, waiting on the file
10. Fight night names in the Talk to Us list need their links

---

# Typeface change — IBM Plex, 23 September 2026

**Decision 4 reopened and changed.** Not Arial Black and Calibri, and not the
template's Inter. The mockup specifies:

- **IBM Plex Sans Condensed** for display and headings
- **IBM Plex Sans** for body

Both installed as real custom fonts on the site, not faked with a fallback.

## What is installed

| Family | Faces | Notes |
|---|---|---|
| IBM Plex Sans | 1 | **variable**, weight axis 100 to 700 |
| IBM Plex Sans Condensed | 3 | static: 500, 600, 700 |

Files kept at `webflow/assets/fonts/` so they never have to be chased again.

## Google now serves IBM Plex Sans as a variable font only

This caught me out and is worth recording. Requesting
`css2?family=IBM+Plex+Sans:wght@400;500;600;700` returns **four @font-face
blocks that all point at the same file** — one variable font, `font-stretch:
100%`. The older v1 endpoint does the same. Downloading "four weights" gives
four identical files with one MD5.

IBM Plex Sans **Condensed** is still static, so its three weights are genuinely
three different files.

`cdn.jsdelivr.net` is **blocked by the egress proxy**, so the IBM Plex project's
own static builds are not reachable. Only `fonts.googleapis.com` and
`fonts.gstatic.com` are.

**The fix**: `create_font` accepts an `axes` array. Register the variable file
**once** with its real axis and Webflow handles every weight from it:

```
axes: [{ tag: "wght", name: "Weight", min: 100, max: 700, default_value: 400 }]
```

The axis range was read out of the file with `fonttools`, not assumed.

## Upload flow differs slightly from assets

`create_font` presigned uploads use **`Policy`** and **`Content-MD5`**
(capitalised, and the MD5 base64-encoded, not hex) where the asset flow uses
`policy`. Copy the returned `upload.fields` verbatim. All four returned 201.

## Applying it was one variable, then six tag styles

**Exactly one style in the entire template sets a typeface**: the `body` tag,
bound to a font-family variable that was set to Inter. Changing that variable to
IBM Plex Sans switched the whole site in one write.

For the condensed display face, a second variable was added
(`font family/Font Family Display`) and applied to the **default heading tag
styles h1 to h6**, plus `.hero-header` and `.section-heading`. Using the tag
styles means every heading picks it up, including ones not yet touched.

| Variable | Value |
|---|---|
| `font family/Font Family` | IBM Plex Sans |
| `font family/Font Family Display` | IBM Plex Sans Condensed |

Both live in `Base collection`.

**Worth knowing for later:** because the whole template hangs off these two
tokens, any future typeface change is two writes, not a hunt through styles.

## Seat class graphics, 23 September

Four branded ticket graphics supplied via the Drive folder, uploaded and bound.
Copies kept at `webflow/assets/seat-classes/`.

| Order | Class | Colour on the artwork | Strapline on the design | Asset |
|---|---|---|---|---|
| 1 | Ringside | green | Closest to the ring | `6ab3f46e243508582ec08148` |
| 2 | Club Class | blue | Elevated view of the entire ring | `6ab3f46e3096de66c03c349c` |
| 3 | LEO Section | gold | Where the atmosphere lives | `6ab3f46e243508582ec081c7` |
| 4 | Third Class | orange | 360 degree view of the action | `6ab3f46e8655e7e37b217bb2` |

Square, roughly 1254px, WebP. Each strapline was copied off its own artwork into
the `subtitle` field so the words on the page match the words in the picture.

**Order changed.** Earlier instruction was Club Class first; it is now
**Ringside, Club Class, LEO Section, Third Class**. The colours chosen blind
earlier turned out to match the artwork, so they stand.

### A CMS image field will not take a bare asset ID

`update_collection_items` with `"main-thumbnail": "<assetId>"` **returns success
and silently writes null.** No error. The field has to be an object:

```
"main-thumbnail": { "fileId": "<assetId>", "url": "<hostedUrl>" }
```

Webflow then copies the file into the collection's own asset folder and gives it
a **new fileId**, different from the site asset ID. Always read the response back
to confirm the field is populated rather than trusting the success status.

### Still outstanding on these

`alt` is null on all four. Jason is supplying the alt text.

## Stats parked

The four figures in the About band are **not final** and are not to be worked on
until the real ones are supplied.

Worth recording for when that happens: the numbers are animated counters. Each
sits in a `Text Display Large` block carrying a **`data-target` attribute** still
holding the template values (`74`, `95`, `225`, `92`). The text node says the
right thing but the script counts to `data-target`, which is why the page showed
53 and 57. **Both the text and `data-target` must be set.**

### Alt text, supplied and applied

Jason's wording, used verbatim, set in **two places** for each image: the CMS
item's image field and the site asset library entry.

| Class | Alt text |
|---|---|
| Ringside | Ringside Muay Thai tickets at Rajadamnern Stadium Bangkok, offering the closest seating to the ring for an immersive fight night experience. |
| Club Class | Club Class Muay Thai tickets at Rajadamnern Stadium Bangkok, with elevated seating and a clear view across the entire ring. |
| LEO Section | LEO Section Muay Thai tickets at Rajadamnern Stadium Bangkok, combining excellent ring views with the atmosphere of a live Muay Thai fight night. |
| Third Class | Third Class Muay Thai tickets at Rajadamnern Stadium Bangkok, with traditional stadium seating and a 360-degree view of the Muay Thai action. |

Checked against the section 2 rules before applying: no "official", no em dashes,
"tickets" not "seats" as the noun. "LEO Section" is the stadium's own name for
that block and is Jason's own wording, so it stands despite the alcohol brand
rule, which is aimed at phrases like "Singha Ringside".

**Webflow generated responsive variants automatically** on upload: 500, 800 and
1080px wide WebP versions of each. Nothing to do; the page will serve the right
size. Worth knowing so nobody makes them by hand later.

## Correction: the seat class graphics were in the wrong section

They went into the hero's small cards, because that is the only place on the
page bound to the Seat Classes collection. They were meant for the **"Four seat
classes, one ring"** block lower down.

### Why: that section is not CMS driven at all

`Our Expertise` contains **no collection list**. It is five hardcoded rows with
five fixed image slots (`Home 1 Service Image`) that still held template stock
photography — basketball, football, macarons, a man in a beanie, a headphones
silhouette. **Nothing put in the CMS will ever appear there.**

This matters beyond this one fix: **the brief assumes this section can be bound
to Seat Classes, and as built it cannot be.** Either it is filled by hand, as
done here, or it gets rebuilt as a Collection List.

Filled by hand for now, keeping the template structure as the brief requires:

| Row | Class | Image element |
|---|---|---|
| 1 | Ringside | `cfe404eb-…4c1d` |
| 2 | Club Class | `f02b7aa6-…0b4c` |
| 3 | LEO Section | `b466c01f-…47f2` |
| 4 | Third Class | `24f6a1be-…98ba` |

Each row now carries the class name, its description with the from price, four
tag chips, and the supplied alt text. Section eyebrow changed from "SERVICE" to
"WHERE TO SIT", row labels from "SERVICE" to "SEAT CLASS".

**Each row holds its name and label twice** — once for the collapsed state and
once for the open state. Both must be set or the accordion shows the old text
when opened.

### Still to do here

- **Row 5 is still template content** ("Content Strategy", headphones photo) and
  needs hiding. Hit a `429` before it was done
- The graphics are **still also on the hero cards**, where they are cropped
  because the slot is landscape and the artwork is square. Per the brief those
  hero cards should be "Tonight" and "This Saturday RWS" anyway, so that section
  needs rethinking rather than just clearing

---

## Publishing — standing permission granted, 23 September

**Jason has given standing permission to publish without asking each time.**
This overrides the brief's "do not publish" instruction, which was written
before the staging setup was settled. His reasoning, recorded so it is not
second-guessed:

- The site sits on the Webflow staging subdomain only
- **No custom domain is attached** (`customDomains: []`), so publishing cannot
  reach muaytix.com under any circumstances
- He has blocked search engine crawlers

**Publishing still only reaches `muaytix-com-v2.webflow.io`.** If a custom
domain is ever attached, this permission should be re-checked, because the blast
radius changes completely.

### The published site cannot be verified from this sandbox

`muaytix-com-v2.webflow.io` is refused by the egress proxy, same as webflow.com
and muaytix.com. So:

- The publish call succeeding is the only confirmation available
- **robots.txt and the meta robots tag cannot be read**, so the crawler block is
  taken on Jason's word rather than verified
- Published output cannot be checked for leftover template text

Row 5 of the seat class section is now hidden, so all four rows and nothing else.

### Worth knowing: the Designer shows changes without publishing

Publishing is only needed to view on a phone or show someone else. Anything done
through the API appears in the Designer immediately.
