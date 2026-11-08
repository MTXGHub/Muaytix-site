-- RWS Rajadamnern 81 Anniversary, Sat 26 Dec 2026 (Jason, 8 November 2026).
-- The stadium announced an extra night with its own prices. 26 Dec was not in the database
-- before (0010 skipped Boxing Day as a no-fight night).
--
-- APPLIED to agent-tix-build on 8 November 2026 as a HIDDEN night: publication_status 'draft',
-- every class 'fully_booked' with total 0, so nothing can be sold and guests cannot see it.
-- Start 19:10 (as every RWS night, poster says 7.10 PM; the stadium page says 19:00), end 22:00.
--
-- Prices are per night, so they use event_ticket_price_overrides (first use of that table).
-- THB only so far (stadium prices): Ringside 3,800, Club Class 2,500, LEO 1,800, Third Class 1,500.
-- The other five currencies (usd, eur, gbp, aud, cny) STILL SHOW THE ORDINARY CLASS PRICES, which would
-- undercharge. Do not publish until every currency has an override. Club Class 2,500, LEO 1,800 and
-- Third Class 1,500 equal the ordinary Ringside, Club and LEO prices, so those can reuse them.
--
-- Go-live (not done): override prices in all currencies, real stock per class (Jason's counts,
-- total = sold + his number), release_status/manual_status as he says, publication_status 'published'.
-- Nothing below uses a drop statement.

with src as (select tenant_id, series_id, venue_id from events where event_key='rws_2026_12_19'),
ev as (
  insert into events (tenant_id, series_id, venue_id, event_key, name, starts_at, ends_at, publication_status, booking_cutoff_minutes, fallback_offer_enabled)
  select tenant_id, series_id, venue_id, 'rws_2026_12_26', 'RWS Rajadamnern 81 Anniversary',
         timestamp '2026-12-26 19:10' at time zone 'Asia/Bangkok', timestamp '2026-12-26 22:00' at time zone 'Asia/Bangkok',
         'draft', 30, false from src
  returning id, tenant_id
),
cls as (
  insert into event_ticket_classes (tenant_id, event_id, ticket_class_id, total_quantity, release_status, manual_status, display_order, max_per_order, limited_threshold)
  select ev.tenant_id, ev.id, tc.id, 0, 'released', 'fully_booked', t.ord, 10, 19
  from ev join (values ('ringside',1),('club_class',2),('leo_section',3),('third_class',4)) t(code,ord) on true
  join ticket_classes tc on tc.code=t.code and tc.tenant_id=ev.tenant_id
  returning id, ticket_class_id
)
insert into event_ticket_price_overrides (event_ticket_class_id, currency, unit_amount, note)
select cls.id, 'thb', case tc.code when 'ringside' then 380000 when 'club_class' then 250000 when 'leo_section' then 180000 when 'third_class' then 150000 end, 'R81 Anniversary, 26 Dec 2026 (stadium prices, Jason 8 Nov 2026)'
from cls join ticket_classes tc on tc.id=cls.ticket_class_id;
