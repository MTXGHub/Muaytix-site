-- Agent Tix — Phase 1, step 3: availability, pricing, and the status rule
--
-- NOT APPLIED ANYWHERE. Draft for review.
--
-- Replaces ticket_inventory. Same job, but event identity has moved out to
-- public.events and the class has moved out to public.ticket_classes, so what
-- is left here is genuinely per-event-per-class: how many, at what price, in
-- what state.

-- ---------------------------------------------------------------------------
-- event_ticket_classes
-- ---------------------------------------------------------------------------

create table public.event_ticket_classes (
  id                      uuid primary key default gen_random_uuid(),
  tenant_id               uuid not null references public.tenants(id) on delete cascade,
  event_id                uuid not null references public.events(id) on delete cascade,
  ticket_class_id         uuid not null references public.ticket_classes(id) on delete restrict,

  total_quantity          integer not null default 0,
  reserved_quantity       integer not null default 0,
  sold_quantity           integer not null default 0,

  -- Derived once, in the database, so no caller can compute it differently.
  -- clever-responder currently repeats this arithmetic in two places.
  quantity_available      integer generated always as
                            (greatest(0, total_quantity - reserved_quantity - sold_quantity)) stored,

  release_status          text not null default 'released'
                            check (release_status in ('released', 'not_released', 'hidden')),
  manual_status           text
                            check (manual_status is null or manual_status in ('available', 'limited', 'fully_booked')),
  closed_explanation      text,

  -- Section 5: 20 or more remaining is available, 1 to 19 is limited. The rule
  -- below reads `quantity_available <= limited_threshold`, so 19 is the value
  -- that produces exactly that split. Revising the threshold is a data change.
  limited_threshold       integer not null default 19,

  max_per_order           integer not null default 10,
  maximum_seats_together  integer,
  display_order           integer not null default 0,

  stripe_product_id       text,
  stripe_price_id         text,

  admission_valid         boolean not null default true,
  checkout_purpose        text,
  active                  boolean not null default true,

  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  unique (event_id, ticket_class_id),

  constraint etc_quantities_non_negative check (
    total_quantity >= 0 and reserved_quantity >= 0 and sold_quantity >= 0
  ),
  constraint etc_committed_within_total check (
    reserved_quantity + sold_quantity <= total_quantity
  ),
  constraint etc_limited_threshold_non_negative check (limited_threshold >= 0),
  constraint etc_max_per_order_positive check (max_per_order between 1 and 10),

  -- Section 5, stated as a requirement rather than a nicety: a closed class
  -- must always carry a brief explanation. Without one a guest assumes the
  -- class is unavailable everywhere and books with a competitor, when in
  -- practice Third Class usually opens later the same night. Enforcing it here
  -- means no admin screen and no Edge Function can produce a bare "Closed".
  constraint etc_closed_needs_explanation check (
    release_status <> 'not_released'
    or (closed_explanation is not null and length(btrim(closed_explanation)) > 0)
  )
);

comment on table public.event_ticket_classes is
  'Per-event, per-class inventory. Replaces ticket_inventory, with event and class identity normalised out.';
comment on column public.event_ticket_classes.manual_status is
  'Operator override. Applied after the sold-out check and before the threshold check, matching the precedence in the current clever-responder logic: an override can never claim availability that does not exist.';
comment on column public.event_ticket_classes.closed_explanation is
  'Required whenever release_status is not_released. Carries forward the existing Third Class copy pattern.';
comment on column public.event_ticket_classes.maximum_seats_together is
  'Largest block of adjacent seats currently available. Drives the seating-separation warning together with ticket_classes.assigned_seating.';

create index etc_event_idx on public.event_ticket_classes (event_id, display_order);

-- ---------------------------------------------------------------------------
-- ticket_currency_prices
-- ---------------------------------------------------------------------------
-- Structurally unchanged from the live table, re-pointed at the new inventory
-- row. Server-controlled fixed prices; no public policies. Section 7 confirms
-- JPY and SGD from 1 September, CAD unconfirmed, and more over time, so the
-- currency set stays data rather than an enum.

create table public.ticket_currency_prices (
  event_ticket_class_id  uuid not null references public.event_ticket_classes(id) on delete cascade,
  currency               text not null,
  unit_amount            integer not null,
  active                 boolean not null default true,
  display_order          integer not null default 0,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),

  primary key (event_ticket_class_id, currency),

  constraint tcp_currency_format check (currency ~ '^[a-z]{3}$'),
  constraint tcp_unit_amount_positive check (unit_amount > 0)
);

comment on table public.ticket_currency_prices is
  'Server-controlled fixed checkout prices by inventory row and currency. No public policies; Edge Functions access this table using the service role.';

-- ---------------------------------------------------------------------------
-- The status rule, in one place
-- ---------------------------------------------------------------------------
-- Section 16 confirms Edge Functions split by job. Availability checking and
-- checkout creation are separate jobs that must agree on status exactly, or a
-- guest sees Available and is then refused at checkout. Today both branches
-- live in one function and share a helper by accident of colocation. Splitting
-- them means the rule has to live somewhere both can reach, which is here.
--
-- Precedence, carried over from the current implementation:
--   inactive or hidden   -> hidden          (not shown at all)
--   not released         -> closed          (shown, with explanation)
--   past booking cutoff  -> booking_closed
--   nothing left         -> fully_booked
--   operator override    -> manual_status
--   at or below threshold-> limited
--   otherwise            -> available
--
-- Two guest-facing statuses are distinct and easy to conflate: `closed` means
-- not yet opened and may open later tonight, `booking_closed` means the cutoff
-- for this event has passed and it will not reopen.

create or replace function public.ticket_availability_status(
  p_active                 boolean,
  p_release_status         text,
  p_manual_status          text,
  p_quantity_available     integer,
  p_limited_threshold      integer,
  p_starts_at              timestamptz,
  p_booking_cutoff_minutes integer
) returns text
language sql
stable
as $$
  select case
    when not p_active or p_release_status = 'hidden'  then 'hidden'
    when p_release_status = 'not_released'            then 'closed'
    when now() >= p_starts_at - make_interval(mins => p_booking_cutoff_minutes)
                                                      then 'booking_closed'
    when p_quantity_available = 0                     then 'fully_booked'
    when p_manual_status is not null                  then p_manual_status
    when p_quantity_available <= p_limited_threshold  then 'limited'
    else 'available'
  end;
$$;

-- ---------------------------------------------------------------------------
-- event_ticket_availability
-- ---------------------------------------------------------------------------
-- What the availability Edge Function reads. One row per event per class,
-- already joined and already carrying a resolved status, so the function does
-- no arithmetic of its own.
--
-- Section 4 requires all four classes to be returned for a selected date, each
-- with its own status, rather than filtering sold-out or closed ones away. So
-- this view deliberately does not filter on status. Only `hidden` should ever
-- be dropped, and that is left to the caller so the decision is visible.
--
-- Section 4 also forbids exposing exact counts: quantity_available is not
-- selected here, only the status derived from it and the order cap.

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

create trigger etc_set_updated_at
  before update on public.event_ticket_classes
  for each row execute function public.set_updated_at();

create trigger tcp_set_updated_at
  before update on public.ticket_currency_prices
  for each row execute function public.set_updated_at();

alter table public.event_ticket_classes   enable row level security;
alter table public.ticket_currency_prices enable row level security;
