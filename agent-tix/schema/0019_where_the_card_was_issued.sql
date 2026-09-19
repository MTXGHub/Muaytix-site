-- Where the card was issued, and what the sale was actually worth.
--
-- Jason, 19 September 2026. Nationality is worked out by hand today, from the
-- card ISSUER country rather than the cardholder's address -- his words: "not an
-- exact science, but it's the closest metric we've got". He is right that it is
-- the best available, and right that it is not exact: an expat on a Thai card
-- reads as Thailand. That caveat travels with the column, it is not fixed here.
--
-- It matters because the other country figure we have is wrong for this job.
-- GA4 reads the visitor's IP, so it reports WHERE SOMEONE WAS SITTING, not who
-- they are -- which is why GA4 shows Thailand converting at 7.3% while Thai
-- nationals are 3% of sales. Both numbers are useful; they are different
-- questions, and only one of them belongs on a booking.
--
-- Stripe already knows the issuer country on every card payment and we were
-- storing none of it. Five columns, all from the same charge:
--
--   card_country          Two letters, the issuing country. NULL for a payment
--                         method that has no card behind it.
--
--   payment_method_type   'card', 'alipay', 'wechat_pay', 'promptpay' and so on.
--                         Without this a NULL card_country is ambiguous -- was
--                         it not reported, or was it Alipay? Alipay and WeChat
--                         Pay carry no issuer country at all, and those are a
--                         market with marketing behind it, so the distinction is
--                         not academic. An Apple Pay or Google Pay payment comes
--                         through as 'card' and DOES carry a country, which
--                         matters here because most bookings are Apple Pay.
--
--   settled_amount        What the sale is worth in ONE currency -- the payout
--                         currency -- taken from Stripe's balance transaction.
--   settled_currency
--   stripe_fee            What Stripe took, same currency.
--
-- The settlement figures are slightly more than was asked for, and deliberate.
-- Every report built today has had to stop short of a total because bookings
-- arrive in six currencies and inventing an exchange rate would be worse than
-- saying nothing. Stripe has already done that conversion at the real rate;
-- this just records the answer. It is what makes "which nationality spends the
-- most" a question with a number behind it rather than an impression.
--
-- All nullable, and none of it may ever cost a booking. The webhook reads these
-- from Stripe AFTER the sale is recorded, and a failure there is logged and
-- swallowed -- the payment has already happened.
--
-- Going forward only. Stripe has already delivered the events for past
-- bookings; those rows stay blank.

alter table checkout_reservations
  add column card_country        text,
  add column payment_method_type text,
  add column settled_amount      bigint,
  add column settled_currency    text,
  add column stripe_fee          bigint;

comment on column checkout_reservations.card_country is
  'ISO country of the card ISSUER, not the cardholder address. Null for Alipay, WeChat Pay and similar. Closest available proxy for nationality, not exact.';
comment on column checkout_reservations.payment_method_type is
  'Stripe payment method type, so a null card_country can be told apart from a method that has no country.';
comment on column checkout_reservations.settled_amount is
  'Sale value in the payout currency, from Stripe balance transaction. The only figure comparable across currencies.';
comment on column checkout_reservations.stripe_fee is
  'What Stripe took, in the payout currency.';

-- Two letters, upper case, or nothing. A malformed value would quietly split one
-- country into two rows in every report below.
alter table checkout_reservations
  add constraint checkout_reservations_card_country_check
  check (card_country is null or card_country ~ '^[A-Z]{2}$');

create index checkout_reservations_card_country_idx
  on checkout_reservations (card_country) where card_country is not null;

-- ---------------------------------------------------------------------------
-- The report that replaces the manual exercise.
--
-- One row per issuing country: how many bookings, how many seats, how big a
-- basket, which seats they choose, and what it settled for.
--
-- Seats and basket size are reported as well as money on purpose. They are
-- currency-free, so they are trustworthy for a country whose bookings predate
-- the settlement columns, and for a ticket agent "do they buy the expensive
-- seats" is the question behind "do they spend more".
-- ---------------------------------------------------------------------------
create or replace view bookings_by_nationality as
select
  coalesce(r.card_country, '??')                          as card_country,
  count(*)                                                as bookings,
  sum(r.quantity)                                         as seats,
  round(avg(r.quantity), 1)                               as avg_seats,
  count(*) filter (where tc.code = 'ringside')            as ringside,
  count(*) filter (where tc.code = 'club_class')          as club_class,
  count(*) filter (where tc.code = 'leo_section')         as leo_section,
  count(*) filter (where tc.code = 'third_class')         as third_class,
  -- Only the rows Stripe has settled figures for, so a part-filled country does
  -- not look like a cheap one.
  count(*) filter (where r.settled_amount is not null)    as with_settlement,
  sum(r.settled_amount)                                   as settled_total,
  round(avg(r.settled_amount))                            as settled_per_booking,
  max(r.settled_currency)                                 as settled_currency,
  sum(r.stripe_fee)                                       as stripe_fees
from checkout_reservations r
join event_ticket_classes etc on etc.id = r.event_ticket_class_id
join ticket_classes tc        on tc.id = etc.ticket_class_id
where r.completed_at is not null
group by coalesce(r.card_country, '??');

comment on view bookings_by_nationality is
  'One row per card-issuing country: bookings, seats, basket size, seat-class '
  'mix and what it settled for. Replaces working nationality out by hand. '
  'Issuer country is a proxy, not a fact -- an expat on a local card reads local.';

-- ---------------------------------------------------------------------------
-- How they paid, which is a trading question in its own right: Alipay and
-- WeChat Pay were switched on for a market with marketing behind it, and this
-- is the only place that says whether anyone uses them.
-- ---------------------------------------------------------------------------
create or replace view bookings_by_payment_method as
select
  coalesce(r.payment_method_type, '(not recorded)')    as payment_method,
  count(*)                                            as bookings,
  sum(r.quantity)                                     as seats,
  round(avg(r.quantity), 1)                           as avg_seats,
  count(distinct r.card_country)                      as countries,
  sum(r.settled_amount)                               as settled_total,
  max(r.settled_currency)                             as settled_currency
from checkout_reservations r
where r.completed_at is not null
group by coalesce(r.payment_method_type, '(not recorded)');

comment on view bookings_by_payment_method is
  'One row per Stripe payment method: who actually uses Alipay, WeChat Pay and '
  'the wallets, and what they are worth.';

-- ---------------------------------------------------------------------------
-- Carried onto the per-booking report, so nationality sits beside the ticket
-- sold, the page it was bought from and the advert that paid for it. That join
-- is the whole point: nationality against seat class against page against
-- click, in one query instead of an afternoon.
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
  -- What it was actually worth, in one currency, after Stripe's conversion.
  r.settled_amount,
  r.settled_currency,
  r.stripe_fee,
  -- Who they are, as closely as we can get: the card issuer's country.
  r.card_country,
  r.payment_method_type,
  r.guest_name,
  r.guest_email,
  r.stripe_checkout_session_id,
  -- Where they came in, and where they were standing when they bought.
  r.landing_page,
  r.page_path                            as booked_from_page,
  -- Paid search, some other tagged source, or nothing we can name.
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
  -- How long they took to decide. Null when we never saw the click.
  case when r.clicked_at is not null
       then r.created_at - r.clicked_at end as time_to_book
from checkout_reservations r
join event_ticket_classes etc on etc.id = r.event_ticket_class_id
join events e                 on e.id  = etc.event_id
join ticket_classes tc        on tc.id = etc.ticket_class_id
-- The Bangkok calendar day lives on the venue, not the event, and event_calendar
-- has already done that join.
left join event_calendar cal  on cal.event_key = e.event_key
where r.status in ('completed', 'paid_without_stock')
  and r.refunded_at is null;

comment on view booking_attribution is
  'One row per paid booking: what was sold, what it settled for, where the card '
  'was issued, which page it was bought from, and which advert click paid for '
  'it. Unattributed bookings are included with nulls -- dropping them would '
  'make paid search look like the only thing selling tickets.';
