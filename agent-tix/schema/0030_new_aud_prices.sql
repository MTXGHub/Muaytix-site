-- Jason, 1 October 2026: new AUD prices, same low-to-high order as every
-- other currency tonight (Third Class, LEO Section, Club Class, Ringside).
-- Third Class was already 44, so only the other three actually change.
-- Checked first: no active AUD override for any of the three in
-- event_ticket_price_overrides, so ticket_class_prices was the only place
-- that needed changing.
--
--   LEO Section   AUD 66 -> 65
--   Club Class    AUD 79 -> 78
--   Ringside      AUD 109 -> 108
--   (Third Class unchanged: already 44)
--
-- Applied directly against production via the Supabase MCP tool, then
-- confirmed by reading back through event_ticket_prices itself: all four
-- classes now show exactly the numbers above, across every event.

update ticket_class_prices set unit_amount = 6500
  where currency = 'aud' and ticket_class_id = (select id from ticket_classes where code = 'leo_section');

update ticket_class_prices set unit_amount = 7800
  where currency = 'aud' and ticket_class_id = (select id from ticket_classes where code = 'club_class');

update ticket_class_prices set unit_amount = 10800
  where currency = 'aud' and ticket_class_id = (select id from ticket_classes where code = 'ringside');
