-- 8 November 2026 (Jason): new Ringside prices. APPLIED to agent-tix-build the same day, data only.
-- Standing prices, every night without its own override: GBP 56, USD 75, EUR 68, AUD 110
-- (were 55, 75, 66, 108; USD did not change). RWS 81 Anniversary (26 Dec) keeps its own Ringside prices
-- (115, 105, 85, 170).
update public.ticket_class_prices p set unit_amount = v.amt
  from public.ticket_classes tc, (values ('gbp', 5600), ('usd', 7500), ('eur', 6800), ('aud', 11000)) v(cur, amt)
 where tc.id = p.ticket_class_id and tc.code = 'ringside' and p.currency = v.cur;
