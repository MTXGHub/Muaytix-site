-- Join a paid booking to the click that produced it.
--
-- Jason, 19 September 2026. Google Ads reports seven conversions from a
-- campaign. It cannot tell us that booking 1234 -- two Club Class at £41 --
-- came from the keyword "rajadamnern tickets". Without that we are optimising
-- spend against a number that has no ticket mix and no margin behind it.
--
-- The conversion tag itself already works and is not touched. What was missing
-- is the click identifier: nothing in the widget, the functions or this schema
-- captured a gclid, so there was nothing to join on.
--
-- Two things arrive together and are stored side by side:
--
--   click_id    Google's own identifier for the click. Opaque to us; its only
--               job is to let Google reconcile a conversion, and to mark a
--               booking as paid-for rather than free.
--
--   the utm_*   Filled by Google's ValueTrack macros in the final URL suffix,
--   columns     so the campaign, ad group and keyword land in OUR database and
--               can be joined to ticket class and margin in plain SQL. The
--               click id alone cannot do that without a Google Ads API call.
--
-- Deliberately not here: the search term. Google does not expose the words a
-- guest actually typed against an individual click, by any route, so promising
-- it would only fail later.
--
-- Every column is nullable. Most bookings have no attribution at all -- direct,
-- WhatsApp, a returning guest -- and those are ordinary bookings, not broken
-- ones. Nothing in the booking path may ever fail for want of these.

alter table checkout_reservations
  add column click_id      text,
  add column click_id_kind text,
  add column utm_source    text,
  add column utm_medium    text,
  add column utm_campaign  text,
  add column utm_term      text,
  add column utm_content   text,
  add column ad_group_id   text,
  add column match_type    text,
  add column device        text,
  add column clicked_at    timestamptz;

comment on column checkout_reservations.click_id is
  'gclid, gbraid or wbraid, exactly as Google sent it. Opaque.';
comment on column checkout_reservations.click_id_kind is
  'Which of the three the click_id is, so it is never guessed at from its shape.';
comment on column checkout_reservations.utm_term is
  'The KEYWORD that matched, from {keyword}. Not the search term -- that cannot be had per click.';
comment on column checkout_reservations.clicked_at is
  'When the guest arrived from the advert, not when they booked. The gap between the two is the deciding time.';

-- gbraid and wbraid replace gclid on iOS app and web-to-app traffic, so all
-- three have to be accepted; anything else is a sign the widget sent junk.
alter table checkout_reservations
  add constraint checkout_reservations_click_id_kind_check
  check (click_id_kind is null or click_id_kind in ('gclid','gbraid','wbraid'));

-- Only worth an index for the attributed minority.
create index checkout_reservations_click_id_idx
  on checkout_reservations (click_id) where click_id is not null;

-- ---------------------------------------------------------------------------
-- The report the whole exercise exists for.
--
-- One row per paid booking, carrying what was sold beside what was clicked.
-- Bookings with no attribution are included and simply show nulls: leaving them
-- out would make paid search look like the only thing that sells tickets.
-- ---------------------------------------------------------------------------
create or replace view booking_attribution as
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
  'One row per paid booking: what was sold, and which advert click paid for it. '
  'Unattributed bookings are included with nulls -- dropping them would make '
  'paid search look like the only thing selling tickets.';
