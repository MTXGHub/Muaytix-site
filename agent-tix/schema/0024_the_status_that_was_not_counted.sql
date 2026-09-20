-- The status that was not counted.
--
-- Jason opened the widget an hour after 0023 went live, and the rows came back
-- like this:
--
--   classes_offered 4, available 3, sold_out 0, booking_closed 0
--
-- Four classes, three available, and nothing accounting for the fourth. The
-- statuses column showed it: third_class was 'closed'.
--
-- There are two different shut states and 0023 only counted one of them.
--
--   closed          not released for sale. Ours, deliberate. 116 rows today.
--   booking_closed  past the cutoff. The clock, not us. 65 rows today.
--
-- Very different things. One is a trading decision and the other is time
-- running out, and a report that cannot tell them apart is no use for deciding
-- anything.
--
-- dead_end was never wrong -- it counts what a guest can buy, and neither of
-- these is buyable -- so the headline figure stands. It was only the breakdown
-- underneath it that had a hole.

alter table widget_looks
  add column if not exists not_released integer
  check (not_released is null or not_released >= 0);

comment on column widget_looks.not_released is
  'Classes shown as not yet released for sale. A trading decision, unlike '
  'booking_closed, which is the cutoff passing.';

-- ---------------------------------------------------------------------------
-- Why a night had nothing to sell, which is the question dead_end raises and
-- 0023 could not answer.
-- ---------------------------------------------------------------------------
create or replace view dead_ends_by_reason as
select
  (looked_at at time zone 'Asia/Bangkok')::date            as looked_on,
  count(*)                                                 as dead_ends,
  count(*) filter (where sold_out > 0)                     as with_something_sold_out,
  count(*) filter (where booking_closed > 0)               as with_cutoff_passed,
  count(*) filter (where not_released > 0)                 as with_nothing_released,
  -- The one worth acting on: every class sold, nothing held back, clock not the
  -- problem. That is a night we could have sold more of.
  count(*) filter (where sold_out > 0
                     and coalesce(booking_closed, 0) = 0
                     and coalesce(not_released, 0) = 0)    as sold_out_outright
from widget_looks
where dead_end
group by (looked_at at time zone 'Asia/Bangkok')::date;

comment on view dead_ends_by_reason is
  'Per Bangkok day, why a look found nothing to buy: sold out, past the cutoff, '
  'or never released. sold_out_outright is the one that means lost sales.';
