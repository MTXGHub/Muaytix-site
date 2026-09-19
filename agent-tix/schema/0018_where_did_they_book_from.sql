-- Which page they entered on, and which page they were standing on when they
-- pressed Reserve.
--
-- Jason, 19 September 2026. GA4 can say where a converting session started, but
-- it cannot say which page the booking was made from, because the conversion tag
-- fires on /payment-successful -- so in Google's eyes every booking on the site
-- happens on the thank-you page. Worse, one booking in six shows
-- /payment-successful as its LANDING page too: coming back from Stripe starts a
-- fresh GA4 session, and the original source is lost.
--
-- Neither problem exists if we write it down ourselves. The widget knows exactly
-- what page it is on, and it knows it for abandoned checkouts as well as paid
-- ones -- which is the half GA4 can never show, because an abandoned checkout
-- fires no conversion at all.
--
--   landing_page  The first page of this visit, remembered per browser tab.
--                 Captured for every visitor, not only the ones who arrived on
--                 an advert, so direct and organic traffic are covered too.
--
--   page_path     The page the widget was on at the moment Reserve was pressed.
--
-- Path only. The query string is deliberately thrown away before either is
-- stored: it is where an email address or a name ends up when someone shares a
-- link, and none of that belongs in a funnel report.
--
-- Both nullable. A visit through an old cached copy of the widget sends neither,
-- and that is an ordinary booking, not a broken one.

alter table checkout_reservations
  add column page_path    text,
  add column landing_page text;

comment on column checkout_reservations.page_path is
  'Path the widget was on when Reserve was pressed. No query string, ever.';
comment on column checkout_reservations.landing_page is
  'First path of the visit, per browser tab. Answers what GA4 loses when a guest returns from Stripe.';

-- The funnel report is grouped by these, so they are worth an index once there
-- is enough traffic to make the group-by cost anything.
create index checkout_reservations_page_path_idx
  on checkout_reservations (page_path) where page_path is not null;

-- ---------------------------------------------------------------------------
-- The report this exists for: per page, who reached Stripe and who paid.
--
-- Only rows that actually reached the checkout are counted. A reservation with
-- no Stripe session never got as far as a payment page, so counting it as an
-- abandonment would blame the page for a seat that was merely held.
--
-- refunded counts as paid. The customer did buy; a refund is a later, separate
-- event and folding it in here would make a page look like it failed to sell.
-- ---------------------------------------------------------------------------
create or replace view checkout_funnel_by_page as
with tried as (
  select
    coalesce(r.page_path, '(not recorded)')    as page_path,
    coalesce(r.landing_page, '(not recorded)') as landing_page,
    r.quantity,
    r.completed_at is not null                 as paid
  from checkout_reservations r
  where r.stripe_checkout_session_id is not null
)
select
  page_path,
  count(*)                                        as reached_checkout,
  count(*) filter (where paid)                    as paid,
  count(*) filter (where not paid)                as abandoned,
  sum(quantity) filter (where not paid)           as seats_lost,
  round(100.0 * count(*) filter (where paid) / count(*), 1) as paid_pct
from tried
group by page_path;

comment on view checkout_funnel_by_page is
  'Per booking page: reached the Stripe page, paid, walked away, and how many '
  'seats walked with them. The half of the funnel GA4 cannot show, because an '
  'abandoned checkout fires no conversion.';

-- ---------------------------------------------------------------------------
-- The same by entry page, which is the one GA4 gets wrong rather than misses.
-- ---------------------------------------------------------------------------
create or replace view checkout_funnel_by_landing_page as
select
  coalesce(r.landing_page, '(not recorded)')      as landing_page,
  count(*)                                        as reached_checkout,
  count(*) filter (where r.completed_at is not null) as paid,
  count(*) filter (where r.completed_at is null)  as abandoned,
  sum(r.quantity) filter (where r.completed_at is null) as seats_lost,
  round(100.0 * count(*) filter (where r.completed_at is not null)
        / count(*), 1)                            as paid_pct
from checkout_reservations r
where r.stripe_checkout_session_id is not null
group by coalesce(r.landing_page, '(not recorded)');

comment on view checkout_funnel_by_landing_page is
  'Per entry page: how many of the people who started there reached the checkout '
  'and paid. Ours rather than GA4s, so a return from Stripe does not reset it.';

-- ---------------------------------------------------------------------------
-- Both pages carried onto the existing per-booking report, so the click, the
-- entry page, the booking page and the ticket sold all sit on one row.
-- ---------------------------------------------------------------------------
-- Dropped rather than replaced: the two new columns sit in the middle of the
-- column list, and Postgres will not let create-or-replace reorder a view.
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
  'One row per paid booking: what was sold, which page it was bought from, and '
  'which advert click paid for it. Unattributed bookings are included with '
  'nulls -- dropping them would make paid search look like the only thing '
  'selling tickets.';
