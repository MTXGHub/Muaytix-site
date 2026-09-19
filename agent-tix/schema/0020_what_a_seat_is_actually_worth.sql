-- What a seat is actually worth to us.
--
-- Jason, 19 September 2026. Every report so far counts tickets. Tickets are not
-- what the business runs on: Club Class at 64% of volume is one sentence, and
-- Club Class at 600 baht a seat is a different one entirely. Third Class looked
-- like a problem all afternoon purely because nothing here knew it earns 250
-- against the others' 600 -- his words, "negligible ... in the grand scheme of
-- things", and the numbers below are why he is right.
--
-- His figures, per seat, in baht:
--
--   Ringside      625
--   Club Class    600
--   LEO Section   600
--   Third Class   250
--
-- Stored in satang, like every other money column here, so nothing has to
-- remember which columns are major units and which are minor.
--
-- Baht regardless of what the guest paid in. This is OUR margin on a seat, not
-- a conversion of their payment, so it sums cleanly across the six currencies
-- bookings arrive in -- which is the first figure in this whole system that
-- does. Revenue still cannot be totalled without Stripe's settlement figure;
-- contribution can.
--
-- The honest limit: it is a standing margin per class, not a per-night cost. A
-- night bought cheap or a seat upgraded at our expense is not reflected here,
-- and nor is FX drift on a foreign sale. It is the figure Jason trades on, and
-- recording it beats deriving it -- but it is a rate, not an invoice.
--
-- Per class rather than per event on purpose. If a night is ever bought at a
-- different rate, this becomes a default and an override goes on
-- event_ticket_classes; there is no reason to carry that complexity yet.

alter table ticket_classes
  add column margin_minor    bigint,
  add column margin_currency text not null default 'thb';

comment on column ticket_classes.margin_minor is
  'Our margin on one seat, in satang. Baht whatever the guest paid in, so it sums across currencies.';
comment on column ticket_classes.margin_currency is
  'Currency of margin_minor. Baht throughout -- present so a second agent in another country needs no schema change.';

alter table ticket_classes
  add constraint ticket_classes_margin_minor_check
  check (margin_minor is null or margin_minor >= 0);

update ticket_classes set margin_minor = 62500 where code = 'ringside';
update ticket_classes set margin_minor = 60000 where code = 'club_class';
update ticket_classes set margin_minor = 60000 where code = 'leo_section';
update ticket_classes set margin_minor = 25000 where code = 'third_class';

-- ---------------------------------------------------------------------------
-- The trading report: what each day actually made.
--
-- Sold on the Bangkok day the money arrived, not the night the fight is on --
-- that is the question a trader asks at the end of a day.
-- ---------------------------------------------------------------------------
create or replace view contribution_by_day as
select
  (r.completed_at at time zone v.timezone)::date            as sold_on,
  count(*)                                                  as bookings,
  sum(r.quantity)                                           as tickets,
  sum(r.quantity) filter (where tc.code = 'ringside')       as ringside,
  sum(r.quantity) filter (where tc.code = 'club_class')     as club_class,
  sum(r.quantity) filter (where tc.code = 'leo_section')    as leo_section,
  sum(r.quantity) filter (where tc.code = 'third_class')    as third_class,
  -- The figure the day is actually judged on.
  sum(r.quantity * tc.margin_minor) / 100                   as contribution_thb,
  round(avg(tc.margin_minor) / 100)                         as avg_margin_thb
from checkout_reservations r
join event_ticket_classes etc on etc.id = r.event_ticket_class_id
join ticket_classes tc        on tc.id  = etc.ticket_class_id
join events e                 on e.id   = etc.event_id
join venues v                 on v.id   = e.venue_id
where r.completed_at is not null
  and r.refunded_at is null
group by (r.completed_at at time zone v.timezone)::date;

comment on view contribution_by_day is
  'Per Bangkok trading day: bookings, tickets by class, and what it contributed '
  'in baht. Contribution sums across currencies because the margin is ours, in '
  'baht, whatever the guest paid in.';

-- ---------------------------------------------------------------------------
-- What the losses actually cost. The 178 seats abandoned in a fortnight were
-- only ever a seat count; this is the money.
-- ---------------------------------------------------------------------------
create or replace view contribution_lost_by_page as
select
  coalesce(r.page_path, '(not recorded)')                   as page_path,
  count(*)                                                  as reached_checkout,
  count(*) filter (where r.completed_at is not null)        as paid,
  count(*) filter (where r.completed_at is null)            as abandoned,
  sum(r.quantity) filter (where r.completed_at is null)     as seats_lost,
  sum(r.quantity * tc.margin_minor)
    filter (where r.completed_at is null) / 100             as contribution_lost_thb,
  sum(r.quantity * tc.margin_minor)
    filter (where r.completed_at is not null) / 100         as contribution_won_thb
from checkout_reservations r
join event_ticket_classes etc on etc.id = r.event_ticket_class_id
join ticket_classes tc        on tc.id  = etc.ticket_class_id
where r.stripe_checkout_session_id is not null
group by coalesce(r.page_path, '(not recorded)');

comment on view contribution_lost_by_page is
  'Per booking page: what walked away, in baht rather than in seats.';

-- ---------------------------------------------------------------------------
-- Nationality, rebuilt on contribution. "Which markets are worth the most" is a
-- different question from "which buy the most seats", and this is the one that
-- decides where advertising money goes.
-- ---------------------------------------------------------------------------
-- Dropped rather than replaced: contribution sits in the middle of the column
-- list, and Postgres will not let create-or-replace reorder a view.
drop view if exists bookings_by_nationality;

create view bookings_by_nationality as
select
  coalesce(r.card_country, '??')                          as card_country,
  count(*)                                                as bookings,
  sum(r.quantity)                                         as seats,
  round(avg(r.quantity), 1)                               as avg_seats,
  count(*) filter (where tc.code = 'ringside')            as ringside,
  count(*) filter (where tc.code = 'club_class')          as club_class,
  count(*) filter (where tc.code = 'leo_section')         as leo_section,
  count(*) filter (where tc.code = 'third_class')         as third_class,
  sum(r.quantity * tc.margin_minor) / 100                 as contribution_thb,
  round(sum(r.quantity * tc.margin_minor) / 100.0 / count(*)) as contribution_per_booking_thb,
  count(*) filter (where r.settled_amount is not null)    as with_settlement,
  sum(r.settled_amount)                                   as settled_total,
  max(r.settled_currency)                                 as settled_currency,
  sum(r.stripe_fee)                                       as stripe_fees
from checkout_reservations r
join event_ticket_classes etc on etc.id = r.event_ticket_class_id
join ticket_classes tc        on tc.id = etc.ticket_class_id
where r.completed_at is not null
group by coalesce(r.card_country, '??');

comment on view bookings_by_nationality is
  'One row per card-issuing country: bookings, seats, seat-class mix, and what '
  'the market is worth in baht. Issuer country is a proxy, not a fact.';

-- ---------------------------------------------------------------------------
-- Margin carried onto the per-booking report, so one row now answers: what was
-- sold, what it earned us, who bought it, from which page, off which advert.
-- ---------------------------------------------------------------------------
drop view if exists booking_attribution;

create view booking_attribution as
select
  r.id                                   as reservation_id,
  r.created_at                           as booked_at,
  r.completed_at,
  e.event_key,
  e.name                                 as event_name,
  cal.local_date                         as event_date,
  tc.code                                as ticket_class_code,
  tc.name                                as ticket_class,
  r.quantity,
  r.currency,
  r.unit_amount,
  r.quantity * r.unit_amount             as gross_minor,
  -- What it earned us, in baht, however they paid.
  tc.margin_minor                        as margin_per_seat_minor,
  r.quantity * tc.margin_minor           as contribution_minor,
  r.settled_amount,
  r.settled_currency,
  r.stripe_fee,
  r.card_country,
  r.payment_method_type,
  r.guest_name,
  r.guest_email,
  r.stripe_checkout_session_id,
  r.landing_page,
  r.page_path                            as booked_from_page,
  case
    when r.click_id is not null                       then 'google_ads'
    when coalesce(r.utm_source, '') <> ''             then r.utm_source
    else 'unattributed'
  end                                    as channel,
  r.click_id,
  r.click_id_kind,
  r.utm_source,
  r.utm_medium,
  r.utm_campaign                         as campaign_id,
  r.ad_group_id,
  r.utm_term                             as keyword,
  r.match_type,
  r.utm_content                          as creative_id,
  r.device,
  r.clicked_at,
  case when r.clicked_at is not null
       then r.created_at - r.clicked_at end as time_to_book
from checkout_reservations r
join event_ticket_classes etc on etc.id = r.event_ticket_class_id
join events e                 on e.id  = etc.event_id
join ticket_classes tc        on tc.id = etc.ticket_class_id
left join event_calendar cal  on cal.event_key = e.event_key
where r.status in ('completed', 'paid_without_stock')
  and r.refunded_at is null;

comment on view booking_attribution is
  'One row per paid booking: what was sold, what it earned us in baht, what it '
  'settled for, where the card was issued, which page it was bought from and '
  'which advert click paid for it.';
