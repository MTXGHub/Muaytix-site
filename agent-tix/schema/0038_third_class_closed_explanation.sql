-- Third Class: why it is closed, in words a guest from anywhere can follow.
--
-- Jason, 5 October 2026. The stadium's own site shows nothing at all for a class
-- that is not open. We show Third Class with "Closed" on it, and a curious guest
-- who is not told why leaves, checks two or three other sites, and buys on the
-- third or fourth. They do not come back. So the tile now says why.
--
-- Three short sentences. It opens when the other classes are close to full, and
-- it does not open every night (about two or three times a week at most, some
-- weeks once), so the last sentence keeps a guest from waiting for it.
--
-- The text is per night, on event_ticket_classes. Any night loaded later with
-- Third Class not released needs the same text, or the old longer sentence shows.

update event_ticket_classes etc
set closed_explanation = 'Third Class is currently closed. The stadium opens it when the other seat classes are close to full. This does not happen every night.'
from ticket_classes tc
where tc.id = etc.ticket_class_id
  and tc.code = 'third_class'
  and etc.release_status = 'not_released';
