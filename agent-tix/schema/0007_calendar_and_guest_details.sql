-- Agent Tix — the calendar's own data, and who bought the ticket
--
-- APPLIED to agent-tix-build on 30 August 2026.
--
-- Three additions, two of them driven by the same principle: adding a month, a
-- new promoter or a whole new year must be a data change, never a code change.
--
-- 1. The widget hardcoded each promotion's short name and colour, and each seat
--    class's colours. That meant January 2027 could be loaded into the database
--    and the calendar still would not know what to call it or what colour to
--    draw it. Those facts move onto the series and the class, where the rest of
--    each already lives.
--
-- 2. The calendar gets a view of its own. Drawing a month from the availability
--    view meant loading every seat class for every night to show none of them.
--
-- 3. The webhook needs somewhere to record who paid. Until tickets are sent
--    automatically they go out by hand, and the person doing that needs the
--    guest's name and email against the booking, not only in Stripe.

alter table public.event_series
  add column if not exists short_name    text,
  add column if not exists accent_colour text;

comment on column public.event_series.short_name is
  'Two-word label printed under the date in the calendar grid, where the full promotion name will not fit.';
comment on column public.event_series.accent_colour is
  'Hex colour for this promotion in the calendar. Held as data so a new series needs no widget release.';

alter table public.checkout_reservations
  add column if not exists guest_email text,
  add column if not exists guest_name  text;

comment on column public.checkout_reservations.guest_email is
  'Written by the Stripe webhook on payment. The reservation row is the sales record until an orders table exists.';

-- ---------------------------------------------------------------------------
-- The six promotions currently running at Rajadamnern
-- ---------------------------------------------------------------------------

update public.event_series set short_name = 'Knockout',    accent_colour = '#B0342E' where slug = 'rajadamnern-knockout';
update public.event_series set short_name = 'New Power',   accent_colour = '#4A7A3F' where slug = 'new-power';
update public.event_series set short_name = 'Petchyindee', accent_colour = '#8A5A9E' where slug = 'petchyindee';
update public.event_series set short_name = 'RWS',         accent_colour = '#2F6FC4' where slug = 'rws';
update public.event_series set short_name = 'Kiatpetch',   accent_colour = '#C08A2E' where slug = 'kiatpetch';
update public.event_series set short_name = 'All Star',    accent_colour = '#C4122F' where slug = 'all-star-buakaw';

-- ---------------------------------------------------------------------------
-- event_calendar
-- ---------------------------------------------------------------------------
-- One row per fight night, which is what the calendar grid draws. Deliberately
-- separate from event_ticket_availability: that view is one row per class, so
-- drawing a calendar meant loading every class for every night in the month to
-- show none of them.
--
-- An event with no inventory is not shown. A night in the diary with nothing to
-- sell is not a night a guest can book.

create or replace view public.event_calendar as
select
  e.tenant_id,
  e.id                       as event_id,
  e.event_key,
  e.name                     as event_name,
  coalesce(e.description, s.default_description) as event_description,
  coalesce(s.short_name, e.name)                 as short_name,
  s.accent_colour,
  e.starts_at,
  e.ends_at,
  -- Resolved here, not in the browser. The widget must place a night on the
  -- Bangkok calendar day, and a phone set to Los Angeles would put a 7pm
  -- Tuesday fight on the Monday square.
  (e.starts_at at time zone v.timezone)::date        as local_date,
  (e.starts_at at time zone v.timezone)::time        as local_start_time,
  (e.ends_at   at time zone v.timezone)::time        as local_end_time,
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

-- ---------------------------------------------------------------------------
-- Seat class colours
-- ---------------------------------------------------------------------------
-- Same reasoning as the series colours above: the widget was carrying four
-- hardcoded hex values, so a fifth seat class could be added to the database
-- and would draw with no colour at all.
--
-- Two values per class, not one. The vibrant colour is for solid trim; small
-- text and thin borders need a darker version of it or they fail contrast.
-- Bright yellow is the case that proves it — LEO's #FFD400 is unreadable as
-- type, and the beige-looking compromise the widget had before was worse.

alter table public.ticket_classes
  add column if not exists accent_colour text,
  add column if not exists accent_ink    text;

comment on column public.ticket_classes.accent_ink is
  'Darker form of accent_colour, used wherever the colour has to carry text or a thin border. Two values because one cannot pass contrast in both roles.';

update public.ticket_classes set accent_colour = '#2FA04A', accent_ink = '#1E7A38' where code = 'ringside';
update public.ticket_classes set accent_colour = '#3A86D4', accent_ink = '#2565AE' where code = 'club_class';
update public.ticket_classes set accent_colour = '#FFD400', accent_ink = '#8A6A00' where code = 'leo_section';
update public.ticket_classes set accent_colour = '#E8631A', accent_ink = '#B84A0C' where code = 'third_class';

-- event_ticket_availability gains the two colours. Everything else is unchanged
-- from 0003; the view has to be recreated in full because a column is added.

drop view if exists public.event_ticket_availability;

create view public.event_ticket_availability as
select
  e.tenant_id,
  e.id                        as event_id,
  e.event_key,
  e.name                      as event_name,
  coalesce(e.description, s.default_description)  as event_description,
  e.starts_at,
  e.ends_at,
  e.image_url                 as event_image_url,
  v.name                      as venue_name,
  v.timezone                  as venue_timezone,
  etc.id                      as event_ticket_class_id,
  tc.code                     as ticket_class_code,
  tc.name                     as ticket_class_name,
  tc.description              as ticket_class_description,
  tc.image_url                as ticket_class_image_url,
  tc.accent_colour            as ticket_class_colour,
  tc.accent_ink               as ticket_class_ink,
  tc.assigned_seating,
  etc.display_order,
  etc.closed_explanation,
  etc.maximum_seats_together,
  least(etc.max_per_order, etc.quantity_available) as max_per_order,
  public.ticket_availability_status(
    etc.active,
    etc.release_status,
    etc.manual_status,
    etc.quantity_available,
    etc.limited_threshold,
    e.starts_at,
    e.booking_cutoff_minutes
  )                           as status
from public.event_ticket_classes etc
join public.events         e  on e.id  = etc.event_id
join public.ticket_classes tc on tc.id = etc.ticket_class_id
join public.venues         v  on v.id  = e.venue_id
left join public.event_series s on s.id = e.series_id
where e.publication_status = 'published';

comment on view public.event_ticket_availability is
  'Guest-facing availability. Exposes status but never a remaining count, per Section 4. Returns all classes including sold-out and closed, per Section 4.';
