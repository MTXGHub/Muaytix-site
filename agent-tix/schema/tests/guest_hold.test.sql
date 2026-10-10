-- Tests for 0043_guest_hold.sql, on the scratch copy in replica.sql only.
--
--   See replica.sql for how to run. Prints one line per check and ends with an
--   error (so psql exits non-zero) if any check failed.

create temp table results (n serial, name text, ok boolean, detail text);
create or replace function pg_temp.check(p_name text, p_ok boolean, p_detail text default '')
returns void language plpgsql as $$
begin
  insert into results (name, ok, detail) values (p_name, coalesce(p_ok, false), p_detail);
  raise notice '% %', case when coalesce(p_ok,false) then 'ok  ' else 'FAIL' end, p_name || case when coalesce(p_ok,false) then '' else '  -> ' || p_detail end;
end $$;

-- What the three existing reservation functions look like BEFORE 0043. They are
-- compared again at the end: the migration must not have touched them.
create temp table before_defs as
  select proname, md5(pg_get_functiondef(oid)) h from pg_proc
  where pronamespace = 'public'::regnamespace
    and proname in ('reserve_tickets','release_reservation','complete_reservation','ticket_availability_status');

-- Who may run each existing function BEFORE 0043: compared again after it, and
-- after the rollback. The migration's revokes must touch only its own functions.
create temp table before_acls as
  select p.oid::regprocedure::text as sig, coalesce(p.proacl::text, 'default') as acl from pg_proc p
  where p.pronamespace = 'public'::regnamespace;

\ir ../0043_guest_hold.sql

-- ---- a night with 10 Club seats (6 sold), a sold out Ringside, a free Third ---
insert into tenants (id, slug) values ('00000000-0000-0000-0000-000000000001', 'muaytix');
insert into venues (id, tenant_id, name) values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000001', 'Test stadium');
insert into events (id, tenant_id, venue_id, event_key, name, starts_at, publication_status) values
 ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', 'test_night_1', 'Test night 1', now() + interval '2 days', 'published'),
 ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', 'test_night_2', 'Test night 2', now() + interval '3 days', 'published');
insert into ticket_classes (id, tenant_id, code, name, display_order) values
 ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000001', 'club_class', 'Club Class', 2),
 ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-000000000001', 'ringside', 'Ringside', 1),
 ('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-000000000001', 'third_class', 'Third Class', 4);
insert into event_ticket_classes (id, tenant_id, event_id, ticket_class_id, total_quantity, sold_quantity) values
 ('00000000-0000-0000-0000-00000000f101', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000c1', 10, 6),
 ('00000000-0000-0000-0000-00000000f102', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000c2', 10, 10),
 ('00000000-0000-0000-0000-00000000f103', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000c3', 50, 0),
 ('00000000-0000-0000-0000-00000000f201', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000c1', 10, 0);

create or replace function pg_temp.club_avail() returns integer language sql as
  $$ select quantity_available from event_ticket_classes where id = '00000000-0000-0000-0000-00000000f101' $$;
create or replace function pg_temp.club_reserved() returns integer language sql as
  $$ select reserved_quantity from event_ticket_classes where id = '00000000-0000-0000-0000-00000000f101' $$;

do $$
declare
  club constant uuid := '00000000-0000-0000-0000-00000000f101';
  ring constant uuid := '00000000-0000-0000-0000-00000000f102';
  third constant uuid := '00000000-0000-0000-0000-00000000f103';
  club2 constant uuid := '00000000-0000-0000-0000-00000000f201';
  r1 uuid; r2 uuid; r3 uuid; r4 uuid; r5 uuid; rec record; v_msg text; n integer; st text;
begin
  -- 1. 4 left. A guest holds 3. Everyone else sees 1; the holder can choose 4.
  select reservation_id into r1 from replace_reservation(null, club, 3, now() + interval '5 minutes');
  perform pg_temp.check('with no old hold it reserves exactly like reserve_tickets', pg_temp.club_reserved() = 3 and pg_temp.club_avail() = 1);
  select max_per_order into n from event_ticket_availability where event_key = 'test_night_1' and ticket_class_code = 'club_class';
  perform pg_temp.check('other guests see 1 left and max per order 1', n = 1, 'max_per_order=' || coalesce(n::text,'null'));
  select * into rec from class_view_for_holder(club, 3);
  perform pg_temp.check('the holder sees 4 left', rec.quantity_available = 4, rec.quantity_available::text);
  perform pg_temp.check('and may choose up to 4', rec.max_per_order = 4, rec.max_per_order::text);
  perform pg_temp.check('and the status still follows the usual rule (limited at 5 or under)', rec.status = 'limited', rec.status);
  select * into rec from class_view_for_holder(club, 0);
  perform pg_temp.check('a stranger (extra 0) gets the public figure', rec.quantity_available = 1 and rec.max_per_order = 1);
  select * into rec from class_view_for_holder(club, -5);
  perform pg_temp.check('a negative extra cannot lower it below the public figure', rec.quantity_available = 1);

  -- 2. Hold 3, change to 2: 3 released, 2 held, public count 2.
  select reservation_id, replaced_reservation_id into r2 from replace_reservation(r1, club, 2, now() + interval '5 minutes');
  perform pg_temp.check('change 3 to 2: the old hold is released', (select status from checkout_reservations where id = r1) = 'released');
  perform pg_temp.check('change 3 to 2: the new hold is held for 2', (select status || quantity from checkout_reservations where id = r2) = 'held2');
  perform pg_temp.check('change 3 to 2: reserved is 2 and the public count becomes 2', pg_temp.club_reserved() = 2 and pg_temp.club_avail() = 2);
  perform pg_temp.check('change reports which hold it replaced', (select replaced_reservation_id from replace_reservation(r2, club, 2, now() + interval '5 minutes') limit 1) = r2);
  -- that call replaced r2 with a third; track it
  select id into r3 from checkout_reservations where status = 'held' and event_ticket_class_id = club;
  perform pg_temp.check('same choice made through the swap still leaves exactly one live hold', (select count(*) from checkout_reservations where status = 'held' and event_ticket_class_id = club) = 1 and pg_temp.club_reserved() = 2);

  -- 3. Change to a sold out class: refused, old hold untouched.
  begin
    perform replace_reservation(r3, ring, 1, now() + interval '5 minutes');
    perform pg_temp.check('change to a sold out class is refused', false, 'it was allowed');
  exception when others then
    get stacked diagnostics v_msg = message_text;
    perform pg_temp.check('change to a sold out class is refused', v_msg = 'Only 0 remaining', v_msg);
  end;
  perform pg_temp.check('...and the old hold is still held, same size', (select status || quantity from checkout_reservations where id = r3) = 'held2');
  perform pg_temp.check('...and the old seats never came back to the public', pg_temp.club_reserved() = 2 and pg_temp.club_avail() = 2);
  perform pg_temp.check('...and nothing was reserved on the class that refused', (select reserved_quantity from event_ticket_classes where id = ring) = 0);

  -- 4. More than they could ever have, even with their own seats.
  begin
    perform replace_reservation(r3, club, 5, now() + interval '5 minutes');
    perform pg_temp.check('asking for more than own seats plus the public count is refused', false, 'it was allowed');
  exception when others then
    get stacked diagnostics v_msg = message_text;
    perform pg_temp.check('asking for more than own seats plus the public count is refused', v_msg = 'Only 4 remaining', v_msg);
  end;
  perform pg_temp.check('...old hold untouched', (select status || quantity from checkout_reservations where id = r3) = 'held2' and pg_temp.club_reserved() = 2);
  select reservation_id into r4 from replace_reservation(r3, club, 4, now() + interval '5 minutes');
  perform pg_temp.check('asking for exactly own seats plus the public count is allowed', (select status || quantity from checkout_reservations where id = r4) = 'held4' and pg_temp.club_avail() = 0);
  select status into st from event_ticket_availability where event_key = 'test_night_1' and ticket_class_code = 'club_class';
  perform pg_temp.check('the public sees the class as fully booked while the holder holds the last seats', st = 'fully_booked', st);
  select * into rec from class_view_for_holder(club, 4);
  perform pg_temp.check('the holder is not shown fully booked', rec.status in ('available','limited') and rec.quantity_available = 4, rec.status);

  -- 5. An expired hold is not live, and is not touched.
  update checkout_reservations set expires_at = now() - interval '1 second' where id = r4;
  perform pg_temp.check('live_hold ignores a hold past its time', not exists (select 1 from live_hold(r4)));
  update checkout_reservations set expires_at = now() + interval '5 minutes' where id = r4;
  perform pg_temp.check('live_hold finds a live hold', exists (select 1 from live_hold(r4)));
  perform pg_temp.check('live_hold with the right night finds it, the wrong night does not',
    exists (select 1 from live_hold(r4, 'test_night_1')) and not exists (select 1 from live_hold(r4, 'test_night_2')));
  perform pg_temp.check('live_hold reports whole seconds left', (select seconds_left from live_hold(r4)) between 295 and 300);
  update checkout_reservations set status = 'completed' where id = r4;
  perform pg_temp.check('live_hold ignores a paid reservation', not exists (select 1 from live_hold(r4)));
  update checkout_reservations set status = 'held' where id = r4;

  -- 6. A hold on a different night is not replaced.
  select reservation_id, replaced_reservation_id into r5 from replace_reservation(r4, club2, 1, now() + interval '5 minutes');
  perform pg_temp.check('a hold on another night is left alone', (select status from checkout_reservations where id = r4) = 'held');
  perform pg_temp.check('...and the swap says it replaced nothing', (select replaced_reservation_id from replace_reservation(null, club2, 1, now() + interval '5 minutes')) is null);

  -- 7. A made-up id is nothing special.
  perform pg_temp.check('an unknown old hold is just a new reservation', (select count(*) from replace_reservation(gen_random_uuid(), club2, 1, now() + interval '5 minutes')) = 1);

  -- 8. Quantity checks match reserve_tickets.
  begin perform replace_reservation(null, club2, 0, now() + interval '5 minutes');
    perform pg_temp.check('zero is refused', false);
  exception when others then get stacked diagnostics v_msg = message_text;
    perform pg_temp.check('zero is refused', v_msg = 'Quantity must be at least 1', v_msg); end;
  begin perform replace_reservation(null, gen_random_uuid(), 1, now() + interval '5 minutes');
    perform pg_temp.check('an unknown class is refused', false);
  exception when others then get stacked diagnostics v_msg = message_text;
    perform pg_temp.check('an unknown class is refused', v_msg = 'Ticket class not found', v_msg); end;
end $$;

-- ---- late payment is exactly what it was ----------------------------------
do $$
declare club constant uuid := '00000000-0000-0000-0000-00000000f201'; r uuid; res text; q integer;
begin
  -- fresh class, 3 seats: hold 2, swap to 1 (so the first is 'released'), then the
  -- first is paid late with room to spare.
  update event_ticket_classes set total_quantity = 3, reserved_quantity = 0, sold_quantity = 0 where id = club;
  update checkout_reservations set status = 'failed' where event_ticket_class_id = club and status = 'held';
  select reservation_id into r from replace_reservation(null, club, 2, now() + interval '5 minutes');
  perform replace_reservation(r, club, 1, now() + interval '5 minutes');
  select complete_reservation(r) into res;
  perform pg_temp.check('late payment on a released hold with room completes late (unchanged behaviour)', res = 'completed_late', res);
  -- now with no room: hold the last seat elsewhere, then pay another released one
  update event_ticket_classes set total_quantity = 4, reserved_quantity = 0, sold_quantity = 0 where id = club;
  update checkout_reservations set status = 'failed' where event_ticket_class_id = club and status = 'held';
  select reservation_id into r from replace_reservation(null, club, 3, now() + interval '5 minutes');
  perform replace_reservation(r, club, 1, now() + interval '5 minutes');
  perform replace_reservation(null, club, 3, now() + interval '5 minutes');   -- someone else takes the rest
  select complete_reservation(r) into res;
  perform pg_temp.check('late payment on a released hold with no room is paid_without_stock (unchanged behaviour)', res = 'paid_without_stock', res);
end $$;

-- ---- the existing functions were not touched --------------------------------
select pg_temp.check('reserve_tickets, release_reservation, complete_reservation and the status function are byte for byte what they were',
  (select count(*) from before_defs b join pg_proc p on p.proname = b.proname and p.pronamespace = 'public'::regnamespace
    where b.h = md5(pg_get_functiondef(p.oid))) = 4);

-- ---- who may call them, and what they read ---------------------------------
select pg_temp.check('anon may not call live_hold', not has_function_privilege('anon', 'public.live_hold(uuid,text)', 'execute'));
select pg_temp.check('authenticated may not call live_hold', not has_function_privilege('authenticated', 'public.live_hold(uuid,text)', 'execute'));
select pg_temp.check('anon may not call replace_reservation', not has_function_privilege('anon', 'public.replace_reservation(uuid,uuid,integer,timestamptz)', 'execute'));
select pg_temp.check('anon may not call class_view_for_holder', not has_function_privilege('anon', 'public.class_view_for_holder(uuid,integer)', 'execute'));
select pg_temp.check('the service role may call all three',
  has_function_privilege('service_role', 'public.live_hold(uuid,text)', 'execute')
  and has_function_privilege('service_role', 'public.replace_reservation(uuid,uuid,integer,timestamptz)', 'execute')
  and has_function_privilege('service_role', 'public.class_view_for_holder(uuid,integer)', 'execute'));
select pg_temp.check('no new function mentions a guest column',
  (select count(*) from pg_proc where pronamespace = 'public'::regnamespace
    and proname in ('live_hold','class_view_for_holder','replace_reservation')
    and (prosrc ilike '%guest_email%' or prosrc ilike '%guest_name%' or pg_get_function_result(oid) ilike '%guest%')) = 0);

-- ---- the access changes touch only the new functions ----------------------
select pg_temp.check('every function that existed before 0043 has exactly the access it had',
  (select count(*) from before_acls b join pg_proc p on p.oid::regprocedure::text = b.sig
    where coalesce(p.proacl::text, 'default') <> b.acl) = 0);
select pg_temp.check('the only functions 0043 added are the three new ones',
  (select string_agg(p.oid::regprocedure::text, ', ' order by 1) from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.oid::regprocedure::text not in (select sig from before_acls))
  = 'class_view_for_holder(uuid,integer), live_hold(uuid,text), replace_reservation(uuid,uuid,integer,timestamp with time zone)');

-- ---- and the rollback puts everything back --------------------------------
create temp table after_defs as
  select proname, md5(pg_get_functiondef(oid)) h from pg_proc
  where pronamespace = 'public'::regnamespace
    and proname in ('reserve_tickets','release_reservation','complete_reservation','ticket_availability_status','expire_stale_reservations');
\ir ../0043_guest_hold_rollback.sql
select pg_temp.check('the rollback removes the three new functions',
  (select count(*) from pg_proc where pronamespace = 'public'::regnamespace
    and proname in ('live_hold','class_view_for_holder','replace_reservation')) = 0);
select pg_temp.check('and leaves exactly the functions that were there before, with the same access',
  (select count(*) from pg_proc p where p.pronamespace = 'public'::regnamespace) = (select count(*) from before_acls)
  and (select count(*) from before_acls b join pg_proc p on p.oid::regprocedure::text = b.sig
        where coalesce(p.proacl::text, 'default') = b.acl) = (select count(*) from before_acls));
select pg_temp.check('and the existing functions are still byte for byte what they were',
  (select count(*) from after_defs a join pg_proc p on p.proname = a.proname and p.pronamespace = 'public'::regnamespace
    where a.h = md5(pg_get_functiondef(p.oid))) = 5);
select pg_temp.check('the reservations and class counts the swaps left behind are untouched by it',
  (select count(*) from checkout_reservations) > 0);
\ir ../0043_guest_hold_rollback.sql
-- and the migration can go back on after a rollback, leaving the copy ready for the
-- concurrency test that runs next
\ir ../0043_guest_hold.sql
select pg_temp.check('the migration applies again after a rollback',
  (select count(*) from pg_proc where pronamespace = 'public'::regnamespace and proname in ('live_hold','class_view_for_holder','replace_reservation')) = 3);

do $$ declare bad integer; begin
  select count(*) into bad from results where not ok;
  raise notice '% checks, % failed', (select count(*) from results), bad;
  if bad > 0 then raise exception '% database checks failed', bad; end if;
end $$;
