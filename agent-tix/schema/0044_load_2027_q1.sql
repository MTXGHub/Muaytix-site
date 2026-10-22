-- Agent Tix — the nights for 1 January to 31 March 2027
--
-- APPLIED to agent-tix-build on 22 October 2026 (90 nights, 360 class rows),
-- the same day the stadium's availability tracker started covering 2027.
--
-- Same method as 0010_load_september_to_december.sql: the nights are worked out
-- from the weekly pattern held on event_series, nothing is a list of dates.
-- Matched to how the December nights are actually set today, not to what 0010
-- first loaded:
--   Stock          25 Ringside, 25 Club Class, 25 LEO Section, 50 Third Class
--                  (RWS Club Class is 25 now, not 40). These are WORKING NUMBERS,
--                  not counted stock; replace the RWS ones when Jason gives real counts.
--   Third Class    not_released, with the standard closed explanation
--   max per order  10
--   Club Class offer when LEO is full: on for Knockout, New Power, Petchyindee and
--   Kiatpetch; off for RWS and All Star, on purpose
--
-- FIX to the rule in 0010: the last Monday of the month is All Star. 0010 tested
-- "night + 7 > first of next month", which misses a last Monday that is exactly
-- seven days before the 1st (25 January and 22 February 2027 were first loaded
-- as Knockout, then corrected before any class rows existed). The test below uses >=.
--
-- No night is skipped. 0010 skipped 26 December (Boxing Day, no fight); nothing is
-- known yet about 2027 closures. Any night with no fight must be removed by hand.

begin;

with nights as (
  select d::date as night
  from generate_series(date '2027-01-01', date '2027-03-31', interval '1 day') g(d)
),
resolved as (
  select n.night,
         case
           when extract(isodow from n.night) = 1
            and n.night + 7 >= (date_trunc('month', n.night) + interval '1 month')::date
             then 'all-star-buakaw'
           when extract(isodow from n.night) in (1,2,5) then 'rajadamnern-knockout'
           when extract(isodow from n.night) = 3 then 'new-power'
           when extract(isodow from n.night) = 4 then 'petchyindee'
           when extract(isodow from n.night) = 6 then 'rws'
           when extract(isodow from n.night) = 7 then 'kiatpetch'
         end as slug
  from nights n
)
insert into public.events
  (tenant_id, series_id, venue_id, event_key, name, starts_at, ends_at,
   publication_status, booking_cutoff_minutes, fallback_offer_enabled)
select
  t.id, s.id, v.id,
  replace(s.slug, '-', '_') || '_' || to_char(r.night, 'YYYY_MM_DD'),
  s.name,
  (r.night + s.default_start_time_local) at time zone v.timezone,
  (r.night + s.default_start_time_local
     + make_interval(mins => s.default_duration_minutes)) at time zone v.timezone,
  'published', 30,
  (s.slug not in ('rws', 'all-star-buakaw'))
from resolved r
join public.tenants t on t.slug = 'muaytix'
join public.venues  v on v.tenant_id = t.id and v.slug = 'rajadamnern'
join public.event_series s on s.tenant_id = t.id and s.slug = r.slug
on conflict (tenant_id, event_key) do nothing;

insert into public.event_ticket_classes
  (tenant_id, event_id, ticket_class_id, total_quantity,
   release_status, closed_explanation, display_order, max_per_order)
select
  e.tenant_id, e.id, tc.id,
  case when tc.code = 'third_class' then 50 else 25 end,
  case when tc.code = 'third_class' then 'not_released' else 'released' end,
  case when tc.code = 'third_class' then
    'Third Class is currently closed. The stadium opens it when the other seat classes are close to full. This does not happen every night.'
  end,
  case tc.code
    when 'ringside'    then 1
    when 'club_class'  then 2
    when 'leo_section' then 3
    when 'third_class' then 4
  end,
  10
from public.events e
join public.ticket_classes tc on tc.tenant_id = e.tenant_id
where e.starts_at >= timestamptz '2027-01-01 00:00:00+07'
  and e.publication_status = 'published'
on conflict (event_id, ticket_class_id) do nothing;

commit;
