-- Let a night keep selling after the fights have started.
--
-- Jason, 6 September 2026: on the long Sunday and midweek cards the show runs
-- roughly four hours, and a good number of guests arrive late on purpose --
-- they skip the early bouts, walk in around the interval and watch the main
-- card. Shutting the door half an hour before the first bell turns those
-- people away for no reason.
--
-- booking_cutoff_minutes is "how many minutes before the start we stop
-- selling". A negative number therefore means "keep selling this many minutes
-- past the start". The old constraint refused negatives outright.
--
-- The floor of -240 is deliberate: four hours is about the length of the
-- longest card, so it stops a typo selling a ticket to a show that finished
-- hours ago.

alter table events drop constraint events_cutoff_non_negative;

alter table events add constraint events_cutoff_within_the_show
  check (booking_cutoff_minutes between -240 and 1440);

comment on column events.booking_cutoff_minutes is
  'Minutes before the start when booking stops. Negative keeps the night on '
  'sale that many minutes after the start, for long cards where guests '
  'deliberately arrive late. Floor of -240 (four hours) is the length of the '
  'longest show.';
