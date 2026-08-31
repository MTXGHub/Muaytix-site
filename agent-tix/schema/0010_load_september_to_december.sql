-- Agent Tix — the rest of the season: 8 September to 31 December 2026
--
-- APPLIED to agent-tix-build on 31 August 2026.
--
-- Nothing here is a list of dates. The nights are worked out from the
-- recurrence already held on event_series, so this same block would load 2027
-- by changing two dates at the top. Nothing needs doing in Stripe for any of
-- it: the checkout builds the line item at the moment a guest pays.
--
-- Stock, confirmed against what V1 holds for future nights:
--   Ringside      25 every night
--   Club Class    25 every night, 40 on RWS Saturdays
--   LEO Section   25 every night
--   Third Class   50 every night, closed until the stadium opens it
--
-- Third Class is stocked on every night rather than Saturdays only, which is
-- how V1 does it: the stock sits there and opening a night becomes a switch
-- rather than a data-entry job. All 29 Third Class rows in V1 are closed.
--
-- 26 December is skipped. Boxing Day, no fight.

begin;

with nights as (
  select d::date as night
  from generate_series(date '2026-09-08', date '2026-12-31', interval '1 day') g(d)
  where d::date <> date '2026-12-26'
),
resolved as (
  select n.night,
         case
           -- The last Monday of the month belongs to Buakaw, not Knockout.
           -- "Last" meaning another seven days would leave the month.
           when extract(isodow from n.night) = 1
            and n.night + 7 > (date_trunc('month', n.night) + interval '1 month')::date
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
   publication_status, booking_cutoff_minutes)
select
  t.id, s.id, v.id,
  replace(s.slug, '-', '_') || '_' || to_char(r.night, 'YYYY_MM_DD'),
  s.name,
  (r.night + s.default_start_time_local) at time zone v.timezone,
  (r.night + s.default_start_time_local
     + make_interval(mins => s.default_duration_minutes)) at time zone v.timezone,
  'published', 30
from resolved r
join public.tenants t on t.slug = 'muaytix'
join public.venues  v on v.tenant_id = t.id and v.slug = 'rajadamnern'
join public.event_series s on s.tenant_id = t.id and s.slug = r.slug
on conflict (tenant_id, event_key) do nothing;

-- Inventory for every published night from 1 September on. Existing rows are
-- left exactly as they are, so the nights already on sale keep their own
-- numbers — including 5 September, which the stadium has set by hand.
insert into public.event_ticket_classes
  (tenant_id, event_id, ticket_class_id, total_quantity,
   release_status, closed_explanation, display_order, max_per_order)
select
  e.tenant_id, e.id, tc.id,
  case
    when tc.code = 'third_class'                     then 50
    when tc.code = 'club_class' and s.slug = 'rws'   then 40
    else 25
  end,
  case when tc.code = 'third_class' then 'not_released' else 'released' end,
  case when tc.code = 'third_class' then
    'Third Class for this date is currently closed. Third Class is usually opened by the stadium once the other seat classes are full or close to full.'
  end,
  case tc.code
    when 'ringside'    then 1
    when 'club_class'  then 2
    when 'leo_section' then 3
    when 'third_class' then 4
  end,
  10
from public.events e
join public.event_series s on s.id = e.series_id
join public.ticket_classes tc on tc.tenant_id = e.tenant_id
where e.starts_at >= timestamptz '2026-09-01 00:00:00+07'
  and e.publication_status = 'published'
on conflict (event_id, ticket_class_id) do nothing;

commit;
