-- Jason, 1 October 2026: new GBP prices, rounded from the live USD->GBP
-- conversion of the new USD prices (30/45/54/75, see 0027) at roughly 0.748.
-- His own deliberate rounding, not nearest-whole-number: LEO rounds down to
-- 33 (33.65 exact), not up to 35 as first proposed here and corrected by
-- him; Third Class and Ringside also round down (22.44 and 56.09), Club
-- Class rounds down from 40.38. He's absorbing this inside the 2.2-2.8% he
-- says conversion already costs, aiming for a GBP price that reads as
-- cheaper than the Thai one once a guest does the maths themselves.
--
--   Third Class   GBP 23 -> 22
--   LEO Section   GBP 34 -> 33
--   Club Class    GBP 41 -> 40
--   Ringside      GBP 57 -> 55
--
-- Checked before applying, same as 0027: no active GBP override in
-- event_ticket_price_overrides for any event or class, so ticket_class_prices
-- is the only table that needed changing, and every event picks it up
-- automatically through event_ticket_prices.
--
-- Applied directly against production via the Supabase MCP tool, then
-- confirmed by reading back through event_ticket_prices itself, grouped by
-- ticket class: each of the four now shows exactly one GBP price across
-- every event, matching the numbers above.

update ticket_class_prices set unit_amount = 2200
  where currency = 'gbp' and ticket_class_id = (select id from ticket_classes where code = 'third_class');

update ticket_class_prices set unit_amount = 3300
  where currency = 'gbp' and ticket_class_id = (select id from ticket_classes where code = 'leo_section');

update ticket_class_prices set unit_amount = 4000
  where currency = 'gbp' and ticket_class_id = (select id from ticket_classes where code = 'club_class');

update ticket_class_prices set unit_amount = 5500
  where currency = 'gbp' and ticket_class_id = (select id from ticket_classes where code = 'ringside');
