-- Tickets sold per event per week, and each event's share of that week.
--
-- Jason, 5 October 2026. The goal is more sales on the non-RWS nights, with RWS
-- left alone (RWS is pre-bought and sells out by itself). So the number to
-- watch is how many tickets each event sold in the week and what share of the
-- week's tickets that is. Events are rolled up: Rajadamnern Knockout is one
-- line for Monday, Tuesday and Friday together. His expectation, and the test
-- of the report: Knockout has three nights to RWS's one, so it should sell
-- about double.
--
-- "In the week" means the week the booking was PAID (Monday to Sunday, Bangkok
-- time), whatever night the guest is going on. Same basis as contribution_by_day
-- and weekly_pay. Paid and not refunded only.
--
-- Every event appears in every week, with 0 when it sold nothing, so a quiet
-- week is a visible 0 and not a missing row.
--
-- Same rules as every other report here (0026): security_invoker, and no access
-- for the public keys.

create or replace view tickets_by_event_by_week
with (security_invoker = true) as
with weeks as (
  select generate_series(
           date '2026-08-31',
           date_trunc('week', now() at time zone 'Asia/Bangkok')::date,
           interval '7 days')::date as week_from
),
series(sort, key, event) as (
  values (1, 'rajadamnern_knockout', 'Rajadamnern Knockout'),
         (2, 'new_power',            'New Power'),
         (3, 'petchyindee',          'Petchyindee'),
         (4, 'rws',                  'RWS'),
         (5, 'kiatpetch',            'Kiatpetch'),
         (6, 'all_star_buakaw',      'All Star Fight')
),
sold as (
  select date_trunc('week', r.completed_at at time zone 'Asia/Bangkok')::date as week_from,
         regexp_replace(e.event_key, '_[0-9]{4}_[0-9]{2}_[0-9]{2}$', '')     as key,
         sum(r.quantity)                                                      as tickets,
         count(*)                                                             as bookings
  from checkout_reservations r
  join event_ticket_classes etc on etc.id = r.event_ticket_class_id
  join events e                 on e.id   = etc.event_id
  where r.completed_at is not null
    and r.refunded_at is null
  group by 1, 2
)
select w.week_from,
       s.event,
       coalesce(x.tickets, 0)   as tickets,
       coalesce(x.bookings, 0)  as bookings,
       round(100.0 * coalesce(x.tickets, 0)
             / nullif(sum(coalesce(x.tickets, 0)) over (partition by w.week_from), 0), 1) as share_pct
from weeks w
cross join series s
left join sold x on x.week_from = w.week_from and x.key = s.key
order by w.week_from, s.sort;

comment on view tickets_by_event_by_week is
  'Per Monday-to-Sunday week (Bangkok, by when it was paid): tickets and bookings '
  'for each event, and that event''s percentage share of the week''s tickets. '
  'Events are rolled up across their nights.';

revoke all on tickets_by_event_by_week from anon, authenticated;
