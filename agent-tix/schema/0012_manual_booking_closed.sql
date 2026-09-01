-- Let a night be closed by hand with the honest message.
--
-- Until now the only statuses that could be set by hand were available, limited
-- and fully_booked. "Booking closed" existed, but only ever arrived on its own,
-- from the automatic cut-off 30 minutes before the first bell.
--
-- That left one lever for taking a night off sale early, and it said the wrong
-- thing. Marking a night "fully booked" tells a guest there are no tickets
-- anywhere, so they stop looking — and when we are closing our own sales in
-- order to send them to the stadium's own website, that is the opposite of what
-- we need. "Booking closed" says we are not selling it; it does not claim the
-- fight is sold out.
--
-- Nothing downstream needed changing. The status function already passes a
-- manual status straight through, create-checkout already refuses
-- booking_closed with "Bookings have closed for this fight night", and the
-- widget already labels it "Booking closed" — all of that runs every night of
-- the week when the automatic cut-off fires. Only the check constraint stood in
-- the way.

alter table public.event_ticket_classes
  drop constraint if exists event_ticket_classes_manual_status_check;

alter table public.event_ticket_classes
  add constraint event_ticket_classes_manual_status_check
  check (manual_status is null or manual_status = any (array[
    'available','limited','fully_booked','booking_closed'
  ]));
