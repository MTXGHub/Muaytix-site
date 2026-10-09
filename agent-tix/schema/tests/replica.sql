-- A scratch copy of just enough of the live schema to run 0043_guest_hold.sql
-- against a real Postgres, never the live database.
--
-- Table shapes, constraints, the status function, the view and the three
-- existing reservation functions are copied from the live database as read on
-- 9 October 2026 (reserve_tickets and release_reservation are identical to
-- 0006; complete_reservation is the live late-payment version). Anything not
-- listed here is not needed by the functions under test.
--
--   createdb holdtest && psql holdtest -f replica.sql -f ../0043_guest_hold.sql -f guest_hold.test.sql

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end $$;

create table tenants (id uuid primary key default gen_random_uuid(), slug text not null);
create table venues (id uuid primary key default gen_random_uuid(), tenant_id uuid not null, name text not null,
  timezone text not null default 'Asia/Bangkok');
create table events (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null, venue_id uuid not null,
  event_key text not null unique, name text not null, description text,
  starts_at timestamptz not null, ends_at timestamptz, image_url text,
  publication_status text not null default 'draft', booking_cutoff_minutes integer not null default 30,
  series_id uuid);
create table ticket_classes (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null, code text not null, name text not null,
  description text, image_url text, assigned_seating boolean not null default false,
  display_order integer not null default 0, active boolean not null default true,
  accent_colour text, accent_ink text);
create table event_ticket_classes (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null,
  event_id uuid not null references events(id) on delete cascade,
  ticket_class_id uuid not null references ticket_classes(id) on delete restrict,
  total_quantity integer not null, reserved_quantity integer not null default 0, sold_quantity integer not null default 0,
  quantity_available integer generated always as (greatest(0, total_quantity - reserved_quantity - sold_quantity)) stored,
  release_status text not null default 'released', manual_status text, closed_explanation text,
  limited_threshold integer not null default 5, max_per_order integer not null default 10,
  maximum_seats_together integer, display_order integer not null default 0, active boolean not null default true,
  unique (event_id, ticket_class_id),
  constraint etc_committed_within_total check (reserved_quantity + sold_quantity <= total_quantity),
  constraint etc_max_per_order_positive check (max_per_order >= 1 and max_per_order <= 10),
  constraint etc_quantities_non_negative check (total_quantity >= 0 and reserved_quantity >= 0 and sold_quantity >= 0),
  constraint event_ticket_classes_manual_status_check check (manual_status is null or manual_status in ('available','limited','fully_booked','booking_closed')),
  constraint event_ticket_classes_release_status_check check (release_status in ('released','not_released','hidden')));
create table checkout_reservations (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null,
  event_ticket_class_id uuid not null references event_ticket_classes(id) on delete restrict,
  quantity integer not null, currency text, unit_amount integer,
  status text not null default 'held' check (status in ('held','completed','expired','failed','released','refunded','paid_without_stock')),
  stripe_checkout_session_id text unique, stripe_payment_intent_id text,
  expires_at timestamptz not null, created_at timestamptz not null default now(), completed_at timestamptz,
  guest_email text, guest_name text, page_path text, offer_code text, offer_discount_minor bigint,
  click_id text, click_id_kind text, utm_source text, utm_medium text, utm_campaign text, utm_term text,
  utm_content text, ad_group_id text, match_type text, device text, clicked_at timestamptz, landing_page text,
  constraint cr_quantity_positive check (quantity > 0));
create table event_ticket_prices (event_ticket_class_id uuid not null, currency text not null, unit_amount integer not null,
  is_override boolean not null default false, display_order integer not null default 0);

create or replace function public.ticket_availability_status(p_active boolean, p_release_status text, p_manual_status text, p_quantity_available integer, p_limited_threshold integer, p_starts_at timestamp with time zone, p_booking_cutoff_minutes integer)
 returns text language sql stable as $function$
  select case
    when not p_active or p_release_status = 'hidden'  then 'hidden'
    when p_release_status = 'not_released'            then 'closed'
    when now() >= p_starts_at - make_interval(mins => p_booking_cutoff_minutes) then 'booking_closed'
    when p_quantity_available = 0                     then 'fully_booked'
    when p_manual_status is not null                  then p_manual_status
    when p_quantity_available <= p_limited_threshold  then 'limited'
    else 'available'
  end;
$function$;

create view event_ticket_availability as
 select e.tenant_id, e.id as event_id, e.event_key, e.name as event_name, e.starts_at,
    etc.id as event_ticket_class_id, tc.code as ticket_class_code, tc.name as ticket_class_name,
    v.name as venue_name, v.timezone as venue_timezone,
    tc.assigned_seating, etc.display_order, etc.closed_explanation, etc.maximum_seats_together,
    least(etc.max_per_order, etc.quantity_available) as max_per_order,
    ticket_availability_status(etc.active, etc.release_status, etc.manual_status, etc.quantity_available, etc.limited_threshold, e.starts_at, e.booking_cutoff_minutes) as status
   from event_ticket_classes etc
     join events e on e.id = etc.event_id
     join ticket_classes tc on tc.id = etc.ticket_class_id
     join venues v on v.id = e.venue_id
  where e.publication_status = 'published';

CREATE OR REPLACE FUNCTION public.reserve_tickets(p_event_ticket_class_id uuid, p_quantity integer, p_expires_at timestamp with time zone)
 RETURNS TABLE(reservation_id uuid, available_after integer)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare v_tenant uuid; v_avail integer; v_max integer; v_id uuid;
begin
  if p_quantity is null or p_quantity < 1 then raise exception 'Quantity must be at least 1'; end if;
  select tenant_id, greatest(0, total_quantity - reserved_quantity - sold_quantity), max_per_order
    into v_tenant, v_avail, v_max
  from public.event_ticket_classes where id = p_event_ticket_class_id for update;
  if not found then raise exception 'Ticket class not found'; end if;
  if p_quantity > v_max then raise exception 'At most % tickets per order', v_max; end if;
  if v_avail < p_quantity then raise exception 'Only % remaining', v_avail; end if;
  update public.event_ticket_classes set reserved_quantity = reserved_quantity + p_quantity where id = p_event_ticket_class_id;
  insert into public.checkout_reservations (tenant_id, event_ticket_class_id, quantity, expires_at)
  values (v_tenant, p_event_ticket_class_id, p_quantity, p_expires_at) returning id into v_id;
  return query select v_id, v_avail - p_quantity;
end;
$function$;

CREATE OR REPLACE FUNCTION public.release_reservation(p_reservation_id uuid, p_new_status text DEFAULT 'released'::text)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare v_class uuid; v_qty integer; v_state text;
begin
  if p_new_status not in ('expired','failed','released') then raise exception 'Cannot release into status %', p_new_status; end if;
  select event_ticket_class_id, quantity, status into v_class, v_qty, v_state
  from public.checkout_reservations where id = p_reservation_id for update;
  if not found then return 'not_found'; end if;
  if v_state <> 'held' then return 'already_' || v_state; end if;
  update public.event_ticket_classes set reserved_quantity = greatest(0, reserved_quantity - v_qty) where id = v_class;
  update public.checkout_reservations set status = p_new_status where id = p_reservation_id;
  return p_new_status;
end;
$function$;

CREATE OR REPLACE FUNCTION public.complete_reservation(p_reservation_id uuid, p_stripe_checkout_session_id text DEFAULT NULL::text, p_stripe_payment_intent_id text DEFAULT NULL::text)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare v_class uuid; v_qty integer; v_state text; v_spare integer;
begin
  select event_ticket_class_id, quantity, status into v_class, v_qty, v_state
  from public.checkout_reservations where id = p_reservation_id for update;
  if not found then return 'not_found'; end if;
  if v_state = 'completed' then return 'already_completed'; end if;
  if v_state = 'held' then
    update public.event_ticket_classes set reserved_quantity = greatest(0, reserved_quantity - v_qty), sold_quantity = sold_quantity + v_qty where id = v_class;
  elsif v_state in ('expired','released','failed') then
    select quantity_available into v_spare from public.event_ticket_classes where id = v_class for update;
    if v_spare < v_qty then
      update public.checkout_reservations set status = 'paid_without_stock',
             stripe_checkout_session_id = coalesce(p_stripe_checkout_session_id, stripe_checkout_session_id),
             stripe_payment_intent_id   = coalesce(p_stripe_payment_intent_id, stripe_payment_intent_id)
       where id = p_reservation_id;
      return 'paid_without_stock';
    end if;
    update public.event_ticket_classes set sold_quantity = sold_quantity + v_qty where id = v_class;
  else
    return 'not_held_' || v_state;
  end if;
  update public.checkout_reservations set status = 'completed', completed_at = now(),
         stripe_checkout_session_id = coalesce(p_stripe_checkout_session_id, stripe_checkout_session_id),
         stripe_payment_intent_id   = coalesce(p_stripe_payment_intent_id, stripe_payment_intent_id)
   where id = p_reservation_id;
  return case when v_state = 'held' then 'completed' else 'completed_late' end;
end;
$function$;

CREATE OR REPLACE FUNCTION public.expire_stale_reservations()
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare r record; n integer := 0;
begin
  for r in select id from public.checkout_reservations where status = 'held' and expires_at < now() order by expires_at
  loop
    perform public.release_reservation(r.id, 'expired');
    n := n + 1;
  end loop;
  return n;
end;
$function$;
