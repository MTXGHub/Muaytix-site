-- 26 October 2026: the watcher opened Third Class for Mon 26 Oct at 10:45 Bangkok and, in doing so,
-- cleared the Booking closed pause Jason had asked for that morning. Opening Third Class now only
-- releases it. A pause or close of ours stays, and the alert says so. Everything else is unchanged.
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
               set release_status = 'released' where id = r.id;
            v_action := 'opened Third Class'; v_detail := 'total ' || r.total_quantity || ', working number unless Jason says otherwise';
            if r.manual_status is not null then
              v_detail := v_detail || '. Kept our ' || r.manual_status || ' status, so it is NOT on sale';
            end if;
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
