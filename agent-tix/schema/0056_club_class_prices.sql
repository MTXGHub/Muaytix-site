-- 8 November 2026 (Jason): new Club Class prices. APPLIED to agent-tix-build the same day, data only.
-- Standing prices, every night without its own override: GBP 40, EUR 50, USD 55, AUD 80
-- (were 40, 48, 54, 78; GBP did not change). RWS 81 Anniversary (26 Dec) keeps its own Club Class prices
-- (75, 66, 55, 108). The Club Class offer is switched off (0055), so its old offer prices no longer matter.
update public.ticket_class_prices p set unit_amount = v.amt
  from public.ticket_classes tc, (values ('gbp', 4000), ('eur', 5000), ('usd', 5500), ('aud', 8000)) v(cur, amt)
 where tc.id = p.ticket_class_id and tc.code = 'club_class' and p.currency = v.cur;
