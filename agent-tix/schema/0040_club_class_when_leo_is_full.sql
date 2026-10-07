-- Club Class for a guest who came for LEO and found it fully booked.
--
-- Jason, 7 October 2026. LEO sells out first. The guest who wanted LEO is the
-- cheapest-ticket guest, they do not think to move up to Club Class, and Third
-- Class is closed until the stadium opens it. So they leave and buy elsewhere.
-- On a night with a lot of Club Class still unsold, that is a ticket we already
-- hold going to waste.
--
-- The answer, chosen by Jason: when LEO is fully booked, tapping the red LEO
-- tile offers Club Class at 1,650 THB instead of 1,800. The same ticket is sold,
-- from the same stock, to the same checkout. Only the price differs, and the
-- price lives here, in the database, never in the widget.
--
-- The rule behind the number: the stadium lets a Club Class ticket be discounted
-- by at most 10 per cent. 1,650 is 8.3 per cent off. The cap is enforced below
-- by a trigger, so no later edit to this table can break it by accident.
--
-- APPLIED 7 October 2026, in small pieces (club_offer_1 to club_offer_8)
-- rather than as this one file, because the first three attempts were cancelled
-- by the "drop trigger" line below (now removed). Same statements, same result,
-- read back afterwards: report totals identical to a snapshot taken before, every
-- report still security_invoker with no access for the public keys, and the
-- 10 per cent guard refusing a $40 Club Class offer.
--
-- Three things this migration is careful about:
--
--  1. RWS must never get it. RWS Club Class is pre-bought and sells out by
--     itself, and the biggest nights are not for discounting. The offer is
--     therefore opt-in PER NIGHT (events.fallback_offer_enabled, default false).
--     A night loaded later without being switched on simply has no offer. That
--     fails safe: a missing offer costs a few sales, a forgotten RWS night would
--     cost real money.
--
--  2. The price is never taken from the browser. create-checkout looks the
--     offer up here, confirms LEO really is fully booked on that night at that
--     moment, and charges the price in this table. A guest cannot ask for it on
--     a night where LEO is still on sale.
--
--  3. The reports must not lie. Every contribution figure was quantity times the
--     class margin, which would overstate a discounted ticket by the discount.
--     The discount is stored on the booking (offer_discount_minor, baht minor
--     units per seat) and taken off in every report that counts contribution.
--     With no offers in the data the reports return exactly what they did before.

-- ---------------------------------------------------------------------------
-- Which nights may show the offer
-- ---------------------------------------------------------------------------
alter table events
  add column if not exists fallback_offer_enabled boolean not null default false;

comment on column events.fallback_offer_enabled is
  'When true, a fully booked LEO Section on this night offers Club Class at the price in class_fallback_offer_prices. Off by default. Never switch on for RWS.';

-- ---------------------------------------------------------------------------
-- The offer, and its price in every currency we sell in
-- ---------------------------------------------------------------------------
create table if not exists class_fallback_offers (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id),
  code          text not null,
  from_class_id uuid not null references ticket_classes(id),
  to_class_id   uuid not null references ticket_classes(id),
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  unique (tenant_id, code),
  unique (tenant_id, from_class_id, to_class_id),
  check (from_class_id <> to_class_id)
);

create table if not exists class_fallback_offer_prices (
  offer_id    uuid not null references class_fallback_offers(id) on delete cascade,
  currency    text not null check (currency ~ '^[a-z]{3}$'),
  unit_amount integer not null check (unit_amount > 0),
  primary key (offer_id, currency)
);

-- Same posture as 0025: row level security on, no policies. Only the service
-- role (the edge functions) can read these. The public keys cannot.
alter table class_fallback_offers       enable row level security;
alter table class_fallback_offer_prices enable row level security;
revoke all on class_fallback_offers, class_fallback_offer_prices from anon, authenticated;

-- The 10 per cent cap, held in the database so it cannot be edited past.
-- Integer arithmetic on purpose: offer * 10 must be at least standing * 9.
create or replace function enforce_fallback_offer_floor() returns trigger
language plpgsql
set search_path = public as $$
declare
  standing integer;
  target   uuid;
begin
  select o.to_class_id into target from class_fallback_offers o where o.id = new.offer_id;
  select p.unit_amount into standing
    from ticket_class_prices p
   where p.ticket_class_id = target and p.currency = new.currency and p.active;
  if standing is null then
    raise exception 'No standing % price exists for the class this offer leads to.', new.currency;
  end if;
  if new.unit_amount * 10 < standing * 9 then
    raise exception 'The offer price % % is more than 10 per cent below the standing price %.',
      new.unit_amount, new.currency, standing;
  end if;
  if new.unit_amount > standing then
    raise exception 'The offer price % % is above the standing price %.',
      new.unit_amount, new.currency, standing;
  end if;
  return new;
end $$;

-- No "drop trigger if exists" here, on purpose: the trigger is new, so it would do
-- nothing, and the Supabase migration tool treats a drop as destructive and
-- cancels the whole migration. That is what blocked this file three times on
-- 7 October 2026. If this ever has to be re-run, drop the trigger by hand first.
create trigger fallback_offer_floor
  before insert or update on class_fallback_offer_prices
  for each row execute function enforce_fallback_offer_floor();

-- ---------------------------------------------------------------------------
-- What was taken, so the reports can tell the truth
-- ---------------------------------------------------------------------------
alter table checkout_reservations
  add column if not exists offer_code           text,
  add column if not exists offer_discount_minor bigint;

comment on column checkout_reservations.offer_discount_minor is
  'Baht minor units per seat taken off the standing price by an offer. NULL for an ordinary booking.';

-- ---------------------------------------------------------------------------
-- The first offer: LEO fully booked -> Club Class at 1,650 THB
--
-- Each price is the standing Club Class price times 1,650/1,800, rounded UP to a
-- whole unit of the currency, so none of them can fall under the 10 per cent
-- floor (the trigger above would refuse it if one did):
--   THB 1,650   USD 50   EUR 44   GBP 37   AUD 72   CNY 330
-- Jason can change any of these by editing a row. He asked for 1,650 baht; the
-- others follow from it.
-- ---------------------------------------------------------------------------
insert into class_fallback_offers (tenant_id, code, from_class_id, to_class_id)
select t.id, 'leo_to_club', leo.id, club.id
from tenants t
join ticket_classes leo  on leo.tenant_id  = t.id and leo.code  = 'leo_section'
join ticket_classes club on club.tenant_id = t.id and club.code = 'club_class'
where t.slug = 'muaytix'
on conflict (tenant_id, code) do nothing;

insert into class_fallback_offer_prices (offer_id, currency, unit_amount)
select o.id, v.currency, v.unit_amount
from class_fallback_offers o
cross join (values ('thb', 165000), ('usd', 5000), ('eur', 4400),
                   ('gbp', 3700),   ('aud', 7200), ('cny', 33000)) as v(currency, unit_amount)
where o.code = 'leo_to_club'
on conflict (offer_id, currency) do nothing;

-- Switched on for the ordinary nights only. RWS and the All Star night are left
-- off on purpose. Any night loaded later needs this switching on, like the
-- Third Class explanation.
update events
set fallback_offer_enabled = true
where event_key !~ '^(rws|all_star)';

-- ---------------------------------------------------------------------------
-- Reports: take the discount off the margin
-- ---------------------------------------------------------------------------
create or replace view abandoned_checkouts
with (security_invoker = true) as
 WITH attempts AS (
         SELECT r.id,
            r.created_at,
            lower(r.guest_email) AS email_key,
            r.guest_email,
            r.guest_name,
            r.quantity,
            r.currency,
            r.unit_amount,
            tc.code AS ticket_class_code,
            tc.name AS ticket_class,
            tc.margin_minor,
            r.quantity * (tc.margin_minor - COALESCE(r.offer_discount_minor, 0)) AS contribution_at_stake_minor,
            e.event_key,
            e.name AS event_name,
            e.starts_at,
            cal.local_date AS event_date,
            r.page_path,
            r.landing_page,
                CASE
                    WHEN r.click_id IS NOT NULL THEN 'google_ads'::text
                    WHEN COALESCE(r.utm_source, ''::text) <> ''::text THEN r.utm_source
                    ELSE 'unattributed'::text
                END AS channel,
            r.utm_campaign AS campaign_id,
            r.device,
            row_number() OVER (PARTITION BY (lower(r.guest_email)) ORDER BY r.created_at DESC) AS recency
           FROM checkout_reservations r
             JOIN event_ticket_classes etc ON etc.id = r.event_ticket_class_id
             JOIN ticket_classes tc ON tc.id = etc.ticket_class_id
             JOIN events e ON e.id = etc.event_id
             LEFT JOIN event_calendar cal ON cal.event_key = e.event_key
          WHERE r.completed_at IS NULL AND r.guest_email IS NOT NULL AND r.guest_email <> ''::text
        )
 SELECT created_at AS attempted_at,
    guest_email,
    guest_name,
    event_key,
    event_name,
    event_date,
    starts_at,
    ticket_class_code,
    ticket_class,
    quantity,
    currency,
    unit_amount,
    round(contribution_at_stake_minor::numeric / 100.0) AS contribution_at_stake_thb,
    channel,
    campaign_id,
    page_path,
    landing_page,
    device,
    event_date IS NOT NULL AND event_date < (now() AT TIME ZONE 'Asia/Bangkok'::text)::date AS event_has_passed
   FROM attempts a
  WHERE recency = 1 AND NOT (EXISTS ( SELECT 1
           FROM checkout_reservations p
          WHERE p.completed_at IS NOT NULL AND p.refunded_at IS NULL AND p.guest_email IS NOT NULL AND lower(p.guest_email) = a.email_key));

create or replace view booking_attribution
with (security_invoker = true) as
 SELECT r.id AS reservation_id,
    r.created_at AS booked_at,
    r.completed_at,
    e.event_key,
    e.name AS event_name,
    cal.local_date AS event_date,
    tc.code AS ticket_class_code,
    tc.name AS ticket_class,
    r.quantity,
    r.currency,
    r.unit_amount,
    r.quantity * r.unit_amount AS gross_minor,
    tc.margin_minor - COALESCE(r.offer_discount_minor, 0) AS margin_per_seat_minor,
    r.quantity * (tc.margin_minor - COALESCE(r.offer_discount_minor, 0)) AS contribution_minor,
    r.settled_amount,
    r.settled_currency,
    r.stripe_fee,
    r.card_country,
    r.payment_method_type,
    r.guest_name,
    r.guest_email,
    r.stripe_checkout_session_id,
    r.landing_page,
    r.page_path AS booked_from_page,
        CASE
            WHEN r.click_id IS NOT NULL THEN 'google_ads'::text
            WHEN COALESCE(r.utm_source, ''::text) <> ''::text THEN r.utm_source
            ELSE 'unattributed'::text
        END AS channel,
    r.click_id,
    r.click_id_kind,
    r.utm_source,
    r.utm_medium,
    r.utm_campaign AS campaign_id,
    r.ad_group_id,
    r.utm_term AS keyword,
    r.match_type,
    r.utm_content AS creative_id,
    r.device,
    r.clicked_at,
        CASE
            WHEN r.clicked_at IS NOT NULL THEN r.created_at - r.clicked_at
            ELSE NULL::interval
        END AS time_to_book
   FROM checkout_reservations r
     JOIN event_ticket_classes etc ON etc.id = r.event_ticket_class_id
     JOIN events e ON e.id = etc.event_id
     JOIN ticket_classes tc ON tc.id = etc.ticket_class_id
     LEFT JOIN event_calendar cal ON cal.event_key = e.event_key
  WHERE (r.status = ANY (ARRAY['completed'::text, 'paid_without_stock'::text])) AND r.refunded_at IS NULL;

create or replace view bookings_by_nationality
with (security_invoker = true) as
 SELECT COALESCE(r.card_country, '??'::text) AS card_country,
    count(*) AS bookings,
    sum(r.quantity) AS seats,
    round(avg(r.quantity), 1) AS avg_seats,
    count(*) FILTER (WHERE tc.code = 'ringside'::text) AS ringside,
    count(*) FILTER (WHERE tc.code = 'club_class'::text) AS club_class,
    count(*) FILTER (WHERE tc.code = 'leo_section'::text) AS leo_section,
    count(*) FILTER (WHERE tc.code = 'third_class'::text) AS third_class,
    sum(r.quantity * (tc.margin_minor - COALESCE(r.offer_discount_minor, 0))) / 100::numeric AS contribution_thb,
    round(sum(r.quantity * (tc.margin_minor - COALESCE(r.offer_discount_minor, 0))) / 100.0 / count(*)::numeric) AS contribution_per_booking_thb,
    count(*) FILTER (WHERE r.settled_amount IS NOT NULL) AS with_settlement,
    sum(r.settled_amount) AS settled_total,
    max(r.settled_currency) AS settled_currency,
    sum(r.stripe_fee) AS stripe_fees
   FROM checkout_reservations r
     JOIN event_ticket_classes etc ON etc.id = r.event_ticket_class_id
     JOIN ticket_classes tc ON tc.id = etc.ticket_class_id
  WHERE r.completed_at IS NOT NULL
  GROUP BY (COALESCE(r.card_country, '??'::text));

create or replace view contribution_by_day
with (security_invoker = true) as
 SELECT (r.completed_at AT TIME ZONE v.timezone)::date AS sold_on,
    count(*) AS bookings,
    sum(r.quantity) AS tickets,
    sum(r.quantity) FILTER (WHERE tc.code = 'ringside'::text) AS ringside,
    sum(r.quantity) FILTER (WHERE tc.code = 'club_class'::text) AS club_class,
    sum(r.quantity) FILTER (WHERE tc.code = 'leo_section'::text) AS leo_section,
    sum(r.quantity) FILTER (WHERE tc.code = 'third_class'::text) AS third_class,
    sum(r.quantity * (tc.margin_minor - COALESCE(r.offer_discount_minor, 0))) / 100::numeric AS contribution_thb,
    round(avg(tc.margin_minor - COALESCE(r.offer_discount_minor, 0)) / 100::numeric) AS avg_margin_thb
   FROM checkout_reservations r
     JOIN event_ticket_classes etc ON etc.id = r.event_ticket_class_id
     JOIN ticket_classes tc ON tc.id = etc.ticket_class_id
     JOIN events e ON e.id = etc.event_id
     JOIN venues v ON v.id = e.venue_id
  WHERE r.completed_at IS NOT NULL AND r.refunded_at IS NULL
  GROUP BY ((r.completed_at AT TIME ZONE v.timezone)::date);

create or replace view contribution_lost_by_page
with (security_invoker = true) as
 SELECT COALESCE(r.page_path, '(not recorded)'::text) AS page_path,
    count(*) AS reached_checkout,
    count(*) FILTER (WHERE r.completed_at IS NOT NULL) AS paid,
    count(*) FILTER (WHERE r.completed_at IS NULL) AS abandoned,
    sum(r.quantity) FILTER (WHERE r.completed_at IS NULL) AS seats_lost,
    sum(r.quantity * (tc.margin_minor - COALESCE(r.offer_discount_minor, 0))) FILTER (WHERE r.completed_at IS NULL) / 100::numeric AS contribution_lost_thb,
    sum(r.quantity * (tc.margin_minor - COALESCE(r.offer_discount_minor, 0))) FILTER (WHERE r.completed_at IS NOT NULL) / 100::numeric AS contribution_won_thb
   FROM checkout_reservations r
     JOIN event_ticket_classes etc ON etc.id = r.event_ticket_class_id
     JOIN ticket_classes tc ON tc.id = etc.ticket_class_id
  WHERE r.stripe_checkout_session_id IS NOT NULL
  GROUP BY (COALESCE(r.page_path, '(not recorded)'::text));

-- ---------------------------------------------------------------------------
-- The report that says whether the offer is working
--
-- Per day, Bangkok time, by the day the guest reached checkout: how many
-- guests took the offer, how many of those paid, the tickets, what was given
-- away in baht, and what the paid ones still contributed. Compare "paid" with
-- the same days' ordinary Club Class bookings to see whether it brings in new
-- guests or just cheapens ones who were buying anyway.
-- ---------------------------------------------------------------------------
create or replace view fallback_offer_by_day
with (security_invoker = true) as
select (r.created_at at time zone 'Asia/Bangkok')::date                         as day,
       r.offer_code                                                             as offer,
       count(*)                                                                 as reached_checkout,
       count(*) filter (where r.completed_at is not null and r.refunded_at is null) as paid,
       coalesce(sum(r.quantity) filter (where r.completed_at is not null and r.refunded_at is null), 0) as tickets_paid,
       coalesce(sum(r.quantity * r.offer_discount_minor)
                filter (where r.completed_at is not null and r.refunded_at is null), 0) / 100::numeric as discount_given_thb,
       coalesce(sum(r.quantity * (tc.margin_minor - r.offer_discount_minor))
                filter (where r.completed_at is not null and r.refunded_at is null), 0) / 100::numeric as contribution_thb
from checkout_reservations r
join event_ticket_classes etc on etc.id = r.event_ticket_class_id
join ticket_classes tc        on tc.id  = etc.ticket_class_id
where r.offer_code is not null
  and r.stripe_checkout_session_id is not null
group by 1, 2
order by 1 desc, 2;

comment on view fallback_offer_by_day is
  'Club Class offered to guests whose LEO choice was fully booked: who reached checkout, who paid, tickets, baht given away, contribution kept. Bangkok days.';

-- Same rule as every report (0026): the public keys get nothing.
revoke all on fallback_offer_by_day from anon, authenticated;
