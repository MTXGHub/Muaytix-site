-- Agent Tix — a guest's own hold
--
-- NOT APPLIED. Written 9 October 2026 for Jason to approve. Nothing here is
-- live until he says so, and the code that uses it (create-checkout,
-- availability) is written so that a database WITHOUT this migration behaves
-- exactly as it does today: every rpc below that is missing is treated as "no
-- hold".
--
-- The problem. A guest who presses Reserve is holding their seats for five
-- minutes. For those five minutes the seats are subtracted from what the page
-- tells THAT SAME GUEST is left, so "4 left, hold 3" reads "Only 1 left" and a
-- guest who changes their mind about the number is refused their own seats.
-- Every extra click on Reserve then made another hold and another Stripe
-- session on top.
--
-- Three functions, all read-only except the last, none of them selecting a
-- personal column from checkout_reservations. All three are for the service
-- role only: a reservation id is a bearer token for its holder, and the
-- browser never talks to these directly.

-- 1. Is this hold still alive, and what is it? ------------------------------
create or replace function public.live_hold(
  p_reservation_id uuid, p_event_key text default null
) returns table (
  hold_id uuid, event_key text, event_ticket_class_id uuid,
  ticket_class_code text, ticket_class_name text, quantity integer,
  currency text, unit_amount integer, offer_code text,
  stripe_checkout_session_id text, page_path text,
  expires_at timestamptz, seconds_left integer
)
language sql stable security definer set search_path = public as $$
  select r.id, e.event_key, r.event_ticket_class_id, tc.code, tc.name, r.quantity,
         r.currency, r.unit_amount, r.offer_code,
         r.stripe_checkout_session_id, r.page_path,
         r.expires_at,
         greatest(0, floor(extract(epoch from (r.expires_at - now()))))::integer
  from public.checkout_reservations r
  join public.event_ticket_classes etc on etc.id = r.event_ticket_class_id
  join public.events e on e.id = etc.event_id
  join public.ticket_classes tc on tc.id = etc.ticket_class_id
  where r.id = p_reservation_id
    and r.status = 'held'
    and r.expires_at > now()
    and (p_event_key is null or e.event_key = p_event_key);
$$;

-- 2. What the holder sees of a class: the public figure plus their own seats --
-- The status uses the same function the public view uses, fed the holder's
-- number, so cutoffs, manual closures and the "limited" threshold all still
-- apply. Only the quantity differs.
create or replace function public.class_view_for_holder(
  p_event_ticket_class_id uuid, p_extra integer
) returns table (status text, quantity_available integer, max_per_order integer)
language sql stable security definer set search_path = public as $$
  select public.ticket_availability_status(
           etc.active, etc.release_status, etc.manual_status, q.n,
           etc.limited_threshold, e.starts_at, e.booking_cutoff_minutes),
         q.n,
         least(etc.max_per_order, q.n)
  from public.event_ticket_classes etc
  join public.events e on e.id = etc.event_id
  cross join lateral (
    select greatest(0, etc.total_quantity - etc.reserved_quantity - etc.sold_quantity
                       + greatest(coalesce(p_extra, 0), 0))::integer as n
  ) q
  where etc.id = p_event_ticket_class_id;
$$;

-- 3. Change seats without ever letting go of the old ones first --------------
-- Takes the new seats first and gives the old ones back only if that worked, all
-- in one transaction. If the new choice cannot be had, the function raises and
-- Postgres undoes everything: the old hold is exactly as it was, and at no
-- moment did anybody else see its seats as free.
--
-- Lock order matches release_reservation and complete_reservation (the
-- reservation row, then the class rows) so it cannot deadlock with either, and
-- the class rows are taken lowest id first so two guests changing in opposite
-- directions cannot wait on each other.
--
-- The old hold only counts if it is still held, not past its time, and on the
-- same night as the new seats. Otherwise this behaves exactly like
-- reserve_tickets, which is what a guest with nothing to replace gets.
create or replace function public.replace_reservation(
  p_old_reservation_id uuid, p_event_ticket_class_id uuid,
  p_quantity integer, p_expires_at timestamptz
) returns table (
  reservation_id uuid, available_after integer,
  replaced_reservation_id uuid, replaced_stripe_session_id text
)
language plpgsql security definer set search_path = public as $$
declare
  v_old_class uuid; v_old_qty integer; v_old_state text; v_old_exp timestamptz;
  v_old_session text; v_old_live boolean := false;
  v_tenant uuid; v_total integer; v_resv integer; v_sold integer; v_max integer;
  v_avail integer; v_id uuid; v_same_night boolean;
begin
  if p_quantity is null or p_quantity < 1 then
    raise exception 'Quantity must be at least 1';
  end if;

  if p_old_reservation_id is not null then
    select r.event_ticket_class_id, r.quantity, r.status, r.expires_at, r.stripe_checkout_session_id
      into v_old_class, v_old_qty, v_old_state, v_old_exp, v_old_session
    from public.checkout_reservations r
    where r.id = p_old_reservation_id
    for update;
    if found and v_old_state = 'held' and v_old_exp > now() then
      select (select event_id from public.event_ticket_classes where id = v_old_class)
           = (select event_id from public.event_ticket_classes where id = p_event_ticket_class_id)
        into v_same_night;
      v_old_live := coalesce(v_same_night, false);
    end if;
  end if;

  perform 1 from public.event_ticket_classes
   where id in (p_event_ticket_class_id, v_old_class)
   order by id
   for update;

  select tenant_id, total_quantity, reserved_quantity, sold_quantity, max_per_order
    into v_tenant, v_total, v_resv, v_sold, v_max
  from public.event_ticket_classes where id = p_event_ticket_class_id;
  if not found then raise exception 'Ticket class not found'; end if;

  -- Seats the guest already holds in this very class are theirs to reuse.
  v_avail := greatest(0, v_total - v_resv - v_sold
    + case when v_old_live and v_old_class = p_event_ticket_class_id then v_old_qty else 0 end);

  if p_quantity > v_max then raise exception 'At most % tickets per order', v_max; end if;
  if v_avail < p_quantity then raise exception 'Only % remaining', v_avail; end if;

  if v_old_live then
    update public.event_ticket_classes
       set reserved_quantity = greatest(0, reserved_quantity - v_old_qty)
     where id = v_old_class;
    update public.checkout_reservations set status = 'released'
     where id = p_old_reservation_id;
  end if;

  update public.event_ticket_classes
     set reserved_quantity = reserved_quantity + p_quantity
   where id = p_event_ticket_class_id;

  insert into public.checkout_reservations (tenant_id, event_ticket_class_id, quantity, expires_at)
  values (v_tenant, p_event_ticket_class_id, p_quantity, p_expires_at)
  returning id into v_id;

  return query select v_id, v_avail - p_quantity,
    case when v_old_live then p_old_reservation_id else null::uuid end,
    case when v_old_live then v_old_session else null::text end;
end; $$;

-- Service role only. A reservation id is a bearer token for its holder.
revoke all on function public.live_hold(uuid, text) from public, anon, authenticated;
revoke all on function public.class_view_for_holder(uuid, integer) from public, anon, authenticated;
revoke all on function public.replace_reservation(uuid, uuid, integer, timestamptz) from public, anon, authenticated;
grant execute on function public.live_hold(uuid, text) to service_role;
grant execute on function public.class_view_for_holder(uuid, integer) to service_role;
grant execute on function public.replace_reservation(uuid, uuid, integer, timestamptz) to service_role;
