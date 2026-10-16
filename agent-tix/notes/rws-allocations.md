# RWS allocations: tickets in hand

**The only record of the real RWS numbers.** Jason's numbers are tickets
physically in hand: pre-bought and checked against the invoice, the Drive and the
bookings. They go into `event_ticket_classes.total_quantity` exactly as given.
Once sold, the class is fully booked, no matter what.

**Add a line here in the same minute he gives a number, before saying it is
done.** A line: date told, night, class, number, who told me, and what the
database was set to afterwards. If the database and this file disagree, this
file is right and the database is wrong, until Jason says otherwise.

25 / 40 / 25 (Ringside / Club Class / LEO) on a night is a **placeholder**, not
stock.

## Record

| Told | Night | Class | Tickets in hand | Source | Database set to |
|---|---|---|---|---|---|
| 4 to 5 Oct 2026 (in chat, 6:07 am Bangkok 5 Oct; Jason says he also gave it the week before) | Sat 10 Oct | LEO Section | **10** | Jason | Not yet. Database held 25. It cannot be lowered while it records 13 sold. Set to 10 once the 3 guests are moved. |
| Not on record | Sat 10 Oct | Ringside | Database says 9. Not confirmed by Jason on 6 Oct. | Unknown | 9 |
| Not on record | Sat 10 Oct | Club Class | Database says 40. Not confirmed by Jason on 6 Oct. | Unknown | 40 |
| Not on record | 17, 24, 31 Oct | all classes | Not given. Placeholders (25 / 40 / 25) in the database. | none | All classes closed on 6 Oct at Jason's instruction. Reopen only with real counts. |
| 9 Oct 2026, 3:2x am Bangkok (in chat; confirmed Third Class in a follow-up message) | Sat 10 Oct | Third Class | **6 left to sell** (stadium sold out, no more coming). 11 already sold, so 17 in hand in total. | Jason | total_quantity set to **17** (was 50). Read back: 17 total, 11 sold, 0 reserved, 6 left, Available. |
| 9 Oct 2026, about 5 am Bangkok (in chat) | Sat 10 Oct | Ringside | **3 left, all solo seats** (matches 9 in hand, 6 sold). Jason first asked for them back on sale with max 1 together, then changed his mind: hold them OFF sale overnight while he offers upgrades to the single-seat guests. | Jason | total_quantity stays **9**. Class left **fully booked**, max seats together empty. (Briefly reopened for about a minute by mistake and put back; no checkout was made in that time.) |
| 9 Oct 2026, about 5:40 pm Bangkok (in chat) | Sat 10 Oct | Club Class | **4 seats together** back on sale. Read as 4 left to sell (database had said 40 total, 7 left, which is the placeholder). Jason did not state the total. | Jason | total_quantity set to **37** (33 sold + 4). Reopened (manual status cleared). Read back: 37 total, 33 sold, 4 left, shows "limited" (guests see "4 left"). Max seats together left empty. If the true figure is not 4 left, correct it. |
| 9 Oct 2026, evening Bangkok (in chat) | Sat 10 Oct | Club Class | **1 seat available** (3 of the 4 had sold since the last change; sold was 36). | Jason | total_quantity set to **37** (36 sold + 1). Read back: 37 total, 36 sold, 1 left. |
| 9 Oct 2026, evening Bangkok (in chat) | Sat 10 Oct | Ringside | **1 seat on sale** (of the 3 solo seats held off sale since the morning). | Jason | total_quantity set to **7** (6 sold + 1; was 9). Reopened. Read back: 7 total, 6 sold, 1 left. The other 2 solo seats are still held, not in the total. Max seats together left empty (one seat). |
| 10 Oct 2026 (in chat) | Sat 10 Oct | Club Class | **1 seat on sale.** Database matched the record: 37 total, 37 sold. | Jason | total_quantity set to **38** (37 sold + 1). Manual status clear. Read back: 38 total, 37 sold, 1 left, shows "limited" (guests see "1 left"). |
| 10 Oct 2026 (in chat) | Sat 10 Oct | Ringside | **1 seat on sale.** Database matched the record: 7 total, 7 sold. | Jason | total_quantity set to **8** (7 sold + 1). Manual status clear. Read back: 8 total, 7 sold, 0 reserved, 1 left. Max seats together left empty (one seat). |
| 11 Oct 2026 (in chat) | Sat 17 Oct | all four classes | **Tickets in hand, actual counts:** Ringside **0**, Club Class **1**, LEO Section **30**, Third Class **50**. Database had held the 25 / 40 / 25 placeholders, closed since 6 Oct, nothing sold. | Jason | total_quantity set to 0 / 1 / 30 / 50. Manual closure cleared. Third Class released (opened). Read back: Ringside 0/0/0 fully booked, Club Class 1/0/1, LEO 30/0/30, Third Class 50/0/50 available. |
| 11 Oct 2026 (in chat) | Sat 24 Oct and Sat 31 Oct | Ringside, Club Class, LEO | **Not counted stock.** Jason: "you can set 24 and 31 October and beyond at 25 tickets" for Ringside, Club Class and LEO. Third Class left unopened. Sold before the change: 24 Oct Ringside 2, Club 4; 31 Oct Club 7, LEO 2. | Jason | total_quantity set to 25 / 25 / 25. Manual closures cleared (the 6 Oct standing instruction is lifted for these two nights). Third Class stays not released, manual closure cleared, total left at 50. Read back: 24 Oct Ringside 23 left, Club 21, LEO 25; 31 Oct Ringside 25, Club 18, LEO 23. **A working number, to be replaced when he gives the real counts.** |
| 11 Oct 2026 (in chat) | Sat 7 Nov to Sat 19 Dec (7 nights) | Club Class | **Not counted stock.** "and beyond": 25 for Ringside, Club Class and LEO, Third Class unopened. Club Class was 40, Ringside and LEO already 25, Third Class already unreleased. | Jason | Club Class total_quantity 40 to 25 on all seven nights (most sold: 5 on 5 Dec). These nights were already open for sale before today. Read back all four classes on every night. **A working number, to be replaced when he gives the real counts.** |
| 14 Oct 2026, night Bangkok (in chat) | Sat 17 Oct | Ringside (and LEO confirmed) | **Ringside: 4 tickets in hand.** Database held 0 (his 11 Oct count), 0 sold. **LEO: Jason confirmed 15 sold of 30 is correct.** | Jason | Ringside total_quantity set to **4**, maximum_seats_together **2**, manual status clear. Read back: Ringside 4 total, 0 sold, 4 left, shows "limited" (guests see "4 left"), widget max 2. Club Class 1/0/1, LEO 30/15/15, Third Class 50/0/50 (already open) unchanged. |
| 14 Oct 2026, night Bangkok (in chat) | Sat 17 Oct | Club Class | **Jason holds 3 Club Class tickets in total, and puts one on sale at a time.** The 11 Oct count of 1 was the one on sale, not the whole stock. When it sells he puts the next on, then the last. | Jason | **No database change.** total_quantity stays **1** (the one on sale now, 0 sold). Next one goes on only when he says: set total_quantity to sold plus 1. 2 tickets are in hand and off sale. |
| 14 Oct 2026, night Bangkok (in chat) | Sat 17 Oct | Third Class | **Pre-buying 10 Third Class tickets for Saturday** (none bought before this; **purchase confirmed by Jason later the same night, 10 now in hand on standby**). More to be pre-bought the next day (15 Oct). Database held 50, 0 sold. | Jason | total_quantity set to **10**, manual status clear, still released. Read back: Third Class 10 total, 0 sold, 10 left. **To be raised only when he gives the next number.** |
| 16 Oct 2026, 1:52 am Bangkok (in chat) | Sat 17 Oct | Club Class | **Second Club Class ticket put on sale** (of Jason's 3 in hand, one at a time). The first sold: database 1 total, 1 sold. | Jason | total_quantity set to **2** (1 sold + 1). Manual status clear. Read back: 2 total, 1 sold, 1 left. 1 ticket still in hand and off sale. |
| 16 Oct 2026, late morning Bangkok (in chat) | Sat 24 Oct | Club Class, Ringside | **Club Class closed fully booked** (6 sold of the 25 working number, total left alone). **Ringside cut to 2 for sale.** Still working numbers, not counted stock. | Jason | Club Class manual status fully_booked (25 total, 6 sold). Ringside total_quantity set to **4** (2 sold + 2 on sale), manual status clear. Read back: Ringside 4 total, 2 sold, 2 left, Club Class shows fully booked. LEO 25/0, Third Class unreleased unchanged. |
| 16 Oct 2026, 7:23 pm Bangkok (in chat) | Sat 17 Oct | Club Class | **Last of Jason's 3 Club Class tickets put on sale.** The second sold (database 2 total, 2 sold, 0 left). All 3 in hand are now on sale. | Jason | total_quantity set to **3** (2 sold + 1). Manual status clear. Read back: 3 total, 2 sold, 1 left. |
| 17 Oct 2026, 1:45 am Bangkok (in chat) | Sat 17 Oct | Third Class | **10 more Third Class tickets bought: 20 in hand in total.** Database held 10, 5 sold. | Jason | total_quantity set to **20**. Manual status clear. Read back: Third Class 20 total, 5 sold, 15 left. Whole night: Ringside 4/4, Club Class 3/2, LEO 30/21, Third Class 20/5. |
| 17 Oct 2026, daytime Bangkok (in chat) | Sat 17 Oct | all four classes | **Live counts confirmed by Jason:** Third Class **15** left, LEO Section **9** left, Ringside and Club Class fully booked. | Jason | **No database change needed.** Read back and matched: Ringside 4 total, 4 sold, 0 left; Club Class 3 total, 3 sold, 0 left; LEO 30 total, 21 sold, 9 left; Third Class 20 total, 5 sold, 15 left. |

## What went wrong on 6 October 2026

LEO Saturday 10 Oct showed 25 in the database when 10 were in hand. All 10 were
sold by 3:36 am. At 11:32 am a 3-ticket order was taken for tickets that did not
exist, and three guests had to be moved. See `CLAUDE.md` section 13.

**The cost, as Jason told me on 6 October 2026:** the whole operation stops while
the stadium decides whether to release 3 more LEO tickets. If they do, MuayTix
pays the person who helps about **900 Thai baht** in commission, under the
standing arrangement that rewards whoever helps the stadium out. His words: a
hole that did not need to be dug, because the exact number had been given.

**Outcome, as Jason told me on 6 October 2026:** the stadium could not release
more LEO tickets for Saturday 10 October. Only Third Class is available, so no
commission is paid. The three guests (3 LEO, paid 11:32 am, on their way from
London) have to be told their tickets cannot be honoured and moved to Third
Class. They chose LEO from the photos and selling lines. Their booking in the
database is still LEO until Jason says it is moved.
