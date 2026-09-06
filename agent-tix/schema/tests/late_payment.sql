-- Does a payment that arrives after the hold has lapsed still work?
--
-- Run it against the live database. Everything is rolled back by the raise at
-- the end, so it leaves nothing behind: "ALL CHECKS PASSED" is the success
-- message, not an error.
--
-- The hold is five minutes and the Stripe payment page lives for thirty-one,
-- so a guest can abandon checkout and pay twenty minutes later. These are the
-- three things that must hold when they do.

do $$
declare
  v_class uuid; v_tenant uuid; v_res uuid; v_out text;
  v_sold_before integer; v_sold_after integer;
  v_fail text := '';
begin
  -- A night that has already finished, so nothing here touches one still
  -- selling. It all rolls back regardless.
  select etc.id, etc.tenant_id, etc.sold_quantity
    into v_class, v_tenant, v_sold_before
  from event_ticket_classes etc
  join events e on e.id = etc.event_id
  where e.starts_at < now() - interval '2 days'
  limit 1;

  if v_class is null then raise exception 'no finished night to test against'; end if;

  -- 1. Lapsed hold, seats still spare: the guest gets their tickets.
  insert into checkout_reservations (tenant_id, event_ticket_class_id, quantity,
         currency, unit_amount, status, expires_at)
  values (v_tenant, v_class, 2, 'thb', 100, 'expired', now() - interval '1 minute')
  returning id into v_res;

  v_out := complete_reservation(v_res, 'cs_test_late', 'pi_test_late');
  if v_out <> 'completed_late' then
    v_fail := v_fail || format('spare seats returned %s, wanted completed_late; ', v_out);
  end if;
  select sold_quantity into v_sold_after from event_ticket_classes where id = v_class;
  if v_sold_after <> v_sold_before + 2 then
    v_fail := v_fail || format('sold went %s -> %s, wanted +2; ', v_sold_before, v_sold_after);
  end if;

  -- Stripe sends the same event twice. The second must not sell the seats again.
  v_out := complete_reservation(v_res, 'cs_test_late', 'pi_test_late');
  if v_out <> 'already_completed' then
    v_fail := v_fail || format('second payment returned %s, wanted already_completed; ', v_out);
  end if;
  select sold_quantity into v_sold_after from event_ticket_classes where id = v_class;
  if v_sold_after <> v_sold_before + 2 then
    v_fail := v_fail || 'second payment moved the stock; ';
  end if;

  -- 2. Lapsed hold, seats gone to someone else: take nothing, flag a refund.
  update event_ticket_classes set total_quantity = sold_quantity where id = v_class;

  insert into checkout_reservations (tenant_id, event_ticket_class_id, quantity,
         currency, unit_amount, status, expires_at)
  values (v_tenant, v_class, 2, 'thb', 100, 'expired', now() - interval '1 minute')
  returning id into v_res;

  select sold_quantity into v_sold_before from event_ticket_classes where id = v_class;
  v_out := complete_reservation(v_res, 'cs_test_gone', 'pi_test_gone');
  if v_out <> 'paid_without_stock' then
    v_fail := v_fail || format('no seats returned %s, wanted paid_without_stock; ', v_out);
  end if;
  select sold_quantity into v_sold_after from event_ticket_classes where id = v_class;
  if v_sold_after <> v_sold_before then
    v_fail := v_fail || 'oversold: stock moved with no seats spare; ';
  end if;
  if not exists (select 1 from bookings_needing_a_refund where reservation_id = v_res) then
    v_fail := v_fail || 'the refund list did not pick it up; ';
  end if;

  -- 3. An ordinary hold still behaves exactly as it always did.
  insert into checkout_reservations (tenant_id, event_ticket_class_id, quantity,
         currency, unit_amount, status, expires_at)
  values (v_tenant, v_class, 1, 'thb', 100, 'held', now() + interval '5 minutes')
  returning id into v_res;
  update event_ticket_classes
     set total_quantity = sold_quantity + 1, reserved_quantity = reserved_quantity + 1
   where id = v_class;
  select sold_quantity into v_sold_before from event_ticket_classes where id = v_class;
  v_out := complete_reservation(v_res, 'cs_test_held', 'pi_test_held');
  if v_out <> 'completed' then
    v_fail := v_fail || format('ordinary hold returned %s, wanted completed; ', v_out);
  end if;
  select sold_quantity into v_sold_after from event_ticket_classes where id = v_class;
  if v_sold_after <> v_sold_before + 1 then
    v_fail := v_fail || 'ordinary hold did not move the stock; ';
  end if;

  if v_fail = '' then
    raise exception 'ALL CHECKS PASSED (rolling back)';
  else
    raise exception 'FAILED: %', v_fail;
  end if;
end $$;
