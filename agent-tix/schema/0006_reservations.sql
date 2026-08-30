-- Agent Tix — holding stock while a guest pays
--
-- APPLIED to agent-tix-build on 30 August 2026.
--
-- A booking passes through three states: held while they are at Stripe, then
-- completed or released. Nothing counts as sold until Stripe confirms payment.

create table public.checkout_reservations (
  id                          uuid primary key default gen_random_uuid(),
  tenant_id                   uuid not null references public.tenants(id) on delete cascade,
  event_ticket_class_id       uuid not null references public.event_ticket_classes(id) on delete restrict,
  quantity                    integer not null,
  currency                    text,
  unit_amount                 integer,
  status                      text not null default 'held'
                                check (status in ('held','completed','expired','failed','released')),
  stripe_checkout_session_id  text unique,
  stripe_payment_intent_id    text,
  expires_at                  timestamptz not null,
  created_at                  timestamptz not null default now(),
  completed_at                timestamptz,
  constraint cr_quantity_positive check (quantity > 0)
);

create index cr_expiry_idx on public.checkout_reservations (expires_at) where status = 'held';
create index cr_class_idx on public.checkout_reservations (event_ticket_class_id);
alter table public.checkout_reservations enable row level security;

-- The `for update` is the whole point. Two guests going for the last two seats
-- at the same instant queue behind each other rather than both reading "2 left"
-- and both succeeding.
create or replace function public.reserve_tickets(
  p_event_ticket_class_id uuid, p_quantity integer, p_expires_at timestamptz
) returns table (reservation_id uuid, available_after integer)
language plpgsql security definer set search_path = public as $$
declare v_tenant uuid; v_avail integer; v_max integer; v_id uuid;
begin
  if p_quantity is null or p_quantity < 1 then
    raise exception 'Quantity must be at least 1';
  end if;

  select tenant_id,
         greatest(0, total_quantity - reserved_quantity - sold_quantity),
         max_per_order
    into v_tenant, v_avail, v_max
  from public.event_ticket_classes where id = p_event_ticket_class_id for update;

  if not found then raise exception 'Ticket class not found'; end if;
  if p_quantity > v_max then raise exception 'At most % tickets per order', v_max; end if;
  if v_avail < p_quantity then raise exception 'Only % remaining', v_avail; end if;

  update public.event_ticket_classes
     set reserved_quantity = reserved_quantity + p_quantity
   where id = p_event_ticket_class_id;

  insert into public.checkout_reservations (tenant_id, event_ticket_class_id, quantity, expires_at)
  values (v_tenant, p_event_ticket_class_id, p_quantity, p_expires_at)
  returning id into v_id;

  return query select v_id, v_avail - p_quantity;
end; $$;

-- Safe to call twice. A reservation already resolved is left alone, so a
-- repeated webhook cannot double-release seats.
create or replace function public.release_reservation(
  p_reservation_id uuid, p_new_status text default 'released'
) returns text
language plpgsql security definer set search_path = public as $$
declare v_class uuid; v_qty integer; v_state text;
begin
  if p_new_status not in ('expired','failed','released') then
    raise exception 'Cannot release into status %', p_new_status;
  end if;

  select event_ticket_class_id, quantity, status into v_class, v_qty, v_state
  from public.checkout_reservations where id = p_reservation_id for update;

  if not found then return 'not_found'; end if;
  if v_state <> 'held' then return 'already_' || v_state; end if;

  update public.event_ticket_classes
     set reserved_quantity = greatest(0, reserved_quantity - v_qty) where id = v_class;
  update public.checkout_reservations set status = p_new_status where id = p_reservation_id;
  return p_new_status;
end; $$;

-- Also safe to call twice: Stripe retries webhooks, and a second call must not
-- sell the same seats again. This is the exact shape of the duplicate-ticket
-- problem, so it is handled here rather than trusted to the caller.
create or replace function public.complete_reservation(
  p_reservation_id uuid,
  p_stripe_checkout_session_id text default null,
  p_stripe_payment_intent_id text default null
) returns text
language plpgsql security definer set search_path = public as $$
declare v_class uuid; v_qty integer; v_state text;
begin
  select event_ticket_class_id, quantity, status into v_class, v_qty, v_state
  from public.checkout_reservations where id = p_reservation_id for update;

  if not found then return 'not_found'; end if;
  if v_state = 'completed' then return 'already_completed'; end if;
  if v_state <> 'held' then return 'not_held_' || v_state; end if;

  update public.event_ticket_classes
     set reserved_quantity = greatest(0, reserved_quantity - v_qty),
         sold_quantity     = sold_quantity + v_qty
   where id = v_class;

  update public.checkout_reservations
     set status = 'completed', completed_at = now(),
         stripe_checkout_session_id = coalesce(p_stripe_checkout_session_id, stripe_checkout_session_id),
         stripe_payment_intent_id   = coalesce(p_stripe_payment_intent_id, stripe_payment_intent_id)
   where id = p_reservation_id;

  return 'completed';
end; $$;

-- A guest who opens Stripe and wanders off must not hold a seat forever.
create or replace function public.expire_stale_reservations()
returns integer
language plpgsql security definer set search_path = public as $$
declare r record; n integer := 0;
begin
  for r in select id from public.checkout_reservations
           where status = 'held' and expires_at < now() order by expires_at
  loop
    perform public.release_reservation(r.id, 'expired');
    n := n + 1;
  end loop;
  return n;
end; $$;
