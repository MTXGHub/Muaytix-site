-- Sell tickets, do not sit on them.
--
-- Jason, 6 September 2026: "we are involved in selling tickets, not keeping
-- tickets". A guest looking at a 6pm show at ten past five does not need half
-- an hour to make up their mind, and while they think about it the seats are
-- invisible to everyone else. On a night with four seats left and paid ads
-- running, one abandoned basket takes the whole event off sale.
--
-- The hold on the seat drops to five minutes (set in create-checkout).
--
-- Stripe will not issue a payment page that dies sooner than thirty minutes,
-- so the page outlives our hold. That opens a gap: a guest can abandon
-- checkout, lose the seats to someone else, then pay from the stale page
-- twenty minutes later. Before this change that payment took the money and
-- recorded no sale, silently.
--
-- So completion now handles a hold that has already lapsed:
--
--   still held           -> as before
--   lapsed, seats spare  -> take the seats and complete the sale
--   lapsed, seats gone   -> take nothing, mark 'paid_without_stock'
--
-- The last case is the only one that needs a human: the guest has paid for a
-- seat that no longer exists and must be refunded. It is recorded as its own
-- status so it can be found, rather than looking like an ordinary sale.

alter table checkout_reservations drop constraint checkout_reservations_status_check;

alter table checkout_reservations add constraint checkout_reservations_status_check
  check (status in ('held','completed','expired','failed','released','refunded',
                    'paid_without_stock'));

create or replace function complete_reservation(
  p_reservation_id uuid,
  p_stripe_checkout_session_id text default null,
  p_stripe_payment_intent_id text default null
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_class uuid;
  v_qty   integer;
  v_state text;
  v_spare integer;
begin
  select event_ticket_class_id, quantity, status
    into v_class, v_qty, v_state
  from public.checkout_reservations
  where id = p_reservation_id
  for update;

  if not found then return 'not_found'; end if;
  if v_state = 'completed' then return 'already_completed'; end if;

  if v_state = 'held' then
    -- The ordinary path: the seats are already ours, just move them across.
    update public.event_ticket_classes
       set reserved_quantity = greatest(0, reserved_quantity - v_qty),
           sold_quantity     = sold_quantity + v_qty
     where id = v_class;

  elsif v_state in ('expired','released','failed') then
    -- The hold lapsed but the guest paid anyway, from a page that outlived it.
    -- Lock the class before looking, or two late payments could both see the
    -- same last seat.
    select quantity_available into v_spare
    from public.event_ticket_classes
    where id = v_class
    for update;

    if v_spare < v_qty then
      update public.checkout_reservations
         set status = 'paid_without_stock',
             stripe_checkout_session_id = coalesce(p_stripe_checkout_session_id, stripe_checkout_session_id),
             stripe_payment_intent_id   = coalesce(p_stripe_payment_intent_id, stripe_payment_intent_id)
       where id = p_reservation_id;
      return 'paid_without_stock';
    end if;

    update public.event_ticket_classes
       set sold_quantity = sold_quantity + v_qty
     where id = v_class;

  else
    return 'not_held_' || v_state;
  end if;

  update public.checkout_reservations
     set status = 'completed',
         completed_at = now(),
         stripe_checkout_session_id = coalesce(p_stripe_checkout_session_id, stripe_checkout_session_id),
         stripe_payment_intent_id   = coalesce(p_stripe_payment_intent_id, stripe_payment_intent_id)
   where id = p_reservation_id;

  return case when v_state = 'held' then 'completed' else 'completed_late' end;
end;
$$;

-- Every guest who paid but could not be given a seat. Should always be empty.
create or replace view bookings_needing_a_refund as
select r.id            as reservation_id,
       r.guest_name,
       r.guest_email,
       r.quantity,
       r.currency,
       r.unit_amount,
       r.stripe_payment_intent_id,
       r.created_at,
       e.event_key,
       e.name          as event_name,
       e.starts_at,
       tc.name         as ticket_class_name
from public.checkout_reservations r
join public.event_ticket_classes etc on etc.id = r.event_ticket_class_id
join public.events e   on e.id  = etc.event_id
join public.ticket_classes tc on tc.id = etc.ticket_class_id
where r.status = 'paid_without_stock'
order by r.created_at desc;

-- A five minute hold is only worth five minutes if something actually hands
-- the seats back. The sweeper ran every five minutes, which made the real
-- worst case ten. Once a minute, so a lapsed basket is back on sale inside six.
select cron.alter_job(
  (select jobid from cron.job where jobname = 'agent-tix-expire-stale-reservations'),
  schedule => '* * * * *');
