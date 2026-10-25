-- Jason calls the stadium follower "the watcher" (25 October 2026). Only the words in the alert change.
create or replace function public.pushover_on_stadium_change() returns trigger
language plpgsql security definer set search_path = public
as $$
declare v_zone text; v_night text; v_text text; v_prio integer := 0;
begin
  begin
    if new.action = 'baseline' or new.built = 'TEST' then return new; end if;
    v_zone := case new.zone when 'RINGSIDE' then 'Ringside' when 'CLUB' then 'Club Class'
      when 'LEO' then 'LEO' when 'THIRD' then 'Third Class' when 'DAY' then 'Whole day'
      when 'SYNC' then 'Watcher' when 'NEW' then 'New night' else coalesce(new.zone, '') end;
    v_night := case when new.night is null then '' else to_char(new.night::date, 'Dy DD Mon') || ', ' end;
    v_text := v_night || v_zone || ': ' || coalesce(new.action, '')
              || case when coalesce(new.detail, '') <> '' then '. ' || new.detail else '' end;
    if new.action in ('ERROR') or new.action like 'NOT APPLIED%' then v_prio := 1; end if;
    perform public.pushover_send('Stadium watcher', v_text, v_prio);
  exception when others then null;
  end;
  return new;
end $$;
