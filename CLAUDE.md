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
header that worked ready to paste as a rollback (in git: `paste-into-tilda-header.html`
at commit `68443d0` is the last 58 KB one; `1b8b062` is the one that was live
on 5 October 2026).

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
  lines under them. **It only does that while the class can be bought**: sold
  out, closed or booking closed, the photos go and the compact tile returns.
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
- It never decides whether tickets are on sale. The database cutoff does.

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

Visits that never start a checkout are not recorded anywhere in the database.
`widget_looks_*` counts people who opened the booking widget, which is the
nearest thing to a visit count the reports hold.

### Routine trading jobs

Close a class: set `manual_status = 'fully_booked'`. Set a real allocation: set
`total_quantity`. Limit a group: set `maximum_seats_together`. Always read the
availability view back afterwards and show him the four classes.

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

