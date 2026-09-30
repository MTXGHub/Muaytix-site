-- Jason, 1 October 2026: new CNY prices, same low-to-high order as every
-- other currency tonight (Third Class, LEO Section, Club Class, Ringside).
-- All four actually change this time. Checked first: no active CNY override
-- for any class in event_ticket_price_overrides, so ticket_class_prices was
-- the only place that needed changing.
--
--   Third Class   CNY 210 -> 200
--   LEO Section   CNY 310 -> 300
--   Club Class    CNY 380 -> 360
--   Ringside      CNY 520 -> 500
--
-- Applied directly against production via the Supabase MCP tool, then
-- confirmed by reading back through event_ticket_prices itself: all four
-- classes now show exactly the numbers above, across every event.

update ticket_class_prices set unit_amount = 20000
  where currency = 'cny' and ticket_class_id = (select id from ticket_classes where code = 'third_class');

update ticket_class_prices set unit_amount = 30000
  where currency = 'cny' and ticket_class_id = (select id from ticket_classes where code = 'leo_section');

update ticket_class_prices set unit_amount = 36000
  where currency = 'cny' and ticket_class_id = (select id from ticket_classes where code = 'club_class');

update ticket_class_prices set unit_amount = 50000
  where currency = 'cny' and ticket_class_id = (select id from ticket_classes where code = 'ringside');
