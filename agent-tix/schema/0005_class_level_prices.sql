-- Agent Tix — prices move up a level
--
-- APPLIED to agent-tix-build on 30 August 2026.
--
-- Before: one price row per event, per class, per currency. One week was 132
-- rows carrying 24 distinct amounts; a full year would be roughly 7,200 rows
-- saying the same 24 things.
--
-- After: the standing price sits on the class, and a separate table holds
-- exceptions for a night priced differently. A new date needs no price rows at
-- all, and a price rise is one edit.
--
-- Verified before collapsing that no class charged two different amounts in the
-- same currency, so nothing was lost.

create table public.ticket_class_prices (
  ticket_class_id  uuid not null references public.ticket_classes(id) on delete cascade,
  currency         text not null,
  unit_amount      integer not null,
  active           boolean not null default true,
  display_order    integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  primary key (ticket_class_id, currency),
  constraint tcp_currency_format check (currency ~ '^[a-z]{3}$'),
  constraint tcp_unit_amount_positive check (unit_amount > 0)
);

comment on table public.ticket_class_prices is
  'The standing price for a ticket class. A new event date needs no price rows at all; it inherits these.';

create table public.event_ticket_price_overrides (
  event_ticket_class_id  uuid not null references public.event_ticket_classes(id) on delete cascade,
  currency               text not null,
  unit_amount            integer not null,
  active                 boolean not null default true,
  note                   text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  primary key (event_ticket_class_id, currency),
  constraint etpo_currency_format check (currency ~ '^[a-z]{3}$'),
  constraint etpo_unit_amount_positive check (unit_amount > 0)
);

comment on table public.event_ticket_price_overrides is
  'Exceptions only — a night priced differently from the standing rate. Empty is the normal state.';
comment on column public.event_ticket_price_overrides.note is
  'Why this date differs, so the reason survives the person who set it.';

-- The standing prices. On agent-tix-build these were carried up from the
-- per-date rows before that table was dropped; the figures below are those
-- same amounts, written out so this file replays on an empty database.
insert into public.ticket_class_prices (ticket_class_id, currency, unit_amount, display_order)
select tc.id, p.currency, p.amount, p.display_order
from public.ticket_classes tc
join (values
  ('ringside','usd',7700,1), ('ringside','eur',6700,2), ('ringside','gbp',5700,3),
  ('ringside','aud',10900,4), ('ringside','cny',52000,5), ('ringside','thb',250000,6),
  ('club_class','usd',5500,1), ('club_class','eur',4800,2), ('club_class','gbp',4100,3),
  ('club_class','aud',7900,4), ('club_class','cny',38000,5), ('club_class','thb',180000,6),
  ('leo_section','usd',4600,1), ('leo_section','eur',4000,2), ('leo_section','gbp',3400,3),
  ('leo_section','aud',6600,4), ('leo_section','cny',31000,5), ('leo_section','thb',150000,6),
  ('third_class','usd',3100,1), ('third_class','eur',2700,2), ('third_class','gbp',2300,3),
  ('third_class','aud',4400,4), ('third_class','cny',21000,5), ('third_class','thb',100000,6)
) as p(class_code, currency, amount, display_order)
  on p.class_code = tc.code
on conflict (ticket_class_id, currency) do nothing;

-- The view the checkout reads. Standing rate unless an override exists.
create view public.event_ticket_prices as
select
  etc.id                                      as event_ticket_class_id,
  d.currency,
  coalesce(o.unit_amount, d.unit_amount)      as unit_amount,
  d.display_order,
  (o.event_ticket_class_id is not null)       as is_override
from public.event_ticket_classes etc
join public.ticket_class_prices d
  on d.ticket_class_id = etc.ticket_class_id and d.active
left join public.event_ticket_price_overrides o
  on o.event_ticket_class_id = etc.id and o.currency = d.currency and o.active;

comment on view public.event_ticket_prices is
  'The price to charge. Standing rate unless a date-specific override exists. An override for a currency with no standing rate is not surfaced, by design.';

create trigger tcp_class_set_updated_at
  before update on public.ticket_class_prices
  for each row execute function public.set_updated_at();

create trigger etpo_set_updated_at
  before update on public.event_ticket_price_overrides
  for each row execute function public.set_updated_at();

alter table public.ticket_class_prices           enable row level security;
alter table public.event_ticket_price_overrides  enable row level security;
