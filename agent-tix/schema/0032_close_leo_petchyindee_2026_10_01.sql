-- Jason, 1 October 2026: close LEO Section as fully booked for tonight only,
-- Petchyindee Traditional Muay Thai, 1 Oct, 18:00 Bangkok (event id
-- 3108833e-056f-4d68-baad-6c9e0f06e479, event_ticket_classes id
-- 5dd280c7-4a14-4713-a2e3-5e61837ccd77). LEO Section is real stock already
-- held (see CLAUDE.md section 6), so this is a trading call, not a sellout:
-- 25 total, 0 sold at the time of closing.
--
-- Applied directly against production via the Supabase MCP tool, then
-- confirmed by reading back through event_ticket_availability itself: LEO
-- Section now shows status "fully_booked" for this event, Ringside and Club
-- Class remain "available", Third Class remains closed as normal.
--
-- This event only. Other nights' LEO Section rows are untouched.

update event_ticket_classes
set manual_status = 'fully_booked'
where id = '5dd280c7-4a14-4713-a2e3-5e61837ccd77';
