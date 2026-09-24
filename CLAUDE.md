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

### Also

- British English.
- No filler. If a line repeats the line above it, cut it.
- No made-up detail. If a fact is not supplied, leave it out and say so.
- Trade words are not guest words. "Assigned seating", "general admission",
  "dimmed nights" and "first dispatch" all failed for the same reason.
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

### Mounting it

```html
<div class="muaytix-ticket-selector"></div>                    full calendar
<div class="muaytix-ticket-selector" data-start="seats"></div> seat class first
<div class="muaytix-ticket-selector" data-event-id="rws_2026_09_26"></div>
```

### Rules the widget already follows

- It never prints the word "Limited". `available` and `limited` both render as
  **Available** in green. Only at 5 seats or fewer does a number replace it.
- Seat tiles show Available or Not currently on sale. They do **not** count
  nights.
- Class name, strapline and section line all come from `ticket_classes`, so
  changing that copy is a database edit, not a release.
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
| `ticket_classes` | name, code, `tagline`, `description`, `margin_minor` |
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
