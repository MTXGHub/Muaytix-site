# MuayTix

Read this first, every session. It holds the things that are true across all of
them. If something here turns out to be wrong, fix it here as well as fixing the
thing itself.

Last verified against the live database and the repo on 24 September 2026.

---

## 1. Who you are working with, and how

Jason McLellan, owner and CEO of MuayTix LTD. A Muay Thai ticket agent selling
Rajadamnern Stadium tickets in Bangkok.

- **He is not a developer.** Explain in plain English. No jargon, no internals
  unless he asks.
- **He has no terminal.** He works on a tablet. Anything that needs doing, you do
  it, or you give him clicks in a browser. Never hand him a shell command or a
  script to run. If you catch yourself writing one for him, stop.
- **Short answers.** The action, not the diagnostics. He has said "I don't have
  time to read War and Peace" and he meant it. If the answer is two words, give
  two words.
- **He works nights and the business runs on Bangkok time**, which is often the
  middle of his night. Assume he is tired and short of time.
- **Label every claim.** Say whether you ran it and read it back, or whether you
  are guessing. Never state a theory as a finding. Three wrong diagnoses
  presented as fact nearly ended the working relationship in September.
- **Nothing is done until it is live and read back.** Committing is not
  deploying. A page he has not pasted into Tilda is not on the site. Do not say
  "deployed", "live" or "done" about anything sitting in git.
- **Do not race ahead.** If he says "hang on", stop and wait. If he is giving a
  list in stages, capture and wait for the rest.
- **Never use his past mistakes as leverage in an argument.**
- **RWS ticket numbers are facts, never defaults. Written here three times on
  purpose, 6 October 2026.** The number Jason gives for an RWS night is the
  tickets physically in hand: pre-bought, counted against the invoice, the Drive
  and the bookings. It goes into `total_quantity` exactly as he gave it. Never
  leave a placeholder, never estimate, never carry one night's number to
  another. When his number is used up the class is **fully booked, no matter
  what**. See sections 6 and 13, and the record in `agent-tix/notes/rws-allocations.md`.

---

## 2. House style for anything a guest reads

This is the rule that matters most and the one most often broken.

**Guests come from 81 countries and about half do not have English as a first
language. Less is more. Factual only. Never invent.**

The seat class graphics set the standard: a name, one short line, nothing else.
"Ringside. Closest to the ring." That is the whole idea.

### Banned outright

| Banned | Use instead |
|---|---|
| "official" anywhere: copy, alt text, file names, schema, meta | "international ticket partner" |
| "Limited" as a guest-facing status | "Available", in green |
| "Sold out" as a status on a seat class button or tile (his rule, 5 October 2026: it sends guests to other sites) | "Fully booked", on the red button |
| Em dashes | A comma, a full stop, or a colon |
| "book your seat" | "Book Tickets" |
| "assigned" / "unassigned" seating as guest copy | Say what actually happens |
| Scarcity copy: "selling fast", "70% booked", "hurry" | Nothing |
| Delivery timescales he has not set | Nothing |
| Alcohol brand names in copy (Singha is allowed in alt text only) | "Ringside" |

### Call it out before you build it

Said on 4 October 2026, after a line explaining seat allocation sat under a
booking button. Every line a guest reads either removes a question or creates
one. A created question is a guest who leaves, or a WhatsApp message his team
has to answer. Both cost more than the line was worth.

Before building any line that **explains how something works, makes a promise,
or uses a trade word** ("allocated", "assigned", "guaranteed seat location"),
ask: does this give the guest a question they did not have? If yes, say so in
one sentence **before** building it, even when the copy came from him. He
wants it called out, not just written. A promise on the page that the checkout
does not visibly keep is the worst case: the guest books, nothing matches, and
they leave.

### Also

- British English.
- No filler. If a line repeats the line above it, cut it.
- No made-up detail. If a fact is not supplied, leave it out and say so.
- Trade words are not guest words. "Assigned seating", "general admission",
  "dimmed nights" and "first dispatch" all failed for the same reason.
  **Two deliberate exceptions, decided by Jason on 5 October 2026, see section
  13:** "general admission" on Third Class, and "Assigned seating" on the seat
  class cards.
- Copy he supplies is used verbatim. You build, he writes. If his copy creates a
  problem, say so in one sentence and build it anyway.

---

## 3. The four seat classes

Straplines come from his own artwork and are authoritative. They live in the
database (`ticket_classes.tagline`) so the widget and the pages always agree.

| Class | Sections | Price | Strapline |
|---|---|---|---|
| Ringside | 3 to 7, floor level | 2,500 THB | Closest to the ring |
| Club Class | 8 and 9, elevated tier | 1,800 THB | Elevated view of the entire ring |
| LEO Section | 10, elevated tier | 1,500 THB | Where the atmosphere lives |
| Third Class | 11, upper tier | 1,000 THB | 360 degree view of the action |

Club Class is about 55 per cent of bookings. Third Class opens on selected
nights only. There are no standing areas: every ticket guarantees a seat.

Class colours, sampled from the seat map artwork, are used as swatches and bars
only. **None of them is legible as type.** LEO's yellow measures 1.04:1 on a
pale background. Never set text in them.

```
Ringside #00A651   Club Class #27AAE1   LEO #FFF200   Third Class #F7941E
```

---

## 4. How the site is put together

The site is **Tilda**. There is no build step and no deploy. Pages are hand-built
HTML blocks that Jason pastes into a Tilda HTML block (T123).

- Every block is scoped under one class (`.mtx-kp`, `.mtx-hp`, `.mtx-ss`, `.mtx-ok`)
  so it cannot reach the rest of the site.
- No `<html>`, `<head>` or `<body>` wrappers. Scoped fragments only.
- Meta title, description, Open Graph and canonical are **Tilda page settings**,
  not part of the block. Give him the text to paste.
- The nav and footer are Tilda's, not ours.
- Source files live in `pages/`, with a small build script that strips comments
  to produce the paste-ready copy. **Generate the paste file, never hand-edit it**,
  or the two drift apart.

### Fonts

**Barlow** for body, **Barlow Condensed** for headings and buttons. No page loads
them. **The booking widget loads them from Google Fonts, from the site head, on
every page.** Remove the widget's header block and every page silently drops to
Arial Narrow.

The RWS page is the odd one out: Arial Black and Calibri, no Barlow.

---

## 5. The booking widget

`agent-tix/widget/widget.js` is the source of truth. It is pasted **once** into
Tilda Site Settings → More → HTML code for the HEAD. Changing it means rebuilding
the header block and re-pasting it, which affects every page at once.

```bash
node build-header-block.mjs > paste-into-tilda-header.html
node build-paste-block.mjs  > paste-into-tilda.html
```

The builders write to stdout. They must be redirected or nothing changes.

**Keep the header block small and plain.** On 5 October 2026 a 67 KB header,
which passed every test in a real browser, went into the Tilda head and the
widget vanished from every page while the rest of each page was untouched. The
cause was never confirmed (the live site cannot be read from here). Two things
set that file apart from every earlier one, so both are now ruled out by
`tests/header-block.test.mjs`: **under 63,000 bytes** (the last version known
to work was 58,664) and **no pattern containing a double slash** (simple tools
that tidy scripts can read it as a comment). Do not write a regular expression
with `//` in it; use a string test instead. If the block must grow past the
limit, shrink something else first. The builder already strips every comment and
every unneeded space (it needs eslint's parser, which this environment has) and
the test proves the result is the same program token for token; it was about
61,000 bytes when this was written.

**Stage every header change on one test page.** Tilda only applies new head
code to a page when that page is published. So: paste the new header, publish
**one hidden test page** that holds just the widget, check it, and only then
publish the rest. If it fails, put the previous header back and nothing guests
see has changed. Never publish all pages on an untested header. Keep the last
header that worked ready to paste as a rollback. **Live, as far as I know: the
header at commit `0472ed1`** ("Fully booked", never "Sold out", on seat class
buttons). Jason pasted it on 5 to 6 October 2026 and said it published fine. The
one before it, **`96304c9`** (photo cards, back button, closed card, live from
the morning of 5 October), is the **rollback** (in git:
`agent-tix/widget/paste-into-tilda-header.html` at that commit). **Not yet
pasted: the Club Class offer header (7 October 2026, 62,777 bytes).** See the
offer bullet below, and do not say it is live until he has pasted it and a real
page shows the red LEO tile as tappable. The database and both functions for it
**are** live (applied and deployed 7 October 2026: `availability` v12,
`create-checkout` v11). Stage it the usual way: the copier page has a test-copy
header for one hidden page (mount on Thursday's Petchyindee, where LEO is
already fully booked), the live header as the rollback, and the new header last.

### Mounting it

```html
<div class="muaytix-ticket-selector"></div>                    full calendar
<div class="muaytix-ticket-selector" data-start="seats"></div> seat class first
<div class="muaytix-ticket-selector" data-event-id="rws_2026_09_26"></div>
```

### Rules the widget already follows

- It never prints the word "Limited". `available` and `limited` both render as
  **Available** in green, unless the class is down to a handful, see below.
- **Below 5 seats, the button shows the exact number instead of Available.**
  `SAY_REMAINING_AT` in the `availability` function is **4**: once a class's
  remaining stock is 1 to 4, the guest sees that number ("4 left") instead of
  Available; at 5 or more it still just says Available. This was fought over
  hard in September 2026 (git history on `availability/index.ts` has the full
  story) after a badly-worded fix briefly suppressed the count altogether.
  Change the threshold only if he asks.
- Seat tiles show Available or Not currently on sale. They do **not** count
  nights.
- Class name, strapline and section line all come from `ticket_classes`, so
  changing that copy is a database edit, not a release.
- **Seat tiles sit two and two** on a tablet or screen, one to a row on a phone.
- **Photos and selling lines** live on the class too (`ticket_classes.photos`
  and `.benefits`, both JSON lists, shown in the order stored). A class with
  photos is drawn as a card with a swipeable slider, the photos first and the
  lines under them. **Sold out, or booking closed, the photos go** and the
  compact tile returns. **A class that is only not open yet (Third Class)
  keeps its photos**, shows why it is closed, has a grey Closed button, and
  under it a green button for the nearest class above it that can be bought
  (LEO Section for Third Class). Cards in the same row are the same height and
  their buttons line up.
  A class with no photos is drawn as it always was, so classes are launched one
  at a time by filling in their row. Launched: LEO Section (5 October 2026).
  Photos are 3:2, about 1200 x 800, JPEG, uploaded to Tilda for the link. Lines
  are Jason's wording verbatim. A line with a second half has it as a `note`,
  shown in brackets under that line (LEO's guarantee line is the example).
- **The browser's back button steps back through the widget** (chosen class to
  seat list, night to dates). Each forward step adds one browser history entry
  and the on-page "Change ..." buttons go through the same history, so the two
  never disagree. A photo card's button reads "Available | Book LEO Tickets".
  "Change seat class" is a large button, and "Reserve your tickets" is green
  while it can be pressed (it stays the dashed grey outline while it cannot).
- **A closed class says why, on its own tile.** The text is
  `event_ticket_classes.closed_explanation`, per night. For Third Class it reads
  "Third Class is currently closed. The stadium opens it when the other seat
  classes are close to full. This does not happen every night." (set on every
  not-released night on 5 October 2026; **any night loaded later needs the same
  text**). Sold-out classes show no explanation. The stadium's own site shows
  nothing for a closed class, and a guest left wondering buys elsewhere.
- It never decides whether tickets are on sale. The database cutoff does.
- **Club Class offer when LEO is fully booked (built 7 October 2026, Jason's
  decision, 1,650 baht).** LEO sells out first and a guest who wanted LEO does
  not think to move up, and Third Class is shut. So a fully booked LEO tile is
  **still red and still says "Fully booked"**, with a **green button under it**,
  the same size as every other button (`OFFER_BTN`, **"Save on Club Class
  tickets"**, Jason's own words, at the top of `widget.js`) with a **soft green
  ring that pulses** around it to draw the eye (switched off for anyone whose
  device asks for reduced motion). The tile itself is a plain box, not a button. Jason,
  7 October 2026, after seeing a line of small text: "it needs to go on a
  button underneath... in your face". Tapping the button opens Club Class at the
  offer price, with "LEO Section is fully booked. Club Class usual
  price $54" above the price. **The offer price is never on the class list**:
  guests who came for Club Class see the ordinary price until they tap LEO (Jason
  accepted that some of them will find it). The panel opens with a **big
  banner in the same bright green as every green button** (`--go`; he rejected my
  darker green: "you've invented a new shade". White on that green is about 3.2
  to 1, the same as every green button on the site, which is fine for the big
  price and below the usual 4.5 for the small lines; he has been told) (Jason, 7 October 2026: the first version "tells me nothing... I
  would need a magnifying glass"): his words as the headline, the offer price in
  the biggest type in the panel, "Usual price" with the old price struck through (26px bold with a thin line; at
  first it was so small the line hid it),
  a white badge saying "Save $4 per ticket" (worked out in the guest's own
  currency), and "LEO Section is fully booked". It follows the currency selector.
  The banner's small wording (everything except his headline) is mine; he is to
  rewrite it. Every line in it is checked for contrast by the test.
  - **Prices:** 1,650 baht, $50, EUR 44, GBP 37, AUD 72, CNY 330, in
    `class_fallback_offer_prices`. Each is the Club price times 1,650/1,800
    rounded UP, so none falls under the stadium's 10 per cent discount limit
    (floor 1,620 baht). A trigger in the database refuses a price outside 90 to
    100 per cent of the standing Club price, and the server checks it again
    against tonight's price.
  - **Per night, off by default.** `events.fallback_offer_enabled`. Switched on
    for Knockout, New Power, Petchyindee and Kiatpetch, **off for RWS and All
    Star on purpose.** **Any night loaded later needs it switching on**, like the
    Third Class explanation; a night that is not switched on simply has no offer.
    **Never switch it on for RWS.**
  - **The browser only asks** (`offerFrom: "leo_section"`). `create-checkout`
    looks the offer up, confirms LEO really is fully booked at that moment, and
    charges the database price. Any doubt returns 409 `offer_unavailable`, and
    the widget reads the night again and the offer disappears. It never sends a
    price.
  - **Fails safe both ways.** If the offer cannot be read, `availability`
    answers exactly as before and the night is untouched.
  - **The reports take the discount off the margin** (`offer_discount_minor` on
    the booking), so a discounted ticket does not overstate contribution.
    `fallback_offer_by_day` says whether it is working: reached checkout, paid,
    tickets, baht given away, contribution kept. The question it answers is
    whether this brings in guests who would not have booked, or only discounts
    guests who were booking Club Class anyway.
  - **Header size:** the offer took the header from 62,454 to 62,643 bytes only
    because the repeated SVG icons were folded into one helper (`svg()`), one
    dead style went, and the stylesheet lost the spaces CSS does not need (the
    builder now also strips them around `{ } ; ,` and after `:`, and the header
    test normalises the same way; nine screens rendered pixel for pixel and
    style for style the same before and after), the six identical scroll calls
    became one `glide()` helper, the three repeated tile headings became one
    `tileHead()`, and the long comment at the top of the header block was cut to
    two lines. **Use the nine-screen comparison again for any further shrinking:
    it caught a "reduce motion" rule I had shortened until the pulse no longer
    stopped.** The 63,000 limit is nearly used up. Shrink before adding.

`agent-tix/widget/booking-widget.html` is a **standalone prototype, not the live
widget**. It is out of date and still renders "Limited". Its test suite
(`booking-widget.test.mjs`) fails and has done for a long time. Do not confuse it
with `widget.js`.

---

## 6. The data

Supabase project **`jlwopomkqeawrxlapwpc`**. Four active edge functions:
`availability`, `create-checkout`, `stripe-webhook-v2`, `stripe-session-attribution`.

There is no `widget` edge function. The widget is pasted into Tilda.

| Table | What it holds |
|---|---|
| `event_calendar` | every night: name, local date, start time, venue |
| `events` | `booking_cutoff_minutes` (30 for every event) |
| `event_ticket_classes` | per event per class: `total_quantity`, `sold_quantity`, `manual_status`, `maximum_seats_together`, `max_per_order` |
| `ticket_classes` | name, code, `tagline`, `description`, `margin_minor`, `photos`, `benefits` |
| `event_ticket_availability` | the view the widget reads, with the resolved `status` |
| `checkout_reservations` | every checkout: status, quantity, attribution, guest details |

**Rybbit "purchase" event (built 8 October 2026; migration 0041 applied and
`stripe-webhook-v2` v8 deployed 8 October 2026; NOT yet proven by a real test
booking).** `stripe-webhook-v2` calls `rybbit.ts` after a sale is banked and
sends one `purchase` event to Rybbit per paid Checkout Session. It never throws
and never changes the answer Stripe gets. One event per sale is enforced by a
claim on `checkout_reservations.rybbit_purchase_sent_at`. Secrets:
`RYBBIT_API_KEY`, `RYBBIT_SITE_ID` (049ad8e38da6, the id in the tracking
script), `RYBBIT_SITE_ID_ALT` (10499), optional `RYBBIT_USER_AGENT`. The request
carries an explicit browser `user_agent` because Rybbit's bot blocking checks
server-side events too. No personal data is sent. Every paid sale logs one
"rybbit purchase outcome" line (sent, skipped_no_key, failed...). Test:
`agent-tix/functions/tests/rybbit-purchase-guards.test.mjs`.

### Status precedence

```
hidden → not released → past cutoff → quantity 0 → manual_status → limited → available
```

**The cutoff outranks `manual_status`.** `manual_status` accepts only
`available`, `limited`, `fully_booked`, `booking_closed` or NULL.

### The booking cutoff

Start of the event minus `booking_cutoff_minutes` (30). A 6:00 PM fight closes at
5:30 PM Bangkok. Anything that shows tonight's event must respect this, not just
the date, or it offers tickets nobody can buy.

### Tickets he holds, and tickets he does not

This is the fact behind most trading decisions, and it is not in the database.

**Club Class and LEO Section are real tickets already bought and in hand.**
They can be sold down to zero safely: the seats exist, so the last one sold is
still a seat someone gets.

**Ringside is not held.** It is sold against the stadium's own remaining stock,
so a sale after the stadium sells out is an oversell and a problem. That is why
Ringside gets closed early, by his call, rather than being left to run out on
its own. Do not suggest letting it run down, and never treat a Ringside
allocation as equivalent to a Club Class one.

Third Class is opened by the stadium, usually only once the other classes are
full or close to it.

**Third Class on ordinary nights is bought as we go, not pre-bought** (Jason, 6
October 2026). The stadium opens a section of about 2,100 seats at around 2 to 3
pm for a 7 pm night, and there is no way they all sell, so MuayTix buys each
ticket after the booking arrives. The standard **50** is the working number, not
a placeholder. When he says it has opened, open it at 50. This applies to
ordinary nights only: RWS Third Class is different (bought in the week of the
event) and its number comes from him.

**RWS is different, and Jason explained why on 5 October 2026: see section 13,
"How stock is bought". Never suggest buying more RWS tickets.**

**RWS numbers are tickets in hand, and they are never wrong.** Rules, every time:

1. **When he gives an RWS number, set `total_quantity` to it that minute.** Read
   back every class for that night with total, sold and left, and write it into
   `agent-tix/notes/rws-allocations.md` with the date. Do not say "done" before
   all three have happened.
2. **Whenever you read or show an RWS night, show the counts**, not just the
   status, and compare them with the record and with anything he has said. If
   the database differs, say so first, before anything else.
3. **A number of 25 / 40 / 25 on an RWS night is a placeholder, not stock.** It
   sits on nights he has not pre-bought yet. Such a night is not safe to sell
   once he has pre-bought it. If a night inside the pre-buy window shows
   placeholders, say so and ask for the real counts before it is sold.
4. **If his number is lower than the database's `sold_quantity`, stop and tell
   him.** The database will refuse the change; do not work round it.

### Reports that already exist. Use them first.

Said on 4 October 2026: reports were built, with time and credits, so that
questions about bookings, channels and drop-off are answered by **running the
report**, not by writing a fresh query or reaching for Google Analytics. Doing
that mixed two different measures in one answer and cost him several chats.

Rules:

1. When he asks a numbers question, find the matching view below and run it
   first. Say which report you ran.
2. Do not pull Google Analytics unless he asks for it or no report can answer.
   If you do, keep its numbers (visits) apart from the reports' numbers
   (checkouts and paid bookings). They are different things and must never sit
   in one sentence as if they were the same.
3. If no report answers the question, say so in one sentence and ask before
   building anything new.

4. **Start every numbers answer with a header line**: the report name, the date
   window, the page filter and the channel. He should never have to guess what
   a number counts.
5. **Totals come from the query, never from typing.** A hand-typed total (26
   instead of 25) destroyed his trust in every other figure. Have the database
   add it up and paste what it returns.
6. **Give the one number he asked for, then stop.** No second table, no
   explanation of two measures, unless he asks. If an answer needs a caveat,
   put it in one sentence before the number, not after he pushes back.
7. If his question is about **visits** (people who arrived, whether or not they
   started checkout), say first that the reports cannot count visits and only
   Google Analytics can. Then give that number on its own, labelled, and never
   divide a report number by it.

Source tagging only exists from 19 September 2026 09:56 Bangkok. Anything
earlier shows as unattributed because it was never tagged, not because it did
not happen. Say this whenever a window starts before that date.

| Question | View |
|---|---|
| Paid bookings by channel, landing page, device, country, margin | `booking_attribution` |
| Who started checkout and did not pay, with channel and page | `abandoned_checkouts` |
| Of those who reached checkout, how many paid, by landing page | `checkout_funnel_by_landing_page` |
| Same, by the page they pressed Book on | `checkout_funnel_by_page` |
| Contribution won and lost by page | `contribution_lost_by_page` |
| Bookings and contribution by day | `contribution_by_day` |
| Bookings by card country, by payment method | `bookings_by_nationality`, `bookings_by_payment_method` |
| How many looked at a night, how many reached checkout, how many paid, by day | `look_to_sale_by_day` |
| Calendar and look-ups by day, by event, by page | `widget_looks_by_day`, `widget_looks_by_event`, `widget_looks_by_page` |
| How many abandoned checkouts left an email | `abandoned_capture_by_day` |
| Bookings that need a refund | `bookings_needing_a_refund` |
| Weekly pay | `weekly_pay` |
| Tickets per event per week, and each event's share of the week (Knockout, New Power, Petchyindee, RWS, Kiatpetch, All Star) | `tickets_by_event_by_week` |
| Whether the Club Class offer for a fully booked LEO is working: reached checkout, paid, tickets, baht given away, contribution kept | `fallback_offer_by_day` |

Visits that never start a checkout are not recorded anywhere in the database.
`widget_looks_*` counts people who opened the booking widget, which is the
nearest thing to a visit count the reports hold.

### Routine trading jobs

Close a class: set `manual_status = 'fully_booked'`. Set a real allocation: set
`total_quantity`. Limit a group: set `maximum_seats_together`. Always read the
availability view back afterwards and show him the four classes.

**Timed closings are a safety net, and he wants them used often.** Said by Jason
on 6 October 2026: he is often pulled away to other tasks, and a class that is
likely to sell out at the stadium should close on a timer so MuayTix never sells
what it does not have. His example: Club Class for the 6 October Knockout, where
he watched the stadium's seats go fast, row A (flat with the ring, so the last
row the stadium opens) was the last left, and his experience put the sell-out
between 1:30 and 2:00 pm, so Club Class closed at 1:30 pm and Ringside at 2:00 pm.

**How to do it: put it on the database's own clock, not on a reminder to me.** The
database has `pg_cron` installed. A reminder only works if this chat is running.
Schedule a one-off job in UTC (Bangkok is UTC+7, so 1:30 pm Bangkok is `30 6`),
make it set `manual_status = 'fully_booked'` for that one class on that one
night, and have it unschedule itself, e.g.
`select cron.schedule('close-club-knockout-6oct-1330bkk', '30 6 6 10 *', $$update ...; select cron.unschedule('close-club-knockout-6oct-1330bkk');$$)`.
Read `cron.job` back to show him it is active. Still set a reminder to read the
four classes back at that time. Never claim a timer needs this chat to run.

**How he sets "max seats together", and why (6 October 2026). This is judgement
on the day, not a formula.** He watches the stadium's own seat map (Ticketmelon)
by eye and decides from how fast seats are selling there. It is **not based on
MuayTix sales data**, and every event differs in speed, volume and which sections
are close to selling out. The numbers below (max 2, 1:30 pm, 2:00 pm) are one
worked example so I understand how he thinks. **Never copy them to another night,
and never suggest a group size or a closing time from sales data.** I never set a
group size by guessing. His reasoning, for Ringside on the 6 October Knockout:
- The stadium's map shows what is really left. On that day one row of 4 together
  and two groups of 3 together were left, against **9 pairs**.
- Seats go at the stadium in minutes and MuayTix does not see it happen. If a
  booking of 4 arrives after the 4 are gone, the cost is a refund, the cost of the
  refund, messages to the guest, offering other options and waiting for a reply
  while seats keep selling. Not worth the revenue of a couple of seats.
- So he sets **max 2 together**: 9 pairs means that even if 3 or 4 pairs sell
  at the stadium unseen, 5 or 6 pairs are still open to MuayTix. Safe first, then
  revenue.
- Ringside sells slower than Club Class. When Club Class goes fully booked
  guests **do not upgrade to Ringside; most simply do not go**, so closing Club
  Class early costs sales that do not come back.
- Chinese guests know the stadium well and take the best spots first, so a
  section such as Section 4 can be sold out early.
- Row A in Club Class is flat with the ring and is the last row the stadium
  opens, so it is the last Club Class stock to go.
- **LEO Section has no seat map on Ticketmelon, so he checks it another way.**
  He clicks the ticket quantity up to the maximum, which is **15**. If it reaches
  15, at least 15 are left. If it stops at 10, 8, 5 or any number below 15, the
  section is about to sell out and he generally closes it there and then. Even
  stopping at 11 he would not take the risk, because there is no map to see. LEO is
  where the locals go, so **Wednesday, Thursday and Sunday (the traditional nights)
  are the LEO demand nights, and LEO usually sells out first.** I cannot do this check;
  I remind him on a schedule, read our own counts, and close only when he says so.
  **Worked example, 6 to 7 October 2026:** at 5 pm the quantity still reached 15 for
  Wednesday's New Power. He closed LEO on a timer at 9:30 pm, before sleeping, and the
  next morning he confirmed the stadium had sold LEO out overnight (he does not know
  the hour). A traditional night's LEO can go between a 5 pm check and morning, so
  a late timer before he sleeps is the right safety net. His words: "absolutely
  right to do what we done".
- **Ringside and Club Class are checked on the seat map, one big section at a time.**
  He does not open all five Ringside sections (3 to 7). He opens one of the bigger
  ones, and if it looks healthy, stock is sitting in every section and there is no
  alarm. Said 7 October 2026 about the next day's New Power Ringside: no check
  needed, look again at the end of the day. A map that looks half empty is not
  safe on its own: a night can sell half the stadium in 24 hours, so what matters
  is how fast the map moves between, say, 3 pm the day before and 3 pm on the day.
  He does not always get it right; he does the best with what he can see.
- Most bookings are for **two seats**, so pairs are the unit that matters. When
  a class is down to its last few pairs on a same-day night, they can go in
  minutes, and **agents on the ground may buy them** to clear availability down to
  singles, which makes the pairs they hold valuable to resell in taxis and hotels
  for the hours left. Between about 12 and 3 pm is usually quiet.
- **His biggest pain point is selling a ticket MuayTix does not have**, for him
  and for the guest. The cause is that there is no real-time view of the stadium's
  seat availability. He counts the seats and pairs on Ticketmelon by eye, every
  half hour or so. He wants a way to do what his eyes do: read the seat map, count
  seats and pairs, and call the run rate. No solution yet. Any idea must respect
  Ticketmelon's terms and must not hold or touch their inventory.

---

## 7. Time

**Bangkok is UTC+7 and has no daylight saving, ever.** That is why date handling
is arithmetic, not a timezone library:

```js
var bkk = new Date(now.getTime() + now.getTimezoneOffset() * 60000 + 7 * 3600000);
```

London and New York **do** change their clocks, so any time shown in those cities
must be converted at render time with `Intl`, never typed in. A table typed in
September is wrong in November.

---

## 8. Traps that have already cost time

- **`.mtx-xx ul { margin: 0 }` is (0,1,1)** and beats a single-class `margin-top`.
  Fix by doubling the class: `.mtx-hp .mtx-hp__facts { margin-top: 36px }`.
- **A direct match beats inheritance.** `.mtx-kp__booking h2 { color:#fff }`
  matched the widget's own heading and turned a fight night's name white on
  white. Every page hosting the widget needs:
  ```css
  .mtx-xx #mtx-booking h1, .mtx-xx #mtx-booking h2,
  .mtx-xx #mtx-booking h3, .mtx-xx #mtx-booking h4 { color: inherit; text-transform: none; }
  ```
- **`width` and `height` attributes beat `aspect-ratio`.** They arrive as
  presentational hints. Always add `height: auto` or images render at full
  height.
- **A `background` shorthand on a later single-class rule wipes a hero image.**
  Do not give a hero both `__hero` and `__band`.
- **Middot separators drawn with `li + li::before` land at the start of a wrapped
  line.** Remove them below the wrap breakpoint.
- **Browsers strip the path from cross-origin referrers**, so every
  `widget_looks.page_path` is `/`. That report is meaningless. `create-checkout`
  is correct because the widget sends the path in the body.

---

## 9. This environment

- **`muaytix.com` is blocked** by the network policy. You cannot check a link,
  read the live site, or confirm anything is live. Say so rather than guessing.
- **`static.tildacdn.com` is blocked**, so images never load in renders. Grey
  boxes in a screenshot are photos, not bugs. Say that when sending one.
- **Google Fonts is blocked**, so renders do not show Barlow. Layout and spacing
  are accurate; letterforms are not.
- Chromium is at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`. Playwright
  is at `/opt/node22/lib/node_modules/playwright` and is CommonJS, so
  `import pw from '...'; const { chromium } = pw;`.
- **The Supabase migration tool cancels any migration containing `drop`** (for
  example `drop trigger if exists`), as a destructive statement. It looks like
  a failed approval click and is not: it cost three attempts on 7 October 2026.
  Leave the `drop` out when the thing is new, or send the migration in small
  pieces, which also shows which line is the cause. The plain query tool is not
  an alternative route to reach for before finding the cause.
- **`jlwopomkqeawrxlapwpc.supabase.co` is also blocked from the shell**, so a
  deployed edge function cannot be called from here. Prove the logic with the
  tests (which run the real decision code against a fake database) and by
  running the same queries through the database tool.
- Screenshots above roughly 0.5 MB fail to upload. Split tall pages in half or
  send JPEG.

---

## 10. Working method

**Look at it. Do not just measure it.**

Numeric checks pass while a page is visibly broken. A white-on-white hero, a
photo rendered three times too tall and a yellow label on white all passed every
count and were only caught by rendering the page and reading it back. Do both,
in that order of trust: render, look, then verify with numbers.

Before handing anything over:

- Render it at 1440, 1280, 860, 620 and 390px. Zero horizontal overflow.
- Read the text back out of the DOM, not out of your own source.
- Check contrast on every piece of text, not just the ones you changed.
- Grep the output file for the banned list in section 2.
- For anything time-dependent, freeze the clock and test either side of the
  boundary.

## 11. Git

- Branch: **`claude/new-agent-text-project-jyrrly`**. Never push anywhere else
  without being asked.
- No pull requests unless he explicitly asks for one.
- Commit messages explain **why**, especially for a bug: what was wrong, what a
  guest saw, and how it is prevented from returning.
- Never commit secrets. Never use live Stripe credentials.

---

## 12. Notes worth reading

`agent-tix/notes/stadium-availability-feed.md` is **the biggest problem in the
business** (real-time stadium availability) and what it costs: read it before
suggesting anything about VIP, group sizes or timed closings.

`agent-tix/notes/` holds older working notes. **`current-state.md` describes the
previous system** (the `muaytix-stripe-elements` project and nine edge functions)
and is historical, not current. The current system is section 6 above.

---

## 13. Facts Jason has stated. Never ask him these again.

Recorded on 3 October 2026, in his words. They are facts about the business and
the stadium, not copy. They can be used on any page.

- **The stadium is air-conditioned.** It is a modern arena in the middle of
  Bangkok, the hottest place on earth across a year.
- **Instant confirmation.** The minute a guest pays, they get instant
  confirmation of their payment and their booking.
- **Pre-booked, guaranteed tickets.** MuayTix secures its allocation in advance
  of a sell-out, for last-minute bookings. That is why an event can show sold
  out at the stadium while MuayTix still has tickets. The tickets it holds are
  guaranteed, pre-booked and waiting to go.
- **Face value.** No markups and no booking fees.
- **Every RWS card has seven bouts.** Do not ask how many fights there are, and
  do not name or count fights on an event page unless he asks for it. Guests do
  not book on the number or order of the fights, and the fight card lives on its
  own page.
- **First bell is 7:10 pm for RWS, doors 6:00 pm, finishing around 10:00 pm.**
- **"Official" and "limited".** Banned in section 2, but on 3 October 2026 he
  said to leave both in the RWS Knocktoberfest page copy because no advertising
  (Google, Facebook) is running at the moment. If ads start again, ask first.
- **"Best available seats are allocated in your chosen section at the time of
  booking."** Said on 4 October 2026: it hurts conversion. Removed from the
  Knockout schedule page. Do not put it on any page, in any form, unless he
  authorises it for that page. It came from copy he supplied in a brief, so if a
  brief contains it again, say so in one sentence and ask before building it in.
- **Seat class card copy, decided 5 October 2026.** Do not flag these again:
  - **"General admission" stays on Third Class.** It is deliberate. Third Class
    has an image problem because of its name, and "general admission" is what
    Wimbledon and the rest of the world call a ticket like it.
  - **"Assigned seating" stays on the Club Class and Ringside cards.** A guest
    may ask which seat they get. He will deal with that in a later widget
    update, not in the copy.
  - **"Opens when the other classes are close to full" stays on Third Class.**
    Guests may know that. What must never be shown is a ticket count above four
    left, because that tells competitors how many tickets are being sold. That
    is the only reason stock is hidden. Telling guests a class is nearly full is
    not the same thing and is allowed.
  - **"About 55% of MuayTix guests book Club Class."** His own wording for the
    same fact as "55 per cent of bookings". Use either.
- **How MuayTix seats guests, and the headline planned around it. Said by Jason
  on 5 October 2026. A plan, not yet authorised for any page.**
  - **Seat selection by the guest has been tried and went badly.** Some guests
    never answer the email or the WhatsApp, which leaves the booking stuck, and
    some do not want to choose at all. It is not offered now.
  - **Guests choose badly from a seat map.** Row A is shut because it is level
    with the ring. B is the first row they can see, so the first guest books it
    (the pop concert habit of sitting at the front), the next books beside
    them, and the rows fill in a line. Rajadamnern is the inverse of that habit:
    the company's view is that **row D and above is the best viewing level.**
    Nine in ten guests who have not been before end up in seats that are fine
    but not the best. The stadium gives no help beyond a seat map.
  - **What MuayTix does instead.** The team books the best seats available at the
    time of booking, using local knowledge, because they are in the stadium every
    week. They do not take the next free seat in row B: they go straight to row D
    and above, and leave B and C untouched even when they are free (December
    bookings are an example).
  - **The planned headline:** a guarantee that the team books the guest the best
    seats available at the time of booking. It is meant as one big message, not a
    line slotted into every part of the widget. Until he authorises it for a
    page, the standing rule above still holds: do not put any version of it on a
    page, and if a brief contains it, say so in one sentence and ask first.
    He confirmed the same day that it is **not to go into any copy for now**: it
    is a separate piece of work, one of the company's pillars, meant to go out as
    a headline (hero, social media) and not be written into a widget. A possible
    later home he named is an explanatory image in a class's photo slider, which
    already takes any image, so that needs no build.
- **How stock is bought, and why a sold-out night is not lost sales. Said by
  Jason on 5 October 2026.**
  - **RWS tickets are all pre-bought**, in all four classes, forecast from past
    performance and the season. RWS sells out at the stadium about two weeks
    before the night, so the tickets for 5 October were bought around 20
    September. Stadium sell-out timing: Club Class about two weeks before, Ringside
    about 10 days, LEO about a week. Third Class is bought in the week of the
    event.
  - **MuayTix is the pressure valve when the stadium has nothing.** Buying too
    many is a real write-off: it has written off 1,000 and 1,800 pounds of
    tickets before. So pre-buying is deliberately cautious, and **selling out
    early is the goal, not a problem.**
  - **Guests who arrive for a sold-out RWS night and cannot buy are expected and
    accepted.** MuayTix will not buy more to serve them: it risks the stadium's
    goodwill and defeats the plan. **Never present RWS sold-out looks as lost
    demand to act on, and never suggest buying more RWS tickets.**
  - **The business aim is to sell more on the other nights, not fewer on RWS.**
    RWS sales are at a level he is comfortable with and must not be cut. The
    Saturday share (68 to 71 per cent of sales, 63.7 per cent of tickets in the
    28 days to 5 October) should fall on its own as the other nights grow. So
    the number to watch is **tickets sold for non-RWS nights**, not the Saturday
    share, and never frame a report as reducing RWS.
  - Note: section 6 says Ringside is not held. That is true for the ordinary
    nights. For RWS, Jason says all classes including Ringside are pre-bought.
- **RWS ticket numbers: the mistake of 6 October 2026, and the rule it made.**
  Jason: "The numbers we give you of tickets on RWS days are factual numbers of
  tickets. That's tickets in hand that we've pre-bought and that is it. Once
  they've sold, it goes to fully booked no matter what. You don't make mistakes
  on these ones ever." He checks them against the invoice, the Drive and the
  bookings, and has done every week for 51 weeks.
  - **What happened.** RWS Saturday 10 October, LEO Section: he told me in this
    chat at 6:07 am Bangkok on 5 October that there were **10 LEO tickets**. The
    database held 25. I had just read that night's statuses and did not compare
    the count with what he had said. All 10 were sold by 3:36 am on 6 October.
    At 11:32 am a 3-ticket order was taken for tickets that did not exist. Three
    guests had to be moved to another class, and Jason had to ask the stadium
    for more tickets four days before the biggest night of the year.
  - **What it cost.** The operation stopped while the stadium was asked for 3
    more LEO tickets. The stadium could not release any for Saturday, so the
    three guests, already on their way from London, had to be told their LEO
    tickets could not be honoured and be moved to Third Class. (Jason, 6 October
    2026. A commission of about 900 Thai baht would have been paid had the
    stadium helped.)
  - **What I could not establish:** who entered 25, or when. The database keeps
    no history of ticket counts, and I could not see the earlier chat where he
    says he gave the number. That is no defence: the count was mine to check.
  - **What it means.** The three rules in section 6 apply to every RWS night,
    every time. Show counts, check them against what he has said, write each
    number into `agent-tix/notes/rws-allocations.md`, and never trust 25 / 40 /
    25. He has told me he does not trust me with the numbers now: earn it back
    by never being the reason one is wrong.
  - **Standing instruction, 6 October 2026:** every RWS seat class for 17, 24
    and 31 October is closed (`fully_booked`) until he gives real counts and
    asks for it to be reopened. Third Class on Saturday 10 October stays open.
