-- The ones who nearly booked.
--
-- Jason, 20 September 2026. Of 202 checkouts in a fortnight, 99 paid and 103
-- did not -- and every one of those 103 is anonymous, because the email only
-- ever arrives with the payment. A hundred people who were a minute away from
-- buying a Muay Thai ticket in Bangkok, and not one address between them.
--
-- This changes nothing about the checkout. It does not hold a seat a second
-- longer, does not slow anyone down, and does not argue with the decision taken
-- on 6 September that we sell tickets rather than keep them. The seats still
-- come back inside six minutes. The only difference is that when Stripe tells
-- us a session expired, we now keep the address the guest had already typed
-- into it.
--
-- No new columns: guest_email and guest_name already exist, and an abandoned
-- checkout is the same row as a paid one, at an earlier stage. What is new is a
-- place to read them from.
--
-- Two things the view does on its own, because getting them wrong is the
-- difference between a useful list and an embarrassment:
--
--   It drops anyone who has since bought, on any booking, under that address.
--   Somebody who was beaten by the clock and came straight back must never be
--   written to as a lost customer.
--
--   It keeps one row per address -- the most recent attempt -- so a guest who
--   tried three times in ten minutes is one person on the list, not three.
--
-- A note that is not a technical one. These addresses are given in the course
-- of negotiating a sale, which is the narrow ground UK soft opt-in stands on.
-- Anything sent to this list needs a plain unsubscribe and needs to be about
-- the thing they were trying to buy. It is not a marketing list.

-- ---------------------------------------------------------------------------
-- Who to write to, and what they were after.
-- ---------------------------------------------------------------------------
create or replace view abandoned_checkouts as
with attempts as (
  select
    r.id,
    r.created_at,
    lower(r.guest_email)                       as email_key,
    r.guest_email,
    r.guest_name,
    r.quantity,
    r.currency,
    r.unit_amount,
    tc.code                                    as ticket_class_code,
    tc.name                                    as ticket_class,
    tc.margin_minor,
    r.quantity * tc.margin_minor               as contribution_at_stake_minor,
    e.event_key,
    e.name                                     as event_name,
    e.starts_at,
    cal.local_date                             as event_date,
    r.page_path,
    r.landing_page,
    case
      when r.click_id is not null           then 'google_ads'
      when coalesce(r.utm_source, '') <> '' then r.utm_source
      else 'unattributed'
    end                                        as channel,
    r.utm_campaign                             as campaign_id,
    r.device,
    row_number() over (
      partition by lower(r.guest_email) order by r.created_at desc
    )                                          as recency
  from public.checkout_reservations r
  join public.event_ticket_classes etc on etc.id = r.event_ticket_class_id
  join public.ticket_classes tc        on tc.id  = etc.ticket_class_id
  join public.events e                 on e.id   = etc.event_id
  left join public.event_calendar cal  on cal.event_key = e.event_key
  where r.completed_at is null
    and r.guest_email is not null
    and r.guest_email <> ''
)
select
  a.created_at                       as attempted_at,
  a.guest_email,
  a.guest_name,
  a.event_key,
  a.event_name,
  a.event_date,
  a.starts_at,
  a.ticket_class_code,
  a.ticket_class,
  a.quantity,
  a.currency,
  a.unit_amount,
  round(a.contribution_at_stake_minor / 100.0)  as contribution_at_stake_thb,
  a.channel,
  a.campaign_id,
  a.page_path,
  a.landing_page,
  a.device,
  -- Has the night they wanted already been and gone?
  (a.event_date is not null and a.event_date < (now() at time zone 'Asia/Bangkok')::date)
                                                as event_has_passed
from attempts a
where a.recency = 1
  -- Never write to somebody who has since bought.
  and not exists (
    select 1
    from public.checkout_reservations p
    where p.completed_at is not null
      and p.refunded_at is null
      and p.guest_email is not null
      and lower(p.guest_email) = a.email_key
  );

comment on view abandoned_checkouts is
  'One row per person who reached the checkout, left an address and did not buy. '
  'Most recent attempt only, and anyone who has since bought is excluded. '
  'Addresses given while negotiating a sale -- not a marketing list.';

-- ---------------------------------------------------------------------------
-- How much of the anonymous 103 this is actually recovering, by day. Worth
-- watching for a fortnight: if Stripe rarely carries an address on an expired
-- session, this was not worth building and the number will say so.
-- ---------------------------------------------------------------------------
create or replace view abandoned_capture_by_day as
select
  (r.created_at at time zone v.timezone)::date              as attempted_on,
  count(*)                                                  as abandoned,
  count(*) filter (where r.guest_email is not null
                     and r.guest_email <> '')               as with_email,
  round(100.0 * count(*) filter (where r.guest_email is not null
                                   and r.guest_email <> '')
        / nullif(count(*), 0), 1)                           as capture_rate_pct,
  sum(r.quantity)                                           as seats
from public.checkout_reservations r
join public.event_ticket_classes etc on etc.id = r.event_ticket_class_id
join public.events e                 on e.id   = etc.event_id
join public.venues v                 on v.id   = e.venue_id
where r.completed_at is null
  and r.stripe_checkout_session_id is not null
group by (r.created_at at time zone v.timezone)::date;

comment on view abandoned_capture_by_day is
  'Per Bangkok day: abandoned checkouts, and how many of them left an address. '
  'The honest test of whether capturing the email was worth doing.';
