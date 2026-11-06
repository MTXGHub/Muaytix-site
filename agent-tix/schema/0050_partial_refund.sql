-- Partial refunds (Jason, 6 November 2026).
-- refund_reservation() only handles a whole booking. A guest who refunds 1 ticket of 6 (21 Nov LEO) left the
-- database saying 6, with no record of the refund. This adds a tool for "refund N tickets from this booking":
--   * the booking's quantity goes down by N, so the reports show what the guest actually kept;
--   * the night's sold_quantity goes down by N, so those tickets are back on sale;
--   * refunded_quantity keeps a running total of what was refunded from the booking, so nothing is lost;
--   * refunding every remaining ticket makes it a full refund (status refunded), as before.
-- The refund itself is still made in Stripe by hand. This only records it. Service role only.

alter table public.checkout_reservations add column if not exists refunded_quantity integer not null default 0;

create or replace function public.refund_reservation_tickets(p_reservation_id uuid, p_tickets integer)
returns text
language plpgsql security definer set search_path = public
as $$
declare v_class uuid; v_qty integer; v_state text;
begin
  if p_tickets is null or p_tickets < 1 then return 'invalid_number'; end if;

  select event_ticket_class_id, quantity, status into v_class, v_qty, v_state
  from public.checkout_reservations where id = p_reservation_id for update;

  if not found then return 'not_found'; end if;
  if v_state = 'refunded' then return 'already_refunded'; end if;
  if v_state <> 'completed' then return 'not_sold_' || v_state; end if;
  if p_tickets > v_qty then return 'too_many_tickets'; end if;

  update public.event_ticket_classes
     set sold_quantity = greatest(0, sold_quantity - p_tickets)
   where id = v_class;

  if p_tickets = v_qty then
    update public.checkout_reservations
       set status = 'refunded', refunded_at = now(), refunded_quantity = refunded_quantity + p_tickets
     where id = p_reservation_id;
    return 'refunded_all';
  end if;

  update public.checkout_reservations
     set quantity = quantity - p_tickets, refunded_quantity = refunded_quantity + p_tickets
   where id = p_reservation_id;
  return 'refunded_part';
end $$;

revoke all on function public.refund_reservation_tickets(uuid, integer) from public, anon, authenticated;
grant execute on function public.refund_reservation_tickets(uuid, integer) to service_role;
