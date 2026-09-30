-- Jason, 1 October 2026: new USD ticket prices, meant to work in the
-- guest's favour (rounder, slightly lower numbers), not a correction of an
-- error.
--
--   Ringside     $77.00 -> $75.00
--   Club Class   $55.00 -> $54.00
--   LEO Section  $46.00 -> $45.00
--   Third Class  $31.00 -> $30.00
--
-- Checked before applying: event_ticket_prices (what create-checkout
-- actually reads) falls back to ticket_class_prices unless a per-event row
-- exists in event_ticket_price_overrides. No active USD override exists for
-- any event or class, so this table is the only place that needed changing
-- and every event picks the new price up automatically.
--
-- Applied directly against production via the Supabase MCP tool, then
-- confirmed by reading back through event_ticket_prices itself, grouped by
-- ticket class: each of the four now shows exactly one USD price across
-- every event, matching the numbers above.

update ticket_class_prices set unit_amount = 7500
  where currency = 'usd' and ticket_class_id = (select id from ticket_classes where code = 'ringside');

update ticket_class_prices set unit_amount = 5400
  where currency = 'usd' and ticket_class_id = (select id from ticket_classes where code = 'club_class');

update ticket_class_prices set unit_amount = 4500
  where currency = 'usd' and ticket_class_id = (select id from ticket_classes where code = 'leo_section');

update ticket_class_prices set unit_amount = 3000
  where currency = 'usd' and ticket_class_id = (select id from ticket_classes where code = 'third_class');
