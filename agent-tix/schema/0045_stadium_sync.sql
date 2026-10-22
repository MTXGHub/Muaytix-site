-- Agent Tix — following the stadium's availability tracker automatically
--
-- APPLIED to agent-tix-build on 22 October 2026 (see the notes at the end).
--
-- The stadium's tracker (agent-tix/notes/stadium-availability-tracker.md) is read
-- every few minutes by the `stadium-sync` edge function, which compares each read
-- with the one before and hands every CHANGE to stadium_apply_change() below.
-- The rules live here, in the database, next to the stock they change.
--
-- Rules (Jason, 22 October 2026: "you're going to make the change based on what's
-- coming out of the stadium data"). It acts on CHANGES the stadium makes, never on
-- a standing difference, so a class Jason has deliberately left open stays open
-- until the stadium changes that class again:
--   Ringside / Club Class / LEO / Third Class  A -> F (Stop Sale)
--        close it as Fully booked, unless it is on the hold list (stock Jason
--        holds himself), where it is left open and the log says so.
--   ... F -> A (On Sale again)
--        reopen it only if THIS automation closed it and nobody has touched it
--        since. Anything Jason closed himself stays closed.
--   Third Class  N -> A
--        open it (release it), at whatever total it already carries (50).
--   A whole day marked Closed
--        pause all four classes (Booking closed). Reopening is left to Jason.
--   Everything else is only written to the log.
-- Quantities are never changed. Nothing is ever deleted.
--
-- Switches: stadium_sync_settings.enabled (off = does nothing at all) and
-- dry_run (on = writes what it WOULD do to the log and changes nothing).

create extension if not exists pg_net;

create table if not exists public.stadium_sync_settings (
  id           int primary key default 1 check (id = 1),
  enabled      boolean not null default false,
  dry_run      boolean not null default true,
  tracker_url  text,
  sync_token   text not null,
  last_run_at  timestamptz,
  last_built   text,
  last_error   text
);

create table if not exists public.stadium_snapshot (
  d       date primary key,
  z       text not null,
  o       int  not null,
  seen_at timestamptz not null default now()
);

create table if not exists public.stadium_hold (
  event_ticket_class_id uuid primary key,
  note       text,
  created_at timestamptz not null default now()
);

create table if not exists public.stadium_auto_closed (
  id bigserial primary key,
  event_ticket_class_id uuid not null,
  closed_at timestamptz not null default now(),
  undone_at timestamptz
);
create unique index if not exists stadium_auto_closed_one_open
  on public.stadium_auto_closed (event_ticket_class_id) where undone_at is null;

create table if not exists public.stadium_changes (
  id          bigserial primary key,
  at          timestamptz not null default now(),
  built       text,
  night       date,
  zone        text,
  from_status text,
  to_status   text,
  action      text not null,
  detail      text
);

alter table public.stadium_sync_settings enable row level security;
alter table public.stadium_snapshot      enable row level security;
alter table public.stadium_hold          enable row level security;
alter table public.stadium_auto_closed   enable row level security;
alter table public.stadium_changes       enable row level security;
revoke all on public.stadium_sync_settings, public.stadium_snapshot, public.stadium_hold,
              public.stadium_auto_closed, public.stadium_changes from anon, authenticated;
revoke all on sequence public.stadium_auto_closed_id_seq, public.stadium_changes_id_seq
              from anon, authenticated;

insert into public.stadium_sync_settings (id, sync_token)
values (1, replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''))
on conflict (id) do nothing;

create or replace function public.stadium_apply_change(
  p_night date, p_zone text, p_from text, p_to text, p_built text, p_dry boolean
) returns text
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_code   text;
  r        record;
  v_action text;
  v_detail text := '';
  v_rows   int;
  v_hold   boolean;
begin
  if p_zone not in ('RINGSIDE', 'CLUB', 'LEO', 'THIRD', 'DAY', 'NEW') then
    return 'ignored';  -- the stadium's other seat types are not ours
  end if;

  if p_zone = 'NEW' then
    v_action := 'noted'; v_detail := 'a date the stadium has added: ' || p_to;
  elsif p_night < (now() at time zone 'Asia/Bangkok')::date then
    v_action := 'ignored'; v_detail := 'that night is in the past';
  elsif p_zone = 'DAY' then
    if p_to = 'closed' then
      if p_dry then
        v_action := 'DRY: would pause all four classes'; v_detail := 'stadium marked the whole day Closed';
      else
        update public.event_ticket_classes etc
           set manual_status = 'booking_closed'
          from public.events e
         where e.id = etc.event_id
           and (e.starts_at at time zone 'Asia/Bangkok')::date = p_night
           and e.publication_status = 'published'
           and etc.manual_status is distinct from 'booking_closed';
        get diagnostics v_rows = row_count;
        v_action := 'paused ' || v_rows || ' classes (Booking closed)';
        v_detail := 'stadium marked the whole day Closed; reopening is left to Jason';
      end if;
    else
      v_action := 'noted'; v_detail := 'stadium reopened the day; ours left as is';
    end if;
  else
    v_code := case p_zone when 'RINGSIDE' then 'ringside' when 'CLUB' then 'club_class'
                          when 'LEO' then 'leo_section' else 'third_class' end;
    select etc.id, etc.manual_status, etc.release_status, etc.total_quantity, etc.sold_quantity
      into r
      from public.events e
      join public.event_ticket_classes etc on etc.event_id = e.id
      join public.ticket_classes tc on tc.id = etc.ticket_class_id
     where (e.starts_at at time zone 'Asia/Bangkok')::date = p_night
       and e.publication_status = 'published' and tc.code = v_code
     limit 1;

    if not found then
      v_action := 'noted'; v_detail := 'we have no such night loaded';
    else
      v_hold := exists (select 1 from public.stadium_hold h where h.event_ticket_class_id = r.id);
      if p_to = 'F' then
        if v_hold then
          v_action := 'left open (held)'; v_detail := 'stadium stopped sale but this is stock Jason holds himself';
        elsif r.manual_status = 'fully_booked' then
          v_action := 'already closed'; v_detail := 'ours was already Fully booked';
        elsif r.manual_status = 'booking_closed' then
          v_action := 'already paused'; v_detail := 'ours was already Booking closed; left as is';
        elsif p_dry then
          v_action := 'DRY: would close as Fully booked';
        else
          update public.event_ticket_classes set manual_status = 'fully_booked' where id = r.id;
          insert into public.stadium_auto_closed (event_ticket_class_id) values (r.id)
            on conflict do nothing;
          v_action := 'closed as Fully booked';
        end if;
      elsif p_from = 'F' and p_to = 'A' then
        if r.manual_status = 'fully_booked'
           and exists (select 1 from public.stadium_auto_closed a
                        where a.event_ticket_class_id = r.id and a.undone_at is null) then
          if p_dry then
            v_action := 'DRY: would reopen (undo its own close)';
          else
            update public.event_ticket_classes set manual_status = null where id = r.id;
            update public.stadium_auto_closed set undone_at = now()
             where event_ticket_class_id = r.id and undone_at is null;
            v_action := 'reopened (undid its own close)';
          end if;
        else
          if not p_dry then
            update public.stadium_auto_closed set undone_at = now()
             where event_ticket_class_id = r.id and undone_at is null;
          end if;
          v_action := 'left as is'; v_detail := 'stadium reopened it, but ours was not closed by the automation';
        end if;
      elsif p_zone = 'THIRD' and p_from = 'N' and p_to = 'A' then
        if r.release_status = 'not_released' then
          if p_dry then
            v_action := 'DRY: would open Third Class'; v_detail := 'total ' || r.total_quantity;
          else
            update public.event_ticket_classes
               set release_status = 'released', manual_status = null where id = r.id;
            v_action := 'opened Third Class'; v_detail := 'total ' || r.total_quantity || ', working number unless Jason says otherwise';
          end if;
        else
          v_action := 'already open';
        end if;
      else
        v_action := 'noted'; v_detail := 'no rule for this change';
      end if;
    end if;
  end if;

  insert into public.stadium_changes (built, night, zone, from_status, to_status, action, detail)
  values (p_built, p_night, p_zone, p_from, p_to, v_action, nullif(v_detail, ''));
  return v_action;
end;
$$;

revoke all on function public.stadium_apply_change(date, text, text, text, text, boolean)
  from public, anon, authenticated;
grant execute on function public.stadium_apply_change(date, text, text, text, text, boolean)
  to service_role;

-- Applied in pieces after this file, as data and not part of this file:
--   * the tracker address into stadium_sync_settings.tracker_url (never stored in git)
--   * the hold list (stadium_hold), written 22 October 2026 for the classes where
--     Jason holds stock: 23 Oct Knockout LEO; RWS 24 Oct Ringside and LEO, 31 Oct LEO,
--     7 Nov Ringside and LEO, 14 Nov LEO, 21 Nov Club Class and LEO, 28 Nov Club Class
--   * the cron job, every 3 minutes, which calls the stadium-sync function:
--       select cron.schedule('stadium-sync-every-3-min', '*/3 * * * *',
--         $$select net.http_post(url := '<project>/functions/v1/stadium-sync',
--             headers := jsonb_build_object('Content-Type','application/json',
--               'x-sync-token',(select sync_token from public.stadium_sync_settings where id=1)),
--             body := '{}'::jsonb, timeout_milliseconds := 60000)$$);
--   * enabled = true, dry_run = false (the first read set the baseline in dry-run)
-- To stop it: update stadium_sync_settings set enabled = false;  (or unschedule the job).
-- To log what it would do without changing anything: set dry_run = true.
