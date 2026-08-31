-- Agent Tix — letting a page show one promotion's nights
--
-- APPLIED to agent-tix-build on 31 August 2026.
--
-- The RWS page wants a calendar of RWS nights, the Buakaw page wants Buakaw
-- nights, and so on. The nights are already there; the calendar just never said
-- which promotion each one belonged to, so the widget had nothing to filter on.
--
-- One column. Filtering happens in the widget, so a page changes what it shows
-- by naming a promotion, and no new query or endpoint is involved.

drop view if exists public.event_calendar;

create view public.event_calendar as
select
  e.tenant_id,
  e.id                       as event_id,
  e.event_key,
  e.name                     as event_name,
  coalesce(e.description, s.default_description) as event_description,
  coalesce(s.short_name, e.name)                 as short_name,
  s.slug                     as series_slug,
  s.accent_colour,
  e.starts_at,
  e.ends_at,
  (e.starts_at at time zone v.timezone)::date as local_date,
  (e.starts_at at time zone v.timezone)::time as local_start_time,
  (e.ends_at   at time zone v.timezone)::time as local_end_time,
  v.name                     as venue_name,
  v.timezone                 as venue_timezone
from public.events e
join public.venues v on v.id = e.venue_id
left join public.event_series s on s.id = e.series_id
where e.publication_status = 'published'
  and exists (
    select 1 from public.event_ticket_classes etc
    where etc.event_id = e.id and etc.active
  );

comment on view public.event_calendar is
  'One row per bookable fight night. Feeds the calendar grid; carries no price and no availability.';
comment on column public.event_calendar.series_slug is
  'Which promotion the night belongs to. Lets a page show only its own nights.';
