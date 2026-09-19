-- What the week owes, worked out rather than worked out by hand.
--
-- Jason, 19 September 2026. Wages are paid WEEKLY, as a deliberate company
-- decision: monthly payroll is a cash-flow convenience for the employer dressed
-- up as administrative efficiency, and it asks people to work a month in
-- arrears. That is settled, and this report exists to make the weekly number
-- take thirty seconds instead of an afternoon.
--
-- The structure it computes, agreed the same day:
--
--   base           100 pounds a week
--   ticket slice   50p a ticket
--   accelerator    a banded percentage of contribution AFTER advertising
--
-- Banded like income tax, so each rate applies only to the slice of net
-- contribution inside its band. No cliff edges: earning one pound more can
-- never make the total go down.
--
-- After advertising, deliberately. Advertising is the only cost that can move
-- fast enough to swallow a good week, it is the thing Jason personally manages,
-- and paying on gross would have rewarded a 196% week in which the money
-- actually left in the business grew 20%. It also means tightening the ad
-- account raises his pay with no extra sales -- which is the sharpest incentive
-- in the whole arrangement.
--
-- Three things are tables rather than constants so the arrangement can change
-- without a migration: the structure, the bands, and the exchange rate. Margin
-- is earned in baht and wages are paid in sterling, so the rate is an input to
-- payroll, not a detail.
--
-- The honest limits, same as 0020: margin is a standing rate per class, not a
-- per-night cost, and the week that has not finished yet shows as a part week.

-- ---------------------------------------------------------------------------
-- What the advertising cost. Held here because it lives in Google Ads and
-- nothing in this database could see it, which is why no report until now could
-- show a figure net of the one cost that matters most.
-- ---------------------------------------------------------------------------
create table if not exists ad_spend_daily (
  spend_on     date primary key,
  amount_minor bigint not null check (amount_minor >= 0),
  currency     text   not null default 'gbp',
  source       text   not null default 'google_ads',
  recorded_at  timestamptz not null default now()
);

comment on table ad_spend_daily is
  'Daily advertising spend, in pence. Google bills in sterling, same as Stripe settles in sterling.';

-- ---------------------------------------------------------------------------
-- The arrangement. One row, enforced -- a second row would silently double
-- everyone's wages.
-- ---------------------------------------------------------------------------
create table if not exists pay_structure (
  only_row         boolean primary key default true check (only_row),
  base_minor       bigint  not null check (base_minor >= 0),
  per_ticket_minor bigint  not null check (per_ticket_minor >= 0),
  currency         text    not null default 'gbp',
  -- Wages are sterling, margin is baht. The rate is a payroll input.
  thb_per_gbp      numeric(10,4) not null check (thb_per_gbp > 0),
  updated_at       timestamptz not null default now()
);

comment on table pay_structure is
  'The weekly wage arrangement: base, ticket slice, and the baht rate wages are converted at. Exactly one row.';

insert into pay_structure (base_minor, per_ticket_minor, thb_per_gbp)
values (10000, 50, 44.6310)
on conflict (only_row) do update
  set base_minor = excluded.base_minor,
      per_ticket_minor = excluded.per_ticket_minor,
      thb_per_gbp = excluded.thb_per_gbp,
      updated_at = now();

-- ---------------------------------------------------------------------------
-- The accelerator. Bands in pence of weekly net contribution; upper_minor null
-- means the top band has no ceiling.
-- ---------------------------------------------------------------------------
create table if not exists pay_bands (
  lower_minor bigint primary key check (lower_minor >= 0),
  upper_minor bigint check (upper_minor is null or upper_minor > lower_minor),
  rate_pct    numeric(5,2) not null check (rate_pct >= 0 and rate_pct <= 100)
);

comment on table pay_bands is
  'Accelerator bands on weekly contribution after advertising. Marginal, like income tax: each rate applies only to the slice inside its band.';

insert into pay_bands (lower_minor, upper_minor, rate_pct) values
  (     0,   55000, 15),   -- up to 550
  ( 55000,   90000, 30),   -- 550 - 900
  ( 90000,  135000, 40),   -- 900 - 1,350
  (135000,  200000, 45),   -- 1,350 - 2,000
  (200000,    null, 50)    -- above 2,000
on conflict (lower_minor) do update
  set upper_minor = excluded.upper_minor, rate_pct = excluded.rate_pct;

-- ---------------------------------------------------------------------------
-- The report. One row per trading week, Monday to Sunday.
-- ---------------------------------------------------------------------------
create or replace view weekly_pay as
with weeks as (
  select date_trunc('week', sold_on)::date as week_from,
         sum(bookings)         as bookings,
         sum(tickets)          as tickets,
         sum(contribution_thb) as gross_thb
  from contribution_by_day
  group by date_trunc('week', sold_on)::date
),
ads as (
  select date_trunc('week', spend_on)::date as week_from,
         sum(amount_minor) as ad_minor
  from ad_spend_daily
  group by date_trunc('week', spend_on)::date
),
net as (
  select w.week_from, w.bookings, w.tickets,
         round(w.gross_thb * 100 / s.thb_per_gbp)                      as gross_minor,
         coalesce(a.ad_minor, 0)                                       as ad_minor,
         round(w.gross_thb * 100 / s.thb_per_gbp) - coalesce(a.ad_minor, 0) as net_minor,
         s.base_minor, s.per_ticket_minor
  from weeks w
  cross join pay_structure s
  left join ads a on a.week_from = w.week_from
)
select
  n.week_from,
  n.bookings,
  n.tickets,
  round(n.gross_minor / 100.0, 2)                       as gross_contribution_gbp,
  round(n.ad_minor    / 100.0, 2)                       as ad_spend_gbp,
  round(n.net_minor   / 100.0, 2)                       as net_contribution_gbp,
  round(n.base_minor  / 100.0, 2)                       as base_gbp,
  round(n.tickets * n.per_ticket_minor / 100.0, 2)      as ticket_slice_gbp,
  round(coalesce(b.banded_minor, 0) / 100.0, 2)         as accelerator_gbp,
  round((n.base_minor + n.tickets * n.per_ticket_minor
         + coalesce(b.banded_minor, 0)) / 100.0, 2)     as total_pay_gbp,
  -- What the wage costs as a share of what the week actually made. A week that
  -- loses money on advertising shows null rather than a nonsense percentage.
  case when n.net_minor > 0 then
    round(100.0 * (n.base_minor + n.tickets * n.per_ticket_minor
                   + coalesce(b.banded_minor, 0)) / n.net_minor, 1)
  end                                                   as share_of_net_pct
from net n
left join lateral (
  -- Each band contributes only the slice of net contribution that falls inside
  -- it. A null ceiling on the top band means "everything above".
  select sum(
    (least(n.net_minor, coalesce(pb.upper_minor, n.net_minor)) - pb.lower_minor)
    * pb.rate_pct / 100
  ) as banded_minor
  from pay_bands pb
  where n.net_minor > pb.lower_minor
) b on true;

comment on view weekly_pay is
  'One row per trading week: what was sold, what advertising cost, what was '
  'left, and what the wage comes to. Paid weekly, by company decision.';
