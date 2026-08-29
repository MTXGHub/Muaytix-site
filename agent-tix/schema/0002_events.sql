-- Agent Tix — Phase 1, step 2: recurring series and dated events
--
-- NOT APPLIED ANYWHERE. Draft for review.
--
-- This is the table that does not exist today. Right now event identity
-- (event_name, event_starts_at, event_ends_at, venue, image_url) is copied onto
-- every ticket_inventory row and held together by a shared event_key string.
-- Four ticket classes for one night means the event name is stored four times,
-- and there is nowhere at all to put a description.

-- ---------------------------------------------------------------------------
-- event_series
-- ---------------------------------------------------------------------------
-- The recurring pattern half of the hybrid decision (Phase 0, item 2): roughly
-- 95% of events are a weekly pattern, with built-in exceptions such as a
-- monthly last-Monday date.
--
-- Recurrence is modelled as explicit columns rather than an iCal RRULE string.
-- RRULE is more expressive than anything MuayTix needs, needs a parser on both
-- ends, and is not readable in an admin screen. Two frequencies cover the
-- stated cases.

create table public.event_series (
  id                        uuid primary key default gen_random_uuid(),
  tenant_id                 uuid not null references public.tenants(id) on delete cascade,
  venue_id                  uuid references public.venues(id) on delete restrict,
  slug                      text not null,
  name                      text not null,
  default_description       text,
  frequency                 text not null check (frequency in ('weekly', 'monthly')),
  weekdays                  smallint[] not null default '{}',
  week_of_month             smallint,
  default_start_time_local  time not null,
  default_duration_minutes  integer not null default 180,
  default_image_url         text,
  active                    boolean not null default true,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),

  unique (tenant_id, slug),

  -- ISO weekday numbering, 1 = Monday through 7 = Sunday.
  constraint event_series_weekdays_valid
    check (weekdays <@ array[1,2,3,4,5,6,7]::smallint[]),

  -- Weekly: one or more weekdays, no week-of-month.
  -- Monthly: exactly one weekday plus which week it falls in.
  constraint event_series_recurrence_shape check (
    (frequency = 'weekly'  and array_length(weekdays, 1) >= 1 and week_of_month is null)
    or
    (frequency = 'monthly' and array_length(weekdays, 1) = 1  and week_of_month is not null)
  ),

  -- 1 through 4, or -1 meaning the last such weekday of the month.
  constraint event_series_week_of_month_valid
    check (week_of_month is null or week_of_month in (-1, 1, 2, 3, 4)),

  constraint event_series_duration_positive
    check (default_duration_minutes > 0)
);

comment on table public.event_series is
  'Recurring event patterns. A weekly Saturday fight night is one row; a monthly last-Monday one-off is another.';
comment on column public.event_series.week_of_month is
  'Monthly frequency only. -1 means the last matching weekday of the month, which is how the stated last-Monday exception is expressed.';
comment on column public.event_series.default_start_time_local is
  'Local wall-clock start time, resolved against the venue timezone when a dated event is generated. Stored as local time so a series does not drift if a zone changes its offset rules.';

-- ---------------------------------------------------------------------------
-- events
-- ---------------------------------------------------------------------------
-- One row per actual date. series_id null means a genuine standalone one-off,
-- which is the other half of the hybrid decision.
--
-- Section 6 is explicit that not every date is the same recurring event:
-- 29 August is RWS on a Saturday, 31 August is All-Star Fight by Buakaw on a
-- Monday at a different time. So name, description, and times all live per
-- dated row and are free to differ from the series they came from.
--
-- On description and Open Gap 6 ("written once per recurring weekly event, or
-- per specific date"): that question is not answered here, it is made
-- answerable either way. event_series.default_description holds the copy
-- written once; events.description overrides it for a specific date. Leaving
-- the override null means the series copy is used. Whether MuayTix writes one
-- per series, one per date, or a mix, becomes an operating choice rather than
-- a schema change.

create table public.events (
  id                      uuid primary key default gen_random_uuid(),
  tenant_id               uuid not null references public.tenants(id) on delete cascade,
  series_id               uuid references public.event_series(id) on delete set null,
  venue_id                uuid not null references public.venues(id) on delete restrict,
  event_key               text not null,
  name                    text not null,
  description             text,
  starts_at               timestamptz not null,
  ends_at                 timestamptz,
  image_url               text,
  publication_status      text not null default 'draft'
                            check (publication_status in ('draft', 'published', 'cancelled', 'archived')),
  booking_cutoff_minutes  integer not null default 30,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  -- Carries the existing event_key strings across unchanged, so current rows
  -- and Stripe metadata stay traceable after the migration.
  unique (tenant_id, event_key),

  constraint events_ends_after_starts
    check (ends_at is null or ends_at > starts_at),

  constraint events_cutoff_non_negative
    check (booking_cutoff_minutes >= 0)
);

comment on column public.events.event_key is
  'Stable public reference, unique per tenant. Existing keys carry over unchanged so Stripe metadata written by the current stripe-webhook remains traceable.';
comment on column public.events.description is
  'The "format of the night" paragraph (Section 6). Null falls back to event_series.default_description. This is what makes Open Gap 6 an operating choice rather than a schema decision.';
comment on column public.events.booking_cutoff_minutes is
  'Minutes before starts_at at which booking closes. Currently a hardcoded 30 minutes inside clever-responder; per-event because a one-off may need its own.';

-- The availability lookup is keyed on a date the guest picked, so the ordering
-- index matters more than the key lookup.
create index events_tenant_starts_at_idx
  on public.events (tenant_id, starts_at)
  where publication_status = 'published';

create index events_series_idx
  on public.events (series_id)
  where series_id is not null;

create trigger event_series_set_updated_at
  before update on public.event_series
  for each row execute function public.set_updated_at();

create trigger events_set_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();

alter table public.event_series enable row level security;
alter table public.events       enable row level security;
