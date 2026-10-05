-- Photos and short selling lines for each seat class, shown on the seat tile.
--
-- Jason, 5 October 2026. LEO Section had ten tickets unsold on a quiet week and
-- the reason is not price: guests still believe LEO is a standing area, and
-- that it is a worse view than Club Class. The tile carried a name, a strapline
-- and a price, and nothing that answers either doubt. A photograph from the seat
-- answers the second; one plain line answers the first.
--
-- Both live on the class, not in the widget, for the same reason the strapline
-- does: changing a photo or a line is a database edit, not a release, and every
-- page that hosts the widget shows the same thing.
--
-- Launched one class at a time. A class with an empty photos list is drawn
-- exactly as it was, so adding Club Class next is an update to one row.
--
-- photos:   [{"url": "https://...", "alt": "plain description"}, ...] in the
--           order they are shown. The first is the first thing a guest sees.
-- benefits: [{"text": "...", "note": "..."}, ...] in the order they are shown.
--           "note" is optional and sits under its line, in brackets as written.
--
-- The widget draws photos only while the class can be bought. Sold out or
-- closed, the tile shrinks back to the compact one, so a guest is never shown
-- a seat they cannot have.

alter table ticket_classes
  add column photos   jsonb not null default '[]'::jsonb,
  add column benefits jsonb not null default '[]'::jsonb;

alter table ticket_classes
  add constraint ticket_classes_photos_is_list   check (jsonb_typeof(photos)   = 'array'),
  add constraint ticket_classes_benefits_is_list check (jsonb_typeof(benefits) = 'array');

comment on column ticket_classes.photos is
  'Photos shown on the seat tile, in order: [{"url","alt"}]. Empty shows none.';
comment on column ticket_classes.benefits is
  'Short selling lines shown under the photos, in order: [{"text","note"?}].';

-- LEO Section, in the order Jason chose: front row first (the ring, the lights
-- and the whole arena in one frame), then the back row (the worst seat, still
-- good), then the map, then the seating itself.
update ticket_classes set
  photos = '[
    {"url": "https://static.tildacdn.com/tild6636-6437-4337-b564-306461383262/1000035272.jpg",
     "alt": "View from the front row of LEO Section"},
    {"url": "https://static.tildacdn.com/tild3431-3865-4138-a137-316335353536/1000035271.jpg",
     "alt": "View from the back row of LEO Section"},
    {"url": "https://static.tildacdn.com/tild3364-3131-4461-b338-363930323965/1000035278.jpg",
     "alt": "Stadium seat map with LEO Section, Section 10, shown in yellow"},
    {"url": "https://static.tildacdn.com/tild3766-3239-4230-a462-383036343832/1000035279.jpg",
     "alt": "LEO Section seating"}
  ]'::jsonb,
  benefits = '[
    {"text": "LEO Section has exactly the same elevation and crystal clear view to the ring as Club Class"},
    {"text": "Everyone is guaranteed a seat in LEO Section",
     "note": "(There are no standing areas in the whole stadium)"},
    {"text": "LEO Section faces the front of the ring"},
    {"text": "LEO Section is where the stadium''s atmosphere is at its best"},
    {"text": "LEO Section is the choice of local fight fans"}
  ]'::jsonb
where code = 'leo_section';
