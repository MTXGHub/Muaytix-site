-- Agent Tix — schema checks
--
-- Run against a scratch database with the STRUCTURE applied but no seed data:
-- 0001, 0002, 0003, 0005, 0006, 0007, 0009. Not 0004 (it seeds a tenant this
-- file creates for itself), not 0008 (pg_cron is Supabase-only), not 0010.
-- Every row printed
-- should read PASS. Exists because Design Brief Section 13 asks for tested,
-- fixed behaviour rather than assumed behaviour, and because the 20/19 split in
-- Section 5 is exactly the kind of off-by-one that reads correct and is not.

begin;

insert into public.tenants (id, slug, name, allowed_origins)
values ('11111111-1111-1111-1111-111111111111', 'muaytix', 'MuayTix',
        array['https://muaytix.com','https://www.muaytix.com']);

insert into public.venues (id, tenant_id, slug, name)
values ('22222222-2222-2222-2222-222222222222',
        '11111111-1111-1111-1111-111111111111', 'rajadamnern', 'Rajadamnern Stadium');

insert into public.ticket_classes (tenant_id, code, name, assigned_seating, display_order)
values
  ('11111111-1111-1111-1111-111111111111', 'ringside',    'Ringside',    true,  1),
  ('11111111-1111-1111-1111-111111111111', 'club_class',  'Club Class',  true,  2),
  ('11111111-1111-1111-1111-111111111111', 'leo_section', 'LEO Section', false, 3),
  ('11111111-1111-1111-1111-111111111111', 'third_class', 'Third Class', false, 4);

-- A future event (well before cutoff) and an imminent one (past cutoff).
insert into public.events (id, tenant_id, venue_id, event_key, name, starts_at, publication_status)
values
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111',
   '22222222-2222-2222-2222-222222222222', 'future-event', 'Future Event',
   now() + interval '3 days', 'published'),
  ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111',
   '22222222-2222-2222-2222-222222222222', 'imminent-event', 'Imminent Event',
   now() + interval '10 minutes', 'published');

-- ---------------------------------------------------------------------------
-- Status rule
-- ---------------------------------------------------------------------------
-- Called directly rather than through the view so each case is isolated.

with cases (label, active, release_status, manual_status, avail, threshold, starts_in, expected) as (
  values
    -- Section 5: 20 or more remaining is available, 1 to 19 is limited.
    ('21 remaining is available',        true,  'released',     null::text,  21, 19, interval '3 days', 'available'),
    ('20 remaining is available',        true,  'released',     null,        20, 19, interval '3 days', 'available'),
    ('19 remaining is limited',          true,  'released',     null,        19, 19, interval '3 days', 'limited'),
    ('1 remaining is limited',           true,  'released',     null,         1, 19, interval '3 days', 'limited'),
    ('0 remaining is fully booked',      true,  'released',     null,         0, 19, interval '3 days', 'fully_booked'),
    -- Not yet opened. Distinct from booking having closed.
    ('not released is closed',           true,  'not_released', null,       100, 19, interval '3 days', 'closed'),
    -- Past the booking cutoff.
    ('past cutoff is booking_closed',    true,  'released',     null,       100, 19, interval '10 minutes', 'booking_closed'),
    -- Never shown.
    ('inactive is hidden',               false, 'released',     null,       100, 19, interval '3 days', 'hidden'),
    ('hidden release is hidden',         true,  'hidden',       null,       100, 19, interval '3 days', 'hidden'),
    -- Operator override applies where stock allows.
    ('override forces limited',          true,  'released',     'limited',  100, 19, interval '3 days', 'limited'),
    -- ...but can never invent stock that does not exist.
    ('override cannot beat sold out',    true,  'released',     'available',  0, 19, interval '3 days', 'fully_booked'),
    -- ...and never outranks a closed or hidden class.
    ('override cannot open a closed class', true, 'not_released', 'available', 100, 19, interval '3 days', 'closed')
)
select
  case when public.ticket_availability_status(
         active, release_status, manual_status, avail, threshold,
         now() + starts_in, 30
       ) = expected then 'PASS' else 'FAIL' end as result,
  label,
  expected,
  public.ticket_availability_status(
    active, release_status, manual_status, avail, threshold,
    now() + starts_in, 30
  ) as actual
from cases;

-- ---------------------------------------------------------------------------
-- Constraints
-- ---------------------------------------------------------------------------
-- Each should be rejected. A DO block turns the expected failure into a row.

create temporary table constraint_results (result text, label text, detail text);

do $$
declare
  checks text[][] := array[
    array['closed class must carry an explanation',
          $q$insert into public.event_ticket_classes (tenant_id, event_id, ticket_class_id, release_status, total_quantity)
             select '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', id, 'not_released', 100
             from public.ticket_classes where code = 'ringside'$q$],
    array['committed cannot exceed total',
          $q$insert into public.event_ticket_classes (tenant_id, event_id, ticket_class_id, total_quantity, reserved_quantity, sold_quantity)
             select '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', id, 10, 6, 6
             from public.ticket_classes where code = 'club_class'$q$],
    array['max_per_order cannot exceed 10',
          $q$insert into public.event_ticket_classes (tenant_id, event_id, ticket_class_id, total_quantity, max_per_order)
             select '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', id, 100, 25
             from public.ticket_classes where code = 'leo_section'$q$],
    array['event cannot end before it starts',
          $q$insert into public.events (tenant_id, venue_id, event_key, name, starts_at, ends_at)
             values ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222',
                     'bad-times','Bad Times', now() + interval '2 days', now() + interval '1 day')$q$],
    array['weekly series cannot set week_of_month',
          $q$insert into public.event_series (tenant_id, slug, name, frequency, weekdays, week_of_month, default_start_time_local)
             values ('11111111-1111-1111-1111-111111111111','bad-weekly','Bad Weekly','weekly', array[6]::smallint[], 2, '20:00')$q$],
    array['monthly series needs exactly one weekday',
          $q$insert into public.event_series (tenant_id, slug, name, frequency, weekdays, week_of_month, default_start_time_local)
             values ('11111111-1111-1111-1111-111111111111','bad-monthly','Bad Monthly','monthly', array[1,2]::smallint[], -1, '20:00')$q$],
    array['weekday 8 is not a weekday',
          $q$insert into public.event_series (tenant_id, slug, name, frequency, weekdays, default_start_time_local)
             values ('11111111-1111-1111-1111-111111111111','bad-day','Bad Day','weekly', array[8]::smallint[], '20:00')$q$],
    -- This pointed at ticket_currency_prices, which 0005 replaced. The test
    -- still passed, because the insert failed on "no such table" rather than on
    -- the constraint — green for the wrong reason, and it would have stayed
    -- green with the constraint removed.
    array['currency must be a 3-letter code',
          $q$insert into public.ticket_class_prices (ticket_class_id, currency, unit_amount)
             select id, 'POUNDS', 100 from public.ticket_classes limit 1$q$],
    array['a price must be above zero',
          $q$insert into public.ticket_class_prices (ticket_class_id, currency, unit_amount)
             select id, 'zar', 0 from public.ticket_classes limit 1$q$],
    array['a class appears at most once per event',
          $q$insert into public.event_ticket_classes (tenant_id, event_id, ticket_class_id, total_quantity)
             select '11111111-1111-1111-1111-111111111111','33333333-3333-3333-3333-333333333333', id, 50
             from public.ticket_classes where code = 'third_class'
             union all
             select '11111111-1111-1111-1111-111111111111','33333333-3333-3333-3333-333333333333', id, 50
             from public.ticket_classes where code = 'third_class'$q$]
  ];
  i int;
begin
  for i in 1 .. array_length(checks, 1) loop
    begin
      execute checks[i][2];
      insert into constraint_results values ('FAIL', checks[i][1], 'accepted, should have been rejected');
    exception when others then
      insert into constraint_results values ('PASS', checks[i][1], sqlerrm);
    end;
  end loop;
end;
$$;

select result, label from constraint_results;

-- ---------------------------------------------------------------------------
-- The view returns every class, including sold-out and closed (Section 4)
-- ---------------------------------------------------------------------------

insert into public.event_ticket_classes
  (tenant_id, event_id, ticket_class_id, total_quantity, sold_quantity, release_status, closed_explanation)
select '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', tc.id,
       q.total, q.sold, q.release_status, q.explanation
from public.ticket_classes tc
join (values
        ('ringside',    100,   0, 'released',     null::text),
        ('club_class',  100, 100, 'released',     null),
        ('leo_section', 100,  95, 'released',     null),
        ('third_class', 100,   0, 'not_released',
         'Third Class for this date is currently closed. Third Class is usually opened by the stadium once the other seat classes are full or close to full.')
     ) as q(code, total, sold, release_status, explanation)
  on q.code = tc.code;

select
  case when count(*) = 4 then 'PASS' else 'FAIL' end as result,
  'all four classes returned for the date' as label,
  count(*) as returned
from public.event_ticket_availability
where event_key = 'future-event';

select
  case when count(*) = 1 then 'PASS' else 'FAIL' end as result,
  'closed class is returned with its explanation' as label
from public.event_ticket_availability
where event_key = 'future-event'
  and status = 'closed'
  and closed_explanation is not null;

select
  ticket_class_name, status, assigned_seating, max_per_order
from public.event_ticket_availability
where event_key = 'future-event'
order by display_order;

-- No remaining-count column is exposed to the guest (Section 4).
select
  case when count(*) = 0 then 'PASS' else 'FAIL' end as result,
  'view exposes no remaining-count column' as label
from information_schema.columns
where table_schema = 'public'
  and table_name = 'event_ticket_availability'
  and column_name in ('quantity_available', 'total_quantity', 'reserved_quantity', 'sold_quantity');

rollback;
