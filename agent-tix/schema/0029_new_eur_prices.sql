-- Jason, 1 October 2026: new EUR prices. Checked before applying: Third
-- Class (27), LEO Section (40) and Club Class (48) were already exactly
-- these numbers, so only Ringside actually changes. No active EUR override
-- on Ringside in event_ticket_price_overrides, so ticket_class_prices was
-- the only place that needed changing.
--
--   Ringside   EUR 67 -> 66
--   (Third Class, LEO Section, Club Class unchanged: already correct)
--
-- Applied directly against production via the Supabase MCP tool, then
-- confirmed by reading back through event_ticket_prices itself: all four
-- classes now show exactly the numbers above, across every event.

update ticket_class_prices set unit_amount = 6600
  where currency = 'eur' and ticket_class_id = (select id from ticket_classes where code = 'ringside');
