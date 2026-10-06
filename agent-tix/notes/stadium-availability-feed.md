# The biggest problem: real-time stadium availability

Jason, 6 October 2026. **Availability is the biggest challenge in the business,
full stop.** MuayTix has no real-time view of what the stadium (Ticketmelon) has
left. He counts seats and pairs by eye, every half hour or so, and closes classes
on a timer as a guess ahead of the sell-out.

## What it costs

- **Selling a ticket MuayTix does not have** is the biggest pain point, for him
  and for the guest. The booking comes in, there is no seat, and that creates
  failure demand: refund, messages, other options, waiting for a reply.
- **On VIP it is worst.** VIP sections can have 8 or 15 seats and be booked out
  months ahead without MuayTix knowing. Example he gave: Presidential box, 44
  seats, 120 dates on sale, and the one booking that arrives is for the one date a
  group has already filled. Refunding a high-price booking that cannot be honoured
  also loses the Stripe processing charge, sometimes 10 to 12 pounds, and gives
  the guest a dreadful experience.
- **So VIP is not on sale, because the risk is too high without data.** With real
  availability data he would put VIP on sale without hesitation.
- His estimate: solving this could double the seats MuayTix sells.

## What he has done

- Asked a stadium representative on 6 October 2026 whether Ticketmelon has an
  **agent-only API** or feed. Waiting for the answer.
- He would like a feed every 15 minutes or faster for dates close in, slower for
  dates further out.

## If a feed exists, the rules I will follow

- The feed may only **close or lower** availability automatically. It may never
  open a class or raise a number. Opening and raising stay with Jason.
- RWS numbers still come from Jason (tickets in hand), never from a feed.
- It must respect Ticketmelon's terms and never hold or touch their inventory. The
  seat map starts a 3-minute hold timer when opened, so no scraping of it.
- Every automatic change is logged and shown to Jason.

## Where the pain really sits (Jason, 6 October 2026)

- **The big sections are not the problem beyond about 7 days out.** Ringside has
  about 200 seats, Club Class about 500 and LEO about 300, so for any date more than
  a week away MuayTix knows it can buy any of those three. Checking a few days out
  is easy by eye.
- **The small, exclusive classes are the problem.** Presidential box (he has said 44
  seats and also 15 seats; ask which when it matters) and suites with only 4 seats.
  One date out of 120 can already be full, and checking every date for every class
  by hand is not possible. That is why VIP stays off sale.
- A feed would run every published date and tell him which VIP class is sold out
  on which night, so only that part is closed and everything else stays open.

## What he has ruled out

- **Screenshot logging of seat maps: no.** Too manual at 15 to 60 minute intervals
  every day. Do not offer it again.
- Anything that reads the seat map in a way that holds or touches Ticketmelon's
  inventory.

## Possible low-tech fallback, to ask the stadium

Even a daily file or email from the stadium listing remaining seats per class per
date for the small classes would solve most of it. Not yet asked.
