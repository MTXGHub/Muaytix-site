-- What we put in front of them.
--
-- Jason, 20 September 2026. Of 2,032 sessions in a fortnight, 202 reached the
-- checkout. Everything this system records begins at that 202 -- which means
-- ninety per cent of the people who came to the site are, to us, a number in
-- Google Analytics and nothing else. We do not know whether they were shown a
-- sold out night, whether they flicked through four dates looking for something
-- we do not run, or whether they never opened the widget at all.
--
-- His decision on how to find out, and it is the right one: do not ask them.
-- No pop-up, no email box, no "just tell us why you are leaving". Not asking is
-- a thing this company is quietly good at and it is not being traded away for a
-- survey response.
--
-- So this records the only half of the conversation we are entitled to: what WE
-- said. Every time the widget asks the server what is on sale, the server
-- already knows the answer it gave. Until now it threw it away.
--
-- What is kept is what we served: which night, which page it was served to, and
-- what state the seats were in at that moment. What is NOT kept is anything
-- about the person -- no address, no IP, no user agent, no identifier of any
-- kind, and nothing that could be joined to one later. The page path only, with
-- the query string cut off, on the same reasoning as 0018: a shared link is
-- where an email address or a name ends up.
--
-- The cost of that restraint, stated plainly because it will be missed
-- otherwise: these are LOOKS, not people. Four rows may be one guest going
-- through four nights or four guests going through one. Totals are sound;
-- journeys are not available and will not be until the widget itself carries a
-- session marker. Getting them by fingerprinting a phone would be worse than
-- the problem.
--
-- One design rule outranks the lot: the widget must never wait for this. The
-- guest gets their answer and the row is written afterwards, or not at all.

create table if not exists widget_looks (
  id              bigserial primary key,
  looked_at       timestamptz not null default now(),

  -- Which of the three questions the widget asked.
  --   events        the calendar: which nights are on between two dates
  --   classes       the catalogue: which seat classes exist
  --   availability  one night: what is on sale tonight
  action          text not null check (action in ('events', 'classes', 'availability')),

  -- The page the widget was sitting on. Path only, query string removed.
  page_path       text,

  -- For a calendar look.
  from_date       date,
  to_date         date,
  class_code      text,
  nights_offered  integer check (nights_offered is null or nights_offered >= 0),

  -- For one night.
  event_key       text,
  event_date      date,
  classes_offered integer check (classes_offered is null or classes_offered >= 0),
  available       integer check (available       is null or available       >= 0),
  limited         integer check (limited         is null or limited         >= 0),
  sold_out        integer check (sold_out        is null or sold_out        >= 0),
  booking_closed  integer check (booking_closed  is null or booking_closed  >= 0),

  -- Nothing on the night could be bought. The single most useful column here.
  dead_end        boolean not null default false,
  -- The night was asked for by name and does not exist. A stale link, an old
  -- advert, or a page still pointing at a night that has been taken down.
  not_found       boolean not null default false,

  -- Per class, code to status, for questions not thought of yet.
  statuses        jsonb
);

comment on table widget_looks is
  'One row per question the widget asked the server, and the answer it got. '
  'What we served, never who we served it to: no address, no IP, no user agent, '
  'no identifier. Looks, not people -- totals are sound, journeys are not.';

comment on column widget_looks.dead_end is
  'True when the night was looked at and nothing on it could be bought.';

create index if not exists widget_looks_looked_at_idx on widget_looks (looked_at desc);
create index if not exists widget_looks_event_idx on widget_looks (event_key) where event_key is not null;

-- ---------------------------------------------------------------------------
-- The day's shape. Bangkok day, like every other report here.
-- ---------------------------------------------------------------------------
create or replace view widget_looks_by_day as
select
  (looked_at at time zone 'Asia/Bangkok')::date          as looked_on,
  count(*)                                               as looks,
  count(*) filter (where action = 'availability')        as night_looks,
  count(*) filter (where action = 'events')              as calendar_looks,
  count(*) filter (where dead_end)                       as dead_ends,
  round(100.0 * count(*) filter (where dead_end)
        / nullif(count(*) filter (where action = 'availability'), 0), 1)
                                                         as dead_end_pct,
  count(*) filter (where not_found)                      as not_found,
  count(distinct event_key)                              as nights_looked_at
from widget_looks
group by (looked_at at time zone 'Asia/Bangkok')::date;

comment on view widget_looks_by_day is
  'Per Bangkok day: how often the widget asked, and how often the answer was '
  'that nothing could be bought.';

-- ---------------------------------------------------------------------------
-- Which nights get looked at, and which of those looks were wasted. A night
-- with heavy interest and a high dead end rate is money walking away before the
-- checkout is ever reached -- which is the whole reason this table exists.
-- ---------------------------------------------------------------------------
create or replace view widget_looks_by_event as
select
  w.event_key,
  max(w.event_date)                                      as event_date,
  count(*)                                               as looks,
  count(*) filter (where w.dead_end)                     as dead_ends,
  round(100.0 * count(*) filter (where w.dead_end) / count(*), 1) as dead_end_pct,
  round(avg(w.available))                                as avg_classes_available,
  min(w.looked_at)                                       as first_look,
  max(w.looked_at)                                       as last_look
from widget_looks w
where w.action = 'availability' and w.event_key is not null
group by w.event_key;

comment on view widget_looks_by_event is
  'Per fight night: how many times it was looked at and how often there was '
  'nothing to sell. Heavy looks plus a high dead end rate is demand we turned away.';

-- ---------------------------------------------------------------------------
-- Which pages the widget is actually being used on, and where it disappoints.
-- Pairs with contribution_lost_by_page, which only sees people who got as far
-- as the checkout.
-- ---------------------------------------------------------------------------
create or replace view widget_looks_by_page as
select
  coalesce(page_path, '(not recorded)')                  as page_path,
  count(*)                                               as looks,
  count(*) filter (where action = 'availability')        as night_looks,
  count(*) filter (where dead_end)                       as dead_ends,
  round(100.0 * count(*) filter (where dead_end)
        / nullif(count(*) filter (where action = 'availability'), 0), 1)
                                                         as dead_end_pct,
  count(distinct event_key)                              as nights_looked_at
from widget_looks
group by coalesce(page_path, '(not recorded)');

comment on view widget_looks_by_page is
  'Per page carrying the widget: how much it is used and how often it has '
  'nothing to offer.';

-- ---------------------------------------------------------------------------
-- The join that was the point of all this: looks, then checkouts, then sales,
-- on one line. The first time the top of the funnel has been visible at all.
-- ---------------------------------------------------------------------------
create or replace view look_to_sale_by_day as
with looks as (
  select (looked_at at time zone 'Asia/Bangkok')::date as day,
         count(*) filter (where action = 'availability') as night_looks,
         count(*) filter (where dead_end)                as dead_ends
  from widget_looks
  group by (looked_at at time zone 'Asia/Bangkok')::date
),
checkouts as (
  select (r.created_at at time zone 'Asia/Bangkok')::date as day,
         count(*)                                         as started,
         count(*) filter (where r.completed_at is not null) as paid
  from checkout_reservations r
  where r.stripe_checkout_session_id is not null
  group by (r.created_at at time zone 'Asia/Bangkok')::date
)
select
  coalesce(l.day, c.day)                                 as day,
  l.night_looks,
  l.dead_ends,
  c.started                                              as checkouts_started,
  c.paid,
  round(100.0 * c.started / nullif(l.night_looks, 0), 1) as look_to_checkout_pct,
  round(100.0 * c.paid    / nullif(c.started, 0), 1)     as checkout_to_paid_pct
from looks l
full outer join checkouts c on c.day = l.day;

comment on view look_to_sale_by_day is
  'Looks at a night, checkouts started, sales taken, per Bangkok day. Days '
  'before widget_looks began show no look figures -- that is the record starting, '
  'not a collapse in interest.';
