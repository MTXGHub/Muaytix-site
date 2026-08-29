-- Agent Tix — Phase 1, step 1: tenancy, venues, ticket classes
--
-- NOT APPLIED ANYWHERE. Draft for review.
--
-- Three tables that hold the things currently repeated as free text on every
-- ticket_inventory row, or hardcoded in the widget's JavaScript.

-- ---------------------------------------------------------------------------
-- tenants
-- ---------------------------------------------------------------------------
-- Stage 1 has exactly one row (MuayTix). It exists now because the Design Brief
-- Section 3 confirms multi-tenancy from the start, and retrofitting a tenant_id
-- onto a live inventory table later is the expensive version of this.
--
-- allowed_origins replaces the hardcoded CORS allowlist in clever-responder:
--   const allowedOrigins = new Set(["https://muaytix.com", "https://www.muaytix.com"]);
-- Under Stage 2 each agent has their own domain, so this cannot stay in code.

create table public.tenants (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique,
  name              text not null,
  allowed_origins   text[] not null default '{}',
  default_timezone  text not null default 'Asia/Bangkok',
  active            boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint tenants_slug_format check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$')
);

comment on table public.tenants is
  'Ticket agents. Stage 1 is a single row (muaytix); the column exists so Stage 2 white-labelling does not require a migration of live inventory.';
comment on column public.tenants.allowed_origins is
  'CORS allowlist for this tenant''s Edge Function calls. Replaces the hardcoded allowlist in clever-responder.';

-- ---------------------------------------------------------------------------
-- venues
-- ---------------------------------------------------------------------------
-- Today `venue` is a text column repeated on all 371 ticket_inventory rows, and
-- the timezone is hardcoded twice in the widget JS as 'Asia/Bangkok'. Both need
-- one home. timezone lives here rather than on the tenant because an agent can
-- sell for venues in more than one zone.

create table public.venues (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  slug        text not null,
  name        text not null,
  timezone    text not null default 'Asia/Bangkok',
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  unique (tenant_id, slug)
);

comment on column public.venues.timezone is
  'IANA zone used to render dates and times to the guest. Currently hardcoded in the widget as Asia/Bangkok.';

-- ---------------------------------------------------------------------------
-- ticket_classes
-- ---------------------------------------------------------------------------
-- The four classes as rows rather than a free-text ticket_type string.
--
-- Two things move out of code and into here:
--
--   1. The DESCRIPTIONS map in muaytix-master-widget, which hardcodes the
--      per-class copy in JavaScript. Editing a description currently means
--      redeploying an Edge Function.
--
--   2. The seating-separation rule. Design Brief Section 5 states the warning
--      applies to Club Class and Ringside (assigned seating) and not to LEO
--      Section or Third Class. That is a property of the class, so it belongs
--      on the class, not repeated per event as show_seating_notice is today.
--
-- image_url is the branded ticket artwork Section 10 wants used prominently.

create table public.ticket_classes (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  code              text not null,
  name              text not null,
  description       text,
  image_url         text,
  assigned_seating  boolean not null default false,
  display_order     integer not null default 0,
  active            boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  unique (tenant_id, code),
  constraint ticket_classes_code_format check (code ~ '^[a-z0-9][a-z0-9_]{1,62}$')
);

comment on column public.ticket_classes.assigned_seating is
  'True for Ringside and Club Class. Drives the "your group may be seated separately" warning, which Section 5 restricts to assigned-seating classes.';
comment on column public.ticket_classes.description is
  'Guest-facing class copy. Replaces the hardcoded DESCRIPTIONS map in muaytix-master-widget.';

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger tenants_set_updated_at
  before update on public.tenants
  for each row execute function public.set_updated_at();

create trigger venues_set_updated_at
  before update on public.venues
  for each row execute function public.set_updated_at();

create trigger ticket_classes_set_updated_at
  before update on public.ticket_classes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
-- Enabled with no policies: service-role access only, matching the pattern the
-- existing ticket_currency_prices table already documents. Guest reads go
-- through Edge Functions, never straight from the browser. Per-tenant policies
-- are a Stage 2 question and are deliberately not guessed at here.

alter table public.tenants        enable row level security;
alter table public.venues         enable row level security;
alter table public.ticket_classes enable row level security;
