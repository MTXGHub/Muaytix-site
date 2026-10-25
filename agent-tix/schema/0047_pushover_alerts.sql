-- Pushover phone alerts (Jason, 25 October 2026).
-- 1. A message for every paid booking: night, class, tickets, amount paid, currency.
--    No name, no email, no card country (Jason's choice).
-- 2. A message for every action the stadium follower takes or declines, and any error.
--
-- Built in the database, not in the payment function, so the payment code is untouched.
-- Both triggers swallow every error: an alert that fails must never stop a sale or a log row.
-- Alerts stay OFF until stadium_sync_settings.pushover_enabled is set to true by hand.
-- The keys live in stadium_sync_settings (0046), never in git.

create or replace function public.pushover_send(
  p_title text, p_message text, p_priority integer default 0, p_force boolean default false
) returns bigint
language plpgsql security definer set search_path = public
as $$
declare s record; rid bigint;
begin
  select pushover_user_key, pushover_app_token, pushover_enabled into s
    from public.stadium_sync_settings where id = 1;
  if s.pushover_user_key is null or s.pushover_app_token is null then return null; end if;
  if not (s.pushover_enabled or p_force) then return null; end if;
  select net.http_post(
    url := 'https://api.pushover.net/1/messages.json',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object(
      'token', s.pushover_app_token, 'user', s.pushover_user_key,
      'title', left(p_title, 250), 'message', left(p_message, 1000), 'priority', p_priority),
    timeout_milliseconds := 10000) into rid;
  return rid;
exception when others then
  return null;
end $$;

-- One paid booking. p_prefix is only for tests.
create or replace function public.pushover_notify_sale(
  p_reservation uuid, p_prefix text default '', p_force boolean default false
) returns bigint
language plpgsql security definer set search_path = public
as $$
declare r record; v_total bigint; v_amount text; v_text text; v_unpaid boolean;
begin
  select cr.quantity, cr.unit_amount, upper(cr.currency) as cur, cr.status,
         ec.local_date, tc.name as class_name
    into r
    from public.checkout_reservations cr
    join public.event_ticket_classes etc on etc.id = cr.event_ticket_class_id
    join public.events e on e.id = etc.event_id
    join public.event_calendar ec on ec.event_key = e.event_key
    join public.ticket_classes tc on tc.id = etc.ticket_class_id
   where cr.id = p_reservation;
  if not found then return null; end if;
  v_total := r.quantity::bigint * r.unit_amount;
  v_amount := case when v_total % 100 = 0
                   then to_char(v_total / 100, 'FM999,999,990')
                   else to_char(v_total / 100.0, 'FM999,999,990.00') end;
  v_text := to_char(r.local_date, 'Dy DD Mon') || ', ' || r.quantity || ' x ' || r.class_name
            || ', paid ' || v_amount || ' ' || r.cur;
  v_unpaid := (r.status = 'paid_without_stock');
  if v_unpaid then
    return public.pushover_send(p_prefix || 'PAID, NO TICKETS LEFT',
      v_text || '. Guest paid but the class had no stock. Needs a refund or a move.', 1, p_force);
  end if;
  return public.pushover_send(p_prefix || 'New booking', v_text, 0, p_force);
exception when others then
  return null;
end $$;

create or replace function public.pushover_on_reservation_status() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  begin
    perform public.pushover_notify_sale(new.id);
  exception when others then null;
  end;
  return new;
end $$;

create or replace function public.pushover_on_stadium_change() returns trigger
language plpgsql security definer set search_path = public
as $$
declare v_zone text; v_night text; v_text text; v_prio integer := 0;
begin
  begin
    if new.action = 'baseline' or new.built = 'TEST' then return new; end if;
    v_zone := case new.zone when 'RINGSIDE' then 'Ringside' when 'CLUB' then 'Club Class'
      when 'LEO' then 'LEO' when 'THIRD' then 'Third Class' when 'DAY' then 'Whole day'
      when 'SYNC' then 'Follower' when 'NEW' then 'New night' else coalesce(new.zone, '') end;
    v_night := case when new.night is null then '' else to_char(new.night::date, 'Dy DD Mon') || ', ' end;
    v_text := v_night || v_zone || ': ' || coalesce(new.action, '')
              || case when coalesce(new.detail, '') <> '' then '. ' || new.detail else '' end;
    if new.action in ('ERROR') or new.action like 'NOT APPLIED%' then v_prio := 1; end if;
    perform public.pushover_send('Stadium follower', v_text, v_prio);
  exception when others then null;
  end;
  return new;
end $$;

revoke all on function public.pushover_send(text, text, integer, boolean) from public, anon, authenticated;
revoke all on function public.pushover_notify_sale(uuid, text, boolean) from public, anon, authenticated;
revoke all on function public.pushover_on_reservation_status() from public, anon, authenticated;
revoke all on function public.pushover_on_stadium_change() from public, anon, authenticated;

create trigger pushover_reservation_status
  after update of status on public.checkout_reservations
  for each row
  when (old.status is distinct from new.status and new.status in ('completed', 'paid_without_stock'))
  execute function public.pushover_on_reservation_status();

create trigger pushover_stadium_change
  after insert on public.stadium_changes
  for each row execute function public.pushover_on_stadium_change();
