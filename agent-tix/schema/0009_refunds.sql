-- Agent Tix — putting a seat back after a refund
--
-- APPLIED to agent-tix-build on 31 August 2026.
--
-- Refunds run at one or two a month, so this is deliberately NOT automated.
-- Whether a refunded seat should go back on sale is a judgement: a guest who
-- cancelled frees their seat, a guest given a goodwill refund who still attends
-- does not. No webhook can tell those apart, and guessing wrong either oversells
-- the night or loses a seat.
--
-- What was missing was a safe way to do it by hand. `release_reservation`
-- refuses anything that is not `held`, so the only way to return a sold seat was
-- to edit `sold_quantity` directly — the exact kind of raw edit that goes wrong
-- at 11pm. This gives that job one command that cannot be got wrong.

alter table public.checkout_reservations
  drop constraint if exists checkout_reservations_status_check;

alter table public.checkout_reservations
  add constraint checkout_reservations_status_check
  check (status in ('held','completed','expired','failed','released','refunded'));

alter table public.checkout_reservations
  add column if not exists refunded_at timestamptz;

comment on column public.checkout_reservations.refunded_at is
  'Set by refund_reservation(). The Stripe refund itself is the source of truth for the money; this records that the seat was returned to stock.';

-- Returns a sold seat to stock. Safe to run twice: a booking already refunded
-- is left exactly as it is rather than freeing the seat a second time, which
-- would quietly inflate availability.
--
-- Refund the money in Stripe first. This does not touch Stripe, and Stripe does
-- not touch this.
create or replace function public.refund_reservation(p_reservation_id uuid)
returns text
language plpgsql security definer set search_path = public as $$
declare v_class uuid; v_qty integer; v_state text;
begin
  select event_ticket_class_id, quantity, status into v_class, v_qty, v_state
  from public.checkout_reservations where id = p_reservation_id for update;

  if not found then return 'not_found'; end if;
  if v_state = 'refunded' then return 'already_refunded'; end if;
  if v_state <> 'completed' then return 'not_sold_' || v_state; end if;

  update public.event_ticket_classes
     set sold_quantity = greatest(0, sold_quantity - v_qty)
   where id = v_class;

  update public.checkout_reservations
     set status = 'refunded', refunded_at = now()
   where id = p_reservation_id;

  return 'refunded';
end; $$;

comment on function public.refund_reservation(uuid) is
  'Returns a sold seat to stock after a refund has been made in Stripe. Idempotent. Run by hand, deliberately: whether a refunded seat goes back on sale is a decision, not a rule.';
