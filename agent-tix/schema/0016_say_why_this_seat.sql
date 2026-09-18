-- Give every seat class a reason to be chosen.
--
-- Jason, 18 September 2026: he watched a friend open the widget, reach the
-- seat step and stall. She was not confused about how to tap a tile -- she had
-- no idea which of the four was for her. Four names, four status labels, and
-- nothing that said what any of them is like.
--
-- The answer was already written, on the same page, under "Choose your seat
-- class", where almost nobody scrolls: closest to the action, most popular,
-- best for atmosphere. Those lines belong on the tile itself.
--
-- A tagline, not a description. The description is a paragraph and already has
-- its place further into the booking; this is three or four words, upper case,
-- read in half a second. It lives here rather than in the widget so a fifth
-- seat class needs no change to the front end -- the same reason the accent
-- colours were moved out of the widget in the first place.

alter table ticket_classes add column tagline text;

comment on column ticket_classes.tagline is
  'Three or four words on why a guest would choose this class. Shown above the '
  'name on the seat tile, in upper case. Null shows nothing rather than a gap.';

update ticket_classes set tagline = 'Closest to the action' where code = 'ringside';
update ticket_classes set tagline = 'Most popular'          where code = 'club_class';
update ticket_classes set tagline = 'Best for atmosphere'   where code = 'leo_section';
update ticket_classes set tagline = 'Best value'            where code = 'third_class';
