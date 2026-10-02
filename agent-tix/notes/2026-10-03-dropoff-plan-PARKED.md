# Drop-off plan: PARKED

Status: parked on 3 October 2026 at Jason's request, so that pages can be built first.
Nothing in this plan has been started. It is saved exactly as agreed in conversation so it
can be picked up again in the same form. Read this file first when he says "back to the plan".

Source of everything below: our own checkout records (Supabase `checkout_reservations`) and
Jason's reasoning, given row by row. His theories are theories, not findings.

---

## 1. Where the numbers stood (3 October 2026)

Checkout to booking, meaning "pressed Book" to "paid".

| | Last 7 days | Last 4 weeks |
|---|---|---|
| Sessions started | 76 | 361 |
| Paid | 39 | 182 |
| Unpaid | 37 | 179 |
| Unpaid, but a matching booking followed (retries) | 13 | 52 |
| Lost | 24 | 127 |

- Counting every session: 51.3% (7 days), 50.4% (4 weeks).
- Taking out the retries: 62% (7 days, 39 of 63), 59% (4 weeks, 182 of 309).
- True figure is a range, 51% to 62%. If one number is wanted: "about 60%".
- Retry rule used: an unpaid session counts as a retry if someone paid for the same night and
  seat class, with the same number of tickets, within 6 hours afterwards. It is a model. We
  cannot tell who was the same person.
- Lost sessions, last 7 days: 63 tickets, about 37,100 THB margin, about 116,300 THB at list
  price. Paid sessions earned about 42,125 THB margin. The lost margin is a ceiling, since not
  every lost session would ever have paid (47% of the total, or about 88% of what was earned).
- Four lost sessions (LEO x8, Ringside x6, AUD Club x5 twice) hold about 19 of the 63 tickets.
- Stripe's own funnel report undercounts the most recent days. Our records agree with Stripe's
  session list (74 vs 73 sessions, 38 vs 37 paid over 7 days). The older three weeks match
  Stripe's report exactly. Do not read the report's 42.2% as a real dip.

Other facts found while checking:
- Paying is quick: median 1.4 minutes, 87% pay within 5 minutes.
- Unpaid sessions have no name, 3 have an email, none has a payment record on our side, so
  "tried and declined" cannot be told apart from "never tried" from our database.
- Device is only recorded for 13 sessions (Google Ads clicks, 19 to 20 Sep). The widget change
  that records phone, tablet or computer on every booking is built but only works once the
  header block is pasted into Tilda again.
- Country is the card's issuing country, known for about a third of paid sessions.
- Over the 4 weeks: Third Class 78% paid, Club Class 51%, LEO 41%, Ringside 40%. Two tickets
  55%, one ticket 45%. Booking 8 or more days ahead 36% paid, versus 51% to 58% within a week.

---

## 2. Jason's reasons for drop-off (his words, in his order, "not in any order")

1. Our pages are not good enough: something the guest does not like (design, something
   missing, the way it is written).
2. Our social media is poor.
3. Our lack of reviews.
4. They are looking for a different Muay Thai stadium.
5. They are looking for a certain Muay Thai brand, for example ONE Championship at Lumpini.
   Many US guests land on the site through a "Muay Thai Bangkok" search and drop off.
6. Not much about us online. We are less than a year old.
7. Non-refundable tickets. A refund-protection add-on (an extra payment for full refund
   rights) is to be trialled later in the widget. Jason will send details.

---

## 3. His row-by-row theories on the last 7 days (grouped)

1. Price looks higher than the converted list price ("extra by stealth"): $31 Third Class
   (now $30); $46 LEO against $44.66 today; $77 Ringside against about $74.44; $110 Club
   Class x2 against about 3,694 baht (about 100 baht over); EUR 80 LEO is 3,023 baht against
   3,000. Some prices already adjusted.
2. Seats-not-together warning: Ringside for 3 Oct was all single seats. 3 tickets on 27 Sep,
   2 tickets on 30 Sep.
3. No refund protection on far-out bookings: 19 Dec x4 (EUR 192), 10 Oct x2, 14 Oct x2,
   5 Dec x3, 14 Nov x2. World uncertainty makes guests hold off.
4. Trust: "why do we have tickets and the stadium does not?" and "are we a scam?". Third Class
   on the RWS night, LEO x2 for 3 Oct, Ringside x1, the 10 Oct night (sold out at the
   stadium last week, we hold about 30 Club Class). The reverse case also: the stadium has
   none and we show one ticket.
5. Wanting to choose their seats: Ringside x6 for 21 Dec ($648, 80 days out), Ringside x2
   for 12 Oct.
6. No group discount: LEO x8 on 27 Sep. Only 2 LEO had sold by then and the total is 10, so
   8 was exactly the whole remaining stock (if the total was 10 then).
7. Same person trying again: AUD Club x5 for two dates, the 30 Sep Club Class run, the CNY
   pairs.
8. Chinese guests during Golden Week: CNY LEO and Club Class, some converted under another
   name, some possible payment problems.
9. Other: the 10 Oct standalone page is not up yet. The 28 Sep Third Class and both 2 Oct Third
   Class sessions are unexplained.

Checks run on his flagged items:
- CNY LEO on 29 Sep: both unpaid sessions were followed by paid CNY LEO bookings (14:11 x2 for
  3 Oct, 19:11 x1 for 4 Oct). 2 Oct 00:34 CNY x3 was followed by a paid CNY x3 at 00:41.
- AUD Club x5: no paid match anywhere.
- Club Class x2 around 30 Sep: paid at 22:45 (THB x2, 10 Oct) and 22:54 (USD x1, 3 Oct).
- LEO x8: see item 6 above.

---

## 4. The plan (as given, in order)

1. **Prices against the converted list price (cheap, likely quick win).** Your figures show we
   were 0.8% to 3.4% over the converted price in several currencies. Set prices to the current
   rate and review on a regular schedule. Build a check that flags any currency more than 1%
   off the rate. *Jason decides:* the rate source and the rule.
2. **Seats-together warning on Ringside (RWS, 3 Oct).** Two sessions hit it. *Jason decides:*
   whether to show it before they pick, cap groups at what is seatable together, or leave it.
3. **Trust.** Covers "why does the stadium show none?", "are you legit?" and the young
   company. Three parts: a short explanation on RWS and dated pages; a reviews push after each
   night; a "who we are" block near the widget. Jason writes the words, Claude builds it.
4. **Refund protection trial.** 13 of 37 sessions were booked 8 or more days ahead, including
   the EUR 192 and $648 orders. Trial it first on far-out nights only, once Jason sends the
   details.
5. **Policy decisions:** group pricing for big orders (the LEO x8) and seat choice for large
   Ringside orders (the x6).
6. **Measuring better:** the device record (live once the header is pasted); a weekly unpaid
   table with a "paid afterwards" column so retries stop counting as losses; a read-only check
   of Stripe for declined attempts, especially CNY, Alipay and WeChat; recording seats left at
   the moment someone presses Book.
7. **Not our data:** other stadiums and ONE Championship searches. Can check which searches
   bring US guests in Search Console if wanted.
8. **Page quality (reason 1).** Last, and only with the reference-first and phone-check way of
   working: ask which existing page or graphic it should look like, show a phone picture and
   a desktop picture for approval before the code is finished, and keep a written list of his
   standing rules (no brown, one border colour, a prominent Fully booked state) checked on
   every page.

Decisions needed from Jason: the rate source and rule, the seats-together approach, the trust
copy, the refund protection details, and the group policy.

---

## 5. The 37 unpaid sessions in the last 7 days (to 2 Oct, Bangkok time)

Revenue is in the currency the guest chose. Margin is in THB, from the per-ticket margins on
each seat class. The last row was added after the first table was sent.

| Pressed Book | Night | Lead days | Seat class | Tickets | Currency | Revenue | Margin (THB) |
|---|---|---|---|---|---|---|---|
| 26 Sep 14:40 | 26 Sep | 0 | Third Class | 1 | USD | 31.00 | 250 |
| 26 Sep 16:48 | 26 Sep | 0 | Third Class | 1 | THB | 1,000.00 | 250 |
| 27 Sep 11:05 | 10 Oct | 13 | Club Class | 4 | USD | 220.00 | 2,400 |
| 27 Sep 12:11 | 3 Oct | 6 | Ringside | 3 | USD | 231.00 | 1,875 |
| 27 Sep 12:19 | 3 Oct | 6 | LEO Section | 8 | USD | 368.00 | 4,800 |
| 28 Sep 03:26 | 3 Oct | 5 | LEO Section | 2 | EUR | 80.00 | 1,200 |
| 28 Sep 03:27 | 19 Dec | 82 | Club Class | 4 | EUR | 192.00 | 2,400 |
| 28 Sep 04:18 | 10 Oct | 12 | Club Class | 2 | USD | 110.00 | 1,200 |
| 28 Sep 12:28 | 28 Sep | 0 | Third Class | 1 | THB | 1,000.00 | 250 |
| 29 Sep 06:59 | 14 Oct | 15 | Club Class | 2 | THB | 3,600.00 | 1,200 |
| 29 Sep 13:58 | 3 Oct | 4 | LEO Section | 2 | CNY | 620.00 | 1,200 |
| 29 Sep 19:02 | 4 Oct | 5 | LEO Section | 1 | CNY | 310.00 | 600 |
| 29 Sep 19:05 | 4 Oct | 5 | LEO Section | 1 | CNY | 310.00 | 600 |
| 30 Sep 00:36 | 3 Oct | 3 | LEO Section | 1 | USD | 46.00 | 600 |
| 30 Sep 01:30 | 3 Oct | 3 | Ringside | 2 | EUR | 134.00 | 1,250 |
| 30 Sep 07:29 | 3 Oct | 3 | Club Class | 5 | AUD | 395.00 | 3,000 |
| 30 Sep 07:31 | 10 Oct | 10 | Club Class | 5 | AUD | 395.00 | 3,000 |
| 30 Sep 14:30 | 3 Oct | 3 | Ringside | 1 | USD | 77.00 | 625 |
| 30 Sep 15:06 | 3 Oct | 3 | Ringside | 1 | USD | 77.00 | 625 |
| 30 Sep 17:58 | 3 Oct | 3 | Ringside | 1 | USD | 77.00 | 625 |
| 30 Sep 21:08 | 10 Oct | 10 | Club Class | 2 | THB | 3,600.00 | 1,200 |
| 30 Sep 21:34 | 10 Oct | 10 | Club Class | 2 | USD | 110.00 | 1,200 |
| 30 Sep 22:43 | 10 Oct | 10 | Club Class | 2 | USD | 110.00 | 1,200 |
| 30 Sep 22:49 | 3 Oct | 3 | Club Class | 1 | THB | 1,800.00 | 600 |
| 30 Sep 22:49 | 10 Oct | 10 | Club Class | 2 | THB | 3,600.00 | 1,200 |
| 1 Oct 05:34 | 1 Oct | 0 | LEO Section | 1 | USD | 46.00 | 600 |
| 1 Oct 21:43 | 5 Dec | 65 | Club Class | 3 | EUR | 144.00 | 1,800 |
| 2 Oct 00:34 | 3 Oct | 1 | LEO Section | 3 | CNY | 900.00 | 1,800 |
| 2 Oct 04:15 | 21 Dec | 80 | Ringside | 6 | AUD | 648.00 | 3,750 |
| 2 Oct 06:03 | 14 Nov | 43 | LEO Section | 2 | EUR | 80.00 | 1,200 |
| 2 Oct 09:53 | 2 Oct | 0 | LEO Section | 1 | USD | 45.00 | 600 |
| 2 Oct 11:13 | 12 Oct | 10 | Ringside | 2 | THB | 5,000.00 | 1,250 |
| 2 Oct 14:09 | 6 Oct | 4 | Club Class | 2 | CNY | 720.00 | 1,200 |
| 2 Oct 14:10 | 6 Oct | 4 | Club Class | 2 | CNY | 720.00 | 1,200 |
| 2 Oct 20:19 | 3 Oct | 1 | Third Class | 2 | CNY | 400.00 | 500 |
| 2 Oct 20:21 | 3 Oct | 1 | Third Class | 2 | THB | 2,000.00 | 500 |
| 2 Oct 22:39 | 3 Oct | 1 | Third Class | 2 | CNY | 400.00 | 500 |

Margin across the first 36 rows: 47,150 THB.

Unpaid sessions with a later paid booking for the same night, seat class and number of
tickets within 6 hours (the retries, 13 in all): 29 Sep 13:58, 19:02, 19:05; 30 Sep 14:30,
15:06, 21:08, 21:34, 22:43, 22:49 (3 Oct, x1); 2 Oct 00:34, 20:19, 20:21, 22:39. The 22:39
match is a different currency and 52 minutes later, so it may be a different guest. The
30 Sep 17:58 Ringside session is not counted, because the matching paid session was created
at the same minute rather than after it.

---

## 6. When the plan is picked up

Start by confirming with Jason which items he wants first. Nothing here is live. Do not state
any item as done until it has been pasted into Tilda and read back.
